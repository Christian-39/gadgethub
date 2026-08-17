import { API, formatNaira, debounce, lazyLoadImages } from '../core/api.js';
import { UI } from '../core/ui.js';

class ProductsPage {
    static state = {
        page: 1,
        totalPages: 1,
        category: 'all',
        sort: 5,
        minPrice: 0,
        maxPrice: 1000000,
        view: 'grid',
        loading: false
    };

    static async init() {
        const params = new URLSearchParams(window.location.search);
        this.state.category = params.get('category') || 'all';
        this.state.sort = parseInt(params.get('sort')) || 5;
        
        this.bindFilters();
        this.bindViewToggle();
        await this.loadProducts();
    }

    static bindFilters() {
        document.getElementById('category-filter')?.addEventListener('change', (e) => {
            this.state.category = e.target.value;
            this.state.page = 1;
            this.loadProducts();
        });
        
        document.getElementById('sort-filter')?.addEventListener('change', (e) => {
            this.state.sort = parseInt(e.target.value);
            this.state.page = 1;
            this.loadProducts();
        });
        
        const priceDebounce = debounce(() => {
            this.state.minPrice = document.getElementById('min-price')?.value || 0;
            this.state.maxPrice = document.getElementById('max-price')?.value || 1000000;
            this.state.page = 1;
            this.loadProducts();
        }, 500);
        
        document.getElementById('min-price')?.addEventListener('input', priceDebounce);
        document.getElementById('max-price')?.addEventListener('input', priceDebounce);
    }

    static bindViewToggle() {
        document.getElementById('grid-view')?.addEventListener('click', () => {
            this.state.view = 'grid';
            document.getElementById('grid-view').classList.add('active');
            document.getElementById('list-view').classList.remove('active');
            this.loadProducts();
        });
        
        document.getElementById('list-view')?.addEventListener('click', () => {
            this.state.view = 'list';
            document.getElementById('list-view').classList.add('active');
            document.getElementById('grid-view').classList.remove('active');
            this.loadProducts();
        });
    }

    static async loadProducts() {
        if (this.state.loading) return;
        this.state.loading = true;
        
        const container = document.getElementById('products-grid');
        const pagination = document.getElementById('pagination');
        
        UI.showSkeleton(container, 12, this.state.view);
        
        try {
            const data = await API.post('/products/list/', {
                category: this.state.category,
                min_price: this.state.minPrice * 100,
                max_price: this.state.maxPrice * 100,
                page_number: this.state.page,
                sort_option: this.state.sort
            });

            console.log('Products API response:', data);

            const products = data.products || [];
            const paginationData = data.pagination || {};

            if (products.length === 0 && this.state.page === 1) {
                container.innerHTML = '<div class="empty-state"><h3>No products found</h3><p>Try adjusting your filters</p></div>';
                pagination.innerHTML = '';
                return;
            }

            container.className = this.state.view === 'grid' ? 'products-grid' : 'products-list';
            container.innerHTML = products.map(p => UI.renderProductCard(p, this.state.view)).join('');

            this.state.totalPages = paginationData.TotalPages || 1;
            pagination.innerHTML = UI.renderPagination(this.state.page, this.state.totalPages, (p) => {
                this.state.page = p;
                this.loadProducts();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
            
            // Re-bind pagination
            pagination.querySelectorAll('.page-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    this.state.page = parseInt(btn.dataset.page);
                    this.loadProducts();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                });
            });
            
            lazyLoadImages();
            HomePage.bindProductEvents(container);
        } catch (e) {
            container.innerHTML = '<p class="error">Failed to load products. Please try again.</p>';
        } finally {
            this.state.loading = false;
        }
    }
}

export { ProductsPage };