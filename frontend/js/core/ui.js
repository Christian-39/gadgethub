import { formatNaira } from './api.js';

class UI {
    static showSkeleton(container, count = 6, type = 'card') {
        let html = '';
        for (let i = 0; i < count; i++) {
            if (type === 'card') {
                html += `
                <div class="skeleton-card">
                    <div class="skeleton-img"></div>
                    <div class="skeleton-text"></div>
                    <div class="skeleton-text short"></div>
                </div>`;
            } else if (type === 'list') {
                html += `
                <div class="skeleton-list-item">
                    <div class="skeleton-img small"></div>
                    <div class="skeleton-content">
                        <div class="skeleton-text"></div>
                        <div class="skeleton-text short"></div>
                    </div>
                </div>`;
            }
        }
        container.innerHTML = html;
    }

    static showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('show');
            setTimeout(() => toast.remove(), 3000);
        }, 100);
    }

    static renderProductCard(product, view = 'grid') {
        const imageUrl = product.product_image?.[0]?.url 
            ? `https://payuee.com/image/${product.product_image[0].url}`
            : '/assets/placeholder.jpg';
        
        const price = (product.selling_price / 100).toFixed(2);
        
        if (view === 'list') {
            return `
            <div class="product-card list-view" data-id="${product.ID}">
                <img data-src="${imageUrl}" alt="${product.title}" class="lazy-img">
                <div class="product-info">
                    <h3>${product.title}</h3>
                    <p class="product-desc">${product.description?.substring(0, 100)}...</p>
                    <div class="product-meta">
                        <span class="price">${formatNaira(price)}</span>
                        <span class="stock ${product.stock_availability_status}">${product.stock_availability_status}</span>
                    </div>
                    <div class="product-actions">
                        <button class="btn-add-cart" data-id="${product.ID}">Add to Cart</button>
                        <button class="btn-wishlist" data-id="${product.ID}">♡</button>
                    </div>
                </div>
            </div>`;
        }
        
        return `
        <div class="product-card" data-id="${product.ID}">
            <div class="product-image">
                <img data-src="${imageUrl}" alt="${product.title}" class="lazy-img">
                ${product.on_sale ? '<span class="badge-sale">SALE</span>' : ''}
                ${product.featured ? '<span class="badge-featured">★</span>' : ''}
                                <button class="btn-wishlist" data-id="${product.ID}">♡</button>
            </div>
            <div class="product-info">
                <h3>${product.title}</h3>
                <p class="product-price">${formatNaira(price)}</p>
                <p class="product-stock ${product.stock_availability_status}">${product.stock_remaining} left</p>
                <div class="product-rating">
                    ${this.renderStars(product.rating_avg || 0)}
                    <span>(${product.product_review_count || 0})</span>
                </div>
            </div>
            <button class="btn-add-cart" data-id="${product.ID}">Add to Cart</button>
        </div>`;
    }

    static renderStars(rating) {
        const full = Math.floor(rating);
        const half = rating % 1 >= 0.5;
        let html = '';
        for (let i = 0; i < 5; i++) {
            if (i < full) html += '★';
            else if (i === full && half) html += '½';
            else html += '☆';
        }
        return `<span class="stars">${html}</span>`;
    }

    static renderPagination(current, total, callback) {
        if (total <= 1) return '';
        let html = '<div class="pagination">';
        if (current > 1) html += `<button class="page-btn" data-page="${current - 1}">← Prev</button>`;
        for (let i = 1; i <= total; i++) {
            if (i === 1 || i === total || (i >= current - 1 && i <= current + 1)) {
                html += `<button class="page-btn ${i === current ? 'active' : ''}" data-page="${i}">${i}</button>`;
            } else if (i === current - 2 || i === current + 2) {
                html += `<span class="page-dots">...</span>`;
            }
        }
        if (current < total) html += `<button class="page-btn" data-page="${current + 1}">Next →</button>`;
        html += '</div>';
        return html;
    }

    static formatDate(dateStr) {
        return new Date(dateStr).toLocaleDateString('en-NG', {
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    }
}

export { UI };