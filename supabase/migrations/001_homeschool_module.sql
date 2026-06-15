-- ═══════════════════════════════════════════════════════════════════════════════
-- Bieri Family Hub — Homeschool Module Migration
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- This migration adds:
--   1. hub_users           — authenticated users with roles and household scoping
--   2. households          — household definitions (Bieri primary, co-parent)
--   3. custody_schedule    — week-on/week-off custody calendar
--   4. academic_subjects   — subjects being taught per child
--   5. academic_progress   — daily/weekly progress records per child per subject
--   6. portfolio_artifacts — uploaded work samples, photos, documents
--   7. curriculum_plans    — scope & sequence / weekly plans
--   8. compliance_filings  — Virginia NOI, annual assessments, etc.
--   9. handoff_digests     — generated custody-switch summaries
--
-- Row Level Security (RLS) ensures the co-parent portal user can ONLY access
-- data scoped to their children (Cole, Airlie).
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── Enable RLS on all new tables ────────────────────────────────────────────

-- ─── 1. Households ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS households (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'primary',  -- 'primary' | 'coparent'
  address     TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO households (id, name, type, address, notes) VALUES
  ('hh-bieri',    'Bieri Household',    'primary',  NULL, 'David & Nancy — primary homeschool household'),
  ('hh-coparent', 'Co-Parent Household', 'coparent', NULL, 'Biological father — Cole & Airlie 50/50 custody')
ON CONFLICT (id) DO NOTHING;

-- ─── 2. Hub Users ────────────────────────────────────────────────────────────
-- Links to Supabase Auth (auth.users.id) for real authentication.
CREATE TABLE IF NOT EXISTS hub_users (
  id              TEXT PRIMARY KEY,           -- matches auth.users.id (UUID as text)
  email           TEXT UNIQUE NOT NULL,
  display_name    TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'viewer',  -- 'admin' | 'coparent' | 'viewer' | 'child'
  household_id    TEXT NOT NULL REFERENCES households(id),
  child_scope     JSONB DEFAULT '[]',        -- which child_ids this user can access (empty = all for admins)
  active          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Seed initial users (IDs will be replaced with real auth.users.id on setup)
INSERT INTO hub_users (id, email, display_name, role, household_id, child_scope) VALUES
  ('user-david',    'david@example.com',    'David Bieri',       'admin',    'hh-bieri',    '[]'),
  ('user-nancy',    'nancy@example.com',    'Nancy Bieri',       'admin',    'hh-bieri',    '[]'),
  ('user-coparent', 'coparent@example.com', 'Co-Parent',         'coparent', 'hh-coparent', '["cole","airlie"]')
ON CONFLICT (id) DO NOTHING;

-- ─── 3. Custody Schedule ─────────────────────────────────────────────────────
-- Tracks which household has Cole & Airlie each week.
CREATE TABLE IF NOT EXISTS custody_schedule (
  id              TEXT PRIMARY KEY,
  week_start      TEXT NOT NULL,             -- ISO yyyy-MM-dd (Monday)
  household_id    TEXT NOT NULL REFERENCES households(id),
  child_ids       JSONB NOT NULL DEFAULT '["cole","airlie"]',
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS custody_schedule_week_idx ON custody_schedule(week_start);

-- ─── 4. Academic Subjects ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS academic_subjects (
  id          TEXT PRIMARY KEY,
  child_id    TEXT NOT NULL,
  name        TEXT NOT NULL,                 -- e.g. "Mathematics", "Science", "History"
  platform    TEXT,                          -- e.g. "Khan Academy", "Math Academy", "Parent-led"
  methodology TEXT,                          -- e.g. "Classical", "Charlotte Mason", "Adaptive AI"
  grade_level TEXT,                          -- e.g. "6th", "4th", "Advanced"
  active      BOOLEAN DEFAULT TRUE,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS academic_subjects_child_idx ON academic_subjects(child_id);

-- ─── 5. Academic Progress ────────────────────────────────────────────────────
-- Individual progress entries — can be auto-extracted from emails or manually logged.
CREATE TABLE IF NOT EXISTS academic_progress (
  id              TEXT PRIMARY KEY,
  child_id        TEXT NOT NULL,
  subject_id      TEXT REFERENCES academic_subjects(id) ON DELETE SET NULL,
  date            TEXT NOT NULL,             -- ISO yyyy-MM-dd
  household_id    TEXT REFERENCES households(id),  -- which household logged this
  -- Progress metrics (flexible — not all fields required)
  duration_min    INTEGER,                   -- minutes spent
  lessons_done    INTEGER,                   -- number of lessons/units completed
  mastery_score   TEXT,                      -- platform-reported score (e.g. "85%", "4/5 stars")
  skills_mastered TEXT,                      -- JSON array of skill names
  -- Source tracking
  source          TEXT DEFAULT 'manual',     -- 'manual' | 'email_extract' | 'sms' | 'import'
  source_ref      TEXT,                      -- reference to pending_imports.id or email subject
  -- Content
  title           TEXT,                      -- short description of what was done
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS academic_progress_child_idx ON academic_progress(child_id);
CREATE INDEX IF NOT EXISTS academic_progress_date_idx ON academic_progress(date DESC);
CREATE INDEX IF NOT EXISTS academic_progress_household_idx ON academic_progress(household_id);

-- ─── 6. Portfolio Artifacts ──────────────────────────────────────────────────
-- Work samples, photos, documents uploaded by either household.
CREATE TABLE IF NOT EXISTS portfolio_artifacts (
  id              TEXT PRIMARY KEY,
  child_id        TEXT NOT NULL,
  subject_id      TEXT REFERENCES academic_subjects(id) ON DELETE SET NULL,
  date            TEXT NOT NULL,             -- ISO yyyy-MM-dd
  household_id    TEXT REFERENCES households(id),
  -- Artifact details
  title           TEXT NOT NULL,
  description     TEXT,
  artifact_type   TEXT DEFAULT 'document',   -- 'document' | 'photo' | 'video' | 'audio' | 'link' | 'text'
  file_url        TEXT,                      -- Supabase Storage URL
  file_name       TEXT,
  file_size       INTEGER,                   -- bytes
  -- Metadata
  tags            JSONB DEFAULT '[]',        -- e.g. ["science", "lab-report", "hands-on"]
  va_standard     TEXT,                      -- Virginia SOL standard alignment (optional)
  source          TEXT DEFAULT 'manual',     -- 'manual' | 'sms' | 'email'
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS portfolio_artifacts_child_idx ON portfolio_artifacts(child_id);
CREATE INDEX IF NOT EXISTS portfolio_artifacts_date_idx ON portfolio_artifacts(date DESC);

-- ─── 7. Curriculum Plans ─────────────────────────────────────────────────────
-- Weekly or unit-level plans that both households can view.
CREATE TABLE IF NOT EXISTS curriculum_plans (
  id              TEXT PRIMARY KEY,
  child_id        TEXT NOT NULL,
  subject_id      TEXT REFERENCES academic_subjects(id) ON DELETE SET NULL,
  -- Plan scope
  plan_type       TEXT DEFAULT 'weekly',     -- 'weekly' | 'unit' | 'semester' | 'annual'
  title           TEXT NOT NULL,
  start_date      TEXT,
  end_date        TEXT,
  -- Content
  objectives      JSONB DEFAULT '[]',        -- learning objectives for this period
  activities      JSONB DEFAULT '[]',        -- planned activities/lessons
  resources       JSONB DEFAULT '[]',        -- books, links, materials needed
  assessment      TEXT,                      -- how progress will be measured
  -- Status
  status          TEXT DEFAULT 'planned',    -- 'planned' | 'active' | 'completed'
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS curriculum_plans_child_idx ON curriculum_plans(child_id);

-- ─── 8. Compliance Filings ───────────────────────────────────────────────────
-- Virginia NOI filings, annual assessments, and other legal documents.
CREATE TABLE IF NOT EXISTS compliance_filings (
  id              TEXT PRIMARY KEY,
  filing_type     TEXT NOT NULL,             -- 'noi' | 'annual_assessment' | 'test_results' | 'evaluation_letter' | 'other'
  child_id        TEXT,                      -- NULL for family-wide filings
  school_year     TEXT NOT NULL,             -- e.g. "2026-2027"
  -- Filing details
  title           TEXT NOT NULL,
  filed_date      TEXT,                      -- when submitted to school division
  due_date        TEXT,                      -- statutory deadline
  status          TEXT DEFAULT 'draft',      -- 'draft' | 'ready' | 'filed' | 'acknowledged'
  -- Document
  file_url        TEXT,                      -- Supabase Storage URL for the filed document
  file_name       TEXT,
  -- Content (for NOI generation)
  content         JSONB,                     -- structured content (subjects list, instructor quals, etc.)
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS compliance_filings_year_idx ON compliance_filings(school_year);

-- ─── 9. Handoff Digests ──────────────────────────────────────────────────────
-- Auto-generated summaries sent at custody transitions.
CREATE TABLE IF NOT EXISTS handoff_digests (
  id              TEXT PRIMARY KEY,
  week_start      TEXT NOT NULL,             -- the week being summarized
  from_household  TEXT REFERENCES households(id),
  to_household    TEXT REFERENCES households(id),
  child_ids       JSONB NOT NULL DEFAULT '["cole","airlie"]',
  -- Content
  summary_text    TEXT NOT NULL,             -- LLM-generated markdown summary
  progress_data   JSONB,                     -- structured data used to generate summary
  -- Delivery
  sent_at         TIMESTAMPTZ,
  sent_via        TEXT,                      -- 'telegram' | 'sms' | 'email' | 'in_app'
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS handoff_digests_week_idx ON handoff_digests(week_start DESC);

-- ─── Add "academics" category to main categories table ───────────────────────
INSERT INTO categories (id, name, color) VALUES
  ('academics', 'Academics', '#7c3aed')
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY POLICIES
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Strategy:
--   - Admin users (David, Nancy) can read/write ALL rows.
--   - Co-parent users can ONLY read/write rows where child_id is in their
--     child_scope array (i.e., 'cole' or 'airlie').
--   - Co-parent CANNOT see household financials, other children, or system config.
--
-- Implementation uses a helper function that checks the current user's role
-- and child_scope from hub_users, keyed by auth.uid().
-- ═══════════════════════════════════════════════════════════════════════════════

-- Helper function: get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM hub_users WHERE id = auth.uid()::text;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: get current user's child_scope as text array
CREATE OR REPLACE FUNCTION get_user_child_scope()
RETURNS JSONB AS $$
  SELECT COALESCE(child_scope, '[]'::jsonb) FROM hub_users WHERE id = auth.uid()::text;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: check if user can access a given child_id
CREATE OR REPLACE FUNCTION can_access_child(target_child_id TEXT)
RETURNS BOOLEAN AS $$
  SELECT
    CASE
      WHEN get_user_role() = 'admin' THEN TRUE
      WHEN get_user_child_scope() = '[]'::jsonb THEN TRUE  -- empty scope = all access
      ELSE get_user_child_scope() ? target_child_id        -- JSONB contains check
    END;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── Enable RLS ──────────────────────────────────────────────────────────────
ALTER TABLE academic_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_filings ENABLE ROW LEVEL SECURITY;
ALTER TABLE handoff_digests ENABLE ROW LEVEL SECURITY;
ALTER TABLE custody_schedule ENABLE ROW LEVEL SECURITY;

-- ─── Policies: academic_subjects ─────────────────────────────────────────────
CREATE POLICY "admin_full_access" ON academic_subjects
  FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "coparent_read_own_children" ON academic_subjects
  FOR SELECT USING (can_access_child(child_id));

CREATE POLICY "coparent_insert_own_children" ON academic_subjects
  FOR INSERT WITH CHECK (can_access_child(child_id));

-- ─── Policies: academic_progress ─────────────────────────────────────────────
CREATE POLICY "admin_full_access" ON academic_progress
  FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "coparent_read_own_children" ON academic_progress
  FOR SELECT USING (can_access_child(child_id));

CREATE POLICY "coparent_insert_own_children" ON academic_progress
  FOR INSERT WITH CHECK (can_access_child(child_id));

-- ─── Policies: portfolio_artifacts ───────────────────────────────────────────
CREATE POLICY "admin_full_access" ON portfolio_artifacts
  FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "coparent_read_own_children" ON portfolio_artifacts
  FOR SELECT USING (can_access_child(child_id));

CREATE POLICY "coparent_insert_own_children" ON portfolio_artifacts
  FOR INSERT WITH CHECK (can_access_child(child_id));

-- ─── Policies: curriculum_plans ──────────────────────────────────────────────
CREATE POLICY "admin_full_access" ON curriculum_plans
  FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "coparent_read_own_children" ON curriculum_plans
  FOR SELECT USING (can_access_child(child_id));

-- ─── Policies: compliance_filings ────────────────────────────────────────────
CREATE POLICY "admin_full_access" ON compliance_filings
  FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "coparent_read_own_children" ON compliance_filings
  FOR SELECT USING (
    child_id IS NULL  -- family-wide filings visible to all
    OR can_access_child(child_id)
  );

-- ─── Policies: handoff_digests ───────────────────────────────────────────────
CREATE POLICY "admin_full_access" ON handoff_digests
  FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "coparent_read_digests" ON handoff_digests
  FOR SELECT USING (get_user_role() = 'coparent');

-- ─── Policies: custody_schedule ──────────────────────────────────────────────
CREATE POLICY "admin_full_access" ON custody_schedule
  FOR ALL USING (get_user_role() = 'admin');

CREATE POLICY "coparent_read_schedule" ON custody_schedule
  FOR SELECT USING (get_user_role() = 'coparent');
