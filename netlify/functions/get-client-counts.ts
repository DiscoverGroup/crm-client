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

    // Aggregate: count active clients grouped by the user who CREATED them.
    // Falls back to legacy `agent` field for older records that don't have createdBy.
    const pipeline = [
      {
        $match: {
          isDeleted: { $ne: true },
          isTestRecord: { $ne: true }
        }
      },
      {
        $group: {
          _id: {
            createdBy: '$createdBy',
            createdByEmail: { $toLower: { $ifNull: ['$createdByEmail', ''] } },
            // Lowercase agent as legacy fallback identifier
            agent: { $toLower: { $trim: { input: { $ifNull: ['$agent', ''] } } } }
          },
          count: { $sum: 1 }
        }
      }
    ];

    const results = await clientsCol.aggregate(pipeline).toArray();

    // Build maps so the client-side can match by user ID, email, or legacy agent text
    const byUserId: Record<string, number> = {};
    const byEmail: Record<string, number> = {};
    const byAgent: Record<string, number> = {};

    for (const r of results) {
      const { createdBy, createdByEmail, agent } = r._id || {};
      if (createdBy) {
        byUserId[createdBy] = (byUserId[createdBy] || 0) + r.count;
      } else if (createdByEmail) {
        byEmail[createdByEmail] = (byEmail[createdByEmail] || 0) + r.count;
      } else if (agent) {
        // Legacy fallback for clients without createdBy
        byAgent[agent] = (byAgent[agent] || 0) + r.count;
      }
    }

    const totalActive = await clientsCol.countDocuments({
      isDeleted: { $ne: true },
      isTestRecord: { $ne: true }
    });

    const unassigned = await clientsCol.countDocuments({
      isDeleted: { $ne: true },
      isTestRecord: { $ne: true },
      $and: [
        { $or: [{ createdBy: { $exists: false } }, { createdBy: '' }, { createdBy: null }] },
        { $or: [{ createdByEmail: { $exists: false } }, { createdByEmail: '' }, { createdByEmail: null }] },
        { $or: [{ agent: { $exists: false } }, { agent: '' }, { agent: null }] }
      ]
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        // New shape: counts grouped by user identifier
        byUserId,
        byEmail,
        byAgent,
        // Backward-compatible alias for older clients (matches by agent only)
        agentCounts: byAgent,
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
