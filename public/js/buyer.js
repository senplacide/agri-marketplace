(function () {
    'use strict';

    const toastContainer = document.getElementById('toastContainer');
    const logoutBtn = document.getElementById('logoutBtn');
    const darkModeToggle = document.getElementById('darkModeToggle');
    const welcomeMessage = document.getElementById('welcomeMessage');
    const welcomeSubtext = document.getElementById('welcomeSubtext');

    var token = getToken();
    if (!token) { location.href = '/auth'; return; }

    // Role guard: verify user is a buyer
    (async function () {
        try {
            var res = await fetch('/api/auth/me', { headers: { 'Authorization': 'Bearer ' + token } });
            if (!res.ok) { localStorage.removeItem('token'); location.href = '/auth'; return; }
            var json = await res.json();
            var user = json.user || json;
            if (user.role !== 'buyer') {
                if (user.role === 'admin') { location.href = '/admin.html'; }
                else if (user.role === 'farmer') { location.href = '/dashboard'; }
                else { location.href = '/auth'; }
                return;
            }
        } catch (e) {
            localStorage.removeItem('token');
            location.href = '/auth';
            return;
        }
    })();

    var allProducts = [];

    var marketplaceGrid = document.getElementById('marketplaceGrid');
    var marketplaceEmpty = document.getElementById('marketplaceEmpty');
    var marketplaceCount = document.getElementById('marketplaceCount');
    var marketplaceSearch = document.getElementById('marketplaceSearch');
    var categoryFilter = document.getElementById('categoryFilter');
    var priceSort = document.getElementById('priceSort');
    var dateFilter = document.getElementById('dateFilter');
    var availabilityFilter = document.getElementById('availabilityFilter');

    function getToken() {
        return localStorage.getItem('token');
    }

    function showToast(message, type) {
        if (!toastContainer) return;
        const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
        const toast = document.createElement('div');
        toast.className = 'toast toast-' + type;
        toast.innerHTML = '<span class="toast-icon">' + (icons[type] || 'ℹ') + '</span> ' + escapeHtml(message);
        toastContainer.appendChild(toast);
        setTimeout(function () {
            toast.classList.add('toast-hide');
            setTimeout(function () { toast.remove(); }, 350);
        }, 4000);
    }

    function escapeHtml(text) {
        var d = document.createElement('div');
        d.textContent = text;
        return d.innerHTML;
    }

    function handleLogout() {
        localStorage.removeItem('token');
        window.location.href = '/auth';
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

    function formatDate(dateStr) {
        var d = new Date(dateStr);
        var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    }

    function formatPrice(price) {
        return Number(price).toLocaleString('en-RW');
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

    function renderProductCard(product, index) {
        var ownerName = (product.owner && product.owner.name) ? product.owner.name : 'Unknown Farmer';
        var hasImage = product.imageUrl && product.imageUrl.length > 0;
        var imgHtml = hasImage
            ? '<img src="' + escapeHtml(product.imageUrl) + '" alt="' + escapeHtml(product.name) + '" loading="lazy">'
            : '<div class="product-card-img-placeholder"><i class="fa-solid ' + getCategoryEmoji(product.category) + '"></i></div>';

        var delay = Math.min(index * 0.06, 0.5);

        return '<div class="product-card" style="animation-delay:' + delay + 's">' +
            '<div class="product-card-img">' +
                imgHtml +
                '<span class="product-card-category-badge"><i class="fa-solid ' + getCategoryEmoji(product.category) + '"></i> ' + escapeHtml(product.category) + '</span>' +
                '<span class="product-card-status status-approved">Available</span>' +
            '</div>' +
            '<div class="product-card-body">' +
                '<h3 class="product-card-name">' + escapeHtml(product.name) + '</h3>' +
                '<p class="product-card-price">' + formatPrice(product.price) + ' <span>RWF</span></p>' +
                '<div class="product-card-stock"><span class="stock-dot"></span> In Stock</div>' +
                '<div class="product-card-meta">' +
                    '<div class="product-card-meta-item"><i class="fa-solid fa-user"></i> ' + escapeHtml(ownerName) + '</div>' +
                    (product.contact ? '<div class="product-card-meta-item"><i class="fa-solid fa-phone"></i> ' + escapeHtml(product.contact) + '</div>' : '') +
                '</div>' +
                '<div class="product-card-date"><i class="fa-regular fa-calendar"></i> Added ' + formatDate(product.createdAt) + '</div>' +
            '</div>' +
            '<div class="product-card-actions">' +
                '<button class="product-card-btn product-card-btn-secondary" data-view-details="' + product._id + '" title="View product details"><i class="fa-solid fa-eye"></i> View Details</button>' +
                '<button class="product-card-btn product-card-btn-primary" data-product-id="' + product._id + '" title="Add to cart"><i class="fa-solid fa-cart-plus"></i> Add to Cart</button>' +
            '</div>' +
        '</div>';
    }

    function renderProducts(products) {
        if (!marketplaceGrid) return;

        if (!products || products.length === 0) {
            marketplaceGrid.innerHTML = '';
            marketplaceGrid.style.display = 'none';
            if (marketplaceEmpty) marketplaceEmpty.style.display = 'block';
            if (marketplaceCount) marketplaceCount.textContent = '0 products';
            return;
        }

        if (marketplaceEmpty) marketplaceEmpty.style.display = 'none';
        marketplaceGrid.style.display = '';

        var html = '';
        for (var i = 0; i < products.length; i++) {
            html += renderProductCard(products[i], i);
        }
        marketplaceGrid.innerHTML = html;

        if (marketplaceCount) {
            var count = products.length;
            marketplaceCount.textContent = count + (count === 1 ? ' product' : ' products');
        }
    }

    if (!marketplaceGrid._delegated) {
        marketplaceGrid.addEventListener('click', function (e) {
            var target = e.target.closest('[data-product-id]');
            if (target) {
                handleAddToCart(target.getAttribute('data-product-id'));
                return;
            }
            var viewTarget = e.target.closest('[data-view-details]');
            if (viewTarget) {
                openProductModal(viewTarget.getAttribute('data-view-details'));
            }
        });
        marketplaceGrid._delegated = true;
    }

    function handleAddToCart(productId) {
        var cart = getCart();

        var exists = false;
        for (var i = 0; i < cart.length; i++) {
            if (cart[i].productId === productId) {
                cart[i].qty = (cart[i].qty || 1) + 1;
                exists = true;
                break;
            }
        }
        if (!exists) {
            cart.push({ productId: productId, qty: 1 });
        }

        saveCart(cart);
        updateCartBadge();
        renderCart();
        showToast('Product added to cart!', 'success');
    }

    var cartBtn = document.getElementById('cartBtn');
    var cartBadge = document.getElementById('cartBadge');
    var cartDrawerOverlay = document.getElementById('cartDrawerOverlay');
    var cartDrawerClose = document.getElementById('cartDrawerClose');
    var cartDrawerItems = document.getElementById('cartDrawerItems');
    var cartDrawerFooter = document.getElementById('cartDrawerFooter');
    var cartSubtotal = document.getElementById('cartSubtotal');
    var cartTotal = document.getElementById('cartTotal');
    var cartCheckoutBtn = document.getElementById('cartCheckoutBtn');

    function getCart() {
        try {
            var stored = localStorage.getItem('buyerCart');
            return stored ? JSON.parse(stored) : [];
        } catch (e) { return []; }
    }

    function saveCart(cart) {
        try { localStorage.setItem('buyerCart', JSON.stringify(cart)); } catch (e) { /* ignore */ }
    }

    function updateCartBadge() {
        var cart = getCart();
        var totalItems = 0;
        for (var i = 0; i < cart.length; i++) {
            totalItems += (cart[i].qty || 1);
        }
        if (cartBadge) {
            if (totalItems > 0) {
                cartBadge.textContent = totalItems > 99 ? '99+' : totalItems;
                cartBadge.style.display = 'flex';
                cartBadge.classList.remove('bump');
                void cartBadge.offsetWidth;
                cartBadge.classList.add('bump');
            } else {
                cartBadge.style.display = 'none';
            }
        }
    }

    function getProductById(id) {
        for (var i = 0; i < allProducts.length; i++) {
            if (allProducts[i]._id === id) return allProducts[i];
        }
        return null;
    }

    function renderCart() {
        var cart = getCart();
        if (!cartDrawerItems) return;

        if (cart.length === 0) {
            cartDrawerItems.innerHTML = '<div class="cart-empty">' +
                '<div class="cart-empty-icon"><i class="fa-solid fa-cart-shopping"></i></div>' +
                '<p class="cart-empty-title">Your cart is empty</p>' +
                '<p class="cart-empty-sub">Browse products and add items to your cart.</p>' +
            '</div>';
            if (cartDrawerFooter) cartDrawerFooter.style.display = 'none';
            return;
        }

        var html = '';
        var subtotal = 0;

        for (var i = 0; i < cart.length; i++) {
            var item = cart[i];
            var product = getProductById(item.productId);
            if (!product) continue;

            var qty = item.qty || 1;
            var lineTotal = product.price * qty;
            subtotal += lineTotal;

            var hasImage = product.imageUrl && product.imageUrl.length > 0;
            var imgHtml = hasImage
                ? '<img src="' + escapeHtml(product.imageUrl) + '" alt="' + escapeHtml(product.name) + '">'
                : '<div class="cart-item-img-placeholder"><i class="fa-solid ' + getCategoryEmoji(product.category) + '"></i></div>';

            html += '<div class="cart-item">' +
                '<div class="cart-item-img">' + imgHtml + '</div>' +
                '<div class="cart-item-info">' +
                    '<p class="cart-item-name">' + escapeHtml(product.name) + '</p>' +
                    '<p class="cart-item-price">' + formatPrice(product.price) + ' RWF</p>' +
                    '<div class="cart-item-controls">' +
                        '<button class="cart-qty-btn" data-cart-qty="-1" data-cart-pid="' + product._id + '" title="Decrease"><i class="fa-solid fa-minus"></i></button>' +
                        '<span class="cart-item-qty">' + qty + '</span>' +
                        '<button class="cart-qty-btn" data-cart-qty="1" data-cart-pid="' + product._id + '" title="Increase"><i class="fa-solid fa-plus"></i></button>' +
                    '</div>' +
                    '<span class="cart-item-total">' + formatPrice(lineTotal) + ' RWF</span>' +
                '</div>' +
                '<button class="cart-item-remove" data-cart-remove="' + product._id + '" title="Remove item"><i class="fa-solid fa-trash-can"></i></button>' +
            '</div>';
        }

        cartDrawerItems.innerHTML = html;

        if (cartDrawerFooter) {
            cartDrawerFooter.style.display = '';
            if (cartSubtotal) cartSubtotal.textContent = formatPrice(subtotal) + ' RWF';
            if (cartTotal) cartTotal.textContent = formatPrice(subtotal) + ' RWF';
        }
    }

    if (!cartDrawerItems._delegated) {
        cartDrawerItems.addEventListener('click', function (e) {
            var qtyBtn = e.target.closest('[data-cart-qty]');
            if (qtyBtn) {
                var pid = qtyBtn.getAttribute('data-cart-pid');
                var delta = parseInt(qtyBtn.getAttribute('data-cart-qty'), 10);
                changeCartQty(pid, delta);
                return;
            }
            var removeBtn = e.target.closest('[data-cart-remove]');
            if (removeBtn) {
                var pid = removeBtn.getAttribute('data-cart-remove');
                removeCartItem(pid);
            }
        });
        cartDrawerItems._delegated = true;
    }

    function changeCartQty(productId, delta) {
        var cart = getCart();
        for (var i = 0; i < cart.length; i++) {
            if (cart[i].productId === productId) {
                cart[i].qty = (cart[i].qty || 1) + delta;
                if (cart[i].qty <= 0) {
                    cart.splice(i, 1);
                    showToast('Item removed from cart', 'info');
                }
                break;
            }
        }
        saveCart(cart);
        renderCart();
        updateCartBadge();
    }

    function removeCartItem(productId) {
        var cart = getCart();
        for (var i = 0; i < cart.length; i++) {
            if (cart[i].productId === productId) {
                cart.splice(i, 1);
                break;
            }
        }
        saveCart(cart);
        renderCart();
        updateCartBadge();
        showToast('Item removed from cart', 'info');
    }

    function openCart() {
        if (cartDrawerOverlay) {
            cartDrawerOverlay.classList.add('active');
            document.body.style.overflow = 'hidden';
            renderCart();
        }
    }

    function closeCart() {
        if (cartDrawerOverlay) {
            cartDrawerOverlay.classList.remove('active');
            if (!productDetailModal || !productDetailModal.classList.contains('active')) {
                document.body.style.overflow = '';
            }
        }
    }

    var productDetailModal = document.getElementById('productDetailModal');
    var pdModalImage = document.getElementById('pdModalImage');
    var pdModalName = document.getElementById('pdModalName');
    var pdModalCategory = document.getElementById('pdModalCategory');
    var pdModalAvailability = document.getElementById('pdModalAvailability');
    var pdModalPrice = document.getElementById('pdModalPrice');
    var pdModalDescription = document.getElementById('pdModalDescription');
    var pdModalFarmer = document.getElementById('pdModalFarmer');
    var pdModalDate = document.getElementById('pdModalDate');
    var pdModalClose = document.getElementById('pdModalClose');
    var pdModalCloseBtn = document.getElementById('pdModalCloseBtn');
    var pdModalAddToCart = document.getElementById('pdModalAddToCart');
    var currentModalProductId = null;

    function openProductModal(productId) {
        var product = null;
        for (var i = 0; i < allProducts.length; i++) {
            if (allProducts[i]._id === productId) {
                product = allProducts[i];
                break;
            }
        }
        if (!product) return;

        currentModalProductId = productId;
        var ownerName = (product.owner && product.owner.name) ? product.owner.name : 'Unknown Farmer';
        var hasImage = product.imageUrl && product.imageUrl.length > 0;

        if (hasImage) {
            pdModalImage.innerHTML = '<img src="' + escapeHtml(product.imageUrl) + '" alt="' + escapeHtml(product.name) + '">';
        } else {
            pdModalImage.innerHTML = '<div class="pd-modal-image-placeholder"><i class="fa-solid ' + getCategoryEmoji(product.category) + '"></i></div>';
        }

        pdModalName.textContent = product.name;
        pdModalCategory.innerHTML = '<i class="fa-solid ' + getCategoryEmoji(product.category) + '"></i> ' + escapeHtml(product.category);

        var isAvailable = product.status === 'approved';
        pdModalAvailability.textContent = isAvailable ? 'In Stock' : 'Out of Stock';
        pdModalAvailability.className = 'pd-modal-badge pd-modal-badge-availability' + (isAvailable ? '' : ' out-of-stock');

        pdModalPrice.innerHTML = formatPrice(product.price) + ' <span>RWF</span>';

        var descSpan = pdModalDescription.querySelector('.pd-modal-desc');
        if (descSpan) {
            descSpan.textContent = product.description || 'No description available.';
        }

        var farmerSpan = pdModalFarmer.querySelector('span');
        if (farmerSpan) {
            farmerSpan.textContent = ownerName;
        }

        var dateSpan = pdModalDate.querySelector('span');
        if (dateSpan) {
            dateSpan.textContent = 'Added ' + formatDate(product.createdAt);
        }

        productDetailModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeProductModal() {
        if (!productDetailModal) return;
        productDetailModal.classList.remove('active');
        document.body.style.overflow = '';
        currentModalProductId = null;
    }

    function filterAndRender() {
        var query = (marketplaceSearch && marketplaceSearch.value) ? marketplaceSearch.value.toLowerCase().trim() : '';
        var category = categoryFilter && categoryFilter.value ? categoryFilter.value : 'all';
        var sort = priceSort && priceSort.value ? priceSort.value : 'newest';
        var dateVal = dateFilter && dateFilter.value ? dateFilter.value : 'all';
        var availability = availabilityFilter && availabilityFilter.value ? availabilityFilter.value : 'all';

        var filtered = allProducts.filter(function (p) {
            var matchSearch = !query ||
                (p.name && p.name.toLowerCase().indexOf(query) !== -1) ||
                (p.category && p.category.toLowerCase().indexOf(query) !== -1) ||
                (p.description && p.description.toLowerCase().indexOf(query) !== -1) ||
                (p.owner && p.owner.name && p.owner.name.toLowerCase().indexOf(query) !== -1);

            var matchCategory = category === 'all' || p.category === category;

            var matchDate = true;
            if (dateVal !== 'all') {
                var now = new Date();
                var created = new Date(p.createdAt);
                if (dateVal === 'week') {
                    var weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    matchDate = created >= weekAgo;
                } else if (dateVal === 'month') {
                    var monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    matchDate = created >= monthAgo;
                }
            }

            var matchAvailability = true;
            if (availability === 'in-stock') {
                matchAvailability = p.status === 'approved';
            } else if (availability === 'out-of-stock') {
                matchAvailability = p.status !== 'approved';
            }

            return matchSearch && matchCategory && matchDate && matchAvailability;
        });

        if (sort === 'newest') {
            filtered.sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
        } else if (sort === 'low') {
            filtered.sort(function (a, b) { return a.price - b.price; });
        } else if (sort === 'high') {
            filtered.sort(function (a, b) { return b.price - a.price; });
        }

        renderProducts(filtered);
    }

    async function loadDashboard() {
        var token = getToken();
        if (!token) {
            window.location.href = '/auth';
            return;
        }

        try {
            var results = await Promise.all([
                fetch('/api/auth/me', {
                    headers: { 'Authorization': 'Bearer ' + token }
                }),
                fetch('/api/products')
            ]);

            var res = results[0];
            var prodRes = results[1];

            if (!res.ok) {
                handleLogout();
                return;
            }
            var user = await res.json();
            var userData = user.user || user;

            if (welcomeMessage) {
                welcomeMessage.textContent = 'Welcome, ' + (userData.name || 'Buyer') + '!';
            }
            if (welcomeSubtext) {
                welcomeSubtext.textContent = 'Browse fresh farm products and manage your orders on AgriConnect.';
            }

            if (prodRes.ok) {
                var rawProducts = await prodRes.json();
                allProducts = Array.isArray(rawProducts) ? rawProducts : (rawProducts.data || rawProducts.products || []);

                var available = document.getElementById('productsAvailableCount');
                if (available) {
                    available.textContent = allProducts.filter(function (p) { return p.status === 'approved'; }).length;
                }

                filterAndRender();
            }
        } catch (e) {
            console.error('Failed to load dashboard:', e);
            if (marketplaceGrid) marketplaceGrid.style.display = 'none';
            if (marketplaceEmpty) marketplaceEmpty.style.display = 'block';
        }
    }

    if (marketplaceSearch) {
        var searchTimer;
        marketplaceSearch.addEventListener('input', function () {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(filterAndRender, 250);
        });
    }

    if (categoryFilter) {
        categoryFilter.addEventListener('change', filterAndRender);
    }

    if (priceSort) {
        priceSort.addEventListener('change', filterAndRender);
    }

    if (dateFilter) {
        dateFilter.addEventListener('change', filterAndRender);
    }

    if (availabilityFilter) {
        availabilityFilter.addEventListener('change', filterAndRender);
    }

    if (pdModalClose) {
        pdModalClose.addEventListener('click', closeProductModal);
    }

    if (pdModalCloseBtn) {
        pdModalCloseBtn.addEventListener('click', closeProductModal);
    }

    if (productDetailModal) {
        productDetailModal.addEventListener('click', function (e) {
            if (e.target === productDetailModal) {
                closeProductModal();
            }
        });
    }

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            if (cartDrawerOverlay && cartDrawerOverlay.classList.contains('active')) {
                closeCart();
            } else if (productDetailModal && productDetailModal.classList.contains('active')) {
                closeProductModal();
            }
        }
    });

    if (pdModalAddToCart) {
        pdModalAddToCart.addEventListener('click', function () {
            if (currentModalProductId) {
                handleAddToCart(currentModalProductId);
            }
        });
    }

    if (cartBtn) {
        cartBtn.addEventListener('click', openCart);
    }

    if (cartDrawerClose) {
        cartDrawerClose.addEventListener('click', closeCart);
    }

    if (cartDrawerOverlay) {
        cartDrawerOverlay.addEventListener('click', function (e) {
            if (e.target === cartDrawerOverlay) {
                closeCart();
            }
        });
    }

    if (cartCheckoutBtn) {
        cartCheckoutBtn.addEventListener('click', function () {
            window.location.href = '/checkout';
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    initDarkMode();
    updateCartBadge();
    loadDashboard();
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
