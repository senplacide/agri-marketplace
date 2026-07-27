// public/script.js

// --- 1. Utility Functions ---

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// --- Global Toast Notification System ---
function showToast(message, type) {
    type = type || 'info';
    if (typeof UX !== 'undefined' && UX.toast) {
        UX.toast(message, type);
        return;
    }
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
    toast.innerHTML = '<span class="toast-icon">' + (icons[type] || 'i') + '</span><span>' + escapeHtml(message) + '</span>';
    container.appendChild(toast);
    setTimeout(function () {
        toast.classList.add('toast-hide');
        setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
    }, 4000);
}

function showAlert(message) {
    if (message.includes("Failed to fetch")) {
        showToast("Unable to connect. Please check your internet and try again.", "error");
    } else {
        showToast(message, "error");
    }
    console.error("ALERT:", message);
}

// --- Button Loading Helper ---
function setBtnLoading(btn, loadingText) {
    if (!btn) return;
    if (loadingText === false) {
        btn.disabled = false;
        btn.classList.remove('btn-loading');
        if (btn._originalText) btn.innerHTML = btn._originalText;
        return;
    }
    btn._originalText = btn.innerHTML;
    btn.disabled = true;
    btn.classList.add('btn-loading');
    btn.innerHTML = '<span class="spinner spinner-sm"></span> ' + loadingText;
}
/**
 * Standardized API Fetch utility with JWT handling.
 * @param {string} endpoint - API path, e.g., '/api/auth/signup'
 * @param {object} options - Request options (method, body, etc.)
 * @param {boolean} headers - Set to true to include the Authorization header (default: true)
 * @returns {Promise<object>} JSON response data
 */
async function apiFetch(endpoint, { method = 'GET', body = null, headers = true } = {}) {

    const token = localStorage.getItem('token');
    const requestHeaders = {};

    if (headers && token) {
        requestHeaders['Authorization'] = `Bearer ${token}`;
    }

    if (body && !(body instanceof FormData)) {
    requestHeaders["Content-Type"] = "application/json";
}

    const response = await fetch(endpoint, {
        method,
        headers: requestHeaders,
        body: body
    ? (body instanceof FormData
        ? body
        : JSON.stringify(body))
    : null,
    });

    if (!response.ok) {
        let errorData = { message: 'An unknown error occurred' };

        try {
            errorData = await response.json();
        } catch (e) {}

        throw new Error(
            errorData.message ||
            errorData.error ||
            `API error: ${response.status}`
        );
    }

    if (response.status === 204) {
        return { message: 'Success (No Content)' };
    }

    return response.json();
}

// --- 2. User State and Navigation ---

let currentUser = null;

function getDashboardUrl(role) {
    if (role === 'admin') return '/admin.html';
    if (role === 'buyer') return '/buyer-dashboard';
    if (role === 'farmer') return '/dashboard';
    return '/';
}

async function loadCurrentUser() {
    const token = localStorage.getItem('token');
    if (!token) {
        currentUser = null;
        return;
    }
    try {
        const response = await apiFetch('/api/auth/me', { method: 'GET' });
        currentUser = response.user || response;
    } catch (error) {
        // Token is invalid or expired
        localStorage.removeItem('token');
        currentUser = null;
    }
}

function updateNav() {
    var role = currentUser ? currentUser.role : null;
    var dashboardUrl = getDashboardUrl(role);

    // Update logo href to route by role
    document.querySelectorAll('.public-logo, .nav-logo').forEach(function(logo) {
        logo.setAttribute('href', dashboardUrl || '/');
    });

    // Show/hide role-specific nav items in public navbar
    var effectiveRole = role || 'guest';
    document.querySelectorAll('[data-role]').forEach(function(el) {
        var allowedRoles = el.getAttribute('data-role').split(',');
        if (allowedRoles.indexOf(effectiveRole) !== -1) {
            el.style.display = '';
        } else {
            el.style.display = 'none';
        }
    });

    // Update auth-link container
    var authLinkContainer = document.getElementById('auth-link');
    if (!authLinkContainer) return;

    if (currentUser) {
        authLinkContainer.innerHTML =
            '<li><a href="' + dashboardUrl + '">Dashboard</a></li>' +
            '<li><a href="#" id="logout-btn">Logout</a></li>';
        var logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    } else {
        authLinkContainer.innerHTML =
            '<li><a href="/auth">Sign In / Sign Up</a></li>';
    }
}

function handleLogout(e) {
    e.preventDefault();
    localStorage.removeItem('token');
    currentUser = null;
    updateNav();
    window.location.href = '/';
}


// --- 3. Authentication Forms Logic (auth.html) ---

