# Gmail Unlimited — licensing cutover

Source: `~/Downloads/HANDOFF.md`. Corrections found during orientation are noted inline.

## Findings that change the handoff

- **Vercel Root Directory is `.`, not `backend/`.** That is why every `/api/*`
  returned 404 on `gmail-autoexpander.vercel.app` — the repo root has no `api/`.
  This is the prerequisite for handoff items 1, 2 and 5. The project is not
  Git-connected, so deploying from `backend/` via the CLI is the durable fix.
- **All API handlers already send `Access-Control-Allow-Origin: *`**
  (`micro-cors`). The MV3 service worker can therefore call them without a new
  `host_permissions` entry — which matters, because adding one soft-disables
  every installed copy until the user re-approves the permission. Handoff
  item 4 is a deliberate no.
- **The live purchase path runs entirely on 283-day-old immutable
  deployments.** Installed extensions open
  `frontend-oo42hxwa0-….vercel.app/upgrade.html`, which posts to
  `gmail-autoexpander-jinxgepkr-….vercel.app/api/{create-checkout,verify-payment}`
  — still the pre-fix code that mints a key and never stores it (that host
  answers, so the path is live today). Deployment URLs are immutable, so it
  cannot be repaired, only superseded by shipping a new extension build.
- **Consequence the handoff missed: the backfill alone does not save existing
  customers.** The old `verify-payment` stored nothing, so the key sitting in
  a customer's browser exists in no database and cannot be reconstructed. The
  backfill mints a *new* key per session. After the update, every pre-existing
  premium user therefore holds a key that fails validation, and a plain
  "invalid ⇒ downgrade" rule would strip premium from all of them. Backfill
  plus a recovery path fixes it; neither alone does.

## Tasks

- [x] 1. Consolidate the hosted pages under `backend/public/`; every URL is now
      same-origin (`/api/…`), with no hardcoded host and no Stripe.js
- [x] 2. Link `backend/` to the Vercel project so it deploys as the source root
- [x] 3. Deployed and verified: `validate-license` returns
      `200 {"valid":true,"issuedAt":"2026-08-24T14:05:26.158Z"}`
- [x] 4. Webhook destination `gmail-autoexpander`
      (`we_1U8gi4HxoVVhhFnvohcyd5qM`) created and verified end to end.

      It had never existed. `STRIPE_WEBHOOK_SECRET` was set in Vercel, but the
      only destinations on the account were `odashop.al/api/webhook` and
      `lucavehbiu.com/api/stripe/webhook`, belonging to other projects — so the
      variable held a secret that could never match. A set env var is not
      evidence of an endpoint; that was checked wrongly and reported done in
      error the first time round.

      Proof, from a real EUR 2.99 purchase on 2026-08-26 15:27 CEST:
      delivery `200 OK` with body `{"received":true}` and **no**
      `"duplicate":true`, so the handler verified the signature and ran
      `issueLicenseForSession` rather than merely acking. `recover-license` for
      the buying address then returned exactly two keys (the new purchase plus
      the backfilled one), not three — `verify-payment` and the webhook raced
      on one session and the `ON CONFLICT (stripe_session_id)` path held.
- [x] 5. Backfill run — see results below. `backend/lib/backfill.js` (shared,
      idempotent) and `backend/scripts/backfill-licenses.js` (local, dry-run
      by default) remain. The temporary `ADMIN_SECRET`-guarded
      `api/admin-backfill.js` has been deleted
- [x] 6. Extension URLs: `API_BASE`, `OPEN_UPGRADE`, `public/success.js`,
      `public/upgrade.js`; `externally_connectable` narrowed from
      `https://*.vercel.app/*` to the single production host
- [x] 7. Grace path: `licenseVerified` / `licenseNeedsAttention` in settings.
      Only a key that has validated at least once may be revoked. A key that
      never validated is flagged for recovery and keeps premium. Revalidation
      also runs on `onInstalled(update)`, not just `onStartup`
- [x] 8. Popup and hosted pages redesigned; self-service recovery by purchase
      email wired to `RECOVER_LICENSE` → `/api/recover-license`
- [x] 9. `tsc --noEmit` clean, `vite build` clean, all backend files
      `node --check` clean, four popup states and both hosted pages verified
      in a browser

Also fixed along the way:

- `storage.resetSettings()` wiped `isPremium` and `licenseKey`. "Reset
  settings" now keeps the license — it means preferences and counters.
- `storage.activatePremium()` was a second, unvalidated door into premium.
  Removed; it had no callers.
- Success page claimed `window.close()` would work on a Stripe-redirected tab.
  It does not; the button now navigates to Gmail.
- Popup error messages self-cleared after 3s, mid-read. They now persist until
  the next attempt.
