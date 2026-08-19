/**
 * Router
 *
 * GadgetHub is a static multi-page app - every route is its own
 * .html file, navigated with a full page load. This module doesn't
 * change that; it just centralizes the bits every page was otherwise
 * re-implementing by hand:
 *
 *   - building internal URLs (product/category/search/order links)
 *   - reading query-string params
 *   - marking the current sidebar/mobile-nav link "active"
 *
 * Usage:
 *   import { Router } from './router.js';
 *   Router.goToProduct(92);
 *   const category = Router.param('category', 'all');
 */

class Router {
    // ---- URL builders -----------------------------------------------
    // Single source of truth for how internal links are shaped, so a
    // page never hand-rolls `/product-detail.html?id=` + encoding
    // itself differently from everywhere else.

    static toProduct(id) {
        return `/product-detail.html?id=${encodeURIComponent(id)}`;
    }

    static toCategory(categoryId) {
        return `/products.html?category=${encodeURIComponent(categoryId)}`;
    }

    static toSearch(query) {
        return `/search.html?q=${encodeURIComponent(query)}`;
    }

    static toOrder(orderId) {
        return `/orders.html?id=${encodeURIComponent(orderId)}`;
    }

    // ---- Navigation ----------------------------------------------------

    static goToProduct(id) {
        window.location.href = this.toProduct(id);
    }

    static goToCategory(categoryId) {
        window.location.href = this.toCategory(categoryId);
    }

    static goToSearch(query) {
        window.location.href = this.toSearch(query);
    }

    static goToOrder(orderId) {
        window.location.href = this.toOrder(orderId);
    }

    // ---- Query params ----------------------------------------------

    static params() {
        return new URLSearchParams(window.location.search);
    }

    static param(name, fallback = null) {
        const value = this.params().get(name);
        return value === null ? fallback : value;
    }

    static paramInt(name, fallback = null) {
        const value = this.params().get(name);
        const parsed = parseInt(value, 10);
        return Number.isNaN(parsed) ? fallback : parsed;
    }

    // ---- Active nav highlighting ------------------------------------
    // Every page currently hardcodes `class="active"` on one
    // sidebar-nav/mobile-nav link by hand. This does the same thing
    // dynamically from the current URL, so pages can opt in instead
    // of maintaining that by hand (and risking it drifting out of
    // sync when a page is renamed/copied).

    static currentPage() {
        const path = window.location.pathname;
        const file = path.substring(path.lastIndexOf('/') + 1);
        return file || 'index.html';
    }

    static highlightActiveNav() {
        const current = this.currentPage();
        document.querySelectorAll('.sidebar-nav a, .mobile-nav a').forEach(link => {
            const href = link.getAttribute('href') || '';
            const target = href === '/' ? 'index.html' : href.replace(/^\//, '');
            link.classList.toggle('active', target === current);
        });
    }
}

export { Router };
