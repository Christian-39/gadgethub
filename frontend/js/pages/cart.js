import { API, formatNaira } from '../core/api.js';
import { UI } from '../core/ui.js';
import { App } from '../core/app.js';

class CartPage {
    static async init() {
        await this.loadCart();
    }

    static async loadCart() {
        const container = document.getElementById('cart-items');
        const summary = document.getElementById('cart-summary');
        if (!container) return;
        
        try {
            const items = await API.get('/products/cart/');
            
            if (!items.length) {
                container.innerHTML = `
                    <div class="empty-state">
                        <h2>Your cart is empty</h2>
                        <p>Browse our products and add items to your cart</p>
                        <a href="/products.html" class="btn-primary">Start Shopping</a>
                    </div>
                `;
                if (summary) summary.style.display = 'none';
                return;
            }
            
            let subtotal = 0;
            container.innerHTML = items.map(item => {
                subtotal += item.total;
                return `
                    <div class="cart-item" data-id="${item.id}">
                        <img src="${item.product.image ? 'https://payuee.com/image/' + item.product.image : '/assets/placeholder.jpg'}" alt="${item.product.title}" loading="lazy" onerror="this.onerror=null;this.src='/assets/placeholder.jpg';">
                        <div class="cart-item-info">
                            <h3>${item.product.title}</h3>
                            <p class="cart-item-meta">${item.size ? `Size: ${item.size}` : ''}</p>
                            <p class="cart-item-price">${formatNaira(item.product.price)}</p>
                        </div>
                        <div class="cart-item-actions">
                            <div class="qty-control">
                                <button class="qty-btn" data-action="minus" data-id="${item.id}">−</button>
                                <span>${item.quantity}</span>
                                <button class="qty-btn" data-action="plus" data-id="${item.id}">+</button>
                            </div>
                            <p class="cart-item-total">${formatNaira(item.total)}</p>
                            <button class="btn-remove" data-id="${item.id}">🗑</button>
                        </div>
                    </div>
                `;
            }).join('');
            
            const shipping = 0; // Calculated at checkout
            const total = subtotal + shipping;
            
            if (summary) {
                summary.style.display = 'block';
                summary.innerHTML = `
                    <h3>Order Summary</h3>
                    <div class="summary-row"><span>Subtotal</span><span>${formatNaira(subtotal)}</span></div>
                    <div class="summary-row"><span>Shipping</span><span>Calculated at checkout</span></div>
                    <div class="summary-row total"><span>Total</span><span>${formatNaira(total)}</span></div>
                    <a href="/checkout.html" class="btn-primary btn-large btn-full">Proceed to Checkout</a>
                `;
            }
            
            this.bindEvents();
        } catch (e) {
            container.innerHTML = '<p class="error">Failed to load cart</p>';
        }
    }

    static bindEvents() {
        document.querySelectorAll('.qty-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                const action = btn.dataset.action;
                const item = document.querySelector(`.cart-item[data-id="${id}"]`);
                const currentQty = parseInt(item.querySelector('.qty-control span').textContent);
                const newQty = action === 'plus' ? currentQty + 1 : Math.max(1, currentQty - 1);
                
                try {
                    await API.patch(`/products/cart/${id}/`, { quantity: newQty });
                    this.loadCart();
                } catch (err) {
                    UI.showToast(err.message, 'error');
                }
            });
        });
        
        document.querySelectorAll('.btn-remove').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                try {
                    await API.delete(`/products/cart/${id}/`);
                    UI.showToast('Item removed', 'success');
                    this.loadCart();
                    App.updateCounts();
                } catch (err) {
                    UI.showToast(err.message, 'error');
                }
            });
        });
    }
}

export { CartPage };