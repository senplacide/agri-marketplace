process.env.NODE_ENV = 'test';

const assert = require('assert');
const http = require('http');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// Build a dedicated, disposable test database (never touches prod data).
require('dotenv').config();
const baseUri = process.env.MONGO_URI;
if (!baseUri) {
    console.error('MONGO_URI missing');
    process.exit(1);
}
const testDbName = 'agri-marketplace-uat-' + Date.now();
const TEST_MONGO_URI = baseUri.replace(/\/[^/?#]*(?=[?#]|$)/, '/' + testDbName);

// Disable email credentials so every email send fails fast.
// This is intentional: H5 requires in-app notifications to be created
// independently of email success.
process.env.EMAIL_SERVICE_USER = '';
process.env.EMAIL_SERVICE_PASS = '';
process.env.SENDER_EMAIL = '';
process.env.MONGO_URI = TEST_MONGO_URI;

const app = require('../server');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Notification = require('../models/Notification');
const { JWT_SECRET } = require('../middleware/auth');

let server;
let port;

function makeRequest(path, method, body, token) {
    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : undefined;
        const headers = {};
        if (payload) headers['Content-Type'] = 'application/json';
        if (token) headers['Authorization'] = 'Bearer ' + token;
        if (payload) headers['Content-Length'] = Buffer.byteLength(payload);
        const req = http.request(
            { hostname: '127.0.0.1', port, path, method, headers },
            (res) => {
                let data = '';
                res.on('data', (c) => { data += c; });
                res.on('end', () => {
                    let json = null;
                    try { json = JSON.parse(data); } catch (e) { /* ignore */ }
                    resolve({ statusCode: res.statusCode, body: json, raw: data });
                });
            }
        );
        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
    });
}

let passed = 0;
let failed = 0;

function check(name, cond, detail) {
    if (cond) {
        passed++;
        console.log('  [PASS] ' + name + (detail ? ' -> ' + detail : ''));
    } else {
        failed++;
        console.log('  [FAIL] ' + name + (detail ? ' -> ' + detail : ''));
        throw new Error('Assertion failed: ' + name);
    }
}

async function expectStatus(name, res, expected) {
    const detail = res.body && res.body.error ? (res.body.error + '') : (res.raw || '').slice(0, 120);
    check(name, res.statusCode === expected, 'expected ' + expected + ', got ' + res.statusCode + (res.statusCode === expected ? '' : ' | ' + detail));
    return res.body;
}

