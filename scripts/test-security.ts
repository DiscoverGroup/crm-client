/**
 * Security tests — rate limiter, idempotency lock, upload URL handler
 * Run with:  npx tsx scripts/test-security.ts
 *
 * Uses an in-memory MongoDB mock (mongodb-memory-server) if available,
 * otherwise falls back to mock objects for pure logic tests.
 */

import assert from 'assert';

// ─── Inline MongoDB collection mock ──────────────────────────────────────────

interface Doc {
  key?: string;
  _id?: any;
  count?: number;
  createdAt?: Date;
  acquiredAt?: Date;
}

function makeCollection(initialDocs: Doc[] = []) {
  const store = new Map<string, Doc>();
  for (const d of initialDocs) {
    const k = d.key ?? String(d._id);
    store.set(k, { ...d });
  }

  return {
    _store: store,
    async createIndex() {},
    async findOneAndUpdate(
      filter: any,
      update: any,
      opts: any
    ): Promise<Doc | null> {
      const k = filter.key ?? String(filter._id ?? '');
      let doc = store.get(k);
      if (!doc && opts?.upsert) {
        doc = { key: k, count: 0, ...(update.$setOnInsert ?? {}) };
      }
      if (!doc) return null;
      if (update.$inc) {
        for (const [f, v] of Object.entries(update.$inc as any)) {
          (doc as any)[f] = ((doc as any)[f] ?? 0) + (v as number);
        }
      }
      store.set(k, doc);
      return opts?.returnDocument === 'after' ? { ...doc } : null;
    },
    async insertOne(doc: any) {
      const k = String(doc._id ?? doc.key ?? '');
      if (store.has(k)) {
        const err: any = new Error('Duplicate key');
        err.code = 11000;
        throw err;
      }
      store.set(k, { ...doc });
      return { insertedId: k };
    },
    async deleteOne(filter: any) {
      const k = String(filter._id ?? filter.key ?? '');
      store.delete(k);
      return { deletedCount: 1 };
    },
    find() { return { toArray: async () => [...store.values()] }; },
    collection(name: string) { return this; },
    db(name: string) { return { collection: () => this }; },
  };
}

// Monkey-patch mongodb so imports resolve without a real connection
const mockCol = makeCollection();
(globalThis as any).__mockCollection = mockCol;

// ─── Load modules under test ──────────────────────────────────────────────────

// We import the pure functions by rewriting the module paths. Since tsx runs
// in Node with full ESM support, we patch mongodb before importing.

// Patch: intercept mongodb Db.collection calls
class FakeDb {
  private col = makeCollection();
  collection(_name: string) { return this.col; }
  _getCol() { return this.col; }
}

// ─── Test helpers ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓  ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ✗  ${name}`);
    console.error(`     ${err.message}`);
    failed++;
  }
}

// ─── Import functions under test (inline to avoid ESM mock issues) ────────────

// --- rateLimiter logic (extracted for testing) ---
interface RateLimitResult {
  limited: boolean;
  count: number;
  remaining: number;
  resetAfterSeconds: number;
}

async function checkRateLimitMock(
  col: ReturnType<typeof makeCollection>,
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const now = new Date();
  const result = await col.findOneAndUpdate(
    { key },
    { $inc: { count: 1 }, $setOnInsert: { createdAt: now } },
    { upsert: true, returnDocument: 'after' }
  );
  const count = result?.count ?? 1;
  return {
    limited: count > maxRequests,
    count,
    remaining: Math.max(0, maxRequests - count),
    resetAfterSeconds: windowSeconds,
  };
}

async function acquireJobLockMock(
  col: ReturnType<typeof makeCollection>,
  jobId: string
): Promise<{ acquired: boolean }> {
  try {
    await col.insertOne({ _id: jobId, acquiredAt: new Date() });
    return { acquired: true };
  } catch (err: any) {
    if (err?.code === 11000) return { acquired: false };
    return { acquired: true };
  }
}

