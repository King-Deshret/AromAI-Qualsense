-- ============================================================
-- AromAI QC Platform — Initial Schema (Supabase-compatible)
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ── Enums ──────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM ('Operator', 'Manager', 'Admin');
CREATE TYPE user_status AS ENUM ('PENDING_ACTIVATION', 'ACTIVE', 'INACTIVE');
CREATE TYPE lot_status AS ENUM (
  'INSPECTION_RUNNING', 'MANAGER_REVIEW',
  'APPROVED', 'REJECTED', 'QUARANTINED', 'ESCALATED'
);
CREATE TYPE session_status AS ENUM ('RUNNING', 'COMPLETED');
CREATE TYPE session_end_reason AS ENUM (
  'CONVEYOR_STOPPED', 'UNIT_COUNT_REACHED', 'MAX_DURATION', 'MANUAL'
);
CREATE TYPE grade_enum AS ENUM ('A', 'B', 'C', 'Reject');
CREATE TYPE color_category AS ENUM ('Normal', 'Pucat', 'Terlalu Matang', 'Abnormal');
CREATE TYPE defect_severity AS ENUM ('Minor', 'Moderate', 'Severe');
CREATE TYPE decision_value AS ENUM ('APPROVED', 'REJECTED', 'QUARANTINED', 'ESCALATED');
CREATE TYPE shift_name AS ENUM ('Pagi', 'Siang', 'Malam');
CREATE TYPE shift_status AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE ai_svc_status AS ENUM ('HEALTHY', 'UNHEALTHY');

-- ── users ──────────────────────────────────────────────────

CREATE TABLE users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(100) NOT NULL,
  email      VARCHAR(254) NOT NULL,
  role       user_role    NOT NULL,
  status     user_status  NOT NULL DEFAULT 'PENDING_ACTIVATION',
  shift      shift_name,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX users_email_unique ON users (LOWER(email));
CREATE INDEX idx_users_role   ON users (role);
CREATE INDEX idx_users_status ON users (status);

-- ── lots ───────────────────────────────────────────────────

