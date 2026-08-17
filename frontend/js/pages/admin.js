import { API, formatNaira } from '../core/api.js';
import { UI } from '../core/ui.js';

class AdminDashboard {
    static async init() {
        await this.loadStats();
        await this.loadCharts();
        await this.loadRecentOrders();
        await this.loadSupportTickets();
        await this.loadWebhookLogs();
    }

    static async loadStats() {
        try {
            const data = await API.get('/dashboard/stats/');
            
            document.getElementById('stat-revenue').textContent = formatNaira(data.revenue || 0);
            document.getElementById('stat-sales').textContent = data.sales_count || 0;
            document.getElementById('stat-orders').textContent = data.orders_count || 0;
            document.getElementById('stat-customers').textContent = data.customers_count || 0;
            document.getElementById('stat-products').textContent = data.products_count || 0;
            document.getElementById('stat-reviews').textContent = data.reviews_count || 0;
        } catch (e) {
            console.error('Stats load failed', e);
        }
    }

    static async loadCharts() {
        try {
            const data = await API.get('/dashboard/charts/');
            
            // Simple canvas charts (no external library for vanilla JS)
            this.drawBarChart('daily-sales-chart', data.daily_sales || []);
            this.drawLineChart('monthly-revenue-chart', data.monthly_revenue || []);
            this.drawPieChart('order-status-chart', data.order_status || {});
        } catch (e) {
            console.error('Charts load failed', e);
        }
    }

    static drawBarChart(canvasId, data) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        const barWidth = width / data.length - 10;
        const max = Math.max(...data.map(d => d.value), 1);
        
        ctx.clearRect(0, 0, width, height);
        data.forEach((d, i) => {
            const barHeight = (d.value / max) * (height - 30);
            ctx.fillStyle = '#4F46E5';
            ctx.fillRect(i * (barWidth + 10) + 5, height - barHeight - 20, barWidth, barHeight);
            ctx.fillStyle = '#666';
            ctx.font = '10px sans-serif';
            ctx.fillText(d.label, i * (barWidth + 10) + 5, height - 5);
        });
    }

    static drawLineChart(canvasId, data) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        const max = Math.max(...data.map(d => d.value), 1);
        
        ctx.clearRect(0, 0, width, height);
        ctx.beginPath();
        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 2;
        
        data.forEach((d, i) => {
            const x = (i / (data.length - 1)) * (width - 40) + 20;
            const y = height - 30 - (d.value / max) * (height - 50);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();
    }

    static drawPieChart(canvasId, data) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const total = Object.values(data).reduce((a, b) => a + b, 0);
        let startAngle = 0;
        const colors = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
        
        Object.entries(data).forEach(([key, value], i) => {
            const slice = (value / total) * 2 * Math.PI;
            ctx.beginPath();
            ctx.moveTo(75, 75);
            ctx.arc(75, 75, 70, startAngle, startAngle + slice);
            ctx.fillStyle = colors[i % colors.length];
            ctx.fill();
            startAngle += slice;
        });
    }

    static async loadRecentOrders() {
        const container = document.getElementById('recent-orders');
        try {
            const data = await API.get('/dashboard/recent-orders/');
            container.innerHTML = (data || []).map(o => `
                <tr>
                    <td>#${o.id.slice(0, 8)}</td>
                    <td>${o.customer}</td>
                    <td>${formatNaira(o.total)}</td>
                    <td><span class="badge-${o.status}">${o.status}</span></td>
                    <td>${UI.formatDate(o.created_at)}</td>
                </tr>
            `).join('');
        } catch (e) {
            container.innerHTML = '<tr><td colspan="5">No data</td></tr>';
        }
    }

    static async loadSupportTickets() {
        const container = document.getElementById('support-tickets');
        try {
            const data = await API.get('/dashboard/support-tickets/');
            container.innerHTML = (data || []).map(t => `
                <tr>
                    <td>${t.id}</td>
                    <td>${t.subject}</td>
                    <td>${t.user}</td>
                    <td><span class="badge-${t.status}">${t.status}</span></td>
                    <td>${UI.formatDate(t.created_at)}</td>
                </tr>
            `).join('');
        } catch (e) {
            container.innerHTML = '<tr><td colspan="5">No tickets</td></tr>';
        }
    }

    static async loadWebhookLogs() {
        const container = document.getElementById('webhook-logs');
        try {
            const data = await API.get('/dashboard/webhook-logs/');
            container.innerHTML = (data || []).map(l => `
                <tr>
                    <td>${l.event_type}</td>
                    <td>${l.order_id}</td>
                    <td><span class="badge-${l.status}">${l.status}</span></td>
                    <td>${UI.formatDate(l.created_at)}</td>
                </tr>
            `).join('');
        } catch (e) {
            container.innerHTML = '<tr><td colspan="4">No logs</td></tr>';
        }
    }
}

export { AdminDashboard };