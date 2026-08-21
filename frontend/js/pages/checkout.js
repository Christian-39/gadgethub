import { API, formatNaira } from '../core/api.js';
import { UI } from '../core/ui.js';
import { Auth } from '../core/auth.js';

class CheckoutPage {
    static cartItems = [];
    static shippingFees = [];
    static selectedAddress = null;
    static addresses = [];          // ← cached so calculateShipping can reuse them
    static pinState = { verifiedValue: null, valid: false };

    static async init() {
        if (!Auth.isAuthenticated()) {
            window.location.href = '/login.html?redirect=/checkout.html';
            return;
        }

        await this.loadAddresses();
        await this.loadCart();
        this.bindEvents();

        // Auto-quote shipping for the pre-selected address on load
        if (this.selectedAddress) {
            await this.calculateShipping();
        }
    }

    static async loadAddresses() {
        const container = document.getElementById('address-list');
        try {
            const addresses = await API.get('/auth/addresses/');
            this.addresses = addresses;   // ← cache for calculateShipping

            if (!addresses.length) {
                container.innerHTML = '<p>No saved addresses. <a href="/profile.html#addresses">Add one</a></p>';
                return;
            }

            container.innerHTML = addresses.map(a => `
                <div class="address-card ${a.is_default ? 'selected' : ''}" data-id="${a.id}">
                    <div class="address-radio">
                        <input type="radio" name="address" value="${a.id}" ${a.is_default ? 'checked' : ''}>
                    </div>
                    <div class="address-info">
                        <strong>${a.label}</strong>
                        <p>${a.full_name}</p>
                        <p>${a.address_1} ${a.address_2}</p>
                        <p>${a.city}, ${a.state}</p>
                        <p>${a.phone_number}</p>
                    </div>
                </div>
            `).join('');

            // If nothing is marked default, visually select the first card
            if (!addresses.find(a => a.is_default)) {
                document.querySelector('.address-card')?.classList.add('selected');
                document.querySelector('input[name="address"]')?.setAttribute('checked', 'true');
            }

            container.querySelectorAll('.address-card').forEach(card => {
                card.addEventListener('click', () => {
                    container.querySelectorAll('.address-card').forEach(c => c.classList.remove('selected'));
                    card.classList.add('selected');
                    card.querySelector('input').checked = true;
                    // Use String() so integer IDs from the API and string dataset IDs match
                    this.selectedAddress = String(card.dataset.id);
                    this.calculateShipping();
                });
            });

            // Initial selection: default first, otherwise first address
            const initial = addresses.find(a => a.is_default) || addresses[0];
            this.selectedAddress = String(initial.id);
        } catch (e) {
            container.innerHTML = '<p class="error">Failed to load addresses</p>';
        }
    }

    static async loadCart() {
        const container = document.getElementById('checkout-items');
        try {
            this.cartItems = await API.get('/products/cart/');

            if (!this.cartItems.length) {
                window.location.href = '/cart.html';
                return;
            }

            let subtotal = 0;
            container.innerHTML = this.cartItems.map(item => {
                subtotal += item.total;
                return `
                    <div class="checkout-item">
                        <img src="${item.product.image ? 'https://payuee.com/image/' + item.product.image : '/assets/placeholder.jpg'}" alt="${item.product.title}">
                        <div>
                            <h4>${item.product.title}</h4>
                            <p>Qty: ${item.quantity} ${item.size ? `| Size: ${item.size}` : ''}</p>
                            <p class="price">${formatNaira(item.total)}</p>
                        </div>
                    </div>
                `;
            }).join('');

            document.getElementById('checkout-subtotal').textContent = formatNaira(subtotal);
        } catch (e) {
            container.innerHTML = '<p class="error">Failed to load cart</p>';
        }
    }

