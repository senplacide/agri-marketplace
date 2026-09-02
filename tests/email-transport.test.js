process.env.NODE_ENV = 'test';

var assert = require('assert');

var email = require('../utils/email');

var originalFetch = global.fetch;
var originalEnv = {
    BREVO_API_KEY: process.env.BREVO_API_KEY,
    SENDER_EMAIL: process.env.SENDER_EMAIL
};

function mockFetch(handler) {
    global.fetch = function (url, options) {
        handler(url, options);
        return Promise.resolve({
            ok: true,
            status: 200,
            json: function () { return Promise.resolve({ messageId: 'test-123' }); }
        });
    };
}

function restoreFetch() {
    global.fetch = originalFetch;
}

var passed = 0;
var failed = 0;

function test(name, fn) {
    try {
        fn();
        passed++;
        console.log('  PASS: ' + name);
    } catch (err) {
        failed++;
        console.log('  FAIL: ' + name);
        console.log('        ' + err.message);
    }
}

console.log('email-transport tests\n');

console.log('1. Module exports');
test('exports 12 functions', function () {
    var keys = Object.keys(email);
    assert.strictEqual(keys.length, 12);
});
test('all exports are functions', function () {
    Object.keys(email).forEach(function (key) {
        assert.strictEqual(typeof email[key], 'function', key + ' is not a function');
    });
});

console.log('\n2. sendContactEmail requires BREVO_API_KEY');
process.env.BREVO_API_KEY = '';
process.env.SENDER_EMAIL = 'test@example.com';
test('throws when BREVO_API_KEY is missing', function () {
    return email.sendContactEmail({
        name: 'Test', email: 'a@b.com', subject: 'Hi', message: 'Hello'
    }).then(function () {
        throw new Error('should have thrown');
    }).catch(function (err) {
        assert.ok(err.message.includes('BREVO_API_KEY'));
    });
});

console.log('\n3. sendContactEmail requires SENDER_EMAIL');
process.env.BREVO_API_KEY = 'xkeysib-test';
process.env.SENDER_EMAIL = '';
test('throws when SENDER_EMAIL is missing', function () {
    return email.sendContactEmail({
        name: 'Test', email: 'a@b.com', subject: 'Hi', message: 'Hello'
    }).then(function () {
        throw new Error('should have thrown');
    }).catch(function (err) {
        assert.ok(err.message.includes('SENDER_EMAIL'));
    });
});

console.log('\n4. Brevo API payload transformation');
process.env.BREVO_API_KEY = 'xkeysib-test';
process.env.SENDER_EMAIL = 'sender@example.com';
test('sendContactEmail builds correct Brevo payload', function () {
    var capturedUrl, capturedOptions;
    mockFetch(function (url, options) {
        capturedUrl = url;
        capturedOptions = options;
    });

    return email.sendContactEmail({
        name: 'John', email: 'john@example.com', subject: 'Help', message: 'Need help'
    }).then(function () {
        restoreFetch();
        assert.strictEqual(capturedUrl, 'https://api.brevo.com/v3/smtp/email');
        assert.strictEqual(capturedOptions.method, 'POST');
        assert.strictEqual(capturedOptions.headers['api-key'], 'xkeysib-test');
        assert.strictEqual(capturedOptions.headers['Content-Type'], 'application/json');

        var payload = JSON.parse(capturedOptions.body);
        assert.deepStrictEqual(payload.sender, { name: 'AgriConnect', email: 'sender@example.com' });
        assert.deepStrictEqual(payload.to, [{ email: process.env.ADMIN_EMAIL || 'placidesenadata35@gmail.com' }]);
        assert.strictEqual(payload.subject, '[New Inquiry] Help');
        assert.ok(payload.htmlContent.includes('John'));
        assert.ok(payload.textContent.includes('Need help'));
        assert.deepStrictEqual(payload.replyTo, { email: 'john@example.com' });
    });
});

test('sendVerificationEmail builds correct payload', function () {
    var capturedOptions;
    mockFetch(function (url, options) {
        capturedOptions = options;
    });

    return email.sendVerificationEmail('user@test.com', 'Alice', '123456').then(function () {
        restoreFetch();
        var payload = JSON.parse(capturedOptions.body);
        assert.deepStrictEqual(payload.sender, { name: 'AgriConnect', email: 'sender@example.com' });
        assert.deepStrictEqual(payload.to, [{ email: 'user@test.com' }]);
        assert.strictEqual(payload.subject, 'Verify your AgriConnect account');
        assert.ok(payload.htmlContent.includes('123456'));
        assert.ok(payload.textContent.includes('123456'));
        assert.strictEqual(payload.replyTo, undefined);
    });
});

test('sendOrderPlacedEmail builds correct payload', function () {
    var capturedOptions;
    mockFetch(function (url, options) {
        capturedOptions = options;
    });

    var fakeOrder = {
        orderId: 'ORD-999',
        items: [{ productName: 'Maize', farmerName: 'Farmer Joe', quantity: 5, unitPrice: 1000, lineTotal: 5000 }],
        totalPrice: 5000,
        deliveryInfo: { fullName: 'Bob', streetAddress: '123 St', city: 'Kigali', country: 'Rwanda', phone: '123' }
    };

    return email.sendOrderPlacedEmail('buyer@test.com', 'Bob', fakeOrder).then(function () {
        restoreFetch();
        var payload = JSON.parse(capturedOptions.body);
        assert.deepStrictEqual(payload.to, [{ email: 'buyer@test.com' }]);
        assert.strictEqual(payload.subject, 'Order Confirmation');
        assert.ok(payload.htmlContent.includes('ORD-999'));
        assert.ok(payload.htmlContent.includes('Maize'));
    });
});

test('handles Brevo 401 authentication error', function () {
    global.fetch = function () {
        return Promise.resolve({
            ok: false,
            status: 401,
            text: function () { return Promise.resolve('unauthorized'); }
        });
    };

    return email.sendVerificationEmail('x@y.com', 'X', '000').then(function () {
        restoreFetch();
        throw new Error('should have thrown');
    }).catch(function (err) {
        restoreFetch();
        assert.ok(err.message.includes('401'));
        assert.ok(err.message.includes('BREVO_API_KEY'));
    });
});

test('handles Brevo 402 payment error', function () {
    global.fetch = function () {
        return Promise.resolve({
            ok: false,
            status: 402,
            text: function () { return Promise.resolve('no credits'); }
        });
    };

    return email.sendVerificationEmail('x@y.com', 'X', '000').then(function () {
        restoreFetch();
        throw new Error('should have thrown');
    }).catch(function (err) {
        restoreFetch();
        assert.ok(err.message.includes('402'));
        assert.ok(err.message.includes('credits'));
    });
});

test('handles network failure', function () {
    global.fetch = function () {
        return Promise.reject(new Error('Network error'));
    };

    return email.sendVerificationEmail('x@y.com', 'X', '000').then(function () {
        restoreFetch();
        throw new Error('should have thrown');
    }).catch(function (err) {
        restoreFetch();
        assert.ok(err.message.includes('Brevo API request failed'));
        assert.ok(err.message.includes('Network error'));
    });
});

// Restore env
process.env.BREVO_API_KEY = originalEnv.BREVO_API_KEY || '';
process.env.SENDER_EMAIL = originalEnv.SENDER_EMAIL || '';
restoreFetch();

console.log('\nResults: ' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed > 0 ? 1 : 0);
