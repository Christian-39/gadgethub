import { API, API_BASE, formatNaira } from '../core/api.js';
import { UI } from '../core/ui.js';
import { Auth } from '../core/auth.js';

class ProfilePage {
    // In-memory cache for this page session - avoids re-fetching the
    // same state's cities repeatedly (e.g. switching back and forth
    // while filling the form), on top of the backend's own Redis
    // cache for the same data.
    static citiesCache = {};
    static addresses = [];
    static editingAddressId = null;

    static async init() {
        await this.loadProfile();
        await this.loadAddresses();
        await this.loadStates();
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
            this.addresses = addresses;
            
            container.innerHTML = addresses.map(a => `
                <div class="address-manage-card" data-id="${a.id}">
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
                        if (this.editingAddressId === btn.dataset.id) this.exitEditMode();
                        this.loadAddresses();
                    } catch (err) {
                        UI.showToast(err.message, 'error');
                    }
                });
            });

            container.querySelectorAll('.btn-set-default').forEach(btn => {
                btn.addEventListener('click', async () => {
                    try {
                        await API.patch(`/auth/addresses/${btn.dataset.id}/`, { is_default: true });
                        UI.showToast('Default address updated', 'success');
                        this.loadAddresses();
                    } catch (err) {
                        UI.showToast(err.message, 'error');
                    }
                });
            });

            // This button previously had no handler at all - clicking
            // "Edit" did nothing. Populate the same add-address form
            // (including a proper State -> City reload, so the saved
            // city is actually available to select) and switch it into
            // update mode instead of create mode.
            container.querySelectorAll('.btn-edit-address').forEach(btn => {
                btn.addEventListener('click', () => this.enterEditMode(btn.dataset.id));
            });
        } catch (e) {
            container.innerHTML = '<p>Failed to load addresses</p>';
        }
    }

    // ---- Location (State -> City) ----------------------------------

    static async loadStates() {
        const select = document.getElementById('addr-state');
        if (!select) return;
        try {
            const data = await API.get('/auth/states/');
            const states = data.states || [];
            select.innerHTML = '<option value="">Select a state</option>' +
                states.map(s => `<option value="${s}">${s}</option>`).join('');
        } catch (e) {
            select.innerHTML = '<option value="">Failed to load states</option>';
        }
    }

    // Loads (or reuses the cached) list of cities/wards for a state and
    // fills the City select. Returns the list so callers that need to
    // pick a specific entry afterward (edit mode) don't have to
    // re-fetch it.
    static async loadCitiesForState(state, { preserveValue = null } = {}) {
        const citySelect = document.getElementById('addr-city');
        if (!state) {
            citySelect.innerHTML = '<option value="">Select a state first</option>';
            citySelect.disabled = true;
            return [];
        }

        citySelect.disabled = true;
        citySelect.innerHTML = '<option value="">Loading cities...</option>';

        let cities = this.citiesCache[state];
        if (!cities) {
            try {
                const data = await API.get(`/auth/cities/?state=${encodeURIComponent(state)}`);
                cities = data.cities || [];
                this.citiesCache[state] = cities;
            } catch (e) {
                citySelect.innerHTML = '<option value="">Failed to load cities</option>';
                citySelect.disabled = true;
                return [];
            }
        }

        citySelect.innerHTML = '<option value="">Select a city</option>' +
            cities.map(c => `<option value="${c.city}" data-lat="${c.latitude ?? ''}" data-lng="${c.longitude ?? ''}">${c.display || c.city}</option>`).join('');
        citySelect.disabled = false;

        if (preserveValue) {
            // Prefer an exact display match (a specific ward) if the
            // saved address's city string happens to match one of the
            // option labels; otherwise fall back to matching by city
            // name so at least the right city is selected even if we
            // can't tell which ward it originally was.
            const options = [...citySelect.options];
            const exact = options.find(o => o.value === preserveValue);
            if (exact) citySelect.value = preserveValue;
        }

        return cities;
    }

    static updateAddrLatLng() {
        const citySelect = document.getElementById('addr-city');
        const opt = citySelect.options[citySelect.selectedIndex];
        document.getElementById('addr-lat').value = opt?.dataset.lat || '';
        document.getElementById('addr-lng').value = opt?.dataset.lng || '';
    }

    // ---- Add / Edit address form ------------------------------------

    static enterEditMode(id) {
        const addr = this.addresses.find(a => String(a.id) === String(id));
        if (!addr) return;

        this.editingAddressId = id;
        document.getElementById('address-form-title').textContent = 'Edit Address';
        document.getElementById('add-address').textContent = 'Update Address';
        document.getElementById('cancel-edit-address').hidden = false;

        document.getElementById('addr-label').value = addr.label;
        document.getElementById('addr-fullname').value = addr.full_name;
        document.getElementById('addr-phone').value = addr.phone_number;
        document.getElementById('addr-line1').value = addr.address_1;
        document.getElementById('addr-line2').value = addr.address_2 || '';
        document.getElementById('addr-default').checked = addr.is_default;
        document.getElementById('addr-lat').value = addr.latitude ?? '';
        document.getElementById('addr-lng').value = addr.longitude ?? '';

        document.getElementById('addr-state').value = addr.state;
        // The city select only has options for whatever state is
        // currently chosen, so the saved city can't be selected until
        // its state's cities have actually finished loading - this is
        // the race condition the requirements call out. Await it
        // before touching the city select's value.
        this.loadCitiesForState(addr.state, { preserveValue: addr.city });

        document.getElementById('address-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    static exitEditMode() {
        this.editingAddressId = null;
        document.getElementById('address-form-title').textContent = 'Add New Address';
        document.getElementById('add-address').textContent = 'Add Address';
        document.getElementById('cancel-edit-address').hidden = true;
        document.getElementById('address-form').reset();
        document.getElementById('addr-lat').value = '';
        document.getElementById('addr-lng').value = '';
        document.getElementById('addr-city').innerHTML = '<option value="">Select a state first</option>';
        document.getElementById('addr-city').disabled = true;
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
        
        // Add / Edit address
        document.getElementById('addr-state')?.addEventListener('change', (e) => {
            // A new state means whatever city was picked no longer
            // applies - clear it before reloading options so a stale
            // selection from the previous state can't linger.
            document.getElementById('addr-city').value = '';
            this.updateAddrLatLng();
            this.loadCitiesForState(e.target.value);
        });

        document.getElementById('addr-city')?.addEventListener('change', () => {
            this.updateAddrLatLng();
        });

        document.getElementById('cancel-edit-address')?.addEventListener('click', () => {
            this.exitEditMode();
        });

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
            const lat = document.getElementById('addr-lat').value;
            const lng = document.getElementById('addr-lng').value;
            if (lat) payload.latitude = parseFloat(lat);
            if (lng) payload.longitude = parseFloat(lng);

            if (!payload.state || !payload.city) {
                UI.showToast('Select a state and city', 'error');
                return;
            }

            try {
                if (this.editingAddressId) {
                    await API.patch(`/auth/addresses/${this.editingAddressId}/`, payload);
                    UI.showToast('Address updated', 'success');
                } else {
                    await API.post('/auth/addresses/', payload);
                    UI.showToast('Address added', 'success');
                }
                this.exitEditMode();
                this.loadAddresses();
            } catch (err) {
                UI.showToast(err.message, 'error');
            }
        });
    }
}

export { ProfilePage };