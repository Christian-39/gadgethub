import { API, API_BASE, formatNaira } from '../core/api.js';
import { UI } from '../core/ui.js';
import { Auth } from '../core/auth.js';

class ProfilePage {
    static async init() {
        await this.loadProfile();
        await this.loadAddresses();
        this.bindEvents();
    }

    static async loadProfile() {
        try {
            const user = await API.get('/auth/profile/');
            
            document.getElementById('profile-name').textContent = `${user.first_name} ${user.last_name}`;
            document.getElementById('profile-email').textContent = user.email;
            document.getElementById('profile-phone').textContent = user.phone_number || 'Not set';
            document.getElementById('profile-pic').src = user.profile_picture || '/assets/avatar.svg';
            
            // Stats cards
            document.getElementById('stat-wishlist').innerHTML = `
                <div class="stat-icon">❤️</div>
                <div class="stat-value">${user.wishlist_count || 0}</div>
                <div class="stat-label">Wishlist</div>
            `;
            document.getElementById('stat-cart').innerHTML = `
                <div class="stat-icon">🛒</div>
                <div class="stat-value">${user.cart_count || 0}</div>
                <div class="stat-label">Cart</div>
            `;
            document.getElementById('stat-orders').innerHTML = `
                <div class="stat-icon">📦</div>
                <div class="stat-value">${user.orders_count || 0}</div>
                <div class="stat-label">Orders</div>
            `;
            
            // PIN status
            document.getElementById('pin-status').textContent = user.pin_created ? '✅ Created' : '❌ Not set';
            document.getElementById('pin-status').className = user.pin_created ? 'status-ok' : 'status-warning';
            
            // Form values
            document.getElementById('edit-first-name').value = user.first_name;
            document.getElementById('edit-last-name').value = user.last_name;
            document.getElementById('edit-phone').value = user.phone_number || '';
            document.getElementById('edit-address').value = user.address || '';
            document.getElementById('edit-city').value = user.city || '';
            document.getElementById('edit-state').value = user.state || '';
        } catch (e) {
            UI.showToast('Failed to load profile', 'error');
        }
    }

    static async loadAddresses() {
        const container = document.getElementById('address-list');
        try {
            const addresses = await API.get('/auth/addresses/');
            
            container.innerHTML = addresses.map(a => `
                <div class="address-card" data-id="${a.id}">
                    <div class="address-header">
                        <strong>${a.label}</strong>
                        ${a.is_default ? '<span class="badge-default">Default</span>' : ''}
                    </div>
                    <p>${a.full_name}</p>
                    <p>${a.address_1}</p>
                    <p>${a.city}, ${a.state}</p>
                    <p>${a.phone_number}</p>
                    <div class="address-actions">
                        <button class="btn-edit-address" data-id="${a.id}">Edit</button>
                        <button class="btn-delete-address" data-id="${a.id}">Delete</button>
                        ${!a.is_default ? `<button class="btn-set-default" data-id="${a.id}">Set Default</button>` : ''}
                    </div>
                </div>
            `).join('');
            
            // Bind address actions
            container.querySelectorAll('.btn-delete-address').forEach(btn => {
                btn.addEventListener('click', async () => {
                    if (!confirm('Delete this address?')) return;
                    try {
                        await API.delete(`/auth/addresses/${btn.dataset.id}/`);
                        UI.showToast('Address deleted', 'success');
                        this.loadAddresses();
                    } catch (err) {
                        UI.showToast(err.message, 'error');
                    }
                });
            });
        } catch (e) {
            container.innerHTML = '<p>Failed to load addresses</p>';
        }
    }

    static bindEvents() {
        // Profile picture upload
        document.getElementById('upload-pic')?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const formData = new FormData();
            formData.append('image', file);
            
            try {
                const res = await fetch(`${API_BASE}/auth/profile/picture/`, {
                    method: 'POST',
                    credentials: 'include',
                    body: formData
                });
                const data = await res.json();
                document.getElementById('profile-pic').src = data.url;
                UI.showToast('Profile picture updated', 'success');
            } catch (err) {
                UI.showToast('Upload failed', 'error');
            }
        });
        
        // Edit profile
        document.getElementById('save-profile')?.addEventListener('click', async () => {
            try {
                await API.patch('/auth/profile/', {
                    first_name: document.getElementById('edit-first-name').value,
                    last_name: document.getElementById('edit-last-name').value,
                    phone_number: document.getElementById('edit-phone').value,
                    address: document.getElementById('edit-address').value,
                    city: document.getElementById('edit-city').value,
                    state: document.getElementById('edit-state').value,
                });
                UI.showToast('Profile updated', 'success');
                this.loadProfile();
            } catch (err) {
                UI.showToast(err.message, 'error');
            }
        });
        
        // Change password
        document.getElementById('change-password')?.addEventListener('click', async () => {
            const oldPass = document.getElementById('old-password').value;
            const newPass = document.getElementById('new-password').value;
            const confirmPass = document.getElementById('confirm-password').value;
            
            try {
                await API.post('/auth/change-password/', {
                    old_password: oldPass,
                    new_password: newPass,
                    confirm_password: confirmPass
                });
                UI.showToast('Password changed', 'success');
                document.getElementById('old-password').value = '';
                document.getElementById('new-password').value = '';
                document.getElementById('confirm-password').value = '';
            } catch (err) {
                UI.showToast(err.message, 'error');
            }
        });
        
        // Transaction PIN
        document.getElementById('create-pin')?.addEventListener('click', async () => {
            const pin = document.getElementById('new-pin').value;
            const confirm = document.getElementById('confirm-pin').value;
            
            try {
                await API.post('/auth/transaction-pin/', { pin, confirm_pin: confirm });
                UI.showToast('Transaction PIN created', 'success');
                this.loadProfile();
            } catch (err) {
                UI.showToast(err.message, 'error');
            }
        });
        
        // Add address
        document.getElementById('add-address')?.addEventListener('click', async () => {
            const payload = {
                label: document.getElementById('addr-label').value,
                full_name: document.getElementById('addr-fullname').value,
                phone_number: document.getElementById('addr-phone').value,
                address_1: document.getElementById('addr-line1').value,
                address_2: document.getElementById('addr-line2').value,
                city: document.getElementById('addr-city').value,
                state: document.getElementById('addr-state').value,
                is_default: document.getElementById('addr-default').checked
            };
            
            try {
                await API.post('/auth/addresses/', payload);
                UI.showToast('Address added', 'success');
                this.loadAddresses();
                document.getElementById('address-form').reset();
            } catch (err) {
                UI.showToast(err.message, 'error');
            }
        });
    }
}

export { ProfilePage };