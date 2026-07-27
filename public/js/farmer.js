// =====================================================
// AgriConnect Farmer Dashboard - Production JS
// =====================================================
// Features: Auth, Dashboard, Charts, Recent Products,
// Dark Mode, Toasts, Skeletons, Responsive
// =====================================================

(function () {
    'use strict';

    // =====================================
    // STATE
    // =====================================
    var token = localStorage.getItem('token');
    if (!token) { location.href = '/auth'; return; }

    // Role guard: verify user is a farmer
    (async function () {
        try {
            var res = await fetch('/api/auth/me', { headers: { Authorization: 'Bearer ' + token } });
            if (!res.ok) { localStorage.removeItem('token'); location.href = '/auth'; return; }
            var json = await res.json();
            var user = json.user || json;
            if (user.role !== 'farmer') {
                if (user.role === 'admin') { location.href = '/admin.html'; }
                else if (user.role === 'buyer') { location.href = '/buyer-dashboard'; }
                else { location.href = '/dashboard'; }
                return;
            }
        } catch (e) {
            localStorage.removeItem('token');
            location.href = '/auth';
            return;
        }
    })();

    var state = {
        products: [],
        filteredProducts: [],
        dashboardLoaded: false,
        lastPayload: null,
        searchQuery: '',
        filterCategory: '',
        filterStatus: '',
        currentPage: 1,
        perPage: 8,
        orders: [],
        ordersLoaded: false
    };

    // =====================================
    // DOM REFERENCES
    // =====================================
    var dom = {
        welcomeMessage: document.getElementById('welcomeMessage'),
        welcomeSubtext: document.getElementById('welcomeSubtext'),
        totalProductsCount: document.getElementById('totalProductsCount'),
        approvedProductsCount: document.getElementById('approvedProductsCount'),
        pendingProductsCount: document.getElementById('pendingProductsCount'),
        rejectedProductsCount: document.getElementById('rejectedProductsCount'),
        recentProductsTable: document.getElementById('recentProductsTable'),
        recentOrdersTable: document.getElementById('recentOrdersTable'),
        ordersCount: document.getElementById('ordersCount'),
        darkModeToggle: document.getElementById('darkModeToggle'),
        logoutBtn: document.getElementById('logoutBtn'),
        productsSearchInput: document.getElementById('productsSearchInput'),
        productsCount: document.getElementById('productsCount'),
        paginationWrapper: document.getElementById('paginationWrapper'),
        viewModal: document.getElementById('viewModal'),
        editModal: document.getElementById('editModal'),
        deleteModal: document.getElementById('deleteModal'),
        categoryFilter: document.getElementById('categoryFilter'),
        statusFilter: document.getElementById('statusFilter'),
        addProductBtn: document.getElementById('addProductBtn'),
        addModal: document.getElementById('addModal'),
        pendingOrdersCount: document.getElementById('pendingOrdersCount'),
        approvedOrdersCount: document.getElementById('approvedOrdersCount'),
        completedOrdersCount: document.getElementById('completedOrdersCount'),
        totalSalesCount: document.getElementById('totalSalesCount'),
        estimatedEarningsCount: document.getElementById('estimatedEarningsCount'),
        walletBalanceCount: document.getElementById('walletBalanceCount'),
        avgOrderValueCount: document.getElementById('avgOrderValueCount'),
        netEarningsCount: document.getElementById('netEarningsCount'),
        platformCommissionCount: document.getElementById('platformCommissionCount'),
        pendingPaymentsCount: document.getElementById('pendingPaymentsCount'),
        walletBalanceEarnings: document.getElementById('walletBalanceEarnings')
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
        var cardIds = ['totalProductsCount', 'approvedProductsCount', 'pendingProductsCount', 'rejectedProductsCount'];
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

        if (dom.recentProductsTable) {
            dom.recentProductsTable.innerHTML = '';
            for (var k = 0; k < 5; k++) {
                var row = document.createElement('tr');
                var cells = '';
                for (var j2 = 0; j2 < 8; j2++) {
                    cells += '<td><span class="skeleton-box skeleton-text" style="width:' + (50 + Math.random() * 40) + '%;display:block;height:14px;"></span></td>';
                }
                row.innerHTML = cells;
                dom.recentProductsTable.appendChild(row);
            }
            if (dom.productsCount) dom.productsCount.textContent = '';
            if (dom.paginationWrapper) dom.paginationWrapper.innerHTML = '';
        }
    }

    function removeChartOverlays() {
        document.querySelectorAll('.chart-loading-overlay').forEach(function (overlay) {
            overlay.classList.add('fade-out');
            setTimeout(function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 350);
        });
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
    // DARK MODE
    // =====================================
    function isDarkMode() {
        return document.body.classList.contains('dark-mode');
    }

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
        // Re-render charts with new colors using cached data (no API call needed)
        if (state.dashboardLoaded && state.lastPayload) {
            renderCharts(state.lastPayload);
        }
    }

    function updateDarkModeIcon(isDark) {
        var icon = dom.darkModeToggle.querySelector('i');
        if (icon) {
            icon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        }
    }

    // =====================================
    // CHART COLOR HELPERS
    // =====================================
    function chartTextColor() { return '#94a3b8'; }
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

    // =====================================
    // DESTROY CHARTS
    // =====================================
    function destroyAllCharts() {
        Object.keys(charts).forEach(function (key) {
            if (charts[key] && typeof charts[key].destroy === 'function') {
                charts[key].destroy();
            }
            charts[key] = null;
        });
    }

    // =====================================
    // RENDER CHARTS
    // =====================================
    function renderCharts(data) {
        destroyAllCharts();
        var productsPerMonth = data.productsPerMonth || [];
        var productsByCategory = data.productsByCategory || [];

        // Products Per Month Line Chart
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
                        label: 'Products Added',
                        data: monthCounts,
                        borderColor: '#16a34a',
                        backgroundColor: lineGrad,
                        fill: true,
                        tension: 0.4,
                        borderWidth: 2.5,
                        pointRadius: 5,
                        pointHoverRadius: 8,
                        pointBackgroundColor: '#ffffff',
                        pointBorderColor: '#16a34a',
                        pointBorderWidth: 2.5,
                        pointHoverBackgroundColor: '#16a34a',
                        pointHoverBorderColor: '#ffffff',
                        pointHoverBorderWidth: 2.5
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
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

        // Products by Category Bar Chart
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
                    datasets: [{
                        label: 'Products',
                        data: categoryCounts,
                        backgroundColor: categoryGrad,
                        borderRadius: 8,
                        borderSkipped: false,
                        maxBarThickness: 56
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
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

        // Empty state for charts
        var totalMonthly = productsPerMonth.reduce(function (sum, m) { return sum + m.count; }, 0);
        if (totalMonthly === 0) showChartEmptyState('productsLineChart');
        if (productsByCategory.length === 0) showChartEmptyState('categoryChart');

        removeChartOverlays();
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
            card.insertAdjacentHTML('beforeend', '<div class="empty-state"><span class="empty-state-icon">\uD83D\uDCCA</span><span class="empty-state-text">No analytics available yet.</span></div>');
        }
    }

    // =====================================
    // RENDER RECENT PRODUCTS TABLE
    // =====================================
    function renderQuantityCell(quantity) {
        if (quantity === undefined || quantity === null) return '<span class="quantity-cell">\u2014</span>';
        var qty = parseInt(quantity) || 0;
        if (qty === 0) {
            return '<span class="stock-badge out-of-stock"><i class="fa-solid fa-circle-xmark"></i> Out of Stock</span>';
        } else if (qty < 10) {
            return '<span class="stock-badge low-stock"><i class="fa-solid fa-triangle-exclamation"></i> Low (' + qty + ')</span>';
        }
        return '<span class="stock-badge in-stock"><i class="fa-solid fa-check-circle"></i> ' + qty + '</span>';
    }

    function renderRecentProducts(products) {
        dom.recentProductsTable.innerHTML = '';

        if (!products || products.length === 0) {
            dom.recentProductsTable.innerHTML = '<tr><td colspan="8"><div class="add-empty-state"><span class="add-empty-state-icon">\uD83D\uDCE6</span><p class="add-empty-state-title">No products yet</p><p class="add-empty-state-text">Start selling by adding your first product.</p><button class="add-product-btn"><i class="fa-solid fa-plus"></i> Add Product</button></div></td></tr>';
            dom.productsCount.textContent = '';
            dom.paginationWrapper.innerHTML = '';
            var emptyAddBtn = dom.recentProductsTable.querySelector('.add-empty-state .add-product-btn');
            if (emptyAddBtn) {
                emptyAddBtn.addEventListener('click', function () {
                    openAddModal();
                });
            }
            return;
        }

        var filtered = filterProducts(products, state.searchQuery, state.filterCategory, state.filterStatus);
        state.filteredProducts = filtered;

        var totalFiltered = filtered.length;
        var totalPages = Math.max(1, Math.ceil(totalFiltered / state.perPage));
        if (state.currentPage > totalPages) state.currentPage = totalPages;

        var start = (state.currentPage - 1) * state.perPage;
        var pageProducts = filtered.slice(start, start + state.perPage);

        dom.productsCount.textContent = 'Showing ' + (totalFiltered === 0 ? 0 : start + 1) + '\u2013' + Math.min(start + state.perPage, totalFiltered) + ' of ' + totalFiltered + ' product' + (totalFiltered !== 1 ? 's' : '');

        if (pageProducts.length === 0) {
            dom.recentProductsTable.innerHTML = '<tr><td colspan="8"><div class="empty-state"><span class="empty-state-icon">\uD83D\uDD0D</span><span class="empty-state-text">No products match your filters.</span></div></td></tr>';
            dom.paginationWrapper.innerHTML = '';
            return;
        }

        var fragment = document.createDocumentFragment();
        for (var i = 0; i < pageProducts.length; i++) {
            var product = pageProducts[i];
            var row = document.createElement('tr');
            row.style.animationDelay = (i * 0.04) + 's';
            var statusEmoji = product.status === 'approved' ? '\uD83D\uDFE2 ' : product.status === 'pending' ? '\uD83D\uDFE1 ' : '\uD83D\uDD34 ';
            var statusClass = 'status-' + product.status;
            var statusLabel = product.status.charAt(0).toUpperCase() + product.status.slice(1);
            var date = new Date(product.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

            var imageHtml = '';
            if (product.imageUrl) {
                imageHtml = '<img src="' + escapeHtml(product.imageUrl) + '" alt="" class="product-image-cell" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'"><div class="product-image-placeholder" style="display:none"><i class="fa-solid fa-image"></i></div>';
            } else {
                imageHtml = '<div class="product-image-placeholder"><i class="fa-solid fa-box-open"></i></div>';
            }

            row.innerHTML =
                '<td>' + imageHtml + '</td>' +
                '<td><strong>' + escapeHtml(product.name) + '</strong></td>' +
                '<td>' + escapeHtml(product.category) + '</td>' +
                '<td><div class="farmer-price-cell">' + PriceFormatter.formatDual(product.price) + '</div></td>' +
                '<td>' + renderQuantityCell(product.quantity) + '</td>' +
                '<td><span class="status-badge ' + statusClass + '">' + statusEmoji + statusLabel + '</span></td>' +
                '<td>' + date + '</td>' +
                '<td><div class="action-btns">' +
                    '<button class="action-btn view" data-tooltip="View" data-id="' + product._id + '"><i class="fa-solid fa-eye"></i></button>' +
                    '<button class="action-btn edit" data-tooltip="Edit" data-id="' + product._id + '"><i class="fa-solid fa-pen"></i></button>' +
                    '<button class="action-btn delete" data-tooltip="Delete" data-id="' + product._id + '"><i class="fa-solid fa-trash"></i></button>' +
                '</div></td>';

            fragment.appendChild(row);
        }

        dom.recentProductsTable.appendChild(fragment);

        renderPagination(totalPages);
        attachActionListeners();
    }

    function filterProducts(products, query, category, status) {
        var result = products.slice();

        if (query && query.trim() !== '') {
            var q = query.toLowerCase().trim();
            result = result.filter(function (p) {
                return (p.name && p.name.toLowerCase().indexOf(q) !== -1) ||
                       (p.category && p.category.toLowerCase().indexOf(q) !== -1) ||
                       (p.status && p.status.toLowerCase().indexOf(q) !== -1) ||
                       ('' + p.price).indexOf(q) !== -1;
            });
        }

        if (category) {
            result = result.filter(function (p) { return p.category === category; });
        }

        if (status) {
            result = result.filter(function (p) { return p.status === status; });
        }

        return result;
    }

    // =====================================
    // PAGINATION
    // =====================================
    function renderPagination(totalPages) {
        dom.paginationWrapper.innerHTML = '';
        if (totalPages <= 1) return;

        var fragment = document.createDocumentFragment();

        var prevBtn = document.createElement('button');
        prevBtn.className = 'pagination-btn';
        prevBtn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
        prevBtn.disabled = state.currentPage === 1;
        prevBtn.addEventListener('click', function () {
            if (state.currentPage > 1) { state.currentPage--; renderRecentProducts(state.products); }
        });
        fragment.appendChild(prevBtn);

        var maxVisible = 5;
        var startPage = Math.max(1, state.currentPage - Math.floor(maxVisible / 2));
        var endPage = Math.min(totalPages, startPage + maxVisible - 1);
        if (endPage - startPage < maxVisible - 1) startPage = Math.max(1, endPage - maxVisible + 1);

        if (startPage > 1) {
            fragment.appendChild(createPageBtn(1));
            if (startPage > 2) {
                var dots = document.createElement('span');
                dots.textContent = '\u2026';
                dots.style.cssText = 'padding:0 6px;color:var(--fd-text-muted);font-size:.85rem;';
                fragment.appendChild(dots);
            }
        }

        for (var i = startPage; i <= endPage; i++) {
            fragment.appendChild(createPageBtn(i));
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                var dots2 = document.createElement('span');
                dots2.textContent = '\u2026';
                dots2.style.cssText = 'padding:0 6px;color:var(--fd-text-muted);font-size:.85rem;';
                fragment.appendChild(dots2);
            }
            fragment.appendChild(createPageBtn(totalPages));
        }

        var nextBtn = document.createElement('button');
        nextBtn.className = 'pagination-btn';
        nextBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
        nextBtn.disabled = state.currentPage === totalPages;
        nextBtn.addEventListener('click', function () {
            if (state.currentPage < totalPages) { state.currentPage++; renderRecentProducts(state.products); }
        });
        fragment.appendChild(nextBtn);

        dom.paginationWrapper.appendChild(fragment);
    }

    function createPageBtn(page) {
        var btn = document.createElement('button');
        btn.className = 'pagination-btn' + (page === state.currentPage ? ' active' : '');
        btn.textContent = page;
        btn.addEventListener('click', function () {
            state.currentPage = page;
            renderRecentProducts(state.products);
        });
        return btn;
    }

    // =====================================
    // SEARCH
    // =====================================
    function handleSearch() {
        state.searchQuery = dom.productsSearchInput.value || '';
        state.currentPage = 1;
        renderRecentProducts(state.products);
    }

    function handleCategoryFilter() {
        state.filterCategory = dom.categoryFilter.value || '';
        state.currentPage = 1;
        renderRecentProducts(state.products);
    }

    function handleStatusFilter() {
        state.filterStatus = dom.statusFilter.value || '';
        state.currentPage = 1;
        renderRecentProducts(state.products);
    }

    // =====================================
    // ACTION HANDLERS
    // =====================================
    function attachActionListeners() {
        dom.recentProductsTable.querySelectorAll('.action-btn.view').forEach(function (btn) {
            btn.addEventListener('click', function () { openViewModal(btn.dataset.id); });
        });
        dom.recentProductsTable.querySelectorAll('.action-btn.edit').forEach(function (btn) {
            btn.addEventListener('click', function () { openEditModal(btn.dataset.id); });
        });
        dom.recentProductsTable.querySelectorAll('.action-btn.delete').forEach(function (btn) {
            btn.addEventListener('click', function () { openDeleteModal(btn.dataset.id); });
        });
    }

    function findProduct(id) {
        return state.products.find(function (p) { return p._id === id; });
    }

    // =====================================
    // VIEW MODAL
    // =====================================
    function openViewModal(productId) {
        var product = findProduct(productId);
        if (!product) return;

        var statusEmoji = product.status === 'approved' ? '\uD83D\uDFE2' : product.status === 'pending' ? '\uD83D\uDFE1' : '\uD83D\uDD34';
        var statusLabel = product.status.charAt(0).toUpperCase() + product.status.slice(1);
        var date = new Date(product.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

        var imgHtml = '';
        if (product.imageUrl) {
            imgHtml = '<img src="' + escapeHtml(product.imageUrl) + '" alt="" class="modal-product-img" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'"><div class="modal-product-img-placeholder" style="display:none"><i class="fa-solid fa-image"></i> Image not available</div>';
        } else {
            imgHtml = '<div class="modal-product-img-placeholder"><i class="fa-solid fa-box-open" style="font-size:1.5rem;margin-right:8px;"></i> No image uploaded</div>';
        }

        dom.viewModal.innerHTML =
            '<div class="modal">' +
                '<div class="modal-header">' +
                    '<h3><i class="fa-solid fa-eye" style="color:var(--fd-green);margin-right:8px;font-size:.95rem;"></i>Product Details</h3>' +
                    '<button class="modal-close" onclick="closeModal(\'viewModal\')"><i class="fa-solid fa-xmark"></i></button>' +
                '</div>' +
                '<div class="modal-body">' +
                    imgHtml +
                    '<div class="modal-field"><span class="modal-field-label">Name</span><span class="modal-field-value"><strong>' + escapeHtml(product.name) + '</strong></span></div>' +
                    '<div class="modal-field"><span class="modal-field-label">Category</span><span class="modal-field-value">' + escapeHtml(product.category) + '</span></div>' +
                    '<div class="modal-field"><span class="modal-field-label">Price</span><span class="modal-field-value"><div class="price-dual">' + PriceFormatter.formatDual(product.price) + '</div></span></div>' +
                    '<div class="modal-field"><span class="modal-field-label">Stock</span><span class="modal-field-value">' + renderQuantityCell(product.quantity) + '</span></div>' +
                    '<div class="modal-field"><span class="modal-field-label">Status</span><span class="modal-field-value"><span class="status-badge status-' + product.status + '">' + statusEmoji + ' ' + statusLabel + '</span></span></div>' +
                    '<div class="modal-field"><span class="modal-field-label">Created</span><span class="modal-field-value">' + date + '</span></div>' +
                    (product.description ? '<div class="modal-field"><span class="modal-field-label">Description</span><span class="modal-field-value">' + escapeHtml(product.description) + '</span></div>' : '') +
                    (product.contact ? '<div class="modal-field"><span class="modal-field-label">Contact</span><span class="modal-field-value">' + escapeHtml(product.contact) + '</span></div>' : '') +
                '</div>' +
                '<div class="modal-footer">' +
                    '<button class="modal-btn modal-btn-cancel" onclick="closeModal(\'viewModal\')">Close</button>' +
                '</div>' +
            '</div>';

        dom.viewModal.style.display = 'flex';
        document.body.classList.add('no-scroll');
        dom.viewModal.addEventListener('click', function handler(e) {
            if (e.target === dom.viewModal) { closeModal('viewModal'); dom.viewModal.removeEventListener('click', handler); }
        });
    }

    // =====================================
    // EDIT MODAL
    // =====================================
    function openEditModal(productId) {
        var product = findProduct(productId);
        if (!product) return;

        var categories = ['Fruits', 'Vegetables', 'Grains', 'Livestock', 'Equipment', 'Other'];
        var categoryOptions = categories.map(function (c) {
            return '<option value="' + c + '"' + (c === product.category ? ' selected' : '') + '>' + c + '</option>';
        }).join('');

        dom.editModal.innerHTML =
            '<div class="modal">' +
                '<div class="modal-header">' +
                    '<h3><i class="fa-solid fa-pen" style="color:#0288d1;margin-right:8px;font-size:.95rem;"></i>Edit Product</h3>' +
                    '<button class="modal-close" onclick="closeModal(\'editModal\')"><i class="fa-solid fa-xmark"></i></button>' +
                '</div>' +
                '<div class="modal-body">' +
                    '<div class="edit-form-group"><label for="editProductName">Product Name</label><input type="text" id="editProductName" value="' + escapeHtml(product.name) + '" maxlength="100"></div>' +
                    '<div class="edit-form-group"><label for="editProductCategory">Category</label><select id="editProductCategory">' + categoryOptions + '</select></div>' +
                    '<div class="edit-form-group"><label for="editProductPrice">Price (RWF)</label><input type="number" id="editProductPrice" value="' + product.price + '" min="0" step="1"></div>' +
                    '<div class="edit-form-group"><label for="editProductQuantity">Stock Quantity</label><input type="number" id="editProductQuantity" value="' + (product.quantity || 0) + '" min="0" step="1" placeholder="0"></div>' +
                '</div>' +
                '<div class="modal-footer">' +
                    '<button class="modal-btn modal-btn-cancel" onclick="closeModal(\'editModal\')">Cancel</button>' +
                    '<button class="modal-btn modal-btn-save" id="editSaveBtn"><i class="fa-solid fa-check" style="margin-right:6px;"></i>Save Changes</button>' +
                '</div>' +
            '</div>';

        dom.editModal.style.display = 'flex';
        document.body.classList.add('no-scroll');

        document.getElementById('editSaveBtn').addEventListener('click', function () {
            saveEditProduct(productId);
        });

        dom.editModal.addEventListener('click', function handler(e) {
            if (e.target === dom.editModal) { closeModal('editModal'); dom.editModal.removeEventListener('click', handler); }
        });
    }

    async function saveEditProduct(productId) {
        var name = document.getElementById('editProductName').value.trim();
        var category = document.getElementById('editProductCategory').value;
        var price = parseFloat(document.getElementById('editProductPrice').value);
        var quantity = parseInt(document.getElementById('editProductQuantity').value) || 0;

        if (!name || name.length < 2) { showToast('Product name must be at least 2 characters.', 'warning'); return; }
        if (isNaN(price) || price < 0) { showToast('Please enter a valid price.', 'warning'); return; }

        var saveBtn = document.getElementById('editSaveBtn');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right:6px;"></i>Saving...';

        try {
            var response = await fetch('/api/products/' + productId, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + token
                },
                body: JSON.stringify({ name: name, category: category, price: price, quantity: quantity })
            });

            if (response.status === 401) {
                localStorage.removeItem('token');
                location.href = '/auth';
                return;
            }

            if (!response.ok) {
                var errData = await response.json().catch(function () { return {}; });
                throw new Error(errData.message || 'Failed to update product');
            }

            showToast('Product updated successfully!', 'success');
            closeModal('editModal');
            loadDashboardData();
        } catch (err) {
            showToast(err.message, 'error');
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fa-solid fa-check" style="margin-right:6px;"></i>Save Changes';
        }
    }

    // =====================================
    // DELETE MODAL
    // =====================================
    function openDeleteModal(productId) {
        var product = findProduct(productId);
        if (!product) return;

        dom.deleteModal.innerHTML =
            '<div class="modal">' +
                '<div class="modal-header">' +
                    '<h3><i class="fa-solid fa-triangle-exclamation" style="color:#d32f2f;margin-right:8px;font-size:.95rem;"></i>Delete Product</h3>' +
                    '<button class="modal-close" onclick="closeModal(\'deleteModal\')"><i class="fa-solid fa-xmark"></i></button>' +
                '</div>' +
                '<div class="modal-body" style="text-align:center;padding:28px 24px;">' +
                    '<div style="font-size:2.5rem;margin-bottom:12px;">\u26A0\uFE0F</div>' +
                    '<p style="margin:0 0 6px;font-size:1rem;font-weight:600;color:var(--fd-text);">Are you sure?</p>' +
                    '<p style="margin:0;font-size:.88rem;color:var(--fd-text-muted);">This will permanently delete <strong>"' + escapeHtml(product.name) + '"</strong>. This action cannot be undone.</p>' +
                '</div>' +
                '<div class="modal-footer" style="justify-content:center;">' +
                    '<button class="modal-btn modal-btn-cancel" onclick="closeModal(\'deleteModal\')">Cancel</button>' +
                    '<button class="modal-btn modal-btn-danger" id="deleteConfirmBtn"><i class="fa-solid fa-trash" style="margin-right:6px;"></i>Delete</button>' +
                '</div>' +
            '</div>';

        dom.deleteModal.style.display = 'flex';
        document.body.classList.add('no-scroll');

        document.getElementById('deleteConfirmBtn').addEventListener('click', function () {
            confirmDelete(productId);
        });

        dom.deleteModal.addEventListener('click', function handler(e) {
            if (e.target === dom.deleteModal) { closeModal('deleteModal'); dom.deleteModal.removeEventListener('click', handler); }
        });
    }

    async function confirmDelete(productId) {
        var delBtn = document.getElementById('deleteConfirmBtn');
        delBtn.disabled = true;
        delBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right:6px;"></i>Deleting...';

        try {
            var response = await fetch('/api/products/' + productId, {
                method: 'DELETE',
                headers: { Authorization: 'Bearer ' + token }
            });

            if (response.status === 401) {
                localStorage.removeItem('token');
                location.href = '/auth';
                return;
            }

            if (!response.ok) {
                var errData = await response.json().catch(function () { return {}; });
                throw new Error(errData.message || 'Failed to delete product');
            }

            showToast('Product deleted successfully!', 'success');
            closeModal('deleteModal');
            loadDashboardData();
        } catch (err) {
            showToast(err.message, 'error');
            delBtn.disabled = false;
            delBtn.innerHTML = '<i class="fa-solid fa-trash" style="margin-right:6px;"></i>Delete';
        }
    }

    // =====================================
    // ADD PRODUCT MODAL
    // =====================================
    function openAddModal() {
        var categories = ['Fruits', 'Vegetables', 'Grains', 'Livestock', 'Equipment', 'Other'];
        var categoryOptions = categories.map(function (c) {
            return '<option value="' + c + '">' + c + '</option>';
        }).join('');

        dom.addModal.innerHTML =
            '<div class="modal">' +
                '<div class="modal-header">' +
                    '<h3><i class="fa-solid fa-plus-circle" style="color:var(--fd-green);margin-right:8px;font-size:.95rem;"></i>Add New Product</h3>' +
                    '<button class="modal-close" onclick="closeModal(\'addModal\')"><i class="fa-solid fa-xmark"></i></button>' +
                '</div>' +
                '<div class="modal-body">' +
                    '<div class="add-form-group"><label for="addProductName">Product Name *</label><input type="text" id="addProductName" placeholder="e.g. Fresh Mangoes" maxlength="100"></div>' +
                    '<div class="add-form-group"><label for="addProductCategory">Category *</label><select id="addProductCategory"><option value="">Select category</option>' + categoryOptions + '</select></div>' +
                    '<div class="add-form-group"><label for="addProductPrice">Price (RWF) *</label><input type="number" id="addProductPrice" placeholder="0" min="0" step="1"></div>' +
                    '<div class="add-form-group"><label for="addProductQuantity">Stock Quantity *</label><input type="number" id="addProductQuantity" placeholder="0" min="0" step="1"></div>' +
                    '<div class="add-form-group"><label for="addProductContact">Contact *</label><input type="text" id="addProductContact" placeholder="Phone or email" maxlength="100"></div>' +
                    '<div class="add-form-group"><label for="addProductDescription">Description</label><textarea id="addProductDescription" placeholder="Describe your product..." maxlength="1000"></textarea></div>' +
                    '<div class="add-form-group"><label for="addProductImage">Product Image</label><input type="file" id="addProductImage" accept="image/*"></div>' +
                    '<div class="add-form-group"><label>Payment Methods *</label><div class="add-form-checkboxes"><label><input type="checkbox" id="addPayMobile" checked> Mobile Money (MoMo)</label><label><input type="checkbox" id="addPayVisa"> Visa Card</label></div></div>' +
                '</div>' +
                '<div class="modal-footer">' +
                    '<button class="modal-btn modal-btn-cancel" onclick="closeModal(\'addModal\')">Cancel</button>' +
                    '<button class="modal-btn modal-btn-save" id="addSaveBtn"><i class="fa-solid fa-plus" style="margin-right:6px;"></i>Add Product</button>' +
                '</div>' +
            '</div>';

        dom.addModal.style.display = 'flex';
        document.body.classList.add('no-scroll');

        document.getElementById('addSaveBtn').addEventListener('click', function () {
            saveAddProduct();
        });

        dom.addModal.addEventListener('click', function handler(e) {
            if (e.target === dom.addModal) { closeModal('addModal'); dom.addModal.removeEventListener('click', handler); }
        });
    }

    async function saveAddProduct() {
        var name = document.getElementById('addProductName').value.trim();
        var category = document.getElementById('addProductCategory').value;
        var price = parseFloat(document.getElementById('addProductPrice').value);
        var quantity = parseInt(document.getElementById('addProductQuantity').value) || 0;
        var contact = document.getElementById('addProductContact').value.trim();
        var description = document.getElementById('addProductDescription').value.trim();
        var imageFile = document.getElementById('addProductImage').files[0];
        var payMobile = document.getElementById('addPayMobile').checked;
        var payVisa = document.getElementById('addPayVisa').checked;

        if (!name || name.length < 2) { showToast('Product name must be at least 2 characters.', 'warning'); return; }
        if (!category) { showToast('Please select a category.', 'warning'); return; }
        if (isNaN(price) || price < 0) { showToast('Please enter a valid price.', 'warning'); return; }
        if (!contact) { showToast('Please enter contact information.', 'warning'); return; }
        if (!payMobile && !payVisa) { showToast('Please select at least one payment method.', 'warning'); return; }

        var paymentMethods = [];
        if (payMobile) paymentMethods.push('Mobile Money (MoMo)');
        if (payVisa) paymentMethods.push('Visa Card');

        var saveBtn = document.getElementById('addSaveBtn');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right:6px;"></i>Adding...';

        try {
            var formData = new FormData();
            formData.append('name', name);
            formData.append('category', category);
            formData.append('price', price);
            formData.append('quantity', quantity);
            formData.append('contact', contact);
            if (description) formData.append('description', description);
            paymentMethods.forEach(function (m) { formData.append('paymentMethods', m); });
            if (imageFile) formData.append('image', imageFile);

            var response = await fetch('/api/products', {
                method: 'POST',
                headers: { Authorization: 'Bearer ' + token },
                body: formData
            });

            if (response.status === 401) {
                localStorage.removeItem('token');
                location.href = '/auth';
                return;
            }

            if (!response.ok) {
                var errData = await response.json().catch(function () { return {}; });
                throw new Error(errData.message || 'Failed to add product');
            }

            showToast('Product added successfully! It will be reviewed shortly.', 'success');
            closeModal('addModal');
            loadDashboardData();
        } catch (err) {
            showToast(err.message, 'error');
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fa-solid fa-plus" style="margin-right:6px;"></i>Add Product';
        }
    }

    // =====================================
    // CLOSE MODAL UTILITY
    // =====================================
    window.closeModal = function (modalId) {
        var modal = document.getElementById(modalId);
        if (!modal) return;
        document.body.classList.remove('no-scroll');
        modal.classList.add('fade-out');
        setTimeout(function () {
            modal.style.display = 'none';
            modal.classList.remove('fade-out');
            modal.innerHTML = '';
        }, 250);
    };

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
    // LOAD ORDERS SUMMARY FOR DASHBOARD
    // =====================================
    async function loadOrdersSummary() {
        try {
            var response = await fetch('/api/farmer/orders', {
                headers: { Authorization: 'Bearer ' + token }
            });
            if (!response.ok) return;
            var result = await response.json();
            var orders = (result && Array.isArray(result.data)) ? result.data : [];

            var pending = 0, accepted = 0, completed = 0, totalSales = 0;
            var uniqueCustomers = {};
            var totalQtySold = 0;

            for (var i = 0; i < orders.length; i++) {
                var o = orders[i];
                if (o.status === 'Pending') pending++;
                else if (o.status === 'Accepted') accepted++;
                else if (o.status === 'Completed') {
                    completed++;
                    totalSales += o.totalPrice || 0;
                }
                if (o.status === 'Completed' || o.status === 'Accepted') {
                    if (o.buyerName) uniqueCustomers[o.buyerName] = true;
                    for (var j = 0; j < (o.items || []).length; j++) {
                        totalQtySold += (o.items[j].quantity || 0);
                    }
                }
            }

            var avgOrderValue = completed > 0 ? Math.round(totalSales / completed) : 0;
            var commissionRate = 2;
            var commission = Math.round(totalSales * commissionRate / 100);
            var netEarnings = totalSales - commission;
            var pendingPayments = accepted * 0;
            var customerCount = Object.keys(uniqueCustomers).length;

            animateCounter('pendingOrdersCount', pending);
            animateCounter('approvedOrdersCount', accepted);
            animateCounter('completedOrdersCount', completed);
            animateCounter('totalSalesCount', totalSales);
            animateCounter('estimatedEarningsCount', netEarnings);
            animateCounter('avgOrderValueCount', avgOrderValue);
            animateCounter('netEarningsCount', netEarnings);
            animateCounter('platformCommissionCount', commission);
            animateCounter('pendingPaymentsCount', pendingPayments);

            state.orders = orders;
        } catch (err) {
            console.error('loadOrdersSummary error:', err);
        }
    }

    // =====================================
    // LOAD WALLET BALANCE FOR DASHBOARD
    // =====================================
    async function loadWalletBalance() {
        try {
            var response = await fetch('/api/farmer/wallet', {
                headers: { Authorization: 'Bearer ' + token }
            });
            if (!response.ok) return;
            var json = await response.json();
            var wallet = (json.data && json.data.wallet) || json.data || {};
            var balance = wallet.availableBalance || 0;
            animateCounter('walletBalanceCount', balance);
            animateCounter('walletBalanceEarnings', balance);
        } catch (err) {
            console.error('loadWalletBalance error:', err);
        }
    }

    // =====================================
    // INVENTORY ALERTS
    // =====================================
    function renderInventoryAlerts(products) {
        var alerts = [];
        for (var i = 0; i < products.length; i++) {
            var p = products[i];
            if (p.status !== 'approved') continue;
            var qty = parseInt(p.quantity) || 0;
            if (qty === 0) {
                alerts.push({ name: p.name, qty: qty, type: 'out' });
            } else if (qty < 10) {
                alerts.push({ name: p.name, qty: qty, type: 'low' });
            }
        }
        state.inventoryAlerts = alerts;
    }

    // =====================================
    // LOAD DASHBOARD DATA
    // =====================================
    async function loadDashboardData() {
        try {
            var response = await fetch('/api/farmer/dashboard', {
                headers: { Authorization: 'Bearer ' + token }
            });

            if (response.status === 401) {
                localStorage.removeItem('token');
                location.href = '/auth';
                return;
            }

            if (!response.ok) throw new Error('Failed to load dashboard data');

            var responseJson = await response.json();
            var data = responseJson.data || {};
            var stats = data.stats || {};

            // Welcome
            if (data.farmer && data.farmer.name) {
                dom.welcomeMessage.textContent = 'Welcome, ' + data.farmer.name + '!';
            }

            // Animate KPI counters
            animateCounter('totalProductsCount', stats.totalProducts || 0);
            animateCounter('approvedProductsCount', stats.approvedProducts || 0);
            animateCounter('pendingProductsCount', stats.pendingProducts || 0);
            animateCounter('rejectedProductsCount', stats.rejectedProducts || 0);

            // Store products
            state.products = data.products || [];
            state.lastPayload = data;

            // Render charts
            renderCharts(data);

            // Render recent products table
            renderRecentProducts(state.products);
            renderInventoryAlerts(state.products);

            state.dashboardLoaded = true;

        } catch (err) {
            console.error('loadDashboardData error:', err);
            showToast(err.message, 'error');
        }
    }

    // =====================================
    // LOGOUT
    // =====================================
    function handleLogout() {
        localStorage.removeItem('token');
        location.href = '/auth';
    }

    // =====================================
    // LOAD AND RENDER ORDERS
    // =====================================
    function getOrderStatusLabel(status) {
        var labels = {
            'Pending': 'Pending',
            'Accepted': 'Accepted',
            'Rejected': 'Rejected',
            'Completed': 'Completed'
        };
        return labels[status] || status;
    }

    function getOrderStatusIcon(status) {
        var icons = {
            'Pending': 'fa-solid fa-clock',
            'Accepted': 'fa-solid fa-circle-check',
            'Rejected': 'fa-solid fa-circle-xmark',
            'Completed': 'fa-solid fa-check-double'
        };
        return icons[status] || 'fa-solid fa-circle';
    }

    function renderRecentOrders(orders) {
        if (!dom.recentOrdersTable) return;
        dom.recentOrdersTable.innerHTML = '';

        if (!orders || orders.length === 0) {
            dom.recentOrdersTable.innerHTML = '<tr><td colspan="7"><div class="empty-state"><span class="empty-state-icon">\uD83D\uDCE6</span><span class="empty-state-text">No incoming orders yet.</span></div></td></tr>';
            if (dom.ordersCount) dom.ordersCount.textContent = '';
            return;
        }

        var displayOrders = orders.slice(0, 5);
        if (dom.ordersCount) {
            var pendingCount = orders.filter(function(o) { return o.status === 'Pending'; }).length;
            dom.ordersCount.textContent = orders.length + ' order' + (orders.length !== 1 ? 's' : '') + (pendingCount > 0 ? ' (' + pendingCount + ' pending)' : '');
        }

        var fragment = document.createDocumentFragment();
        for (var i = 0; i < displayOrders.length; i++) {
            var order = displayOrders[i];
            var row = document.createElement('tr');
            row.style.animationDelay = (i * 0.04) + 's';

            var statusClass = 'status-' + order.status.toLowerCase();
            var date = new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
            var itemsList = (order.items || []).map(function(item) { return escapeHtml(item.productName); }).join(', ');
            if (itemsList.length > 40) itemsList = itemsList.substring(0, 37) + '...';

            var actionHtml = '';
            if (order.status === 'Pending') {
                actionHtml = '<div class="action-btns">' +
                    '<button class="action-btn view" data-tooltip="View" data-order-id="' + order.orderId + '"><i class="fa-solid fa-eye"></i></button>' +
                    '<button class="action-btn edit" data-tooltip="Accept" data-order-id="' + order.orderId + '" data-action="accept"><i class="fa-solid fa-check"></i></button>' +
                    '<button class="action-btn delete" data-tooltip="Reject" data-order-id="' + order.orderId + '" data-action="reject"><i class="fa-solid fa-xmark"></i></button>' +
                '</div>';
            } else {
                actionHtml = '<div class="action-btns">' +
                    '<button class="action-btn view" data-tooltip="View" data-order-id="' + order.orderId + '"><i class="fa-solid fa-eye"></i></button>' +
                '</div>';
            }

            row.innerHTML =
                '<td><strong style="font-size:.82rem;">' + escapeHtml(order.orderId) + '</strong></td>' +
                '<td>' + escapeHtml(order.buyerName || 'Unknown') + '</td>' +
                '<td><span style="font-size:.82rem;color:var(--fd-text-muted);">' + itemsList + '</span></td>' +
                '<td><div class="farmer-price-cell">' + PriceFormatter.formatDual(order.totalPrice) + '</div></td>' +
                '<td><span class="status-badge ' + statusClass + '">' + getOrderStatusLabel(order.status) + '</span></td>' +
                '<td>' + date + '</td>' +
                '<td>' + actionHtml + '</td>';

            fragment.appendChild(row);
        }

        dom.recentOrdersTable.appendChild(fragment);

        dom.recentOrdersTable.querySelectorAll('.action-btn.view').forEach(function(btn) {
            btn.addEventListener('click', function() { window.location.href = '/farmer-orders'; });
        });
        dom.recentOrdersTable.querySelectorAll('.action-btn.edit[data-action="accept"]').forEach(function(btn) {
            btn.addEventListener('click', function() { updateOrderStatus(btn.dataset.orderId, 'Accepted'); });
        });
        dom.recentOrdersTable.querySelectorAll('.action-btn.delete[data-action="reject"]').forEach(function(btn) {
            btn.addEventListener('click', function() { updateOrderStatus(btn.dataset.orderId, 'Rejected'); });
        });
    }

    async function updateOrderStatus(orderId, newStatus) {
        try {
            var response = await fetch('/api/farmer/orders/' + orderId + '/status', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + token
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (response.status === 401) {
                localStorage.removeItem('token');
                location.href = '/auth';
                return;
            }

            if (!response.ok) {
                var errData = await response.json().catch(function() { return {}; });
                throw new Error(errData.error || errData.message || 'Failed to update order');
            }

            showToast('Order ' + newStatus.toLowerCase() + ' successfully!', 'success');
            loadOrders();
        } catch (err) {
            showToast(err.message, 'error');
        }
    }

    async function loadOrders() {
        try {
            var response = await fetch('/api/farmer/orders', {
                headers: { Authorization: 'Bearer ' + token }
            });

            if (response.status === 401) {
                localStorage.removeItem('token');
                location.href = '/auth';
                return;
            }

            if (!response.ok) throw new Error('Failed to load orders');

            var result = await response.json();
            state.orders = (result && Array.isArray(result.data)) ? result.data : [];
            state.ordersLoaded = true;

            var pendingOrders = state.orders.filter(function(o) { return o.status === 'Pending'; });
            var sortedOrders = pendingOrders.concat(
                state.orders.filter(function(o) { return o.status !== 'Pending'; })
            );

            renderRecentOrders(sortedOrders);
        } catch (err) {
            console.error('loadOrders error:', err);
            if (dom.recentOrdersTable) {
                dom.recentOrdersTable.innerHTML = '<tr><td colspan="7"><div class="empty-state"><span class="empty-state-icon">\u26A0\uFE0F</span><span class="empty-state-text">Failed to load orders.</span></div></td></tr>';
            }
        }
    }

    // =====================================
    // INITIALIZATION
    // =====================================
    function init() {
        initDarkMode();
        dom.darkModeToggle.addEventListener('click', toggleDarkMode);
        if (dom.logoutBtn) dom.logoutBtn.addEventListener('click', handleLogout);
        if (dom.productsSearchInput) {
            var searchTimeout;
            dom.productsSearchInput.addEventListener('input', function () {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(handleSearch, 250);
            });
        }
        if (dom.categoryFilter) {
            dom.categoryFilter.addEventListener('change', handleCategoryFilter);
        }
        if (dom.statusFilter) {
            dom.statusFilter.addEventListener('change', handleStatusFilter);
        }
        if (dom.addProductBtn) {
            dom.addProductBtn.addEventListener('click', function () {
                openAddModal();
            });
        }
        showLoadingSkeletons();
        loadDashboardData();
        loadOrders();
        loadOrdersSummary();
        loadWalletBalance();
    }

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
