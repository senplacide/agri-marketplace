// public/script.js

// --- 1. Utility Functions ---

/**
 * Global alert utility
 * @param {string} message 
 */
function showAlert(message) {
    // A simple console log for now, but in a real app, this would show a visible message banner.
    console.error("ALERT:", message); 
    // You can implement a simple visual alert here:
    // alert(message); 
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

    if (body) {
        requestHeaders['Content-Type'] = 'application/json';
    }

    const response = await fetch(endpoint, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : null,
    });

    // Check for network errors or bad status codes
    if (!response.ok) {
        let errorData = { message: 'An unknown error occurred' };
        try {
            errorData = await response.json();
        } catch (e) {
            // response body wasn't JSON
        }
        throw new Error(errorData.message || `API error: ${response.status}`);
    }

    // Handle 204 No Content responses
    if (response.status === 204) {
        return { message: 'Success (No Content)' };
    }

    return response.json();
}


// --- 2. User State and Navigation ---

let currentUser = null;

async function loadCurrentUser() {
    const token = localStorage.getItem('token');
    if (!token) {
        currentUser = null;
        return;
    }
    try {
        // Assuming there is a route like /api/auth/me that returns user data
        const user = await apiFetch('/api/auth/me', { method: 'GET' });
        // The backend /api/auth/me returns the user object directly, not {user: user}
        currentUser = user; 
    } catch (error) {
        // Token is invalid or expired
        localStorage.removeItem('token');
        currentUser = null;
    }
}

function updateNav() {
    const authLinkContainer = document.getElementById('auth-link');
    if (!authLinkContainer) return;

    if (currentUser) {
        // User is logged in: show Dashboard and Logout
        authLinkContainer.innerHTML = `
            <li><a href="/dashboard">Dashboard</a></li>
            <li><a href="#" id="logout-btn">Logout</a></li>
        `;
        document.getElementById('logout-btn')?.addEventListener('click', handleLogout);
    } else {
        // User is logged out: show Sign In / Sign Up
        authLinkContainer.innerHTML = `
            <li><a href="/auth">Sign In / Sign Up</a></li>
        `;
    }
}

function handleLogout(e) {
    e.preventDefault();
    localStorage.removeItem('token');
    currentUser = null;
    updateNav();
    window.location.href = '/'; // Redirect to home page
}


// --- 3. Authentication Forms Logic (auth.html) ---

function loadAuthForms() {
    const signupForm = document.getElementById('signup-form');
    const loginForm = document.getElementById('login-form');

    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('signup-name').value;
            const email = document.getElementById('signup-email').value;
            const password = document.getElementById('signup-password').value;

            try {
                // Hitting the backend route: POST /api/auth/signup
                await apiFetch('/api/auth/signup', { method: 'POST', body: { name, email, password }, headers: false });
                alert('Sign Up successful! Please sign in now.');
                signupForm.reset();
            } catch (error) {
                showAlert('Sign Up Failed: ' + error.message);
            }
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            try {
                // Hitting the backend route: POST /api/auth/login
                const result = await apiFetch('/api/auth/login', { method: 'POST', body: { email, password }, headers: false });
                
                // Store the JWT token
                localStorage.setItem('token', result.token);
                
                // Reload user and update UI
                await loadCurrentUser();
                updateNav();
                
                // Redirect to dashboard on successful login
                window.location.href = '/dashboard'; 
            } catch (error) {
                showAlert('Login Failed: ' + error.message);
            }
        });
    }
}


// --- 4. Product Listing Logic (items.html) ---

async function renderProducts() {
    const productList = document.getElementById('product-list');
    if (!productList) return;

    productList.innerHTML = '<p>Loading products...</p>';
    try {
        // Hitting the backend route: GET /api/products
        const products = await apiFetch('/api/products', { headers: false });
        
        productList.innerHTML = ''; 
        if (products.length === 0) {
            productList.innerHTML = '<p>No products listed yet. Be the first!</p>';
            return;
        }

        products.forEach(product => {
            // Function to format price
            const price = new Intl.NumberFormat('en-RW', { style: 'currency', currency: 'RWF' }).format(product.price);
            
            // Format payment methods for display
            const methods = product.paymentMethods?.join(', ') || 'Contact Seller'; // CORRECTED LOGIC

            const card = document.createElement('div');
            card.className = 'product-card';
            card.innerHTML = `
                ${product.imageUrl ? `<img src="${product.imageUrl}" alt="${product.name}">` : ''}
                <h3>${product.name}</h3>
                <p><strong>Category:</strong> ${product.category}</p>
                <p><strong>Price:</strong> ${price}</p>
                <p><strong>Payment:</strong> <span style="color: var(--secondary-color); font-weight: 700;">${methods}</span></p>
                <p><strong>Contact:</strong> ${product.contact}</p>
                <p>${product.description}</p>
            `;
            productList.appendChild(card);
        });

    } catch (error) {
        productList.innerHTML = `<p style="color: red;">Failed to load products: ${error.message}</p>`;
    }
}

