-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 002: Seed Custody Schedule 2026, Holiday Alternation Rules,
--                and Special Event Markers (Birthdays, Anniversary)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 1. Ensure Households Exist ──────────────────────────────────────────────
INSERT INTO households (id, name, type, address, notes) VALUES
  ('hh-bieri', 'Bieri Household', 'primary', NULL, 'David & Nancy Bieri'),
  ('hh-coparent', 'Harder Household', 'coparent', NULL, 'James Harder')
ON CONFLICT (id) DO NOTHING;

-- ─── 2. Seed Custody Schedule 2026 ──────────────────────────────────────────
-- Each row represents a custody block (start_date to end_date).
-- The schedule is NOT strictly alternating weeks — it has holiday adjustments.

-- First, clear any existing 2026 data to allow re-running
DELETE FROM custody_schedule WHERE week_start >= '2026-01-01' AND week_start <= '2026-12-31';

INSERT INTO custody_schedule (id, week_start, household_id, child_ids, notes) VALUES
  -- JANUARY
  ('cs-2026-01a', '2026-01-01', 'hh-bieri', '["cole","airlie"]', 'Rest of 2025 holiday break (Jan 1-6)'),
  ('cs-2026-01b', '2026-01-07', 'hh-coparent', '["cole","airlie"]', 'Jan 7-11'),
  ('cs-2026-01c', '2026-01-12', 'hh-bieri', '["cole","airlie"]', 'Jan 12-18'),
  ('cs-2026-01d', '2026-01-19', 'hh-coparent', '["cole","airlie"]', 'Jan 19-25'),
  ('cs-2026-01e', '2026-01-26', 'hh-bieri', '["cole","airlie"]', 'Jan 26 - Feb 1'),
  -- FEBRUARY
  ('cs-2026-02a', '2026-02-02', 'hh-coparent', '["cole","airlie"]', 'Feb 2-8'),
  ('cs-2026-02b', '2026-02-09', 'hh-bieri', '["cole","airlie"]', 'Feb 9-15'),
  ('cs-2026-02c', '2026-02-16', 'hh-coparent', '["cole","airlie"]', 'Feb 16-22'),
  ('cs-2026-02d', '2026-02-23', 'hh-bieri', '["cole","airlie"]', 'Feb 23 - Mar 1'),
  -- MARCH
  ('cs-2026-03a', '2026-03-02', 'hh-coparent', '["cole","airlie"]', 'Mar 2-8'),
  ('cs-2026-03b', '2026-03-09', 'hh-bieri', '["cole","airlie"]', 'Mar 9-15'),
  ('cs-2026-03c', '2026-03-16', 'hh-coparent', '["cole","airlie"]', 'Mar 16-22'),
  ('cs-2026-03d', '2026-03-23', 'hh-bieri', '["cole","airlie"]', 'Mar 23-29'),
  ('cs-2026-03e', '2026-03-30', 'hh-coparent', '["cole","airlie"]', 'Mar 30-31'),
  -- APRIL (Easter block: Bieri gets 5 extra nights)
  ('cs-2026-04a', '2026-04-01', 'hh-bieri', '["cole","airlie"]', 'Apr 1-12 (5 extra Easter nights — Easter always Bieri)'),
  ('cs-2026-04b', '2026-04-13', 'hh-coparent', '["cole","airlie"]', 'Apr 13-19'),
  ('cs-2026-04c', '2026-04-20', 'hh-bieri', '["cole","airlie"]', 'Apr 20-26'),
  ('cs-2026-04d', '2026-04-27', 'hh-coparent', '["cole","airlie"]', 'Apr 27 - May 3'),
  -- MAY
  ('cs-2026-05a', '2026-05-04', 'hh-bieri', '["cole","airlie"]', 'May 4-10'),
  ('cs-2026-05b', '2026-05-11', 'hh-coparent', '["cole","airlie"]', 'May 11-17'),
  ('cs-2026-05c', '2026-05-18', 'hh-bieri', '["cole","airlie"]', 'May 18-21'),
  ('cs-2026-05d', '2026-05-22', 'hh-coparent', '["cole","airlie"]', 'May 22-31 (travel week May 23-30)'),
  -- JUNE
  ('cs-2026-06a', '2026-06-01', 'hh-bieri', '["cole","airlie"]', 'Jun 1-7'),
  ('cs-2026-06b', '2026-06-08', 'hh-coparent', '["cole","airlie"]', 'Jun 8-14'),
  ('cs-2026-06c', '2026-06-15', 'hh-bieri', '["cole","airlie"]', 'Jun 15-21'),
  ('cs-2026-06d', '2026-06-22', 'hh-coparent', '["cole","airlie"]', 'Jun 22-28'),
  ('cs-2026-06e', '2026-06-29', 'hh-bieri', '["cole","airlie"]', 'Jun 29 - Jul 5'),
  -- JULY
  ('cs-2026-07a', '2026-07-06', 'hh-coparent', '["cole","airlie"]', 'Jul 6-12'),
  ('cs-2026-07b', '2026-07-13', 'hh-bieri', '["cole","airlie"]', 'Jul 13-19'),
  ('cs-2026-07c', '2026-07-20', 'hh-coparent', '["cole","airlie"]', 'Jul 20-26'),
  ('cs-2026-07d', '2026-07-27', 'hh-bieri', '["cole","airlie"]', 'Jul 27 - Aug 2'),
  -- AUGUST
  ('cs-2026-08a', '2026-08-03', 'hh-coparent', '["cole","airlie"]', 'Aug 3-9'),
  ('cs-2026-08b', '2026-08-10', 'hh-bieri', '["cole","airlie"]', 'Aug 10-16'),
  ('cs-2026-08c', '2026-08-17', 'hh-coparent', '["cole","airlie"]', 'Aug 17-23'),
  ('cs-2026-08d', '2026-08-24', 'hh-bieri', '["cole","airlie"]', 'Aug 24-30'),
  -- SEPTEMBER
  ('cs-2026-09a', '2026-08-31', 'hh-coparent', '["cole","airlie"]', 'Aug 31 - Sep 6'),
  ('cs-2026-09b', '2026-09-07', 'hh-bieri', '["cole","airlie"]', 'Sep 7-13 (includes Labor Day)'),
  ('cs-2026-09c', '2026-09-14', 'hh-coparent', '["cole","airlie"]', 'Sep 14-20'),
  ('cs-2026-09d', '2026-09-21', 'hh-bieri', '["cole","airlie"]', 'Sep 21-27'),
  ('cs-2026-09e', '2026-09-28', 'hh-coparent', '["cole","airlie"]', 'Sep 28 - Oct 4'),
  -- OCTOBER
  ('cs-2026-10a', '2026-10-05', 'hh-bieri', '["cole","airlie"]', 'Oct 5-11'),
  ('cs-2026-10b', '2026-10-12', 'hh-coparent', '["cole","airlie"]', 'Oct 12-18'),
  ('cs-2026-10c', '2026-10-19', 'hh-bieri', '["cole","airlie"]', 'Oct 19-25'),
  ('cs-2026-10d', '2026-10-26', 'hh-coparent', '["cole","airlie"]', 'Oct 26 - Nov 1 (includes Halloween)'),
  -- NOVEMBER
  ('cs-2026-11a', '2026-11-02', 'hh-bieri', '["cole","airlie"]', 'Nov 2-8'),
  ('cs-2026-11b', '2026-11-09', 'hh-coparent', '["cole","airlie"]', 'Nov 9-15'),
  ('cs-2026-11c', '2026-11-16', 'hh-bieri', '["cole","airlie"]', 'Nov 16-19'),
  ('cs-2026-11d', '2026-11-20', 'hh-coparent', '["cole","airlie"]', 'Nov 20-29 (includes Thanksgiving)'),
  ('cs-2026-11e', '2026-11-30', 'hh-bieri', '["cole","airlie"]', 'Nov 30 - Dec 6'),
  -- DECEMBER
  ('cs-2026-12a', '2026-12-07', 'hh-coparent', '["cole","airlie"]', 'Dec 7-16 (includes requested makeup block)'),
  ('cs-2026-12b', '2026-12-17', 'hh-bieri', '["cole","airlie"]', 'Dec 17-27 (Christmas year, 27th is estimate)'),
  ('cs-2026-12c', '2026-12-28', 'hh-coparent', '["cole","airlie"]', 'Dec 28-31');

