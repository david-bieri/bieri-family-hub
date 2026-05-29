-- Bieri Family Hub — Full Supabase Migration
-- Run this once in the Supabase SQL Editor to create all tables.
-- Safe to re-run: uses IF NOT EXISTS throughout.

-- ─── Events ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id                  TEXT PRIMARY KEY,
  title               TEXT NOT NULL,
  date                TEXT,
  time                TEXT,
  end_time            TEXT,
  child_ids           JSONB DEFAULT '[]',
  category            TEXT DEFAULT 'other',
  notes               TEXT,
  recurring           BOOLEAN DEFAULT FALSE,
  -- Recurrence fields (v1.2)
  recurrence_type     TEXT,          -- 'daily' | 'weekly'
  recurrence_interval INTEGER DEFAULT 1,
  recurrence_days     TEXT,          -- JSON array of day-of-week integers, e.g. "[1,3,5]"
  recurrence_end_date TEXT,
  parent_event_id     TEXT,
  is_template         BOOLEAN DEFAULT FALSE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Vaccines ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vaccines (
  id          TEXT PRIMARY KEY,
  child_id    TEXT NOT NULL,
  name        TEXT NOT NULL,
  date_given  TEXT,
  next_due    TEXT,
  provider    TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Medical Appointments ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS medical_appointments (
  id          TEXT PRIMARY KEY,
  child_id    TEXT NOT NULL,
  type        TEXT NOT NULL,
  provider    TEXT,
  date        TEXT,
  time        TEXT,
  notes       TEXT,
  status      TEXT DEFAULT 'scheduled',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Sports ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sports (
  id          TEXT PRIMARY KEY,
  child_id    TEXT NOT NULL,
  sport       TEXT NOT NULL,
  team        TEXT,
  season      TEXT,
  days        JSONB DEFAULT '[]',
  time        TEXT,
  location    TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Registrations ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS registrations (
  id              TEXT PRIMARY KEY,
  child_id        TEXT NOT NULL,
  program_name    TEXT NOT NULL,
  type            TEXT,
  start_date      TEXT,
  end_date        TEXT,
  deadline        TEXT,
  cost            TEXT,
  status          TEXT DEFAULT 'pending',
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Payments ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id              TEXT PRIMARY KEY,
  description     TEXT NOT NULL,
  amount          TEXT NOT NULL,
  due_date        TEXT,
  paid_date       TEXT,
  child_id        TEXT,
  category        TEXT DEFAULT 'other',
  status          TEXT DEFAULT 'pending',
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Categories (v1.2) ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#6b7280',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Seed built-in categories (idempotent)
INSERT INTO categories (id, name, color) VALUES
  ('school',  'School',  '#3b82f6'),
  ('sports',  'Sports',  '#22c55e'),
  ('medical', 'Medical', '#ef4444'),
  ('camp',    'Camp',    '#f59e0b'),
  ('family',  'Family',  '#8b5cf6'),
  ('payment', 'Payment', '#06b6d4'),
  ('other',   'Other',   '#6b7280')
ON CONFLICT (id) DO NOTHING;

-- ─── Share Tokens (v1.2) ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS share_tokens (
  id          BIGSERIAL PRIMARY KEY,
  token       TEXT UNIQUE NOT NULL,
  label       TEXT DEFAULT 'Family Calendar',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  expires_at  TIMESTAMPTZ
);

-- ─── Pending Imports / Inbox Scanner (v1.3) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS pending_imports (
  id           TEXT PRIMARY KEY,
  source       TEXT NOT NULL DEFAULT 'email',
  raw_subject  TEXT,
  raw_from     TEXT,
  raw_date     TEXT,
  raw_snippet  TEXT,
  gmail_id     TEXT UNIQUE,        -- deduplication key; NULL for non-Gmail sources
  extracted    JSONB NOT NULL DEFAULT '[]',
  status       TEXT NOT NULL DEFAULT 'pending',  -- pending | reviewed | dismissed
  reviewed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pending_imports_status_idx  ON pending_imports(status);
CREATE INDEX IF NOT EXISTS pending_imports_created_idx ON pending_imports(created_at DESC);
