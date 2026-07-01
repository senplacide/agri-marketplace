const assert = require('assert');
const http = require('http');
const bcrypt = require('bcryptjs');

const app = require('../server');
const User = require('../models/User');

let server;
let port;

function makeRequest(path, method = 'GET', body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: payload
          ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
          : {}
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          resolve({ statusCode: res.statusCode, body: data });
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

(async () => {
  try {
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    port = server.address().port;

    const res = await makeRequest('/api/auth/signup', 'POST', { email: 'invalid', password: '123' });
    assert.strictEqual(res.statusCode, 400);
    const body = JSON.parse(res.body);
    assert.ok(body.error.includes('valid email'));

    const passwordHash = await bcrypt.hash('legacy-password', 10);
    const legacyEmail = `legacy-login-test-${Date.now()}@example.com`;
    const legacyUser = await User.create({
      name: 'Legacy User',
      email: legacyEmail,
      passwordHash,
      isVerified: true,
      createdAt: new Date()
    });

    const legacyLogin = await makeRequest('/api/auth/login', 'POST', {
      email: legacyEmail.toUpperCase(),
      password: 'legacy-password'
    });
    assert.strictEqual(legacyLogin.statusCode, 200);

    const badProduct = await makeRequest('/api/products', 'POST', {
      name: '',
      price: -1,
      category: 'Invalid',
      description: 'x',
      contact: 'x',
      paymentMethods: ['Cash']
    });
    assert.strictEqual(badProduct.statusCode, 401);

    await User.deleteOne({ _id: legacyUser._id });

    console.log('validation tests passed');
    server.close(() => process.exit(0));
  } catch (err) {
    console.error(err);
    if (server) server.close(() => process.exit(1));
    else process.exit(1);
  }
})();
