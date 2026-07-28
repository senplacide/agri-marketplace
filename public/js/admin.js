// =====================================================
// AgriConnect Admin Dashboard - Production JS
// =====================================================
// Features: Auth, Dashboard, Search, Pagination, Export,
// Filters, Audit Logs, Real-time Polling, Dark Mode,
// Toasts, Accessibility, Responsive
// =====================================================

(function () {
    'use strict';

    // =====================================
    // STATE
    // =====================================
    var token = localStorage.getItem('token');
    if (!token) { location.href = '/auth'; return; }

    // Role guard: verify user is an admin
    (async function () {
        try {
            var res = await fetch('/api/auth/me', { headers: { Authorization: 'Bearer ' + token } });
            if (!res.ok) { localStorage.removeItem('token'); location.href = '/auth'; return; }
            var json = await res.json();
            var user = json.user || json;
            if (user.role !== 'admin') {
                if (user.role === 'farmer') { location.href = '/dashboard'; }
                else if (user.role === 'buyer') { location.href = '/buyer-dashboard'; }
                else { location.href = '/auth'; }
                return;
            }
        } catch (e) {
            localStorage.removeItem('token');
            location.href = '/auth';
            return;
        }
    })();

    var state = {
        users: [],
        products: [],
        auditLogs: [],
        orders: [],
        adminId: null,
        usersPage: 1,
        productsPage: 1,
        auditPage: 1,
        ordersPage: 1,
        rowsPerPage: 10,
        searchQuery: '',
        userRoleFilter: 'all',
        userVerifiedFilter: 'all',
        userSuspendedFilter: 'all',
        productStatusFilter: 'all',
        productCategoryFilter: 'all',
        orderStatusFilter: 'all',
        activeTab: 'dashboard',
        pollInterval: null,
        lastStatsHash: '',
        lastPayload: null,
        financialData: null,
        withdrawals: [],
        withdrawalsPage: 1,
        withdrawalSearchQuery: '',
        withdrawalStatusFilterVal: 'all',
        auditActionFilter: 'all'
    };

    // =====================================
    // DOM REFERENCES (cached)
    // =====================================
    var dom = {
        usersTable: document.getElementById('usersTable'),
        productsTable: document.getElementById('productsTable'),
        usersPagination: document.getElementById('usersPagination'),
        productsPagination: document.getElementById('productsPagination'),
        auditLogsTable: document.getElementById('auditLogsTable'),
        auditPagination: document.getElementById('auditPagination'),
        globalSearch: document.getElementById('globalSearch'),
        userRoleFilter: document.getElementById('userRoleFilter'),
        userVerifiedFilter: document.getElementById('userVerifiedFilter'),
        userSuspendedFilter: document.getElementById('userSuspendedFilter'),
        productStatusFilter: document.getElementById('productStatusFilter'),
        productCategoryFilter: document.getElementById('productCategoryFilter'),
        auditSearch: document.getElementById('auditSearch'),
        dashboardSection: document.getElementById('dashboardSection'),
        auditLogsSection: document.getElementById('auditLogsSection'),
        darkModeToggle: document.getElementById('darkModeToggle'),
        userModal: document.getElementById('userModal'),
        closeModal: document.getElementById('closeModal'),
        userDetails: document.getElementById('userDetails'),
        editRole: document.getElementById('editRole'),
        saveRoleBtn: document.getElementById('saveRoleBtn'),
        logoutBtn: document.getElementById('logoutBtn'),
        ordersSection: document.getElementById('ordersSection'),
        ordersTable: document.getElementById('ordersTable'),
        ordersPagination: document.getElementById('ordersPagination'),
        orderSearch: document.getElementById('orderSearch'),
        orderStatusFilter: document.getElementById('orderStatusFilter'),
        auditActionFilter: document.getElementById('auditActionFilter'),
        orderModal: document.getElementById('orderModal'),
        closeOrderModal: document.getElementById('closeOrderModal'),
        orderDetailsBody: document.getElementById('orderDetailsBody'),
        financialSection: document.getElementById('financialSection'),
        withdrawalsTable: document.getElementById('withdrawalsTable'),
        withdrawalsPagination: document.getElementById('withdrawalsPagination'),
        withdrawalSearch: document.getElementById('withdrawalSearch'),
        withdrawalStatusFilter: document.getElementById('withdrawalStatusFilter'),
        finTransactionsTable: document.getElementById('finTransactionsTable')
    };

    // =====================================
    // CHART INSTANCES CACHE
    // =====================================
    var charts = {};

    // =====================================
    // TOAST NOTIFICATION SYSTEM
    // =====================================
    function showToast(message, type) {
        type = type || 'info';
        var icons = { success: '\u2713', error: '\u2717', warning: '\u26A0', info: 'i' };
        var container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container';
            container.setAttribute('aria-live', 'polite');
            document.body.appendChild(container);
        }
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

    // =====================================
    // LOADING SKELETONS
    // =====================================
    function showLoadingSkeletons() {
        var cardIds = ['usersCount', 'productsCount', 'farmersCount', 'buyersCount', 'activeProductsCount', 'ordersTodayCount', 'pendingOrdersCount', 'completedOrdersCount', 'grossMarketValue', 'platformCommissionAmt', 'farmerEarningsAmt', 'pendingRevenueAmt'];
        for (var i = 0; i < cardIds.length; i++) {
            var el = document.getElementById(cardIds[i]);
            if (el) el.innerHTML = '<span class="skeleton-box card-number-skeleton"></span>';
        }

        var chartCards = document.querySelectorAll('.chart-card');
        for (var j = 0; j < chartCards.length; j++) {
            var card = chartCards[j];
            if (!card.querySelector('.chart-loading-overlay')) {
                var overlay = document.createElement('div');
                overlay.className = 'chart-loading-overlay';
                overlay.innerHTML = '<div class="skeleton-box"></div><div class="skeleton-box skeleton-text-row"></div>';
                card.style.position = 'relative';
                card.appendChild(overlay);
            }
        }

        var tables = [dom.usersTable, dom.productsTable];
        for (var k = 0; k < tables.length; k++) {
            var tbody = tables[k];
            if (!tbody) continue;
            tbody.innerHTML = '';
            for (var i2 = 0; i2 < 5; i2++) {
                var row = document.createElement('tr');
                var cells = '';
                for (var j2 = 0; j2 < 6; j2++) {
                    cells += '<td><span class="skeleton-box skeleton-text" style="width:' + (50 + Math.random() * 40) + '%;display:block;height:14px;"></span></td>';
                }
                row.innerHTML = cells;
                tbody.appendChild(row);
            }
        }
    }

    function removeChartOverlays() {
        document.querySelectorAll('.chart-loading-overlay').forEach(function (overlay) {
            overlay.classList.add('fade-out');
            setTimeout(function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 350);
        });
    }

    function showChartEmptyState(canvasId) {
        var canvas = document.getElementById(canvasId);
        if (!canvas) return;
        var card = canvas.closest('.chart-card');
        if (!card) return;
        var overlay = card.querySelector('.chart-loading-overlay');
        if (overlay) overlay.remove();
        canvas.style.display = 'none';
        if (!card.querySelector('.empty-state')) {
            card.insertAdjacentHTML('beforeend', '<div class="empty-state"><span class="empty-state-icon">\uD83D\uDCCA</span><span class="empty-state-text">No analytics available.</span></div>');
        }
    }

    // =====================================
    // ANIMATED COUNTER
    // =====================================
    function animateCounter(elementId, target) {
        var element = document.getElementById(elementId);
        if (!element) return;
        var current = 0;
        var increment = Math.max(1, Math.ceil(target / 60));
        var timer = setInterval(function () {
            current += increment;
            if (current >= target) { current = target; clearInterval(timer); }
            element.textContent = current;
        }, 20);
    }

    // =====================================
    // HELPER: check dark mode
    // =====================================
    function isDarkMode() {
        return document.body.classList.contains('dark-mode');
    }

    // =====================================
    // CHART COLOR HELPERS
    // =====================================
    function chartTextColor() { return isDarkMode() ? '#94a3b8' : '#94a3b8'; }
    function chartGridColor() { return isDarkMode() ? 'rgba(148,163,184,0.1)' : 'rgba(148,163,184,0.08)'; }
    function chartTooltipBg() { return isDarkMode() ? '#334155' : '#1e293b'; }
    function chartLegendColor() { return isDarkMode() ? '#94a3b8' : '#64748b'; }

    function baseTooltipOpts() {
        return {
            backgroundColor: chartTooltipBg(),
            titleColor: '#f8fafc',
            bodyColor: '#cbd5e1',
            titleFont: { size: 13, weight: '600', family: "'Segoe UI', system-ui, sans-serif" },
            bodyFont: { size: 12, family: "'Segoe UI', system-ui, sans-serif" },
            padding: { top: 10, bottom: 10, left: 14, right: 14 },
            cornerRadius: 10,
            displayColors: true,
            boxWidth: 10,
            boxHeight: 10,
            boxPadding: 6,
            usePointStyle: true
        };
    }

    function baseLegendOpts() {
        return {
            color: chartLegendColor(),
            font: { size: 12, family: "'Segoe UI', system-ui, sans-serif", weight: '500' },
            padding: 20,
            usePointStyle: true,
            pointStyleWidth: 8
        };
    }

    function baseScaleTicks() {
        return { color: chartTextColor(), font: { size: 11, family: "'Segoe UI', system-ui, sans-serif" }, padding: 8 };
    }

    // =====================================
    // FILTERING LOGIC
    // =====================================
    function getFilteredUsers() {
        var q = state.searchQuery.toLowerCase();
        return state.users.filter(function (u) {
            // Search filter
            if (q) {
                var matchName = (u.name || '').toLowerCase().indexOf(q) !== -1;
                var matchEmail = (u.email || '').toLowerCase().indexOf(q) !== -1;
                var matchRole = (u.role || '').toLowerCase().indexOf(q) !== -1;
                if (!matchName && !matchEmail && !matchRole) return false;
            }
            // Role filter
            if (state.userRoleFilter !== 'all' && u.role !== state.userRoleFilter) return false;
            // Verified filter
            if (state.userVerifiedFilter === 'verified' && !u.isVerified) return false;
            if (state.userVerifiedFilter === 'pending' && u.isVerified) return false;
            // Suspended filter
            if (state.userSuspendedFilter === 'active' && u.isSuspended) return false;
            if (state.userSuspendedFilter === 'suspended' && !u.isSuspended) return false;
            return true;
        });
    }

    function getFilteredProducts() {
        var q = state.searchQuery.toLowerCase();
        return state.products.filter(function (p) {
            // Search filter
            if (q) {
                var matchName = (p.name || '').toLowerCase().indexOf(q) !== -1;
                var matchCategory = (p.category || '').toLowerCase().indexOf(q) !== -1;
                var matchOwner = (p.owner && p.owner.name ? p.owner.name.toLowerCase().indexOf(q) !== -1 : false);
                var matchStatus = (p.status || '').toLowerCase().indexOf(q) !== -1;
                if (!matchName && !matchCategory && !matchOwner && !matchStatus) return false;
            }
            // Status filter
            if (state.productStatusFilter !== 'all' && p.status !== state.productStatusFilter) return false;
            // Category filter
            if (state.productCategoryFilter !== 'all' && p.category !== state.productCategoryFilter) return false;
            return true;
        });
    }

    // =====================================
    // PAGINATION RENDERER
    // =====================================
    function renderPagination(container, currentPage, totalPages, onPageClick) {
        container.innerHTML = '';
        if (totalPages <= 1) return;

        var fragment = document.createDocumentFragment();

        var prevBtn = document.createElement('button');
        prevBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
        prevBtn.setAttribute('aria-label', 'Previous page');
        prevBtn.disabled = currentPage === 1;
        prevBtn.addEventListener('click', function () { onPageClick(currentPage - 1); });
        fragment.appendChild(prevBtn);

        var startPage = Math.max(1, currentPage - 2);
        var endPage = Math.min(totalPages, currentPage + 2);

        if (startPage > 1) {
            fragment.appendChild(createPageBtn(1, currentPage, onPageClick));
            if (startPage > 2) {
                var dots = document.createElement('span');
                dots.className = 'pagination-info';
                dots.textContent = '...';
                fragment.appendChild(dots);
            }
        }

        for (var i = startPage; i <= endPage; i++) {
            fragment.appendChild(createPageBtn(i, currentPage, onPageClick));
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                var dots2 = document.createElement('span');
                dots2.className = 'pagination-info';
                dots2.textContent = '...';
                fragment.appendChild(dots2);
            }
            fragment.appendChild(createPageBtn(totalPages, currentPage, onPageClick));
        }

        var nextBtn = document.createElement('button');
        nextBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
        nextBtn.setAttribute('aria-label', 'Next page');
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.addEventListener('click', function () { onPageClick(currentPage + 1); });
        fragment.appendChild(nextBtn);

        var info = document.createElement('span');
        info.className = 'pagination-info';
        info.textContent = 'Page ' + currentPage + ' of ' + totalPages;
        fragment.appendChild(info);

        container.appendChild(fragment);
    }

    function createPageBtn(page, current, onClick) {
        var btn = document.createElement('button');
        btn.textContent = page;
        btn.setAttribute('aria-label', 'Page ' + page);
        if (page === current) {
            btn.className = 'active';
            btn.setAttribute('aria-current', 'page');
        }
        btn.addEventListener('click', function () { onClick(page); });
        return btn;
    }

    // =====================================
    // RENDER USERS TABLE
    // =====================================
    function renderUsersTable() {
        var filtered = getFilteredUsers();
        var totalPages = Math.max(1, Math.ceil(filtered.length / state.rowsPerPage));
        if (state.usersPage > totalPages) state.usersPage = totalPages;

        var start = (state.usersPage - 1) * state.rowsPerPage;
        var pageData = filtered.slice(start, start + state.rowsPerPage);

        dom.usersTable.innerHTML = '';

        if (filtered.length === 0) {
            dom.usersTable.innerHTML = '<tr><td colspan="6"><div class="empty-state"><span class="empty-state-icon">\uD83D\uDC65</span><span class="empty-state-text">No users match your search or filters.</span></div></td></tr>';
            dom.usersPagination.innerHTML = '';
            return;
        }

        var fragment = document.createDocumentFragment();
        for (let idx = 0; idx < pageData.length; idx++) {
            let user = pageData[idx];
            let isSelf = state.adminId && String(user._id) === state.adminId;
            let row = document.createElement('tr');
            let roleBadge = getRoleBadge(user.role);
            let verifyBadge = getVerifyBadge(user);

            let suspendLabel = user.isSuspended ? '\u2705 Activate' : '\uD83D\uDEAB Suspend';
            let suspendBg = user.isSuspended ? '#2e7d32' : '#6c757d';
            let suspendTitle = isSelf ? 'You cannot ' + (user.isSuspended ? 'activate' : 'suspend') + ' your own account' : '';
            let deleteTitle = isSelf ? 'You cannot delete your own account' : '';

            row.innerHTML =
                '<td>' + escapeHtml(user.name) + '</td>' +
                '<td>' + escapeHtml(user.email) + '</td>' +
                '<td>' + roleBadge + '</td>' +
                '<td>' + verifyBadge + '</td>' +
                '<td>' + new Date(user.createdAt).toLocaleDateString() + '</td>' +
                '<td>' +
                    '<button class="viewUserBtn" data-id="' + user._id + '" style="background:#1976d2;color:white;border:none;padding:6px 10px;border-radius:6px;cursor:pointer;margin-right:5px;">View</button>' +
                    '<button class="editUserBtn" data-id="' + user._id + '" style="background:#f39c12;color:white;border:none;padding:6px 10px;border-radius:6px;cursor:pointer;margin-right:5px;">\u270F Edit</button>' +
                    '<button class="suspendUserBtn" data-id="' + user._id + '" style="background:' + suspendBg + ';color:white;border:none;padding:6px 10px;border-radius:6px;cursor:pointer;margin-right:5px;' + (isSelf ? 'opacity:0.5;cursor:not-allowed;' : '') + '" title="' + suspendTitle + '">' + suspendLabel + '</button>' +
                    '<button class="deleteUserBtn" data-id="' + user._id + '" style="background:#dc3545;color:white;border:none;padding:6px 10px;border-radius:6px;cursor:pointer;' + (isSelf ? 'opacity:0.5;cursor:not-allowed;' : '') + '" title="' + deleteTitle + '">\uD83D\uDDD1 Delete</button>' +
                '</td>';

            fragment.appendChild(row);

            row.querySelector('.viewUserBtn').addEventListener('click', function () {
                var avatarHtml = user.avatar
                    ? '<div style="margin-bottom:14px;"><img src="' + escapeHtml(user.avatar) + '" alt="Avatar" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:3px solid var(--admin-green);"></div>'
                    : '<div style="margin-bottom:14px;width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,rgba(46,125,50,.10),rgba(46,125,50,.20));display:flex;align-items:center;justify-content:center;font-size:1.5rem;color:var(--admin-green);font-weight:700;">' + escapeHtml((user.name || 'U').charAt(0).toUpperCase()) + '</div>';
                dom.userDetails.innerHTML =
                    avatarHtml +
                    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
                    '<p style="margin:0;font-size:.88rem;color:var(--td-color);line-height:1.8;"><strong style="color:var(--admin-text);">Name:</strong> ' + escapeHtml(user.name) + '</p>' +
                    '<p style="margin:0;font-size:.88rem;color:var(--td-color);line-height:1.8;"><strong style="color:var(--admin-text);">Email:</strong> ' + escapeHtml(user.email) + '</p>' +
                    '<p style="margin:0;font-size:.88rem;color:var(--td-color);line-height:1.8;"><strong style="color:var(--admin-text);">Role:</strong> ' + getRoleBadge(user.role) + '</p>' +
                    '<p style="margin:0;font-size:.88rem;color:var(--td-color);line-height:1.8;"><strong style="color:var(--admin-text);">Status:</strong> ' + getVerifyBadge(user) + '</p>' +
                    (user.phone ? '<p style="margin:0;font-size:.88rem;color:var(--td-color);line-height:1.8;"><strong style="color:var(--admin-text);">Phone:</strong> ' + escapeHtml(user.phone) + '</p>' : '') +
                    (user.address ? '<p style="margin:0;font-size:.88rem;color:var(--td-color);line-height:1.8;grid-column:1/-1;"><strong style="color:var(--admin-text);">Address:</strong> ' + escapeHtml(user.address) + '</p>' : '') +
                    (user.businessName ? '<p style="margin:0;font-size:.88rem;color:var(--td-color);line-height:1.8;grid-column:1/-1;"><strong style="color:var(--admin-text);">Business:</strong> ' + escapeHtml(user.businessName) + '</p>' : '') +
                    '<p style="margin:0;font-size:.88rem;color:var(--td-color);line-height:1.8;grid-column:1/-1;"><strong style="color:var(--admin-text);">Created:</strong> ' + new Date(user.createdAt).toLocaleString() + '</p>' +
                    '</div>';
                dom.userModal.style.display = 'flex';
            });

            row.querySelector('.editUserBtn').addEventListener('click', function () {
                if (isSelf) {
                    showToast('You cannot change your own role.', 'error');
                    return;
                }
                dom.userDetails.innerHTML =
                    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
                    '<p style="margin:0;font-size:.88rem;color:var(--td-color);line-height:1.8;"><strong style="color:var(--admin-text);">Name:</strong> ' + escapeHtml(user.name) + '</p>' +
                    '<p style="margin:0;font-size:.88rem;color:var(--td-color);line-height:1.8;"><strong style="color:var(--admin-text);">Email:</strong> ' + escapeHtml(user.email) + '</p>' +
                    '</div>' +
                    '<p style="margin:8px 0 0;font-size:.82rem;color:var(--admin-text-muted);">Change the user\'s role using the dropdown below:</p>';
                dom.editRole.value = user.role;
                dom.saveRoleBtn.dataset.id = user._id;
                dom.userModal.style.display = 'flex';
            });

            row.querySelector('.suspendUserBtn').addEventListener('click', async function () {
                if (isSelf) {
                    showToast('You cannot ' + (user.isSuspended ? 'activate' : 'suspend') + ' your own account.', 'error');
                    return;
                }
                var action = user.isSuspended ? 'activate' : 'suspend';
                if (!confirm('Are you sure you want to ' + action + ' ' + user.name + '?')) return;
                try {
                    var response = await fetch('/api/admin/users/' + user._id + '/suspend', {
                        method: 'PUT',
                        headers: { Authorization: 'Bearer ' + token }
                    });
                    var result = await response.json();
                    if (!response.ok) throw new Error(result.error);
                    showToast(result.message, 'success');
                    recordAuditLog(user.isSuspended ? 'User Activated' : 'User Suspended', user.name);
                    var targetUser = state.users.find(function (u) { return String(u._id) === String(user._id); });
                    if (targetUser) {
                        targetUser.isSuspended = !targetUser.isSuspended;
                    }
                    renderUsersTable();
                    loadAuditLogs();
                } catch (err) {
                    showToast(err.message, 'error');
                }
            });

            row.querySelector('.deleteUserBtn').addEventListener('click', async function () {
                if (isSelf) {
                    showToast('You cannot delete your own account.', 'error');
                    return;
                }
                if (!confirm('Delete ' + user.name + '? This cannot be undone.')) return;
                try {
                    var response = await fetch('/api/admin/users/' + user._id, {
                        method: 'DELETE',
                        headers: { Authorization: 'Bearer ' + token }
                    });
                    var result = await response.json();
                    if (!response.ok) throw new Error(result.error);
                    showToast(result.message, 'success');
                    recordAuditLog('User Deleted', user.name);
                    state.users = state.users.filter(function (u) { return String(u._id) !== String(user._id); });
                    renderUsersTable();
                    loadAuditLogs();
                } catch (err) {
                    showToast(err.message, 'error');
                }
            });
        }

        dom.usersTable.appendChild(fragment);

        renderPagination(dom.usersPagination, state.usersPage, totalPages, function (page) {
            state.usersPage = page;
            renderUsersTable();
        });
    }

    function getRoleBadge(role) {
        switch (role) {
            case 'admin':
                return '<span style="background:#d32f2f;color:white;padding:5px 12px;border-radius:20px;font-size:13px;font-weight:bold;">Admin</span>';
            case 'farmer':
                return '<span style="background:#2e7d32;color:white;padding:5px 12px;border-radius:20px;font-size:13px;font-weight:bold;">Farmer</span>';
            case 'buyer':
                return '<span style="background:#1976d2;color:white;padding:5px 12px;border-radius:20px;font-size:13px;font-weight:bold;">Buyer</span>';
            default:
                return role;
        }
    }

    function getVerifyBadge(user) {
        if (user.isSuspended) {
            return '<span style="background:#d32f2f;color:white;padding:5px 12px;border-radius:20px;font-size:13px;font-weight:bold;">\uD83D\uDD34 Suspended</span>';
        } else if (user.isVerified) {
            return '<span style="background:#2e7d32;color:white;padding:5px 12px;border-radius:20px;font-size:13px;font-weight:bold;">\uD83D\uDFE2 Active</span>';
        } else {
            return '<span style="background:#f39c12;color:white;padding:5px 12px;border-radius:20px;font-size:13px;font-weight:bold;">\uD83D\uDFE1 Pending</span>';
        }
    }

    // =====================================
    // RENDER PRODUCTS TABLE
    // =====================================
    function renderProductsTable() {
        var filtered = getFilteredProducts();
        var totalPages = Math.max(1, Math.ceil(filtered.length / state.rowsPerPage));
        if (state.productsPage > totalPages) state.productsPage = totalPages;

        var start = (state.productsPage - 1) * state.rowsPerPage;
        var pageData = filtered.slice(start, start + state.rowsPerPage);

        dom.productsTable.innerHTML = '';

        if (filtered.length === 0) {
            dom.productsTable.innerHTML = '<tr><td colspan="7"><div class="empty-state"><span class="empty-state-icon">\uD83D\uDCE6</span><span class="empty-state-text">No products match your search or filters.</span></div></td></tr>';
            dom.productsPagination.innerHTML = '';
            return;
        }

        var fragment = document.createDocumentFragment();
        for (var idx = 0; idx < pageData.length; idx++) {
            var product = pageData[idx];
            var row = document.createElement('tr');
            var statusText = product.status === 'approved' ? '\uD83D\uDFE2 Approved'
                : product.status === 'rejected' ? '\uD83D\uDD34 Rejected'
                : '\uD83D\uDFE1 Pending';
            var ownerName = product.owner ? product.owner.name : 'Unknown';

            var qty = product.quantity != null ? product.quantity : '-';
            var stockBadge = '';
            if (product.quantity != null) {
                if (product.quantity === 0) {
                    stockBadge = '<span style="background:rgba(211,47,47,.10);color:#d32f2f;padding:3px 8px;border-radius:12px;font-size:.72rem;font-weight:700;">Out of Stock</span>';
                } else if (product.quantity < 10) {
                    stockBadge = '<span style="background:rgba(234,88,12,.10);color:#ea580c;padding:3px 8px;border-radius:12px;font-size:.72rem;font-weight:700;">Low Stock</span>';
                } else {
                    stockBadge = '<span style="background:rgba(22,163,74,.10);color:#16a34a;padding:3px 8px;border-radius:12px;font-size:.72rem;font-weight:700;">In Stock</span>';
                }
            }

            row.innerHTML =
                '<td>' + escapeHtml(product.name) + '</td>' +
                '<td>' + escapeHtml(product.category) + '</td>' +
                '<td><div class="admin-price-cell">' + PriceFormatter.formatDual(product.price) + '</div></td>' +
                '<td>' + escapeHtml(ownerName) + '</td>' +
                '<td>' + statusText + '</td>' +
                '<td style="text-align:center;">' + qty + (product.quantity != null ? '<br>' + stockBadge : '') + '</td>' +
                '<td>' +
                    '<button class="viewProductBtn" style="background:#1976d2;color:white;border:none;padding:5px 10px;border-radius:6px;cursor:pointer;margin-right:4px;font-size:.8rem;" title="View Details"><i class="fa-solid fa-eye"></i></button>' +
                    '<button class="approveProductBtn" style="background:#2e7d32;color:white;border:none;padding:5px 10px;border-radius:6px;cursor:pointer;margin-right:4px;font-size:.8rem;" title="Approve">\u2705</button>' +
                    '<button class="rejectProductBtn" style="background:#f39c12;color:white;border:none;padding:5px 10px;border-radius:6px;cursor:pointer;margin-right:4px;font-size:.8rem;" title="Reject">\u274C</button>' +
                    '<button class="deleteProductBtn" data-id="' + product._id + '" style="background:#dc3545;color:white;border:none;padding:5px 10px;border-radius:6px;cursor:pointer;font-size:.8rem;" title="Delete">\uD83D\uDDD1</button>' +
                '</td>';

            fragment.appendChild(row);

            row.querySelector('.viewProductBtn').addEventListener('click', function () {
                var imgHtml = '';
                if (product.imageUrl && product.imageUrl.length > 0) {
                    imgHtml = '<div style="margin-bottom:14px;"><img src="' + escapeHtml(product.imageUrl) + '" alt="" style="width:100%;max-height:200px;object-fit:cover;border-radius:10px;border:1px solid var(--admin-border);"></div>';
                }
                var desc = product.description ? '<p style="margin:4px 0 0;font-size:.85rem;color:var(--td-color);line-height:1.6;">' + escapeHtml(product.description) + '</p>' : '';
                dom.userDetails.innerHTML =
                    imgHtml +
                    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
                    '<p style="margin:0;font-size:.88rem;color:var(--td-color);line-height:1.8;"><strong style="color:var(--admin-text);">Product:</strong> ' + escapeHtml(product.name) + '</p>' +
                    '<p style="margin:0;font-size:.88rem;color:var(--td-color);line-height:1.8;"><strong style="color:var(--admin-text);">Category:</strong> ' + escapeHtml(product.category) + '</p>' +
                    '<p style="margin:0;font-size:.88rem;color:var(--td-color);line-height:1.8;"><strong style="color:var(--admin-text);">Price:</strong> ' + PriceFormatter.formatDual(product.price) + '</p>' +
                    '<p style="margin:0;font-size:.88rem;color:var(--td-color);line-height:1.8;"><strong style="color:var(--admin-text);">Quantity:</strong> ' + qty + '</p>' +
                    '<p style="margin:0;font-size:.88rem;color:var(--td-color);line-height:1.8;"><strong style="color:var(--admin-text);">Owner:</strong> ' + escapeHtml(ownerName) + '</p>' +
                    '<p style="margin:0;font-size:.88rem;color:var(--td-color);line-height:1.8;"><strong style="color:var(--admin-text);">Status:</strong> ' + statusText + '</p>' +
                    '<p style="margin:0;font-size:.88rem;color:var(--td-color);line-height:1.8;grid-column:1/-1;"><strong style="color:var(--admin-text);">Created:</strong> ' + new Date(product.createdAt).toLocaleString() + '</p>' +
                    '</div>' +
                    (desc ? '<div style="margin-top:10px;"><strong style="color:var(--admin-text);font-size:.85rem;">Description:</strong>' + desc + '</div>' : '');
                document.getElementById('modalTitle').textContent = 'Product Details';
                dom.userModal.style.display = 'flex';
            });

            row.querySelector('.approveProductBtn').addEventListener('click', async function () {
                try {
                    var response = await fetch('/api/admin/products/' + product._id + '/status', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
                        body: JSON.stringify({ status: 'approved' })
                    });
                    var result = await response.json();
                    if (!response.ok) throw new Error(result.error);
                    showToast('Product approved successfully.', 'success');
                    recordAuditLog('Product Approved', product.name);
                    loadDashboardData();
                    loadAuditLogs();
                } catch (err) {
                    showToast(err.message, 'error');
                }
            });

            row.querySelector('.rejectProductBtn').addEventListener('click', async function () {
                try {
                    var response = await fetch('/api/admin/products/' + product._id + '/status', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
                        body: JSON.stringify({ status: 'rejected' })
                    });
                    var result = await response.json();
                    if (!response.ok) throw new Error(result.error);
                    showToast('Product rejected successfully.', 'success');
                    recordAuditLog('Product Rejected', product.name);
                    loadDashboardData();
                    loadAuditLogs();
                } catch (err) {
                    showToast(err.message, 'error');
                }
            });

            row.querySelector('.deleteProductBtn').addEventListener('click', async function () {
                if (!confirm('Delete "' + product.name + '"? This cannot be undone.')) return;
                try {
                    var response = await fetch('/api/admin/products/' + product._id, {
                        method: 'DELETE',
                        headers: { Authorization: 'Bearer ' + token }
                    });
                    var result = await response.json();
                    if (!response.ok) throw new Error(result.error);
                    showToast(result.message, 'success');
                    recordAuditLog('Product Deleted', product.name);
                    loadDashboardData();
                    loadAuditLogs();
                } catch (err) {
                    showToast(err.message, 'error');
                }
            });
        }

        dom.productsTable.appendChild(fragment);

        renderPagination(dom.productsPagination, state.productsPage, totalPages, function (page) {
            state.productsPage = page;
            renderProductsTable();
        });
    }

    // =====================================
    // RENDER CHARTS
    // =====================================
    function destroyAllCharts() {
        Object.keys(charts).forEach(function (key) {
            if (charts[key] && typeof charts[key].destroy === 'function') {
                charts[key].destroy();
            }
            charts[key] = null;
        });
    }

    function renderAllCharts(data) {
        destroyAllCharts();
        var stats = (data && data.stats) || {};
        var usersByRole = stats.usersByRole || { farmers: 0, buyers: 0, admins: 0 };
        var productsPerMonth = (data && data.productsPerMonth) || [];
        var usersPerMonth = (data && data.usersPerMonth) || [];
        var productsByCategory = (data && data.productsByCategory) || [];

        // Product Status Chart
        var chartCanvas = document.getElementById('productStatusChart');
        if (chartCanvas) {
            var productCtx = chartCanvas.getContext('2d');
            var gradPending = productCtx.createLinearGradient(0, 0, 0, 400);
            gradPending.addColorStop(0, '#ea580c');
            gradPending.addColorStop(1, 'rgba(234, 88, 12, 0.30)');
            var gradApproved = productCtx.createLinearGradient(0, 0, 0, 400);
            gradApproved.addColorStop(0, '#16a34a');
            gradApproved.addColorStop(1, 'rgba(22, 163, 74, 0.30)');
            var gradRejected = productCtx.createLinearGradient(0, 0, 0, 400);
            gradRejected.addColorStop(0, '#dc2626');
            gradRejected.addColorStop(1, 'rgba(220, 38, 38, 0.30)');

            charts.productChart = new Chart(chartCanvas, {
                type: 'bar',
                data: {
                    labels: ['Pending', 'Approved', 'Rejected'],
                    datasets: [{
                        label: 'Products',
                        data: [stats.pendingProducts || 0, stats.approvedProducts || 0, stats.rejectedProducts || 0],
                        backgroundColor: [gradPending, gradApproved, gradRejected],
                        borderRadius: 8, borderSkipped: false, maxBarThickness: 64
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    animation: { duration: 1200, easing: 'easeOutQuart' },
                    hover: { animationDuration: 300, mode: 'index', intersect: false },
                    plugins: { legend: { display: false }, tooltip: baseTooltipOpts() },
                    scales: {
                        x: { border: { display: false }, grid: { display: false }, ticks: { color: chartTextColor(), font: { size: 12, family: "'Segoe UI', system-ui, sans-serif", weight: '500' } } },
                        y: { beginAtZero: true, border: { display: false }, ticks: { stepSize: 1, color: chartTextColor(), font: { size: 11, family: "'Segoe UI', system-ui, sans-serif" }, padding: 8 }, grid: { color: chartGridColor(), drawBorder: false } }
                    }
                }
            });
        }

        // Products Line Chart
        var lineCanvas = document.getElementById('productsLineChart');
        if (lineCanvas) {
            var monthLabels = productsPerMonth.map(function (item) {
                return new Date(item._id.year, item._id.month - 1).toLocaleString('default', { month: 'short' });
            });
            var monthCounts = productsPerMonth.map(function (item) { return item.count; });
            var lineCtx = lineCanvas.getContext('2d');
            var lineGrad = lineCtx.createLinearGradient(0, 0, 0, 400);
            lineGrad.addColorStop(0, 'rgba(22, 163, 74, 0.25)');
            lineGrad.addColorStop(0.6, 'rgba(22, 163, 74, 0.05)');
            lineGrad.addColorStop(1, 'rgba(22, 163, 74, 0.00)');

            charts.productsLineChart = new Chart(lineCanvas, {
                type: 'line',
                data: {
                    labels: monthLabels,
                    datasets: [{
                        label: 'Products Added', data: monthCounts, borderColor: '#16a34a', backgroundColor: lineGrad,
                        fill: true, tension: 0.4, borderWidth: 2.5, pointRadius: 5, pointHoverRadius: 8,
                        pointBackgroundColor: '#ffffff', pointBorderColor: '#16a34a', pointBorderWidth: 2.5,
                        pointHoverBackgroundColor: '#16a34a', pointHoverBorderColor: '#ffffff', pointHoverBorderWidth: 2.5
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    animation: { duration: 1400, easing: 'easeOutQuart' },
                    hover: { animationDuration: 300, mode: 'index', intersect: false },
                    plugins: { legend: { display: true, labels: baseLegendOpts() }, tooltip: baseTooltipOpts() },
                    scales: {
                        x: { border: { display: false }, grid: { display: false }, ticks: { color: chartTextColor(), font: { size: 11, family: "'Segoe UI', system-ui, sans-serif" }, padding: 6 } },
                        y: { beginAtZero: true, border: { display: false }, ticks: { stepSize: 1, color: chartTextColor(), font: { size: 11, family: "'Segoe UI', system-ui, sans-serif" }, padding: 8 }, grid: { color: chartGridColor(), drawBorder: false } }
                    }
                }
            });
        }

        // Users by Role Chart
        var roleCanvas = document.getElementById('usersRoleChart');
        if (roleCanvas) {
            charts.usersRoleChart = new Chart(roleCanvas, {
                type: 'doughnut',
                data: {
                    labels: ['Farmers', 'Buyers', 'Admins'],
                    datasets: [{ data: [usersByRole.farmers || 0, usersByRole.buyers || 0, usersByRole.admins || 0], backgroundColor: ['#16a34a', '#2563eb', '#ea580c'], borderColor: isDarkMode() ? '#1e293b' : '#ffffff', borderWidth: 3, hoverBorderColor: isDarkMode() ? '#1e293b' : '#ffffff', hoverOffset: 6 }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false, cutout: '68%',
                    animation: { animateRotate: true, animateScale: true, duration: 1200, easing: 'easeOutQuart' },
                    hover: { animationDuration: 300 },
                    plugins: { legend: { position: 'bottom', labels: baseLegendOpts() }, tooltip: baseTooltipOpts() }
                }
            });
        }

        // Users Per Month Chart
        var usersCanvas = document.getElementById('usersMonthChart');
        if (usersCanvas) {
            var userMonthLabels = usersPerMonth.map(function (item) {
                return new Date(item._id.year, item._id.month - 1).toLocaleString('default', { month: 'short' });
            });
            var userMonthCounts = usersPerMonth.map(function (item) { return item.count; });
            var usersCtx = usersCanvas.getContext('2d');
            var usersGrad = usersCtx.createLinearGradient(0, 0, 0, 400);
            usersGrad.addColorStop(0, 'rgba(37, 99, 235, 0.25)');
            usersGrad.addColorStop(0.6, 'rgba(37, 99, 235, 0.05)');
            usersGrad.addColorStop(1, 'rgba(37, 99, 235, 0.00)');

            charts.usersLineChart = new Chart(usersCanvas, {
                type: 'line',
                data: {
                    labels: userMonthLabels,
                    datasets: [{
                        label: 'New Users', data: userMonthCounts, borderColor: '#2563eb', backgroundColor: usersGrad,
                        fill: true, tension: 0.4, borderWidth: 2.5, pointRadius: 5, pointHoverRadius: 8,
                        pointBackgroundColor: '#ffffff', pointBorderColor: '#2563eb', pointBorderWidth: 2.5,
                        pointHoverBackgroundColor: '#2563eb', pointHoverBorderColor: '#ffffff', pointHoverBorderWidth: 2.5
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    animation: { duration: 1400, easing: 'easeOutQuart' },
                    hover: { animationDuration: 300, mode: 'index', intersect: false },
                    plugins: { legend: { display: true, labels: baseLegendOpts() }, tooltip: baseTooltipOpts() },
                    scales: {
                        x: { border: { display: false }, grid: { display: false }, ticks: { color: chartTextColor(), font: { size: 11, family: "'Segoe UI', system-ui, sans-serif" }, padding: 6 } },
                        y: { beginAtZero: true, border: { display: false }, ticks: { stepSize: 1, color: chartTextColor(), font: { size: 11, family: "'Segoe UI', system-ui, sans-serif" }, padding: 8 }, grid: { color: chartGridColor(), drawBorder: false } }
                    }
                }
            });
        }

        // Verification Chart
        var verificationCanvas = document.getElementById('verificationChart');
        if (verificationCanvas) {
            charts.verificationChart = new Chart(verificationCanvas, {
                type: 'doughnut',
                data: {
                    labels: ['Verified', 'Pending'],
                    datasets: [{ data: [stats.verifiedUsers || 0, stats.unverifiedUsers || 0], backgroundColor: ['#16a34a', '#d97706'], borderColor: isDarkMode() ? '#1e293b' : '#ffffff', borderWidth: 3, hoverBorderColor: isDarkMode() ? '#1e293b' : '#ffffff', hoverOffset: 6 }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false, cutout: '68%',
                    animation: { animateRotate: true, animateScale: true, duration: 1200, easing: 'easeOutQuart' },
                    hover: { animationDuration: 300 },
                    plugins: { legend: { position: 'bottom', labels: baseLegendOpts() }, tooltip: baseTooltipOpts() }
                }
            });
        }

        // Category Chart
        var categoryCanvas = document.getElementById('categoryChart');
        if (categoryCanvas) {
            var categoryLabels = productsByCategory.map(function (item) { return item._id; });
            var categoryCounts = productsByCategory.map(function (item) { return item.count; });
            var categoryCtx = categoryCanvas.getContext('2d');
            var categoryGrad = categoryCtx.createLinearGradient(0, 0, 0, 400);
            categoryGrad.addColorStop(0, '#16a34a');
            categoryGrad.addColorStop(1, 'rgba(22, 163, 74, 0.30)');

            charts.categoryChart = new Chart(categoryCanvas, {
                type: 'bar',
                data: {
                    labels: categoryLabels,
                    datasets: [{ label: 'Products', data: categoryCounts, backgroundColor: categoryGrad, borderRadius: 8, borderSkipped: false, maxBarThickness: 56 }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    animation: { duration: 1200, easing: 'easeOutQuart' },
                    hover: { animationDuration: 300, mode: 'index', intersect: false },
                    plugins: { legend: { display: false }, tooltip: baseTooltipOpts() },
                    scales: {
                        x: { border: { display: false }, grid: { display: false }, ticks: { color: chartTextColor(), font: { size: 11, family: "'Segoe UI', system-ui, sans-serif" }, padding: 6 } },
                        y: { beginAtZero: true, border: { display: false }, ticks: { stepSize: 1, color: chartTextColor(), font: { size: 11, family: "'Segoe UI', system-ui, sans-serif" }, padding: 8 }, grid: { color: chartGridColor(), drawBorder: false } }
                    }
                }
            });
        }

        // Empty state checks
        if ((stats.pendingProducts || 0) === 0 && (stats.approvedProducts || 0) === 0 && (stats.rejectedProducts || 0) === 0) showChartEmptyState('productStatusChart');
        if (productsPerMonth.length === 0) showChartEmptyState('productsLineChart');
        if ((usersByRole.farmers || 0) === 0 && (usersByRole.buyers || 0) === 0 && (usersByRole.admins || 0) === 0) showChartEmptyState('usersRoleChart');
        if (usersPerMonth.length === 0) showChartEmptyState('usersMonthChart');
        if ((stats.verifiedUsers || 0) === 0 && (stats.unverifiedUsers || 0) === 0) showChartEmptyState('verificationChart');
        if (productsByCategory.length === 0) showChartEmptyState('categoryChart');

        removeChartOverlays();
    }

    // =====================================
    // LOAD DASHBOARD DATA
    // =====================================
    async function loadDashboardData() {
        try {
            var response = await fetch('/api/admin/dashboard', {
                headers: { Authorization: 'Bearer ' + token }
            });
            if (!response.ok) throw new Error('Unauthorized');

            var json = await response.json();
            var payload = json.data || json;
            var stats = payload.stats || {};

            // Check if data changed (for polling)
            var newHash = JSON.stringify(stats.totalUsers) + JSON.stringify(stats.totalProducts) + JSON.stringify(stats.farmers) + JSON.stringify(stats.buyers) + JSON.stringify(stats.totalOrders) + JSON.stringify(stats.totalRevenue);
            var dataChanged = (newHash !== state.lastStatsHash);
            state.lastStatsHash = newHash;

            // Store data
            state.users = payload.users || [];
            state.products = payload.products || [];
            state.lastPayload = payload;
            if (payload.admin && payload.admin.id) {
                state.adminId = String(payload.admin.id);
            }

            // Update KPIs
            animateCounter('usersCount', stats.totalUsers || 0);
            animateCounter('productsCount', stats.totalProducts || 0);
            animateCounter('farmersCount', stats.farmers || 0);
            animateCounter('buyersCount', stats.buyers || 0);

            animateCounter('activeProductsCount', stats.approvedProducts || 0);
            animateCounter('ordersTodayCount', stats.ordersToday || 0);
            animateCounter('pendingOrdersCount', stats.pendingOrders || 0);
            animateCounter('completedOrdersCount', stats.completedOrders || 0);

            var fmtRwf = function (n) { return Number(n || 0).toLocaleString() + ' RWF'; };
            var grossEl = document.getElementById('grossMarketValue');
            var commEl = document.getElementById('platformCommissionAmt');
            var earnEl = document.getElementById('farmerEarningsAmt');
            var pendEl = document.getElementById('pendingRevenueAmt');
            if (grossEl) grossEl.textContent = fmtRwf(stats.totalRevenue || 0);
            if (commEl) commEl.textContent = fmtRwf(stats.platformCommission || 0);
            if (earnEl) earnEl.textContent = fmtRwf(stats.farmerEarnings || 0);
            if (pendEl) pendEl.textContent = fmtRwf(stats.pendingRevenue || 0);

            // Render charts only on first load or when data actually changed
            if (dataChanged || !state.lastStatsHash) {
                renderAllCharts(payload);
            }

            // Render tables
            renderUsersTable();
            renderProductsTable();

        } catch (err) {
            console.error('loadDashboardData error:', err);
            showToast(err.message, 'error');
        }
    }

    // =====================================
    // AUDIT LOGS
    // =====================================
    async function recordAuditLog(action, target, details) {
        try {
            await fetch('/api/admin/audit-logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
                body: JSON.stringify({ action: action, target: target, details: details || '' })
            });
        } catch (err) {
            // Silent fail for audit logging
        }
    }

    async function loadAuditLogs() {
        try {
            var response = await fetch('/api/admin/audit-logs', {
                headers: { Authorization: 'Bearer ' + token }
            });
            if (!response.ok) throw new Error('Failed to load audit logs');
            var json = await response.json();
            var payload = json.data || json;
            state.auditLogs = Array.isArray(payload) ? payload : [];
            renderAuditLogsTable();
        } catch (err) {
            console.error('loadAuditLogs error:', err);
        }
    }

    function renderAuditLogsTable() {
        var searchVal = dom.auditSearch ? dom.auditSearch.value.toLowerCase() : '';
        var actionFilter = state.auditActionFilter || 'all';
        var filtered = state.auditLogs.filter(function (log) {
            if (actionFilter !== 'all' && log.action !== actionFilter) return false;
            if (!searchVal) return true;
            return (log.action || '').toLowerCase().indexOf(searchVal) !== -1 ||
                (log.target || '').toLowerCase().indexOf(searchVal) !== -1 ||
                (log.admin || '').toLowerCase().indexOf(searchVal) !== -1;
        });

        var totalPages = Math.max(1, Math.ceil(filtered.length / state.rowsPerPage));
        if (state.auditPage > totalPages) state.auditPage = totalPages;

        var start = (state.auditPage - 1) * state.rowsPerPage;
        var pageData = filtered.slice(start, start + state.rowsPerPage);

        dom.auditLogsTable.innerHTML = '';

        if (filtered.length === 0) {
            dom.auditLogsTable.innerHTML = '<tr><td colspan="5"><div class="empty-state"><span class="empty-state-icon">\uD83D\uDCCB</span><span class="empty-state-text">No audit logs found.</span></div></td></tr>';
            dom.auditPagination.innerHTML = '';
            return;
        }

        var fragment = document.createDocumentFragment();
        for (var idx = 0; idx < pageData.length; idx++) {
            var log = pageData[idx];
            var row = document.createElement('tr');
            var date = new Date(log.createdAt);
            row.innerHTML =
                '<td>' + date.toLocaleDateString() + '</td>' +
                '<td>' + date.toLocaleTimeString() + '</td>' +
                '<td>' + escapeHtml(log.admin) + '</td>' +
                '<td>' + escapeHtml(log.action) + '</td>' +
                '<td>' + escapeHtml(log.target) + '</td>';
            fragment.appendChild(row);
        }

        dom.auditLogsTable.appendChild(fragment);

        renderPagination(dom.auditPagination, state.auditPage, totalPages, function (page) {
            state.auditPage = page;
            renderAuditLogsTable();
        });
    }

    // =====================================
    // ORDERS MANAGEMENT
    // =====================================
    async function loadOrders() {
        try {
            var response = await fetch('/api/admin/orders', {
                headers: { Authorization: 'Bearer ' + token }
            });
            if (!response.ok) throw new Error('Failed to load orders.');
            var json = await response.json();
            var payload = json.data || json;
            state.orders = Array.isArray(payload) ? payload : [];
            updateOrderKPIs();
            renderOrdersTable();
        } catch (err) {
            console.error('loadOrders error:', err);
            showToast(err.message, 'error');
        }
    }

    function updateOrderKPIs() {
        var counts = { total: 0, pending: 0, accepted: 0, completed: 0, rejected: 0, today: 0 };
        var today = new Date();
        var todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        for (var i = 0; i < state.orders.length; i++) {
            var s = normalizeOrderStatus(state.orders[i].status);
            counts.total++;
            if (counts[s] !== undefined) counts[s]++;
            var created = new Date(state.orders[i].createdAt);
            if (created >= todayStart) counts.today++;
        }

        animateCounter('orderKpiTotal', counts.total);
        animateCounter('orderKpiPending', counts.pending);
        animateCounter('orderKpiAccepted', counts.accepted);
        animateCounter('orderKpiCompleted', counts.completed);
        animateCounter('orderKpiRejected', counts.rejected);
        animateCounter('orderKpiToday', counts.today);
    }

    function normalizeOrderStatus(status) {
        if (!status) return 'pending';
        return status.toLowerCase();
    }

    function getOrderStatusLabel(status) {
        if (!status) return 'Pending';
        return status.charAt(0).toUpperCase() + status.slice(1);
    }

    function getOrderStatusIcon(status) {
        var s = normalizeOrderStatus(status);
        if (s === 'pending') return 'fa-clock';
        if (s === 'accepted') return 'fa-circle-check';
        if (s === 'completed') return 'fa-flag-checkered';
        if (s === 'rejected') return 'fa-circle-xmark';
        return 'fa-circle-question';
    }

    function getFilteredOrders() {
        var q = state.searchQuery.toLowerCase();
        var statusFilter = state.orderStatusFilter;

        return state.orders.filter(function (order) {
            var normalizedStatus = normalizeOrderStatus(order.status);
            if (statusFilter !== 'all' && normalizedStatus !== statusFilter) return false;

            if (q) {
                var matchOrderId = (order.orderId || '').toLowerCase().indexOf(q) !== -1;
                var matchBuyerName = (order.buyerName || (order.buyer && order.buyer.name) || '').toLowerCase().indexOf(q) !== -1;
                var matchBuyerEmail = (order.buyer && order.buyer.email ? order.buyer.email.toLowerCase().indexOf(q) !== -1 : false);

                var matchFarmer = false;
                if (order.items) {
                    for (var i = 0; i < order.items.length; i++) {
                        if ((order.items[i].farmerName || '').toLowerCase().indexOf(q) !== -1) {
                            matchFarmer = true;
                            break;
                        }
                    }
                }

                var matchProduct = false;
                if (order.items) {
                    for (var j = 0; j < order.items.length; j++) {
                        if ((order.items[j].productName || '').toLowerCase().indexOf(q) !== -1) {
                            matchProduct = true;
                            break;
                        }
                    }
                }

                if (!matchOrderId && !matchBuyerName && !matchBuyerEmail && !matchFarmer && !matchProduct) return false;
            }

            return true;
        });
    }

    function formatOrderPrice(price) {
        return Number(price).toLocaleString('en-RW');
    }

    function formatOrderDualPrice(price) {
        return PriceFormatter.formatDual(price);
    }

    function formatOrderDate(dateStr) {
        var d = new Date(dateStr);
        var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    }

    function formatOrderTime(dateStr) {
        var d = new Date(dateStr);
        var h = d.getHours();
        var m = d.getMinutes();
        var ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12; if (h === 0) h = 12;
        return h + ':' + (m < 10 ? '0' : '') + m + ' ' + ampm;
    }

    function formatOrderAddress(deliveryInfo) {
        if (!deliveryInfo) return '';
        var parts = [];
        if (deliveryInfo.village) parts.push(deliveryInfo.village);
        if (deliveryInfo.cell) parts.push(deliveryInfo.cell);
        if (deliveryInfo.sector) parts.push(deliveryInfo.sector);
        if (deliveryInfo.district) parts.push(deliveryInfo.district);
        return parts.join(', ');
    }

    function renderOrdersTable() {
        var filtered = getFilteredOrders();
        var totalPages = Math.max(1, Math.ceil(filtered.length / state.rowsPerPage));
        if (state.ordersPage > totalPages) state.ordersPage = totalPages;

        var start = (state.ordersPage - 1) * state.rowsPerPage;
        var pageData = filtered.slice(start, start + state.rowsPerPage);

        dom.ordersTable.innerHTML = '';

        if (filtered.length === 0) {
            dom.ordersTable.innerHTML = '<tr><td colspan="11"><div class="empty-state"><span class="empty-state-icon">\uD83D\uDCCB</span><span class="empty-state-text">No orders match your search or filters.</span></div></td></tr>';
            dom.ordersPagination.innerHTML = '';
            return;
        }

        var fragment = document.createDocumentFragment();
        for (var idx = 0; idx < pageData.length; idx++) {
            var order = pageData[idx];
            var row = document.createElement('tr');
            var normalizedStatus = normalizeOrderStatus(order.status);
            var statusLabel = getOrderStatusLabel(order.status);
            var statusIcon = getOrderStatusIcon(order.status);

            var buyerName = order.buyerName || (order.buyer ? order.buyer.name : 'Unknown');
            var buyerEmail = order.buyer ? order.buyer.email : '';

            var farmerNames = [];
            if (order.items) {
                for (var i = 0; i < order.items.length; i++) {
                    var fn = order.items[i].farmerName || 'Unknown';
                    if (farmerNames.indexOf(fn) === -1) farmerNames.push(fn);
                }
            }
            var farmerDisplay = farmerNames.join(', ') || 'Unknown';

            var productHtml = '';
            if (order.items && order.items.length > 0) {
                var firstItem = order.items[0];
                var hasImg = firstItem.imageUrl && firstItem.imageUrl.length > 0;
                var thumbHtml = hasImg
                    ? '<img src="' + escapeHtml(firstItem.imageUrl) + '" alt="" loading="lazy">'
                    : '<i class="fa-solid fa-box"></i>';
                var nameText = firstItem.productName || 'Product';
                if (order.items.length > 1) nameText += ' +' + (order.items.length - 1) + ' more';
                productHtml = '<div class="orders-product-cell"><div class="orders-product-thumb">' + thumbHtml + '</div><span class="orders-product-name">' + escapeHtml(nameText) + '</span></div>';
            } else {
                productHtml = '<span class="orders-product-name">N/A</span>';
            }

            var totalQty = 0;
            if (order.items) {
                for (var q = 0; q < order.items.length; q++) {
                    totalQty += order.items[q].quantity || 0;
                }
            }

            var unitPrice = (order.items && order.items.length > 0) ? order.items[0].unitPrice : 0;

            var deliveryAddr = formatOrderAddress(order.deliveryInfo);

            row.innerHTML =
                '<td><strong style="font-size:.82rem;">' + escapeHtml(order.orderId.slice(-10)) + '</strong></td>' +
                '<td>' + formatOrderDate(order.createdAt) + '</td>' +
                '<td>' + escapeHtml(buyerName) + '<br><span style="font-size:.75rem;color:var(--admin-text-muted);">' + escapeHtml(buyerEmail) + '</span></td>' +
                '<td>' + escapeHtml(farmerDisplay) + '</td>' +
                '<td>' + productHtml + '</td>' +
                '<td>' + totalQty + '</td>' +
                '<td><div class="admin-price-cell">' + formatOrderDualPrice(unitPrice) + '</div></td>' +
                '<td><strong>' + formatOrderDualPrice(order.totalPrice) + '</strong></td>' +
                '<td><span style="font-size:.82rem;">' + escapeHtml(deliveryAddr || 'N/A') + '</span></td>' +
                '<td><span class="order-status-badge ' + normalizedStatus + '"><i class="fa-solid ' + statusIcon + '"></i> ' + statusLabel + '</span></td>' +
                '<td><button class="orders-view-btn" data-order-idx="' + state.orders.indexOf(order) + '"><i class="fa-solid fa-eye"></i> View</button></td>';

            fragment.appendChild(row);

            row.querySelector('.orders-view-btn').addEventListener('click', function () {
                var idx = parseInt(this.getAttribute('data-order-idx'));
                showOrderDetails(state.orders[idx]);
            });
        }

        dom.ordersTable.appendChild(fragment);

        renderPagination(dom.ordersPagination, state.ordersPage, totalPages, function (page) {
            state.ordersPage = page;
            renderOrdersTable();
        });
    }

    function showOrderDetails(order) {
        if (!order) return;

        var buyerName = order.buyerName || (order.buyer ? order.buyer.name : 'Unknown');
        var buyerEmail = order.buyer ? (order.buyer.email || '') : '';
        var buyerPhone = order.buyer ? (order.buyer.phone || '') : (order.deliveryInfo ? order.deliveryInfo.phone : '');

        var farmerNames = [];
        var farmerEmails = [];
        if (order.items) {
            for (var i = 0; i < order.items.length; i++) {
                var fn = order.items[i].farmerName || 'Unknown';
                if (farmerNames.indexOf(fn) === -1) farmerNames.push(fn);
            }
        }

        var normalizedStatus = normalizeOrderStatus(order.status);

        var html = '';

        // Buyer Info
        html += '<div class="order-detail-section">';
        html += '<p class="order-detail-section-title"><i class="fa-solid fa-user"></i> Buyer Information</p>';
        html += '<div class="order-detail-grid">';
        html += '<div class="order-detail-field"><strong>Name:</strong> ' + escapeHtml(buyerName) + '</div>';
        html += '<div class="order-detail-field"><strong>Email:</strong> ' + escapeHtml(buyerEmail) + '</div>';
        html += '<div class="order-detail-field"><strong>Phone:</strong> ' + escapeHtml(buyerPhone) + '</div>';
        html += '<div class="order-detail-field"><strong>Order Date:</strong> ' + formatOrderDate(order.createdAt) + ' at ' + formatOrderTime(order.createdAt) + '</div>';
        html += '</div></div>';

        // Farmer Info
        html += '<div class="order-detail-section">';
        html += '<p class="order-detail-section-title"><i class="fa-solid fa-seedling"></i> Farmer Information</p>';
        html += '<div class="order-detail-grid">';
        html += '<div class="order-detail-field order-detail-full"><strong>Farmer(s):</strong> ' + escapeHtml(farmerNames.join(', ') || 'Unknown') + '</div>';
        html += '</div></div>';

        // Product Info
        html += '<div class="order-detail-section">';
        html += '<p class="order-detail-section-title"><i class="fa-solid fa-box-open"></i> Product Information</p>';
        if (order.items && order.items.length > 0) {
            for (var p = 0; p < order.items.length; p++) {
                var item = order.items[p];
                var hasImg = item.imageUrl && item.imageUrl.length > 0;
                var imgHtml = hasImg
                    ? '<img src="' + escapeHtml(item.imageUrl) + '" alt="" loading="lazy">'
                    : '<i class="fa-solid fa-box"></i>';
                html += '<div class="order-detail-product">';
                html += '<div class="order-detail-product-img">' + imgHtml + '</div>';
                html += '<div class="order-detail-product-info">';
                html += '<p class="order-detail-product-name">' + escapeHtml(item.productName) + '</p>';
                html += '<p class="order-detail-product-meta">Qty: ' + (item.quantity || 1) + ' &middot; <span class="price-dual">' + formatOrderDualPrice(item.unitPrice) + '</span>/unit</p>';
                html += '</div>';
                html += '<div class="order-detail-product-price">';
                html += '<p class="order-detail-product-price-value">' + formatOrderDualPrice(item.lineTotal || (item.unitPrice * item.quantity)) + '</p>';
                html += '<p class="order-detail-product-price-label">Subtotal</p>';
                html += '</div>';
                html += '</div>';
            }
        }
        html += '<div class="order-detail-total"><span class="order-detail-total-label">Order Total</span><span class="order-detail-total-value">' + formatOrderDualPrice(order.totalPrice) + '</span></div>';
        html += '</div>';

        // Delivery Address
        html += '<div class="order-detail-section">';
        html += '<p class="order-detail-section-title"><i class="fa-solid fa-location-dot"></i> Delivery Address</p>';
        html += '<div class="order-detail-delivery">';
        html += '<div class="order-detail-grid">';
        if (order.deliveryInfo) {
            html += '<div class="order-detail-field"><strong>Full Name:</strong> ' + escapeHtml(order.deliveryInfo.fullName || '') + '</div>';
            html += '<div class="order-detail-field"><strong>Phone:</strong> ' + escapeHtml(order.deliveryInfo.phone || '') + '</div>';
            html += '<div class="order-detail-field"><strong>District:</strong> ' + escapeHtml(order.deliveryInfo.district || '') + '</div>';
            html += '<div class="order-detail-field"><strong>Sector:</strong> ' + escapeHtml(order.deliveryInfo.sector || '') + '</div>';
            html += '<div class="order-detail-field"><strong>Cell:</strong> ' + escapeHtml(order.deliveryInfo.cell || '') + '</div>';
            html += '<div class="order-detail-field"><strong>Village:</strong> ' + escapeHtml(order.deliveryInfo.village || '') + '</div>';
        }
        html += '</div></div></div>';

        // Order Timeline
        html += '<div class="order-detail-section">';
        html += '<p class="order-detail-section-title"><i class="fa-solid fa-timeline"></i> Order Timeline</p>';
        html += '<div class="order-timeline">';

        html += '<div class="order-timeline-item active">';
        html += '<div class="order-timeline-dot"></div>';
        html += '<p class="order-timeline-label">Order Created</p>';
        html += '<p class="order-timeline-time">' + formatOrderDate(order.createdAt) + ' at ' + formatOrderTime(order.createdAt) + '</p>';
        html += '</div>';

        if (normalizedStatus === 'accepted' || normalizedStatus === 'completed') {
            html += '<div class="order-timeline-item active">';
            html += '<div class="order-timeline-dot"></div>';
            html += '<p class="order-timeline-label">Accepted</p>';
            html += '<p class="order-timeline-time">Order accepted by farmer</p>';
            html += '</div>';
        }

        if (normalizedStatus === 'rejected') {
            html += '<div class="order-timeline-item rejected active">';
            html += '<div class="order-timeline-dot"></div>';
            html += '<p class="order-timeline-label">Rejected</p>';
            html += '<p class="order-timeline-time">Order rejected by farmer</p>';
            html += '</div>';
        }

        if (normalizedStatus === 'completed') {
            html += '<div class="order-timeline-item active">';
            html += '<div class="order-timeline-dot"></div>';
            html += '<p class="order-timeline-label">Completed</p>';
            html += '<p class="order-timeline-time">Order marked as completed</p>';
            html += '</div>';
        }

        if (normalizedStatus === 'pending') {
            html += '<div class="order-timeline-item">';
            html += '<div class="order-timeline-dot"></div>';
            html += '<p class="order-timeline-label" style="color:var(--admin-text-muted);">Awaiting acceptance...</p>';
            html += '<p class="order-timeline-time">Pending farmer response</p>';
            html += '</div>';
        }

        html += '</div></div>';

        dom.orderDetailsBody.innerHTML = html;
        dom.orderModal.style.display = 'flex';
    }

    function closeOrderModalFn() {
        dom.orderModal.classList.add('modal-closing');
        setTimeout(function () {
            dom.orderModal.style.display = 'none';
            dom.orderModal.classList.remove('modal-closing');
        }, 200);
    }

    // =====================================
    // EXPORT FUNCTIONS
    // =====================================
    function downloadFile(content, filename, mimeType) {
        var blob = new Blob(['\ufeff' + content], { type: mimeType });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function exportToCsv(headers, rows, filename) {
        var csv = headers.join(',') + '\n';
        rows.forEach(function (row) {
            csv += row.map(function (cell) {
                return '"' + String(cell).replace(/"/g, '""') + '"';
            }).join(',') + '\n';
        });
        downloadFile(csv, filename + '.csv', 'text/csv;charset=utf-8;');
    }

    function exportToExcel(headers, rows, filename) {
        var html = '<html><head><meta charset="utf-8"></head><body><table border="1">';
        html += '<tr>' + headers.map(function (h) { return '<th style="background:#2e7d32;color:white;padding:8px;font-weight:bold;">' + h + '</th>'; }).join('') + '</tr>';
        rows.forEach(function (row) {
            html += '<tr>' + row.map(function (cell) { return '<td style="padding:6px 10px;">' + cell + '</td>'; }).join('') + '</tr>';
        });
        html += '</table></body></html>';
        downloadFile(html, filename + '.xls', 'application/vnd.ms-excel');
    }

    function exportUsers(format) {
        var filtered = getFilteredUsers();
        var headers = ['Name', 'Email', 'Role', 'Verified', 'Suspended', 'Created'];
        var rows = filtered.map(function (u) {
            return [u.name, u.email, u.role, u.isVerified ? 'Yes' : 'No', u.isSuspended ? 'Yes' : 'No', new Date(u.createdAt).toLocaleDateString()];
        });
        if (format === 'csv') exportToCsv(headers, rows, 'agriconnect-users');
        else exportToExcel(headers, rows, 'agriconnect-users');
    }

    function exportProducts(format) {
        var filtered = getFilteredProducts();
        var headers = ['Product', 'Category', 'Price', 'Owner', 'Status', 'Quantity', 'Created'];
        var rows = filtered.map(function (p) {
            var qty = p.quantity != null ? p.quantity : '';
            var stock = p.quantity === 0 ? 'Out of Stock' : (p.quantity != null && p.quantity < 10 ? 'Low Stock' : 'In Stock');
            return [p.name, p.category, p.price, p.owner ? p.owner.name : 'Unknown', p.status, qty + (p.quantity != null ? ' (' + stock + ')' : ''), new Date(p.createdAt).toLocaleDateString()];
        });
        if (format === 'csv') exportToCsv(headers, rows, 'agriconnect-products');
        else exportToExcel(headers, rows, 'agriconnect-products');
    }

    function exportOrders() {
        var filtered = getFilteredOrders();
        var headers = ['Order ID', 'Date', 'Buyer Name', 'Buyer Email', 'Farmer Name', 'Product', 'Quantity', 'Unit Price', 'Total Price', 'Delivery Address', 'Status'];
        var rows = filtered.map(function (o) {
            var buyerName = o.buyerName || (o.buyer ? o.buyer.name : 'Unknown');
            var buyerEmail = o.buyer ? (o.buyer.email || '') : '';
            var farmerNames = [];
            if (o.items) {
                for (var i = 0; i < o.items.length; i++) {
                    var fn = o.items[i].farmerName || 'Unknown';
                    if (farmerNames.indexOf(fn) === -1) farmerNames.push(fn);
                }
            }
            var productNames = [];
            if (o.items) {
                for (var j = 0; j < o.items.length; j++) {
                    productNames.push(o.items[j].productName);
                }
            }
            var totalQty = 0;
            if (o.items) {
                for (var q = 0; q < o.items.length; q++) totalQty += o.items[q].quantity || 0;
            }
            return [
                o.orderId,
                new Date(o.createdAt).toLocaleDateString(),
                buyerName,
                buyerEmail,
                farmerNames.join(', '),
                productNames.join('; '),
                totalQty,
                o.items && o.items.length > 0 ? o.items[0].unitPrice : 0,
                o.totalPrice,
                formatOrderAddress(o.deliveryInfo),
                o.status
            ];
        });
        exportToCsv(headers, rows, 'agriconnect-orders');
    }

    // =====================================
    // DARK MODE
    // =====================================
    function initDarkMode() {
        var saved = localStorage.getItem('adminDarkMode');
        if (saved === 'true') {
            document.body.classList.add('dark-mode');
            updateDarkModeIcon(true);
        }
    }

    function toggleDarkMode() {
        var isDark = document.body.classList.toggle('dark-mode');
        localStorage.setItem('adminDarkMode', isDark);
        updateDarkModeIcon(isDark);
        // Re-render charts with new colors using cached data (no API call needed)
        if (state.lastPayload) {
            renderAllCharts(state.lastPayload);
        }
    }

    function updateDarkModeIcon(isDark) {
        var icon = dom.darkModeToggle.querySelector('i');
        if (icon) {
            icon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        }
    }

    // =====================================
    // NAVIGATION TABS
    // =====================================
    function switchTab(tab) {
        state.activeTab = tab;
        // Update tab buttons
        document.querySelectorAll('.nav-tab').forEach(function (t) {
            var isActive = t.dataset.tab === tab;
            t.classList.toggle('active', isActive);
            t.setAttribute('aria-selected', isActive);
        });
        // Show/hide sections
        dom.dashboardSection.style.display = tab === 'dashboard' ? '' : 'none';
        dom.ordersSection.style.display = tab === 'orders' ? '' : 'none';
        dom.financialSection.style.display = tab === 'financial' ? '' : 'none';
        dom.auditLogsSection.style.display = tab === 'audit-logs' ? '' : 'none';
        // Show/hide search based on tab
        if (tab === 'orders') {
            dom.globalSearch.placeholder = 'Search orders...';
        } else if (tab === 'financial') {
            dom.globalSearch.placeholder = 'Search withdrawals...';
        } else if (tab === 'audit-logs') {
            dom.globalSearch.placeholder = 'Search audit logs...';
        } else {
            dom.globalSearch.placeholder = 'Search users, products...';
        }
        // Load data when switching tabs
        if (tab === 'orders' && state.orders.length === 0) {
            loadOrders();
        }
        if (tab === 'financial' && !state.financialData) {
            loadFinancialData();
        }
    }

    // =====================================
    // SEARCH HANDLER
    // =====================================
    var searchTimeout = null;
    function handleSearch(e) {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(function () {
            state.searchQuery = e.target.value.trim();
            state.usersPage = 1;
            state.productsPage = 1;

            if (state.activeTab === 'orders') {
                state.ordersPage = 1;
                renderOrdersTable();
            } else if (state.activeTab === 'audit-logs') {
                state.auditPage = 1;
                renderAuditLogsTable();
            } else {
                renderUsersTable();
                renderProductsTable();
            }
        }, 200);
    }

    // =====================================
    // REAL-TIME POLLING
    // =====================================
    function startPolling() {
        if (state.pollInterval) clearInterval(state.pollInterval);
        state.pollInterval = setInterval(function () {
            if (document.hidden) return; // Don't poll when tab is hidden
            loadDashboardData();
        }, 30000); // Poll every 30 seconds
    }

    // =====================================
    // HTML ESCAPE UTILITY
    // =====================================
    function escapeHtml(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    // =====================================
    // FINANCIAL DASHBOARD
    // =====================================
    var finCharts = {};

    function loadFinancialData() {
        fetch('/api/admin/financial', { headers: { 'Authorization': 'Bearer ' + token } })
            .then(function (res) {
                if (res.status === 401) { localStorage.removeItem('token'); location.href = '/auth'; return null; }
                if (!res.ok) throw new Error('Failed to load financial data');
                return res.json();
            })
            .then(function (json) {
                if (!json) return;
                state.financialData = json.data || {};
                renderFinancialStats(state.financialData);
                renderFinancialChart(state.financialData.monthlyCommission || []);
                loadWithdrawals();
            })
            .catch(function (err) {
                console.error('loadFinancialData error:', err);
            });
    }

    function renderFinancialStats(data) {
        var stats = data.stats || {};
        var elMap = {
            finPlatformBalance: stats.totalPlatformBalance || 0,
            finTotalCommission: stats.totalCommissionEarned || 0,
            finFarmerBalances: stats.totalFarmerBalance || 0,
            finPendingWithdrawals: stats.pendingWithdrawals || 0,
            finApprovedWithdrawals: stats.approvedWithdrawals || 0,
            finRejectedWithdrawals: stats.rejectedWithdrawals || 0,
            finTotalWithdrawn: stats.totalFarmerWithdrawn || 0,
            finFarmersWithWallets: stats.totalFarmersWithWallets || 0
        };
        Object.keys(elMap).forEach(function (id) {
            var el = document.getElementById(id);
            if (el) {
                el.textContent = Number(elMap[id]).toLocaleString('en-RW') + ' RWF';
            }
        });

        if (data.recentTransactions) {
            renderFinTransactions(data.recentTransactions);
        }
    }

    function renderFinTransactions(transactions) {
        var tbody = dom.finTransactionsTable;
        if (!tbody) return;
        tbody.innerHTML = '';
        if (!transactions || transactions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><span class="empty-state-icon">&#128179;</span><span class="empty-state-text">No transactions yet.</span></div></td></tr>';
            return;
        }
        var fragment = document.createDocumentFragment();
        for (var i = 0; i < transactions.length; i++) {
            var txn = transactions[i];
            var row = document.createElement('tr');
            var isPositive = txn.amount > 0;
            var date = new Date(txn.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
            row.innerHTML =
                '<td><span class="txn-type ' + txn.type + '" style="font-weight:600;font-size:.82rem;text-transform:capitalize;">' + txn.type + '</span></td>' +
                '<td style="text-transform:capitalize;font-size:.82rem;">' + txn.walletType + '</td>' +
                '<td style="font-weight:700;color:' + (isPositive ? '#16a34a' : '#d32f2f') + ';">' + (isPositive ? '+' : '') + Number(txn.amount).toLocaleString('en-RW') + ' RWF</td>' +
                '<td style="font-size:.82rem;">' + Number(txn.balanceBefore).toLocaleString('en-RW') + '</td>' +
                '<td style="font-size:.82rem;">' + Number(txn.balanceAfter).toLocaleString('en-RW') + '</td>' +
                '<td><span style="font-size:.82rem;color:var(--admin-text-muted);">' + escapeHtml(txn.description || '-') + '</span></td>' +
                '<td style="font-size:.82rem;">' + date + '</td>';
            fragment.appendChild(row);
        }
        tbody.appendChild(fragment);
    }

    function renderFinancialChart(monthlyData) {
        if (!monthlyData || monthlyData.length === 0) return;
        if (finCharts.monthly) { finCharts.monthly.destroy(); finCharts.monthly = null; }
        var canvas = document.getElementById('finMonthlyChart');
        if (!canvas) return;
        var labels = monthlyData.map(function (m) {
            return new Date(m._id.year, m._id.month - 1).toLocaleString('default', { month: 'short' });
        });
        var values = monthlyData.map(function (m) { return m.total || 0; });
        var ctx = canvas.getContext('2d');
        var grad = ctx.createLinearGradient(0, 0, 0, 350);
        grad.addColorStop(0, 'rgba(22,163,74,0.25)');
        grad.addColorStop(1, 'rgba(22,163,74,0)');
        finCharts.monthly = new Chart(canvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Commission (RWF)',
                    data: values,
                    borderColor: '#16a34a',
                    backgroundColor: grad,
                    fill: true,
                    tension: 0.4,
                    borderWidth: 2.5,
                    pointRadius: 5,
                    pointHoverRadius: 8,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#16a34a',
                    pointBorderWidth: 2.5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 1200 },
                plugins: { legend: { display: true } },
                scales: {
                    x: { border: { display: false }, grid: { display: false } },
                    y: { beginAtZero: true, border: { display: false }, grid: { color: 'rgba(148,163,184,0.08)' } }
                }
            }
        });
    }

    function loadWithdrawals() {
        fetch('/api/admin/withdrawals', { headers: { 'Authorization': 'Bearer ' + token } })
            .then(function (res) { return res.json(); })
            .then(function (json) {
                state.withdrawals = json.data || [];
                renderWithdrawalsTable();
            })
            .catch(function (err) {
                console.error('loadWithdrawals error:', err);
            });
    }

    function renderWithdrawalsTable() {
        var tbody = dom.withdrawalsTable;
        if (!tbody) return;
        tbody.innerHTML = '';

        var filtered = state.withdrawals.slice();
        if (state.withdrawalStatusFilterVal && state.withdrawalStatusFilterVal !== 'all') {
            filtered = filtered.filter(function (w) { return w.status === state.withdrawalStatusFilterVal; });
        }
        if (state.withdrawalSearchQuery) {
            var q = state.withdrawalSearchQuery.toLowerCase();
            filtered = filtered.filter(function (w) {
                return (w.requestId && w.requestId.toLowerCase().indexOf(q) !== -1) ||
                       (w.farmerId && w.farmerId.name && w.farmerId.name.toLowerCase().indexOf(q) !== -1) ||
                       (w.farmerId && w.farmerId.email && w.farmerId.email.toLowerCase().indexOf(q) !== -1);
            });
        }

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><span class="empty-state-icon">&#128176;</span><span class="empty-state-text">No withdrawal requests found.</span></div></td></tr>';
            return;
        }

        var fragment = document.createDocumentFragment();
        for (var i = 0; i < filtered.length; i++) {
            var w = filtered[i];
            var row = document.createElement('tr');
            var date = new Date(w.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
            var farmerName = w.farmerId ? w.farmerId.name : 'Unknown';
            var statusClass = 'order-status-badge ' + w.status;
            var actionHtml = '';
            if (w.status === 'pending') {
                actionHtml = '<button class="orders-view-btn" style="background:#16a34a!important;margin-right:4px;" data-action="approve" data-request-id="' + w.requestId + '"><i class="fa-solid fa-check"></i></button>' +
                    '<button class="orders-view-btn" style="background:#d32f2f!important;" data-action="reject" data-request-id="' + w.requestId + '"><i class="fa-solid fa-xmark"></i></button>';
            } else {
                actionHtml = '<span style="font-size:.82rem;color:var(--admin-text-muted);">Processed</span>';
            }

            row.innerHTML =
                '<td><strong style="font-size:.82rem;">' + escapeHtml(w.requestId) + '</strong></td>' +
                '<td>' + escapeHtml(farmerName) + '</td>' +
                '<td style="font-weight:700;">' + Number(w.amount).toLocaleString('en-RW') + ' RWF</td>' +
                '<td>' + escapeHtml(w.payoutMethod) + '</td>' +
                '<td><span class="' + statusClass + '">' + w.status.charAt(0).toUpperCase() + w.status.slice(1) + '</span></td>' +
                '<td><span style="font-size:.82rem;color:var(--admin-text-muted);">' + escapeHtml(w.adminNote || '-') + '</span></td>' +
                '<td style="font-size:.82rem;">' + date + '</td>' +
                '<td>' + actionHtml + '</td>';

            fragment.appendChild(row);
        }
        tbody.appendChild(fragment);

        var approveBtns = tbody.querySelectorAll('[data-action="approve"]');
        var rejectBtns = tbody.querySelectorAll('[data-action="reject"]');
        approveBtns.forEach(function(btn) {
            btn.addEventListener('click', function() { adminApproveWithdrawal(this.getAttribute('data-request-id')); });
        });
        rejectBtns.forEach(function(btn) {
            btn.addEventListener('click', function() { adminRejectWithdrawal(this.getAttribute('data-request-id')); });
        });
    }

    window.adminApproveWithdrawal = function (requestId) {
        var note = prompt('Admin note (optional):');
        if (note === null) return;
        fetch('/api/admin/withdrawals/' + requestId + '/approve', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({ adminNote: note })
        })
        .then(function (res) { return res.json(); })
        .then(function (json) {
            if (!json.success) throw new Error(json.error || 'Failed');
            showToast('Withdrawal approved!', 'success');
            loadWithdrawals();
            loadFinancialData();
        })
        .catch(function (err) { showToast(err.message, 'error'); });
    };

    window.adminRejectWithdrawal = function (requestId) {
        var note = prompt('Rejection reason:');
        if (note === null) return;
        if (!note) { showToast('Please provide a reason.', 'warning'); return; }
        fetch('/api/admin/withdrawals/' + requestId + '/reject', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({ adminNote: note })
        })
        .then(function (res) { return res.json(); })
        .then(function (json) {
            if (!json.success) throw new Error(json.error || 'Failed');
            showToast('Withdrawal rejected.', 'warning');
            loadWithdrawals();
            loadFinancialData();
        })
        .catch(function (err) { showToast(err.message, 'error'); });
    };

    // =====================================
    // INITIALIZATION
    // =====================================
    function init() {
        // Dark mode
        initDarkMode();
        dom.darkModeToggle.addEventListener('click', toggleDarkMode);

        // Navigation tabs
        document.querySelectorAll('.nav-tab').forEach(function (tab) {
            tab.addEventListener('click', function () {
                switchTab(this.dataset.tab);
            });
        });

        // Search
        dom.globalSearch.addEventListener('input', handleSearch);

        // Filter listeners
        dom.userRoleFilter.addEventListener('change', function () {
            state.userRoleFilter = this.value;
            state.usersPage = 1;
            renderUsersTable();
        });
        dom.userVerifiedFilter.addEventListener('change', function () {
            state.userVerifiedFilter = this.value;
            state.usersPage = 1;
            renderUsersTable();
        });
        dom.userSuspendedFilter.addEventListener('change', function () {
            state.userSuspendedFilter = this.value;
            state.usersPage = 1;
            renderUsersTable();
        });
        dom.productStatusFilter.addEventListener('change', function () {
            state.productStatusFilter = this.value;
            state.productsPage = 1;
            renderProductsTable();
        });
        dom.productCategoryFilter.addEventListener('change', function () {
            state.productCategoryFilter = this.value;
            state.productsPage = 1;
            renderProductsTable();
        });

        // Audit search
        if (dom.auditSearch) {
            dom.auditSearch.addEventListener('input', function () {
                state.auditPage = 1;
                renderAuditLogsTable();
            });
        }
        if (dom.auditActionFilter) {
            dom.auditActionFilter.addEventListener('change', function () {
                state.auditActionFilter = this.value;
                state.auditPage = 1;
                renderAuditLogsTable();
            });
        }

        // Export buttons
        document.getElementById('exportUsersCsv').addEventListener('click', function () { exportUsers('csv'); });
        document.getElementById('exportUsersExcel').addEventListener('click', function () { exportUsers('excel'); });
        document.getElementById('exportProductsCsv').addEventListener('click', function () { exportProducts('csv'); });
        document.getElementById('exportProductsExcel').addEventListener('click', function () { exportProducts('excel'); });
        document.getElementById('exportOrdersCsv').addEventListener('click', function () { exportOrders(); });

        // Order status filter
        dom.orderStatusFilter.addEventListener('change', function () {
            state.orderStatusFilter = this.value;
            state.ordersPage = 1;
            renderOrdersTable();
        });

        // Withdrawal filters
        if (dom.withdrawalSearch) {
            dom.withdrawalSearch.addEventListener('input', function () {
                state.withdrawalSearchQuery = this.value.trim();
                renderWithdrawalsTable();
            });
        }
        if (dom.withdrawalStatusFilter) {
            dom.withdrawalStatusFilter.addEventListener('change', function () {
                state.withdrawalStatusFilterVal = this.value;
                renderWithdrawalsTable();
            });
        }

        // Order search
        if (dom.orderSearch) {
            dom.orderSearch.addEventListener('input', function () {
                state.searchQuery = this.value.trim();
                state.ordersPage = 1;
                renderOrdersTable();
            });
        }

        // Order modal close
        dom.closeOrderModal.addEventListener('click', closeOrderModalFn);
        window.addEventListener('click', function (e) {
            if (e.target === dom.orderModal) closeOrderModalFn();
        });

        // Modal close
        dom.closeModal.addEventListener('click', closeModal);
        window.addEventListener('click', function (e) {
            if (e.target === dom.userModal) closeModal();
        });
        dom.closeModal.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); closeModal(); }
        });

        // Save role
        dom.saveRoleBtn.addEventListener('click', async function () {
            var userId = dom.saveRoleBtn.dataset.id;
            if (state.adminId && String(userId) === state.adminId) {
                showToast('You cannot change your own role.', 'error');
                return;
            }
            var role = dom.editRole.value;
            try {
                var response = await fetch('/api/admin/users/' + userId, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
                    body: JSON.stringify({ role: role })
                });
                var result = await response.json();
                if (!response.ok) throw new Error(result.error || 'Failed to update user.');
                closeModal();
                var foundUser = state.users.find(function (u) { return String(u._id) === String(userId); });
                recordAuditLog('Role Changed', foundUser ? foundUser.name : userId, 'New role: ' + role);
                showToast('User updated successfully.', 'success');
                showLoadingSkeletons();
                loadDashboardData();
                loadAuditLogs();
            } catch (err) {
                showToast(err.message, 'error');
            }
        });

        // Logout
        if (dom.logoutBtn) dom.logoutBtn.addEventListener('click', function () {
            localStorage.removeItem('token');
            location.href = '/auth';
        });

        // Keyboard: Escape closes modal
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && dom.userModal.style.display === 'flex') {
                closeModal();
            }
            if (e.key === 'Escape' && dom.orderModal.style.display === 'flex') {
                closeOrderModalFn();
            }
        });

        // Initial load (dashboard + audit logs in parallel)
        showLoadingSkeletons();
        Promise.all([loadDashboardData(), loadAuditLogs()]);
        startPolling();
    }

    function closeModal() {
        dom.userModal.classList.add('modal-closing');
        setTimeout(function () {
            dom.userModal.style.display = 'none';
            dom.userModal.classList.remove('modal-closing');
            document.getElementById('modalTitle').textContent = 'User Details';
        }, 200);
    }

    // =====================================
    // ADMIN NOTIFICATIONS DROPDOWN
    // =====================================
    function initAdminNotifications() {
        var notifBtn = document.getElementById('adminNotifBtn');
        var notifDropdown = document.getElementById('adminNotifDropdown');
        var notifBadge = document.getElementById('adminNotifBadge');
        var notifList = document.getElementById('adminNotifList');
        var markAllBtn = document.getElementById('adminNotifMarkAll');
        if (!notifBtn || !notifDropdown) return;

        var notifOpen = false;
        notifBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            notifOpen = !notifOpen;
            notifDropdown.style.display = notifOpen ? 'block' : 'none';
            if (notifOpen) loadAdminNotifications();
        });
        document.addEventListener('click', function (e) {
            if (!notifDropdown.contains(e.target) && e.target !== notifBtn && !notifBtn.contains(e.target)) {
                notifDropdown.style.display = 'none';
                notifOpen = false;
            }
        });

        if (markAllBtn) {
            markAllBtn.addEventListener('click', async function () {
                try {
                    await fetch('/api/notifications/read-all', {
                        method: 'PUT',
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    loadAdminNotifications();
                } catch (e) { /* silent */ }
            });
        }

        async function loadAdminNotifications() {
            try {
                var res = await fetch('/api/notifications?limit=20', {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (!res.ok) return;
                var data = await res.json();
                var notifications = data.data || data.notifications || data || [];
                if (!Array.isArray(notifications)) return;

                var unreadCount = notifications.filter(function (n) { return !n.read; }).length;
                if (notifBadge) {
                    notifBadge.style.display = unreadCount > 0 ? 'block' : 'none';
                    notifBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                }

                if (notifications.length === 0) {
                    notifList.innerHTML = '<div style="text-align:center;padding:24px;color:var(--admin-text-muted);font-size:.85rem;"><i class="fa-solid fa-bell-slash" style="font-size:1.5rem;margin-bottom:8px;display:block;opacity:.4;"></i>No notifications yet.</div>';
                    return;
                }

                var typeIcons = {
                    'order_submitted': { icon: 'fa-receipt', bg: 'rgba(21,101,192,.10)', color: '#1565c0' },
                    'payment_received': { icon: 'fa-money-bill', bg: 'rgba(22,163,74,.10)', color: '#16a34a' },
                    'order_delivered': { icon: 'fa-truck', bg: 'rgba(142,68,173,.10)', color: '#8e44ad' },
                    'order_accepted': { icon: 'fa-check-circle', bg: 'rgba(22,163,74,.10)', color: '#16a34a' },
                    'order_rejected': { icon: 'fa-times-circle', bg: 'rgba(211,47,47,.10)', color: '#d32f2f' },
                    'order_completed': { icon: 'fa-flag-checkered', bg: 'rgba(46,125,50,.10)', color: '#2e7d32' },
                    'withdrawal_approved': { icon: 'fa-hand-holding-dollar', bg: 'rgba(22,163,74,.10)', color: '#16a34a' },
                    'withdrawal_rejected': { icon: 'fa-ban', bg: 'rgba(211,47,47,.10)', color: '#d32f2f' },
                    'low_stock': { icon: 'fa-box', bg: 'rgba(234,88,12,.10)', color: '#ea580c' },
                    'out_of_stock': { icon: 'fa-box', bg: 'rgba(211,47,47,.10)', color: '#d32f2f' }
                };

                notifList.innerHTML = '';
                for (var i = 0; i < Math.min(notifications.length, 20); i++) {
                    var n = notifications[i];
                    var typeInfo = typeIcons[n.type] || { icon: 'fa-bell', bg: 'rgba(148,163,184,.10)', color: '#64748b' };
                    var timeAgo = getTimeAgo(n.createdAt);
                    var item = document.createElement('div');
                    item.className = 'admin-notif-item' + (n.read ? '' : ' unread');
                    item.innerHTML =
                        '<div class="notif-icon" style="background:' + typeInfo.bg + ';color:' + typeInfo.color + ';"><i class="fa-solid ' + typeInfo.icon + '"></i></div>' +
                        '<div class="notif-content">' +
                            '<p class="notif-text">' + escapeHtml(n.message || n.title || n.type || 'Notification') + '</p>' +
                            '<p class="notif-time">' + timeAgo + '</p>' +
                        '</div>';
                    notifList.appendChild(item);
                }
            } catch (e) {
                console.error('loadAdminNotifications error:', e);
            }
        }

        function getTimeAgo(dateStr) {
            if (!dateStr) return '';
            var diff = Date.now() - new Date(dateStr).getTime();
            var mins = Math.floor(diff / 60000);
            if (mins < 1) return 'Just now';
            if (mins < 60) return mins + 'm ago';
            var hours = Math.floor(mins / 60);
            if (hours < 24) return hours + 'h ago';
            var days = Math.floor(hours / 24);
            if (days < 7) return days + 'd ago';
            return new Date(dateStr).toLocaleDateString();
        }

        loadAdminNotifications();
        setInterval(function () {
            if (!document.hidden) loadAdminNotifications();
        }, 30000);
    }

    // Start
    init();
    initAdminNotifications();

})();

(function() {
    var dd = document.getElementById('profileDropdown');
    var trigger = document.getElementById('profileTrigger');
    var navLogout = document.getElementById('navLogoutBtn');
    var avatarEl = document.getElementById('navProfileAvatar');
    var nameEl = document.getElementById('navProfileName');
    var token = localStorage.getItem('token');

    if (trigger && dd) {
        trigger.addEventListener('click', function(e) {
            e.stopPropagation();
            dd.classList.toggle('open');
            trigger.setAttribute('aria-expanded', dd.classList.contains('open'));
        });

        document.addEventListener('click', function(e) {
            if (!dd.contains(e.target)) {
                dd.classList.remove('open');
                trigger.setAttribute('aria-expanded', 'false');
            }
        });
    }

    if (navLogout) {
        navLogout.addEventListener('click', function() { localStorage.removeItem('token'); window.location.href = '/auth'; });
    }

    if (token) {
        fetch('/api/auth/me', { headers: { 'Authorization': 'Bearer ' + token } })
            .then(function(r) { return r.json(); })
            .then(function(d) {
                var u = d.user || d;
                if (nameEl) nameEl.textContent = u.name || 'Account';
                if (avatarEl && u.avatar) {
                    avatarEl.innerHTML = '<img src="' + u.avatar + '" alt="Avatar">';
                }
            })
            .catch(function() {});
    }
})();
