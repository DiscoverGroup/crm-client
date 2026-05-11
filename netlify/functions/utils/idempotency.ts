/**
 * MongoDB-backed idempotency / job-lock utility for background functions.
 *
 * Prevents duplicate concurrent executions of expensive background operations
 * (zip creation, daily backup, etc.) even when rate-limit bypass allows
 * multiple requests to reach the function simultaneously.
 *
 * Usage:
 *   const lock = await acquireJobLock(db, 'zip-backup:2026-05-11', 900);
 *   if (!lock.acquired) return alreadyRunningResponse(headers);
 *   try {
 *     await doExpensiveWork();
 *   } finally {
 *     await releaseJobLock(db, 'zip-backup:2026-05-11');
 *   }
 */

import type { Db } from 'mongodb';
import { logInfo, logWarn } from './logger';

const COLLECTION = 'job_locks';

export interface JobLockResult {
  acquired: boolean;
  jobId: string;
}

/**
 * Attempts to acquire an exclusive lock for a given jobId.
 * Returns { acquired: true } if the lock was obtained.
 * Returns { acquired: false } if another process already holds it.
 *
 * The lock document expires automatically after ttlSeconds via a MongoDB
 * TTL index — no orphaned locks if the function crashes mid-run.
 *
 * @param db         Mongo Db instance
 * @param jobId      Unique job identifier, e.g. 'daily-backup:2026-05-11'
 * @param ttlSeconds Maximum expected job duration; lock auto-expires after this
 */
export async function acquireJobLock(
  db: Db,
  jobId: string,
  ttlSeconds: number
): Promise<JobLockResult> {
  const col = db.collection(COLLECTION);
  const now = new Date();

  // Ensure TTL index — no-op if already present
  try {
    await col.createIndex(
      { acquiredAt: 1 },
      { expireAfterSeconds: ttlSeconds, background: true }
    );
  } catch {
    // Index exists with different TTL or other benign error — continue
  }

  try {
    // insertOne throws duplicate-key (code 11000) if the document exists
    await col.insertOne({ _id: jobId as any, acquiredAt: now });
    logInfo({ fn: 'idempotency', msg: 'Job lock acquired', op: jobId });
    return { acquired: true, jobId };
  } catch (err: any) {
    if (err?.code === 11000) {
      logWarn({ fn: 'idempotency', msg: 'Job already running — lock not acquired', op: jobId });
      return { acquired: false, jobId };
    }
    // Unexpected DB error — fail open (don't block the job) but log it
    logWarn({ fn: 'idempotency', msg: 'Lock acquisition failed unexpectedly, proceeding', op: jobId, err: String(err) });
    return { acquired: true, jobId };
  }
}

/**
 * Releases the job lock after the job completes (or fails).
 * Safe to call even if the lock was never acquired.
 */
export async function releaseJobLock(db: Db, jobId: string): Promise<void> {
  try {
    const col = db.collection(COLLECTION);
    await col.deleteOne({ _id: jobId as any });
    logInfo({ fn: 'idempotency', msg: 'Job lock released', op: jobId });
  } catch {
    // Non-fatal: the TTL index will clean it up automatically
  }
}

/**
 * Returns a 409 Conflict response when a duplicate job is detected.
 */
export function alreadyRunningResponse(headers: Record<string, string>) {
  return {
    statusCode: 409,
    headers,
    body: JSON.stringify({
      success: false,
      error: 'A job of this type is already running. Please wait for it to complete.',
    }),
  };
}
