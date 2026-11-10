CREATE TABLE stands (
  id uuid PRIMARY KEY,
  name varchar(50) NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO stands (id, name)
VALUES ('00000000-0000-4000-8000-000000000001', '初代奶蛙');

-- Keep the legacy id column temporarily so the previous deployed API still works
-- while this migration and the next deployment are in progress.
ALTER TABLE holder_state ADD COLUMN stand_id uuid NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001' REFERENCES stands(id);
ALTER TABLE holder_state DROP CONSTRAINT holder_state_pkey;
ALTER TABLE holder_state ALTER COLUMN id DROP NOT NULL;
ALTER TABLE holder_state ALTER COLUMN id DROP DEFAULT;
ALTER TABLE holder_state ADD CONSTRAINT holder_state_id_key UNIQUE (id);
ALTER TABLE holder_state ADD PRIMARY KEY (stand_id);
ALTER TABLE holder_state ADD COLUMN failed_code_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE holder_state ADD COLUMN code_locked_until timestamptz;
ALTER TABLE holder_state ADD COLUMN code_reset_required boolean NOT NULL DEFAULT false;
UPDATE holder_state SET code_reset_required = true WHERE id = 1;

ALTER TABLE upload_intents ADD COLUMN stand_id uuid NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001' REFERENCES stands(id);
CREATE INDEX upload_intents_stand_idx ON upload_intents (stand_id, expires_at);

ALTER TABLE visits ADD COLUMN stand_id uuid NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001' REFERENCES stands(id);
CREATE INDEX visits_stand_sequence_idx ON visits (stand_id, sequence DESC);

ALTER TABLE audit_log ADD COLUMN stand_id uuid NOT NULL DEFAULT '00000000-0000-4000-8000-000000000001' REFERENCES stands(id);
CREATE INDEX audit_log_stand_idx ON audit_log (stand_id, id DESC);
