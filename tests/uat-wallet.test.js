process.env.NODE_ENV = 'test';

const http = require('http');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

require('dotenv').config();
const baseUri = process.env.MONGO_URI;
if (!baseUri) {
    console.error('MONGO_URI missing');
    process.exit(1);
}
const testDbName = 'uatw-' + Date.now();
const TEST_MONGO_URI = baseUri.replace(/\/[^/?#]*(?=[?#]|$)/, '/' + testDbName);

process.env.EMAIL_SERVICE_USER = '';
process.env.EMAIL_SERVICE_PASS = '';
process.env.SENDER_EMAIL = '';
process.env.MONGO_URI = TEST_MONGO_URI;

const app = require('../server');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Wallet = require('../models/Wallet');
const PlatformWallet = require('../models/PlatformWallet');
const WalletTransaction = require('../models/WalletTransaction');
const { JWT_SECRET } = require('../middleware/auth');
const { processOrderCommission } = require('../services/walletService');

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
    const email = 'uatw-' + label + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '@example.com';
    const user = await User.create({
        name: label.charAt(0).toUpperCase() + label.slice(1),
        email: email,
        passwordHash: await bcrypt.hash('Uat!test12345', 10),
        role: role,
        isVerified: true
    });
    return { user: user, token: signToken(user) };
}

async function createProduct(ownerId, name, price, quantity) {
    return Product.create({
        name: name,
        price: price,
        category: 'Grains',
        description: 'UAT wallet test product',
        contact: '+250700000001',
        quantity: quantity,
        paymentMethods: ['Mobile Money (MoMo)'],
        status: 'approved',
        owner: ownerId
    });
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
        const pMaize = await createProduct(farmer.user._id, 'UAT Wallet Maize', 1500, 20);
        const pReject = await createProduct(farmer.user._id, 'UAT Wallet Reject', 2000, 10);
        const pCancel = await createProduct(farmer.user._id, 'UAT Wallet Cancel', 3000, 10);

        console.log('');
        console.log('=== Wallet endpoint must be mounted (404 fix) ===');

        let res = await makeRequest('/api/wallet', 'GET', null, farmer.token);
        await expectStatus('GET /api/wallet returns 200 (was 404)', res, 200);
        check('wallet endpoint returns wallet + transactions + pendingRequests',
            res.body.data && res.body.data.wallet && Array.isArray(res.body.data.transactions) && Array.isArray(res.body.data.pendingRequests),
            'keys=' + Object.keys((res.body && res.body.data) || {}).join(','));

        res = await makeRequest('/api/wallet', 'GET', null, buyer.token);
        await expectStatus('GET /api/wallet works for any authenticated user', res, 200);

        res = await makeRequest('/api/wallet', 'GET', null, null);
        await expectStatus('GET /api/wallet requires auth', res, 401);

        console.log('');
        console.log('=== Happy path: complete an order through the legitimate lifecycle ===');

        res = await makeRequest('/api/orders', 'POST', {
            items: [orderItem(pMaize, 5)],
            deliveryInfo: deliveryInfo()
        }, buyer.token);
        const orderA = await expectStatus('order placed (5 x 1500)', res, 201);
        const orderAId = orderA.data.orderId;
        check('order commission fields computed (total 7500, rate 2%)',
            orderA.data.totalPrice === 7500 && orderA.data.commissionAmount === 150 && orderA.data.farmerAmount === 7350,
            'total=' + orderA.data.totalPrice + ', commission=' + orderA.data.commissionAmount + ', farmer=' + orderA.data.farmerAmount);

        const freshPending = await Order.findOne({ orderId: orderAId });
        const guardResult = await processOrderCommission(freshPending, farmer.user._id);
        check('processOrderCommission refused while order is Pending',
            guardResult.processed === false && guardResult.reason === 'invalid-order-or-status',
            'reason=' + guardResult.reason);

        res = await makeRequest('/api/farmer/orders/' + orderAId + '/status', 'PATCH', { status: 'Accepted' }, farmer.token);
        await expectStatus('farmer accepts order', res, 200);

        res = await makeRequest('/api/farmer/orders/' + orderAId + '/status', 'PATCH', { status: 'Completed' }, farmer.token);
        const completed = await expectStatus('farmer completes order', res, 200);
        check('completed response reflects commissionProcessed + payoutStatus',
            completed.data.commissionProcessed === true && completed.data.payoutStatus === 'completed',
            'commissionProcessed=' + completed.data.commissionProcessed + ', payoutStatus=' + completed.data.payoutStatus);

        const farmerWallet = await Wallet.findOne({ farmerId: farmer.user._id });
        check('farmer wallet availableBalance = 7350', farmerWallet && farmerWallet.availableBalance === 7350, 'available=' + (farmerWallet && farmerWallet.availableBalance));
        check('farmer wallet totalEarned = 7350', farmerWallet && farmerWallet.totalEarned === 7350, 'earned=' + (farmerWallet && farmerWallet.totalEarned));
        check('farmer wallet pendingBalance = 0 (released)', farmerWallet && farmerWallet.pendingBalance === 0, 'pending=' + (farmerWallet && farmerWallet.pendingBalance));

        const platformWallet = await PlatformWallet.findOne({ isActive: true });
        check('platform wallet created', !!platformWallet, 'exists=' + !!platformWallet);
        check('platform wallet commission = 150', platformWallet && platformWallet.availableBalance === 150 && platformWallet.totalCommissionEarned === 150,
            'available=' + (platformWallet && platformWallet.availableBalance) + ', earned=' + (platformWallet && platformWallet.totalCommissionEarned));

        const farmerTxns = await WalletTransaction.find({ orderId: orderA.data._id, walletType: 'farmer' });
        check('exactly one farmer credit transaction', farmerTxns.length === 1 && farmerTxns[0].type === 'credit' && farmerTxns[0].amount === 7350,
            'count=' + farmerTxns.length + ', amount=' + (farmerTxns[0] && farmerTxns[0].amount));

        const platformTxns = await WalletTransaction.find({ orderId: orderA.data._id, walletType: 'platform' });
        check('exactly one platform commission transaction', platformTxns.length === 1 && platformTxns[0].type === 'commission' && platformTxns[0].amount === 150,
            'count=' + platformTxns.length + ', amount=' + (platformTxns[0] && platformTxns[0].amount));

        const dbOrderA = await Order.findOne({ orderId: orderAId });
        check('order commissionProcessed = true in DB', dbOrderA.commissionProcessed === true, 'value=' + dbOrderA.commissionProcessed);
        check('order payoutStatus = completed in DB', dbOrderA.payoutStatus === 'completed', 'value=' + dbOrderA.payoutStatus);
        check('order completedAt set', !!dbOrderA.completedAt, 'value=' + dbOrderA.completedAt);

        console.log('');
        console.log('=== Duplicate processing protection ===');

        res = await makeRequest('/api/farmer/orders/' + orderAId + '/status', 'PATCH', { status: 'Completed' }, farmer.token);
        await expectStatus('repeating Completed on completed order blocked by route', res, 400);

        const completedCopy = await Order.findOne({ orderId: orderAId });
        const repeatResult = await processOrderCommission(completedCopy, farmer.user._id);
        check('processOrderCommission refuses already-processed order',
            repeatResult.processed === false && repeatResult.reason === 'already-processed',
            'reason=' + repeatResult.reason);

        const walletAfterRepeat = await Wallet.findOne({ farmerId: farmer.user._id });
        check('farmer wallet NOT double-credited after repeat', walletAfterRepeat.availableBalance === 7350 && walletAfterRepeat.totalEarned === 7350,
            'available=' + walletAfterRepeat.availableBalance + ', earned=' + walletAfterRepeat.totalEarned);

        const platformAfterRepeat = await PlatformWallet.findOne({ isActive: true });
        check('platform wallet NOT double-credited after repeat', platformAfterRepeat.availableBalance === 150 && platformAfterRepeat.totalCommissionEarned === 150,
            'available=' + platformAfterRepeat.availableBalance);

        const txnCountAfterRepeat = await WalletTransaction.countDocuments({ orderId: orderA.data._id });
        check('no additional transactions after repeat', txnCountAfterRepeat === 2, 'count=' + txnCountAfterRepeat);

        console.log('');
        console.log('=== Rejected order must generate no commission ===');

        res = await makeRequest('/api/orders', 'POST', {
            items: [orderItem(pReject, 2)],
            deliveryInfo: deliveryInfo()
        }, buyer.token);
        const orderR = await expectStatus('rejectable order placed', res, 201);

        res = await makeRequest('/api/farmer/orders/' + orderR.data.orderId + '/status', 'PATCH', { status: 'Rejected' }, farmer.token);
        await expectStatus('farmer rejects order', res, 200);

        const rejectedTxns = await WalletTransaction.countDocuments({ orderId: orderR.data._id });
        check('rejected order created no wallet transactions', rejectedTxns === 0, 'count=' + rejectedTxns);

        const walletAfterReject = await Wallet.findOne({ farmerId: farmer.user._id });
        check('farmer wallet unchanged after rejected order', walletAfterReject.availableBalance === 7350 && walletAfterReject.totalEarned === 7350,
            'available=' + walletAfterReject.availableBalance + ', earned=' + walletAfterReject.totalEarned);

        const platformAfterReject = await PlatformWallet.findOne({ isActive: true });
        check('platform wallet unchanged after rejected order', platformAfterReject.availableBalance === 150, 'available=' + platformAfterReject.availableBalance);

        console.log('');
        console.log('=== Cancelled order must generate no commission ===');

        res = await makeRequest('/api/orders', 'POST', {
            items: [orderItem(pCancel, 2)],
            deliveryInfo: deliveryInfo()
        }, buyer.token);
        const orderC = await expectStatus('cancellable order placed', res, 201);

        res = await makeRequest('/api/orders/' + orderC.data.orderId + '/status', 'PATCH', { status: 'Cancelled' }, buyer.token);
        await expectStatus('buyer cancels pending order', res, 200);

        const cancelledTxns = await WalletTransaction.countDocuments({ orderId: orderC.data._id });
        check('cancelled order created no wallet transactions', cancelledTxns === 0, 'count=' + cancelledTxns);

        const walletAfterCancel = await Wallet.findOne({ farmerId: farmer.user._id });
        check('farmer wallet unchanged after cancelled order', walletAfterCancel.availableBalance === 7350 && walletAfterCancel.totalEarned === 7350,
            'available=' + walletAfterCancel.availableBalance + ', earned=' + walletAfterCancel.totalEarned);

        const platformAfterCancel = await PlatformWallet.findOne({ isActive: true });
        check('platform wallet unchanged after cancelled order', platformAfterCancel.availableBalance === 150, 'available=' + platformAfterCancel.availableBalance);

        console.log('');
        console.log('=== Wallet endpoint reflects records ===');

        res = await makeRequest('/api/wallet', 'GET', null, farmer.token);
        await expectStatus('GET /api/wallet again', res, 200);
        const walletData = res.body.data;
        check('wallet endpoint balance matches DB', walletData.wallet.availableBalance === 7350 && walletData.wallet.totalEarned === 7350,
            'available=' + walletData.wallet.availableBalance + ', earned=' + walletData.wallet.totalEarned);
        check('wallet endpoint lists the credit transaction', walletData.transactions.some(function (t) { return t.type === 'credit' && t.amount === 7350; }),
            'transactions=' + walletData.transactions.length);

        res = await makeRequest('/api/wallet/withdrawals', 'GET', null, farmer.token);
        await expectStatus('GET /api/wallet/withdrawals works', res, 200);

        console.log('');
        console.log('=== Existing order functionality still works ===');

        res = await makeRequest('/api/farmer/orders', 'GET', null, farmer.token);
        await expectStatus('farmer order list still works', res, 200);
        check('farmer sees all 3 orders', Array.isArray(res.body.data) && res.body.data.length === 3, 'count=' + (res.body.data && res.body.data.length));

        res = await makeRequest('/api/orders', 'GET', null, buyer.token);
        await expectStatus('buyer order list still works', res, 200);
        check('buyer sees all 3 orders', Array.isArray(res.body.data) && res.body.data.length === 3, 'count=' + (res.body.data && res.body.data.length));

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
