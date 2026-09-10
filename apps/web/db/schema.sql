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
-- Who opted this entry in. `owner` is the SCANNED repo's owner, which is NOT the same person, so
-- it can never evidence arms-length demand on its own (2026-09-09 G0 audit). NULL = pre-existing
-- row, actor unknown; the demand metric refuses to count those.
ALTER TABLE gallery_entries ADD COLUMN IF NOT EXISTS opted_in_by TEXT;

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

-- Last-known-good badge SVG per slug (Sprint 7): anonymous badge requests serve this instantly
-- (a cold repo scan can outlast GitHub camo's ~4s proxy timeout) and refresh in the background.
CREATE TABLE IF NOT EXISTS badge_cache (
  slug       TEXT PRIMARY KEY,   -- owner/repo[/subpath]
  svg        TEXT NOT NULL,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lock out Supabase's PostgREST roles (2026-08-02 security fix, advisor rls_disabled_in_public).
-- The app only ever connects as the table owner via DATABASE_URL, so anon/authenticated need
-- zero access; without this, the publishable anon key had full CRUD on every table above.
ALTER TABLE subscriptions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans           ENABLE ROW LEVEL SECURITY;
ALTER TABLE badge_cache     ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
