/**
 * GET /.netlify/functions/get-client-counts
 *
 * Returns the number of DISTINCT active clients each user has created
 * or edited, derived from the activity_logs collection.
 *
 * "Clients Used" = count of unique clientIds the user has touched
 * (created or edited) — not just the ones where their name appears
 * in the free-text Sales Agent field.
 *
 * Requires admin JWT.
 */

import type { Handler } from '@netlify/functions';
import { verifyAuthToken, unauthorizedResponse, forbiddenResponse, isAdmin } from './middleware/authMiddleware';
import { getSecurityHeaders, getCORSHeaders } from './utils/securityUtils';
import { getMongoDb } from './utils/mongoClient';

// Actions that count toward "clients used" — anything that represents
// the user actively working on a client record.
const COUNTED_ACTIONS = ['created', 'edited', 'file_uploaded', 'file_deleted'];

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
    const logsCol = db.collection('activity_logs');
    const clientsCol = db.collection('clients');

    // Get the set of currently-active client IDs so we don't count clients
    // that have been deleted.
    const activeClients = await clientsCol
      .find({ isDeleted: { $ne: true }, isTestRecord: { $ne: true } })
      .project({ id: 1, _id: 0 })
      .toArray();
    const activeClientIds = new Set<string>(
      activeClients.map((c: any) => c.id).filter(Boolean)
    );

    // Aggregate distinct (performedBy → clientId) pairs from activity logs.
    // Only count actions that represent active work on a client.
    const pipeline = [
      {
        $match: {
          action: { $in: COUNTED_ACTIONS },
          clientId: { $exists: true, $ne: '' },
          performedByUser: { $exists: true, $ne: '' }
        }
      },
      {
        $group: {
          // Group by (user, clientId) so each unique client per user is one row
          _id: {
            user: '$performedByUser',
            clientId: '$clientId'
          }
        }
      },
      {
        $group: {
          // Now count how many distinct clients each user touched
          _id: '$_id.user',
          clientIds: { $addToSet: '$_id.clientId' }
        }
      }
    ];

    const results = await logsCol.aggregate(pipeline).toArray();

    // Build a map: lower-cased user name → distinct active client count
    const byUserName: Record<string, number> = {};
    for (const r of results) {
      const userKey = (r._id || '').trim().toLowerCase();
      if (!userKey) continue;
      // Filter to only active (non-deleted) clients
      const activeCount = (r.clientIds as string[]).filter(id => activeClientIds.has(id)).length;
      if (activeCount > 0) {
        byUserName[userKey] = activeCount;
      }
    }

    // Total active clients in the system
    const totalActive = activeClientIds.size;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        byUserName,
        totalActive
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
