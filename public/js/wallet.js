(function () {
    'use strict';

    var token = localStorage.getItem('token');
    if (!token) { location.href = '/auth'; return; }

    (async function () {
        try {
            var res = await fetch('/api/auth/me', { headers: { Authorization: 'Bearer ' + token } });
            if (!res.ok) { localStorage.removeItem('token'); location.href = '/auth'; return; }
            var json = await res.json();
            var user = json.user || json;
            if (user.role !== 'farmer') {
                if (user.role === 'admin') location.href = '/admin.html';
                else if (user.role === 'buyer') location.href = '/buyer-dashboard';
                return;
            }
        } catch (e) {
            localStorage.removeItem('token');
            location.href = '/auth';
        }
    })();

    var state = {
        wallet: null,
        transactions: [],
        pendingRequests: [],
        withdrawals: []
    };

    function showToast(message, type) {
        type = type || 'info';
        var icons = { success: '\u2713', error: '\u2717', warning: '\u26A0', info: 'i' };
        var container = document.getElementById('toastContainer');
        var toast = document.createElement('div');
        toast.className = 'toast toast-' + type;
        toast.setAttribute('role', 'alert');
        toast.innerHTML = '<span class="toast-icon">' + (icons[type] || 'i') + '</span><span>' + message + '</span>';
        container.appendChild(toast);
        setTimeout(function () {
            toast.classList.add('toast-hide');
            setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
        }, 3500);
    }

    function escapeHtml(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    function formatRwf(val) {
        return Number(val).toLocaleString('en-RW') + ' RWF';
    }

    function animateVal(el, target) {
        if (!el) return;
        var current = 0;
        var increment = Math.max(1, Math.ceil(target / 40));
        var timer = setInterval(function () {
            current += increment;
            if (current >= target) { current = target; clearInterval(timer); }
            el.textContent = Number(current).toLocaleString('en-RW') + ' RWF';
        }, 20);
    }

    function isDarkMode() { return document.body.classList.contains('dark-mode'); }

    function initDarkMode() {
        var saved = localStorage.getItem('farmerDarkMode');
        if (saved === 'true') {
            document.body.classList.add('dark-mode');
            updateDarkModeIcon(true);
        }
    }

    function toggleDarkMode() {
        var isDark = document.body.classList.toggle('dark-mode');
        localStorage.setItem('farmerDarkMode', isDark);
        updateDarkModeIcon(isDark);
    }

    function updateDarkModeIcon(isDark) {
        var icon = document.getElementById('darkModeToggle');
        if (icon) {
            var i = icon.querySelector('i');
            if (i) i.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        }
    }

    function getTypeLabel(type) {
        var labels = { credit: 'Credit', debit: 'Debit', commission: 'Commission', withdrawal: 'Withdrawal', refund: 'Refund', adjustment: 'Adjustment' };
        return labels[type] || type;
    }

    function getStatusLabel(status) {
        return status.charAt(0).toUpperCase() + status.slice(1);
    }

    function renderWallet(wallet) {
        if (!wallet) return;
        animateVal(document.getElementById('walletAvailable'), wallet.availableBalance || 0);
        animateVal(document.getElementById('walletPending'), wallet.pendingBalance || 0);
        animateVal(document.getElementById('walletEarned'), wallet.totalEarned || 0);
        animateVal(document.getElementById('walletWithdrawn'), wallet.totalWithdrawn || 0);

        var withdrawAvail = document.getElementById('withdrawAvailable');
        if (withdrawAvail) withdrawAvail.textContent = formatRwf(wallet.availableBalance || 0);
    }

    function renderTransactions(transactions) {
        var tbody = document.getElementById('walletTransactionsTable');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!transactions || transactions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><span class="empty-state-icon"><i class="fa-solid fa-receipt"></i></span><span class="empty-state-text">No transactions yet</span><p style="font-size:.82rem;color:var(--fd-text-muted);margin:8px 0 0;">Transactions will appear here once you receive payments.</p></div></td></tr>';
            return;
        }

        var fragment = document.createDocumentFragment();
        for (var i = 0; i < transactions.length; i++) {
            var txn = transactions[i];
            var row = document.createElement('tr');
            row.style.animationDelay = (i * 0.03) + 's';

            var isPositive = txn.amount > 0;
            var date = new Date(txn.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
            var time = new Date(txn.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

            row.innerHTML =
                '<td><span class="txn-type ' + txn.type + '">' + getTypeLabel(txn.type) + '</span></td>' +
                '<td><span class="txn-amount ' + (isPositive ? 'positive' : 'negative') + '">' + (isPositive ? '+' : '') + Number(txn.amount).toLocaleString('en-RW') + ' RWF</span></td>' +
                '<td>' + Number(txn.balanceBefore).toLocaleString('en-RW') + ' RWF</td>' +
                '<td>' + Number(txn.balanceAfter).toLocaleString('en-RW') + ' RWF</td>' +
                '<td><span style="font-size:.82rem;color:var(--fd-text-muted);">' + escapeHtml(txn.description) + '</span></td>' +
                '<td><span style="font-size:.82rem;">' + date + '</span><br><span style="font-size:.75rem;color:var(--fd-text-muted);">' + time + '</span></td>';

            fragment.appendChild(row);
        }
        tbody.appendChild(fragment);
    }

    function renderWithdrawals(withdrawals) {
        var tbody = document.getElementById('withdrawHistoryTable');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!withdrawals || withdrawals.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><span class="empty-state-icon"><i class="fa-solid fa-arrow-up-from-bracket"></i></span><span class="empty-state-text">No withdrawal requests yet</span><p style="font-size:.82rem;color:var(--fd-text-muted);margin:8px 0 0;">Submit a withdrawal request above to get started.</p></div></td></tr>';
            return;
        }

        var fragment = document.createDocumentFragment();
        for (var i = 0; i < withdrawals.length; i++) {
            var w = withdrawals[i];
            var row = document.createElement('tr');
            row.style.animationDelay = (i * 0.03) + 's';

            var statusClass = 'status-' + w.status;
            var date = new Date(w.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

            row.innerHTML =
                '<td><strong style="font-size:.82rem;">' + escapeHtml(w.requestId) + '</strong></td>' +
                '<td><span style="font-weight:700;color:var(--fd-text);">' + Number(w.amount).toLocaleString('en-RW') + ' RWF</span></td>' +
                '<td>' + escapeHtml(w.payoutMethod) + '</td>' +
                '<td><span class="status-badge ' + statusClass + '">' + getStatusLabel(w.status) + '</span></td>' +
                '<td><span style="font-size:.82rem;color:var(--fd-text-muted);">' + escapeHtml(w.adminNote || '-') + '</span></td>' +
                '<td>' + date + '</td>';

            fragment.appendChild(row);
        }
        tbody.appendChild(fragment);
    }

    async function loadWalletData() {
        try {
            var res = await fetch('/api/farmer/wallet', {
                headers: { Authorization: 'Bearer ' + token }
            });

            if (res.status === 401) { localStorage.removeItem('token'); location.href = '/auth'; return; }
            if (!res.ok) throw new Error('Failed to load wallet data');

            var json = await res.json();
            var data = json.data || {};

            state.wallet = data.wallet;
            state.transactions = data.transactions || [];
            state.pendingRequests = data.pendingRequests || [];

            renderWallet(state.wallet);
            renderTransactions(state.transactions);

            var withdrawalRes = await fetch('/api/farmer/wallet/withdrawals', {
                headers: { Authorization: 'Bearer ' + token }
            });
            if (withdrawalRes.ok) {
                var wJson = await withdrawalRes.json();
                state.withdrawals = wJson.data || [];
                renderWithdrawals(state.withdrawals);
            }
        } catch (err) {
            console.error('loadWalletData error:', err);
            showToast(err.message || 'Failed to load wallet.', 'error');
        }
    }

    var withdrawForm = document.getElementById('withdrawForm');
    if (withdrawForm) {
        withdrawForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            var amount = parseFloat(document.getElementById('withdrawAmount').value);
            var method = document.getElementById('withdrawMethod').value;
            var details = document.getElementById('withdrawDetails').value.trim();
            var submitBtn = document.getElementById('withdrawSubmitBtn');

            if (!amount || amount <= 0) { showToast('Please enter a valid amount.', 'warning'); return; }
            if (state.wallet && amount > state.wallet.availableBalance) {
                showToast('Insufficient available balance.', 'warning');
                return;
            }
            if (!details) { showToast('Please enter payout details.', 'warning'); return; }

            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';

            try {
                var res = await fetch('/api/farmer/wallet/withdraw', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer ' + token
                    },
                    body: JSON.stringify({ amount: amount, payoutMethod: method, payoutDetails: details })
                });

                if (res.status === 401) { localStorage.removeItem('token'); location.href = '/auth'; return; }

                var json = await res.json();
                if (!res.ok) throw new Error(json.error || json.message || 'Failed to submit request');

                showToast('Withdrawal request submitted!', 'success');
                withdrawForm.reset();
                loadWalletData();
            } catch (err) {
                showToast(err.message, 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Request';
            }
        });
    }

    var resetBtn = document.getElementById('withdrawResetBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', function () {
            withdrawForm.reset();
        });
    }

    var darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) darkModeToggle.addEventListener('click', toggleDarkMode);

    var navHamburger = document.getElementById('navHamburger');
    var navCenter = document.getElementById('navCenter');
    var navRight = document.getElementById('navRight');
    if (navHamburger && navCenter && navRight) {
        navHamburger.addEventListener('click', function () {
            navCenter.classList.toggle('open');
            navRight.classList.toggle('open');
            var icon = navHamburger.querySelector('i');
            icon.className = navCenter.classList.contains('open') ? 'fa-solid fa-xmark' : 'fa-solid fa-bars';
        });
    }

    var profileTrigger = document.getElementById('profileTrigger');
    var profileDropdown = document.getElementById('profileDropdown');
    if (profileTrigger && profileDropdown) {
        profileTrigger.addEventListener('click', function (e) {
            e.stopPropagation();
            profileDropdown.classList.toggle('open');
        });
        document.addEventListener('click', function () { profileDropdown.classList.remove('open'); });
    }

    var navLogoutBtn = document.getElementById('navLogoutBtn');
    if (navLogoutBtn) {
        navLogoutBtn.addEventListener('click', function () {
            localStorage.removeItem('token');
            location.href = '/auth';
        });
    }

    initDarkMode();
    loadWalletData();
})();
