import { API, formatNaira } from '../core/api.js';
import { UI } from '../core/ui.js';

class OrdersPage {
    static async init() {
        const params = new URLSearchParams(window.location.search);
        const orderId = params.get('id');
        
        if (orderId) {
            await this.loadOrderDetail(orderId);
        } else {
            await this.loadOrderList();
        }
    }

    static async loadOrderList() {
        const container = document.getElementById('orders-list');
        const statusFilter = document.getElementById('order-status-filter')?.value || '';
        
        try {
            const data = await API.get(`/orders/list/?status=${statusFilter}`);
            const orders = data.data || [];
            
            if (!orders.length) {
                container.innerHTML = `
                    <div class="empty-state">
                        <h3>No orders yet</h3>
                        <p>Your order history will appear here</p>
                        <a href="/frontend/products.html" class="btn-primary">Start Shopping</a>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = orders.map(o => `
                <div class="order-card" data-id="${o.id}">
                    <div class="order-header">
                        <span class="order-id">#${o.id.slice(0, 8).toUpperCase()}</span>
                        <span class="order-status status-${o.status}">${o.status}</span>
                    </div>
                    <div class="order-items-preview">
                        ${o.items.map(i => `<img src="${i.image || '/assets/placeholder.jpg'}" alt="${i.title}">`).join('')}
                    </div>
                    <div class="order-footer">
                        <span>${o.items.length} item(s)</span>
                        <span class="order-total">${formatNaira(o.total_cost)}</span>
                    </div>
                </div>
            `).join('');
            
            container.querySelectorAll('.order-card').forEach(card => {
                card.addEventListener('click', () => {
                    window.location.href = `/orders.html?id=${card.dataset.id}`;
                });
            });
        } catch (e) {
            container.innerHTML = '<p class="error">Failed to load orders</p>';
        }
    }

    static async loadOrderDetail(orderId) {
        const container = document.getElementById('order-detail');
        document.getElementById('orders-list')?.classList.add('hidden');
        
        try {
            const order = await API.get(`/orders/detail/${orderId}/`);
            
            const statusColors = {
                pending: 'blue', hold: 'orange', confirmed: 'green',
                processing: 'blue', delivered: 'green', cancelled: 'red', refunded: 'purple'
            };
            
            container.innerHTML = `
                <div class="order-detail-header">
                    <button onclick="history.back()" class="btn-back">← Back</button>
                    <h2>Order #${order.id.slice(0, 8).toUpperCase()}</h2>
                    <span class="status-badge status-${order.status}">${order.status}</span>
                </div>
                
                <div class="order-timeline">
                    ${order.timeline.map(t => `
                        <div class="timeline-item">
                            <div class="timeline-dot status-${t.status}"></div>
                            <div class="timeline-content">
                                <strong>${t.status}</strong>
                                <p>${t.description}</p>
                                <span>${UI.formatDate(t.created_at)}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <div class="order-detail-grid">
                    <div class="detail-section">
                        <h3>Items</h3>
                        ${order.items.map(i => `
                            <div class="detail-item">
                                <img src="${i.image || '/assets/placeholder.jpg'}" alt="${i.title}">
                                <div>
                                    <h4>${i.title}</h4>
                                    <p>Qty: ${i.quantity} ${i.size ? `| Size: ${i.size}` : ''}</p>
                                    <p>${formatNaira(i.total_price)}</p>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="detail-section">
                        <h3>Delivery</h3>
                        <p><strong>${order.customer.name}</strong></p>
                        <p>${order.delivery.address}</p>
                        <p>${order.delivery.city}, ${order.delivery.state}</p>
                        <p>📞 ${order.customer.phone}</p>
                        <p>✉️ ${order.customer.email}</p>
                    </div>
                    
                    <div class="detail-section">
                        <h3>Payment</h3>
                        <div class="payment-row"><span>Subtotal</span><span>${formatNaira(order.subtotal)}</span></div>
                        <div class="payment-row"><span>Shipping</span><span>${formatNaira(order.shipping_cost)}</span></div>
                        <div class="payment-row total"><span>Total</span><span>${formatNaira(order.total_cost)}</span></div>
                    </div>
                </div>
                
                <div class="order-actions">
                    <a href="/frontend/orders/detail/${orderId}/receipt/" target="_blank" class="btn-outline">📄 Receipt</a>
                    ${order.status === 'pending' || order.status === 'hold' ? `
                        <button id="cancel-order" class="btn-danger">Cancel Order</button>
                    ` : ''}
                    ${order.status === 'delivered' ? `
                        <button id="report-order" class="btn-warning">Report Issue</button>
                    ` : ''}
                </div>
            `;
            
            // Bind action buttons
            document.getElementById('cancel-order')?.addEventListener('click', () => this.cancelOrder(orderId));
            document.getElementById('report-order')?.addEventListener('click', () => this.reportOrder(orderId));
            
        } catch (e) {
            container.innerHTML = '<p class="error">Order not found</p>';
        }
    }

    static async cancelOrder(orderId) {
        const transCode = prompt('Enter your 6-digit transaction PIN to cancel:');
        if (!transCode) return;
        
        try {
            await API.post(`/orders/detail/${orderId}/cancel/`, { trans_code: transCode });
            UI.showToast('Order cancelled', 'success');
            this.loadOrderDetail(orderId);
        } catch (err) {
            UI.showToast(err.message, 'error');
        }
    }

    static async reportOrder(orderId) {
        const note = prompt('Describe the issue:');
        if (!note) return;
        
        try {
            await API.post(`/orders/detail/${orderId}/report/`, { report_note: note });
            UI.showToast('Issue reported', 'success');
        } catch (err) {
            UI.showToast(err.message, 'error');
        }
    }
}

export { OrdersPage };