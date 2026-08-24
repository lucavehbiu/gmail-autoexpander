#!/usr/bin/env bash
#
# One-shot setup: create the license schema, then optionally issue a key.
#
#   chmod +x setup.sh
#   export DATABASE_URL='postgresql://...'
#   ./setup.sh                              # schema only
#   ./setup.sh greg@example.com 1105-0902   # schema + issue a key
#
# Safe to re-run: the schema is CREATE ... IF NOT EXISTS, and issuing refuses
# to create a second key for an address that already has an active one.

set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set." >&2
  echo "  export DATABASE_URL='postgresql://user:pass@host/db?sslmode=require'" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EMAIL="${1:-}"
RECEIPT="${2:-}"

echo "==> Connecting"
psql "$DATABASE_URL" -tAc \
  "select 'connected to ' || current_database() || ' as ' || current_user;"

echo "==> Applying schema"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SCRIPT_DIR/db/schema.sql"

echo "==> Tables"
psql "$DATABASE_URL" -c "\dt licenses stripe_events recovery_attempts"

if [[ -z "$EMAIL" ]]; then
  echo
  echo "Schema ready. To issue a key:  ./setup.sh <email> [receiptNumber]"
  exit 0
fi

echo "==> Issuing license for $EMAIL"

# Values reach SQL through psql -v and :'name' quoting, never through shell
# interpolation, so an address containing a quote cannot break out.
#
# The key is built from gen_random_uuid(), which is core Postgres 13+ and needs
# no extension. 96 bits of the UUID's randomness, formatted to match
# lib/license.js: GM- followed by six uppercase hex quads.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v email="$EMAIL" -v receipt="${RECEIPT:-}" <<'SQL'
-- psql -v variables are client-side and invisible to PL/pgSQL, so promote them
-- to session settings the DO block can read via current_setting().
SELECT set_config('license.email',   :'email',   false);
SELECT set_config('license.receipt', :'receipt', false);

DO $$
DECLARE
  target_email   TEXT := current_setting('license.email');
  target_receipt TEXT := nullif(current_setting('license.receipt'), '');
  existing_key   TEXT;
  hex            TEXT;
  new_key        TEXT;
BEGIN
  SELECT key INTO existing_key
    FROM licenses
   WHERE lower(customer_email) = lower(target_email)
     AND status = 'active'
   ORDER BY created_at DESC
   LIMIT 1;

  IF existing_key IS NOT NULL THEN
    RAISE NOTICE 'Already has an active license: %', existing_key;
    RAISE NOTICE 'Re-send that one rather than issuing a duplicate.';
    RETURN;
  END IF;

  hex := replace(gen_random_uuid()::text, '-', '');
  new_key := 'GM-' || upper(
    substr(hex,  1, 4) || '-' || substr(hex,  5, 4) || '-' ||
    substr(hex,  9, 4) || '-' || substr(hex, 13, 4) || '-' ||
    substr(hex, 17, 4) || '-' || substr(hex, 21, 4)
  );

  INSERT INTO licenses (key, customer_email, receipt_number, source, note)
  VALUES (new_key, target_email, target_receipt, 'manual',
          'Support: lost key, issued manually');

  RAISE NOTICE 'Issued % to %', new_key, target_email;
END $$;
SQL

echo
echo "==> Active licenses for $EMAIL"
psql "$DATABASE_URL" -v email="$EMAIL" <<'SQL'
SELECT key, receipt_number, source, created_at
  FROM licenses
 WHERE lower(customer_email) = lower(:'email')
   AND status = 'active';
SQL
