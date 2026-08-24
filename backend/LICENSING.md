# Gmail Unlimited — license persistence, validation, recovery

Closes the `TODO: Store license key in database for verification` that used to
sit in `api/verify-payment.js`, and makes `activatePremium` actually validate.

## Why this exists

Before this change:

- Keys were generated per request and never stored, so a lost key was
  unrecoverable and a refunded key could not be revoked.
- Keys were only minted when the post-checkout page loaded. A buyer who closed
  the tab was charged and got nothing.
- `activatePremium` set `isPremium: true` for any non-empty string, so the paid
  tier was unenforced.

## Setup

**1. Create the schema.** From this directory:

```bash
chmod +x setup.sh
export DATABASE_URL='postgresql://...'   # Neon pooled connection string
./setup.sh
```

**2. Install dependencies:**

```bash
npm install
```

**3. Environment variables** on the Vercel project (never in the repo):

| Variable | Source |
|---|---|
| `DATABASE_URL` | Neon → database → Connection string (pooled) |
| `STRIPE_SECRET_KEY` | already set |
| `STRIPE_PRICE_ID` | already set |
| `STRIPE_WEBHOOK_SECRET` | from step 4 |

Use a least-privilege Neon role rather than `neondb_owner`:

```sql
CREATE ROLE gmail_unlimited_app LOGIN PASSWORD '<generate one>';
GRANT SELECT, INSERT, UPDATE ON licenses, stripe_events, recovery_attempts
  TO gmail_unlimited_app;
GRANT USAGE, SELECT ON SEQUENCE recovery_attempts_id_seq TO gmail_unlimited_app;
```

**4. Register the webhook.** Stripe dashboard → Developers → Webhooks →
Add endpoint:

- URL: `https://<your-domain>/api/stripe-webhook`
- Events: `checkout.session.completed`, `charge.refunded`
- Copy the signing secret into `STRIPE_WEBHOOK_SECRET`, redeploy.

**5. Set a stable API domain.** `src/utils/license.ts` exports `API_BASE`,
currently a placeholder. Two other files hardcode *different* per-deployment
Vercel preview URLs, which rotate on every deploy and strand existing installs:

- `public/success.js:8`
- `src/background/index.ts` (the `OPEN_UPGRADE` handler)

Point all three at one production domain.

**6. Add the API host to `manifest.json`** so the service worker may call it:

```json
"host_permissions": [
  "https://mail.google.com/*",
  "https://<your-domain>/*"
]
```

## Issuing a key manually

For a customer who paid but never received one:

```bash
./setup.sh customer@example.com 1105-0902
```

Records `source='manual'` and refuses to issue a second key if that address
already has an active one. There is also a Node equivalent,
`scripts/issue-license.js`, if you prefer it.

## Endpoints

| Endpoint | Purpose |
|---|---|
| `POST /api/create-checkout` | unchanged |
| `POST /api/stripe-webhook` | authoritative issuance; revokes on refund |
| `POST /api/verify-payment` | success page fetch; idempotent per session |
| `POST /api/validate-license` | called by the extension before granting premium |
| `POST /api/recover-license` | self-service lookup by purchase email |

## Known gaps

- **Recovery returns the key in the HTTP response.** No email provider is
  wired up, so anyone who knows a customer's email can retrieve their key.
  Rate-limited to 5 attempts/hour/IP. The real fix is to mail the key instead.
- **No device binding.** One key activates anywhere. Fine at this price point.
- **Pre-existing customers have no rows.** Anyone who bought before this
  deploy will fail validation once the extension update ships. Backfill from
  `stripe.checkout.sessions.list` first, or stage the rollout: deploy the
  backend now, ship the extension change after the backfill.
