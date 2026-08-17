const API_BASE = 'https://gadgethub-api.onrender.com/api';

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
            
            if (response.status === 401) {
                // Try refresh
                const refreshed = await this.refreshToken();
                if (refreshed) {
                    return this.request(endpoint, options);
                } else {
                    window.location.href = '/login.html';
                    return null;
                }
            }

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || data.detail || 'Request failed');
            }
            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
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

    static get(endpoint) { return this.request(endpoint, { method: 'GET' }); }
    static post(endpoint, body) { return this.request(endpoint, { method: 'POST', body }); }
    static patch(endpoint, body) { return this.request(endpoint, { method: 'PATCH', body }); }
    static delete(endpoint) { return this.request(endpoint, { method: 'DELETE' }); }
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

export { API, formatNaira, debounce, lazyLoadImages };