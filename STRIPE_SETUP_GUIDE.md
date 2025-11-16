# Stripe Payment Setup Guide

## 🎯 What's Implemented

Gmail Unlimited now has Stripe Checkout integration:
- ✅ Upgrade page (`upgrade.html`) - Beautiful checkout UI
- ✅ Success page (`success.html`) - After payment confirmation
- ✅ Premium activation - Auto-unlocks unlimited expansions
- ✅ License key system - Validates and stores premium status
- ✅ Popup integration - Shows premium badge when active

## 🚀 Quick Start (3 Steps)

### Step 1: Create Stripe Account
1. Go to [stripe.com](https://stripe.com) and sign up
2. Complete business verification
3. Get your API keys from Dashboard

### Step 2: Set Up Simple Backend
You need a simple backend to:
- Create Stripe Checkout sessions
- Verify payments
- Generate license keys

**Easiest Option**: Use Vercel Serverless Functions (FREE)

### Step 3: Update Extension Code
Replace placeholders with your actual values

---

## 📋 Detailed Setup

### A) Get Stripe API Keys

1. Log into [Stripe Dashboard](https://dashboard.stripe.com)
2. Click "Developers" → "API keys"
3. You'll see:
   - **Publishable key**: `pk_test_...` (for frontend)
   - **Secret key**: `sk_test_...` (for backend ONLY)

4. Create a Product:
   - Dashboard → Products → "Add Product"
   - Name: "Gmail Unlimited Premium"
   - Price: $2.99 one-time
   - Copy the Price ID: `price_...`

### B) Create Vercel Backend (Easiest!)

Create a new folder `backend/` in your project:

```bash
mkdir backend
cd backend
npm init -y
npm install stripe micro micro-cors
```

Create `backend/api/create-checkout.js`:

```javascript
const Stripe = require('stripe');
const micro = require('micro');
const cors = require('micro-cors')();

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

async function handler(req, res) {
  if (req.method !== 'POST') {
    return micro.send(res, 405, { error: 'Method not allowed' });
  }

  try {
    const body = await micro.json(req);
    const { extensionId, returnUrl } = body;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID, // Your price ID
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: returnUrl + '?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: `chrome-extension://${extensionId}/upgrade.html`,
      metadata: {
        extensionId: extensionId,
      },
    });

    return { sessionId: session.id };
  } catch (error) {
    console.error('Stripe error:', error);
    return micro.send(res, 500, { error: error.message });
  }
}

module.exports = cors(handler);
```

Create `backend/api/verify-payment.js`:

```javascript
const Stripe = require('stripe');
const micro = require('micro');
const cors = require('micro-cors')();
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
  if (req.method !== 'POST') {
    return micro.send(res, 405, { error: 'Method not allowed' });
  }

  try {
    const body = await micro.json(req);
    const { sessionId } = body;

    // Verify the payment with Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === 'paid') {
      // Generate license key
      const licenseKey = generateLicenseKey();

      // TODO: Store license key in your database
      // For now, just return it

      return { licenseKey };
    } else {
      return micro.send(res, 400, { error: 'Payment not completed' });
    }
  } catch (error) {
    console.error('Verification error:', error);
    return micro.send(res, 500, { error: error.message });
  }
}

module.exports = cors(handler);
```

Create `backend/vercel.json`:

```json
{
  "version": 2,
  "env": {
    "STRIPE_SECRET_KEY": "@stripe-secret-key",
    "STRIPE_PRICE_ID": "@stripe-price-id"
  },
  "builds": [
    {
      "src": "api/*.js",
      "use": "@vercel/node"
    }
  ]
}
```

Deploy to Vercel:

```bash
npm i -g vercel
vercel login
vercel env add STRIPE_SECRET_KEY
vercel env add STRIPE_PRICE_ID
vercel deploy --prod
```

You'll get a URL like: `https://your-backend.vercel.app`

### C) Update Extension Code

**1. Update `public/upgrade.html`** (line 98):

