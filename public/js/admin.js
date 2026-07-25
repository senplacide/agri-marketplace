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
        lastPayload: null
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
        orderModal: document.getElementById('orderModal'),
        closeOrderModal: document.getElementById('closeOrderModal'),
        orderDetailsBody: document.getElementById('orderDetailsBody')
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
        var cardIds = ['usersCount', 'productsCount', 'farmersCount', 'buyersCount'];
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
                dom.userDetails.innerHTML =
                    '<p><strong>Name:</strong> ' + escapeHtml(user.name) + '</p>' +
                    '<p><strong>Email:</strong> ' + escapeHtml(user.email) + '</p>' +
                    '<p><strong>Role:</strong> ' + user.role + '</p>' +
                    '<p><strong>Verified:</strong> ' + (user.isVerified ? '\u2705 Verified' : '\u274C Pending') + '</p>' +
                    '<p><strong>Created:</strong> ' + new Date(user.createdAt).toLocaleString() + '</p>';
                dom.userModal.style.display = 'flex';
            });

            row.querySelector('.editUserBtn').addEventListener('click', function () {
                if (isSelf) {
                    showToast('You cannot change your own role.', 'error');
                    return;
                }
                dom.userDetails.innerHTML =
                    '<p><strong>Name:</strong> ' + escapeHtml(user.name) + '</p>' +
                    '<p><strong>Email:</strong> ' + escapeHtml(user.email) + '</p>';
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
            dom.productsTable.innerHTML = '<tr><td colspan="6"><div class="empty-state"><span class="empty-state-icon">\uD83D\uDCE6</span><span class="empty-state-text">No products match your search or filters.</span></div></td></tr>';
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

            row.innerHTML =
                '<td>' + escapeHtml(product.name) + '</td>' +
                '<td>' + escapeHtml(product.category) + '</td>' +
                '<td>' + product.price + '</td>' +
                '<td>' + escapeHtml(ownerName) + '</td>' +
                '<td>' + statusText + '</td>' +
                '<td>' +
                    '<button class="approveProductBtn" style="background:#2e7d32;color:white;border:none;padding:6px 10px;border-radius:6px;cursor:pointer;margin-right:5px;">\u2705 Approve</button>' +
                    '<button class="rejectProductBtn" style="background:#f39c12;color:white;border:none;padding:6px 10px;border-radius:6px;cursor:pointer;margin-right:5px;">\u274C Reject</button>' +
                    '<button class="deleteProductBtn" data-id="' + product._id + '" style="background:#dc3545;color:white;border:none;padding:6px 10px;border-radius:6px;cursor:pointer;">\uD83D\uDDD1 Delete</button>' +
                '</td>';

            fragment.appendChild(row);

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
            var newHash = JSON.stringify(stats.totalUsers) + JSON.stringify(stats.totalProducts) + JSON.stringify(stats.farmers) + JSON.stringify(stats.buyers);
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
        var filtered = state.auditLogs.filter(function (log) {
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
                '<td>' + formatOrderPrice(unitPrice) + ' RWF</td>' +
                '<td><strong>' + formatOrderPrice(order.totalPrice) + ' RWF</strong></td>' +
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
                html += '<p class="order-detail-product-meta">Qty: ' + (item.quantity || 1) + ' &middot; ' + formatOrderPrice(item.unitPrice) + ' RWF/unit</p>';
                html += '</div>';
                html += '<div class="order-detail-product-price">';
                html += '<p class="order-detail-product-price-value">' + formatOrderPrice(item.lineTotal || (item.unitPrice * item.quantity)) + ' RWF</p>';
                html += '<p class="order-detail-product-price-label">Subtotal</p>';
                html += '</div>';
                html += '</div>';
            }
        }
        html += '<div class="order-detail-total"><span class="order-detail-total-label">Order Total</span><span class="order-detail-total-value">' + formatOrderPrice(order.totalPrice) + ' RWF</span></div>';
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
        var headers = ['Product', 'Category', 'Price', 'Owner', 'Status', 'Created'];
        var rows = filtered.map(function (p) {
            return [p.name, p.category, p.price, p.owner ? p.owner.name : 'Unknown', p.status, new Date(p.createdAt).toLocaleDateString()];
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
        dom.auditLogsSection.style.display = tab === 'audit-logs' ? '' : 'none';
        // Show/hide search based on tab
        if (tab === 'orders') {
            dom.globalSearch.placeholder = 'Search orders...';
        } else if (tab === 'audit-logs') {
            dom.globalSearch.placeholder = 'Search audit logs...';
        } else {
            dom.globalSearch.placeholder = 'Search users, products...';
        }
        // Load orders when switching to orders tab
        if (tab === 'orders' && state.orders.length === 0) {
            loadOrders();
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
        }, 200);
    }

    // Start
    init();

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
