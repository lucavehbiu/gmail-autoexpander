const { send, json } = require('micro');
const cors = require('micro-cors')({
  allowMethods: ['POST', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
  origin: '*',
});
const { getSql } = require('../lib/db');

const MAX_ATTEMPTS_PER_HOUR = 5;

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

/**
 * Returns true if this IP is over the hourly limit. Recorded before the
 * lookup so a burst of guesses is throttled whether or not they hit.
 */
async function isRateLimited(ip) {
  const sql = getSql();
  await sql`INSERT INTO recovery_attempts (ip) VALUES (${ip})`;
  const rows = await sql`
    SELECT count(*)::int AS n
      FROM recovery_attempts
     WHERE ip = ${ip}
       AND attempted_at > now() - interval '1 hour'
  `;
  return rows[0].n > MAX_ATTEMPTS_PER_HOUR;
}

/**
 * Self-service recovery for a customer who lost their key.
 *
 * Matches on the email the payment was made with. An optional receipt number
 * narrows the result when one email has several purchases.
 */
async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return send(res, 200, 'ok');
  }

  if (req.method !== 'POST') {
    return send(res, 405, { error: 'Method not allowed' });
  }

  try {
    const { email, receiptNumber } = await json(req);

    if (typeof email !== 'string' || !email.includes('@')) {
      return send(res, 400, { error: 'A valid email is required' });
    }

    if (await isRateLimited(clientIp(req))) {
      return send(res, 429, { error: 'Too many attempts. Try again later.' });
    }

    const sql = getSql();
    const normalised = email.trim().toLowerCase();

    const rows = receiptNumber
      ? await sql`
          SELECT key FROM licenses
           WHERE lower(customer_email) = ${normalised}
             AND receipt_number = ${String(receiptNumber).trim()}
             AND status = 'active'
           ORDER BY created_at DESC
        `
      : await sql`
          SELECT key FROM licenses
           WHERE lower(customer_email) = ${normalised}
             AND status = 'active'
           ORDER BY created_at DESC
        `;

    if (rows.length === 0) {
      // Deliberately vague: do not confirm whether the address ever purchased.
      return send(res, 404, {
        error: 'No active license found for that email.',
      });
    }

    console.log(`[recover-license] Returned ${rows.length} key(s) for ${normalised}`);
    return send(res, 200, { licenseKeys: rows.map((r) => r.key) });
  } catch (error) {
    console.error('[recover-license] Failed:', error);
    return send(res, 500, { error: 'Recovery unavailable' });
  }
}

module.exports = cors(handler);