- `onInstalled('install')` wrote `DEFAULT_SETTINGS` wholesale. Because
  `chrome.storage.sync` is profile-wide, installing on a second machine would
  have overwritten `isPremium`/`licenseKey` with defaults and synced that
  erasure everywhere. Install now seeds only missing keys.

## Backfill result, 2026-08-26

    scanned 72, paid 19, issued 19, skipped 0, failed 0

19 paid checkout sessions across **15 distinct customers**. The duplicates are
the broken activation flow showing up in the ledger:

| Email | Sessions |
|---|---|
| amardakokomani@gmail.com | 4 |
| keela79@hotmail.co.uk (two casings, one person) | 2 |
| 13 others | 1 each |

Someone who paid, got a key that did nothing, and concluded the payment had
failed would pay again. Five of the nineteen charges are almost certainly
that. They are refund candidates, and a refund now revokes the matching key
by itself through `charge.refunded`.

Two rows need a human:

- `lucavehbiu96@gmail.com` is the owner's own test purchase, not a customer.
- `raisulfpc@gmail.coom` has a typo'd domain. Recovery matches on the Stripe
  email, so that person has to type the typo to find their key. Issue them one
  manually against their real address instead.

Note what the backfill does and does not do. All 15 customers now have a key
in `licenses`, but it is a **new** key: the one in their browser was never
recorded anywhere and cannot be reconstructed. When the update ships they will
all hit `licenseNeedsAttention`, keep premium, and be asked to look their key
up by purchase email. That is the designed path, and it now has data behind it.

## Remaining — needs you

1. ~~Remove the temporary backfill endpoint and its secret.~~ Done. The route
   now returns Vercel's own `NOT_FOUND` rather than the handler's
   `{"error":"Not found"}`, which is what distinguishes "file is gone" from
   "handler rejected the secret". `ADMIN_SECRET` removed from Production.

2. ~~Create the webhook destination.~~ Done and verified — see task 4 above.

   Note for next time: Stripe removed "Send test event" from live-mode
   destinations in the new Workbench; it is sandbox-only. The substitutes are
   resending a real event from the Events tab (events older than ~30 days come
   back as "Limited data" stubs, which exercise the signature but never reach
   the database) or making a real purchase.

   The remaining untested branch is `charge.refunded`. Refund the EUR 2.99 test
   purchase and confirm `GM-5F2A-BADE-8A0F-0B4E-D302-010C` goes
   `valid:false` while `GM-594D-54B0-836B-7A4C-1580-E52A` on the same email
   stays valid. That proves revocation is scoped to the payment intent, which
   has to hold before refunding the duplicate charges in step 3 — those
   customers have other active keys on the same address.

3. Decide on refunds for the five duplicate charges, and issue `raisulfpc@…` a
   key at their real address with `scripts/issue-license.js`.

   Order matters, and only after step 2: with no webhook, a refund currently
   revokes nothing. Once the destination exists, refunding kills the key tied
   to that session — so refund first, re-run `validate-license` on the key you
   intend to send, and only then email it.

4. ~~Ship `dist/` to the Chrome Web Store.~~ Submitted 2026-08-26 as
   `gmail-unlimited-v1.1.0.zip`, after loading `dist/` unpacked and confirming
   the grace path: a stored key that no longer exists left premium on and
   raised the "Confirm your license" band rather than downgrading.

   Version went 1.0.0 → 1.1.0. The popup header had `1.0.0` hardcoded and now
   reads `chrome.runtime.getManifest().version`.

## While the update is in review

Anyone still on the 1.0.0 build buys through the old hosted page, which posts
to the 283-day-old deployment. That path still shows them a key the old
`verify-payment` invented and stored nowhere. The difference now is that the
webhook is live and account-wide, so the same purchase *also* writes a real
key against their email.

So a buyer in this window ends up holding key X while the database holds key Y.
That resolves itself: their 1.0.0 build accepts any string, so premium works
immediately; when they update, X fails validation, has never been verified, and
therefore triggers the grace path rather than a downgrade; recovery by purchase
email hands them Y. No action needed, but it explains any support mail that
arrives in the next few days.

## Still open, deliberately

- `recover-license` returns the key in the HTTP response. Anyone who knows a
  customer's email can retrieve their key. Emailing it instead is the real fix
  and needs an email provider wired up.
- No device binding; one key activates anywhere.
- The Neon `neondb_owner` credential was pasted into a chat and should be
  rotated. `backend/LICENSING.md` has the least-privilege role to use instead.
- No `PRODUCT.md` / `DESIGN.md` in the repo, so the design pass inferred the
  direction. `/design teach` would pin it down for next time.
