const Stripe = require('stripe');
const { send, json } = require('micro');
const cors = require('micro-cors')({
  allowMethods: ['POST', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
  origin: '*'
});
const crypto = require('crypto');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

function generateLicenseKey() {
  // Generate format: GM-XXXX-XXXX-XXXX-XXXX-XXXX
  const segments = [];
  for (let i = 0; i < 6; i++) {
    segments.push(crypto.randomBytes(2).toString('hex').toUpperCase());
  }
  return 'GM-' + segments.join('-');
}

async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return send(res, 200, 'ok');
  }

  if (req.method !== 'POST') {
    return send(res, 405, { error: 'Method not allowed' });
  }

  try {
    const body = await json(req);
    const { sessionId } = body;

    // Verify the payment with Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === 'paid') {
      // Generate license key
      const licenseKey = generateLicenseKey();

      // TODO: Store license key in database for verification
      // For now, just return it

      return send(res, 200, { licenseKey });
    } else {
      return send(res, 400, { error: 'Payment not completed' });
    }
  } catch (error) {
    console.error('Verification error:', error);
    return send(res, 500, { error: error.message });
  }
}

module.exports = cors(handler);
