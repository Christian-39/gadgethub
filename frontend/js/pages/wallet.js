import { API, formatNaira, debounce } from '../core/api.js';
import { UI } from '../core/ui.js';

class WalletPage {
    static async init() {
        await this.loadBalance();
        await this.loadFundingDetails();
        await this.loadTransactions();
        this.bindEvents();
    }

    static async loadBalance() {
        try {
            const data = await API.get('/wallet/balance/');
            document.getElementById('wallet-balance').textContent = data.formatted;
            document.getElementById('wallet-balance').classList.add('loaded');
        } catch (e) {
            document.getElementById('wallet-balance').textContent = '₦0.00';
        }
    }

    static async loadFundingDetails() {
        try {
            const data = await API.get('/wallet/funding-details/');
            const account = data.wallet_funding_account || {};
            
            document.getElementById('funding-details').innerHTML = `
                <div class="bank-card">
                    <h4>Fund Your Wallet</h4>
                    <p>Transfer to this account:</p>
                    <div class="bank-info">
                        <p><strong>Bank:</strong> ${account.bank_name || 'N/A'}</p>
                        <p><strong>Account Name:</strong> ${account.account_name || 'N/A'}</p>
                        <p><strong>Account Number:</strong> <span class="copy-text">${account.account_number || 'N/A'}</span> 
                            <button class="btn-copy" data-text="${account.account_number}">Copy</button>
                        </p>
                    </div>
                    <p class="note">Funds will reflect automatically after transfer</p>
                </div>
            `;
            
            document.querySelector('.btn-copy')?.addEventListener('click', (e) => {
                navigator.clipboard.writeText(e.target.dataset.text);
                UI.showToast('Account number copied!', 'success');
            });
        } catch (e) {
            document.getElementById('funding-details').innerHTML = '<p>Unable to load funding details</p>';
        }
    }

    static async loadTransactions() {
        const container = document.getElementById('transactions-list');
        const type = document.getElementById('tx-type')?.value || '';
        const search = document.getElementById('tx-search')?.value || '';
        const start = document.getElementById('tx-start')?.value || '';
        const end = document.getElementById('tx-end')?.value || '';
        
        try {
            let url = '/wallet/transactions/?';
            if (type) url += `type=${type}&`;
            if (search) url += `search=${search}&`;
            if (start) url += `start_date=${start}&`;
            if (end) url += `end_date=${end}`;
            
            const transactions = await API.get(url);
            
            if (!transactions.length) {
                container.innerHTML = '<p class="empty">No transactions found</p>';
                return;
            }
            
            container.innerHTML = transactions.map(t => `
                <div class="transaction-item ${t.type}">
                    <div class="tx-icon">${t.type === 'credit' ? '↓' : t.type === 'debit' ? '↑' : '⟳'}</div>
                    <div class="tx-info">
                        <strong>${t.description}</strong>
                        <span>${t.date}</span>
                        <span class="tx-ref">${t.reference}</span>
                    </div>
                    <div class="tx-amount ${t.type}">
                        ${t.type === 'credit' || t.type === 'refund' ? '+' : '-'} ${t.formatted_amount}
                    </div>
                    <a href="/wallet/receipt/${t.id}/" class="btn-icon" title="Receipt">📄</a>
                </div>
            `).join('');
        } catch (e) {
            container.innerHTML = '<p class="error">Failed to load transactions</p>';
        }
    }

    static bindEvents() {
        document.getElementById('tx-type')?.addEventListener('change', () => this.loadTransactions());
        document.getElementById('tx-search')?.addEventListener('input', debounce(() => this.loadTransactions(), 500));
        document.getElementById('tx-start')?.addEventListener('change', () => this.loadTransactions());
        document.getElementById('tx-end')?.addEventListener('change', () => this.loadTransactions());
    }
}

export { WalletPage };