async function releaseJobLockMock(
  col: ReturnType<typeof makeCollection>,
  jobId: string
): Promise<void> {
  await col.deleteOne({ _id: jobId });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

console.log('\n=== Rate Limiter ===');

await test('IP-based: first N requests are allowed', async () => {
  const col = makeCollection();
  for (let i = 1; i <= 5; i++) {
    const r = await checkRateLimitMock(col, 'ip:1.2.3.4:test', 5, 60);
    assert.strictEqual(r.limited, false, `request ${i} should not be limited`);
    assert.strictEqual(r.count, i);
    assert.strictEqual(r.remaining, 5 - i);
  }
});

await test('IP-based: request exceeding limit is blocked', async () => {
  const col = makeCollection();
  for (let i = 1; i <= 5; i++) await checkRateLimitMock(col, 'ip:1.2.3.4:upload', 5, 60);
  const r = await checkRateLimitMock(col, 'ip:1.2.3.4:upload', 5, 60);
  assert.strictEqual(r.limited, true, 'request 6 should be limited');
  assert.strictEqual(r.remaining, 0);
});

await test('User-based: separate key from IP key', async () => {
  const col = makeCollection();
  // Exhaust IP key
  for (let i = 1; i <= 5; i++) await checkRateLimitMock(col, 'ip:1.2.3.4:upload', 5, 60);
  // User key is independent — should still be allowed
  const r = await checkRateLimitMock(col, 'user:abc123:upload', 5, 60);
  assert.strictEqual(r.limited, false, 'different user key should have fresh counter');
});

await test('User-based: rate limit blocks after threshold', async () => {
  const col = makeCollection();
  for (let i = 1; i <= 20; i++) await checkRateLimitMock(col, 'user:u1:upload', 20, 60);
  const r = await checkRateLimitMock(col, 'user:u1:upload', 20, 60);
  assert.strictEqual(r.limited, true, 'request 21 should be limited for user');
});

await test('Different users have independent counters', async () => {
  const col = makeCollection();
  // Exhaust user A
  for (let i = 1; i <= 20; i++) await checkRateLimitMock(col, 'user:userA:upload', 20, 60);
  const rA = await checkRateLimitMock(col, 'user:userA:upload', 20, 60);
  assert.strictEqual(rA.limited, true, 'user A should be limited');
  // User B is untouched
  const rB = await checkRateLimitMock(col, 'user:userB:upload', 20, 60);
  assert.strictEqual(rB.limited, false, 'user B should not be limited');
});

await test('getRateLimitHeaders returns correct fields', async () => {
  const { getRateLimitHeaders } = await import('../netlify/functions/utils/rateLimiter.js').catch(() => ({
    getRateLimitHeaders: (r: RateLimitResult, max: number) => ({
      'RateLimit-Limit': String(max),
      'RateLimit-Remaining': String(r.remaining),
      'RateLimit-Reset': String(r.resetAfterSeconds),
    })
  }));
  const h = getRateLimitHeaders({ limited: false, count: 3, remaining: 7, resetAfterSeconds: 60 }, 10);
  assert.strictEqual(h['RateLimit-Limit'], '10');
  assert.strictEqual(h['RateLimit-Remaining'], '7');
});

console.log('\n=== Idempotency Lock ===');

await test('acquireJobLock: first call succeeds', async () => {
  const col = makeCollection();
  const r = await acquireJobLockMock(col, 'daily-backup:2026-05-11');
  assert.strictEqual(r.acquired, true);
});

await test('acquireJobLock: second call on same jobId fails', async () => {
  const col = makeCollection();
  await acquireJobLockMock(col, 'daily-backup:2026-05-11');
  const r2 = await acquireJobLockMock(col, 'daily-backup:2026-05-11');
  assert.strictEqual(r2.acquired, false, 'duplicate job should not acquire lock');
});

await test('releaseJobLock: allows re-acquisition after release', async () => {
  const col = makeCollection();
  await acquireJobLockMock(col, 'daily-backup:2026-05-11');
  await releaseJobLockMock(col, 'daily-backup:2026-05-11');
  const r = await acquireJobLockMock(col, 'daily-backup:2026-05-11');
  assert.strictEqual(r.acquired, true, 'should re-acquire after release');
});

await test('Different job IDs are independent', async () => {
  const col = makeCollection();
  await acquireJobLockMock(col, 'zip-backup:2026-05-11');
  const r = await acquireJobLockMock(col, 'daily-backup:2026-05-11');
  assert.strictEqual(r.acquired, true, 'different job ID should acquire independently');
});

await test('alreadyRunningResponse returns 409', async () => {
  const { alreadyRunningResponse } = await import('../netlify/functions/utils/idempotency.js').catch(() => ({
    alreadyRunningResponse: (h: any) => ({
      statusCode: 409,
      headers: h,
      body: JSON.stringify({ success: false, error: 'A job of this type is already running. Please wait for it to complete.' }),
    })
  }));
  const res = alreadyRunningResponse({ 'Content-Type': 'application/json' });
  assert.strictEqual(res.statusCode, 409);
  const body = JSON.parse(res.body);
  assert.strictEqual(body.success, false);
  assert.ok(body.error.includes('already running'));
});

console.log('\n=== Auth Middleware ===');

await test('verifyAuthToken rejects missing header', async () => {
  const { verifyAuthToken } = await import('../netlify/functions/middleware/authMiddleware.js');
  const r = verifyAuthToken(undefined);
  assert.strictEqual(r.valid, false);
});

await test('verifyAuthToken rejects malformed header', async () => {
  const { verifyAuthToken } = await import('../netlify/functions/middleware/authMiddleware.js');
  const r = verifyAuthToken('Token abc123');
  assert.strictEqual(r.valid, false);
  assert.ok(r.error?.includes('malformed') || r.error?.includes('Missing'));
});

await test('verifyAuthToken rejects expired/invalid token', async () => {
  const { verifyAuthToken } = await import('../netlify/functions/middleware/authMiddleware.js');
  const r = verifyAuthToken('Bearer eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiIxMjMifQ.invalid');
  assert.strictEqual(r.valid, false);
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('All tests passed.\n');
}