function loadProductForm() {
    const productForm = document.getElementById('productForm');
    if (!productForm) return;

    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!currentUser) {
            showAlert("You must be logged in to list a product.");
            return;
        }

        // Helper function to get multiple selected options from a select element
        function getSelectedOptions(selectElement) {
            return Array.from(selectElement.options)
                        .filter(option => option.selected)
                        .map(option => option.value);
        }

        const productData = {
            name: document.getElementById('name').value,
            price: document.getElementById('price').value,
            category: document.getElementById('category').value,
            description: document.getElementById('description').value,
            contact: document.getElementById('contact').value,
            imageUrl: document.getElementById('imageUrl').value || undefined, 
            paymentMethods: getSelectedOptions(document.getElementById('paymentMethods')), // NEW DATA FIELD
        };

        try {
            // Hitting the backend route: POST /api/products
            await apiFetch('/api/products', { method: 'POST', body: productData });
            alert('Product listed successfully!');
            productForm.reset();
            renderProducts(); // Refresh the list
        } catch (error) {
            showAlert('Failed to list product: ' + error.message);
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
    dashboardProducts.innerHTML = '<p>Loading your listings...</p>';

    try {
        // Hitting the backend route: GET /api/products/my-listings
        const myProducts = await apiFetch('/api/products/my-listings'); 

        dashboardProducts.innerHTML = '';
        if (myProducts.length === 0) {
            dashboardProducts.innerHTML = '<p>You have no active listings. <a href="/items">List your first product here!</a></p>';
            return;
        }

        myProducts.forEach(product => {
            const price = new Intl.NumberFormat('en-RW', { style: 'currency', currency: 'RWF' }).format(product.price);
            const methods = product.paymentMethods?.join(', ') || 'Contact Seller'; // CORRECTED LOGIC

            const card = document.createElement('div');
            card.className = 'product-card';
            card.id = `product-${product._id}`;
            card.innerHTML = `
                ${product.imageUrl ? `<img src="${product.imageUrl}" alt="${product.name}">` : ''}
                <h3>${product.name} (Your Listing)</h3>
                <p><strong>Category:</strong> ${product.category}</p>
                <p><strong>Price:</strong> ${price}</p>
                <p><strong>Payment:</strong> <span style="color: var(--secondary-color); font-weight: 700;">${methods}</span></p>
                <p><strong>Contact:</strong> ${product.contact}</p>
                <p>${product.description}</p>
                <button class="btn delete-btn" data-id="${product._id}">Delete Listing</button>
            `;
            dashboardProducts.appendChild(card);
        });

        // Add event listeners for delete buttons
        dashboardProducts.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', handleDeleteProduct);
        });

    } catch (error) {
        dashboardProducts.innerHTML = `<p style="color: red;">Failed to load listings: ${error.message}</p>`;
    }
}

async function handleDeleteProduct(e) {
    const productId = e.target.getAttribute('data-id');
    if (!confirm('Are you sure you want to delete this product listing?')) {
        return;
    }

    try {
        // Hitting the backend route: DELETE /api/products/:id
        await apiFetch(`/api/products/${productId}`, { method: 'DELETE' });
        
        // Remove the card from the DOM
        document.getElementById(`product-${productId}`).remove();
        alert('Listing deleted successfully.');
    } catch (error) {
        showAlert('Failed to delete listing: ' + error.message);
    }
}


// --- 6. Contact Form Logic (contact.html) ---

function loadContactForm() {
    const contactForm = document.getElementById("contact-form");
    const statusMessage = document.getElementById("contact-status");

    if (contactForm) {
        contactForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            statusMessage.textContent = "Sending message...";
            statusMessage.style.color = "#4299e1"; 

            const data = {
                name: document.getElementById("contact-name").value,
                email: document.getElementById("contact-email").value,
                subject: document.getElementById("contact-subject")?.value || 'General Inquiry',
                message: document.getElementById("contact-message").value,
            };

            try {
                // Send data to the new /api/contact route
                const result = await apiFetch("/api/contact", { 
                    method: "POST", 
                    body: data,
                    headers: false // Public form, no token needed
                });

                statusMessage.textContent = result.message || "Message sent successfully! We will be in touch soon.";
                statusMessage.style.color = result.status === 'success_with_warning' ? '#f6ad55' : 'green'; 
                contactForm.reset();

            } catch (err) {
                const errorMessage = "Failed to send message: " + err.message;
                statusMessage.textContent = errorMessage;
                statusMessage.style.color = "#e53e3e"; 
                showAlert(errorMessage); 
            }
        });
    }
}


// --- 7. Initialization ---

document.addEventListener("DOMContentLoaded", async () => {
    // 1. Load user state before updating navigation
    await loadCurrentUser(); 
    
    // 2. Update navigation links (Sign In/Dashboard)
    updateNav();
    
    // 3. Execute page-specific functions
    if (document.getElementById("productForm")) { // On items.html
        loadProductForm();
    }
    if (document.getElementById("product-list")) { // On items.html
        renderProducts();
    }
    if (document.getElementById("signup-form") || document.getElementById("login-form")) { // On auth.html
        loadAuthForms();
    }
    if (document.getElementById("dashboard-products")) { // On dashboard.html
        renderDashboard();
    }
    if (document.getElementById("contact-form")) { // On contact.html
        loadContactForm(); 
    }
});