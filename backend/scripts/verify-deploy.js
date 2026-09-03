#!/usr/bin/env node
/**
 * Post-deploy smoke test.
 *
 * Exists because of the 2026-08-26 outage: a `vercel --prod` run from the repo
 * root instead of backend/ shipped the root directory as a static site. It
 * reported success, the hosted pages still answered 200, and every /api/*
 * route silently became Vercel's HTML 404 for eight days. Nothing in the
 * deploy output said so.
 *
 * The lesson is narrow and worth encoding: after a deploy, assert that
 * something which must exist still answers. Confirming that a route you
 * deleted is gone proves nothing — that same 404 is what a broken deploy
 * looks like on every other route too.
 *
 * Run: npm run deploy:backend  (or `node scripts/verify-deploy.js`)
 */

const BASE = process.env.VERIFY_BASE || 'https://gmail-autoexpander.vercel.app';

const ROUTES = [
  'create-checkout',
  'recover-license',
  'stripe-webhook',
  'validate-license',
  'verify-payment',
];

const failures = [];

function check(name, ok, detail) {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? `  ${detail}` : ''}`);
  if (!ok) failures.push(name);
}

async function main() {
  console.log(`Verifying ${BASE}\n`);

  // Every handler answers OPTIONS itself — 200 from micro-cors, or 405 from
  // stripe-webhook, which has no CORS wrapper. Vercel's own NOT_FOUND is the
  // signature of a function that was never deployed.
  for (const route of ROUTES) {
    let res;
    try {
      res = await fetch(`${BASE}/api/${route}`, { method: 'OPTIONS' });
    } catch (error) {
      check(`api/${route}`, false, error.message);
      continue;
    }

    const routingError = res.headers.get('x-vercel-error');
    check(
      `api/${route}`,
      !routingError && res.status !== 404,
      routingError ? `${res.status} ${routingError}` : String(res.status)
    );
  }

  // A real round trip through the database. An unknown key must come back as
  // a 200 carrying valid:false — that is the only answer the extension is
  // allowed to treat as "not a real key", so it has to keep working.
  try {
    const res = await fetch(`${BASE}/api/validate-license`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey: 'GM-0000-0000-0000-0000-0000-0000' }),
    });
    const body = await res.json().catch(() => null);
    check(
      'validate-license answers in JSON',
      res.status === 200 && body && body.valid === false,
      `${res.status} ${JSON.stringify(body)}`
    );
  } catch (error) {
    check('validate-license answers in JSON', false, error.message);
  }

  // The hosted pages, and specifically that they are the backend/public copies
  // rather than an older set — page.css only exists in the current ones.
  for (const page of ['upgrade.html', 'success.html']) {
    try {
      const res = await fetch(`${BASE}/${page}`);
      const html = await res.text();
      check(
        page,
        res.status === 200 && html.includes('page.css'),
        res.status === 200 ? (html.includes('page.css') ? '' : 'stale copy, no page.css') : String(res.status)
      );
    } catch (error) {
      check(page, false, error.message);
    }
  }

  console.log();
  if (failures.length > 0) {
    console.error(`${failures.length} check(s) failed. This deploy is not serving the backend.`);
    process.exit(1);
  }
  console.log('All checks passed.');
}

main();
