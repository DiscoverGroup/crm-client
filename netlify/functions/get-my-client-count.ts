/**
 * GET /.netlify/functions/get-my-client-count
 *
 * Returns the number of distinct active clients the calling user has
 * created or edited, based on the activity_logs collection.
 *
 * Used by the client-form quota check so users see an accurate count
 * regardless of which browser they're on.
 */

import type { Handler } from '@netlify/functions';
import { verifyAuthToken, unauthorizedResponse } from './middleware/authMiddleware';
import { getSecurityHeaders, getCORSHeaders } from './utils/securityUtils';
import { getMongoDb } from './utils/mongoClient';

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

  const auth = verifyAuthToken(event.headers['authorization']);
  if (!auth.valid) return unauthorizedResponse(headers, auth.error);

  const userName = (auth.user!.fullName || '').trim();
  if (!userName) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, count: 0 })
    };
  }

  try {
    const db = await getMongoDb();
    const logsCol = db.collection('activity_logs');
    const clientsCol = db.collection('clients');

    // Distinct client IDs the user has touched, matched case-insensitively on full name
    const distinctClients = await logsCol.distinct('clientId', {
      action: { $in: COUNTED_ACTIONS },
      performedByUser: { $regex: `^${escapeRegex(userName)}$`, $options: 'i' }
    });

    const idList = (distinctClients as any[]).filter(Boolean) as string[];

    // Filter to active clients only
    const activeCount = idList.length === 0 ? 0 : await clientsCol.countDocuments({
      id: { $in: idList },
      isDeleted: { $ne: true },
      isTestRecord: { $ne: true }
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, count: activeCount })
    };
  } catch (error: any) {
    console.error('[get-my-client-count] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Failed to get client count' })
    };
  }
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
