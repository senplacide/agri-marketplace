(function () {
    'use strict';

    var ckLoading = document.getElementById('ckLoading');
    var ckContent = document.getElementById('ckContent');
    var ckEmpty = document.getElementById('ckEmpty');
    var ckOrderGrid = document.getElementById('ckOrderGrid');
    var ckActions = document.getElementById('ckActions');
    var ckCustomerInfo = document.getElementById('ckCustomerInfo');
    var ckProductsList = document.getElementById('ckProductsList');
    var ckDeliveryGrid = document.getElementById('ckDeliveryGrid');
    var ckSummary = document.getElementById('ckSummary');
    var ckItemCount = document.getElementById('ckItemCount');
    var ckBackBtn = document.getElementById('ckBackBtn');
    var ckPlaceOrderBtn = document.getElementById('ckPlaceOrderBtn');
    var ckDarkModeToggle = document.getElementById('darkModeToggle');
    var ckLogoutBtn = document.getElementById('logoutBtn');
    var ckToastContainer = document.getElementById('ckToastContainer');

    var ckFullName = document.getElementById('ckFullName');
    var ckPhone = document.getElementById('ckPhone');
    var ckStreetAddress = document.getElementById('ckStreetAddress');
    var ckCity = document.getElementById('ckCity');
    var ckStateProvinceRegion = document.getElementById('ckStateProvinceRegion');
    var ckPostalCode = document.getElementById('ckPostalCode');
    var ckCountry = document.getElementById('ckCountry');

    var currentProducts = [];
    var currentCart = [];
    var isSubmitting = false;

    function showToast(message, type) {
        if (!ckToastContainer) return;
        var icons = { success: '\u2713', error: '\u2715', warning: '\u26a0', info: '\u2139' };
        var toast = document.createElement('div');
        toast.className = 'ck-toast ck-toast-' + type;
        toast.innerHTML = '<span>' + (icons[type] || '\u2139') + '</span> ' + escapeHtml(message);
        ckToastContainer.appendChild(toast);
        setTimeout(function () {
            toast.classList.add('ck-toast-hide');
            setTimeout(function () { toast.remove(); }, 350);
        }, 4000);
    }

    function escapeHtml(text) {
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

    function getToken() {
        return localStorage.getItem('token');
    }

    function handleLogout() {
        localStorage.removeItem('token');
        window.location.href = '/auth';
    }

    function initDarkMode() {
        var stored = localStorage.getItem('darkMode');
        if (stored === 'true') {
            document.body.classList.add('dark-mode');
            if (ckDarkModeToggle) ckDarkModeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
        }
        if (ckDarkModeToggle) {
            ckDarkModeToggle.addEventListener('click', function () {
                document.body.classList.toggle('dark-mode');
                var isDark = document.body.classList.contains('dark-mode');
                localStorage.setItem('darkMode', isDark);
                ckDarkModeToggle.innerHTML = isDark ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
            });
        }
    }

    function getCart() {
        try {
            var stored = localStorage.getItem('buyerCart');
            return stored ? JSON.parse(stored) : [];
        } catch (e) { return []; }
    }

    function formatDate(dateStr) {
        var d = new Date(dateStr);
        var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    }

    function renderCustomerInfo(user) {
        if (!ckCustomerInfo) return;
        var name = user.name || 'N/A';
        var email = user.email || 'N/A';
        var phone = user.phone || 'Not provided';
        var role = user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Buyer';

        ckCustomerInfo.innerHTML =
            '<div class="ck-info-item"><span class="ck-info-label">Full Name</span><span class="ck-info-value">' + escapeHtml(name) + '</span></div>' +
            '<div class="ck-info-item"><span class="ck-info-label">Email</span><span class="ck-info-value">' + escapeHtml(email) + '</span></div>' +
            '<div class="ck-info-item"><span class="ck-info-label">Phone</span><span class="ck-info-value">' + escapeHtml(phone) + '</span></div>' +
            '<div class="ck-info-item"><span class="ck-info-label">Account Type</span><span class="ck-info-value">' + escapeHtml(role) + '</span></div>';
    }

    function renderProducts(cart, allProducts) {
        if (!ckProductsList) return;

        var html = '';
        var totalItems = 0;
        for (var i = 0; i < cart.length; i++) {
            var item = cart[i];
            var product = null;
            for (var j = 0; j < allProducts.length; j++) {
                if (allProducts[j]._id === item.productId) {
                    product = allProducts[j];
                    break;
                }
            }
            if (!product) continue;

            var qty = item.qty || 1;
            totalItems += qty;
            var lineTotal = product.price * qty;
            var ownerName = (product.owner && product.owner.name) ? product.owner.name : 'Unknown Farmer';
            var hasImage = product.imageUrl && product.imageUrl.length > 0;

            var imgHtml = hasImage
                ? '<img src="' + escapeHtml(product.imageUrl) + '" alt="' + escapeHtml(product.name) + '">'
                : '<i class="fa-solid ' + getCategoryEmoji(product.category) + '"></i>';

            html += '<div class="ck-product">' +
                '<div class="ck-product-img">' + imgHtml + '</div>' +
                '<div class="ck-product-details">' +
                    '<p class="ck-product-name">' + escapeHtml(product.name) + '</p>' +
                    '<p class="ck-product-farmer"><i class="fa-solid fa-user"></i> ' + escapeHtml(ownerName) + ' &middot; ' + escapeHtml(product.category) + '</p>' +
                '</div>' +
                '<span class="ck-product-qty">Qty: ' + qty + '</span>' +
                '<div class="ck-product-price">' +
                    '<p class="ck-product-unit">' + formatDualPrice(product.price) + ' each</p>' +
                    '<p class="ck-product-total">' + formatDualPrice(lineTotal) + '</p>' +
                '</div>' +
            '</div>';
        }

        ckProductsList.innerHTML = html;
        if (ckItemCount) ckItemCount.textContent = totalItems;
    }

    function renderDeliverySummary() {
        if (!ckDeliveryGrid) return;
        var today = new Date();
        var estDate = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
        var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        var estStr = months[estDate.getMonth()] + ' ' + estDate.getDate() + ', ' + estDate.getFullYear();

        var address = 'To be confirmed';
        if (ckStreetAddress && ckStreetAddress.value && ckCity && ckCity.value) {
            address = ckStreetAddress.value + ', ' + ckCity.value;
            if (ckCountry && ckCountry.value) {
                address += ', ' + ckCountry.value;
            }
        }

        ckDeliveryGrid.innerHTML =
            '<div class="ck-delivery-card">' +
                '<i class="fa-solid fa-truck"></i>' +
                '<span class="ck-delivery-label">Delivery Method</span>' +
                '<span class="ck-delivery-value">Standard Delivery</span>' +
            '</div>' +
            '<div class="ck-delivery-card">' +
                '<i class="fa-solid fa-calendar-check"></i>' +
                '<span class="ck-delivery-label">Estimated Arrival</span>' +
                '<span class="ck-delivery-value">' + estStr + '</span>' +
            '</div>' +
            '<div class="ck-delivery-card">' +
                '<i class="fa-solid fa-location-dot"></i>' +
                '<span class="ck-delivery-label">Delivery Address</span>' +
                '<span class="ck-delivery-value">' + escapeHtml(address) + '</span>' +
            '</div>' +
            '<div class="ck-delivery-card">' +
                '<i class="fa-solid fa-shield-halved"></i>' +
                '<span class="ck-delivery-label">Order Protection</span>' +
                '<span class="ck-delivery-value">Covered</span>' +
            '</div>';
    }

    function renderSummary(cart, allProducts) {
        if (!ckSummary) return;

        var subtotal = 0;
        var totalItems = 0;
        for (var i = 0; i < cart.length; i++) {
            var item = cart[i];
            for (var j = 0; j < allProducts.length; j++) {
                if (allProducts[j]._id === item.productId) {
                    var qty = item.qty || 1;
                    subtotal += allProducts[j].price * qty;
                    totalItems += qty;
                    break;
                }
            }
        }

        var deliveryFee = 0;
        var total = subtotal + deliveryFee;

        ckSummary.innerHTML =
            '<div class="ck-summary-row">' +
                '<span class="ck-summary-label">Items (' + totalItems + ')</span>' +
                '<span class="ck-summary-value">' + formatDualPrice(subtotal) + '</span>' +
            '</div>' +
            '<div class="ck-summary-row">' +
                '<span class="ck-summary-label">Delivery Fee</span>' +
                '<span class="ck-summary-value" style="color:var(--bd-green);font-weight:700;">Free</span>' +
            '</div>' +
            '<div class="ck-summary-total">' +
                '<span class="ck-summary-total-label">Grand Total</span>' +
                '<span class="ck-summary-total-value">' + formatDualPrice(total) + '</span>' +
            '</div>';
    }

    /* ========== DELIVERY FORM ========== */

    function saveDeliveryForm() {
        var data = {
            fullName: ckFullName ? ckFullName.value : '',
            phone: ckPhone ? ckPhone.value : '',
            streetAddress: ckStreetAddress ? ckStreetAddress.value : '',
            city: ckCity ? ckCity.value : '',
            stateProvinceRegion: ckStateProvinceRegion ? ckStateProvinceRegion.value : '',
            postalCode: ckPostalCode ? ckPostalCode.value : '',
            country: ckCountry ? ckCountry.value : ''
        };
        try {
            localStorage.setItem('ckDeliveryForm', JSON.stringify(data));
        } catch (e) { /* ignore */ }
    }

    function loadDeliveryForm() {
        try {
            var stored = localStorage.getItem('ckDeliveryForm');
            if (stored) {
                var data = JSON.parse(stored);
                if (ckFullName && data.fullName) ckFullName.value = data.fullName;
                if (ckPhone && data.phone) ckPhone.value = data.phone;
                if (ckStreetAddress && data.streetAddress) ckStreetAddress.value = data.streetAddress;
                if (ckCity && data.city) ckCity.value = data.city;
                if (ckStateProvinceRegion && data.stateProvinceRegion) ckStateProvinceRegion.value = data.stateProvinceRegion;
                if (ckPostalCode && data.postalCode) ckPostalCode.value = data.postalCode;
                if (ckCountry && data.country) ckCountry.value = data.country;
            }
        } catch (e) { /* ignore */ }
    }

    function getDeliveryFormData() {
        return {
            fullName: ckFullName ? ckFullName.value.trim() : '',
            phone: ckPhone ? ckPhone.value.trim() : '',
            streetAddress: ckStreetAddress ? ckStreetAddress.value.trim() : '',
            city: ckCity ? ckCity.value.trim() : '',
            stateProvinceRegion: ckStateProvinceRegion ? ckStateProvinceRegion.value.trim() : '',
            postalCode: ckPostalCode ? ckPostalCode.value.trim() : '',
            country: ckCountry ? ckCountry.value.trim() : ''
        };
    }

    function clearFieldError(fieldName) {
        var group = document.querySelector('.ck-form-group[data-field="' + fieldName + '"]');
        if (group) group.classList.remove('has-error');
    }

    function setFieldError(fieldName) {
        var group = document.querySelector('.ck-form-group[data-field="' + fieldName + '"]');
        if (group) group.classList.add('has-error');
    }

    function validateDeliveryForm() {
        var valid = true;
        var data = getDeliveryFormData();

        clearFieldError('fullName');
        clearFieldError('phone');
        clearFieldError('streetAddress');
        clearFieldError('city');
        clearFieldError('country');

        if (!data.fullName || data.fullName.length < 2) {
            setFieldError('fullName');
            valid = false;
        }

        var phoneRegex = /^[0-9]{10,12}$/;
        if (!data.phone || !phoneRegex.test(data.phone.replace(/\s+/g, ''))) {
            setFieldError('phone');
            valid = false;
        }

        if (!data.streetAddress || data.streetAddress.length < 3) {
            setFieldError('streetAddress');
            valid = false;
        }

        if (!data.city || data.city.length < 2) {
            setFieldError('city');
            valid = false;
        }

        if (!data.country || data.country.length < 2) {
            setFieldError('country');
            valid = false;
        }

        return valid;
    }

    function setupFormListeners() {
        var inputs = document.querySelectorAll('.ck-form-input');
        for (var i = 0; i < inputs.length; i++) {
            inputs[i].addEventListener('input', function () {
                var fieldName = this.id.replace('ck', '');
                fieldName = fieldName.charAt(0).toLowerCase() + fieldName.slice(1);
                clearFieldError(fieldName);
                saveDeliveryForm();
                renderDeliverySummary();
            });
            inputs[i].addEventListener('change', function () {
                var fieldName = this.id.replace('ck', '');
                fieldName = fieldName.charAt(0).toLowerCase() + fieldName.slice(1);
                clearFieldError(fieldName);
                saveDeliveryForm();
                renderDeliverySummary();
            });
        }
    }

    /* ========== PLACE ORDER ========== */

    function buildDeliveryAddress(data) {
        var parts = [];
        if (data.streetAddress) parts.push(data.streetAddress);
        if (data.city) parts.push(data.city);
        if (data.stateProvinceRegion) parts.push(data.stateProvinceRegion);
        if (data.postalCode) parts.push(data.postalCode);
        if (data.country) parts.push(data.country);
        return parts.join(', ') || 'Not provided';
    }

    /* ── Confirmation Modal ── */
    function showConfirmationModal(data, deliveryData, orderItems) {
        var modal = document.getElementById('ckConfirmModal');
        var details = document.getElementById('ckConfirmDetails');
        if (!modal || !details) { window.location.href = '/orders'; return; }

        var totalItems = 0;
        var subtotal = 0;
        for (var i = 0; i < orderItems.length; i++) {
            totalItems += orderItems[i].quantity;
            subtotal += orderItems[i].unitPrice * orderItems[i].quantity;
        }

        var orderId = (data.data && data.data.orderId) ? data.data.orderId : (data.orderId || 'N/A');
        var address = deliveryData.city + ', ' + deliveryData.country;

        details.innerHTML =
            '<div class="ck-confirm-detail-row"><span class="ck-confirm-detail-key">Order ID</span><span class="ck-confirm-detail-val">' + escapeHtml(orderId.slice(-12).toUpperCase()) + '</span></div>' +
            '<div class="ck-confirm-detail-row"><span class="ck-confirm-detail-key">Items</span><span class="ck-confirm-detail-val">' + totalItems + '</span></div>' +
            '<div class="ck-confirm-detail-row"><span class="ck-confirm-detail-key">Delivery To</span><span class="ck-confirm-detail-val">' + escapeHtml(address) + '</span></div>' +
            '<div class="ck-confirm-detail-row"><span class="ck-confirm-detail-key">Total</span><span class="ck-confirm-detail-val" style="color:var(--bd-green);">' + formatDualPrice(subtotal) + '</span></div>';

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    async function init() {
        var token = getToken();
        if (!token) {
            window.location.href = '/auth';
            return;
        }

        initDarkMode();

        if (ckBackBtn) {
            ckBackBtn.addEventListener('click', function () {
                window.location.href = '/buyer-dashboard';
            });
        }

        if (ckLogoutBtn) {
            ckLogoutBtn.addEventListener('click', handleLogout);
        }

        setupFormListeners();
        loadDeliveryForm();

        if (ckPlaceOrderBtn) {
            ckPlaceOrderBtn.addEventListener('click', async function () {
                if (isSubmitting) return;

                var cart = getCart();
                if (cart.length === 0) {
                    showToast('Your cart is empty', 'warning');
                    return;
                }

                if (!validateDeliveryForm()) {
                    showToast('Please fill in all delivery information', 'error');
                    var firstError = document.querySelector('.ck-form-group.has-error .ck-form-input');
                    if (firstError) firstError.focus();
                    return;
                }

                isSubmitting = true;
                var deliveryData = getDeliveryFormData();

                ckPlaceOrderBtn.disabled = true;
                ckPlaceOrderBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin-pulse"></i> Submitting order...';

                var orderItems = [];
                for (var i = 0; i < currentProducts.length; i++) {
                    for (var j = 0; j < cart.length; j++) {
                        if (currentProducts[i]._id === cart[j].productId) {
                            var p = currentProducts[i];
                            var qty = cart[j].qty || 1;
                            orderItems.push({
                                productId: p._id,
                                productName: p.name,
                                category: p.category,
                                imageUrl: p.imageUrl || '',
                                farmerName: (p.owner && p.owner.name) ? p.owner.name : 'Unknown Farmer',
                                unitPrice: p.price,
                                quantity: qty
                            });
                            break;
                        }
                    }
                }

                try {
                    var token = getToken();
                    var res = await fetch('/api/orders', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + token
                        },
                        body: JSON.stringify({
                            items: orderItems,
                            deliveryInfo: {
                                fullName: deliveryData.fullName,
                                phone: deliveryData.phone,
                                streetAddress: deliveryData.streetAddress,
                                city: deliveryData.city,
                                stateProvinceRegion: deliveryData.stateProvinceRegion,
                                postalCode: deliveryData.postalCode,
                                country: deliveryData.country
                            }
                        })
                    });

                    var data = await res.json();

                    if (!res.ok) {
                        showToast(data.error || 'Failed to place order. Please try again.', 'error');
                        isSubmitting = false;
                        ckPlaceOrderBtn.disabled = false;
                        ckPlaceOrderBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Place Order';
                        return;
                    }

                    localStorage.removeItem('buyerCart');
                    try {
                        localStorage.removeItem('ckDeliveryForm');
                    } catch (e) { /* ignore */ }

                    /* Show confirmation modal */
                    showConfirmationModal(data, deliveryData, orderItems);

                } catch (err) {
                    console.error('Order placement error:', err);
                    showToast('Failed to place order. Please try again.', 'error');
                    isSubmitting = false;
                    ckPlaceOrderBtn.disabled = false;
                    ckPlaceOrderBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Place Order';
                }
            });
        }

        var cart = getCart();
        if (cart.length === 0) {
            if (ckLoading) ckLoading.style.display = 'none';
            if (ckContent) ckContent.style.display = '';
            if (ckEmpty) ckEmpty.style.display = '';
            return;
        }

        var allProducts = [];
        var userData = null;

        try {
            var results = await Promise.all([
                fetch('/api/products'),
                fetch('/api/auth/me', {
                    headers: { 'Authorization': 'Bearer ' + token }
                })
            ]);

            var prodRes = results[0];
            var userRes = results[1];

            if (prodRes.ok) {
                var rawProducts = await prodRes.json();
                allProducts = Array.isArray(rawProducts) ? rawProducts : (rawProducts.data || rawProducts.products || []);
            }

            if (userRes.ok) {
                userData = await userRes.json();
            }
        } catch (e) {
            console.error('Failed to load data:', e);
        }

        currentProducts = allProducts;

        var validCart = [];
        for (var i = 0; i < cart.length; i++) {
            var found = false;
            for (var j = 0; j < allProducts.length; j++) {
                if (allProducts[j]._id === cart[i].productId) {
                    found = true;
                    break;
                }
            }
            if (found) validCart.push(cart[i]);
        }

        currentCart = validCart;

        if (validCart.length === 0) {
            if (ckLoading) ckLoading.style.display = 'none';
            if (ckContent) ckContent.style.display = '';
            if (ckEmpty) ckEmpty.style.display = '';
            return;
        }

        if (userData) {
            renderCustomerInfo(userData);
            if (ckFullName && !ckFullName.value && userData.name) {
                ckFullName.value = userData.name;
                saveDeliveryForm();
            }
            if (ckPhone && !ckPhone.value && userData.phone) {
                ckPhone.value = userData.phone;
                saveDeliveryForm();
            }
        } else {
            renderCustomerInfo({ name: 'Buyer', email: 'N/A', phone: 'Not provided' });
        }

        renderProducts(validCart, allProducts);
        renderDeliverySummary();
        renderSummary(validCart, allProducts);

        if (ckLoading) ckLoading.style.display = 'none';
        if (ckContent) ckContent.style.display = '';
        if (ckOrderGrid) ckOrderGrid.style.display = '';
        if (ckActions) ckActions.style.display = '';
    }

    init();
})();
