import type { Express } from "express";
import type { Server } from "http";
import { createClient } from "@supabase/supabase-js";
import { nanoid } from "nanoid";
import ws from "ws";
import { extractFromEmail } from "./emailExtractor";


const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
  { realtime: { transport: ws } }
);

const APP_PASSWORD = process.env.APP_PASSWORD || "bieri2026";

export async function registerRoutes(httpServer: Server, app: Express) {

  // ─── AUTH ─────────────────────────────────────────────────────────────────
  app.post("/api/auth/login", (req, res) => {
    const { password } = req.body;
    if (password === APP_PASSWORD) {
      res.json({ ok: true, token: Buffer.from(APP_PASSWORD).toString("base64") });
    } else {
      res.status(401).json({ ok: false, error: "Wrong password" });
    }
  });

  // ─── EVENTS ───────────────────────────────────────────────────────────────
  app.get("/api/events", async (_req, res) => {
    const { data, error } = await supabase
      .from("events").select("*").order("date", { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.post("/api/events", async (req, res) => {
    const id = nanoid();
    const { title, date, time, end_time, child_ids, category, notes, recurring } = req.body;
    const { data, error } = await supabase.from("events").insert([
      { id, title, date, time, end_time, child_ids: child_ids || [], category: category || "other", notes, recurring: recurring || false }
    ]).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.put("/api/events/:id", async (req, res) => {
    const { title, date, time, end_time, child_ids, category, notes, recurring } = req.body;
    const { data, error } = await supabase.from("events")
      .update({ title, date, time, end_time, child_ids: child_ids || [], category, notes, recurring })
      .eq("id", req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.delete("/api/events/:id", async (req, res) => {
    const { error } = await supabase.from("events").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  });

  // ─── VACCINES ─────────────────────────────────────────────────────────────
  app.get("/api/vaccines", async (_req, res) => {
    const { data, error } = await supabase
      .from("vaccines").select("*").order("date_given", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.post("/api/vaccines", async (req, res) => {
    const id = nanoid();
    const { child_id, name, date_given, next_due, provider, notes } = req.body;
    const { data, error } = await supabase.from("vaccines").insert([
      { id, child_id, name, date_given, next_due, provider, notes }
    ]).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.put("/api/vaccines/:id", async (req, res) => {
    const { child_id, name, date_given, next_due, provider, notes } = req.body;
    const { data, error } = await supabase.from("vaccines")
      .update({ child_id, name, date_given, next_due, provider, notes })
      .eq("id", req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.delete("/api/vaccines/:id", async (req, res) => {
    const { error } = await supabase.from("vaccines").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  });

  // ─── MEDICAL APPOINTMENTS ─────────────────────────────────────────────────
  app.get("/api/appointments", async (_req, res) => {
    const { data, error } = await supabase
      .from("medical_appointments").select("*").order("date", { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.post("/api/appointments", async (req, res) => {
    const id = nanoid();
    const { child_id, type, provider, date, time, notes, completed } = req.body;
    const { data, error } = await supabase.from("medical_appointments").insert([
      { id, child_id, type: type || "routine", provider, date, time, notes, completed: completed || false }
    ]).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.put("/api/appointments/:id", async (req, res) => {
    const { child_id, type, provider, date, time, notes, completed } = req.body;
    const { data, error } = await supabase.from("medical_appointments")
      .update({ child_id, type, provider, date, time, notes, completed })
      .eq("id", req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.delete("/api/appointments/:id", async (req, res) => {
    const { error } = await supabase.from("medical_appointments").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  });

  // ─── SPORTS ───────────────────────────────────────────────────────────────
  app.get("/api/sports", async (_req, res) => {
    const { data, error } = await supabase
      .from("sports").select("*").order("sport_name", { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.post("/api/sports", async (req, res) => {
    const id = nanoid();
    const { child_id, sport_name, team, coach, season, days, time, location, notes, active } = req.body;
    const { data, error } = await supabase.from("sports").insert([
      { id, child_id, sport_name, team, coach, season, days, time, location, notes, active: active !== false }
    ]).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.put("/api/sports/:id", async (req, res) => {
    const { child_id, sport_name, team, coach, season, days, time, location, notes, active } = req.body;
    const { data, error } = await supabase.from("sports")
      .update({ child_id, sport_name, team, coach, season, days, time, location, notes, active })
      .eq("id", req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.delete("/api/sports/:id", async (req, res) => {
    const { error } = await supabase.from("sports").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  });

  // ─── REGISTRATIONS ────────────────────────────────────────────────────────
  app.get("/api/registrations", async (_req, res) => {
    const { data, error } = await supabase
      .from("registrations").select("*").order("deadline", { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.post("/api/registrations", async (req, res) => {
    const id = nanoid();
    const { child_id, program_name, type, start_date, end_date, deadline, status, cost, deposit_paid, documents_needed, notes, url } = req.body;
    const { data, error } = await supabase.from("registrations").insert([
      { id, child_id, program_name, type: type || "camp", start_date, end_date, deadline, status: status || "not_started", cost, deposit_paid: deposit_paid || false, documents_needed: documents_needed || [], notes, url }
    ]).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.put("/api/registrations/:id", async (req, res) => {
    const { child_id, program_name, type, start_date, end_date, deadline, status, cost, deposit_paid, documents_needed, notes, url } = req.body;
    const { data, error } = await supabase.from("registrations")
      .update({ child_id, program_name, type, start_date, end_date, deadline, status, cost, deposit_paid, documents_needed, notes, url })
      .eq("id", req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.delete("/api/registrations/:id", async (req, res) => {
    const { error } = await supabase.from("registrations").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  });

  // ─── PAYMENTS ─────────────────────────────────────────────────────────────
  app.get("/api/payments", async (_req, res) => {
    const { data, error } = await supabase
      .from("payments").select("*").order("due_date", { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.post("/api/payments", async (req, res) => {
    const id = nanoid();
    const { description, child_id, category, amount, due_date, paid_date, status, payee, notes } = req.body;
    const { data, error } = await supabase.from("payments").insert([
      { id, description, child_id, category: category || "other", amount, due_date, paid_date, status: status || "pending", payee, notes }
    ]).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.put("/api/payments/:id", async (req, res) => {
    const { description, child_id, category, amount, due_date, paid_date, status, payee, notes } = req.body;
    const { data, error } = await supabase.from("payments")
      .update({ description, child_id, category, amount, due_date, paid_date, status, payee, notes })
      .eq("id", req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.delete("/api/payments/:id", async (req, res) => {
    const { error } = await supabase.from("payments").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  });

  // ─── CATEGORIES ───────────────────────────────────────────────────────────
  app.get("/api/categories", async (_req, res) => {
    const { data, error } = await supabase
      .from("categories").select("*").order("name", { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.post("/api/categories", async (req, res) => {
    const id = nanoid();
    const { name, color, icon } = req.body;
    const { data, error } = await supabase.from("categories").insert([
      { id, name, color: color || "#6366f1", icon: icon || "Circle" }
    ]).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.put("/api/categories/:id", async (req, res) => {
    const { name, color, icon } = req.body;
    const { data, error } = await supabase.from("categories")
      .update({ name, color, icon })
      .eq("id", req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.delete("/api/categories/:id", async (req, res) => {
    // Prevent deleting built-in categories
    const builtIn = ["school","sports","medical","camp","family","payment","other"];
    if (builtIn.includes(req.params.id)) {
      return res.status(400).json({ error: "Cannot delete built-in categories" });
    }
    const { error } = await supabase.from("categories").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  });

  // ─── PETS ──────────────────────────────────────────────────────────────────
  app.get("/api/pets", async (_req, res) => {
    const { data, error } = await supabase.from("pets").select("*").order("name");
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.put("/api/pets/:id", async (req, res) => {
    const { name, species, breed, dob, color, notes } = req.body;
    const { data, error } = await supabase.from("pets").update({ name, species, breed, dob, color, notes }).eq("id", req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  // Pet vet appointments
  app.get("/api/pets/:petId/vet", async (req, res) => {
    const { data, error } = await supabase.from("pet_vet_appointments").select("*").eq("pet_id", req.params.petId).order("date");
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });
  app.post("/api/pets/:petId/vet", async (req, res) => {
    const { nanoid } = await import("nanoid");
    const { type, provider, date, time, notes } = req.body;
    const { data, error } = await supabase.from("pet_vet_appointments").insert([{ id: nanoid(), pet_id: req.params.petId, type, provider, date, time, notes }]).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });
  app.put("/api/pets/vet/:id", async (req, res) => {
    const { type, provider, date, time, notes } = req.body;
    const { data, error } = await supabase.from("pet_vet_appointments").update({ type, provider, date, time, notes }).eq("id", req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });
  app.delete("/api/pets/vet/:id", async (req, res) => {
    const { error } = await supabase.from("pet_vet_appointments").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  });

  // Pet medications
  app.get("/api/pets/:petId/meds", async (req, res) => {
    const { data, error } = await supabase.from("pet_medications").select("*").eq("pet_id", req.params.petId).order("name");
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });
  app.post("/api/pets/:petId/meds", async (req, res) => {
    const { nanoid } = await import("nanoid");
    const { name, dose, frequency, start_date, end_date, notes } = req.body;
    const { data, error } = await supabase.from("pet_medications").insert([{ id: nanoid(), pet_id: req.params.petId, name, dose, frequency, start_date, end_date, notes }]).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });
  app.put("/api/pets/meds/:id", async (req, res) => {
    const { name, dose, frequency, start_date, end_date, notes } = req.body;
    const { data, error } = await supabase.from("pet_medications").update({ name, dose, frequency, start_date, end_date, notes }).eq("id", req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });
  app.delete("/api/pets/meds/:id", async (req, res) => {
    const { error } = await supabase.from("pet_medications").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  });

  // Pet grooming
  app.get("/api/pets/:petId/grooming", async (req, res) => {
    const { data, error } = await supabase.from("pet_grooming").select("*").eq("pet_id", req.params.petId).order("date");
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });
  app.post("/api/pets/:petId/grooming", async (req, res) => {
    const { nanoid } = await import("nanoid");
    const { provider, date, time, notes } = req.body;
    const { data, error } = await supabase.from("pet_grooming").insert([{ id: nanoid(), pet_id: req.params.petId, provider, date, time, notes }]).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });
  app.put("/api/pets/grooming/:id", async (req, res) => {
    const { provider, date, time, notes } = req.body;
    const { data, error } = await supabase.from("pet_grooming").update({ provider, date, time, notes }).eq("id", req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });
  app.delete("/api/pets/grooming/:id", async (req, res) => {
    const { error } = await supabase.from("pet_grooming").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  });

  // ─── UNIFIED CALENDAR (all modules, date-based) ───────────────────────────
  // Returns a merged feed of all date-stamped items for a given month range
  app.get("/api/calendar", async (req, res) => {
    const { from, to } = req.query as { from?: string; to?: string };

    const [evRes, apptRes, payRes, regRes, sportsRes, vetRes, groomRes] = await Promise.all([
      supabase.from("events").select("*").order("date"),
      supabase.from("medical_appointments").select("*").gte("date", from || "2000-01-01").lte("date", to || "2099-12-31"),
      supabase.from("payments").select("*").not("due_date", "is", null),
      supabase.from("registrations").select("*").not("deadline", "is", null),
      supabase.from("sports").select("*").eq("active", true),
      supabase.from("pet_vet_appointments").select("*, pets(name, color)").not("date", "is", null),
      supabase.from("pet_grooming").select("*, pets(name, color)").not("date", "is", null),
    ]);

    const items: any[] = [];

    // Events (including recurring expansion)
    for (const ev of evRes.data || []) {
      if (ev.is_template && ev.recurrence_type) {
        const instances = expandRecurring(ev, from, to);
        items.push(...instances);
      } else if (!ev.is_template) {
        items.push({ ...ev, _type: "event" });
      }
    }

    // Medical appointments
    for (const a of apptRes.data || []) {
      items.push({
        id: a.id, title: a.provider + " (" + a.type + ")",
        date: a.date, time: a.time,
        child_ids: [a.child_id], category: "medical",
        _type: "appointment", _data: a,
      });
    }

    // Payments with due dates
    for (const p of payRes.data || []) {
      if (p.due_date && p.status !== "paid" && p.status !== "cancelled") {
        items.push({
          id: p.id, title: p.description + " ($" + parseFloat(p.amount).toFixed(2) + ")",
          date: p.due_date, child_ids: p.child_id ? [p.child_id] : [],
          category: "payment", _type: "payment", _data: p,
        });
      }
    }

    // Registration deadlines
    for (const r of regRes.data || []) {
      if (r.deadline && r.status !== "confirmed" && r.status !== "cancelled") {
        items.push({
          id: r.id, title: r.program_name + " deadline",
          date: r.deadline, child_ids: [r.child_id],
          category: "camp", _type: "registration", _data: r,
        });
      }
    }

    // Sports — generate practice events from days field
    for (const s of sportsRes.data || []) {
      // Surfaced in legend/sidebar; no per-date expansion without a date range field
    }

    // Pet vet appointments
    for (const v of vetRes.data || []) {
      items.push({
        id: v.id,
        title: `${v.pets?.name ?? "Pet"} — ${v.type} (${v.provider || "vet"})`,
        date: v.date, time: v.time,
        child_ids: [], pet_ids: [v.pet_id],
        category: "pets", _type: "vet", _data: v,
        color: v.pets?.color,
      });
    }

    // Pet grooming appointments
    for (const g of groomRes.data || []) {
      items.push({
        id: g.id,
        title: `${g.pets?.name ?? "Pet"} — Grooming${g.provider ? " (" + g.provider + ")" : ""}`,
        date: g.date, time: g.time,
        child_ids: [], pet_ids: [g.pet_id],
        category: "pets", _type: "grooming", _data: g,
        color: g.pets?.color,
      });
    }

    // Filter to range if provided
    const filtered = (from || to) ? items.filter(item => {
      if (!item.date) return false;
      if (from && item.date < from) return false;
      if (to && item.date > to) return false;
      return true;
    }) : items;

    filtered.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    res.json(filtered);
  });

  // ─── SHARE TOKENS ─────────────────────────────────────────────────────────
  app.post("/api/share/create", async (req, res) => {
    const token = nanoid(24);
    const { label } = req.body;
    const { data, error } = await supabase.from("share_tokens").insert([
      { token, label: label || "Family Calendar" }
    ]).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ token, ...data });
  });

  app.get("/api/share/verify/:token", async (req, res) => {
    const { data, error } = await supabase.from("share_tokens")
      .select("*").eq("token", req.params.token).single();
    if (error || !data) return res.status(404).json({ valid: false });
    res.json({ valid: true, label: data.label });
  });

  // Public calendar read — authenticated by share token
  app.get("/api/share/:token/calendar", async (req, res) => {
    const { data: tokenData } = await supabase.from("share_tokens")
      .select("*").eq("token", req.params.token).single();
    if (!tokenData) return res.status(403).json({ error: "Invalid token" });

    // Reuse the calendar logic
    const { from, to } = req.query as { from?: string; to?: string };
    const [evRes, apptRes, payRes, regRes] = await Promise.all([
      supabase.from("events").select("*").order("date"),
      supabase.from("medical_appointments").select("*"),
      supabase.from("payments").select("*").not("due_date", "is", null),
      supabase.from("registrations").select("*").not("deadline", "is", null),
    ]);

    const items: any[] = [];
    for (const ev of evRes.data || []) {
      if (ev.is_template && ev.recurrence_type) {
        items.push(...expandRecurring(ev, from, to));
      } else if (!ev.is_template) {
        items.push({ ...ev, _type: "event" });
      }
    }
    for (const a of apptRes.data || []) {
      items.push({ id: a.id, title: a.provider + " (" + a.type + ")", date: a.date, time: a.time, child_ids: [a.child_id], category: "medical", _type: "appointment" });
    }
    for (const p of payRes.data || []) {
      if (p.due_date && p.status !== "paid" && p.status !== "cancelled") {
        items.push({ id: p.id, title: p.description + " ($" + parseFloat(p.amount).toFixed(2) + ")", date: p.due_date, child_ids: p.child_id ? [p.child_id] : [], category: "payment", _type: "payment" });
      }
    }
    for (const r of regRes.data || []) {
      if (r.deadline && r.status !== "confirmed" && r.status !== "cancelled") {
        items.push({ id: r.id, title: r.program_name + " deadline", date: r.deadline, child_ids: [r.child_id], category: "camp", _type: "registration" });
      }
    }
    const filtered = (from || to) ? items.filter(item => {
      if (!item.date) return false;
      if (from && item.date < from) return false;
      if (to && item.date > to) return false;
      return true;
    }) : items;
    filtered.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    res.json({ label: tokenData.label, items: filtered });
  });
}

// ─── Recurrence expansion helper ──────────────────────────────────────────────
function expandRecurring(ev: any, from?: string, to?: string): any[] {
  const results: any[] = [];
  if (!ev.date) return results;

  const startDate = new Date(ev.date + "T00:00:00");
  const endDate = ev.recurrence_end_date
    ? new Date(ev.recurrence_end_date + "T00:00:00")
    : new Date(Date.now() + 180 * 24 * 60 * 60 * 1000); // default 6 months ahead

  const rangeFrom = from ? new Date(from + "T00:00:00") : new Date("2000-01-01");
  const rangeTo = to ? new Date(to + "T00:00:00") : new Date("2099-12-31");

  const interval = ev.recurrence_interval || 1;
  const days: number[] = ev.recurrence_days ? JSON.parse(ev.recurrence_days) : [];

  let cursor = new Date(startDate);
  let safety = 0;

  while (cursor <= endDate && cursor <= rangeTo && safety < 500) {
    safety++;
    const inRange = cursor >= rangeFrom && cursor <= rangeTo && cursor >= startDate;

    if (inRange) {
      let include = false;
      if (ev.recurrence_type === "daily") {
        include = true;
      } else if (ev.recurrence_type === "weekly") {
        include = days.length === 0 || days.includes(cursor.getDay());
      }

      if (include) {
        const dateStr = cursor.toISOString().split("T")[0];
        results.push({
          ...ev,
          id: ev.id + "_" + dateStr,
          date: dateStr,
          is_template: false,
          parent_event_id: ev.id,
          _type: "event",
          _recurrence_instance: true,
        });
      }
    }

    // Advance
    if (ev.recurrence_type === "daily") {
      cursor.setDate(cursor.getDate() + interval);
    } else if (ev.recurrence_type === "weekly") {
      cursor.setDate(cursor.getDate() + 1);
    } else {
      break;
    }
  }

  return results;
}

// ─── INBOX / PENDING IMPORTS ────────────────────────────────────────────────
// These routes handle the email extraction pipeline:
//   POST /api/inbox/scan        — accepts raw email data, runs LLM extraction, saves to pending_imports
//   GET  /api/inbox/pending     — returns all pending (unreviewed) imports
//   POST /api/inbox/:id/accept  — accepts one extracted item and saves it to the appropriate table
//   POST /api/inbox/:id/dismiss — marks an import as dismissed

// Helper: save an accepted extracted item to the right Supabase table
async function commitExtractedItem(item: any) {
  const id = nanoid();
  switch (item.type) {
    case "event":
      return supabase.from("events").insert({
        id,
        title: item.title,
        date: item.date,
        time: item.time,
        child_ids: item.child_ids || [],
        category: item.category || "other",
        notes: item.notes,
      });
    case "appointment":
      // Use the first child_id if present, else leave null
      return supabase.from("medical_appointments").insert({
        id,
        child_id: item.child_ids?.[0] || "",
        type: item.title,
        date: item.date,
        time: item.time,
        notes: item.notes,
        status: "scheduled",
      });
    case "payment":
      return supabase.from("payments").insert({
        id,
        description: item.title,
        amount: item.amount || "",
        due_date: item.date,
        child_id: item.child_ids?.[0] || null,
        category: item.category || "payment",
        status: "pending",
        notes: item.notes,
      });
    case "registration":
      return supabase.from("registrations").insert({
        id,
        child_id: item.child_ids?.[0] || "",
        program_name: item.title,
        deadline: item.date,
        cost: item.amount,
        status: "pending",
        notes: item.notes,
      });
    default:
      // tasks → save as events with category "other"
      return supabase.from("events").insert({
        id,
        title: item.title,
        date: item.date,
        child_ids: item.child_ids || [],
        category: "other",
        notes: item.notes,
      });
  }
}

// POST /api/inbox/scan — called by the cron job or manual trigger
// Body: { subject, from, date, snippet, body?, gmail_id? }
export async function scanEmail(app: Express) {}

// Register inbox routes on the app
export function registerInboxRoutes(app: Express) {
  // Manual scan endpoint — accepts a single email payload
  app.post("/api/inbox/scan", async (req, res) => {
    const { subject, from, date, snippet, body, gmail_id } = req.body;
    if (!subject && !snippet) return res.status(400).json({ error: "No email content" });

    // Avoid re-processing the same Gmail message
    if (gmail_id) {
      const { data: existing } = await supabase
        .from("pending_imports")
        .select("id")
        .eq("gmail_id", gmail_id)
        .single();
      if (existing) return res.json({ skipped: true, reason: "already processed" });
    }

    const extracted = await extractFromEmail(subject || "", from || "", snippet || "", body);

    if (extracted.length === 0) {
      return res.json({ extracted: [], saved: false });
    }

    const importId = nanoid();
    const { error } = await supabase.from("pending_imports").insert({
      id: importId,
      source: "email",
      raw_subject: subject,
      raw_from: from,
      raw_date: date,
      raw_snippet: snippet,
      gmail_id: gmail_id || null,
      extracted,
      status: "pending",
    });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ id: importId, extracted });
  });

  // GET /api/inbox/pending — list unreviewed imports
  app.get("/api/inbox/pending", async (_req, res) => {
    const { data, error } = await supabase
      .from("pending_imports")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  });

  // GET /api/inbox/count — quick badge count
  app.get("/api/inbox/count", async (_req, res) => {
    const { count, error } = await supabase
      .from("pending_imports")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");
    if (error) return res.status(500).json({ error: error.message });
    res.json({ count: count || 0 });
  });

  // POST /api/inbox/:id/accept — accept one extracted item by index
  // Body: { item_index: number, overrides?: Partial<ExtractedItem> }
  app.post("/api/inbox/:id/accept", async (req, res) => {
    const { id } = req.params;
    const { item_index = 0, overrides = {} } = req.body;

    const { data: record, error: fetchErr } = await supabase
      .from("pending_imports")
      .select("*")
      .eq("id", id)
      .single();
    if (fetchErr || !record) return res.status(404).json({ error: "Not found" });

    const items: any[] = record.extracted || [];
    const item = items[item_index];
    if (!item) return res.status(400).json({ error: "Item index out of range" });

    const merged = { ...item, ...overrides };
    const { error: commitErr } = await commitExtractedItem(merged);
    if (commitErr) return res.status(500).json({ error: commitErr.message });

    // Mark individual item as accepted
    items[item_index] = { ...item, _accepted: true };
    const allDone = items.every((i) => i._accepted || i._dismissed);

    await supabase
      .from("pending_imports")
      .update({
        extracted: items,
        status: allDone ? "reviewed" : "pending",
        reviewed_at: allDone ? new Date().toISOString() : null,
      })
      .eq("id", id);

    res.json({ ok: true });
  });

  // POST /api/inbox/:id/dismiss — dismiss one or all items
  // Body: { item_index?: number } — omit to dismiss entire import
  app.post("/api/inbox/:id/dismiss", async (req, res) => {
    const { id } = req.params;
    const { item_index } = req.body;

    if (item_index !== undefined) {
      const { data: record } = await supabase
        .from("pending_imports")
        .select("extracted")
        .eq("id", id)
        .single();
      const items: any[] = record?.extracted || [];
      if (items[item_index]) items[item_index]._dismissed = true;
      const allDone = items.every((i) => i._accepted || i._dismissed);
      await supabase
        .from("pending_imports")
        .update({
          extracted: items,
          status: allDone ? "reviewed" : "pending",
        })
        .eq("id", id);
    } else {
      await supabase
        .from("pending_imports")
        .update({ status: "dismissed", reviewed_at: new Date().toISOString() })
        .eq("id", id);
    }

    res.json({ ok: true });
  });
}
