#!/usr/bin/env node
/**
 * Backfill licenses for every pre-existing paid checkout session.
 *
 *   export DATABASE_URL='postgresql://…'
 *   export STRIPE_SECRET_KEY='sk_live_…'
 *   node scripts/backfill-licenses.js            # report only, writes nothing
 *   node scripts/backfill-licenses.js --apply    # actually issue
 *
 * Safe to re-run: issuance is idempotent on the Stripe session id.
 */
const { backfillLicenses } = require('../lib/backfill');
const { stripe } = require('../lib/license');

async function dryRun() {
  const report = { scanned: 0, paid: 0, missing: 0 };
  const { getSql } = require('../lib/db');
  const sql = getSql();

  for await (const session of stripe.checkout.sessions.list({ limit: 100 })) {
    report.scanned += 1;
    if (session.payment_status !== 'paid') continue;
    report.paid += 1;

    const rows = await sql`
      SELECT 1 FROM licenses WHERE stripe_session_id = ${session.id}
    `;
    if (rows.length === 0) {
      report.missing += 1;
      console.log(
        `  would issue -> ${session.customer_details?.email || session.customer_email || '(no email)'} (${session.id})`
      );
    }
  }

  return report;
}

async function main() {
  for (const name of ['DATABASE_URL', 'STRIPE_SECRET_KEY']) {
    if (!process.env[name]) {
      console.error(`${name} is not set.`);
      process.exit(1);
    }
  }

  const apply = process.argv.includes('--apply');

  if (!apply) {
    console.log('Dry run — pass --apply to write.\n');
    const report = await dryRun();
    console.log(
      `\nscanned ${report.scanned}, paid ${report.paid}, missing a license ${report.missing}`
    );
    return;
  }

  const report = await backfillLicenses({
    onProgress: ({ email, key }) => console.log(`  issued ${key} -> ${email}`),
  });

  console.log(
    `\nscanned ${report.scanned}, paid ${report.paid}, issued ${report.issued}, already had one ${report.skipped}`
  );

  if (report.failed.length > 0) {
    console.log(`\n${report.failed.length} could not be issued:`);
    for (const f of report.failed) {
      console.log(`  ${f.session}: ${f.reason}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
