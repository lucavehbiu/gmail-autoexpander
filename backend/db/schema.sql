-- Gmail Unlimited — license storage
-- Target: Neon (Postgres 15+). Safe to re-run.

CREATE TABLE IF NOT EXISTS licenses (
  key                   TEXT PRIMARY KEY,
  stripe_session_id     TEXT UNIQUE,
  stripe_payment_intent TEXT,
  customer_email        TEXT NOT NULL,
  receipt_number        TEXT,
  status                TEXT NOT NULL DEFAULT 'active',
  source                TEXT NOT NULL DEFAULT 'stripe',
  note                  TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at          TIMESTAMPTZ,
  CONSTRAINT licenses_status_check CHECK (status IN ('active', 'refunded', 'revoked')),
  CONSTRAINT licenses_source_check CHECK (source IN ('stripe', 'manual'))
);

-- Recovery looks up by lowercased email; the index has to match that shape.
CREATE INDEX IF NOT EXISTS licenses_customer_email_idx
  ON licenses (lower(customer_email));

CREATE INDEX IF NOT EXISTS licenses_receipt_number_idx
  ON licenses (receipt_number);

-- Stripe sends the same webhook more than once. Recording the event ids we
-- have already applied makes replay a no-op rather than a second license.
CREATE TABLE IF NOT EXISTS stripe_events (
  id           TEXT PRIMARY KEY,
  type         TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rate limiting for /api/recover-license.
CREATE TABLE IF NOT EXISTS recovery_attempts (
  id           BIGSERIAL PRIMARY KEY,
  ip           TEXT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recovery_attempts_ip_time_idx
  ON recovery_attempts (ip, attempted_at DESC);