function loadAuthForms() {
    const signupForm = document.getElementById('signup-form');
    const loginForm = document.getElementById('login-form');

    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (typeof UX !== 'undefined') {
                var valid = UX.validateForm(signupForm, {
                    'signup-name': { required: true, requiredMsg: 'Please enter your full name', minLength: 2 },
                    'signup-email': { required: true, email: true },
                    'signup-password': { required: true, minLength: 6 }
                });
                if (!valid) return;
            }

            const name = document.getElementById('signup-name').value;
            const email = document.getElementById('signup-email').value;
            const password = document.getElementById('signup-password').value;
            const roleRadio = document.querySelector('input[name="signup-role"]:checked');
            const role = roleRadio ? roleRadio.value : 'farmer';

            const submitBtn = signupForm.querySelector('button[type="submit"]');
            setBtnLoading(submitBtn, 'Creating account...');

            try {
                const data = await apiFetch('/api/auth/signup', {
    method: 'POST',
    body: { name, email, password, role },
    headers: false
});

window.location =
"/verify?email=" +
encodeURIComponent(data.email);
signupForm.reset();
            } catch (error) {
                showAlert('Sign Up Failed: ' + error.message);
            } finally {
                setBtnLoading(submitBtn, false);
            }
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (typeof UX !== 'undefined') {
                var valid = UX.validateForm(loginForm, {
                    'login-email': { required: true, email: true },
                    'login-password': { required: true, minLength: 6 }
                });
                if (!valid) return;
            }

            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            const submitBtn = loginForm.querySelector('button[type="submit"]');
            setBtnLoading(submitBtn, 'Signing in...');

            try {
                const result = await apiFetch('/api/auth/login', { method: 'POST', body: { email, password }, headers: false });
                
                localStorage.setItem('token', result.token);
                await loadCurrentUser();
                updateNav();

                if (result.user.role === "admin") {
                    window.location.href = "/admin.html";
                } else if (result.user.role === "buyer") {
                    window.location.href = "/buyer-dashboard";
                } else {
                    window.location.href = "/dashboard";
                }
            } catch (error) {
                showAlert('Login Failed: ' + error.message);
            } finally {
                setBtnLoading(submitBtn, false);
            }
        });
    }
}


// --- 4. Product Listing Logic (items.html) ---