function signToken(user) {
    return jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

async function createUser(role, label) {
    const email = 'uat-' + label + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '@example.com';
    const user = await User.create({
        name: label.charAt(0).toUpperCase() + label.slice(1),
        email: email,
        passwordHash: await bcrypt.hash('Uat!test12345', 10),
        role: role,
        isVerified: true
    });
    return { user: user, token: signToken(user) };
}

async function createProduct(ownerId, name, overrides) {
    return Product.create(Object.assign({
        name: name,
        price: 1000,
        category: 'Grains',
        description: 'UAT test product',
        contact: '+250700000001',
        quantity: 10,
        paymentMethods: ['Mobile Money (MoMo)'],
        status: 'approved',
        owner: ownerId
    }, overrides || {}));
}

function deliveryInfo() {
    return {
        fullName: 'UAT Buyer',
        phone: '+250700000000',
        streetAddress: '12 Test Road',
        city: 'Kigali',
        stateProvinceRegion: '',
        postalCode: '',
        country: 'Rwanda'
    };
}

function orderItem(product, qty) {
    return {
        productId: product._id.toString(),
        productName: product.name,
        category: product.category,
        imageUrl: '',
        farmerName: '',
        unitPrice: product.price,
        quantity: qty
    };
}

(async () => {
    try {
        console.log('[setup] Connecting to test DB: ' + testDbName);
        await mongoose.connect(TEST_MONGO_URI, { serverSelectionTimeoutMS: 15000 });

        server = app.listen(0, '127.0.0.1');
        await new Promise((resolve) => server.once('listening', resolve));
        port = server.address().port;

        console.log('[setup] Creating test users and products');
        const buyer = await createUser('buyer', 'buyer');
        const farmer = await createUser('farmer', 'farmer');
        const pInStock = await createProduct(farmer.user._id, 'UAT In Stock Maize', { price: 1000, quantity: 10 });
        const pZeroStock = await createProduct(farmer.user._id, 'UAT Zero Stock Beans', { quantity: 0 });
        const pPending = await createProduct(farmer.user._id, 'UAT Pending Cassava', { status: 'pending', quantity: 5 });
        const pLow = await createProduct(farmer.user._id, 'UAT Low Stock Rice', { quantity: 2 });

        console.log('');
        console.log('=== H3/H6: Order inventory integrity ===');

        // H6: farmerName attribution must come from the real product owner
        let res = await makeRequest('/api/orders', 'POST', {
            items: [orderItem(pInStock, 2)],
            deliveryInfo: deliveryInfo()
        }, buyer.token);
        let orderA = await expectStatus('H6/H3 order placed on in-stock product', res, 201);
        check('H6 farmerName set from owner.name (not "Unknown Farmer")',
            orderA.data.items[0].farmerName === farmer.user.name,
            'farmerName=' + orderA.data.items[0].farmerName);

        // H3: order on zero-stock product must be blocked
        res = await makeRequest('/api/orders', 'POST', {
            items: [orderItem(pZeroStock, 1)],
            deliveryInfo: deliveryInfo()
        }, buyer.token);
        await expectStatus('H3 qty-0 product order blocked', res, 400);
        check('H3 blocked order contains stock error', /stock|available|not available/i.test(res.body.error || ''), res.body.error);

        // H3: order exceeding available quantity must be blocked
        res = await makeRequest('/api/orders', 'POST', {
            items: [orderItem(pLow, 3)],
            deliveryInfo: deliveryInfo()
        }, buyer.token);
        await expectStatus('H3 oversell order blocked', res, 400);

        // H3: order on non-approved product must be blocked
        res = await makeRequest('/api/orders', 'POST', {
            items: [orderItem(pPending, 1)],
            deliveryInfo: deliveryInfo()
        }, buyer.token);
        await expectStatus('H3 non-approved product order blocked', res, 400);

        // H3: order on non-existent product must be blocked
        res = await makeRequest('/api/orders', 'POST', {
            items: [{ productId: '000000000000000000000000', productName: 'Ghost', category: 'Other', unitPrice: 5, quantity: 1 }],
            deliveryInfo: deliveryInfo()
        }, buyer.token);
        await expectStatus('H3 missing product order blocked', res, 400);

        // H3: duplicate productIds are aggregated before stock check
        res = await makeRequest('/api/orders', 'POST', {
            items: [orderItem(pInStock, 2), orderItem(pInStock, 3)],
            deliveryInfo: deliveryInfo()
        }, buyer.token);
        await expectStatus('H3 aggregate duplicate-product order placed', res, 201);

        // H3: stock must be decremented atomically at order time (10 - 2 - 5 = 3)
        const pInStockAfter = await Product.findById(pInStock._id);
        check('H3 stock decremented at order time (10 -> 3)', pInStockAfter.quantity === 3, 'quantity=' + pInStockAfter.quantity);

        // No order rows / no stock change from blocked attempts
        const orderCount = await Order.countDocuments({ buyer: buyer.user._id });
        check('H3 blocked attempts created no orders (2 orders so far)', orderCount === 2, 'orders=' + orderCount);
        const pZeroAfter = await Product.findById(pZeroStock._id);
        check('H3 zero-stock product unchanged', pZeroAfter.quantity === 0, 'quantity=' + pZeroAfter.quantity);
        const pLowAfter = await Product.findById(pLow._id);
        check('H3 low-stock product unchanged after oversell', pLowAfter.quantity === 2, 'quantity=' + pLowAfter.quantity);

        console.log('');
        console.log('=== H1: Buyer order status restrictions ===');

        res = await makeRequest('/api/orders', 'POST', {
            items: [orderItem(pInStock, 1)],
            deliveryInfo: deliveryInfo()
        }, buyer.token);
        const orderB = await expectStatus('H1 order created (Pending)', res, 201);
        const orderBId = orderB.data.orderId;

        res = await makeRequest('/api/orders/' + orderBId + '/status', 'PATCH', { status: 'Completed' }, buyer.token);
        await expectStatus('H1 buyer cannot mark own order Completed', res, 400);
        let dbOrder = await Order.findOne({ orderId: orderBId });
        check('H1 order still Pending after rejected Completed', dbOrder.status === 'Pending', 'status=' + dbOrder.status);

        res = await makeRequest('/api/orders/' + orderBId + '/status', 'PATCH', { status: 'Processing' }, buyer.token);
        await expectStatus('H1 buyer cannot set Processing', res, 400);
        dbOrder = await Order.findOne({ orderId: orderBId });
        check('H1 order still Pending after rejected Processing', dbOrder.status === 'Pending', 'status=' + dbOrder.status);

        res = await makeRequest('/api/orders/' + orderBId + '/status', 'PATCH', { status: 'Cancelled' }, buyer.token);
        await expectStatus('H1 buyer can cancel own Pending order', res, 200);
        dbOrder = await Order.findOne({ orderId: orderBId });
        check('H1 order now Cancelled', dbOrder.status === 'Cancelled', 'status=' + dbOrder.status);

        const pInStockFinal = await Product.findById(pInStock._id);
        check('H3 stock decremented for every order (3 -> 2)', pInStockFinal.quantity === 2, 'quantity=' + pInStockFinal.quantity);

        const finalOrderCount = await Order.countDocuments({ buyer: buyer.user._id });
        check('H3 exactly 3 orders placed (no phantom orders)', finalOrderCount === 3, 'orders=' + finalOrderCount);

        // A buyer cannot cancel an order once the farmer has accepted it
        res = await makeRequest('/api/farmer/orders/' + orderA.data.orderId + '/status', 'PATCH', { status: 'Accepted' }, farmer.token);
        await expectStatus('H5/H1 farmer accepts order', res, 200);
        res = await makeRequest('/api/orders/' + orderA.data.orderId + '/status', 'PATCH', { status: 'Cancelled' }, buyer.token);
        await expectStatus('H1 buyer cannot cancel an Accepted order', res, 400);

        console.log('');
        console.log('=== H5: Notifications independent of email ===');

        const farmerNotifs = await Notification.countDocuments({ user: farmer.user._id, type: 'new_order' });
        check('H5 farmer received new_order notifications despite email failure', farmerNotifs >= 1, 'count=' + farmerNotifs);

        const buyerAccepted = await Notification.countDocuments({ user: buyer.user._id, type: 'order_accepted' });
        check('H5 buyer received order_accepted notification despite email failure', buyerAccepted === 1, 'count=' + buyerAccepted);

        console.log('');
        console.log('=== H2: Role enforcement on farmer/product endpoints ===');

        res = await makeRequest('/api/farmer/orders', 'GET', null, buyer.token);
        await expectStatus('H2 buyer token rejected on GET /api/farmer/orders', res, 403);

        res = await makeRequest('/api/farmer/dashboard', 'GET', null, buyer.token);
        await expectStatus('H2 buyer token rejected on GET /api/farmer/dashboard', res, 403);

        res = await makeRequest('/api/analytics/farmer', 'GET', null, buyer.token);
        await expectStatus('H2 buyer token rejected on GET /api/analytics/farmer', res, 403);

        res = await makeRequest('/api/products/my-listings', 'GET', null, buyer.token);
        await expectStatus('H2 buyer token rejected on GET /api/products/my-listings', res, 403);

        res = await makeRequest('/api/products', 'POST', {
            name: 'Buyer Sneak Listing', price: 500, category: 'Grains', description: 'x', contact: '+2507', paymentMethods: ['Mobile Money (MoMo)'], quantity: 1
        }, buyer.token);
        await expectStatus('H2 buyer token rejected on POST /api/products', res, 403);

        res = await makeRequest('/api/products/' + pInStock._id.toString(), 'PUT', { price: 2000 }, buyer.token);
        await expectStatus('H2 buyer token rejected on PUT /api/products/:id', res, 403);

        res = await makeRequest('/api/products/' + pInStock._id.toString(), 'DELETE', null, buyer.token);
        await expectStatus('H2 buyer token rejected on DELETE /api/products/:id', res, 403);

        res = await makeRequest('/api/farmer/orders', 'GET', null, farmer.token);
        await expectStatus('H2 farmer token allowed on GET /api/farmer/orders', res, 200);

        res = await makeRequest('/api/farmer/dashboard', 'GET', null, farmer.token);
        await expectStatus('H2 farmer token allowed on GET /api/farmer/dashboard', res, 200);

        res = await makeRequest('/api/products/my-listings', 'GET', null, farmer.token);
        await expectStatus('H2 farmer token allowed on GET /api/products/my-listings', res, 200);

        res = await makeRequest('/api/products', 'POST', {
            name: 'Farmer New Listing', price: 1500, category: 'Vegetables', description: 'UAT listing', contact: '+250700000001', paymentMethods: ['Visa Card', 'Mobile Money (MoMo)'], quantity: 5
        }, farmer.token);
        await expectStatus('H2 farmer token allowed on POST /api/products', res, 201);

        console.log('');
        console.log('=== H4: requireAuth must not fall through ===');

        const ghost = await createUser('buyer', 'ghost');
        await User.deleteOne({ _id: ghost.user._id });
        res = await makeRequest('/api/auth/me', 'GET', null, ghost.token);
        await expectStatus('H4 deleted user token rejected on requireAuth route', res, 401);

        res = await makeRequest('/api/orders', 'GET', null, ghost.token);
        await expectStatus('H4 deleted user token rejected on order route', res, 401);

        const suspended = await createUser('buyer', 'suspended');
        await User.updateOne({ _id: suspended.user._id }, { $set: { isSuspended: true } });
        res = await makeRequest('/api/auth/me', 'GET', null, suspended.token);
        await expectStatus('H4 suspended user token rejected on requireAuth route', res, 403);

        console.log('');
        console.log('RESULT: ' + passed + ' passed, ' + failed + ' failed');
        if (failed > 0) throw new Error('Test failures: ' + failed);

        console.log('[cleanup] Dropping test DB ' + testDbName);
        await mongoose.connection.dropDatabase();
        await mongoose.disconnect();
        server.close(() => process.exit(0));
    } catch (err) {
        console.error(err);
        try {
            await mongoose.connection.dropDatabase();
        } catch (e) { /* ignore */ }
        try {
            await mongoose.disconnect();
        } catch (e) { /* ignore */ }
        if (server) server.close(() => process.exit(1));
        else process.exit(1);
    }
})();
