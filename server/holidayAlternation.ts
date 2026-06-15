/**
 * server/holidayAlternation.ts
 * Holiday Alternation Engine
 *
 * Rules:
 *   - Each holiday alternates between households yearly
 *   - Exception: Easter is ALWAYS Bieri household
 *   - If a holiday assignment for a given year doesn't exist in the DB,
 *     it is computed by looking at the previous year and flipping
 *
 * This module provides:
 *   1. getHolidayAssignment(holiday, year) — returns which household has it
 *   2. generateNextYearHolidays() — auto-generates next year's assignments
 *   3. getHolidayDate(holiday, year) — computes the actual date for a holiday
 */

import { createClient } from "@supabase/supabase-js";
import ws from "ws";
import { nanoid } from "nanoid";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey, { realtime: { transport: ws } });

// ─── Holiday Date Computation ────────────────────────────────────────────────

/**
 * Compute Easter Sunday for a given year (Anonymous Gregorian algorithm)
 */
function computeEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/**
 * Get the Nth occurrence of a weekday in a month.
 * weekday: 0=Sunday, 1=Monday, ..., 6=Saturday
 */
function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  const first = new Date(year, month - 1, 1);
  const firstWeekday = first.getDay();
  let day = 1 + ((weekday - firstWeekday + 7) % 7) + (n - 1) * 7;
  return new Date(year, month - 1, day);
}

/**
 * Get the last occurrence of a weekday in a month.
 */
function lastWeekdayOfMonth(year: number, month: number, weekday: number): Date {
  const lastDay = new Date(year, month, 0); // last day of month
  const diff = (lastDay.getDay() - weekday + 7) % 7;
  return new Date(year, month - 1, lastDay.getDate() - diff);
}

/**
 * Compute the actual date for a holiday in a given year.
 */
export function getHolidayDate(dateRule: string, year: number): string {
  let d: Date;

  switch (dateRule) {
    case 'fixed:01-01':
      d = new Date(year, 0, 1);
      break;
    case 'easter':
      d = computeEaster(year);
      break;
    case 'second_sunday_may':
      d = nthWeekdayOfMonth(year, 5, 0, 2); // Mother's Day
      break;
    case 'last_monday_may':
      d = lastWeekdayOfMonth(year, 5, 1); // Memorial Day
      break;
    case 'fixed:07-04':
      d = new Date(year, 6, 4);
      break;
    case 'first_monday_sep':
      d = nthWeekdayOfMonth(year, 9, 1, 1); // Labor Day
      break;
    case 'fixed:10-31':
      d = new Date(year, 9, 31);
      break;
    case 'fourth_thursday_nov':
      d = nthWeekdayOfMonth(year, 11, 4, 4); // Thanksgiving
      break;
    case 'fixed:12-25':
      d = new Date(year, 11, 25);
      break;
    case 'fixed:12-31':
      d = new Date(year, 11, 31);
      break;
    default:
      // Try to parse as fixed:MM-DD
      const match = dateRule.match(/^fixed:(\d{2})-(\d{2})$/);
      if (match) {
        d = new Date(year, parseInt(match[1]) - 1, parseInt(match[2]));
      } else {
        return `${year}-01-01`; // fallback
      }
  }

  return d.toISOString().split('T')[0];
}

// ─── Holiday Assignment Logic ────────────────────────────────────────────────

/**
 * Get which household has a specific holiday in a given year.
 * First checks the database; if not found, computes by alternating from
 * the most recent known year.
 */
export async function getHolidayAssignment(
  holidayName: string,
  year: number
): Promise<{ household_id: string; fixed: boolean }> {
  // Check DB first
  const { data } = await supabase
    .from("custody_holiday_rules")
    .select("household_id, fixed")
    .eq("holiday_name", holidayName)
    .eq("year", year)
    .single();

  if (data) {
    return { household_id: data.household_id, fixed: data.fixed };
  }

  // Not in DB — find the most recent year we have data for
  const { data: recent } = await supabase
    .from("custody_holiday_rules")
    .select("household_id, fixed, year")
    .eq("holiday_name", holidayName)
    .order("year", { ascending: false })
    .limit(1)
    .single();

  if (!recent) {
    // No data at all — default to Bieri
    return { household_id: 'hh-bieri', fixed: false };
  }

  // If fixed (e.g., Easter), always same household
  if (recent.fixed) {
    return { household_id: recent.household_id, fixed: true };
  }

  // Alternate based on year difference
  const yearDiff = year - recent.year;
  const shouldFlip = yearDiff % 2 !== 0;
  const household_id = shouldFlip
    ? (recent.household_id === 'hh-bieri' ? 'hh-coparent' : 'hh-bieri')
    : recent.household_id;

  return { household_id, fixed: false };
}

