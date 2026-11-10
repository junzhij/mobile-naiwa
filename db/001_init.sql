CREATE TABLE IF NOT EXISTS holder_state (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  phone_ciphertext text NOT NULL,
  phone_hash text NOT NULL,
  code_hash text NOT NULL,
  version bigint NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS upload_intents (
  id uuid PRIMARY KEY,
  holder_version bigint NOT NULL,
  phone_hash text NOT NULL,
  object_keys jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);
CREATE INDEX IF NOT EXISTS upload_intents_expires_idx ON upload_intents (expires_at);

CREATE TABLE IF NOT EXISTS visits (
  id uuid PRIMARY KEY,
  sequence bigserial UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  caption varchar(140),
  place_name varchar(50),
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  location_source varchar(12) NOT NULL CHECK (location_source IN ('gps', 'manual')),
  hidden boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS photos (
  id uuid PRIMARY KEY,
  visit_id uuid NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  object_key text NOT NULL UNIQUE,
  sort_order smallint NOT NULL,
  size_bytes integer NOT NULL
);
CREATE INDEX IF NOT EXISTS photos_visit_idx ON photos (visit_id, sort_order);

CREATE TABLE IF NOT EXISTS audit_log (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  action varchar(32) NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  filename text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
