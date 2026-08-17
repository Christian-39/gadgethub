import { API, lazyLoadImages } from './api.js';
import { Auth } from './auth.js';
import { Theme } from './theme.js';
import { UI } from './ui.js';

class App {
    static async init() {
        Theme.init();
        await this.updateNav();
        this.bindGlobalEvents();
        
        // Update cart/wishlist counts
        if (Auth.isAuthenticated()) {
            this.updateCounts();
        }
    }

    static async updateNav() {
        const user = await Auth.check();
        const authLinks = document.getElementById('auth-links');
        const mobileAuth = document.getElementById('mobile-auth');
        
        if (user) {
            const html = `
                <a href="/profile.html" class="nav-user">
                    <img src="${user.profile_picture || '/assets/avatar.svg'}" alt="Profile">
                    <span>${user.first_name}</span>
                </a>
                <button id="logout-btn" class="btn-outline">Logout</button>
            `;
            if (authLinks) authLinks.innerHTML = html;
            if (mobileAuth) mobileAuth.innerHTML = html;
            
            document.getElementById('logout-btn')?.addEventListener('click', () => Auth.logout());
        } else {
            const html = `<a href="/login.html" class="btn-primary">Login</a>`;
            if (authLinks) authLinks.innerHTML = html;
            if (mobileAuth) mobileAuth.innerHTML = html;
        }
    }

    static async updateCounts() {
        try {
            const user = Auth.getUser();
            if (!user) return;
            
            // These would be fetched from API, using localStorage cache for speed
            const cartCount = user.cart_count || 0;
            const wishCount = user.wishlist_count || 0;
            const orderCount = user.orders_count || 0;
            
            document.querySelectorAll('[data-cart-count]').forEach(el => {
                el.textContent = cartCount;
                el.style.display = cartCount > 0 ? 'flex' : 'none';
            });
            document.querySelectorAll('[data-wish-count]').forEach(el => {
                el.textContent = wishCount;
                el.style.display = wishCount > 0 ? 'flex' : 'none';
            });
        } catch (e) {
            console.error('Count update failed', e);
        }
    }

    static bindGlobalEvents() {
        // Mobile menu
        document.getElementById('menu-toggle')?.addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('open');
            document.getElementById('overlay').classList.toggle('show');
        });
        
        document.getElementById('overlay')?.addEventListener('click', () => {
            document.getElementById('sidebar').classList.remove('open');
            document.getElementById('overlay').classList.remove('show');
        });

        // Search debounce
        const searchInput = document.getElementById('global-search');
        if (searchInput) {
            searchInput.addEventListener('input', debounce((e) => {
                if (e.target.value.length > 2) {
                    window.location.href = `/search.html?q=${encodeURIComponent(e.target.value)}`;
                }
            }, 500));
        }
    }
}

export { App };