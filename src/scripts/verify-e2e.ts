process.env.NODE_ENV = 'test';

import http from 'http';
import fs from 'fs';
import path from 'path';
import { db } from '../db.js';
import { computeDeviceHash } from '../utils/fingerprint.js';
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
            // keep raw string if not valid JSON
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

async function runE2EVerification() {
  console.log('====================================================');
  console.log('  TASK 7: CROSS-REPO E2E SYSTEM INTEGRATION TEST');
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

  // --- SECTION 1: Neon DB Connection & Schema Integrity ---
  console.log('--- Section 1: Live Neon PostgreSQL Connection & Schema Verification ---');
  try {
    await db.$connect();
    assert(true, 'Successfully connected to Neon PostgreSQL database');

    const tables: Array<{ tablename: string }> = await db.$queryRawUnsafe(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public';
    `);
    const tableNames = tables.map((t) => t.tablename);
    assert(tableNames.includes('users'), 'Database contains "users" table');
    assert(tableNames.includes('literature'), 'Database contains "literature" table');
    assert(tableNames.includes('likes'), 'Database contains "likes" table');
    assert(tableNames.includes('comments'), 'Database contains "comments" table');
    assert(tableNames.includes('follows'), 'Database contains "follows" table');

    const indexes: Array<{ indexname: string }> = await db.$queryRawUnsafe(`
      SELECT indexname FROM pg_indexes WHERE tablename = 'likes';
    `);
    const indexNames = indexes.map((i) => i.indexname);
    assert(indexNames.includes('unique_user_like'), 'Partial index "unique_user_like" exists on likes table');
    assert(indexNames.includes('unique_device_like'), 'Partial index "unique_device_like" exists on likes table');

    const userCount = await db.user.count();
    const literatureCount = await db.literature.count();
    assert(userCount > 0, `Database contains seed users (count: ${userCount})`);
    assert(literatureCount > 0, `Database contains seed literature (count: ${literatureCount})`);
  } catch (err: any) {
    assert(false, `Database connection/verification error: ${err.message}`);
  }

  // --- SECTION 2: Device Hash & Fingerprint Computation ---
  console.log('\n--- Section 2: Device Hash & Fingerprinting Logic ---');
  const fpVal = `e2e_fp_${Date.now()}`;
  const uaVal = 'Mozilla/5.0 (E2ETestAgent/1.0)';
  const ipVal = '192.168.1.50';

  const expectedHash = computeDeviceHash(fpVal, uaVal, ipVal);
  assert(typeof expectedHash === 'string' && expectedHash.length === 64, 'SHA256 device hash is 64 hex characters');

  // Start HTTP test server
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const serverPort = (server.address() as any).port;
  console.log(`E2E Test HTTP Server running on 127.0.0.1:${serverPort}`);

  try {
    const healthRes = await makeRequest(server, {
      method: 'GET',
      path: '/health',
      headers: {
        'x-device-fingerprint': fpVal,
        'user-agent': uaVal,
        'x-forwarded-for': ipVal
      }
    });

    assert(healthRes.status === 200, 'GET /health returns status 200');
    assert(healthRes.body.deviceHash === expectedHash, 'Fingerprint middleware computed identical device hash');

    // --- SECTION 3: Anonymous Guest Liking & Commenting ---
    console.log('\n--- Section 3: Anonymous Guest Liking & Commenting Flow ---');
    const litListRes = await makeRequest(server, {
      method: 'GET',
      path: '/api/literature?limit=1'
    });

    assert(litListRes.status === 200, 'GET /api/literature returns 200');
    assert(Array.isArray(litListRes.body.items) && litListRes.body.items.length > 0, 'Literature list is populated');
    const targetLit = litListRes.body.items[0];
    const targetLitId = targetLit.id;

    // Guest Like
    const guestLike1 = await makeRequest(server, {
      method: 'POST',
      path: `/api/literature/${targetLitId}/like`,
      headers: {
        'x-device-fingerprint': fpVal
      }
    });
    assert(guestLike1.status === 200, 'POST /api/literature/:id/like (guest) returns 200');
    assert(guestLike1.body.is_liked === true, 'Guest like status is_liked: true');

    // Guest Toggle Off
    const guestLike2 = await makeRequest(server, {
      method: 'POST',
      path: `/api/literature/${targetLitId}/like`,
      headers: {
        'x-device-fingerprint': fpVal
      }
    });
    assert(guestLike2.status === 200, 'POST /api/literature/:id/like (guest toggle off) returns 200');
    assert(guestLike2.body.is_liked === false, 'Guest like status toggled back to is_liked: false');

    // Guest Comment
    const guestCommentContent = `E2E Guest comment ${Date.now()}`;
    const guestCommentRes = await makeRequest(server, {
      method: 'POST',
      path: `/api/literature/${targetLitId}/comment`,
      headers: {
        'x-device-fingerprint': fpVal
      },
      body: {
        content: guestCommentContent,
        guest_name: 'E2E Guest User'
      }
    });
    assert(guestCommentRes.status === 201, 'POST /api/literature/:id/comment (guest) returns 201 Created');
    assert(guestCommentRes.body.comment.guestName === 'E2E Guest User', 'Comment contains guestName');

    const getCommentsRes = await makeRequest(server, {
      method: 'GET',
      path: `/api/literature/${targetLitId}/comments`
    });
    assert(getCommentsRes.status === 200, 'GET /api/literature/:id/comments returns 200');
    assert(
      getCommentsRes.body.comments.some((c: any) => c.content === guestCommentContent),
      'Created guest comment appears in comments list'
    );

    // --- SECTION 4: Registered User Creation & Publishing ---
    console.log('\n--- Section 4: Registered User Creation & Publishing Flow ---');
    const timestamp = Date.now();
    const newUser = {
      name: 'E2E Test Author',
      username: `e2e_author_${timestamp}`,
      email: `e2e_author_${timestamp}@example.com`,
      password: 'StrongPassword123!',
      bio: 'Automated E2E Test Author Bio'
    };

    const regRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/auth/register',
      body: newUser
    });

    assert(regRes.status === 201, 'POST /api/auth/register returns 201 Created');
    assert(typeof regRes.body.token === 'string', 'Received valid auth token');
    const authToken = regRes.body.token;

    const newLitTitle = `E2E Original Poem ${timestamp}`;
    const pubLitRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/literature',
      headers: {
        Authorization: `Bearer ${authToken}`
      },
      body: {
        title: newLitTitle,
        content: 'Waves echo on distant shores,\nWords remain when night explores.',
        category: 'poem',
        language: 'en'
      }
    });

    assert(pubLitRes.status === 201, 'POST /api/literature returns 201 Created');
    assert(pubLitRes.body.literature.title === newLitTitle, 'Published literature title matches input');
    const pubSlug = pubLitRes.body.literature.slug;
    assert(typeof pubSlug === 'string' && pubSlug.length > 0, 'Literature received auto-generated unique slug');

    // Fetch detail by slug
    const detailRes = await makeRequest(server, {
      method: 'GET',
      path: `/api/literature/${encodeURIComponent(pubSlug)}`
    });
    assert(detailRes.status === 200, 'GET /api/literature/:slug returns 200');
    assert(detailRes.body.literature.title === newLitTitle, 'Fetched literature detail matches published work');

    // --- SECTION 5: Author Following & Personalized Feed ---
    console.log('\n--- Section 5: Author Following & Personalized Feed Logic ---');
    const authorRes = await makeRequest(server, {
      method: 'GET',
      path: '/api/authors/tagore'
    });

    assert(authorRes.status === 200, 'GET /api/authors/tagore returns 200');
    const tagoreId = authorRes.body.author.id;

    // Follow Tagore
    const followRes = await makeRequest(server, {
      method: 'POST',
      path: `/api/authors/${tagoreId}/follow`,
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });
    assert(followRes.status === 200, 'POST /api/authors/:id/follow returns 200');
    assert(followRes.body.is_following === true, 'Author follow status is_following: true');

    // Get Feed
    const feedRes = await makeRequest(server, {
      method: 'GET',
      path: '/api/feed',
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });
    assert(feedRes.status === 200, 'GET /api/feed returns 200 for authenticated user');
    assert(Array.isArray(feedRes.body.items), 'Feed response contains items array');
    assert(
      feedRes.body.items.some((item: any) => item.author.username === 'tagore'),
      'Feed contains works by followed author (@tagore)'
    );

    // Clean up follow state
    await makeRequest(server, {
      method: 'POST',
      path: `/api/authors/${tagoreId}/follow`,
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });

    // --- SECTION 6: Vercel Configurations Integrity ---
    console.log('\n--- Section 6: Vercel Configurations Integrity ---');
    const backendVercelPath = path.resolve(process.cwd(), 'vercel.json');
    const clientVercelPath = path.resolve(process.cwd(), '../lit-pwa-client/vercel.json');

    const backendVercelExists = fs.existsSync(backendVercelPath);
    assert(backendVercelExists, 'lit-api-backend/vercel.json exists');
    if (backendVercelExists) {
      const backendVercel = JSON.parse(fs.readFileSync(backendVercelPath, 'utf8'));
      assert(backendVercel.version === 2, 'lit-api-backend/vercel.json uses version 2');
      assert(
        Array.isArray(backendVercel.builds) && backendVercel.builds.some((b: any) => b.src === 'api/index.ts'),
        'lit-api-backend/vercel.json configures api/index.ts build'
      );
      assert(
        Array.isArray(backendVercel.routes) && backendVercel.routes.some((r: any) => r.dest === 'api/index.ts'),
        'lit-api-backend/vercel.json routes traffic to api/index.ts'
      );
    }

    const clientVercelExists = fs.existsSync(clientVercelPath);
    assert(clientVercelExists, 'lit-pwa-client/vercel.json exists');
    if (clientVercelExists) {
      const clientVercel = JSON.parse(fs.readFileSync(clientVercelPath, 'utf8'));
      assert(
        Array.isArray(clientVercel.rewrites) && clientVercel.rewrites.some((r: any) => r.destination === '/index.html'),
        'lit-pwa-client/vercel.json contains SPA rewrite to /index.html'
      );
      assert(
        Array.isArray(clientVercel.headers) && clientVercel.headers.some((h: any) => h.source === '/sw.js'),
        'lit-pwa-client/vercel.json configures headers for /sw.js'
      );
    }

    // --- CLEANUP ---
    console.log('\n--- Section 7: Cleaning Up E2E Test Data ---');
    if (newUser.email) {
      const u = await db.user.findUnique({ where: { email: newUser.email } });
      if (u) {
        await db.literature.deleteMany({ where: { authorId: u.id } });
        await db.user.delete({ where: { id: u.id } });
        console.log('Cleaned up E2E test user and published works.');
      }
    }
  } finally {
    server.close();
  }

  console.log('\n====================================================');
  console.log(` E2E SYSTEM VERIFICATION COMPLETE: ${passedTests} passed, ${failedTests} failed.`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runE2EVerification()
  .catch((err) => {
    console.error('E2E Verification crashed with error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