-- ─── 3. Holiday Alternation Rules ───────────────────────────────────────────
-- New table to track which household gets each holiday per year.
-- Rule: whoever has it this year, the other household gets it next year.
-- Exception: Easter is ALWAYS Bieri.

CREATE TABLE IF NOT EXISTS custody_holiday_rules (
  id              TEXT PRIMARY KEY,
  holiday_name    TEXT NOT NULL,
  year            INTEGER NOT NULL,
  household_id    TEXT NOT NULL REFERENCES households(id),
  fixed           BOOLEAN DEFAULT FALSE,  -- TRUE = never alternates (e.g., Easter)
  date_rule       TEXT,                    -- e.g., 'easter', 'fourth_thursday_nov', 'fixed:12-25'
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(holiday_name, year)
);

-- Seed 2026 holiday assignments (from the schedule)
INSERT INTO custody_holiday_rules (id, holiday_name, year, household_id, fixed, date_rule, notes) VALUES
  ('hr-2026-newyear',      'New Year''s Day',    2026, 'hh-bieri',    FALSE, 'fixed:01-01', 'Bieri has Jan 1-6'),
  ('hr-2026-easter',       'Easter',             2026, 'hh-bieri',    TRUE,  'easter',      'ALWAYS Bieri household'),
  ('hr-2026-mothersday',   'Mother''s Day',      2026, 'hh-bieri',    FALSE, 'second_sunday_may', 'May 10 falls in Bieri week'),
  ('hr-2026-memorial',     'Memorial Day',       2026, 'hh-coparent', FALSE, 'last_monday_may', 'May 25 falls in James travel week'),
  ('hr-2026-july4',        'Independence Day',   2026, 'hh-bieri',    FALSE, 'fixed:07-04', 'Jul 4 falls in Bieri week (Jun 29-Jul 5)'),
  ('hr-2026-laborday',     'Labor Day',          2026, 'hh-bieri',    FALSE, 'first_monday_sep', 'Sep 7 falls in Bieri week'),
  ('hr-2026-halloween',    'Halloween',          2026, 'hh-coparent', FALSE, 'fixed:10-31', 'Oct 26-Nov 1 is James (includes Halloween)'),
  ('hr-2026-thanksgiving', 'Thanksgiving',       2026, 'hh-coparent', FALSE, 'fourth_thursday_nov', 'Nov 20-29 is James (includes Thanksgiving)'),
  ('hr-2026-christmas',    'Christmas',          2026, 'hh-bieri',    FALSE, 'fixed:12-25', 'Dec 17-27 is Bieri (Christmas year)'),
  ('hr-2026-newyearseve',  'New Year''s Eve',    2026, 'hh-coparent', FALSE, 'fixed:12-31', 'Dec 28-31 is James');

