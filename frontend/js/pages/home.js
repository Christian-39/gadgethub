import { API, formatNaira, lazyLoadImages } from '../core/api.js';
import { UI } from '../core/ui.js';

class HomePage {
    static async init() {
        await this.loadFeatured();
        await this.loadCategories();
        await this.loadBestSellers();
    }

    static async loadFeatured() {
        const container = document.getElementById('featured-products');
        if (!container) return;
        
        UI.showSkeleton(container, 4, 'card');
        
        try {
            const data = await API.post('/products/list/', {
                category: 'all',
                page_number: 1,
                sort_option: 1, // Featured
                limit: 8
            });
            
            const products = data.success || [];
            container.innerHTML = products.map(p => UI.renderProductCard(p)).join('');
            lazyLoadImages();
            
            this.bindProductEvents(container);
        } catch (e) {
            container.innerHTML = '<p class="error">Failed to load products</p>';
        }
    }

    static async loadCategories() {
        const container = document.getElementById('categories');
        if (!container) return;
        
        const categories = [
            { id: 'gadgets', name: 'Gadgets', icon: '💻' },
            { id: 'outfits', name: 'Fashion', icon: '👕' },
            { id: 'jewelry', name: 'Jewelry', icon: '💍' },
            { id: 'cars-car-parts', name: 'Auto', icon: '🚗' },
            { id: 'tools', name: 'Tools', icon: '🔧' },
            { id: 'kids-accessories', name: 'Kids', icon: '🧸' },
        ];
        
        container.innerHTML = categories.map(c => `
            <a href="/frontend/products.html?category=${c.id}" class="category-card">
                <span class="cat-icon">${c.icon}</span>
                <span class="cat-name">${c.name}</span>
            </a>
        `).join('');
    }

    static async loadBestSellers() {
        const container = document.getElementById('best-sellers');
        if (!container) return;
        
        try {
            const data = await API.post('/products/list/', {
                category: 'all',
                page_number: 1,
                sort_option: 2, // Best selling
                limit: 6
            });
            
            const products = data.success || [];
            container.innerHTML = products.map(p => UI.renderProductCard(p)).join('');
            lazyLoadImages();
            this.bindProductEvents(container);
        } catch (e) {
            console.error('Best sellers load failed', e);
        }
    }

    static bindProductEvents(container) {
        container.querySelectorAll('.btn-add-cart').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                try {
                    await API.post('/products/cart/', { product_id: parseInt(id), quantity: 1 });
                    UI.showToast('Added to cart', 'success');
                    App.updateCounts();
                } catch (err) {
                    UI.showToast(err.message, 'error');
                }
            });
        });
        
        container.querySelectorAll('.btn-wishlist').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                try {
                    await API.post('/products/wishlist/', { product_id: parseInt(id) });
                    btn.classList.toggle('active');
                    UI.showToast('Wishlist updated', 'success');
                } catch (err) {
                    UI.showToast(err.message, 'error');
                }
            });
        });
        
        container.querySelectorAll('.product-card').forEach(card => {
            card.addEventListener('click', () => {
                window.location.href = `/product-detail.html?id=${card.dataset.id}`;
            });
        });
    }
}

export { HomePage };