const API_BASE =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
        ? 'http://127.0.0.1:8000/api'
        : 'https://gadgethub-api.onrender.com/api';

class API {
    static async request(endpoint, options = {}) {
        const url = `${API_BASE}${endpoint}`;
        const config = {
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            ...options,
        };

        if (options.body && typeof options.body === 'object') {
            config.body = JSON.stringify(options.body);
        }

        try {
            const response = await fetch(url, config);

            // A 401 here just means "not logged in". For a background
            // identity check (Auth.check on page load, used so guests
            // can browse) that's expected and should NOT bounce the
            // user to /login.html - it should just resolve to "no
            // user" so guests can keep browsing products. Callers that
            // need the old "redirect on session expiry" behavior (e.g.
            // cart/wishlist actions) can omit skipAuthRedirect.
            if (response.status === 401 && !options.skipAuthRedirect) {
                // Try refresh
                const refreshed = await this.refreshToken();
                if (refreshed) {
                    return this.request(endpoint, options);
                } else {
                    window.location.href = '/login.html';
                    return null;
                }
            }

            let data = null;
            try {
                data = await response.json();
            } catch {
                data = null;
            }

            if (!response.ok) {
                throw new Error(this.extractErrorMessage(data));
            }
            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    // Turns a DRF-style error body into a readable message. Handles:
    // - { error: "..." } / { detail: "..." } / { message: "..." }
    // - field validation errors: { email: ["This field is required."], ... }
    // - { non_field_errors: [...] }
    static extractErrorMessage(data) {
        if (!data) return 'Request failed';
        if (typeof data === 'string') return data;
        if (data.error) return data.error;
        if (data.detail) return data.detail;
        if (data.message) return data.message;

        const parts = [];
        for (const [key, value] of Object.entries(data)) {
            const text = Array.isArray(value) ? value.join(' ') : String(value);
            if (!text) continue;
            parts.push(key === 'non_field_errors' ? text : `${key}: ${text}`);
        }
        return parts.length ? parts.join(' ') : 'Request failed';
    }

    static async refreshToken() {
        try {
            const res = await fetch(`${API_BASE}/auth/refresh/`, {
                method: 'POST',
                credentials: 'include',
            });
            return res.ok;
        } catch {
            return false;
        }
    }

    static get(endpoint, options = {}) { return this.request(endpoint, { method: 'GET', ...options }); }
    static post(endpoint, body, options = {}) { return this.request(endpoint, { method: 'POST', body, ...options }); }
    static patch(endpoint, body, options = {}) { return this.request(endpoint, { method: 'PATCH', body, ...options }); }
    static delete(endpoint, options = {}) { return this.request(endpoint, { method: 'DELETE', ...options }); }
}

// Currency formatter
const formatNaira = (amount) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `₦${num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Debounce utility
const debounce = (fn, ms) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), ms);
    };
};

// Lazy image loader
const lazyLoadImages = () => {
    const images = document.querySelectorAll('img[data-src]');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                observer.unobserve(img);
            }
        });
    });
    images.forEach(img => observer.observe(img));
};

export { API, API_BASE, formatNaira, debounce, lazyLoadImages };