-- Pre-seed 2027 alternated assignments (auto-generated from 2026 rules)
INSERT INTO custody_holiday_rules (id, holiday_name, year, household_id, fixed, date_rule, notes) VALUES
  ('hr-2027-newyear',      'New Year''s Day',    2027, 'hh-coparent', FALSE, 'fixed:01-01', 'Alternated from 2026 Bieri'),
  ('hr-2027-easter',       'Easter',             2027, 'hh-bieri',    TRUE,  'easter',      'ALWAYS Bieri household'),
  ('hr-2027-mothersday',   'Mother''s Day',      2027, 'hh-coparent', FALSE, 'second_sunday_may', 'Alternated from 2026 Bieri'),
  ('hr-2027-memorial',     'Memorial Day',       2027, 'hh-bieri',    FALSE, 'last_monday_may', 'Alternated from 2026 James'),
  ('hr-2027-july4',        'Independence Day',   2027, 'hh-coparent', FALSE, 'fixed:07-04', 'Alternated from 2026 Bieri'),
  ('hr-2027-laborday',     'Labor Day',          2027, 'hh-coparent', FALSE, 'first_monday_sep', 'Alternated from 2026 Bieri'),
  ('hr-2027-halloween',    'Halloween',          2027, 'hh-bieri',    FALSE, 'fixed:10-31', 'Alternated from 2026 James'),
  ('hr-2027-thanksgiving', 'Thanksgiving',       2027, 'hh-bieri',    FALSE, 'fourth_thursday_nov', 'Alternated from 2026 James'),
  ('hr-2027-christmas',    'Christmas',          2027, 'hh-coparent', FALSE, 'fixed:12-25', 'Alternated from 2026 Bieri'),
  ('hr-2027-newyearseve',  'New Year''s Eve',    2027, 'hh-bieri',    FALSE, 'fixed:12-31', 'Alternated from 2026 James');

