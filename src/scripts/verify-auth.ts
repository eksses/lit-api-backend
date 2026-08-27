process.env.NODE_ENV = 'test';

import http from 'http';
import { db } from '../db.js';
import { computeDeviceHash } from '../utils/fingerprint.js';
import bcrypt from 'bcryptjs';
import app from '../index.js';

interface TestResponse {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: any;
}

function makeRequest(
  server: http.Server,
  options: {
    method: string;
    path: string;
    headers?: Record<string, string>;
    body?: any;
  }
): Promise<TestResponse> {
  return new Promise((resolve, reject) => {
    const address = server.address();
    if (!address || typeof address === 'string') {
      return reject(new Error('Server is not listening on a valid TCP port'));
    }

    const payload = options.body ? JSON.stringify(options.body) : undefined;
    const reqHeaders: Record<string, string> = {
      ...(options.headers || {})
    };

    if (payload) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(payload).toString();
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: address.port,
        path: options.path,
        method: options.method,
        headers: reqHeaders
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsedBody = data;
          try {
            parsedBody = JSON.parse(data);
          } catch (_e) {
            // keep as raw string if not JSON
          }
          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            body: parsedBody
          });
        });
      }
    );

    req.on('error', reject);

    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function runVerification() {
  console.log('====================================================');
  console.log('   TASK 2: AUTH & FINGERPRINT VERIFICATION SCRIPT');
  console.log('====================================================\n');

  let passedTests = 0;
  let failedTests = 0;

  function assert(condition: boolean, description: string) {
    if (condition) {
      console.log(`  [PASS] ${description}`);
      passedTests++;
    } else {
      console.error(`  [FAIL] ${description}`);
      failedTests++;
    }
  }

  // --- STEP 1: Fingerprint Unit Test ---
  console.log('--- Step 1: Testing Device Fingerprint Calculation ---');
  const fp1 = computeDeviceHash('fp_test_123', 'Mozilla/5.0 (Mobile)', '192.168.1.100');
  const fp2 = computeDeviceHash('fp_test_123', 'Mozilla/5.0 (Mobile)', '192.168.1.100');
  const fp3 = computeDeviceHash('fp_test_999', 'Mozilla/5.0 (Mobile)', '192.168.1.100');

  assert(typeof fp1 === 'string' && fp1.length === 64, 'SHA-256 hash length is 64 hex characters');
  assert(fp1 === fp2, 'Fingerprint calculation is deterministic');
  assert(fp1 !== fp3, 'Different input generates different fingerprint hash');

  // --- STEP 2: Password Hashing Unit Test ---
  console.log('\n--- Step 2: Testing Password Hashing & Bcrypt Verification ---');
  const rawPass = 'SuperSecretPass123!';
  const hashedPass = await bcrypt.hash(rawPass, 10);
  const passMatches = await bcrypt.compare(rawPass, hashedPass);
  const wrongPassMatches = await bcrypt.compare('WrongPassword', hashedPass);

  assert(passMatches === true, 'Bcrypt correctly matches valid password');
  assert(wrongPassMatches === false, 'Bcrypt correctly rejects invalid password');

  // --- STEP 3: Express HTTP Server Endpoint Testing ---
  console.log('\n--- Step 3: Starting Test HTTP Server ---');
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const serverAddr = server.address();
  console.log(`Test server running on port ${(serverAddr as any).port}`);

  const testUser = {
    name: 'Task 2 Test User',
    username: `testuser_${Date.now()}`,
    email: `test_${Date.now()}@example.com`,
    password: 'SecurePassword123!',
    bio: 'PWA test account'
  };

  let authTokenCookie = '';
  let bearerToken = '';

  try {
    // 3.1 Health Check + Fingerprint Header Attachment Test
    console.log('\n--- Test 3.1: Health Endpoint & Fingerprint Middleware ---');
    const healthRes = await makeRequest(server, {
      method: 'GET',
      path: '/health',
      headers: {
        'x-device-fingerprint': 'device_test_xyz',
        'user-agent': 'TestAgent/1.0'
      }
    });

    assert(healthRes.status === 200, 'GET /health returns HTTP 200');
    assert(typeof healthRes.body.deviceHash === 'string' && healthRes.body.deviceHash.length === 64, 'req.deviceHash attached by fingerprint middleware');

    // 3.2 User Registration Test
    console.log('\n--- Test 3.2: User Registration (POST /api/auth/register) ---');
    const regRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/auth/register',
      body: testUser
    });

    assert(regRes.status === 201, 'POST /api/auth/register returns HTTP 201 Created');
    assert(regRes.body.user && regRes.body.user.email === testUser.email, 'Returns registered user object with matching email');
    assert(typeof regRes.body.token === 'string', 'Returns JWT token in response body');
    
    const setCookieHeader = regRes.headers['set-cookie'];
    assert(
      Array.isArray(setCookieHeader) && setCookieHeader.some((c) => c.includes('auth_token=')),
      'Sets HTTP-only auth_token cookie'
    );

    if (Array.isArray(setCookieHeader)) {
      const cookieStr = setCookieHeader.find((c) => c.includes('auth_token='));
      if (cookieStr) {
        authTokenCookie = cookieStr.split(';')[0];
      }
    }
    bearerToken = regRes.body.token;

    // 3.3 Duplicate Registration Test
    console.log('\n--- Test 3.3: Duplicate Registration Rejection ---');
    const dupRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/auth/register',
      body: testUser
    });

    assert(dupRes.status === 400, 'POST /api/auth/register rejects existing email/username with HTTP 400');

    // 3.4 Login Rejection (Wrong Password) Test
    console.log('\n--- Test 3.4: Login Rejection on Invalid Password ---');
    const wrongLoginRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/auth/login',
      body: {
        identifier: testUser.email,
        password: 'WrongPassword'
      }
    });

    assert(wrongLoginRes.status === 401, 'POST /api/auth/login returns HTTP 401 for wrong password');

    // 3.5 Login Success Test
    console.log('\n--- Test 3.5: Successful Login (POST /api/auth/login) ---');
    const loginRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/auth/login',
      body: {
        identifier: testUser.username,
        password: testUser.password
      }
    });

    assert(loginRes.status === 200, 'POST /api/auth/login returns HTTP 200 OK for valid username/password');
    assert(loginRes.body.user && loginRes.body.user.username === testUser.username, 'Login returns authenticated user payload');

    // 3.6 Profile Endpoint without Auth
    console.log('\n--- Test 3.6: Unauthenticated Profile Request (GET /api/auth/me) ---');
    const unauthMeRes = await makeRequest(server, {
      method: 'GET',
      path: '/api/auth/me'
    });

    assert(unauthMeRes.status === 401, 'GET /api/auth/me returns HTTP 401 Unauthorized when missing token');

    // 3.7 Profile Endpoint with Bearer Token
    console.log('\n--- Test 3.7: Authenticated Profile Request with Bearer Token ---');
    const bearerMeRes = await makeRequest(server, {
      method: 'GET',
      path: '/api/auth/me',
      headers: {
        Authorization: `Bearer ${bearerToken}`
      }
    });

    assert(bearerMeRes.status === 200, 'GET /api/auth/me returns HTTP 200 with valid Bearer token');
    assert(bearerMeRes.body.user && bearerMeRes.body.user.email === testUser.email, 'Returns correct user details');

    // 3.8 Profile Endpoint with Cookie
    console.log('\n--- Test 3.8: Authenticated Profile Request with Cookie ---');
    const cookieMeRes = await makeRequest(server, {
      method: 'GET',
      path: '/api/auth/me',
      headers: {
        Cookie: authTokenCookie
      }
    });

    assert(cookieMeRes.status === 200, 'GET /api/auth/me returns HTTP 200 with valid auth_token Cookie');
    assert(cookieMeRes.body.user && cookieMeRes.body.user.email === testUser.email, 'Returns correct user details from Cookie auth');

    // 3.9 Logout Test
    console.log('\n--- Test 3.9: User Logout (POST /api/auth/logout) ---');
    const logoutRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/auth/logout'
    });

    assert(logoutRes.status === 200, 'POST /api/auth/logout returns HTTP 200 OK');
    assert(logoutRes.body.success === true, 'Returns success: true');
    const logoutCookies = logoutRes.headers['set-cookie'];
    assert(
      Array.isArray(logoutCookies) && logoutCookies.some((c) => c.includes('auth_token=;')),
      'Clears auth_token cookie'
    );
  } finally {
    // --- Cleanup Database ---
    console.log('\n--- Step 4: Cleaning up Test User from Database ---');
    try {
      await db.user.deleteMany({
        where: {
          email: testUser.email
        }
      });
      console.log('Cleanup complete. Test user removed.');
    } catch (cleanupErr) {
      console.error('Error cleaning up test user:', cleanupErr);
    }

    server.close();
  }

  console.log('\n====================================================');
  console.log(` VERIFICATION COMPLETE: ${passedTests} passed, ${failedTests} failed.`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runVerification()
  .catch((err) => {
    console.error('Verification script crashed with error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
    process.exit(0);
  });
