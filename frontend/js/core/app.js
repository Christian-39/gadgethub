import { API, lazyLoadImages, debounce } from './api.js';
import { Auth } from './auth.js';
import { Theme } from './theme.js';
import { UI } from './ui.js';

const NAV_ICONS = {
    home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    products: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`,
    categories: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>`,
    cart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`,
    wishlist: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
    orders: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
    wallet: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 0 0-2 2c0 1.1.9 2 2 2h4v-4h-4z"/></svg>`,
    profile: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    support: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>`,
    search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
    bell: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`
};

const NavInjector = {
    init() {
        this.renderSidebar();
        this.renderMobileNav();
        this.attachSearch();
    },

    isActive(href) {
        const p = window.location.pathname;
        if (p === href) return true;
        if (href === '/index.html' && (p === '/' || p === '/index.html')) return true;
        return false;
    },

    renderSidebar() {
        const el = document.querySelector('.sidebar-nav');
        if (!el) return;
        const items = [
            { href: '/index.html', label: 'Home', icon: NAV_ICONS.home },
            { href: '/products.html', label: 'Products', icon: NAV_ICONS.products },
            { href: '/categories.html', label: 'Categories', icon: NAV_ICONS.categories },
            { href: '/cart.html', label: 'Cart', icon: NAV_ICONS.cart, badge: 'cart-count' },
            { href: '/wishlist.html', label: 'Wishlist', icon: NAV_ICONS.wishlist, badge: 'wish-count' },
            { href: '/orders.html', label: 'Orders', icon: NAV_ICONS.orders },
            { href: '/wallet.html', label: 'Wallet', icon: NAV_ICONS.wallet },
            { href: '/profile.html', label: 'Profile', icon: NAV_ICONS.profile },
            { href: '/customer-care.html', label: 'Support', icon: NAV_ICONS.support },
        ];
        el.innerHTML = items.map(it => {
            const a = this.isActive(it.href) ? 'active' : '';
            const b = it.badge ? `<span class="badge" data-${it.badge}>0</span>` : '';
            return `<a href="${it.href}" class="${a}">${it.icon}${it.label}${b}</a>`;
        }).join('');
    },

    renderMobileNav() {
        const el = document.querySelector('.mobile-nav');
        if (!el) return;
        const items = [
            { href: '/', label: 'Home', icon: NAV_ICONS.home },
            { href: '/categories.html', label: 'Categories', icon: NAV_ICONS.categories },
            { href: '/cart.html', label: 'Cart', icon: NAV_ICONS.cart, badge: 'cart-count' },
            { href: '#', label: 'Search', icon: NAV_ICONS.search, id: 'bottom-search-trigger' },
            { href: '/profile.html', label: 'Profile', icon: NAV_ICONS.profile },
        ];
        el.innerHTML = items.map(it => {
            const a = this.isActive(it.href) || (it.href === '/' && (location.pathname === '/' || location.pathname === '/index.html')) ? 'active' : '';
            const id = it.id ? ` id="${it.id}"` : '';
            const b = it.badge ? `<span class="badge" data-${it.badge}>0</span>` : '';
            return `<a href="${it.href}"${id} class="${a}">${it.icon}<span>${it.label}</span>${b}</a>`;
        }).join('');
    },

    attachSearch() {
        const bar = document.getElementById('mobile-search-bar');
        const input = document.getElementById('mobile-search-input');
        const btn = document.getElementById('mobile-search-btn');
        const trigger = document.getElementById('bottom-search-trigger');
        let backdrop = document.querySelector('.mobile-search-backdrop');
        if (!backdrop) {
            backdrop = document.createElement('div');
            backdrop.className = 'mobile-search-backdrop';
            document.body.appendChild(backdrop);
        }

        const open = () => { bar?.classList.add('active'); backdrop?.classList.add('active'); input?.focus(); };
        const close = () => { bar?.classList.remove('active'); backdrop?.classList.remove('active'); };

        trigger?.addEventListener('click', e => { e.preventDefault(); open(); });
        backdrop?.addEventListener('click', close);

        const run = () => {
            const q = input?.value.trim();
            if (q) { close(); location.href = `/search.html?q=${encodeURIComponent(q)}`; }
        };
        btn?.addEventListener('click', run);
        input?.addEventListener('keypress', e => { if (e.key === 'Enter') run(); });
    }
};

class App {
    static async init() {
        Theme.init();

        // Inject navigation first so DOM elements exist before binding events
        NavInjector.init();

        this.renderNav(Auth.getUser());
        this.bindGlobalEvents();
        this.updateCounts();

        const user = await Auth.check();
        this.renderNav(user);
        this.updateCounts();
    }

    static async updateNav() {
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
            if (!user) {
                document.querySelectorAll('[data-cart-count]').forEach(el => { el.style.display = 'none'; });
                document.querySelectorAll('[data-wish-count]').forEach(el => { el.style.display = 'none'; });
                return;
            }

            const cartCount = user.cart_count || 0;
            const wishCount = user.wishlist_count || 0;

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

    static closeSidebar() {
        document.getElementById('sidebar')?.classList.remove('open');
        document.getElementById('overlay')?.classList.remove('show');
    }

    static bindGlobalEvents() {
        // Mobile menu
        document.getElementById('menu-toggle')?.addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('open');
            document.getElementById('overlay').classList.toggle('show');
        });

        document.getElementById('close-sidebar')?.addEventListener('click', () => this.closeSidebar());
        document.getElementById('overlay')?.addEventListener('click', () => this.closeSidebar());
        document.getElementById('sidebar')?.addEventListener('click', (e) => e.stopPropagation());

        window.addEventListener('scroll', () => {
            if (document.getElementById('sidebar')?.classList.contains('open')) {
                this.closeSidebar();
            }
        }, { passive: true });

        // Topbar global search
        const searchInput = document.getElementById('global-search');
        const searchBtn = document.getElementById('global-search-btn');
        const goToSearch = () => {
            const value = searchInput?.value.trim();
            if (value) {
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