/**
 * Generate holiday assignments for the next year and insert into DB.
 * Call this once per year (e.g., in November) to pre-populate next year.
 */
export async function generateNextYearHolidays(targetYear?: number): Promise<void> {
  const year = targetYear || new Date().getFullYear() + 1;

  // Get all holidays from the most recent year
  const { data: currentRules } = await supabase
    .from("custody_holiday_rules")
    .select("*")
    .eq("year", year - 1);

  if (!currentRules || currentRules.length === 0) {
    console.log(`[holidays] No rules found for ${year - 1}, cannot generate ${year}`);
    return;
  }

  const inserts = currentRules.map(rule => ({
    id: `hr-${year}-${rule.holiday_name.toLowerCase().replace(/[^a-z]/g, '')}`,
    holiday_name: rule.holiday_name,
    year,
    household_id: rule.fixed
      ? rule.household_id  // Fixed holidays don't alternate
      : (rule.household_id === 'hh-bieri' ? 'hh-coparent' : 'hh-bieri'),
    fixed: rule.fixed,
    date_rule: rule.date_rule,
    notes: rule.fixed
      ? rule.notes
      : `Alternated from ${year - 1} ${rule.household_id === 'hh-bieri' ? 'Bieri' : 'James'}`,
  }));

  const { error } = await supabase
    .from("custody_holiday_rules")
    .upsert(inserts, { onConflict: 'holiday_name,year' });

  if (error) {
    console.error(`[holidays] Failed to generate ${year} rules:`, error.message);
  } else {
    console.log(`[holidays] Generated ${inserts.length} holiday rules for ${year}`);
  }
}

// ─── API Route Registration ──────────────────────────────────────────────────

import type { Express } from "express";

export function registerHolidayRoutes(app: Express) {
  // GET /api/custody/holidays?year=2026
  app.get("/api/custody/holidays", async (req, res) => {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const { data, error } = await supabase
      .from("custody_holiday_rules")
      .select("*")
      .eq("year", year)
      .order("holiday_name");

    if (error) return res.status(500).json({ error: error.message });

    // Enrich with computed dates
    const enriched = (data || []).map(rule => ({
      ...rule,
      computed_date: getHolidayDate(rule.date_rule, year),
    }));

    res.json(enriched);
  });

  // GET /api/custody/schedule?year=2026
  app.get("/api/custody/schedule", async (req, res) => {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const { data, error } = await supabase
      .from("custody_schedule")
      .select("*")
      .gte("week_start", startDate)
      .lte("week_start", endDate)
      .order("week_start");

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  // GET /api/custody/current — who has the kids right now?
  app.get("/api/custody/current", async (req, res) => {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from("custody_schedule")
      .select("*")
      .lte("week_start", today)
      .order("week_start", { ascending: false })
      .limit(1)
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  // GET /api/special-events — recurring annual markers
  app.get("/api/special-events", async (_req, res) => {
    const { data, error } = await supabase
      .from("special_events")
      .select("*")
      .order("month, day");

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  // POST /api/special-events — add a new special event
  app.post("/api/special-events", async (req, res) => {
    const { title, month, day, category, person, notes } = req.body;
    const id = `se-${nanoid(8)}`;
    const { data, error } = await supabase
      .from("special_events")
      .insert([{ id, title, month, day, category: category || 'family', person, notes }])
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  // POST /api/custody/holidays/generate — generate next year's holiday rules
  app.post("/api/custody/holidays/generate", async (req, res) => {
    const year = parseInt(req.body.year) || new Date().getFullYear() + 1;
    try {
      await generateNextYearHolidays(year);
      res.json({ ok: true, year, message: `Holiday rules generated for ${year}` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}
