const crypto = require('crypto');
const Stripe = require('stripe');
const { getSql } = require('./db');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Generate format: GM-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX
 *
 * 96 bits of randomness. The key is looked up in the database rather than
 * verified by shape, so the format carries no meaning beyond being readable
 * over email.
 */
function generateLicenseKey() {
  const segments = [];
  for (let i = 0; i < 6; i++) {
    segments.push(crypto.randomBytes(2).toString('hex').toUpperCase());
  }
  return 'GM-' + segments.join('-');
}

function paymentIntentId(session) {
  return typeof session.payment_intent === 'string'
    ? session.payment_intent
    : session.payment_intent?.id || null;
}

/**
 * Stripe's human-facing receipt number (the "1105-0902" on the emailed
 * receipt) lives on the charge, not the checkout session, and only exists
 * once a receipt has been sent. Null is a normal outcome.
 */
async function resolveReceiptNumber(session) {
  const piId = paymentIntentId(session);
  if (!piId) return null;

  try {
    const intent = await stripe.paymentIntents.retrieve(piId, {
      expand: ['latest_charge'],
    });
    return intent.latest_charge?.receipt_number || null;
  } catch (error) {
    console.error('[license] Could not resolve receipt number:', error.message);
    return null;
  }
}

/**
 * Issue (or return the existing) license for a paid Stripe checkout session.
 *
 * Idempotent on stripe_session_id, which is what lets the webhook and the
 * success-page fallback both call this for the same payment without minting
 * two keys for one purchase.
 */
async function issueLicenseForSession(session) {
  const sql = getSql();

  const existing = await sql`
    SELECT key FROM licenses WHERE stripe_session_id = ${session.id}
  `;
  if (existing.length > 0) {
    return existing[0].key;
  }

  const email = session.customer_details?.email || session.customer_email;
  if (!email) {
    throw new Error(`Checkout session ${session.id} has no customer email`);
  }

  const receiptNumber = await resolveReceiptNumber(session);

  const inserted = await sql`
    INSERT INTO licenses
      (key, stripe_session_id, stripe_payment_intent, customer_email, receipt_number, source)
    VALUES
      (${generateLicenseKey()}, ${session.id}, ${paymentIntentId(session)},
       ${email}, ${receiptNumber}, 'stripe')
    ON CONFLICT (stripe_session_id) DO NOTHING
    RETURNING key
  `;

  if (inserted.length > 0) {
    return inserted[0].key;
  }

  // Lost a race with a concurrent webhook delivery; that row is the winner.
  const winner = await sql`
    SELECT key FROM licenses WHERE stripe_session_id = ${session.id}
  `;
  return winner[0].key;
}

/**
 * Mark a license refunded so validation stops honouring it.
 */
async function revokeLicenseForPaymentIntent(paymentIntentIdValue) {
  const sql = getSql();
  const rows = await sql`
    UPDATE licenses
       SET status = 'refunded'
     WHERE stripe_payment_intent = ${paymentIntentIdValue}
       AND status = 'active'
    RETURNING key
  `;
  return rows.length;
}

module.exports = {
  stripe,
  generateLicenseKey,
  issueLicenseForSession,
  revokeLicenseForPaymentIntent,
};
