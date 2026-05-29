-- Bieri Family Hub — Full Supabase Migration
-- Run this once in the Supabase SQL Editor to create all tables.
-- Safe to re-run: uses IF NOT EXISTS throughout.
--
-- Tables created:
--   events               — calendar events + recurrence templates
--   vaccines             — child vaccine records (status, lot_number, administered_by)
--   medical_appointments — child appointments
--   sports               — sport registrations and schedules
--   registrations        — camp and program registrations
--   payments             — payment ledger
--   categories           — 8 seeded built-ins + unlimited custom
--   share_tokens         — read-only calendar share tokens
--   pending_imports      — email scan queue (human review before commit)
--   pets                 — pet profiles (seeded: Otis, Athena, Persephone)
--   pet_vet_appointments — vet appointment records per pet
--   pet_medications      — medication records per pet
--   pet_grooming         — grooming records per pet
--   pet_vaccines         — pet vaccine records (status, lot_number, administered_by)
--
-- v1.0  Initial schema (events, vaccines, medical, sports, registrations, payments)
-- v1.2  Recurrence columns on events
-- v1.3  pending_imports, share_tokens, categories
-- v1.4  pets, pet_vet_appointments, pet_medications, pet_grooming
-- v1.5  pet_vaccines; vaccines extended with status/administered_by/lot_number

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

-- ─── Pets (v1.4) ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pets (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  species     TEXT,          -- 'dog' | 'cat' | 'rabbit' etc.
  breed       TEXT,
  dob         TEXT,          -- ISO yyyy-MM-dd
  color       TEXT,          -- hex for calendar display
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pet_vet_appointments (
  id          TEXT PRIMARY KEY,
  pet_id      TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  type        TEXT NOT NULL, -- 'checkup' | 'vaccination' | 'procedure' | 'emergency' | 'other'
  provider    TEXT,          -- vet name / clinic
  date        TEXT,
  time        TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pet_medications (
  id          TEXT PRIMARY KEY,
  pet_id      TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  name        TEXT NOT NULL, -- e.g. "Heartgard Plus", "Bravecto"
  dose        TEXT,          -- e.g. "1 chew"
  frequency   TEXT,          -- e.g. "monthly", "daily"
  start_date  TEXT,
  end_date    TEXT,          -- null = ongoing
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pet_grooming (
  id          TEXT PRIMARY KEY,
  pet_id      TEXT NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  provider    TEXT,
  date        TEXT,
  time        TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Seed the three family pets
INSERT INTO pets (id, name, species, breed, color, notes)
VALUES
  ('pet-otis',       'Otis',       'dog', 'Bernese Mountain Dog', '#78350f', null),
  ('pet-athena',     'Athena',     'cat', 'Russian Blue',         '#64748b', null),
  ('pet-persephone', 'Persephone', 'cat', 'Black Bombay',         '#1e1b4b', null)
ON CONFLICT (id) DO NOTHING;
