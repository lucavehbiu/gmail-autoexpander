# Lessons

Patterns that cost real time or real money on this project. Read before
touching deploys or licensing.

## 1. An absence is never evidence of success

Three times on this project, in three different disguises:

| What I checked | What I concluded | What was actually true |
|---|---|---|
| `STRIPE_WEBHOOK_SECRET` present in `vercel env ls` | The webhook is configured | No destination existed on the Stripe account at all |
| A deleted route returns Vercel's `NOT_FOUND` HTML | The file is gone, deploy succeeded | *Every* route returned that. The whole backend was missing for 8 days |
| `vercel --prod` printed "Deployment ready" | Production is serving my code | It shipped the repo root as a static site with zero functions |

**Rule:** verify by asserting that something which *must exist* still answers,
never that something you removed is missing. Those two look identical from the
outside, and only one of them tells you anything.

Concretely, after any deploy run `npm run deploy:backend`, which calls
`backend/scripts/verify-deploy.js`. It fails loudly if a route is missing. Do
not hand-roll a curl and eyeball it.

## 2. Deploy from `backend/`, never the repo root

Vercel's Root Directory for this project is `.`, so a `vercel --prod` from the
repo root ships the extension source as a static site and aliases it to
production. The root `.vercel/` link and the stale root `public/` that made
this silent are both deleted. Use `npm run deploy:backend`.

## 3. Only the database may revoke a license

`revalidateStoredLicense` downgrades on `invalid`, so `invalid` must mean
exactly one thing: a 200 from our own handler carrying `valid: false`. Any
other outcome — 404, 405, 429, 5xx, an HTML error page, an unparseable body,
no network — is `unreachable` and changes nothing.

The original rule was `status >= 500 ? unreachable : invalid`, which meant a
routing 404 read as "this key is fake". Infrastructure failure must never be
able to take away something a customer paid for. When adding any new call that
can revoke or downgrade, ask: what does this do when the server is simply not
there?

## 4. Verify heredocs landed

A `cd x && cat > file <<EOF` where the `cd` fails writes nothing, and a later
syntax check happily passes against the *old* file. Use absolute paths, and
check the mtime after writing.

## 5. Customer data stays out of git

`tasks/license-send-list.csv` pairs customer emails with live license keys. It
is gitignored and must stay that way.
