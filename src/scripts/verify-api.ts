process.env.NODE_ENV = 'test';

import http from 'http';
import { db } from '../db.js';
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
            // keep raw string
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
  console.log('  TASK 3: LITERATURE, LIKES, COMMENTS & AUTHORS API');
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

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const serverAddr = server.address();
  console.log(`Test HTTP server running on port ${(serverAddr as any).port}\n`);

  const testUser = {
    name: 'Verification User',
    username: `verif_user_${Date.now()}`,
    email: `verif_${Date.now()}@example.com`,
    password: 'Password123!'
  };

  let bearerToken = '';
  let sampleLitId = '';
  let sampleLitSlug = '';

  try {
    // --- 1. User Registration & Auth setup ---
    console.log('--- Step 1: Register Test User for Auth Endpoints ---');
    const regRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/auth/register',
      body: testUser
    });

    assert(regRes.status === 201, 'POST /api/auth/register returns 201');
    assert(typeof regRes.body.token === 'string', 'Received JWT token');
    bearerToken = regRes.body.token;

    // --- 2. GET /api/literature (List & Filtering) ---
    console.log('\n--- Step 2: Testing Literature List & Filtering ---');
    const listRes = await makeRequest(server, {
      method: 'GET',
      path: '/api/literature?page=1&limit=5'
    });

    assert(listRes.status === 200, 'GET /api/literature returns 200');
    assert(Array.isArray(listRes.body.items), 'Returns items array');
    assert(listRes.body.items.length > 0, 'Literature list is populated');
    assert(typeof listRes.body.pagination.total === 'number', 'Pagination total is provided');

    const firstItem = listRes.body.items[0];
    sampleLitId = firstItem.id;
    sampleLitSlug = firstItem.slug;
    assert(typeof firstItem.likesCount === 'number', 'Item includes likesCount');
    assert(typeof firstItem.commentsCount === 'number', 'Item includes commentsCount');
    assert(typeof firstItem.is_liked === 'boolean', 'Item includes is_liked boolean');
    assert(firstItem.author && typeof firstItem.author.name === 'string', 'Item includes author details');

    // Category filter
    console.log('\n--- Category Filter (poem) ---');
    const categoryRes = await makeRequest(server, {
      method: 'GET',
      path: '/api/literature?category=poem'
    });
    assert(categoryRes.status === 200, 'GET /api/literature?category=poem returns 200');
    assert(
      categoryRes.body.items.every((i: any) => i.category === 'poem'),
      'All returned items have category === poem'
    );

    // Language filter
    console.log('\n--- Language Filter (bn) ---');
    const langRes = await makeRequest(server, {
      method: 'GET',
      path: '/api/literature?language=bn'
    });
    assert(langRes.status === 200, 'GET /api/literature?language=bn returns 200');
    assert(
      langRes.body.items.every((i: any) => i.language === 'bn'),
      'All returned items have language === bn'
    );

    // --- 3. GET /api/literature/:slug (Detail & Views Increment) ---
    console.log('\n--- Step 3: Testing Literature Slug Detail & Views Count Increment ---');
    const detailRes1 = await makeRequest(server, {
      method: 'GET',
      path: `/api/literature/${encodeURIComponent(sampleLitSlug)}`
    });

    assert(detailRes1.status === 200, 'GET /api/literature/:slug returns 200');
    const initialViews = detailRes1.body.literature.viewsCount;
    assert(typeof initialViews === 'number', 'Returns valid viewsCount');
    assert(Array.isArray(detailRes1.body.literature.comments), 'Returns comments array in detail');

    const detailRes2 = await makeRequest(server, {
      method: 'GET',
      path: `/api/literature/${encodeURIComponent(sampleLitSlug)}`
    });
    const updatedViews = detailRes2.body.literature.viewsCount;
    assert(updatedViews === initialViews + 1, `viewsCount incremented from ${initialViews} to ${updatedViews}`);

    // --- 4. Guest Like Toggle ---
    console.log('\n--- Step 4: Testing Guest Like Toggle (POST /api/literature/:id/like) ---');
    const guestFingerprint = `guest_device_test_${Date.now()}`;
    const initialLikesCount = firstItem.likesCount;

    const likeRes1 = await makeRequest(server, {
      method: 'POST',
      path: `/api/literature/${sampleLitId}/like`,
      headers: {
        'x-device-fingerprint': guestFingerprint
      }
    });

    assert(likeRes1.status === 200, 'POST /api/literature/:id/like returns 200 for guest');
    assert(likeRes1.body.is_liked === true, 'Guest like toggled ON (is_liked: true)');
    assert(likeRes1.body.likes_count === initialLikesCount + 1, 'likes_count incremented');

    const likeRes2 = await makeRequest(server, {
      method: 'POST',
      path: `/api/literature/${sampleLitId}/like`,
      headers: {
        'x-device-fingerprint': guestFingerprint
      }
    });

    assert(likeRes2.status === 200, 'POST /api/literature/:id/like returns 200 for guest toggle off');
    assert(likeRes2.body.is_liked === false, 'Guest like toggled OFF (is_liked: false)');
    assert(likeRes2.body.likes_count === initialLikesCount, 'likes_count restored');

    // --- 5. Guest Comment & Fetch Comments ---
    console.log('\n--- Step 5: Testing Guest Comment Creation & Listing ---');
    const guestCommentContent = `Guest opinion comment ${Date.now()}`;
    const commentRes = await makeRequest(server, {
      method: 'POST',
      path: `/api/literature/${sampleLitId}/comment`,
      headers: {
        'x-device-fingerprint': guestFingerprint
      },
      body: {
        content: guestCommentContent,
        guest_name: 'Guest Tester'
      }
    });

    assert(commentRes.status === 201, 'POST /api/literature/:id/comment returns 201 Created');
    assert(commentRes.body.comment.guestName === 'Guest Tester', 'Returns guestName in created comment');

    const commentsListRes = await makeRequest(server, {
      method: 'GET',
      path: `/api/literature/${sampleLitId}/comments`
    });

    assert(commentsListRes.status === 200, 'GET /api/literature/:id/comments returns 200');
    assert(
      commentsListRes.body.comments.some((c: any) => c.content === guestCommentContent),
      'Created guest comment appears in comments list'
    );

    // --- 6. Authenticated Create Literature ---
    console.log('\n--- Step 6: Testing Authenticated Literature Creation (POST /api/literature) ---');
    const newPoemTitle = `Autonomous Verse ${Date.now()}`;
    const createLitRes = await makeRequest(server, {
      method: 'POST',
      path: '/api/literature',
      headers: {
        Authorization: `Bearer ${bearerToken}`
      },
      body: {
        title: newPoemTitle,
        content: 'Soft winds blow across the sea,\nIn silence we set the spirit free.',
        category: 'poem',
        language: 'en'
      }
    });

    assert(createLitRes.status === 201, 'POST /api/literature returns 201 Created');
    assert(createLitRes.body.literature.title === newPoemTitle, 'Created literature title matches');
    assert(typeof createLitRes.body.literature.slug === 'string', 'Auto-generated unique slug created');

    // --- 7. Authenticated User Like & Comment ---
    console.log('\n--- Step 7: Testing Authenticated User Like & Comment ---');
    const authLikeRes = await makeRequest(server, {
      method: 'POST',
      path: `/api/literature/${sampleLitId}/like`,
      headers: {
        Authorization: `Bearer ${bearerToken}`
      }
    });

    assert(authLikeRes.status === 200, 'Authenticated user POST /like returns 200');
    assert(authLikeRes.body.is_liked === true, 'User like toggled ON');

    const authCommentContent = `User authenticated critique ${Date.now()}`;
    const authCommentRes = await makeRequest(server, {
      method: 'POST',
      path: `/api/literature/${sampleLitId}/comment`,
      headers: {
        Authorization: `Bearer ${bearerToken}`
      },
      body: {
        content: authCommentContent
      }
    });

    assert(authCommentRes.status === 201, 'Authenticated user comment returns 201');
    assert(authCommentRes.body.comment.user?.username === testUser.username, 'Comment attached to authenticated user');

    // --- 8. Authors & Follow API ---
    console.log('\n--- Step 8: Testing Author Profile & Follow Toggle ---');
    const authorRes = await makeRequest(server, {
      method: 'GET',
      path: '/api/authors/nazrul'
    });

    assert(authorRes.status === 200, 'GET /api/authors/nazrul returns 200');
    assert(authorRes.body.author.username === 'nazrul', 'Author profile returned');
    assert(typeof authorRes.body.author.worksCount === 'number', 'Author worksCount included');
    assert(typeof authorRes.body.author.followersCount === 'number', 'Author followersCount included');
    assert(typeof authorRes.body.author.followingCount === 'number', 'Author followingCount included');

    const targetAuthorId = authorRes.body.author.id;
    const initialFollowers = authorRes.body.author.followersCount;

    // Toggle follow ON
    const followRes1 = await makeRequest(server, {
      method: 'POST',
      path: `/api/authors/${targetAuthorId}/follow`,
      headers: {
        Authorization: `Bearer ${bearerToken}`
      }
    });

    assert(followRes1.status === 200, 'POST /api/authors/:id/follow returns 200');
    assert(followRes1.body.is_following === true, 'is_following is true');
    assert(followRes1.body.followers_count === initialFollowers + 1, 'followers_count incremented');

    // Verify GET /api/authors/:id shows is_following: true for this user
    const authorWithAuthRes = await makeRequest(server, {
      method: 'GET',
      path: '/api/authors/nazrul',
      headers: {
        Authorization: `Bearer ${bearerToken}`
      }
    });
    assert(authorWithAuthRes.body.author.is_following === true, 'GET /api/authors/nazrul with auth shows is_following: true');

    // --- 9. Feed API ---
    console.log('\n--- Step 9: Testing Feed API (GET /api/feed) ---');
    const feedRes = await makeRequest(server, {
      method: 'GET',
      path: '/api/feed',
      headers: {
        Authorization: `Bearer ${bearerToken}`
      }
    });

    assert(feedRes.status === 200, 'GET /api/feed returns 200 for authenticated user');
    assert(Array.isArray(feedRes.body.items), 'Returns feed items array');
    assert(feedRes.body.items.length > 0, 'Feed contains literature from followed author (@nazrul)');
    assert(
      feedRes.body.items.every((item: any) => item.author.username === 'nazrul'),
      'Feed items belong to followed author'
    );

    // Unfollow author to leave database clean
    console.log('\n--- Unfollowing Author to reset state ---');
    const followRes2 = await makeRequest(server, {
      method: 'POST',
      path: `/api/authors/${targetAuthorId}/follow`,
      headers: {
        Authorization: `Bearer ${bearerToken}`
      }
    });
    assert(followRes2.body.is_following === false, 'Follow toggled OFF successfully');

  } finally {
    // --- Cleanup Verification User & Created Lit ---
    console.log('\n--- Step 10: Cleaning up Test Data ---');
    try {
      if (testUser.email) {
        const user = await db.user.findUnique({ where: { email: testUser.email } });
        if (user) {
          await db.literature.deleteMany({ where: { authorId: user.id } });
          await db.user.delete({ where: { id: user.id } });
        }
      }
      console.log('Cleanup completed successfully.');
    } catch (cleanupErr) {
      console.error('Cleanup error:', cleanupErr);
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
  });
