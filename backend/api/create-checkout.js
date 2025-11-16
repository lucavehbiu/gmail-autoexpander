const Stripe = require('stripe');
const { send, json } = require('micro');
const cors = require('micro-cors')({
  allowMethods: ['POST', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
  origin: '*'
});

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return send(res, 200, 'ok');
  }

  if (req.method !== 'POST') {
    return send(res, 405, { error: 'Method not allowed' });
  }

  try {
    const body = await json(req);
    const { extensionId, returnUrl } = body;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: returnUrl + '?session_id={CHECKOUT_SESSION_ID}&ext_id=' + extensionId,
      cancel_url: returnUrl.replace('success.html', 'upgrade.html') + '?ext_id=' + extensionId,
      metadata: {
        extensionId: extensionId,
      },
    });

    return send(res, 200, { sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Stripe error:', error);
    return send(res, 500, { error: error.message });
  }
}

module.exports = cors(handler);