-- ─── 4. Special Event Markers (Birthdays, Anniversary) ──────────────────────
-- These go into the main events table as recurring yearly events.

-- Note: The events table recurrence_type only supports 'daily'|'weekly' currently.
-- For yearly events (birthdays, anniversary), we insert them as non-recurring
-- and rely on the calendar expansion logic to regenerate them each year.
-- A future migration can add 'yearly' recurrence_type support.

-- 2026 instances
INSERT INTO events (id, title, date, time, child_ids, category, notes, recurring, is_template) VALUES
  ('evt-bday-david-2026',  'David''s Birthday',       '2026-10-25', NULL, '[]', 'family', 'David Bieri birthday — yearly', FALSE, FALSE),
  ('evt-bday-nancy-2026',  'Nancy''s Birthday',       '2026-12-23', NULL, '[]', 'family', 'Nancy Bieri birthday — yearly', FALSE, FALSE),
  ('evt-anniversary-2026', 'Wedding Anniversary',     '2026-04-25', NULL, '[]', 'family', 'David & Nancy wedding anniversary — yearly', FALSE, FALSE),
  -- 2027 instances
  ('evt-bday-david-2027',  'David''s Birthday',       '2027-10-25', NULL, '[]', 'family', 'David Bieri birthday — yearly', FALSE, FALSE),
  ('evt-bday-nancy-2027',  'Nancy''s Birthday',       '2027-12-23', NULL, '[]', 'family', 'Nancy Bieri birthday — yearly', FALSE, FALSE),
  ('evt-anniversary-2027', 'Wedding Anniversary',     '2027-04-25', NULL, '[]', 'family', 'David & Nancy wedding anniversary — yearly', FALSE, FALSE)
ON CONFLICT (id) DO NOTHING;

-- Also create a special_events table for recurring annual markers
-- This is the source of truth; a scheduled job can generate event instances yearly.
CREATE TABLE IF NOT EXISTS special_events (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  month       INTEGER NOT NULL,  -- 1-12
  day         INTEGER NOT NULL,  -- 1-31
  category    TEXT DEFAULT 'family',  -- 'birthday' | 'anniversary' | 'family'
  person      TEXT,              -- who it's for
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO special_events (id, title, month, day, category, person, notes) VALUES
  ('se-bday-david',    'David''s Birthday',       10, 25, 'birthday',    'David Bieri', NULL),
  ('se-bday-nancy',    'Nancy''s Birthday',       12, 23, 'birthday',    'Nancy Bieri', NULL),
  ('se-anniversary',   'Wedding Anniversary',     4,  25, 'anniversary', 'David & Nancy', 'Married 2025')
ON CONFLICT (id) DO NOTHING;

-- ─── 5. RLS Policy for custody_holiday_rules ─────────────────────────────────
ALTER TABLE custody_holiday_rules ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read holiday rules (both households need to see them)
CREATE POLICY "holiday_rules_read" ON custody_holiday_rules
  FOR SELECT USING (true);

-- Only primary household (admin) can modify
CREATE POLICY "holiday_rules_admin_write" ON custody_holiday_rules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM hub_users
      WHERE hub_users.id = auth.uid()::text
      AND hub_users.role IN ('admin', 'parent')
    )
  );
