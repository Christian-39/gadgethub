import { API, formatNaira, lazyLoadImages } from '../core/api.js';
import { UI } from '../core/ui.js';
import { Auth } from '../core/auth.js';
import { App } from '../core/app.js';

class ProductDetailPage {
    static product = null;

    static async init() {
        const params = new URLSearchParams(window.location.search);
        const productId = params.get('id');
        if (!productId) return window.location.href = '/products.html';
        
        await this.loadProduct(parseInt(productId));
    }

    static async loadProduct(id) {
        const container = document.getElementById('product-detail');
        if (!container) return;
        
        container.innerHTML = '<div class="skeleton-detail"><div class="skeleton-img large"></div><div class="skeleton-info"><div class="skeleton-text"></div><div class="skeleton-text"></div><div class="skeleton-text short"></div></div></div>';
        
        try {
            const data = await API.get(`/products/detail/${id}/`);
            this.product = data.success;
            
            const price = (this.product.selling_price / 100).toFixed(2);
            const images = this.product.product_image || [];
            const mainImage = images.length > 0 
                ? `https://payuee.com/image/${images[0].url}` 
                : '/assets/placeholder.jpg';
            
            // Size options
            const sizes = (this.product.clothing_sizes || this.product.shoe_sizes || '').split(',').filter(s => s);
            const sizeHtml = sizes.length ? `
                <div class="size-selector">
                    <label>Size:</label>
                    <div class="size-options">
                        ${sizes.map(s => `<button class="size-btn" data-size="${s.trim()}">${s.trim()}</button>`).join('')}
                    </div>
                </div>
            ` : '';
            
            container.innerHTML = `
                <div class="product-gallery">
                    <img id="main-image" src="${mainImage}" alt="${this.product.title}" onerror="this.onerror=null;this.src='/assets/placeholder.jpg';">
                    <div class="thumbnail-list">
                        ${images.map(img => `
                            <img src="https://payuee.com/image/${img.url}" 
                                 class="thumb" 
                                 loading="lazy"
                                 onerror="this.onerror=null;this.src='/assets/placeholder.jpg';"
                                 onclick="document.getElementById('main-image').src=this.src">
                        `).join('')}
                    </div>
                </div>
                <div class="product-info-detail">
                    <h1>${this.product.title}</h1>
                    <div class="product-meta">
                        ${UI.renderStars(this.product.rating_avg || 0)}
                        <span>${this.product.product_review_count || 0} reviews</span>
                        <span class="stock ${this.product.stock_availability_status}">${this.product.stock_availability_status}</span>
                    </div>
                    <p class="price-large">${formatNaira(price)}</p>
                    <p class="description">${this.product.description}</p>
                    ${sizeHtml}
                    <div class="quantity-selector">
                        <label>Quantity:</label>
                        <button id="qty-minus">−</button>
                        <input type="number" id="qty-input" value="1" min="1" max="${this.product.stock_remaining}">
                        <button id="qty-plus">+</button>
                    </div>
                    <div class="action-buttons">
                        <button id="add-cart" class="btn-primary btn-large">Add to Cart</button>
                        <button id="add-wishlist" class="btn-outline btn-large">♡ Add to Wishlist</button>
                    </div>
                    <div class="product-details-extra">
                        <p><strong>Category:</strong> ${this.product.category}</p>
                        <p><strong>Vendor:</strong> ${this.product.vendor_type}</p>
                        <p><strong>Delivery:</strong> ${this.product.estimated_delivery} days</p>
                        <p><strong>Weight:</strong> ${this.product.net_weight}kg</p>
                    </div>
                    <div class="share-buttons">
                        <button onclick="navigator.share({title:'${this.product.title}',url:location.href})">Share</button>
                    </div>
                </div>
            `;
            
            this.bindEvents(id);

            // The topbar's page-name slot starts as the generic
            // "Product" label (set statically in the HTML so it's
            // never blank while this loads) - once we actually know
            // which product this is, reflect its title there instead.
            const pageNameEl = document.querySelector('.main-header .mobile-logo');
            if (pageNameEl) {
                pageNameEl.textContent = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style="margin-right:6px;flex-shrink:0"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>${this.product.title}`;
            }

            await this.loadReviews(id);
            await this.loadRelated(id);
        } catch (e) {
            container.innerHTML = '<p class="error">Product not found</p>';
        }
    }

    static bindEvents(productId) {
        let selectedSize = '';
        let quantity = 1;
        
        document.querySelectorAll('.size-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedSize = btn.dataset.size;
            });
        });
        
        const qtyInput = document.getElementById('qty-input');
        document.getElementById('qty-minus')?.addEventListener('click', () => {
            if (quantity > 1) qtyInput.value = --quantity;
        });
        document.getElementById('qty-plus')?.addEventListener('click', () => {
            if (quantity < this.product.stock_remaining) qtyInput.value = ++quantity;
        });
        
        document.getElementById('add-cart')?.addEventListener('click', async () => {
            try {
                await API.post('/products/cart/', {
                    product_id: productId,
                    quantity: quantity,
                    size: selectedSize
                });
                UI.showToast('Added to cart!', 'success');
                App.updateCounts();
            } catch (err) {
                UI.showToast(err.message, 'error');
            }
        });
        
        document.getElementById('add-wishlist')?.addEventListener('click', async () => {
            try {
                await API.post('/products/wishlist/', { product_id: productId });
                UI.showToast('Added to wishlist!', 'success');
            } catch (err) {
                UI.showToast(err.message, 'error');
            }
        });
    }

    static async loadReviews(productId) {
        const container = document.getElementById('reviews-section');
        if (!container) return;
        
        try {
            const data = await API.get(`/products/reviews/${productId}/?page=1`);
            const reviews = data.success || [];
            const count = data.count || 0;
            
            container.innerHTML = `
                <h3>Customer Reviews (${count})</h3>
                ${reviews.length ? reviews.map(r => `
                    <div class="review-card">
                        <div class="review-header">
                            <strong>${r.name}</strong>
                            ${UI.renderStars(r.rating)}
                            <span>${UI.formatDate(r.created_at)}</span>
                        </div>
                        <p>${r.review}</p>
                    </div>
                `).join('') : '<p>No reviews yet</p>'}
            `;
        } catch (e) {
            console.error('Reviews load failed', e);
        }
    }

    static async loadRelated(productId) {
        const container = document.getElementById('related-products');
        if (!container) return;
        
        try {
            const data = await API.get(`/products/detail/${productId}/`);
            const related = data.related || [];
            container.innerHTML = related.slice(0, 4).map(p => UI.renderProductCard(p)).join('');
            lazyLoadImages();
        } catch (e) {
            console.error('Related products failed', e);
        }
    }
}

export { ProductDetailPage };