CREATE TABLE lots (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_code          VARCHAR(50) NOT NULL UNIQUE,
  batch_name        VARCHAR(200) NOT NULL,
  product_type      VARCHAR(100) NOT NULL,
  estimated_units   INTEGER      NOT NULL CHECK (estimated_units > 0),
  production_date   DATE         NOT NULL,
  shift             shift_name   NOT NULL,
  operator_id       UUID         NOT NULL REFERENCES users (id),
  status            lot_status   NOT NULL DEFAULT 'INSPECTION_RUNNING',
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  status_changed_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lots_status     ON lots (status);
CREATE INDEX idx_lots_operator   ON lots (operator_id);
CREATE INDEX idx_lots_created_at ON lots (created_at DESC);
CREATE INDEX idx_lots_batch_name ON lots USING gin (batch_name gin_trgm_ops);

-- ── inspection_sessions ─────────────────────────────────────

CREATE TABLE inspection_sessions (
  id          UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id      UUID               NOT NULL REFERENCES lots (id),
  operator_id UUID               NOT NULL REFERENCES users (id),
  started_at  TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  ended_at    TIMESTAMPTZ,
  status      session_status     NOT NULL DEFAULT 'RUNNING',
  end_reason  session_end_reason
);

CREATE INDEX idx_sessions_lot_id ON inspection_sessions (lot_id);
CREATE INDEX idx_sessions_status ON inspection_sessions (status);

-- ── frame_data (high-volume) ────────────────────────────────

CREATE TABLE frame_data (
  id               UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID           NOT NULL REFERENCES inspection_sessions (id),
  lot_id           UUID           NOT NULL REFERENCES lots (id),
  object_class     VARCHAR(100)   NOT NULL,
  confidence_score NUMERIC(5,4)   NOT NULL CHECK (confidence_score BETWEEN 0 AND 1),
  rot_level        NUMERIC(5,2)   NOT NULL CHECK (rot_level BETWEEN 0 AND 100),
  color_rgb        JSONB          NOT NULL,
  color_deviation  NUMERIC(6,4)   NOT NULL,
  color_category   color_category NOT NULL,
  defect_types     JSONB          NOT NULL DEFAULT '[]',
  defect_count     INTEGER        NOT NULL DEFAULT 0,
  defect_severity  defect_severity NOT NULL,
  anomaly_score    NUMERIC(5,4)   NOT NULL,
  bbox_coordinates JSONB          NOT NULL,
  frame_timestamp  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_frame_session ON frame_data (session_id);
CREATE INDEX idx_frame_lot     ON frame_data (lot_id);
CREATE INDEX idx_frame_ts      ON frame_data (frame_timestamp DESC);

-- ── inspection_reports ──────────────────────────────────────

CREATE TABLE inspection_reports (
  id                      UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id                  UUID           NOT NULL UNIQUE REFERENCES lots (id),
  session_id              UUID           NOT NULL REFERENCES inspection_sessions (id),
  final_grade             grade_enum     NOT NULL,
  avg_confidence          NUMERIC(5,4)   NOT NULL,
  avg_rot_level           NUMERIC(5,2)   NOT NULL,
  final_anomaly_score     NUMERIC(5,4)   NOT NULL,
  dominant_color_category color_category NOT NULL,
  total_defects           INTEGER        NOT NULL DEFAULT 0,
  defect_distribution     JSONB          NOT NULL DEFAULT '{}',
  total_objects_scanned   INTEGER        NOT NULL DEFAULT 0,
  pass_count              INTEGER        NOT NULL DEFAULT 0,
  fail_count              INTEGER        NOT NULL DEFAULT 0,
  inspection_duration     INTEGER        NOT NULL,
  snapshot_urls           JSONB          NOT NULL DEFAULT '[]',
  created_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ── decisions ───────────────────────────────────────────────

CREATE TABLE decisions (
  id                   UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id               UUID           NOT NULL REFERENCES lots (id),
  inspection_report_id UUID           NOT NULL REFERENCES inspection_reports (id),
  decision             decision_value NOT NULL,
  decided_by           UUID           REFERENCES users (id),
  is_system_decision   BOOLEAN        NOT NULL DEFAULT TRUE,
  rules_evaluated      JSONB          NOT NULL DEFAULT '[]',
  override_reason      TEXT,
  escalation_reason    TEXT,
  decided_at           TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_decisions_lot_id ON decisions (lot_id);

-- ── notifications ────────────────────────────────────────────

CREATE TABLE notifications (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES users (id),
  type           VARCHAR(50) NOT NULL,
  title          VARCHAR(200) NOT NULL,
  message        TEXT        NOT NULL,
  is_read        BOOLEAN     NOT NULL DEFAULT FALSE,
  reference_type VARCHAR(50),
  reference_id   UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notif_user_id ON notifications (user_id);
CREATE INDEX idx_notif_is_read ON notifications (user_id, is_read);

-- ── system_config (singleton row) ────────────────────────────

CREATE TABLE system_config (
  id                           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  confidence_min               NUMERIC(5,4) NOT NULL DEFAULT 0.70,
  rot_threshold_a              NUMERIC(5,2) NOT NULL DEFAULT 10.0,
  rot_threshold_b              NUMERIC(5,2) NOT NULL DEFAULT 30.0,
  rot_threshold_c              NUMERIC(5,2) NOT NULL DEFAULT 60.0,
  defect_threshold_a           INTEGER      NOT NULL DEFAULT 2,
  defect_threshold_b           INTEGER      NOT NULL DEFAULT 5,
  defect_threshold_c           INTEGER      NOT NULL DEFAULT 10,
  anomaly_quarantine_threshold NUMERIC(5,4) NOT NULL DEFAULT 0.80,
  anomaly_escalation_threshold NUMERIC(5,4) NOT NULL DEFAULT 0.90,
  session_max_duration_sec     INTEGER      NOT NULL DEFAULT 3600,
  conveyor_stop_detect_sec     INTEGER      NOT NULL DEFAULT 30,
  camera_url                   TEXT         NOT NULL DEFAULT 'ws://localhost:8080/stream',
  camera_resolution            VARCHAR(20)  NOT NULL DEFAULT '1920x1080',
  camera_fps                   INTEGER      NOT NULL DEFAULT 30,
  notification_config          JSONB        NOT NULL DEFAULT '{}',
  cron_config                  JSONB        NOT NULL DEFAULT '{}',
  ai_service_status            ai_svc_status NOT NULL DEFAULT 'HEALTHY',
  updated_at                   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── thresholds ───────────────────────────────────────────────

CREATE TABLE thresholds (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type     VARCHAR(100) NOT NULL,
  grade            grade_enum   NOT NULL,
  min_confidence   NUMERIC(5,4) NOT NULL,
  max_rot_level    NUMERIC(5,2) NOT NULL,
  max_defect_count INTEGER      NOT NULL,
  max_anomaly_score NUMERIC(5,4) NOT NULL,
  UNIQUE (product_type, grade)
);

-- ── shift_assignments ────────────────────────────────────────

CREATE TABLE shift_assignments (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_name     shift_name   NOT NULL,
  operator_id    UUID         NOT NULL REFERENCES users (id),
  manager_id     UUID         NOT NULL REFERENCES users (id),
  effective_date DATE         NOT NULL,
  status         shift_status NOT NULL DEFAULT 'ACTIVE'
);

CREATE INDEX idx_shift_operator ON shift_assignments (operator_id);
CREATE INDEX idx_shift_manager  ON shift_assignments (manager_id);

-- ── audit_logs (append-only enforced via trigger) ────────────

CREATE TABLE audit_logs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type  VARCHAR(100) NOT NULL,
  actor_id     UUID        REFERENCES users (id),
  target_type  VARCHAR(100) NOT NULL,
  target_id    TEXT        NOT NULL,
  value_before JSONB,
  value_after  JSONB,
  ip_address   INET,
  status       VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_actor      ON audit_logs (actor_id);
CREATE INDEX idx_audit_created_at ON audit_logs (created_at DESC);
CREATE INDEX idx_audit_type       ON audit_logs (action_type);

-- Trigger to block UPDATE/DELETE on audit_logs (immutability)
CREATE OR REPLACE FUNCTION audit_logs_immutable()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is immutable: UPDATE and DELETE are not allowed';
END;
$$;

CREATE TRIGGER audit_logs_no_update
  BEFORE UPDATE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_immutable();

CREATE TRIGGER audit_logs_no_delete
  BEFORE DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_immutable();

-- ── Seed: system_config ───────────────────────────────────────

INSERT INTO system_config (notification_config, cron_config)
VALUES (
  '{
    "LOT_APPROVED":     {"in_app": true,  "email": false, "push": false},
    "LOT_REJECTED":     {"in_app": true,  "email": true,  "push": false},
    "LOT_QUARANTINED":  {"in_app": true,  "email": true,  "push": false},
    "LOT_ESCALATED":    {"in_app": true,  "email": true,  "push": false},
    "SESSION_COMPLETE": {"in_app": true,  "email": false, "push": false},
    "SYSTEM_ALERT":     {"in_app": true,  "email": true,  "push": false},
    "CRON_REPORT_READY":{"in_app": true,  "email": false, "push": false},
    "report_recipients": []
  }'::jsonb,
  '{
    "metrics_refresh_cron":        "0 * * * *",
    "camera_health_cron":          "0 * * * *",
    "daily_report_cron":           "0 0 * * *",
    "archive_frame_data_cron":     "0 0 * * *",
    "weekly_report_cron":          "0 0 * * 1",
    "monthly_report_cron":         "0 0 1 * *",
    "cleanup_cold_storage_cron":   "0 0 1 * *",
    "active_data_retention_days":  7,
    "cold_storage_retention_days": 90
  }'::jsonb
);

-- ── Seed: thresholds per grade ────────────────────────────────

INSERT INTO thresholds (product_type, grade, min_confidence, max_rot_level, max_defect_count, max_anomaly_score)
VALUES
  ('default', 'A',      0.90, 10.0,    2, 0.20),
  ('default', 'B',      0.75, 30.0,    5, 0.50),
  ('default', 'C',      0.60, 60.0,   10, 0.75),
  ('default', 'Reject', 0.00, 100.0, 9999, 1.00);
