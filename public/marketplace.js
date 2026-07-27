/* marketplace.js - Enhanced marketplace browsing for AgriConnect */
var Marketplace = (function () {
    'use strict';

    /* ===========================
       STATE & CACHE
       =========================== */
    var allProducts = [];
    var filteredProducts = [];
    var productsLoaded = false;
    var categories = ['Fruits', 'Vegetables', 'Grains', 'Livestock', 'Equipment', 'Other'];

    var state = {
        search: '',
        categories: [],
        priceMin: null,
        priceMax: null,
        inStock: false,
        recentlyAdded: false,
        sort: 'newest'
    };

    /* ===========================
       DOM REFS
       =========================== */
    var grid, searchInput, sortSelect, resultsCount, noResultsEl;

    function cacheDOM() {
        grid = document.getElementById('product-list');
        searchInput = document.getElementById('mp-search');
        sortSelect = document.getElementById('mp-sort');
        resultsCount = document.getElementById('mp-results-count');
    }

    /* ===========================
       INIT
       =========================== */
    async function init() {
        cacheDOM();
        loadStateFromURL();
        syncUIFromState();
        bindEvents();
        await loadProducts();
        applyFiltersAndRender();
        restoreScrollPosition();
    }

    /* ===========================
       API (reuses script.js apiFetch)
       =========================== */
    async function loadProducts() {
        if (productsLoaded && allProducts.length > 0) {
            applyFiltersAndRender();
            return;
        }
        if (grid) {
            grid.innerHTML = '<div class="ux-page-loading"><div class="ux-spinner ux-spinner-page"></div><p>Loading products...</p></div>';
        }
        try {
            var response = await apiFetch('/api/products', { headers: false });
            allProducts = Array.isArray(response) ? response : (response.data || response.products || []);
            productsLoaded = true;
        } catch (error) {
            allProducts = [];
            if (grid) {
                UX.emptyState(grid, { icon: 'fa-triangle-exclamation', title: 'Failed to load products', message: error.message });
            }
        }
    }

    async function refresh() {
        productsLoaded = false;
        await loadProducts();
        applyFiltersAndRender();
    }

    /* ===========================
       FILTERING
       =========================== */
    function applyFiltersAndRender() {
        filteredProducts = allProducts.filter(function (p) {
            if (state.search) {
                var q = state.search.toLowerCase();
                var nameMatch = p.name && p.name.toLowerCase().indexOf(q) !== -1;
                var catMatch = p.category && p.category.toLowerCase().indexOf(q) !== -1;
                var descMatch = p.description && p.description.toLowerCase().indexOf(q) !== -1;
                var farmerMatch = p.owner && p.owner.name && p.owner.name.toLowerCase().indexOf(q) !== -1;
                if (!nameMatch && !catMatch && !descMatch && !farmerMatch) return false;
            }
            if (state.categories.length > 0 && state.categories.indexOf(p.category) === -1) return false;
            if (state.priceMin !== null && p.price < state.priceMin) return false;
            if (state.priceMax !== null && p.price > state.priceMax) return false;
            if (state.recentlyAdded) {
                var days = (Date.now() - new Date(p.createdAt).getTime()) / 86400000;
                if (days > 7) return false;
            }
            return true;
        });

        sortProducts();
        renderGrid();
        updateResultsCount();
        saveStateToURL();
    }

    /* ===========================
       SORTING
       =========================== */
    function sortProducts() {
        var s = state.sort;
        filteredProducts.sort(function (a, b) {
            switch (s) {
                case 'newest': return new Date(b.createdAt) - new Date(a.createdAt);
                case 'oldest': return new Date(a.createdAt) - new Date(b.createdAt);
                case 'price-asc': return a.price - b.price;
                case 'price-desc': return b.price - a.price;
                case 'alpha': return (a.name || '').localeCompare(b.name || '');
                default: return new Date(b.createdAt) - new Date(a.createdAt);
            }
        });
    }

    /* ===========================
       RENDERING
       =========================== */
    function renderGrid() {
        if (!grid) return;
        if (filteredProducts.length === 0) {
            renderNoResults();
            return;
        }
        var fragment = document.createDocumentFragment();
        for (var i = 0; i < filteredProducts.length; i++) {
            fragment.appendChild(createCard(filteredProducts[i]));
        }
        grid.innerHTML = '';
        grid.appendChild(fragment);
    }

    function createCard(p) {
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

    function renderNoResults() {
        if (!grid) return;
        grid.innerHTML = '<div class="mp-no-results">'
            + '<div class="mp-no-results-icon"><i class="fa-solid fa-magnifying-glass"></i></div>'
            + '<h3>No matching products found</h3>'
            + '<p>Try adjusting your search or filters to find what you\'re looking for.</p>'
            + '<button class="mp-clear-btn" id="mp-clear-noresults"><i class="fa-solid fa-xmark"></i> Clear Filters</button>'
            + '</div>';
        var clearBtn = document.getElementById('mp-clear-noresults');
        if (clearBtn) clearBtn.addEventListener('click', clearFilters);
    }

    function updateResultsCount() {
        if (!resultsCount) return;
        var total = allProducts.length;
        var shown = filteredProducts.length;
        if (shown === total) {
            resultsCount.innerHTML = '<strong>' + total + '</strong> product' + (total !== 1 ? 's' : '');
        } else {
            resultsCount.innerHTML = 'Showing <strong>' + shown + '</strong> of ' + total + ' products';
        }
    }

    /* ===========================
       EVENT BINDING
       =========================== */
    var searchTimer;

    function bindEvents() {
        if (searchInput) {
            searchInput.addEventListener('input', function () {
                clearTimeout(searchTimer);
                var val = searchInput.value;
                searchTimer = setTimeout(function () {
                    state.search = val.trim();
                    applyFiltersAndRender();
                }, 250);
            });
            searchInput.value = state.search;
        }

        if (sortSelect) {
            sortSelect.addEventListener('change', function () {
                state.sort = sortSelect.value;
                applyFiltersAndRender();
            });
        }

        document.querySelectorAll('.mp-cat-check').forEach(function (cb) {
            cb.addEventListener('change', function () {
                state.categories = Array.from(document.querySelectorAll('.mp-cat-check:checked')).map(function (c) { return c.value; });
                applyFiltersAndRender();
            });
        });

        var priceMinEl = document.getElementById('mp-price-min');
        var priceMaxEl = document.getElementById('mp-price-max');
        if (priceMinEl) {
            priceMinEl.addEventListener('input', debounce(function () {
                state.priceMin = priceMinEl.value ? Number(priceMinEl.value) : null;
                applyFiltersAndRender();
            }, 400));
        }
        if (priceMaxEl) {
            priceMaxEl.addEventListener('input', debounce(function () {
                state.priceMax = priceMaxEl.value ? Number(priceMaxEl.value) : null;
                applyFiltersAndRender();
            }, 400));
        }

        var stockToggle = document.getElementById('mp-stock-toggle');
        if (stockToggle) {
            stockToggle.addEventListener('change', function () {
                state.inStock = stockToggle.checked;
                applyFiltersAndRender();
            });
        }

        var recentToggle = document.getElementById('mp-recent-toggle');
        if (recentToggle) {
            recentToggle.addEventListener('change', function () {
                state.recentlyAdded = recentToggle.checked;
                applyFiltersAndRender();
            });
        }

        var clearBtn = document.getElementById('mp-clear-filters');
        if (clearBtn) clearBtn.addEventListener('click', clearFilters);

        var formToggle = document.getElementById('mp-form-toggle');
        var formCollapse = document.getElementById('mp-form-collapse');
        if (formToggle && formCollapse) {
            formToggle.addEventListener('click', function () {
                formToggle.classList.toggle('open');
                formCollapse.classList.toggle('open');
            });
        }

        window.addEventListener('beforeunload', saveScrollPosition);
    }

    /* ===========================
       STATE PRESERVATION (URL + Scroll)
       =========================== */
    function saveStateToURL() {
        var params = new URLSearchParams();
        if (state.search) params.set('q', state.search);
        if (state.categories.length) params.set('category', state.categories.join(','));
        if (state.priceMin !== null) params.set('priceMin', state.priceMin);
        if (state.priceMax !== null) params.set('priceMax', state.priceMax);
        if (state.inStock) params.set('inStock', '1');
        if (state.recentlyAdded) params.set('recent', '1');
        if (state.sort !== 'newest') params.set('sort', state.sort);
        var qs = params.toString();
        var url = window.location.pathname + (qs ? '?' + qs : '');
        history.replaceState(null, '', url);
    }

    function loadStateFromURL() {
        var p = new URLSearchParams(window.location.search);
        state.search = p.get('q') || '';
        state.categories = p.get('category') ? p.get('category').split(',') : [];
        state.priceMin = p.get('priceMin') ? Number(p.get('priceMin')) : null;
        state.priceMax = p.get('priceMax') ? Number(p.get('priceMax')) : null;
        state.inStock = p.get('inStock') === '1';
        state.recentlyAdded = p.get('recent') === '1';
        state.sort = p.get('sort') || 'newest';
    }

    function syncUIFromState() {
        if (searchInput) searchInput.value = state.search;
        if (sortSelect) sortSelect.value = state.sort;
        document.querySelectorAll('.mp-cat-check').forEach(function (cb) {
            cb.checked = state.categories.indexOf(cb.value) !== -1;
        });
        var priceMinEl = document.getElementById('mp-price-min');
        var priceMaxEl = document.getElementById('mp-price-max');
        if (priceMinEl && state.priceMin !== null) priceMinEl.value = state.priceMin;
        if (priceMaxEl && state.priceMax !== null) priceMaxEl.value = state.priceMax;
        var stockToggle = document.getElementById('mp-stock-toggle');
        var recentToggle = document.getElementById('mp-recent-toggle');
        if (stockToggle) stockToggle.checked = state.inStock;
        if (recentToggle) recentToggle.checked = state.recentlyAdded;
    }

    function saveScrollPosition() {
        try { sessionStorage.setItem('mp-scroll', window.scrollY); } catch (e) {}
    }

    function restoreScrollPosition() {
        try {
            var pos = sessionStorage.getItem('mp-scroll');
            if (pos) {
                window.scrollTo(0, parseInt(pos, 10));
                sessionStorage.removeItem('mp-scroll');
            }
        } catch (e) {}
    }

    /* ===========================
       CLEAR FILTERS
       =========================== */
    function clearFilters() {
        state = { search: '', categories: [], priceMin: null, priceMax: null, inStock: false, recentlyAdded: false, sort: 'newest' };
        syncUIFromState();
        applyFiltersAndRender();
    }

    /* ===========================
       HELPERS
       =========================== */
    function esc(str) {
        if (typeof escapeHtml === 'function') return escapeHtml(str);
        if (typeof UX !== 'undefined' && UX.escapeHtml) return UX.escapeHtml(str);
        return String(str || '');
    }

    function debounce(fn, ms) {
        var timer;
        return function () {
            var args = arguments;
            var ctx = this;
            clearTimeout(timer);
            timer = setTimeout(function () { fn.apply(ctx, args); }, ms);
        };
    }

    function getCategoryCount(cat) {
        return allProducts.filter(function (p) { return p.category === cat; }).length;
    }

    /* ===========================
       PUBLIC API
       =========================== */
    return {
        init: init,
        refresh: refresh,
        clearFilters: clearFilters,
        getCategoryCount: getCategoryCount
    };
})();
