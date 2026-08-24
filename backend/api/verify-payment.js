const { send, json } = require('micro');
const cors = require('micro-cors')({
  allowMethods: ['POST', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
  origin: '*',
});
const { stripe, issueLicenseForSession } = require('../lib/license');

/**
 * Called by the post-checkout success page to fetch the buyer's key.
 *
 * The webhook is the authoritative issuer; this endpoint exists so the page
 * does not have to wait on webhook latency. Both go through
 * issueLicenseForSession, which is idempotent on the session id, so whichever
 * arrives first wins and the other returns the same key.
 *
 * Payment is still confirmed against Stripe on every call — the session id in
 * the request is attacker-controlled and only a paid session may mint a key.
 */
async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return send(res, 200, 'ok');
  }

  if (req.method !== 'POST') {
    return send(res, 405, { error: 'Method not allowed' });
  }

  try {
    const { sessionId } = await json(req);

    if (typeof sessionId !== 'string' || sessionId.trim() === '') {
      return send(res, 400, { error: 'Missing sessionId' });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId.trim());

    if (session.payment_status !== 'paid') {
      return send(res, 400, { error: 'Payment not completed' });
    }

    const licenseKey = await issueLicenseForSession(session);
    return send(res, 200, { licenseKey });
  } catch (error) {
    console.error('[verify-payment] Failed:', error);
    return send(res, 500, { error: 'Could not retrieve license' });
  }
}

module.exports = cors(handler);
