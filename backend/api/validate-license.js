const { send, json } = require('micro');
const cors = require('micro-cors')({
  allowMethods: ['POST', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
  origin: '*',
});
const { getSql } = require('../lib/db');

/**
 * Validate a license key.
 *
 * This is the endpoint the extension must call before granting premium.
 * Until it existed, activatePremium() trusted whatever the user typed.
 */
async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return send(res, 200, 'ok');
  }

  if (req.method !== 'POST') {
    return send(res, 405, { error: 'Method not allowed' });
  }

  try {
    const { licenseKey } = await json(req);

    if (typeof licenseKey !== 'string' || licenseKey.trim() === '') {
      return send(res, 400, { valid: false, error: 'Missing license key' });
    }

    const sql = getSql();
    const rows = await sql`
      UPDATE licenses
         SET last_seen_at = now()
       WHERE key = ${licenseKey.trim().toUpperCase()}
         AND status = 'active'
      RETURNING key, created_at
    `;

    if (rows.length === 0) {
      // Same response for "no such key" and "revoked key" — no reason to help
      // anyone enumerate which is which.
      return send(res, 200, { valid: false });
    }

    return send(res, 200, { valid: true, issuedAt: rows[0].created_at });
  } catch (error) {
    console.error('[validate-license] Failed:', error);
    // Fail closed: a database outage must not hand out premium.
    return send(res, 500, { valid: false, error: 'Validation unavailable' });
  }
}

module.exports = cors(handler);