```javascript
const STRIPE_PUBLISHABLE_KEY = 'pk_test_YOUR_ACTUAL_KEY';
```

**2. Update `public/upgrade.html`** (line 122):

```javascript
const response = await fetch('https://your-backend.vercel.app/api/create-checkout', {
```

**3. Update `public/success.html`** (line 84):

```javascript
const response = await fetch('https://your-backend.vercel.app/api/verify-payment', {
```

### D) Rebuild Extension

```bash
npm run build
cp public/*.html dist/
```

---

## 🧪 Testing

### Test Mode (FREE - No Real Money)

1. Use Stripe test keys (`pk_test_...` and `sk_test_...`)
2. Test card: `4242 4242 4242 4242`
3. Expiry: Any future date
4. CVC: Any 3 digits
5. ZIP: Any 5 digits

### Test Flow:

1. Load extension unpacked
2. Use 5 free expansions
3. Click "Upgrade to Unlimited - $2.99"
4. Fill in test card info
5. Complete payment
6. You'll be redirected to success page
7. License key auto-activates
8. Refresh popup - see "Premium Active" badge!
9. Now unlimited expansions!

---

## 💰 Go Live (Real Money)

### Switch to Live Mode:

1. Stripe Dashboard → Toggle "View test data" to OFF
2. Get live keys: `pk_live_...` and `sk_live_...`
3. Create live product and price
4. Update all keys in code
5. Redeploy backend: `vercel deploy --prod`
6. Rebuild extension
7. Upload to Chrome Web Store!

### Stripe Fees:
- 2.9% + $0.30 per transaction
- $2.99 sale = $2.60 to you ($0.39 to Stripe)

### Payouts:
- Automatic every 2 days to your bank
- Or configure custom payout schedule

---

## 🔐 Security Notes

### ❌ NEVER Do This:
- Put secret key (`sk_...`) in extension code
- Commit API keys to Git
- Skip payment verification

### ✅ Always Do This:
- Keep secret key on backend only
- Verify payments server-side
- Use environment variables
- Enable Stripe webhooks for production

---

## 📊 Stripe Dashboard

Track everything in real-time:
- **Payments**: See all transactions
- **Customers**: Who bought what
- **Revenue**: Daily/weekly/monthly charts
- **Refunds**: Process refunds easily

---

## 🎁 Alternative: Even Simpler Setup

### Use Stripe Payment Links (No Backend Needed!)

1. Stripe Dashboard → Payment Links → Create
2. Set product & price ($2.99)
3. Copy payment link URL
4. User clicks upgrade → Redirects to Stripe hosted page
5. After payment → Redirect back to extension
6. Use webhook to verify payment

**Downsides**:
- Less control over UI
- Still need webhook endpoint

---

## 🐛 Troubleshooting

### "Stripe is not defined"
- Add Stripe publishable key to `upgrade.html`

### "Failed to create checkout session"
- Check backend is deployed
- Check STRIPE_SECRET_KEY is set
- Check Stripe Price ID is correct

### "Payment succeeded but not activated"
- Check browser console for errors
- Verify success.html can reach backend
- Check license key format

### "CORS error"
- Make sure `micro-cors` is installed
- Backend needs CORS headers enabled

---

## 📝 Environment Variables Checklist

**Backend (Vercel)**:
- ✅ STRIPE_SECRET_KEY=sk_test_...
- ✅ STRIPE_PRICE_ID=price_...

**Extension**:
- ✅ upgrade.html: STRIPE_PUBLISHABLE_KEY
- ✅ upgrade.html: Backend URL for create-checkout
- ✅ success.html: Backend URL for verify-payment

---

## 🚀 You're Ready!

Once you've:
1. ✅ Created Stripe account
2. ✅ Deployed backend to Vercel
3. ✅ Updated extension with API keys
4. ✅ Tested with test card
5. ✅ Switched to live keys

You can publish and start making money! 💸

**Your cut**: $2.60 per $2.99 sale
**Target**: 1,000 sales = $2,600
**Effort**: Backend deploys in 5 minutes!

Good luck! 🎉
