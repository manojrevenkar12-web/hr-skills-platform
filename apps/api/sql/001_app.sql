-- The platform's own records: who may use it, every skill run, pilot feedback, case candidates
-- and an audit trail. HR data lives in the hr schema (packages/hr-data/sql).
CREATE SCHEMA IF NOT EXISTS app;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS app.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('comp_partner','hr_business_partner','hr_leadership','people_analytics','recruiter')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.tokens (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill text NOT NULL,
  version text NOT NULL,
  user_id uuid NOT NULL REFERENCES app.users(id),
  role text NOT NULL,
  input jsonb NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','ok','held','failed','refused')),
  output jsonb,
  findings jsonb NOT NULL DEFAULT '[]',
  trace jsonb NOT NULL DEFAULT '[]',
  model text,
  usage jsonb,
  error text,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  duration_ms integer
);
CREATE INDEX IF NOT EXISTS runs_queue ON app.runs (created_at) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS runs_by_user ON app.runs (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS app.feedback (
  run_id uuid PRIMARY KEY REFERENCES app.runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES app.users(id),
  rating text NOT NULL CHECK (rating IN ('useful','partly','not_useful')),
  minutes_saved integer CHECK (minutes_saved BETWEEN 0 AND 600),
  issues text[] NOT NULL DEFAULT '{}',
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- a run someone marked as a lesson: becomes a golden-case proposal for review in a pull request
CREATE TABLE IF NOT EXISTS app.case_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL UNIQUE REFERENCES app.runs(id),
  skill text NOT NULL,
  proposed_by uuid NOT NULL REFERENCES app.users(id),
  expected_status text NOT NULL,
  note text NOT NULL,
  yaml text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app.audit (
  id bigserial PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  actor uuid,
  role text,
  action text NOT NULL,
  subject text,
  ok boolean NOT NULL DEFAULT true,
  detail jsonb NOT NULL DEFAULT '{}'
);
CREATE OR REPLACE FUNCTION app.audit_append_only() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'app.audit is append-only'; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS audit_append_only ON app.audit;
CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE ON app.audit FOR EACH ROW EXECUTE FUNCTION app.audit_append_only();
