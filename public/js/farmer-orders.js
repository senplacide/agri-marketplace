(function () {
    'use strict';

    // =====================================
    // STATE
    // =====================================
    var token = localStorage.getItem('token');
    if (!token) { window.location.href = '/auth'; return; }

    (async function checkRole() {
        try {
            var res = await fetch('/api/auth/me', { headers: { 'Authorization': 'Bearer ' + token } });
            if (!res.ok) { window.location.href = '/auth'; return; }
            var data = await res.json();
            var user = data.user || data;
            if (user.role !== 'farmer') {
                window.location.href = user.role === 'admin' ? '/admin.html' : user.role === 'buyer' ? '/buyer-dashboard' : '/';
            }
        } catch (e) {
            window.location.href = '/auth';
        }
    })();

    var allOrders = [];
    var expandedOrders = {};
    var currentTab = 'all';
    var pendingConfirm = null;

    // =====================================
    // DOM REFERENCES
    // =====================================
    var dom = {
        foList: document.getElementById('foList'),
        foEmpty: document.getElementById('foEmpty'),
        foEmptyTitle: document.getElementById('foEmptyTitle'),
        foEmptySub: document.getElementById('foEmptySub'),
        foSkeleton: document.getElementById('foSkeleton'),
        foSearch: document.getElementById('foSearch'),
        foCategoryFilter: document.getElementById('foCategoryFilter'),
        foDateFilter: document.getElementById('foDateFilter'),
        foSortFilter: document.getElementById('foSortFilter'),
        foShowingCount: document.getElementById('foShowingCount'),
        foCountPending: document.getElementById('foCountPending'),
        foCountAccepted: document.getElementById('foCountAccepted'),
        foCountCompleted: document.getElementById('foCountCompleted'),
        foCountRejected: document.getElementById('foCountRejected'),
        foTabAll: document.getElementById('foTabAll'),
        foTabPending: document.getElementById('foTabPending'),
        foTabAccepted: document.getElementById('foTabAccepted'),
        foTabCompleted: document.getElementById('foTabCompleted'),
        foTabRejected: document.getElementById('foTabRejected'),
        darkModeToggle: document.getElementById('darkModeToggle'),
        logoutBtn: document.getElementById('logoutBtn'),
        confirmOverlay: document.getElementById('foConfirmOverlay'),
        confirmIcon: document.getElementById('foConfirmIcon'),
        confirmTitle: document.getElementById('foConfirmTitle'),
        confirmMessage: document.getElementById('foConfirmMessage'),
        confirmCancel: document.getElementById('foConfirmCancel'),
        confirmAction: document.getElementById('foConfirmAction'),
        toastContainer: document.getElementById('toastContainer')
    };

    // =====================================
    // UTILITIES
    // =====================================
    function escapeHtml(text) {
        if (!text) return '';
        var d = document.createElement('div');
        d.textContent = text;
        return d.innerHTML;
    }

    function formatPrice(price) {
        return Number(price).toLocaleString('en-RW');
    }

    function formatDualPrice(price) {
        return PriceFormatter.formatDual(price);
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
            'Pending': 'fa-clock',
            'Accepted': 'fa-circle-check',
            'Completed': 'fa-flag-checkered',
            'Rejected': 'fa-circle-xmark'
        };
        return map[status] || 'fa-circle-question';
    }

    function getStatusLabel(status) {
        if (!status) return 'Pending';
        return status.charAt(0).toUpperCase() + status.slice(1);
    }

    function normalizeStatus(status) {
        if (!status) return 'pending';
        return status.toLowerCase();
    }

    function formatDeliveryAddress(deliveryInfo) {
        if (!deliveryInfo) return '';
        var parts = [];
        if (deliveryInfo.streetAddress) parts.push(deliveryInfo.streetAddress);
        if (deliveryInfo.city) parts.push(deliveryInfo.city);
        if (deliveryInfo.stateProvinceRegion) parts.push(deliveryInfo.stateProvinceRegion);
        if (deliveryInfo.postalCode) parts.push(deliveryInfo.postalCode);
        if (deliveryInfo.country) parts.push(deliveryInfo.country);
        return parts.join(', ');
    }

    // =====================================
    // TOAST
    // =====================================
    function showToast(message, type) {
        type = type || 'info';
        if (!dom.toastContainer) return;
        var icons = { success: '\u2713', error: '\u2715', warning: '\u26a0', info: '\u2139' };
        var toast = document.createElement('div');
        toast.className = 'toast toast-' + type;
        toast.innerHTML = '<span class="toast-icon">' + (icons[type] || '\u2139') + '</span> ' + escapeHtml(message);
        dom.toastContainer.appendChild(toast);
        setTimeout(function () {
            toast.classList.add('toast-hide');
            setTimeout(function () { toast.remove(); }, 350);
        }, 4000);
    }

    // =====================================
    // DARK MODE
    // =====================================
    function initDarkMode() {
        var stored = localStorage.getItem('farmerDarkMode');
        if (stored === 'true') {
            document.body.classList.add('dark-mode');
            if (dom.darkModeToggle) dom.darkModeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
        }
        if (dom.darkModeToggle) {
            dom.darkModeToggle.addEventListener('click', function () {
                document.body.classList.toggle('dark-mode');
                var isDark = document.body.classList.contains('dark-mode');
                localStorage.setItem('farmerDarkMode', isDark);
                dom.darkModeToggle.innerHTML = isDark ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
            });
        }
    }

    // =====================================
    // API
    // =====================================
    async function fetchOrders() {
        try {
            var res = await fetch('/api/farmer/orders', {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (res.status === 401) {
                localStorage.removeItem('token');
                window.location.href = '/auth';
                return [];
            }
            if (!res.ok) return [];
            var data = await res.json();
            return (data && Array.isArray(data.data)) ? data.data : [];
        } catch (err) {
            console.error('Fetch farmer orders error:', err);
            return [];
        }
    }

    async function updateOrderStatus(orderId, newStatus) {
        try {
            var res = await fetch('/api/farmer/orders/' + orderId + '/status', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({ status: newStatus })
            });

            var data = await res.json().catch(function () { return {}; });

            if (!res.ok) {
                showToast(data.error || 'Failed to update order status.', 'error');
                return false;
            }

            showToast('Order ' + getStatusLabel(newStatus).toLowerCase() + ' successfully!', 'success');
            return true;
        } catch (err) {
            console.error('Update order status error:', err);
            showToast('Failed to update order status.', 'error');
            return false;
        }
    }

    // =====================================
    // CONFIRM DIALOG
    // =====================================
    function showConfirm(title, message, iconClass, btnClass, callback) {
        pendingConfirm = callback;
        dom.confirmTitle.textContent = title;
        dom.confirmMessage.textContent = message;
        dom.confirmIcon.className = 'fo-confirm-icon ' + iconClass;
        dom.confirmAction.className = 'fo-confirm-btn ' + btnClass;

        if (iconClass === 'accept') {
            dom.confirmIcon.innerHTML = '<i class="fa-solid fa-check"></i>';
            dom.confirmAction.innerHTML = '<i class="fa-solid fa-check"></i> Accept';
        } else if (iconClass === 'reject') {
            dom.confirmIcon.innerHTML = '<i class="fa-solid fa-xmark"></i>';
            dom.confirmAction.innerHTML = '<i class="fa-solid fa-xmark"></i> Reject';
        } else if (iconClass === 'complete') {
            dom.confirmIcon.innerHTML = '<i class="fa-solid fa-flag-checkered"></i>';
            dom.confirmAction.innerHTML = '<i class="fa-solid fa-flag-checkered"></i> Complete';
        }

        dom.confirmOverlay.classList.add('active');
    }

    function hideConfirm() {
        dom.confirmOverlay.classList.remove('active');
        pendingConfirm = null;
    }

    // =====================================
    // COUNTS
    // =====================================
    function updateCounts() {
        var counts = { all: 0, pending: 0, accepted: 0, completed: 0, rejected: 0 };
        for (var i = 0; i < allOrders.length; i++) {
            var s = normalizeStatus(allOrders[i].status);
            counts.all++;
            if (counts[s] !== undefined) counts[s]++;
        }

        if (dom.foCountPending) dom.foCountPending.textContent = counts.pending;
        if (dom.foCountAccepted) dom.foCountAccepted.textContent = counts.accepted;
        if (dom.foCountCompleted) dom.foCountCompleted.textContent = counts.completed;
        if (dom.foCountRejected) dom.foCountRejected.textContent = counts.rejected;

        if (dom.foTabAll) dom.foTabAll.querySelector('.fo-tab-count').textContent = counts.all;
        if (dom.foTabPending) dom.foTabPending.querySelector('.fo-tab-count').textContent = counts.pending;
        if (dom.foTabAccepted) dom.foTabAccepted.querySelector('.fo-tab-count').textContent = counts.accepted;
        if (dom.foTabCompleted) dom.foTabCompleted.querySelector('.fo-tab-count').textContent = counts.completed;
        if (dom.foTabRejected) dom.foTabRejected.querySelector('.fo-tab-count').textContent = counts.rejected;
    }

    // =====================================
    // RENDER ORDER CARD
    // =====================================
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
        var totalAmount = 0;
        for (var i = 0; i < items.length; i++) {
            totalQty += items[i].quantity || 0;
            totalAmount += items[i].lineTotal || (items[i].unitPrice * items[i].quantity) || 0;
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

        var buyerName = order.buyerName || 'Unknown';
        var buyerEmail = order.buyerEmail || '';
        var buyerPhone = order.buyerPhone || (order.deliveryInfo ? order.deliveryInfo.phone : '');
        var deliveryAddr = formatDeliveryAddress(order.deliveryInfo);

        var detailsHtml = '<div class="fo-card-details' + (isExpanded ? ' expanded' : '') + '" id="foDetails-' + order.orderId + '">';
        detailsHtml += '<div class="fo-details-inner">';

        for (var d = 0; d < items.length; d++) {
            var item = items[d];
            var itemHasImg = item.imageUrl && item.imageUrl.length > 0;
            var itemImgHtml = itemHasImg
                ? '<img src="' + escapeHtml(item.imageUrl) + '" alt="' + escapeHtml(item.productName) + '" loading="lazy">'
                : '<i class="fa-solid ' + getCategoryEmoji(item.category) + '"></i>';

            detailsHtml += '<div class="fo-detail-item">' +
                '<div class="fo-detail-img">' + itemImgHtml + '</div>' +
                '<div class="fo-detail-info">' +
                    '<p class="fo-detail-name">' + escapeHtml(item.productName) + '</p>' +
                    '<div class="fo-detail-meta">' +
                        '<span><i class="fa-solid fa-cubes"></i> Qty: <strong>' + (item.quantity || 1) + '</strong></span>' +
                        '<span><i class="fa-solid fa-money-bill"></i> <span class="price-dual">' + formatDualPrice(item.unitPrice) + '</span>/unit</span>' +
                    '</div>' +
                '</div>' +
                '<div class="fo-detail-price">' +
                    '<p class="fo-detail-price-value">' + formatDualPrice(item.lineTotal || (item.unitPrice * item.quantity)) + '</p>' +
                    '<p class="fo-detail-price-unit">Subtotal</p>' +
                '</div>' +
            '</div>';
        }

        detailsHtml += '<div class="fo-buyer-section">' +
            '<p class="fo-buyer-title"><i class="fa-solid fa-user"></i> Buyer Information</p>' +
            '<div class="fo-buyer-row"><span class="fo-buyer-label">Name:</span> <span class="fo-buyer-value">' + escapeHtml(buyerName) + '</span></div>' +
            '<div class="fo-buyer-row"><span class="fo-buyer-label">Email:</span> <span class="fo-buyer-value">' + escapeHtml(buyerEmail) + '</span></div>' +
            '<div class="fo-buyer-row"><span class="fo-buyer-label">Phone:</span> <span class="fo-buyer-value">' + escapeHtml(buyerPhone) + '</span></div>' +
        '</div>';

        var di = order.deliveryInfo || {};
        detailsHtml += '<div class="fo-delivery-section">' +
            '<p class="fo-delivery-title"><i class="fa-solid fa-location-dot"></i> Delivery Information</p>' +
            '<div class="fo-delivery-row"><span class="fo-delivery-label">Full Name:</span> <span class="fo-delivery-value">' + escapeHtml(di.fullName || '') + '</span></div>' +
            '<div class="fo-delivery-row"><span class="fo-delivery-label">Phone:</span> <span class="fo-delivery-value">' + escapeHtml(di.phone || '') + '</span></div>' +
            '<div class="fo-delivery-row"><span class="fo-delivery-label">Street Address:</span> <span class="fo-delivery-value">' + escapeHtml(di.streetAddress || '') + '</span></div>' +
            '<div class="fo-delivery-row"><span class="fo-delivery-label">City:</span> <span class="fo-delivery-value">' + escapeHtml(di.city || '') + '</span></div>' +
            '<div class="fo-delivery-row"><span class="fo-delivery-label">State / Province / Region:</span> <span class="fo-delivery-value">' + escapeHtml(di.stateProvinceRegion || '') + '</span></div>' +
            '<div class="fo-delivery-row"><span class="fo-delivery-label">Postal / ZIP Code:</span> <span class="fo-delivery-value">' + escapeHtml(di.postalCode || '') + '</span></div>' +
            '<div class="fo-delivery-row"><span class="fo-delivery-label">Country:</span> <span class="fo-delivery-value">' + escapeHtml(di.country || '') + '</span></div>' +
        '</div>';

        var detailActions = '';
        if (normalizedStatus === 'pending') {
            detailActions = '<div class="fo-detail-actions">' +
                '<button class="fo-action-btn fo-action-btn-accept" data-action="accept" data-order-id="' + order.orderId + '"><i class="fa-solid fa-check"></i> Accept Order</button>' +
                '<button class="fo-action-btn fo-action-btn-reject" data-action="reject" data-order-id="' + order.orderId + '"><i class="fa-solid fa-xmark"></i> Reject Order</button>' +
            '</div>';
        } else if (normalizedStatus === 'accepted') {
            detailActions = '<div class="fo-detail-actions">' +
                '<button class="fo-action-btn fo-action-btn-complete" data-action="complete" data-order-id="' + order.orderId + '"><i class="fa-solid fa-flag-checkered"></i> Mark as Completed</button>' +
            '</div>';
        }

        detailsHtml += detailActions;
        detailsHtml += '</div></div>';

        return '<div class="fo-card" style="animation-delay:' + delay + 's">' +
            '<div class="fo-card-top">' +
                '<span class="fo-card-id"><i class="fa-solid fa-hashtag"></i> ' + escapeHtml(order.orderId.slice(-8).toUpperCase()) + '</span>' +
                '<span class="fo-badge ' + normalizedStatus + '"><i class="fa-solid ' + getStatusIcon(order.status) + '"></i> ' + getStatusLabel(order.status) + '</span>' +
                '<span class="fo-card-date"><i class="fa-regular fa-calendar"></i> ' + formatDate(order.createdAt) + ' at ' + formatTime(order.createdAt) + '</span>' +
            '</div>' +
            '<div class="fo-card-body">' +
                '<div class="fo-card-img">' + imgHtml + '</div>' +
                '<div class="fo-card-product">' +
                    '<h3 class="fo-card-product-name">' + escapeHtml(productNames) + '</h3>' +
                    '<div class="fo-card-meta">' +
                        '<span class="fo-card-meta-item"><i class="fa-solid fa-user"></i> <strong>' + escapeHtml(buyerName) + '</strong></span>' +
                        '<span class="fo-card-meta-item"><i class="fa-solid fa-cubes"></i> Qty: <strong>' + totalQty + '</strong></span>' +
                        '<span class="fo-card-meta-item"><i class="fa-solid fa-boxes-stacked"></i> ' + items.length + ' item' + (items.length > 1 ? 's' : '') + '</span>' +
                    '</div>' +
                '</div>' +
                '<div class="fo-card-price">' +
                    '<p class="fo-card-price-value">' + formatDualPrice(order.totalPrice) + '</p>' +
                    '<p class="fo-card-price-unit">Order Total</p>' +
                '</div>' +
            '</div>' +
            '<div class="fo-card-bottom">' +
                '<div class="fo-card-delivery">' +
                    '<i class="fa-solid fa-location-dot"></i>' +
                    '<span class="fo-card-delivery-text">' + escapeHtml(deliveryAddr || 'No address') + '</span>' +
                '</div>' +
                '<div class="fo-card-actions">' +
                    '<button class="fo-card-expand' + (isExpanded ? ' expanded' : '') + '" data-expand-order="' + order.orderId + '">' +
                        '<i class="fa-solid fa-chevron-down"></i> ' + (isExpanded ? 'Collapse' : 'View Details') +
                    '</button>' +
                '</div>' +
            '</div>' +
            detailsHtml +
        '</div>';
    }

    // =====================================
    // FILTER & RENDER
    // =====================================
    function filterAndRender() {
        var query = (dom.foSearch && dom.foSearch.value) ? dom.foSearch.value.toLowerCase().trim() : '';
        var category = dom.foCategoryFilter && dom.foCategoryFilter.value ? dom.foCategoryFilter.value : 'all';
        var dateVal = dom.foDateFilter && dom.foDateFilter.value ? dom.foDateFilter.value : 'all';
        var sort = dom.foSortFilter && dom.foSortFilter.value ? dom.foSortFilter.value : 'newest';

        var filtered = allOrders.filter(function (o) {
            var matchTab = currentTab === 'all' || normalizeStatus(o.status) === currentTab;

            var matchSearch = !query;
            if (!matchSearch) {
                matchSearch = (o.orderId && o.orderId.toLowerCase().indexOf(query) !== -1) ||
                    (o.buyerName && o.buyerName.toLowerCase().indexOf(query) !== -1) ||
                    (o.deliveryInfo && o.deliveryInfo.fullName && o.deliveryInfo.fullName.toLowerCase().indexOf(query) !== -1);

                if (!matchSearch && o.items) {
                    for (var i = 0; i < o.items.length; i++) {
                        var item = o.items[i];
                        if ((item.productName && item.productName.toLowerCase().indexOf(query) !== -1) ||
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
        if (!dom.foList) return;

        if (!orders || orders.length === 0) {
            dom.foList.innerHTML = '';
            dom.foList.style.display = 'none';
            if (dom.foEmpty) dom.foEmpty.style.display = 'block';
            if (dom.foEmptyTitle) {
                if (allOrders.length === 0) {
                    dom.foEmptyTitle.textContent = 'No customer orders yet.';
                    if (dom.foEmptySub) dom.foEmptySub.textContent = 'When customers order your products, they will appear here.';
                } else {
                    dom.foEmptyTitle.textContent = 'No orders match your filters.';
                    if (dom.foEmptySub) dom.foEmptySub.textContent = 'Try adjusting your search or filter criteria.';
                }
            }
            if (dom.foShowingCount) dom.foShowingCount.textContent = '0';
            return;
        }

        if (dom.foEmpty) dom.foEmpty.style.display = 'none';
        dom.foList.style.display = '';

        var html = '';
        for (var i = 0; i < orders.length; i++) {
            try {
                html += renderOrderCard(orders[i], i);
            } catch (e) {
                console.error('Error rendering order card:', orders[i], e);
            }
        }
        dom.foList.innerHTML = html;

        if (dom.foShowingCount) dom.foShowingCount.textContent = orders.length;
    }

    if (!dom.foList._delegated) {
        dom.foList.addEventListener('click', function (e) {
            var expandEl = e.target.closest('[data-expand-order]');
            if (expandEl) {
                toggleExpand(expandEl.getAttribute('data-expand-order'));
                return;
            }
            var actionEl = e.target.closest('[data-action]');
            if (actionEl) {
                var action = actionEl.getAttribute('data-action');
                var orderId = actionEl.getAttribute('data-order-id');
                handleAction(action, orderId);
            }
        });
        dom.foList._delegated = true;
    }

    function toggleExpand(orderId) {
        expandedOrders[orderId] = !expandedOrders[orderId];
        var detailsEl = document.getElementById('foDetails-' + orderId);
        var expandBtns = dom.foList.querySelectorAll('[data-expand-order="' + orderId + '"]');

        if (detailsEl) {
            detailsEl.classList.toggle('expanded', expandedOrders[orderId]);
        }

        for (var i = 0; i < expandBtns.length; i++) {
            var btn = expandBtns[i];
            if (btn.classList.contains('fo-card-expand')) {
                btn.classList.toggle('expanded', expandedOrders[orderId]);
                btn.innerHTML = expandedOrders[orderId]
                    ? '<i class="fa-solid fa-chevron-down"></i> Collapse'
                    : '<i class="fa-solid fa-chevron-down"></i> View Details';
            }
        }
    }

    // =====================================
    // ACTION HANDLER
    // =====================================
    function handleAction(action, orderId) {
        if (action === 'accept') {
            showConfirm(
                'Accept this order?',
                'Are you sure you want to accept order #' + orderId.slice(-8).toUpperCase() + '? The buyer will be notified.',
                'accept',
                'fo-confirm-btn-accept',
                function () {
                    hideConfirm();
                    changeStatus(orderId, 'Accepted');
                }
            );
        } else if (action === 'reject') {
            showConfirm(
                'Reject this order?',
                'Are you sure you want to reject order #' + orderId.slice(-8).toUpperCase() + '? The buyer will be notified.',
                'reject',
                'fo-confirm-btn-reject',
                function () {
                    hideConfirm();
                    changeStatus(orderId, 'Rejected');
                }
            );
        } else if (action === 'complete') {
            showConfirm(
                'Mark as completed?',
                'Are you sure you want to mark order #' + orderId.slice(-8).toUpperCase() + ' as completed?',
                'complete',
                'fo-confirm-btn-complete',
                function () {
                    hideConfirm();
                    changeStatus(orderId, 'Completed');
                }
            );
        }
    }

    async function changeStatus(orderId, newStatus) {
        var success = await updateOrderStatus(orderId, newStatus);
        if (success) {
            for (var i = 0; i < allOrders.length; i++) {
                if (allOrders[i].orderId === orderId) {
                    allOrders[i].status = newStatus;
                    break;
                }
            }
            updateCounts();
            filterAndRender();
            loadOrders();
        }
    }

    // =====================================
    // TABS
    // =====================================
    function setTab(tab) {
        currentTab = tab;

        var tabs = document.querySelectorAll('.fo-tab');
        for (var i = 0; i < tabs.length; i++) {
            var isActive = tabs[i].getAttribute('data-tab') === tab;
            tabs[i].classList.toggle('active', isActive);
        }

        var stats = document.querySelectorAll('.fo-stat');
        for (var j = 0; j < stats.length; j++) {
            var isStatActive = stats[j].getAttribute('data-filter-tab') === tab;
            stats[j].classList.toggle('active', isStatActive);
        }

        filterAndRender();
    }

    // =====================================
    // LOAD ORDERS
    // =====================================
    async function loadOrders() {
        try {
            allOrders = await fetchOrders();
            expandedOrders = {};
            updateCounts();
            filterAndRender();
        } catch (e) {
            console.error('Error loading/rendering orders:', e);
        } finally {
            if (dom.foSkeleton) dom.foSkeleton.style.display = 'none';
        }
    }

    // =====================================
    // INIT
    // =====================================
    function init() {
        initDarkMode();

        if (dom.logoutBtn) {
            dom.logoutBtn.addEventListener('click', function () {
                localStorage.removeItem('token');
                window.location.href = '/auth';
            });
        }

        if (dom.foSearch) {
            var searchTimer;
            dom.foSearch.addEventListener('input', function () {
                clearTimeout(searchTimer);
                searchTimer = setTimeout(filterAndRender, 250);
            });
        }

        if (dom.foCategoryFilter) dom.foCategoryFilter.addEventListener('change', filterAndRender);
        if (dom.foDateFilter) dom.foDateFilter.addEventListener('change', filterAndRender);
        if (dom.foSortFilter) dom.foSortFilter.addEventListener('change', filterAndRender);

        var tabs = document.querySelectorAll('.fo-tab');
        for (var i = 0; i < tabs.length; i++) {
            tabs[i].addEventListener('click', function () {
                setTab(this.getAttribute('data-tab'));
            });
        }

        var stats = document.querySelectorAll('.fo-stat');
        for (var j = 0; j < stats.length; j++) {
            stats[j].addEventListener('click', function () {
                setTab(this.getAttribute('data-filter-tab'));
            });
        }

        if (dom.confirmCancel) {
            dom.confirmCancel.addEventListener('click', hideConfirm);
        }

        if (dom.confirmAction) {
            dom.confirmAction.addEventListener('click', function () {
                if (typeof pendingConfirm === 'function') {
                    pendingConfirm();
                }
            });
        }

        if (dom.confirmOverlay) {
            dom.confirmOverlay.addEventListener('click', function (e) {
                if (e.target === dom.confirmOverlay) hideConfirm();
            });
        }

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && dom.confirmOverlay.classList.contains('active')) {
                hideConfirm();
            }
        });

        loadOrders();
    }

    init();
})();
