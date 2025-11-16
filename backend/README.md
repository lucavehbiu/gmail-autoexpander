# Gmail Unlimited Backend

Simple Stripe payment backend for Gmail Unlimited extension.

## Quick Deploy to Vercel (5 minutes)

### 1. Install Vercel CLI
```bash
npm install -g vercel
```

### 2. Install Dependencies
```bash
cd backend
npm install
```

### 3. Get Stripe Keys

Go to [Stripe Dashboard](https://dashboard.stripe.com):

1. **Get Secret Key**:
   - Developers → API Keys
   - Copy "Secret key" (starts with `sk_test_...`)

2. **Create Product**:
   - Products → Add Product
   - Name: "Gmail Unlimited Premium"
   - Price: $2.99 (one-time)
   - Copy Price ID (starts with `price_...`)

### 4. Deploy to Vercel
```bash
vercel login
vercel
```

Follow prompts:
- Link to existing project? **N**
- Project name? **gmail-unlimited-backend**
- Directory? **./backend** (or just press enter)

### 5. Add Stripe Secrets
```bash
vercel env add STRIPE_SECRET_KEY
```
Paste your `sk_test_...` key

```bash
vercel env add STRIPE_PRICE_ID
```
Paste your `price_...` ID

### 6. Deploy to Production
```bash
vercel --prod
```

You'll get a URL like: `https://gmail-unlimited-backend.vercel.app`

### 7. Update Extension

Update these files with your Vercel URL:

**public/upgrade.html** (line 122):
```javascript
const response = await fetch('https://YOUR-VERCEL-URL.vercel.app/api/create-checkout', {
```

**public/success.html** (line 84):
```javascript
const response = await fetch('https://YOUR-VERCEL-URL.vercel.app/api/verify-payment', {
```

Also update **public/upgrade.html** (line 98) with your Stripe publishable key:
```javascript
const STRIPE_PUBLISHABLE_KEY = 'pk_test_YOUR_KEY';
```

### 8. Rebuild Extension
```bash
cd ..
npm run build
cp public/*.html dist/
```

## Done! 🎉

Your backend is live and ready to accept payments!

## Testing

Use Stripe test card:
- Card: `4242 4242 4242 4242`
- Expiry: Any future date
- CVC: Any 3 digits

## Go Live

1. Stripe Dashboard → Toggle off "Test mode"
2. Get live keys (`sk_live_...` and `pk_live_...`)
3. Update Vercel secrets:
   ```bash
   vercel env add STRIPE_SECRET_KEY production
   vercel env add STRIPE_PRICE_ID production
   ```
4. Redeploy: `vercel --prod`
5. Update extension with live keys
6. Rebuild and publish!