async function renderProducts() {
    const productList = document.getElementById('product-list');
    if (!productList) return;

    if (typeof UX !== 'undefined') {
        UX.pageLoading(productList, 'Loading products...');
    } else {
        productList.innerHTML = '<div class="page-loading"><div class="spinner-lg"></div><p>Loading products...</p></div>';
    }
    try {
        const response = await apiFetch('/api/products', { headers: false });
        const products = Array.isArray(response) ? response : (response.data || response.products || []);

        productList.innerHTML = '';
        if (products.length === 0) {
            if (typeof UX !== 'undefined') {
                UX.emptyState(productList, { icon: 'fa-box-open', title: 'No products listed yet', message: 'Be the first to list a product on the marketplace!' });
            } else {
                productList.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📦</div><p class="empty-state-text">No products listed yet</p><p class="empty-state-sub">Be the first to list a product on the marketplace!</p></div>';
            }
            return;
        }

        const fragment = document.createDocumentFragment();
        for (let i = 0; i < products.length; i++) {
            const product = products[i];
            const priceHtml = PriceFormatter.formatDual(product.price);
            const methods = product.paymentMethods?.join(', ') || 'Contact Seller';

            const card = document.createElement('div');
            card.className = 'product-card';
            card.innerHTML = `
                ${product.imageUrl ? `<img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}">` : ''}
                <h3>${escapeHtml(product.name)}</h3>
                <p><strong>Category:</strong> ${escapeHtml(product.category)}</p>
                <p><strong>Price:</strong> <span class="price-dual">${priceHtml}</span></p>
                <p><strong>Payment:</strong> <span style="color: var(--secondary-color); font-weight: 700;">${escapeHtml(methods)}</span></p>
                <p><strong>Contact:</strong> ${escapeHtml(product.contact || 'Not provided')}</p>
                <p>${escapeHtml(product.description || '')}</p>
            `;
            fragment.appendChild(card);
        }
        productList.appendChild(fragment);

    } catch (error) {
        if (typeof UX !== 'undefined') {
            UX.emptyState(productList, { icon: 'fa-triangle-exclamation', title: 'Failed to load products', message: error.message });
        } else {
            productList.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠️</div><p class="empty-state-text">Failed to load products</p><p class="empty-state-sub">' + escapeHtml(error.message) + '</p></div>';
        }
    }
}

function loadProductForm() {
    const productForm = document.getElementById('productForm');
    if (!productForm) return;

    const nameEl = document.getElementById("name");
    const priceEl = document.getElementById("price");
    const categoryEl = document.getElementById("category");
    const descriptionEl = document.getElementById("description");
    const contactEl = document.getElementById("contact");
    const paymentMethodsEl = document.getElementById("paymentMethods");
    const imageEl = document.getElementById("image");

    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!currentUser) {
            showAlert("You must be logged in to list a product.");
            return;
        }

        function getSelectedOptions(selectElement) {
            return Array.from(selectElement.options)
                        .filter(option => option.selected)
                        .map(option => option.value);
        }

        const productData = new FormData();

productData.append("name", nameEl.value);
productData.append("price", priceEl.value);
productData.append("category", categoryEl.value);
productData.append("description", descriptionEl.value);
productData.append("contact", contactEl.value);

const paymentMethods = getSelectedOptions(paymentMethodsEl);

paymentMethods.forEach(method => {
    productData.append("paymentMethods", method);
});

const imageFile = imageEl.files[0];

if (imageFile) {
    productData.append("image", imageFile);
}

        var submitBtn = productForm.querySelector('button[type="submit"]');
        if (submitBtn) setBtnLoading(submitBtn, 'Listing...');

        try {
            await apiFetch('/api/products', { method: 'POST', body: productData });
            showToast('Product listed successfully!', 'success');
            productForm.reset();
            if (typeof Marketplace !== 'undefined') {
                Marketplace.refresh();
            } else {
                renderProducts();
            }
        } catch (error) {
            showAlert('Failed to list product: ' + error.message);
        } finally {
            if (submitBtn) setBtnLoading(submitBtn, false);
        }
    });
}


// --- 5. Dashboard Logic (dashboard.html) ---

async function renderDashboard() {
    const greeting = document.getElementById('user-greeting');
    const dashboardProducts = document.getElementById('dashboard-products');
    
    // Check for login status
    if (!currentUser) {
        greeting.textContent = "Please sign in to view your dashboard.";
        dashboardProducts.innerHTML = '<p>Redirecting to login...</p>';
        setTimeout(() => window.location.href = '/auth', 2000);
        return;
    }

    greeting.textContent = `Welcome, ${currentUser.name}! (User ID: ${currentUser._id})`;
    if (typeof UX !== 'undefined') {
        UX.pageLoading(dashboardProducts, 'Loading your listings...');
    } else {
        dashboardProducts.innerHTML = '<div class="page-loading"><div class="spinner-lg"></div><p>Loading your listings...</p></div>';
    }

    try {
        // Hitting the backend route: GET /api/products/my-listings
        const response = await apiFetch('/api/products/my-listings');
        const myProducts = Array.isArray(response) ? response : (response.data || response.products || []);

        dashboardProducts.innerHTML = '';
        if (myProducts.length === 0) {
            if (typeof UX !== 'undefined') {
                UX.emptyState(dashboardProducts, { icon: 'fa-seedling', title: 'No listings yet', message: 'Start selling by listing your first product on the marketplace.', btnText: 'List a Product', btnHref: '/items', btnIcon: 'fa-plus' });
            } else {
                dashboardProducts.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🌱</div><p class="empty-state-text">No listings yet</p><p class="empty-state-sub">Start selling by listing your first product on the marketplace.</p><a href="/items" class="btn btn-primary" style="margin-top:8px;">List a Product</a></div>';
            }
            return;
        }

        const fragment = document.createDocumentFragment();
        for (let i = 0; i < myProducts.length; i++) {
            const product = myProducts[i];
            const priceHtml = PriceFormatter.formatDual(product.price);
            const methods = product.paymentMethods?.join(', ') || 'Contact Seller';

            const card = document.createElement('div');
            card.className = 'product-card';
            card.id = `product-${product._id}`;
            card.innerHTML = `
                ${product.imageUrl ? `<img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}">` : ''}
                <h3>${escapeHtml(product.name)} (Your Listing)</h3>
                <p><strong>Category:</strong> ${escapeHtml(product.category)}</p>
                <p><strong>Price:</strong> <span class="price-dual">${priceHtml}</span></p>
                <p><strong>Payment:</strong> <span style="color: var(--secondary-color); font-weight: 700;">${escapeHtml(methods)}</span></p>
                <p><strong>Contact:</strong> ${escapeHtml(product.contact || 'Not provided')}</p>
                <p>${escapeHtml(product.description || '')}</p>
                <div class="listing-actions">
    <button class="btn edit-btn" data-id="${product._id}">
        Edit Listing
    </button>

    <button class="btn delete-btn" data-id="${product._id}">
        Delete Listing
    </button>
</div>
            `;
            fragment.appendChild(card);
        }
        dashboardProducts.appendChild(fragment);

        // Add event listeners for delete buttons
        dashboardProducts.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', handleDeleteProduct);
        });
        dashboardProducts.querySelectorAll('.edit-btn').forEach(button => {
    button.addEventListener('click', handleEditProduct);
});

    } catch (error) {
        if (typeof UX !== 'undefined') {
            UX.emptyState(dashboardProducts, { icon: 'fa-triangle-exclamation', title: 'Failed to load listings', message: error.message });
        } else {
            dashboardProducts.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠️</div><p class="empty-state-text">Failed to load listings</p><p class="empty-state-sub">' + escapeHtml(error.message) + '</p></div>';
        }
    }
}
async function handleEditProduct(e) {
    const productId = e.target.getAttribute('data-id');

    const card = document.getElementById(`product-${productId}`);

    card.innerHTML += `
        <div class="edit-form" id="edit-form-${productId}">

    <input
        type="text"
        id="edit-name-${productId}"
        placeholder="Product Name"
    >

    <input
        type="number"
        id="edit-price-${productId}"
        placeholder="Price"
    >

    <input
        type="text"
        id="edit-contact-${productId}"
        placeholder="Contact"
    >

    <textarea
        id="edit-description-${productId}"
        placeholder="Description"
    ></textarea>

    <label><strong>Replace Product Image</strong></label>

    <input
        type="file"
        id="edit-image-${productId}"
        accept="image/*"
    >

    <button
        class="btn save-btn"
        data-id="${productId}"
    >
        Save Changes
    </button>

</div>
    `;

    card.querySelector(".save-btn")
        .addEventListener("click", handleSaveProduct);
}
async function handleSaveProduct(e) {

    const productId = e.target.getAttribute("data-id");

    const formData = new FormData();

    formData.append(
        "name",
        document.getElementById(`edit-name-${productId}`).value
    );

    formData.append(
        "price",
        document.getElementById(`edit-price-${productId}`).value
    );

    formData.append(
        "contact",
        document.getElementById(`edit-contact-${productId}`).value
    );

    formData.append(
        "description",
        document.getElementById(`edit-description-${productId}`).value
    );

    const imageFile =
        document.getElementById(`edit-image-${productId}`).files[0];

    if (imageFile) {
        formData.append("image", imageFile);
    }

    try {

        await apiFetch(`/api/products/${productId}`, {
            method: "PUT",
            body: formData
        });

        showToast("Listing updated successfully!", 'success');

        renderDashboard();

    } catch (error) {

        showAlert("Failed to update listing: " + error.message);

    }

}
async function handleDeleteProduct(e) {
    const productId = e.target.getAttribute('data-id');
    if (!confirm('Are you sure you want to delete this product listing?')) {
        return;
    }

    const btn = e.target.closest('button');
    if (btn) setBtnLoading(btn, 'Deleting...');

    try {
        await apiFetch(`/api/products/${productId}`, { method: 'DELETE' });
        document.getElementById(`product-${productId}`).remove();
        showToast('Listing deleted successfully.', 'success');
    } catch (error) {
        showAlert('Failed to delete listing: ' + error.message);
    } finally {
        if (btn) setBtnLoading(btn, false);
    }
}


// --- 6. Contact Form Logic (contact.html) ---

function loadContactForm() {
    const contactForm = document.getElementById("contact-form");
    const statusMessage = document.getElementById("contact-status");

    if (contactForm) {
        contactForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            if (typeof UX !== 'undefined') {
                var valid = UX.validateForm(contactForm, {
                    'contact-name': { required: true, requiredMsg: 'Please enter your name' },
                    'contact-email': { required: true, email: true },
                    'contact-message': { required: true, requiredMsg: 'Please enter a message', minLength: 10 }
                });
                if (!valid) return;
            }

            statusMessage.textContent = "Sending message...";
            statusMessage.style.color = "#4299e1"; 

            const data = {
                name: document.getElementById("contact-name").value,
                email: document.getElementById("contact-email").value,
                subject: document.getElementById("contact-subject")?.value || 'General Inquiry',
                message: document.getElementById("contact-message").value,
            };

            const submitBtn = contactForm.querySelector('button[type="submit"]');
            if (submitBtn) setBtnLoading(submitBtn, 'Sending...');

            try {
                const result = await apiFetch("/api/contact", { 
                    method: "POST", 
                    body: data,
                    headers: false
                });

                statusMessage.textContent = result.message || "Message sent successfully! We will be in touch soon.";
                statusMessage.style.color = result.status === 'success_with_warning' ? '#f6ad55' : '#16a34a';
                showToast(result.message || "Message sent successfully!", result.status === 'success_with_warning' ? 'warning' : 'success');
                contactForm.reset();

            } catch (err) {
                const errorMessage = "Failed to send message: " + err.message;
                statusMessage.textContent = errorMessage;
                statusMessage.style.color = "#e53e3e";
                showToast(errorMessage, 'error');
            } finally {
                if (submitBtn) setBtnLoading(submitBtn, false);
            }
        });
    }
}


// --- 8. Onboarding Banner Logic (items.html) ---

function renderOnboardingBanner() {
    const bannerContainer = document.getElementById('onboarding-banner');
    if (!bannerContainer) return;

    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');

    if (!mode) {
        bannerContainer.innerHTML = '';
        return;
    }

    const userRole = currentUser?.role;

    if (mode === 'buyer' && (userRole === 'buyer' || userRole === 'admin')) {
        bannerContainer.innerHTML = '';
        return;
    }

    if (mode === 'seller' && (userRole === 'farmer' || userRole === 'admin')) {
        bannerContainer.innerHTML = '';
        return;
    }

    if (mode === 'buyer') {
        bannerContainer.innerHTML = `
            <div class="onboarding-banner onboarding-buyer">
                <div class="onboarding-content">
                    <div class="onboarding-icon">&#x1F6D2;</div>
                    <div class="onboarding-text">
                        <h2>Welcome to the AgriConnect Marketplace</h2>
                        <p class="onboarding-subtitle">Discover fresh agricultural products directly from verified farmers.</p>
                        <ul class="onboarding-benefits">
                            <li><span class="benefit-check">&#x2713;</span> Browse products</li>
                            <li><span class="benefit-check">&#x2713;</span> Search by category</li>
                            <li><span class="benefit-check">&#x2713;</span> Compare prices</li>
                            <li><span class="benefit-check">&#x2713;</span> Save favourites</li>
                            <li><span class="benefit-check">&#x2713;</span> Create a free buyer account</li>
                        </ul>
                        <div class="onboarding-actions">
                            <a href="/auth" class="public-btn onboarding-primary-btn">Create Buyer Account</a>
                            <a href="/items" class="public-btn onboarding-secondary-btn">Continue Browsing</a>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } else if (mode === 'seller') {
        bannerContainer.innerHTML = `
            <div class="onboarding-banner onboarding-seller">
                <div class="onboarding-content">
                    <div class="onboarding-icon">&#x1F33E;</div>
                    <div class="onboarding-text">
                        <h2>Become a Seller on AgriConnect</h2>
                        <p class="onboarding-subtitle">Reach more buyers and grow your farming business.</p>
                        <ul class="onboarding-benefits">
                            <li><span class="benefit-check">&#x2713;</span> Sell directly to buyers</li>
                            <li><span class="benefit-check">&#x2713;</span> Upload products</li>
                            <li><span class="benefit-check">&#x2713;</span> Manage inventory</li>
                            <li><span class="benefit-check">&#x2713;</span> Receive orders</li>
                            <li><span class="benefit-check">&#x2713;</span> Track sales</li>
                        </ul>
                        <div class="onboarding-actions">
                            <a href="/auth" class="public-btn onboarding-primary-btn">Register as Farmer</a>
                            <a href="/about" class="public-btn onboarding-secondary-btn">Learn More</a>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}


// --- 7. Initialization ---

document.addEventListener("DOMContentLoaded", async () => {
    await loadCurrentUser(); 
    updateNav();

    const hasProductForm = document.getElementById("productForm");
    const hasProductList = document.getElementById("product-list");
    const hasSignupForm = document.getElementById("signup-form");
    const hasLoginForm = document.getElementById("login-form");
    const hasDashboardProducts = document.getElementById("dashboard-products");
    const hasContactForm = document.getElementById("contact-form");
    const startSellingBtn = document.getElementById("start-selling-btn");

    if (hasProductForm) loadProductForm();
    if (hasProductList && typeof Marketplace === 'undefined') renderProducts();
    if (hasSignupForm || hasLoginForm) loadAuthForms();
    if (hasDashboardProducts) renderDashboard();
    if (hasContactForm) loadContactForm();
    renderOnboardingBanner();

if (startSellingBtn) {
    startSellingBtn.addEventListener("click", (e) => {
        e.preventDefault();
        if (currentUser) {
            window.location.href = "/items?mode=seller";
        } else {
            window.location.href = "/auth";
        }
    });
}

});