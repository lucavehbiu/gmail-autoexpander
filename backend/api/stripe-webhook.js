const { buffer, send } = require('micro');
const { getSql } = require('../lib/db');
const {
  stripe,
  issueLicenseForSession,
  revokeLicenseForPaymentIntent,
} = require('../lib/license');

async function alreadyProcessed(eventId) {
  const sql = getSql();
  const rows = await sql`SELECT id FROM stripe_events WHERE id = ${eventId}`;
  return rows.length > 0;
}

async function markProcessed(event) {
  const sql = getSql();
  await sql`
    INSERT INTO stripe_events (id, type)
    VALUES (${event.id}, ${event.type})
    ON CONFLICT (id) DO NOTHING
  `;
}

async function applyEvent(event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      if (session.payment_status !== 'paid') {
        console.log(`[webhook] Session ${session.id} not paid, ignoring`);
        return;
      }
      const key = await issueLicenseForSession(session);
      console.log(`[webhook] License for session ${session.id}: ${key}`);
      return;
    }

    case 'charge.refunded': {
      const charge = event.data.object;
      const revoked = await revokeLicenseForPaymentIntent(charge.payment_intent);
      console.log(
        `[webhook] Refund on ${charge.payment_intent} revoked ${revoked} license(s)`
      );
      return;
    }

    default:
      console.log(`[webhook] Unhandled event type ${event.type}`);
  }
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    return send(res, 405, { error: 'Method not allowed' });
  }

  const signature = req.headers['stripe-signature'];
  if (!signature) {
    return send(res, 400, { error: 'Missing stripe-signature header' });
  }

  let event;
  try {
    const rawBody = await buffer(req);
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    // Bad signature: this did not come from Stripe. Do not touch the database.
    console.error('[webhook] Signature verification failed:', error.message);
    return send(res, 400, { error: 'Webhook signature verification failed' });
  }

  try {
    if (await alreadyProcessed(event.id)) {
      console.log(`[webhook] Skipping already-processed event ${event.id}`);
      return send(res, 200, { received: true, duplicate: true });
    }

    // Apply first, record second. If this throws, the event is NOT recorded
    // and Stripe's retry will run it again. Re-running is safe because
    // issueLicenseForSession is idempotent on stripe_session_id, so a
    // concurrent duplicate delivery cannot mint a second key either.
    await applyEvent(event);
    await markProcessed(event);

    return send(res, 200, { received: true });
  } catch (error) {
    // 500 asks Stripe to retry with the same event id.
    console.error('[webhook] Handler failed:', error);
    return send(res, 500, { error: 'Webhook handler failed' });
  }
}

module.exports = handler;

// Signature verification needs the exact bytes Stripe signed, so Vercel must
// not parse the body first. Assigned after the export so it survives.
module.exports.config = {
  api: {
    bodyParser: false,
  },
};
