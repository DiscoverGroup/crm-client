/**
 * GET /.netlify/functions/get-client-counts
 *
 * Returns the number of active (non-deleted, non-test) clients per agent.
 * Used by the Admin Panel to display accurate quota usage from MongoDB,
 * regardless of which browser the admin is using.
 *
 * Requires admin JWT.
 */

import type { Handler } from '@netlify/functions';
import { verifyAuthToken, unauthorizedResponse, forbiddenResponse, isAdmin } from './middleware/authMiddleware';
import { getSecurityHeaders, getCORSHeaders } from './utils/securityUtils';
import { getMongoDb } from './utils/mongoClient';

export const handler: Handler = async (event) => {
  const headers = {
    ...getCORSHeaders(process.env.ALLOWED_ORIGIN),
    ...getSecurityHeaders(),
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // ── Auth: admin only ────────────────────────────────────────────────────────
  const auth = verifyAuthToken(event.headers['authorization']);
  if (!auth.valid) return unauthorizedResponse(headers, auth.error);
  if (!isAdmin(auth.user!)) return forbiddenResponse(headers, 'Admin access required');

  try {
    const db = await getMongoDb();
    const clientsCol = db.collection('clients');

    // Aggregate: count active clients grouped by agent
    const pipeline = [
      {
        $match: {
          isDeleted: { $ne: true },
          isTestRecord: { $ne: true },
          agent: { $exists: true, $ne: '' }
        }
      },
      {
        $group: {
          _id: { $toLower: { $trim: { input: '$agent' } } },
          count: { $sum: 1 }
        }
      }
    ];

    const results = await clientsCol.aggregate(pipeline).toArray();

    // Build a map: agent (lowercase) → count
    const agentCounts: Record<string, number> = {};
    for (const r of results) {
      if (r._id) {
        agentCounts[r._id] = r.count;
      }
    }

    // Also get total active clients and unassigned count
    const totalActive = await clientsCol.countDocuments({
      isDeleted: { $ne: true },
      isTestRecord: { $ne: true }
    });

    const unassigned = await clientsCol.countDocuments({
      isDeleted: { $ne: true },
      isTestRecord: { $ne: true },
      $or: [
        { agent: { $exists: false } },
        { agent: '' },
        { agent: null }
      ]
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        agentCounts,
        totalActive,
        unassigned
      })
    };
  } catch (error: any) {
    console.error('[get-client-counts] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Failed to get client counts' })
    };
  }
};
