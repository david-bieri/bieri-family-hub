/**
 * server/routes/academic.ts
 * Homeschool Module — Academic API Routes
 *
 * CRUD endpoints for:
 *   - Academic subjects
 *   - Academic progress
 *   - Portfolio artifacts
 *   - Curriculum plans
 *   - Compliance filings
 *   - Custody schedule
 *   - Handoff digests
 *
 * All routes respect RLS via the Supabase client initialized with the
 * requesting user's JWT (passed in Authorization header).
 */

import type { Express, Request, Response } from "express";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { nanoid } from "nanoid";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

/**
 * Creates a Supabase client scoped to the requesting user's JWT.
 * This ensures RLS policies are enforced per-user.
 */
function getUserClient(req: Request): SupabaseClient {
  const token = req.headers.authorization?.replace("Bearer ", "");
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  });
}

export function registerAcademicRoutes(app: Express) {

  // ═══════════════════════════════════════════════════════════════════════════
  // ACADEMIC SUBJECTS
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/academic/subjects", async (req: Request, res: Response) => {
    const supabase = getUserClient(req);
    const { child_id } = req.query;

    let query = supabase.from("academic_subjects").select("*").order("name");
    if (child_id) query = query.eq("child_id", child_id as string);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.post("/api/academic/subjects", async (req: Request, res: Response) => {
    const supabase = getUserClient(req);
    const { child_id, name, platform, methodology, grade_level, notes } = req.body;

    const { data, error } = await supabase.from("academic_subjects").insert([{
      id: nanoid(),
      child_id,
      name,
      platform: platform || null,
      methodology: methodology || null,
      grade_level: grade_level || null,
      active: true,
      notes: notes || null,
    }]).select().single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.put("/api/academic/subjects/:id", async (req: Request, res: Response) => {
    const supabase = getUserClient(req);
    const { child_id, name, platform, methodology, grade_level, active, notes } = req.body;

    const { data, error } = await supabase.from("academic_subjects")
      .update({ child_id, name, platform, methodology, grade_level, active, notes })
      .eq("id", req.params.id).select().single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.delete("/api/academic/subjects/:id", async (req: Request, res: Response) => {
    const supabase = getUserClient(req);
    const { error } = await supabase.from("academic_subjects").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ACADEMIC PROGRESS
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/academic/progress", async (req: Request, res: Response) => {
    const supabase = getUserClient(req);
    const { child_id, subject_id, from_date, to_date, limit } = req.query;

    let query = supabase.from("academic_progress").select("*").order("date", { ascending: false });

    if (child_id) query = query.eq("child_id", child_id as string);
    if (subject_id) query = query.eq("subject_id", subject_id as string);
    if (from_date) query = query.gte("date", from_date as string);
    if (to_date) query = query.lte("date", to_date as string);
    if (limit) query = query.limit(parseInt(limit as string));

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.post("/api/academic/progress", async (req: Request, res: Response) => {
    const supabase = getUserClient(req);
    const {
      child_id, subject_id, date, household_id,
      duration_min, lessons_done, mastery_score, skills_mastered,
      source, source_ref, title, notes,
    } = req.body;

    const { data, error } = await supabase.from("academic_progress").insert([{
      id: nanoid(),
      child_id,
      subject_id: subject_id || null,
      date,
      household_id: household_id || null,
      duration_min: duration_min || null,
      lessons_done: lessons_done || null,
      mastery_score: mastery_score || null,
      skills_mastered: skills_mastered || null,
      source: source || "manual",
      source_ref: source_ref || null,
      title: title || null,
      notes: notes || null,
    }]).select().single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.put("/api/academic/progress/:id", async (req: Request, res: Response) => {
    const supabase = getUserClient(req);
    const {
      child_id, subject_id, date, household_id,
      duration_min, lessons_done, mastery_score, skills_mastered,
      source, source_ref, title, notes,
    } = req.body;

    const { data, error } = await supabase.from("academic_progress")
      .update({
        child_id, subject_id, date, household_id,
        duration_min, lessons_done, mastery_score, skills_mastered,
        source, source_ref, title, notes,
      })
      .eq("id", req.params.id).select().single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.delete("/api/academic/progress/:id", async (req: Request, res: Response) => {
    const supabase = getUserClient(req);
    const { error } = await supabase.from("academic_progress").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PORTFOLIO ARTIFACTS
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/academic/portfolio", async (req: Request, res: Response) => {
    const supabase = getUserClient(req);
    const { child_id, subject_id, artifact_type, limit } = req.query;

    let query = supabase.from("portfolio_artifacts").select("*").order("date", { ascending: false });

    if (child_id) query = query.eq("child_id", child_id as string);
    if (subject_id) query = query.eq("subject_id", subject_id as string);
    if (artifact_type) query = query.eq("artifact_type", artifact_type as string);
    if (limit) query = query.limit(parseInt(limit as string));

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.post("/api/academic/portfolio", async (req: Request, res: Response) => {
    const supabase = getUserClient(req);
    const {
      child_id, subject_id, date, household_id,
      title, description, artifact_type, file_url, file_name, file_size,
      tags, va_standard, source,
    } = req.body;

    const { data, error } = await supabase.from("portfolio_artifacts").insert([{
      id: nanoid(),
      child_id,
      subject_id: subject_id || null,
      date,
      household_id: household_id || null,
      title,
      description: description || null,
      artifact_type: artifact_type || "document",
      file_url: file_url || null,
      file_name: file_name || null,
      file_size: file_size || null,
      tags: tags || [],
      va_standard: va_standard || null,
      source: source || "manual",
    }]).select().single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.delete("/api/academic/portfolio/:id", async (req: Request, res: Response) => {
    const supabase = getUserClient(req);
    const { error } = await supabase.from("portfolio_artifacts").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CURRICULUM PLANS
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/academic/plans", async (req: Request, res: Response) => {
    const supabase = getUserClient(req);
    const { child_id, status, plan_type } = req.query;

    let query = supabase.from("curriculum_plans").select("*").order("start_date", { ascending: false });

    if (child_id) query = query.eq("child_id", child_id as string);
    if (status) query = query.eq("status", status as string);
    if (plan_type) query = query.eq("plan_type", plan_type as string);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.post("/api/academic/plans", async (req: Request, res: Response) => {
    const supabase = getUserClient(req);
    const {
      child_id, subject_id, plan_type, title,
      start_date, end_date, objectives, activities, resources,
      assessment, status, notes,
    } = req.body;

    const { data, error } = await supabase.from("curriculum_plans").insert([{
      id: nanoid(),
      child_id,
      subject_id: subject_id || null,
      plan_type: plan_type || "weekly",
      title,
      start_date: start_date || null,
      end_date: end_date || null,
      objectives: objectives || [],
      activities: activities || [],
      resources: resources || [],
      assessment: assessment || null,
      status: status || "planned",
      notes: notes || null,
    }]).select().single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.put("/api/academic/plans/:id", async (req: Request, res: Response) => {
    const supabase = getUserClient(req);
    const {
      child_id, subject_id, plan_type, title,
      start_date, end_date, objectives, activities, resources,
      assessment, status, notes,
    } = req.body;

    const { data, error } = await supabase.from("curriculum_plans")
      .update({
        child_id, subject_id, plan_type, title,
        start_date, end_date, objectives, activities, resources,
        assessment, status, notes,
      })
      .eq("id", req.params.id).select().single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.delete("/api/academic/plans/:id", async (req: Request, res: Response) => {
    const supabase = getUserClient(req);
    const { error } = await supabase.from("curriculum_plans").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPLIANCE FILINGS
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/academic/compliance", async (req: Request, res: Response) => {
    const supabase = getUserClient(req);
    const { school_year, filing_type } = req.query;

    let query = supabase.from("compliance_filings").select("*").order("due_date", { ascending: true });

    if (school_year) query = query.eq("school_year", school_year as string);
    if (filing_type) query = query.eq("filing_type", filing_type as string);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.post("/api/academic/compliance", async (req: Request, res: Response) => {
    const supabase = getUserClient(req);
    const {
      filing_type, child_id, school_year, title,
      filed_date, due_date, status, file_url, file_name, content, notes,
    } = req.body;

    const { data, error } = await supabase.from("compliance_filings").insert([{
      id: nanoid(),
      filing_type,
      child_id: child_id || null,
      school_year,
      title,
      filed_date: filed_date || null,
      due_date: due_date || null,
      status: status || "draft",
      file_url: file_url || null,
      file_name: file_name || null,
      content: content || null,
      notes: notes || null,
    }]).select().single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.put("/api/academic/compliance/:id", async (req: Request, res: Response) => {
    const supabase = getUserClient(req);
    const {
      filing_type, child_id, school_year, title,
      filed_date, due_date, status, file_url, file_name, content, notes,
    } = req.body;

    const { data, error } = await supabase.from("compliance_filings")
      .update({
        filing_type, child_id, school_year, title,
        filed_date, due_date, status, file_url, file_name, content, notes,
      })
      .eq("id", req.params.id).select().single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CUSTODY SCHEDULE
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/academic/custody", async (req: Request, res: Response) => {
    const supabase = getUserClient(req);
    const { from_date, to_date } = req.query;

    let query = supabase.from("custody_schedule").select("*").order("week_start", { ascending: true });

    if (from_date) query = query.gte("week_start", from_date as string);
    if (to_date) query = query.lte("week_start", to_date as string);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.post("/api/academic/custody", async (req: Request, res: Response) => {
    const supabase = getUserClient(req);
    const { week_start, household_id, child_ids, notes } = req.body;

    const { data, error } = await supabase.from("custody_schedule").insert([{
      id: nanoid(),
      week_start,
      household_id,
      child_ids: child_ids || ["cole", "airlie"],
      notes: notes || null,
    }]).select().single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // HANDOFF DIGESTS
  // ═══════════════════════════════════════════════════════════════════════════

  app.get("/api/academic/handoffs", async (req: Request, res: Response) => {
    const supabase = getUserClient(req);
    const { limit } = req.query;

    let query = supabase.from("handoff_digests").select("*").order("week_start", { ascending: false });
    if (limit) query = query.limit(parseInt(limit as string));

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.post("/api/academic/handoffs/generate", async (req: Request, res: Response) => {
    // This endpoint triggers generation of a handoff digest for the current week.
    // It queries academic_progress and portfolio_artifacts for Cole & Airlie,
    // then uses the LLM to generate a summary.
    const supabase = getUserClient(req);
    const { week_start, from_household, to_household } = req.body;

    // 1. Fetch progress for Cole & Airlie this week
    const { data: progress } = await supabase
      .from("academic_progress")
      .select("*")
      .in("child_id", ["cole", "airlie"])
      .gte("date", week_start)
      .order("date");

    // 2. Fetch portfolio artifacts this week
    const { data: artifacts } = await supabase
      .from("portfolio_artifacts")
      .select("*")
      .in("child_id", ["cole", "airlie"])
      .gte("date", week_start)
      .order("date");

    // 3. Generate summary via LLM (Perplexity Sonar or OpenAI)
    const summaryText = await generateHandoffSummary(progress || [], artifacts || [], week_start);

    // 4. Store the digest
    const { data, error } = await supabase.from("handoff_digests").insert([{
      id: nanoid(),
      week_start,
      from_household: from_household || "hh-bieri",
      to_household: to_household || "hh-coparent",
      child_ids: ["cole", "airlie"],
      summary_text: summaryText,
      progress_data: { progress, artifacts },
    }]).select().single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });
}

// ─── LLM Summary Generation ─────────────────────────────────────────────────

async function generateHandoffSummary(
  progress: any[],
  artifacts: any[],
  weekStart: string
): Promise<string> {
  const prompt = `You are a helpful assistant for a homeschooling family. Generate a concise, warm weekly academic summary for a custody handoff.

Week starting: ${weekStart}
Children: Cole (age 14) and Airlie (age 11)

PROGRESS ENTRIES THIS WEEK:
${JSON.stringify(progress, null, 2)}

PORTFOLIO ARTIFACTS THIS WEEK:
${JSON.stringify(artifacts, null, 2)}

Write a brief Markdown summary (3-5 paragraphs) covering:
1. What each child accomplished this week (subjects, key milestones)
2. Any areas that need continued attention next week
3. Upcoming plans or assignments to be aware of

Keep the tone collaborative and positive. Use bullet points for specific items.`;

  try {
    // Try Perplexity Sonar first (matches main hub pattern)
    const perplexityKey = process.env.PERPLEXITY_API_KEY;
    if (perplexityKey) {
      const response = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${perplexityKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "sonar",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 1000,
        }),
      });
      const result = await response.json();
      return result.choices?.[0]?.message?.content || fallbackSummary(progress, artifacts, weekStart);
    }

    // Fallback to OpenAI if available
    const openaiKey = process.env.OPENAI_API_KEY;
    const openaiBase = process.env.OPENAI_API_BASE || "https://api.openai.com/v1";
    if (openaiKey) {
      const response = await fetch(`${openaiBase}/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 1000,
        }),
      });
      const result = await response.json();
      return result.choices?.[0]?.message?.content || fallbackSummary(progress, artifacts, weekStart);
    }

    return fallbackSummary(progress, artifacts, weekStart);
  } catch (err) {
    console.error("[handoff] LLM generation failed:", err);
    return fallbackSummary(progress, artifacts, weekStart);
  }
}

function fallbackSummary(progress: any[], artifacts: any[], weekStart: string): string {
  const coleProgress = progress.filter(p => p.child_id === "cole");
  const airlieProgress = progress.filter(p => p.child_id === "airlie");

  return `## Weekly Academic Summary — Week of ${weekStart}

### Cole
- ${coleProgress.length} progress entries logged
${coleProgress.map(p => `- ${p.title || p.subject_id || "Activity"}: ${p.notes || ""}`).join("\n")}

### Airlie
- ${airlieProgress.length} progress entries logged
${airlieProgress.map(p => `- ${p.title || p.subject_id || "Activity"}: ${p.notes || ""}`).join("\n")}

### Portfolio
- ${artifacts.length} artifact(s) uploaded this week

---
*Auto-generated summary (LLM unavailable)*`;
}
