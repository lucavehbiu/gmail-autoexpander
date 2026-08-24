#!/usr/bin/env node
/**
 * Manually issue a license — for support cases where a customer paid but
 * never received a key (closed the tab before the success page loaded, bought
 * before licenses were stored at all, and so on).
 *
 * Usage:
 *   DATABASE_URL=... node scripts/issue-license.js <email> [receiptNumber] [note]
 *
 * Records source='manual' so these stay distinguishable from Stripe-issued
 * keys when you audit later.
 */

const { getSql } = require('../lib/db');
const { generateLicenseKey } = require('../lib/license');

async function main() {
  const [email, receiptNumber, note] = process.argv.slice(2);

  if (!email || !email.includes('@')) {
    console.error('Usage: node scripts/issue-license.js <email> [receiptNumber] [note]');
    process.exit(1);
  }

  const sql = getSql();

  const existing = await sql`
    SELECT key, created_at FROM licenses
     WHERE lower(customer_email) = ${email.trim().toLowerCase()}
       AND status = 'active'
  `;

  if (existing.length > 0) {
    console.log(`${email} already has ${existing.length} active license(s):`);
    for (const row of existing) {
      console.log(`  ${row.key}  (issued ${row.created_at.toISOString()})`);
    }
    console.log('\nRe-send one of the above instead of issuing a duplicate.');
    return;
  }

  const key = generateLicenseKey();
  await sql`
    INSERT INTO licenses (key, customer_email, receipt_number, source, note)
    VALUES (${key}, ${email.trim()}, ${receiptNumber || null}, 'manual', ${note || null})
  `;

  console.log(`Issued ${key} to ${email}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
