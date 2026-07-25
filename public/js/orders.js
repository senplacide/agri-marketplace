(function () {
    'use strict';

    var toastContainer = document.getElementById('toastContainer');
    var logoutBtn = document.getElementById('logoutBtn');
    var darkModeToggle = document.getElementById('darkModeToggle');

    var odSkeleton = document.getElementById('odSkeleton');
    var odList = document.getElementById('odList');
    var odEmpty = document.getElementById('odEmpty');
    var odEmptyTitle = document.getElementById('odEmptyTitle');
    var odEmptySub = document.getElementById('odEmptySub');
    var odEmptyBtn = document.getElementById('odEmptyBtn');
    var odSearch = document.getElementById('odSearch');
    var odCategoryFilter = document.getElementById('odCategoryFilter');
    var odDateFilter = document.getElementById('odDateFilter');
    var odSortFilter = document.getElementById('odSortFilter');
    var odShowingCount = document.getElementById('odShowingCount');

    var odCountPending = document.getElementById('odCountPending');
    var odCountProcessing = document.getElementById('odCountProcessing');
    var odCountCompleted = document.getElementById('odCountCompleted');
    var odCountCancelled = document.getElementById('odCountCancelled');

    var odTabAll = document.getElementById('odTabAll');
    var odTabPending = document.getElementById('odTabPending');
    var odTabProcessing = document.getElementById('odTabProcessing');
    var odTabCompleted = document.getElementById('odTabCompleted');
    var odTabCancelled = document.getElementById('odTabCancelled');

    var currentTab = 'all';
    var allOrders = [];
    var expandedOrders = {};

    function getToken() {
        return localStorage.getItem('token');
    }

    async function checkRole() {
        var token = getToken();
        if (!token) { window.location.href = '/auth'; return; }
        try {
            var res = await fetch('/api/auth/me', { headers: { 'Authorization': 'Bearer ' + token } });
            if (!res.ok) { window.location.href = '/auth'; return; }
            var data = await res.json();
            var user = data.user || data;
            if (user.role !== 'buyer') {
                window.location.href = getDashboardUrl(user.role);
                return;
            }
        } catch (e) {
            window.location.href = '/auth';
        }
    }

    function getDashboardUrl(role) {
        if (role === 'admin') return '/admin.html';
        if (role === 'farmer') return '/dashboard';
        return '/';
    }

    function handleLogout() {
        localStorage.removeItem('token');
        window.location.href = '/auth';
    }

    function escapeHtml(text) {
        var d = document.createElement('div');
        d.textContent = text;
        return d.innerHTML;
    }

    function formatPrice(price) {
        return Number(price).toLocaleString('en-RW');
    }

    function formatDate(dateStr) {
        var d = new Date(dateStr);
        var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    }

    function formatTime(dateStr) {
        var d = new Date(dateStr);
        var h = d.getHours();
        var m = d.getMinutes();
        var ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12;
        if (h === 0) h = 12;
        return h + ':' + (m < 10 ? '0' : '') + m + ' ' + ampm;
    }

    function getCategoryEmoji(category) {
        var map = {
            'Fruits': 'fa-apple-whole',
            'Vegetables': 'fa-carrot',
            'Grains': 'fa-wheat-awn',
            'Livestock': 'fa-cow',
            'Equipment': 'fa-tractor',
            'Other': 'fa-box'
        };
        return map[category] || 'fa-box';
    }

    function getStatusIcon(status) {
        var map = {
            'pending': 'fa-clock',
            'Pending': 'fa-clock',
            'processing': 'fa-spinner fa-spin-pulse',
            'Processing': 'fa-spinner fa-spin-pulse',
            'completed': 'fa-circle-check',
            'Completed': 'fa-circle-check',
            'cancelled': 'fa-circle-xmark',
            'Cancelled': 'fa-circle-xmark'
        };
        return map[status] || 'fa-circle-question';
    }

    function getStatusLabel(status) {
        if (!status) return 'Pending';
        if (status === 'Processing') return 'Accepted';
        if (status === 'Cancelled') return 'Rejected';
        return status.charAt(0).toUpperCase() + status.slice(1);
    }

    function normalizeStatus(status) {
        if (!status) return 'pending';
        return status.toLowerCase();
    }

    function formatDeliveryAddress(deliveryInfo) {
        if (!deliveryInfo) return '';
        var parts = [];
        if (deliveryInfo.village) parts.push(deliveryInfo.village);
        if (deliveryInfo.cell) parts.push(deliveryInfo.cell);
        if (deliveryInfo.sector) parts.push(deliveryInfo.sector);
        if (deliveryInfo.district) parts.push(deliveryInfo.district);
        return parts.join(', ');
    }

    async function fetchOrders() {
        try {
            var token = getToken();
            if (!token) {
                window.location.href = '/auth';
                return [];
            }
            var res = await fetch('/api/orders', {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (!res.ok) {
                console.error('Failed to fetch orders:', res.status);
                return [];
            }
            var data = await res.json();
            return Array.isArray(data) ? data : [];
        } catch (err) {
            console.error('Failed to fetch orders:', err);
            return [];
        }
    }

    async function updateOrderStatus(orderId, newStatus) {
        try {
            var token = getToken();
            var res = await fetch('/api/orders/' + orderId + '/status', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (!res.ok) {
                var data = await res.json();
                showToast(data.error || 'Failed to update order status.', 'error');
                return;
            }

            showToast('Order status updated to ' + getStatusLabel(newStatus), 'success');
            await loadOrders();
        } catch (err) {
            console.error('Update order status error:', err);
            showToast('Failed to update order status.', 'error');
        }
    }

    function cancelOrder(orderId) {
        if (!confirm('Are you sure you want to cancel this order?')) return;
        updateOrderStatus(orderId, 'Cancelled');
    }

    function showToast(message, type) {
        if (!toastContainer) return;
        var icons = { success: '\u2713', error: '\u2715', warning: '\u26a0', info: '\u2139' };
        var toast = document.createElement('div');
        toast.className = 'toast toast-' + type;
        toast.innerHTML = '<span class="toast-icon">' + (icons[type] || '\u2139') + '</span> ' + escapeHtml(message);
        toastContainer.appendChild(toast);
        setTimeout(function () {
            toast.classList.add('toast-hide');
            setTimeout(function () { toast.remove(); }, 350);
        }, 4000);
    }

    function updateCounts() {
        var counts = { all: 0, pending: 0, processing: 0, completed: 0, cancelled: 0 };
        for (var i = 0; i < allOrders.length; i++) {
            var s = normalizeStatus(allOrders[i].status);
            counts.all++;
            if (counts[s] !== undefined) counts[s]++;
        }

        if (odCountPending) odCountPending.textContent = counts.pending;
        if (odCountProcessing) odCountProcessing.textContent = counts.processing;
        if (odCountCompleted) odCountCompleted.textContent = counts.completed;
        if (odCountCancelled) odCountCancelled.textContent = counts.cancelled;

        if (odTabAll) odTabAll.querySelector('.od-tab-count').textContent = counts.all;
        if (odTabPending) odTabPending.querySelector('.od-tab-count').textContent = counts.pending;
        if (odTabProcessing) odTabProcessing.querySelector('.od-tab-count').textContent = counts.processing;
        if (odTabCompleted) odTabCompleted.querySelector('.od-tab-count').textContent = counts.completed;
        if (odTabCancelled) odTabCancelled.querySelector('.od-tab-count').textContent = counts.cancelled;
    }

    function renderOrderCard(order, index) {
        var items = order.items || [];
        if (items.length === 0) return '';

        var firstItem = items[0];
        var hasImage = firstItem.imageUrl && firstItem.imageUrl.length > 0;
        var imgHtml = hasImage
            ? '<img src="' + escapeHtml(firstItem.imageUrl) + '" alt="' + escapeHtml(firstItem.productName) + '" loading="lazy">'
            : '<i class="fa-solid ' + getCategoryEmoji(firstItem.category) + '"></i>';

        var delay = Math.min(index * 0.05, 0.4);
        var normalizedStatus = normalizeStatus(order.status);
        var isExpanded = !!expandedOrders[order.orderId];
        var totalQty = 0;
        for (var i = 0; i < items.length; i++) {
            totalQty += items[i].quantity || 0;
        }

        var moreText = '';
        if (items.length > 1) {
            moreText = '<div class="od-card-more" data-expand-order="' + order.orderId + '">' +
                '<i class="fa-solid fa-plus-circle"></i> +' + (items.length - 1) + ' more item' + (items.length > 1 ? 's' : '') +
                '</div>';
        }

        var productNames = '';
        if (items.length > 1) {
            var names = [];
            for (var n = 0; n < Math.min(items.length, 3); n++) {
                names.push(items[n].productName);
            }
            productNames = names.join(', ');
            if (items.length > 3) productNames += '...';
        } else {
            productNames = firstItem.productName;
        }

        var farmerName = firstItem.farmerName || 'Unknown Farmer';
        if (items.length > 1) {
            var farmerSet = {};
            for (var f = 0; f < items.length; f++) {
                farmerSet[items[f].farmerName || 'Unknown Farmer'] = true;
            }
            var farmerCount = Object.keys(farmerSet).length;
            if (farmerCount > 1) {
                farmerName = farmerCount + ' farmers';
            }
        }

        var deliveryAddr = formatDeliveryAddress(order.deliveryInfo);

        var detailsHtml = '<div class="od-card-details' + (isExpanded ? ' expanded' : '') + '" id="odDetails-' + order.orderId + '">';
        detailsHtml += '<div class="od-details-inner">';

        for (var d = 0; d < items.length; d++) {
            var item = items[d];
            var itemHasImg = item.imageUrl && item.imageUrl.length > 0;
            var itemImgHtml = itemHasImg
                ? '<img src="' + escapeHtml(item.imageUrl) + '" alt="' + escapeHtml(item.productName) + '" loading="lazy">'
                : '<i class="fa-solid ' + getCategoryEmoji(item.category) + '"></i>';

            detailsHtml += '<div class="od-detail-item">' +
                '<div class="od-detail-img">' + itemImgHtml + '</div>' +
                '<div class="od-detail-info">' +
                    '<p class="od-detail-name">' + escapeHtml(item.productName) + '</p>' +
                    '<div class="od-detail-meta">' +
                        '<span><i class="fa-solid fa-cubes"></i> Qty: <strong>' + (item.quantity || 1) + '</strong></span>' +
                        '<span><i class="fa-solid fa-money-bill"></i> ' + formatPrice(item.unitPrice) + ' RWF/unit</span>' +
                    '</div>' +
                '</div>' +
                '<div class="od-detail-price">' +
                    '<p class="od-detail-price-value">' + formatPrice(item.lineTotal) + ' RWF</p>' +
                    '<p class="od-detail-price-unit">Subtotal</p>' +
                '</div>' +
            '</div>';
        }

        detailsHtml += '<div class="od-delivery-section">' +
            '<p class="od-delivery-title"><i class="fa-solid fa-location-dot"></i> Delivery Address</p>' +
            '<div class="od-delivery-row"><span class="od-delivery-label">Name:</span> <span class="od-delivery-value">' + escapeHtml(order.deliveryInfo.fullName || '') + '</span></div>' +
            '<div class="od-delivery-row"><span class="od-delivery-label">Phone:</span> <span class="od-delivery-value">' + escapeHtml(order.deliveryInfo.phone || '') + '</span></div>' +
            '<div class="od-delivery-row"><span class="od-delivery-label">Address:</span> <span class="od-delivery-value">' + escapeHtml(deliveryAddr) + '</span></div>' +
        '</div>';

        var detailActions = '';
        if (normalizedStatus === 'pending') {
            detailActions = '<div class="od-detail-actions">' +
                '<button class="od-card-btn od-card-btn-danger" data-action="cancel" data-order-id="' + order.orderId + '"><i class="fa-solid fa-ban"></i> Cancel Order</button>' +
            '</div>';
        } else if (normalizedStatus === 'completed') {
            detailActions = '<div class="od-detail-actions">' +
                '<button class="od-card-btn" data-action="reorder" data-order-id="' + order.orderId + '"><i class="fa-solid fa-rotate"></i> Reorder</button>' +
            '</div>';
        } else if (normalizedStatus === 'cancelled') {
            detailActions = '<div class="od-detail-actions">' +
                '<button class="od-card-btn" data-action="reorder" data-order-id="' + order.orderId + '"><i class="fa-solid fa-rotate"></i> Reorder</button>' +
            '</div>';
        }

        detailsHtml += detailActions;
        detailsHtml += '</div></div>';

        return '<div class="od-card" style="animation-delay:' + delay + 's">' +
            '<div class="od-card-top">' +
                '<span class="od-card-id"><i class="fa-solid fa-hashtag"></i> ' + escapeHtml(order.orderId.slice(-8).toUpperCase()) + '</span>' +
                '<span class="od-badge ' + normalizedStatus + '"><i class="fa-solid ' + getStatusIcon(order.status) + '"></i> ' + getStatusLabel(order.status) + '</span>' +
                '<span class="od-card-date"><i class="fa-regular fa-calendar"></i> ' + formatDate(order.createdAt) + ' at ' + formatTime(order.createdAt) + '</span>' +
            '</div>' +
            '<div class="od-card-body">' +
                '<div class="od-card-img">' + imgHtml + '</div>' +
                '<div class="od-card-product">' +
                    '<h3 class="od-card-product-name">' + escapeHtml(productNames) + '</h3>' +
                    '<p class="od-card-product-farmer"><i class="fa-solid fa-user"></i> ' + escapeHtml(farmerName) + '</p>' +
                    '<div class="od-card-meta">' +
                        '<span class="od-card-meta-item"><i class="fa-solid fa-cubes"></i> Total Qty: <strong>' + totalQty + '</strong></span>' +
                        '<span class="od-card-meta-item"><i class="fa-solid fa-boxes-stacked"></i> ' + items.length + ' item' + (items.length > 1 ? 's' : '') + '</span>' +
                    '</div>' +
                    moreText +
                '</div>' +
                '<div class="od-card-price">' +
                    '<p class="od-card-price-value">' + formatPrice(order.totalPrice) + ' RWF</p>' +
                    '<p class="od-card-price-unit">Order Total</p>' +
                '</div>' +
            '</div>' +
            '<div class="od-card-bottom">' +
                '<div class="od-card-delivery">' +
                    '<i class="fa-solid fa-location-dot"></i>' +
                    '<span class="od-card-delivery-text">' + escapeHtml(deliveryAddr || 'No address') + '</span>' +
                '</div>' +
                '<div class="od-card-actions">' +
                    '<button class="od-card-expand' + (isExpanded ? ' expanded' : '') + '" data-expand-order="' + order.orderId + '">' +
                        '<i class="fa-solid fa-chevron-down"></i> ' + (isExpanded ? 'Collapse' : 'View Details') +
                    '</button>' +
                '</div>' +
            '</div>' +
            detailsHtml +
        '</div>';
    }

    function filterAndRender() {
        var query = (odSearch && odSearch.value) ? odSearch.value.toLowerCase().trim() : '';
        var category = odCategoryFilter && odCategoryFilter.value ? odCategoryFilter.value : 'all';
        var dateVal = odDateFilter && odDateFilter.value ? odDateFilter.value : 'all';
        var sort = odSortFilter && odSortFilter.value ? odSortFilter.value : 'newest';

        var filtered = allOrders.filter(function (o) {
            var matchTab = currentTab === 'all' || normalizeStatus(o.status) === currentTab;

            var matchSearch = !query;
            if (!matchSearch) {
                matchSearch = (o.orderId && o.orderId.toLowerCase().indexOf(query) !== -1) ||
                    (o.deliveryInfo && o.deliveryInfo.fullName && o.deliveryInfo.fullName.toLowerCase().indexOf(query) !== -1);

                if (!matchSearch && o.items) {
                    for (var i = 0; i < o.items.length; i++) {
                        var item = o.items[i];
                        if ((item.productName && item.productName.toLowerCase().indexOf(query) !== -1) ||
                            (item.farmerName && item.farmerName.toLowerCase().indexOf(query) !== -1) ||
                            (item.category && item.category.toLowerCase().indexOf(query) !== -1)) {
                            matchSearch = true;
                            break;
                        }
                    }
                }
            }

            var matchCategory = true;
            if (category !== 'all' && o.items) {
                matchCategory = false;
                for (var c = 0; c < o.items.length; c++) {
                    if (o.items[c].category === category) {
                        matchCategory = true;
                        break;
                    }
                }
            }

            var matchDate = true;
            if (dateVal !== 'all') {
                var now = new Date();
                var created = new Date(o.createdAt);
                if (dateVal === 'today') {
                    var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    matchDate = created >= todayStart;
                } else if (dateVal === 'week') {
                    var weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    matchDate = created >= weekAgo;
                } else if (dateVal === 'month') {
                    var monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    matchDate = created >= monthAgo;
                }
            }

            return matchTab && matchSearch && matchCategory && matchDate;
        });

        if (sort === 'newest') {
            filtered.sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
        } else if (sort === 'oldest') {
            filtered.sort(function (a, b) { return new Date(a.createdAt) - new Date(b.createdAt); });
        } else if (sort === 'price-high') {
            filtered.sort(function (a, b) { return b.totalPrice - a.totalPrice; });
        } else if (sort === 'price-low') {
            filtered.sort(function (a, b) { return a.totalPrice - b.totalPrice; });
        }

        renderOrders(filtered);
    }

    function renderOrders(orders) {
        if (!odList) return;

        if (!orders || orders.length === 0) {
            odList.innerHTML = '';
            odList.style.display = 'none';
            if (odEmpty) odEmpty.style.display = 'block';
            if (odEmptyTitle) {
                if (allOrders.length === 0) {
                    odEmptyTitle.textContent = 'No orders yet.';
                    if (odEmptySub) odEmptySub.textContent = "You haven't placed any orders yet. Start shopping to see your orders here.";
                    if (odEmptyBtn) {
                        odEmptyBtn.style.display = '';
                        odEmptyBtn.href = '/buyer-dashboard';
                        odEmptyBtn.innerHTML = '<i class="fa-solid fa-cart-shopping"></i> Continue Shopping';
                    }
                } else {
                    odEmptyTitle.textContent = 'No orders match your filters';
                    if (odEmptySub) odEmptySub.textContent = 'Try adjusting your search or filter criteria.';
                    if (odEmptyBtn) odEmptyBtn.style.display = 'none';
                }
            }
            if (odShowingCount) odShowingCount.textContent = '0';
            return;
        }

        if (odEmpty) odEmpty.style.display = 'none';
        odList.style.display = '';

        var html = '';
        for (var i = 0; i < orders.length; i++) {
            html += renderOrderCard(orders[i], i);
        }
        odList.innerHTML = html;

        if (odShowingCount) odShowingCount.textContent = orders.length;
    }

    if (!odList._delegated) {
        odList.addEventListener('click', function (e) {
            var expandEl = e.target.closest('[data-expand-order]');
            if (expandEl) {
                toggleExpand(expandEl.getAttribute('data-expand-order'));
                return;
            }
            var actionEl = e.target.closest('[data-action]');
            if (actionEl) {
                var action = actionEl.getAttribute('data-action');
                var orderId = actionEl.getAttribute('data-order-id');
                if (action === 'cancel') {
                    cancelOrder(orderId);
                } else if (action === 'complete') {
                    updateOrderStatus(orderId, 'Completed');
                } else if (action === 'track') {
                    showToast('Order tracking coming soon!', 'info');
                } else if (action === 'reorder') {
                    var order = findOrder(orderId);
                    if (order) {
                        addToCart(order);
                        showToast('Items added to cart!', 'success');
                    }
                }
            }
        });
        odList._delegated = true;
    }

    function toggleExpand(orderId) {
        expandedOrders[orderId] = !expandedOrders[orderId];
        var detailsEl = document.getElementById('odDetails-' + orderId);
        var expandBtns = odList.querySelectorAll('[data-expand-order="' + orderId + '"]');

        if (detailsEl) {
            detailsEl.classList.toggle('expanded', expandedOrders[orderId]);
        }

        for (var i = 0; i < expandBtns.length; i++) {
            var btn = expandBtns[i];
            if (btn.classList.contains('od-card-expand')) {
                btn.classList.toggle('expanded', expandedOrders[orderId]);
                btn.innerHTML = expandedOrders[orderId]
                    ? '<i class="fa-solid fa-chevron-down"></i> Collapse'
                    : '<i class="fa-solid fa-chevron-down"></i> View Details';
            }
        }
    }

    function findOrder(orderId) {
        for (var i = 0; i < allOrders.length; i++) {
            if (allOrders[i].orderId === orderId) return allOrders[i];
        }
        return null;
    }

    function addToCart(order) {
        try {
            var cart = [];
            var stored = localStorage.getItem('buyerCart');
            if (stored) cart = JSON.parse(stored);

            for (var i = 0; i < order.items.length; i++) {
                var item = order.items[i];
                var exists = false;
                for (var j = 0; j < cart.length; j++) {
                    if (cart[j].productId === item.product) {
                        cart[j].qty = (cart[j].qty || 1) + (item.quantity || 1);
                        exists = true;
                        break;
                    }
                }
                if (!exists) {
                    cart.push({ productId: item.product, qty: item.quantity || 1 });
                }
            }

            localStorage.setItem('buyerCart', JSON.stringify(cart));
        } catch (e) { /* ignore */ }
    }

    function setTab(tab) {
        currentTab = tab;

        var tabs = document.querySelectorAll('.od-tab');
        for (var i = 0; i < tabs.length; i++) {
            var isActive = tabs[i].getAttribute('data-tab') === tab;
            tabs[i].classList.toggle('active', isActive);
        }

        var stats = document.querySelectorAll('.od-stat');
        for (var j = 0; j < stats.length; j++) {
            var isStatActive = stats[j].getAttribute('data-filter-tab') === tab;
            stats[j].classList.toggle('active', isStatActive);
        }

        filterAndRender();
    }

    async function loadOrders() {
        var apiOrders = await fetchOrders();
        allOrders = apiOrders;
        expandedOrders = {};
        updateCounts();
        filterAndRender();

        if (odSkeleton) odSkeleton.style.display = 'none';
    }

    function initDarkMode() {
        var stored = localStorage.getItem('darkMode');
        if (stored === 'true') {
            document.body.classList.add('dark-mode');
            if (darkModeToggle) darkModeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
        }
        if (darkModeToggle) {
            darkModeToggle.addEventListener('click', function () {
                document.body.classList.toggle('dark-mode');
                var isDark = document.body.classList.contains('dark-mode');
                localStorage.setItem('darkMode', isDark);
                darkModeToggle.innerHTML = isDark ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
            });
        }
    }

    function initEventListeners() {
        if (odSearch) {
            var searchTimer;
            odSearch.addEventListener('input', function () {
                clearTimeout(searchTimer);
                searchTimer = setTimeout(filterAndRender, 250);
            });
        }

        if (odCategoryFilter) odCategoryFilter.addEventListener('change', filterAndRender);
        if (odDateFilter) odDateFilter.addEventListener('change', filterAndRender);
        if (odSortFilter) odSortFilter.addEventListener('change', filterAndRender);

        var tabs = document.querySelectorAll('.od-tab');
        for (var i = 0; i < tabs.length; i++) {
            tabs[i].addEventListener('click', function () {
                setTab(this.getAttribute('data-tab'));
            });
        }

        var stats = document.querySelectorAll('.od-stat');
        for (var j = 0; j < stats.length; j++) {
            stats[j].addEventListener('click', function () {
                setTab(this.getAttribute('data-filter-tab'));
            });
        }

        if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    }

    async function init() {
        var token = getToken();
        if (!token) {
            window.location.href = '/auth';
            return;
        }

        await checkRole();

        initDarkMode();
        initEventListeners();
        loadOrders();
    }

    init();
})();
