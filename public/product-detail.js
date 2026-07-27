/* product-detail.js - Product detail page for AgriConnect */
var ProductDetail = (function () {
    'use strict';

    var loadingEl, notFoundEl, contentEl, imageEl, infoEl, relatedSection, relatedGrid;
    var allProducts = [];

    function init() {
        loadingEl = document.getElementById('pd-loading');
        notFoundEl = document.getElementById('pd-not-found');
        contentEl = document.getElementById('pd-content');
        imageEl = document.getElementById('pd-image');
        infoEl = document.getElementById('pd-info');
        relatedSection = document.getElementById('pd-related');
        relatedGrid = document.getElementById('pd-related-grid');

        var id = new URLSearchParams(window.location.search).get('id');
        if (!id) {
            showNotFound();
            return;
        }
        loadAndRender(id);
    }

    async function loadAndRender(id) {
        try {
            var response = await apiFetch('/api/products', { headers: false });
            allProducts = Array.isArray(response) ? response : (response.data || response.products || []);
        } catch (e) {
            allProducts = [];
        }

        var product = null;
        for (var i = 0; i < allProducts.length; i++) {
            if (allProducts[i]._id === id) {
                product = allProducts[i];
                break;
            }
        }

        if (!product) {
            showNotFound();
            return;
        }

        renderDetail(product);
        renderRelated(product);
    }

    function renderDetail(p) {
        loadingEl.style.display = 'none';
        contentEl.style.display = 'block';

        document.title = esc(p.name) + ' | AgriConnect';

        // Image
        if (p.imageUrl) {
            imageEl.innerHTML = '<img src="' + esc(p.imageUrl) + '" alt="' + esc(p.name) + '" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">'
                + '<div class="pd-image-placeholder" style="display:none"><i class="fa-solid fa-image"></i></div>';
        } else {
            imageEl.innerHTML = '<div class="pd-image-placeholder"><i class="fa-solid fa-seedling"></i></div>';
        }

        // Info
        var farmerName = (p.owner && p.owner.name) ? esc(p.owner.name) : 'Unknown Farmer';
        var priceHtml = (typeof PriceFormatter !== 'undefined') ? PriceFormatter.formatDual(p.price) : esc(p.price + ' RWF');
        var methods = p.paymentMethods || [];
        var methodsHtml = '';
        var methodIcons = { 'Mobile Money (MoMo)': 'fa-mobile-screen', 'Visa Card': 'fa-credit-card' };
        for (var i = 0; i < methods.length; i++) {
            var icon = methodIcons[methods[i]] || 'fa-wallet';
            methodsHtml += '<span class="pd-payment-tag"><i class="fa-solid ' + icon + '"></i> ' + esc(methods[i]) + '</span>';
        }

        var contactHtml = p.contact
            ? '<div class="pd-info-row"><i class="fa-solid fa-phone"></i><strong>Contact:</strong> ' + esc(p.contact) + '</div>'
            : '';

        var descHtml = p.description
            ? '<div class="pd-info-group"><h3 style="margin:0 0 12px;font-size:1rem;font-weight:700;color:var(--public-text,#1e293b);">Description</h3><div class="pd-description">' + esc(p.description) + '</div></div>'
            : '';

        var dateStr = '';
        if (p.createdAt) {
            var d = new Date(p.createdAt);
            dateStr = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        }

        infoEl.innerHTML = ''
            + '<span class="pd-category-badge"><i class="fa-solid fa-tag"></i> ' + esc(p.category) + '</span>'
            + '<h1 class="pd-title">' + esc(p.name) + '</h1>'
            + '<div class="pd-price-block">'
            + '<div class="pd-price-rwf">' + priceHtml + '</div>'
            + '</div>'
            + '<div class="pd-stock-badge in-stock"><i class="fa-solid fa-circle-check"></i> In Stock</div>'
            + '<div class="pd-info-group">'
            + '<div class="pd-info-row"><i class="fa-solid fa-user"></i><strong>Seller:</strong> ' + farmerName + '</div>'
            + contactHtml
            + '<div class="pd-info-row"><i class="fa-solid fa-calendar"></i><strong>Listed:</strong> ' + dateStr + '</div>'
            + '</div>'
            + (methodsHtml
                ? '<div class="pd-info-group"><h3 style="margin:0 0 12px;font-size:1rem;font-weight:700;color:var(--public-text,#1e293b);">Payment Methods</h3><div class="pd-payment-list">' + methodsHtml + '</div></div>'
                : '')
            + descHtml
            + (p.contact
                ? '<a href="tel:' + esc(p.contact) + '" class="pd-contact-btn"><i class="fa-solid fa-phone"></i> Contact Seller</a>'
                : '');
    }

    function renderRelated(currentProduct) {
        var related = [];
        for (var i = 0; i < allProducts.length; i++) {
            if (allProducts[i]._id !== currentProduct._id && allProducts[i].category === currentProduct.category) {
                related.push(allProducts[i]);
            }
        }
        if (related.length === 0) {
            relatedSection.style.display = 'none';
            return;
        }

        related = related.slice(0, 6);

        relatedSection.style.display = 'block';
        relatedGrid.innerHTML = '';

        for (var j = 0; j < related.length; j++) {
            relatedGrid.appendChild(createRelatedCard(related[j]));
        }
    }

    function createRelatedCard(p) {
        var card = document.createElement('div');
        card.className = 'mp-card';

        var imgHtml;
        if (p.imageUrl) {
            imgHtml = '<div class="mp-card-img-wrap">'
                + '<img src="' + esc(p.imageUrl) + '" alt="' + esc(p.name) + '" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">'
                + '<div class="mp-card-placeholder" style="display:none"><i class="fa-solid fa-image"></i></div>'
                + '</div>';
        } else {
            imgHtml = '<div class="mp-card-img-wrap"><div class="mp-card-placeholder"><i class="fa-solid fa-seedling"></i></div></div>';
        }

        var farmerName = (p.owner && p.owner.name) ? esc(p.owner.name) : 'Unknown Farmer';
        var priceHtml = (typeof PriceFormatter !== 'undefined') ? PriceFormatter.formatDual(p.price) : esc(p.price + ' RWF');

        card.innerHTML = imgHtml
            + '<div class="mp-card-body">'
            + '<div class="mp-card-top">'
            + '<span class="mp-card-category"><i class="fa-solid fa-tag"></i> ' + esc(p.category) + '</span>'
            + '<span class="mp-card-stock"><i class="fa-solid fa-circle-check"></i> Available</span>'
            + '</div>'
            + '<h3 class="mp-card-title">' + esc(p.name) + '</h3>'
            + '<div class="mp-card-farmer"><i class="fa-solid fa-user"></i> ' + farmerName + '</div>'
            + '<div class="mp-card-price">' + priceHtml + '</div>'
            + '<a href="/item.html?id=' + encodeURIComponent(p._id) + '" class="mp-card-btn">View Details <i class="fa-solid fa-arrow-right"></i></a>'
            + '</div>';

        return card;
    }

    function showNotFound() {
        loadingEl.style.display = 'none';
        notFoundEl.style.display = 'block';
        contentEl.style.display = 'none';
    }

    function esc(str) {
        if (typeof escapeHtml === 'function') return escapeHtml(str);
        if (typeof UX !== 'undefined' && UX.escapeHtml) return UX.escapeHtml(str);
        return String(str || '');
    }

    return { init: init };
})();
