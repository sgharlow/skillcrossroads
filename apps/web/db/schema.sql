-- Beacon schema (idempotent). Apply with: npm run db:migrate  (uses DATABASE_URL)
-- Postgres backing for the entitlement, gallery, and scan-history stores (Build Bible §4.4).

CREATE TABLE IF NOT EXISTS subscriptions (
  login              TEXT PRIMARY KEY,
  pro                BOOLEAN NOT NULL DEFAULT false,
  stripe_customer_id TEXT,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subscriptions_customer_idx ON subscriptions (stripe_customer_id);

CREATE TABLE IF NOT EXISTS gallery_entries (
  id         TEXT PRIMARY KEY,   -- owner/repo/path
  owner      TEXT NOT NULL,
  repo       TEXT NOT NULL,
  path       TEXT NOT NULL,
  name       TEXT NOT NULL,
  grade      TEXT NOT NULL,
  overall    NUMERIC NOT NULL,
  scanned_at DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS gallery_overall_idx ON gallery_entries (overall DESC);

-- Every scan, for score-history / trend charts (Sprint 11).
CREATE TABLE IF NOT EXISTS scans (
  id              BIGSERIAL PRIMARY KEY,
  slug            TEXT NOT NULL,   -- owner/repo/path
  name            TEXT NOT NULL,
  grade           TEXT NOT NULL,
  overall         NUMERIC NOT NULL,
  rubric_version  TEXT NOT NULL,
  category_scores JSONB,
  login           TEXT,            -- the signed-in user who ran the scan; NULL for anonymous scans
  scanned_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Idempotent add for databases created before per-user history (Sprint A2).
ALTER TABLE scans ADD COLUMN IF NOT EXISTS login TEXT;
CREATE INDEX IF NOT EXISTS scans_slug_time_idx ON scans (slug, scanned_at DESC);
-- "Your scans" on /account: most-recent scans for one login.
CREATE INDEX IF NOT EXISTS scans_login_time_idx ON scans (login, scanned_at DESC);
