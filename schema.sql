-- LPR Session Matching & Dashboard - PostgreSQL Schema
-- Status as Source-of-Truth (Appendix S) - Authoritative Implementation
-- PostgreSQL 15+ with declarative partitioning by month on events
-- 
-- CRITICAL: This schema follows Appendix S design where events.status is the ONLY 
-- authoritative source of event state. open_entries/orphans are considered caches.

-- =============================================================================
-- SECTION 1: NORMALIZATION HELPER FUNCTIONS (MUST be at top; used during ingest)
-- =============================================================================

CREATE OR REPLACE FUNCTION normalize_plate(p TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT UPPER(REGEXP_REPLACE(COALESCE(p,''), '[^A-Z0-9]', '', 'g'));
$$;

CREATE OR REPLACE FUNCTION normalize_plate_fuzzy(p TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT TRANSLATE(normalize_plate(p), 'O0IL1S5', '00111155');
$$;

CREATE OR REPLACE FUNCTION normalize_state(p TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT UPPER(TRIM(COALESCE(p,'')));
$$;

-- =============================================================================
-- SECTION 2: EXTENSIONS
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =============================================================================
-- SECTION 3: ENUMS
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE event_dir AS ENUM ('IN','OUT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Event Status (Appendix S - Source of Truth)
DO $$ BEGIN
  CREATE TYPE event_status AS ENUM ('OPEN','PAIRED','ORPHAN_OPEN','ORPHAN_EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE match_type AS ENUM ('EXACT','STATE_MISMATCH','FUZZY_ACCEPTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE match_method AS ENUM ('DETERMINISTIC','FUZZY_AUTO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE orphan_status AS ENUM ('OPEN','EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE review_status AS ENUM ('PENDING','APPROVED','REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- SECTION 4: ZONE CONFIGURATION TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS zone_config (
  zone_id TEXT PRIMARY KEY,
  horizon_days INTEGER NOT NULL DEFAULT 8,
  fuzzy_threshold REAL NOT NULL DEFAULT 0.95,
  review_required_below_score REAL NOT NULL DEFAULT 0.85,
  max_stay_hours INTEGER NOT NULL DEFAULT 720,
  billing_rules JSONB DEFAULT '{}'::jsonb
);

-- =============================================================================
-- SECTION 5: UPLOADS REGISTRY TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS uploads (
  id UUID PRIMARY KEY,
  filename TEXT NOT NULL,
  bytes BIGINT NOT NULL,
  rows_claimed BIGINT DEFAULT 0,
  rows_loaded BIGINT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING',
  error_log TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- =============================================================================
-- SECTION 6: EVENTS TABLE (PARTITIONED BY MONTH, WITH STATUS COLUMN)
-- =============================================================================

CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL,
  ts TIMESTAMPTZ NOT NULL,
  zone TEXT NOT NULL,
  direction event_dir NOT NULL,
  plate_raw TEXT,
  plate_norm TEXT,
  plate_norm_fuzzy TEXT,
  state_raw TEXT,
  state_norm TEXT,
  camera_id TEXT,
  upload_id UUID REFERENCES uploads(id) ON DELETE SET NULL,
  quality REAL,
  dupe_key TEXT,
  raw JSONB,
  -- Appendix S: Status as Source-of-Truth
  status event_status NOT NULL DEFAULT 'OPEN',
  PRIMARY KEY (id, ts),  -- include ts for faster pruning
  -- Appendix S: Safety constraint for direction + status sanity
  CONSTRAINT events_status_valid
    CHECK (
      (direction='IN'  AND status IN ('OPEN','PAIRED','ORPHAN_EXPIRED')) OR
      (direction='OUT' AND status IN ('PAIRED','ORPHAN_OPEN'))
    )
) PARTITION BY RANGE (ts);

-- Helper function to create monthly partitions
CREATE OR REPLACE FUNCTION ensure_events_partition(for_ts TIMESTAMPTZ)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  start_ts DATE := date_trunc('month', for_ts)::date;
  end_ts   DATE := (date_trunc('month', for_ts) + INTERVAL '1 month')::date;
  part_name TEXT := format('events_%s', to_char(start_ts, 'YYYYMM'));
  sql TEXT;
BEGIN
  IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = part_name AND n.nspname = 'public')
  THEN
    sql := format('CREATE TABLE IF NOT EXISTS %I PARTITION OF events FOR VALUES FROM (%L) TO (%L);',
                   part_name, start_ts, end_ts);
    EXECUTE sql;
    -- minimal indexes per partition
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I_zone_plate_ts ON %I (zone, plate_norm, ts);', part_name||'_zpt', part_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I_dir_ts ON %I (zone, direction, ts);', part_name||'_dir', part_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I_plate_fuzzy ON %I USING gin (plate_norm_fuzzy gin_trgm_ops);', part_name||'_pfz', part_name);
    EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS %I_dupe ON %I (zone, dupe_key);', part_name||'_dupe', part_name);
    -- Appendix S: Index on status for efficient querying
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I_status ON %I (status);', part_name||'_status', part_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I_zone_status_dir ON %I (zone, status, direction);', part_name||'_zsd', part_name);
  END IF;
END$$;

-- Route trigger to ensure partition exists before insert
CREATE OR REPLACE FUNCTION events_before_insert()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM ensure_events_partition(NEW.ts);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_events_before_insert ON events;
CREATE TRIGGER trg_events_before_insert
BEFORE INSERT ON events
FOR EACH ROW EXECUTE FUNCTION events_before_insert();

-- =============================================================================
-- SECTION 7: OPEN ENTRIES TABLE (CACHE - OPTIONAL UNDER APPENDIX S)
-- =============================================================================

-- NOTE: Under Appendix S, this is considered a CACHE for performance.
-- The authoritative source is events.status='OPEN' for direction='IN'
CREATE TABLE IF NOT EXISTS open_entries (
  entry_event_id BIGINT PRIMARY KEY,
  zone TEXT NOT NULL,
  plate_norm TEXT NOT NULL,
  state_norm TEXT,
  ts TIMESTAMPTZ NOT NULL,
  plate_norm_fuzzy TEXT
);
CREATE INDEX IF NOT EXISTS oe_zone_plate_ts ON open_entries(zone, plate_norm, ts);

-- =============================================================================
-- SECTION 8: SESSIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS sessions (
  id BIGSERIAL PRIMARY KEY,
  zone TEXT NOT NULL,
  entry_event_id BIGINT UNIQUE NOT NULL,
  exit_event_id BIGINT UNIQUE NOT NULL,
  plate_norm TEXT NOT NULL,
  state_entry TEXT,
  state_exit TEXT,
  entry_ts TIMESTAMPTZ NOT NULL,
  exit_ts TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL,
  match_type match_type NOT NULL,
  match_method match_method NOT NULL,
  confidence_score REAL NOT NULL DEFAULT 1.0,
  processing_time_ms INTEGER,
  billing_amount NUMERIC(10,2),
  flags JSONB DEFAULT '{}'::jsonb,
  CHECK (exit_ts > entry_ts)
);
CREATE INDEX IF NOT EXISTS sessions_zone_ts ON sessions(zone, entry_ts, exit_ts);

-- =============================================================================
-- SECTION 9: ORPHANS TABLE (CACHE - OPTIONAL UNDER APPENDIX S)
-- =============================================================================

-- NOTE: Under Appendix S, this is considered a CACHE for performance.
-- The authoritative source is events.status IN ('ORPHAN_OPEN', 'ORPHAN_EXPIRED')
CREATE TABLE IF NOT EXISTS orphans (
  event_id BIGINT PRIMARY KEY,
  zone TEXT NOT NULL,
  plate_norm TEXT,
  state_norm TEXT,
  ts TIMESTAMPTZ NOT NULL,
  direction event_dir NOT NULL,
  status orphan_status NOT NULL DEFAULT 'OPEN'
);
CREATE INDEX IF NOT EXISTS orphans_zone_ts ON orphans(zone, ts);
CREATE INDEX IF NOT EXISTS orphans_zone_dir_ts ON orphans(zone, direction, ts);
CREATE INDEX IF NOT EXISTS orphans_zone_status_dir_ts ON orphans(zone, status, direction, ts);

-- =============================================================================
-- SECTION 10: MATERIALIZED VIEWS FOR ANALYTICS
-- =============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_zone AS
SELECT
  date_trunc('day', entry_ts) AS day,
  zone,
  count(*) FILTER (WHERE match_type = 'EXACT') AS exact_sessions,
  count(*) FILTER (WHERE match_type = 'STATE_MISMATCH') AS state_mismatch_sessions,
  count(*) FILTER (WHERE (flags->>'overnight')::boolean IS TRUE) AS overnight_sessions,
  count(*) FILTER (WHERE (flags->>'multiday')::boolean IS TRUE) AS multiday_sessions,
  count(*) FILTER (WHERE match_type = 'FUZZY_ACCEPTED') AS fuzzy_sessions,
  count(*) AS total_sessions
FROM sessions
GROUP BY 1,2 WITH NO DATA;

-- Unique index required for REFRESH CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS mv_daily_zone_uq ON mv_daily_zone(day, zone);

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_events_daily AS
SELECT date_trunc('day', ts) AS day, zone,
       count(*) FILTER (WHERE direction='IN') AS ins,
       count(*) FILTER (WHERE direction='OUT') AS outs,
       count(*) AS total_events
FROM events
GROUP BY 1,2 WITH NO DATA;

CREATE UNIQUE INDEX IF NOT EXISTS mv_events_daily_uq ON mv_events_daily(day, zone);

-- Convenience refresh function
CREATE OR REPLACE FUNCTION refresh_analytics()
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_zone;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_events_daily;
END$$;

-- =============================================================================
-- SECTION 11: BILLING CALCULATION FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION compute_billing_amount(p_zone TEXT, p_entry TIMESTAMPTZ, p_exit TIMESTAMPTZ, p_flags JSONB)
RETURNS NUMERIC LANGUAGE plpgsql AS $$
DECLARE
  rules JSONB := (SELECT billing_rules FROM zone_config WHERE zone_id=p_zone);
  base NUMERIC := COALESCE((rules->>'base_rate')::numeric, 0);
  hourly NUMERIC := COALESCE((rules->>'hourly_rate')::numeric, 0);
  daily_max NUMERIC := COALESCE((rules->>'daily_max')::numeric, 999999);
  overnight_fee NUMERIC := COALESCE((rules->>'overnight_fee')::numeric, 0);
  hours NUMERIC := CEIL(EXTRACT(EPOCH FROM (p_exit - p_entry))/3600.0);
  days NUMERIC := CEIL(hours/24.0);
  cost NUMERIC := base + LEAST(days * daily_max, hours * hourly);
BEGIN
  IF (p_flags->>'overnight')::boolean THEN
    cost := cost + overnight_fee;
  END IF;
  RETURN cost;
END$$;

-- =============================================================================
-- SECTION 12: APPENDIX S - DETERMINISTIC PAIRING FUNCTION V2 (SOURCE OF TRUTH)
-- =============================================================================

CREATE OR REPLACE FUNCTION pair_out_event_v2(p_out_id BIGINT)
RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE out_e RECORD; in_e RECORD; horizon INT; BEGIN
  SELECT e.*, COALESCE(z.horizon_days, 8) AS horizon
  INTO out_e
  FROM events e LEFT JOIN zone_config z ON z.zone_id = e.zone
  WHERE e.id = p_out_id AND e.direction='OUT'
  FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  SELECT * INTO in_e
  FROM events e
  WHERE e.direction='IN' AND e.status='OPEN'
    AND e.zone = out_e.zone
    AND e.plate_norm = out_e.plate_norm
    AND e.ts < out_e.ts
    AND e.ts >= out_e.ts - make_interval(days => out_e.horizon)
  ORDER BY e.ts ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF NOT FOUND THEN
    UPDATE events SET status='ORPHAN_OPEN' WHERE id = out_e.id;
    RETURN FALSE;
  END IF;

  INSERT INTO sessions(zone, entry_event_id, exit_event_id, plate_norm, state_entry, state_exit,
                       entry_ts, exit_ts, duration_minutes, match_type, match_method,
                       confidence_score, flags, billing_amount)
  SELECT out_e.zone, in_e.id, out_e.id, in_e.plate_norm, in_e.state_norm, out_e.state_norm,
         in_e.ts, out_e.ts,
         (EXTRACT(EPOCH FROM (out_e.ts - in_e.ts))/60)::int,
         CASE WHEN COALESCE(in_e.state_norm,'') = COALESCE(out_e.state_norm,'') THEN 'EXACT' ELSE 'STATE_MISMATCH' END,
         'DETERMINISTIC',
         1.0,
         jsonb_build_object(
           'overnight', (date(in_e.ts) <> date(out_e.ts)),
           'multiday',  (out_e.ts - in_e.ts) >= INTERVAL '24 hours'
         ),
         compute_billing_amount(out_e.zone, in_e.ts, out_e.ts,
           jsonb_build_object(
             'overnight', (date(in_e.ts) <> date(out_e.ts)),
             'multiday',  (out_e.ts - in_e.ts) >= INTERVAL '24 hours'
           ))
  ;

  UPDATE events SET status='PAIRED' WHERE id IN (in_e.id, out_e.id);
  RETURN TRUE;
END $$;

-- =============================================================================
-- SECTION 13: APPENDIX S - EXPIRE HORIZON FUNCTION V2 (SOURCE OF TRUTH)
-- =============================================================================

CREATE OR REPLACE FUNCTION expire_open_ins_v2()
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE changed INT; BEGIN
  WITH upd AS (
    UPDATE events e
       SET status='ORPHAN_EXPIRED'
      FROM zone_config z
     WHERE e.direction='IN' AND e.status='OPEN'
       AND e.zone = z.zone_id
       AND e.ts < now() - make_interval(days => z.horizon_days)
    RETURNING e.id
  ) SELECT count(*) INTO changed FROM upd;
  RETURN changed;
END $$;

-- =============================================================================
-- SECTION 14: APPENDIX J - RETROACTIVE MATCHING FUNCTION  
-- =============================================================================

CREATE OR REPLACE FUNCTION process_retroactive_matches(p_zone TEXT, p_horizon_days INT DEFAULT 8)
RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE
  r RECORD; matched INT := 0;
BEGIN
  FOR r IN
    SELECT o.event_id AS out_id, o.zone, o.plate_norm, o.ts
    FROM orphans o
    WHERE o.direction='OUT'
      AND o.status='OPEN'
      AND o.zone = p_zone
      AND o.ts >= now() - make_interval(days => p_horizon_days)
    ORDER BY o.ts, o.event_id
  LOOP
    PERFORM pair_out_event_v2(r.out_id);
    matched := matched + 1;
  END LOOP;
  RETURN matched;
END $$;

-- =============================================================================
-- SECTION 15: APPENDIX I - CONSISTENCY VERIFICATION FUNCTIONS
-- =============================================================================

-- Targeted verifier used by triggers
CREATE OR REPLACE FUNCTION verify_event_consistency_one(p_event_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
  cnt_open INT := 0; cnt_sess INT := 0; cnt_orph INT := 0; total INT := 0;
BEGIN
  SELECT COUNT(*) INTO cnt_open FROM open_entries  WHERE entry_event_id = p_event_id;
  SELECT COUNT(*) INTO cnt_sess FROM sessions WHERE entry_event_id = p_event_id OR exit_event_id = p_event_id;
  SELECT COUNT(*) INTO cnt_orph FROM orphans      WHERE event_id       = p_event_id;
  total := cnt_open + cnt_sess + cnt_orph;
  IF total > 1 THEN
    RAISE EXCEPTION 'Event % has multiple states (open:% sessions:% orphans:%)', p_event_id, cnt_open, cnt_sess, cnt_orph;
  END IF;
END $$;

-- Row-level triggers to enforce during mutations
CREATE OR REPLACE FUNCTION trg_verify_open_entries()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM verify_event_consistency_one(COALESCE(NEW.entry_event_id, OLD.entry_event_id));
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS tg_open_entries_verify ON open_entries;
CREATE TRIGGER tg_open_entries_verify
AFTER INSERT OR DELETE ON open_entries
FOR EACH ROW EXECUTE FUNCTION trg_verify_open_entries();

CREATE OR REPLACE FUNCTION trg_verify_orphans()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM verify_event_consistency_one(COALESCE(NEW.event_id, OLD.event_id));
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS tg_orphans_verify ON orphans;
CREATE TRIGGER tg_orphans_verify
AFTER INSERT OR DELETE ON orphans
FOR EACH ROW EXECUTE FUNCTION trg_verify_orphans();

CREATE OR REPLACE FUNCTION trg_verify_sessions()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM verify_event_consistency_one(COALESCE(NEW.entry_event_id, OLD.entry_event_id));
  PERFORM verify_event_consistency_one(COALESCE(NEW.exit_event_id,  OLD.exit_event_id));
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS tg_sessions_verify ON sessions;
CREATE TRIGGER tg_sessions_verify
AFTER INSERT OR DELETE ON sessions
FOR EACH ROW EXECUTE FUNCTION trg_verify_sessions();

-- Full consistency scanner (for ops and CI)
CREATE OR REPLACE FUNCTION verify_event_consistency()
RETURNS TABLE(event_id BIGINT, issue TEXT)
LANGUAGE sql AS $$
  SELECT e.id, 'Multiple states'::text
  FROM events e
  WHERE (
    (EXISTS (SELECT 1 FROM open_entries oe WHERE oe.entry_event_id = e.id))::int +
    (EXISTS (SELECT 1 FROM sessions s WHERE s.entry_event_id = e.id OR s.exit_event_id = e.id))::int +
    (EXISTS (SELECT 1 FROM orphans o WHERE o.event_id = e.id))::int
  ) > 1
  UNION ALL
  SELECT e.id, 'No state (unassigned)'
  FROM events e
  WHERE NOT EXISTS (SELECT 1 FROM open_entries oe WHERE oe.entry_event_id = e.id)
    AND NOT EXISTS (SELECT 1 FROM sessions s WHERE s.entry_event_id = e.id OR s.exit_event_id = e.id)
    AND NOT EXISTS (SELECT 1 FROM orphans o WHERE o.event_id = e.id);
$$;

-- =============================================================================
-- SECTION 16: OCR PATTERNS TABLE (EXTRAS)
-- =============================================================================

CREATE TABLE IF NOT EXISTS ocr_patterns (
  from_char CHAR(1) NOT NULL,
  to_char   CHAR(1) NOT NULL,
  weight    REAL    NOT NULL,
  PRIMARY KEY (from_char, to_char)
);

-- =============================================================================
-- SECTION 17: TEST DATA GENERATOR (APPENDIX S)
-- =============================================================================

CREATE OR REPLACE FUNCTION generate_test_events(
  p_zone TEXT,
  p_num_sessions INT,
  p_error_rate REAL DEFAULT 0.05
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE i INT; plate TEXT; t1 TIMESTAMPTZ; t2 TIMESTAMPTZ; tmp TEXT; BEGIN
  FOR i IN 1..p_num_sessions LOOP
    plate := 'TEST' || LPAD(i::TEXT,4,'0');
    t1 := NOW() - (random() * INTERVAL '7 days');
    t2 := t1 + (1 + random()*7) * INTERVAL '1 hour';

    INSERT INTO events(ts, zone, direction, plate_raw, plate_norm, plate_norm_fuzzy, state_raw, state_norm, status)
    VALUES (t1, p_zone, 'IN',  plate, normalize_plate(plate), normalize_plate_fuzzy(plate), 'TN', 'TN', 'OPEN');

    tmp := plate;
    IF random() < p_error_rate THEN tmp := OVERLAY(tmp PLACING '8' FROM 2 FOR 1); END IF;

    INSERT INTO events(ts, zone, direction, plate_raw, plate_norm, plate_norm_fuzzy, state_raw, state_norm, status)
    VALUES (t2, p_zone, 'OUT', tmp, normalize_plate(tmp), normalize_plate_fuzzy(tmp), 'TN', 'TN', 'ORPHAN_OPEN');
  END LOOP;
END $$;

-- =============================================================================
-- END OF SCHEMA
-- =============================================================================