    static async calculateShipping() {
        // Look up from the cached address list (no redundant API call)
        const address = this.addresses.find(
            ad => String(ad.id) === String(this.selectedAddress)
        );
        if (!address) return;

        const vendors = [...new Set(this.cartItems.map(i => i.product.vendor_id))];
        const cartPayload = this.cartItems.map(i => ({
            product_id: i.product.id,
            eshop_user_id: i.product.vendor_id,
            quantity: i.quantity
        }));

        try {
            const data = await API.post('/orders/shipping-fees/', {
                vendors,
                state: address.state,
                city: address.city,
                latitude: address.latitude || 6.5244,
                longitude: address.longitude || 3.3792,
                cart_items: cartPayload
            });

            this.shippingFees = data.shipping || [];
            const totalShipping = this.shippingFees.reduce((sum, s) => sum + (s.fee / 100), 0);
            const subtotal = this.cartItems.reduce((sum, i) => sum + i.total, 0);

            document.getElementById('checkout-shipping').textContent = formatNaira(totalShipping);
            document.getElementById('checkout-total').textContent = formatNaira(subtotal + totalShipping);

            // Show shipping breakdown
            document.getElementById('shipping-breakdown').innerHTML = this.shippingFees.map(s => `
                <div class="shipping-option">
                    <span>${s.company_name} (${s.reason})</span>
                    <span>${formatNaira(s.fee / 100)}</span>
                </div>
            `).join('');
        } catch (e) {
            const shippingEl = document.getElementById('checkout-shipping');
            if (shippingEl) shippingEl.textContent = 'Shipping calculated at checkout';
            UI.showToast(e.message || 'Failed to calculate shipping', 'error');
        }
    }

    static bindEvents() {
        this.bindPinValidation();

        document.getElementById('place-order')?.addEventListener('click', async () => {
            const pinInput = document.getElementById('trans-code');
            const transCode = pinInput.value;
            if (!transCode || transCode.length !== 6) {
                UI.showToast('Enter a valid 6-digit transaction PIN', 'error');
                return;
            }

            if (this.pinState.verifiedValue === transCode && !this.pinState.valid) {
                UI.showToast('Transaction PIN is incorrect. Please enter the correct PIN.', 'error');
                pinInput.focus();
                return;
            }

            if (!this.selectedAddress) {
                UI.showToast('Select a delivery address', 'error');
                return;
            }

            if (!this.shippingFees.length) {
                UI.showToast('Calculate shipping first', 'error');
                return;
            }

            try {
                const result = await API.post('/orders/create/', {
                    address_id: this.selectedAddress,
                    trans_code: transCode,
                    shipping: this.shippingFees.map(s => ({
                        vendor_id: s.vendor_id,
                        fee: s.fee,
                        method_id: s.method_id,
                        config_id: s.config_id,
                        company_name: s.company_name
                    }))
                });

                if (result.status === 'hold') {
                    UI.showToast('Order on hold - please fund your wallet', 'warning');
                } else {
                    UI.showToast('Order placed successfully!', 'success');
                }

                window.location.href = `/orders.html?id=${result.order_id}`;
            } catch (err) {
                if (err.message && err.message.toLowerCase().includes('pin')) {
                    this.setPinState(transCode, false);
                }
                UI.showToast(err.message, 'error');
            }
        });
    }

    static bindPinValidation() {
        const input = document.getElementById('trans-code');
        if (!input) return;

        input.addEventListener('input', () => {
            const value = input.value;
            input.classList.remove('pin-valid', 'pin-invalid');
            this.clearPinFeedback();

            if (value.length !== 6) {
                this.pinState = { verifiedValue: null, valid: false };
                return;
            }
            if (this.pinState.verifiedValue === value) {
                input.classList.add(this.pinState.valid ? 'pin-valid' : 'pin-invalid');
                return;
            }
            this.verifyPin(value);
        });
    }

    static async verifyPin(value) {
        const input = document.getElementById('trans-code');
        try {
            const result = await API.post('/auth/verify-pin/', { pin: value });
            if (input.value !== value) return;
            this.setPinState(value, !!result.valid);
        } catch (err) {
            if (input.value !== value) return;
            this.pinState = { verifiedValue: null, valid: false };
            this.showPinFeedback('Could not verify PIN right now - it will still be checked when you place the order.', false);
        }
    }

    static setPinState(value, valid) {
        this.pinState = { verifiedValue: value, valid };
        const input = document.getElementById('trans-code');
        input.classList.remove('pin-valid', 'pin-invalid');
        input.classList.add(valid ? 'pin-valid' : 'pin-invalid');
        if (!valid) {
            this.showPinFeedback('Transaction PIN is incorrect. Please enter the correct PIN.', true);
        } else {
            this.clearPinFeedback();
        }
    }

    static showPinFeedback(message, isError) {
        let el = document.getElementById('pin-feedback');
        const input = document.getElementById('trans-code');
        if (!el) {
            el = document.createElement('p');
            el.id = 'pin-feedback';
            input.insertAdjacentElement('afterend', el);
        }
        el.className = isError ? 'pin-feedback pin-feedback-error' : 'pin-feedback';
        el.textContent = message;
    }

    static clearPinFeedback() {
        document.getElementById('pin-feedback')?.remove();
    }
}

export { CheckoutPage };