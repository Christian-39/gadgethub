import { API, lazyLoadImages, debounce } from './api.js';
import { Auth } from './auth.js';
import { Theme } from './theme.js';
import { UI } from './ui.js';

class App {
    static async init() {
        Theme.init();

        // Render the topbar/sidebar immediately from the last known
        // user (cached in localStorage by a previous Auth.check()),
        // instead of waiting on a fresh network round-trip first.
        // Previously the UI always started from the "logged out"
        // markup and only swapped to the real state once
        // /auth/profile/ resolved - on every navigation/refresh that
        // showed a brief, incorrect "logged out" flash before
        // snapping back to "logged in". Rendering the cached state
        // first (usually correct) and reconciling with the server
        // afterward removes that flicker.
        this.renderNav(Auth.getUser());
        this.bindGlobalEvents();
        this.updateCounts();

        const user = await Auth.check();
        this.renderNav(user);
        this.updateCounts();
    }

    static async updateNav() {
        // Kept for compatibility with any external caller - just
        // re-confirms with the server and re-renders.
        const user = await Auth.check();
        this.renderNav(user);
        return user;
    }

    static renderNav(user) {
        const authLinks = document.getElementById('auth-links');
        const mobileAuth = document.getElementById('mobile-auth');
        const sidebarUser = document.getElementById('sidebar-user');

        if (user) {
            const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
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

            if (sidebarUser) {
                sidebarUser.innerHTML = `
                    <a href="/profile.html" class="nav-user">
                        <img src="${user.profile_picture || '/assets/avatar.svg'}" alt="Profile">
                        <span>${fullName || user.email}</span>
                    </a>
                `;
            }
        } else {
            const html = `<a href="/login.html" class="btn-primary">Login</a>`;
            if (authLinks) authLinks.innerHTML = html;
            if (mobileAuth) mobileAuth.innerHTML = html;

            if (sidebarUser) {
                sidebarUser.innerHTML = `<a href="/login.html" class="sidebar-guest">👤 Sign in</a>`;
            }
        }
    }

    static async updateCounts() {
        try {
            const user = Auth.getUser();

            // Guests have no cart/wishlist tied to an account - the
            // badges must be hidden rather than showing a stale/default
            // "0" left over from the static HTML.
            if (!user) {
                document.querySelectorAll('[data-cart-count]').forEach(el => {
                    el.style.display = 'none';
                });
                document.querySelectorAll('[data-wish-count]').forEach(el => {
                    el.style.display = 'none';
                });
                return;
            }

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

        // Topbar search (left side of header) - navigates to the
        // dedicated search page, same as pressing enter/clicking the
        // search icon.
        const searchInput = document.getElementById('global-search');
        const searchBtn = document.getElementById('global-search-btn');
        const goToSearch = () => {
            const value = searchInput.value.trim();
            if (value.length > 0) {
                window.location.href = `/search.html?q=${encodeURIComponent(value)}`;
            }
        };
        if (searchInput) {
            searchInput.addEventListener('input', debounce((e) => {
                if (e.target.value.trim().length > 2) goToSearch();
            }, 500));
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    goToSearch();
                }
            });
        }
        searchBtn?.addEventListener('click', goToSearch);
    }
}

export { App };