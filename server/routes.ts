import type { Express } from "express";
import type { Server } from "http";
import { createClient } from "@supabase/supabase-js";
import { nanoid } from "nanoid";
import ws from "ws";
import { extractFromEmail } from "./emailExtractor";


const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(
  supabaseUrl,
  supabaseKey,
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
    const { title, date, time, end_time, child_ids, category, notes, recurring,
            is_template, recurrence_type, recurrence_interval, recurrence_days, recurrence_end_date } = req.body;
    const { data, error } = await supabase.from("events").insert([
      { id, title, date, time, end_time, child_ids: child_ids || [], category: category || "other", notes,
        recurring: recurring || false,
        is_template: is_template || false,
        recurrence_type: recurrence_type || null,
        recurrence_interval: recurrence_interval || 1,
        recurrence_days: recurrence_days || null,
        recurrence_end_date: recurrence_end_date || null }
    ]).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.put("/api/events/:id", async (req, res) => {
    const { title, date, time, end_time, child_ids, category, notes, recurring,
            is_template, recurrence_type, recurrence_interval, recurrence_days, recurrence_end_date } = req.body;
    const { data, error } = await supabase.from("events")
      .update({ title, date, time, end_time, child_ids: child_ids || [], category, notes, recurring,
        is_template: is_template || false,
        recurrence_type: recurrence_type || null,
        recurrence_interval: recurrence_interval || 1,
        recurrence_days: recurrence_days || null,
        recurrence_end_date: recurrence_end_date || null })
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
    const { child_id, name, date_given, next_due, status, provider, administered_by, lot_number, notes } = req.body;
    const { data, error } = await supabase.from("vaccines").insert([
      { id, child_id, name, date_given, next_due, status: status || "completed", provider, administered_by, lot_number, notes }
    ]).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.put("/api/vaccines/:id", async (req, res) => {
    const { child_id, name, date_given, next_due, status, provider, administered_by, lot_number, notes } = req.body;
    const { data, error } = await supabase.from("vaccines")
      .update({ child_id, name, date_given, next_due, status: status || "completed", provider, administered_by, lot_number, notes })
      .eq("id", req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  // ─── PET VACCINES ───────────────────────────────────────────────────────────────
  app.get("/api/pet-vaccines", async (_req, res) => {
    const { data, error } = await supabase.from("pet_vaccines").select("*").order("date_given", { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });
  app.post("/api/pet-vaccines", async (req, res) => {
    const { pet_id, name, date_given, next_due, status, provider, administered_by, lot_number, notes } = req.body;
    const { data, error } = await supabase.from("pet_vaccines").insert([
      { id: nanoid(), pet_id, name, date_given, next_due, status: status || "completed", provider, administered_by, lot_number, notes }
    ]).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });
  app.put("/api/pet-vaccines/:id", async (req, res) => {
    const { pet_id, name, date_given, next_due, status, provider, administered_by, lot_number, notes } = req.body;
    const { data, error } = await supabase.from("pet_vaccines")
      .update({ pet_id, name, date_given, next_due, status: status || "completed", provider, administered_by, lot_number, notes })
      .eq("id", req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });
  app.delete("/api/pet-vaccines/:id", async (req, res) => {
    const { error } = await supabase.from("pet_vaccines").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
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

    const [evRes, apptRes, payRes, regRes, sportsRes, vetRes, groomRes, maintRes] = await Promise.all([
      supabase.from("events").select("*").order("date"),
      supabase.from("medical_appointments").select("*").gte("date", from || "2000-01-01").lte("date", to || "2099-12-31"),
      supabase.from("payments").select("*").not("due_date", "is", null),
      supabase.from("registrations").select("*").not("deadline", "is", null),
      supabase.from("sports").select("*").eq("active", true),
      supabase.from("pet_vet_appointments").select("*, pets(name, color)").not("date", "is", null),
      supabase.from("pet_grooming").select("*, pets(name, color)").not("date", "is", null),
      supabase.from("maintenance_tasks").select("*, properties(name)").not("due_date", "is", null).neq("status", "done"),
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
      if (r.deadline && r.status !== "confirmed" && r.status !== "paid" && r.status !== "cancelled") {
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

    // Maintenance tasks with due dates
    for (const m of maintRes.data || []) {
      items.push({
        id: m.id,
        title: `🛠️ ${m.title}${m.properties?.name ? " (" + m.properties.name + ")" : ""}`,
        date: m.due_date,
        child_ids: m.assigned_to ? [m.assigned_to] : [],
        category: "home", _type: "maintenance", _data: m,
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
      if (r.deadline && r.status !== "confirmed" && r.status !== "paid" && r.status !== "cancelled")
        items.push({ id: r.id, title: r.program_name + " deadline", date: r.deadline, child_ids: [r.child_id], category: "camp", _type: "registration" });
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

// ─── MESSAGES ────────────────────────────────────────────────────────────────
// Unified feed: in-app posts (channel='app') + inbound SMS (channel='sms')
export function registerMessageRoutes(app: Express) {

  // GET /api/messages — latest 100, newest first
  app.get("/api/messages", async (_req, res) => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  });

  // GET /api/messages/count?since=ISO — count messages newer than timestamp
  // Used for the nav badge (stored in localStorage on the client)
  app.get("/api/messages/count", async (req, res) => {
    const since = (req.query.since as string) || new Date(0).toISOString();
    const { count, error } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .gt("created_at", since);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ count: count || 0 });
  });

  // POST /api/messages — post an in-app message
  // Body: { author: string, body: string }
  app.post("/api/messages", async (req, res) => {
    const { author, body } = req.body;
    if (!author?.trim() || !body?.trim())
      return res.status(400).json({ error: "author and body are required" });
    const { data, error } = await supabase
      .from("messages")
      .insert({ id: nanoid(), channel: "app", author: author.trim(), body: body.trim() })
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  // ─── HOME & PROPERTY ────────────────────────────────────────────────────

  // Properties CRUD
  app.get("/api/properties", async (_req, res) => {
    const { data, error } = await supabase.from("properties").select("*").order("created_at");
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.post("/api/properties", async (req, res) => {
    const id = nanoid();
    const { name, address, type, notes } = req.body;
    const { data, error } = await supabase.from("properties").insert([{ id, name, address, type: type || "other", notes }]).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.put("/api/properties/:id", async (req, res) => {
    const { name, address, type, notes } = req.body;
    const { data, error } = await supabase.from("properties").update({ name, address, type, notes }).eq("id", req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.delete("/api/properties/:id", async (req, res) => {
    const { error } = await supabase.from("properties").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  });

  // Property Assets CRUD
  app.get("/api/property-assets", async (req, res) => {
    const propertyId = req.query.property_id as string | undefined;
    let query = supabase.from("property_assets").select("*").order("name");
    if (propertyId) query = query.eq("property_id", propertyId);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.post("/api/property-assets", async (req, res) => {
    const id = nanoid();
    const { property_id, name, category, make_model, install_date, warranty_end, notes } = req.body;
    const { data, error } = await supabase.from("property_assets").insert([{ id, property_id, name, category: category || "general", make_model, install_date, warranty_end, notes }]).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.put("/api/property-assets/:id", async (req, res) => {
    const { property_id, name, category, make_model, install_date, warranty_end, notes } = req.body;
    const { data, error } = await supabase.from("property_assets").update({ property_id, name, category, make_model, install_date, warranty_end, notes }).eq("id", req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.delete("/api/property-assets/:id", async (req, res) => {
    const { error } = await supabase.from("property_assets").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  });

  // Maintenance Tasks CRUD
  app.get("/api/maintenance-tasks", async (req, res) => {
    const propertyId = req.query.property_id as string | undefined;
    const status = req.query.status as string | undefined;
    let query = supabase.from("maintenance_tasks").select("*").order("due_date", { ascending: true });
    if (propertyId) query = query.eq("property_id", propertyId);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.get("/api/maintenance-tasks/count", async (_req, res) => {
    const today = new Date().toISOString().split("T")[0];
    const { count, error } = await supabase
      .from("maintenance_tasks")
      .select("*", { count: "exact", head: true })
      .in("status", ["pending", "overdue", "scheduled"])
      .lte("due_date", today);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ count: count || 0 });
  });

  app.post("/api/maintenance-tasks", async (req, res) => {
    const id = nanoid();
    const { property_id, asset_id, title, description, status, priority, due_date, completed_date, assigned_to, recurring, recurrence_type, recurrence_interval, season, cost, notes } = req.body;
    const { data, error } = await supabase.from("maintenance_tasks").insert([{
      id, property_id, asset_id: asset_id || null, title, description,
      status: status || "pending", priority: priority || "normal",
      due_date, completed_date, assigned_to: assigned_to || null,
      recurring: recurring || false, recurrence_type: recurrence_type || null,
      recurrence_interval: recurrence_interval || 1, season: season || null,
      cost, notes
    }]).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.put("/api/maintenance-tasks/:id", async (req, res) => {
    const { property_id, asset_id, title, description, status, priority, due_date, completed_date, assigned_to, recurring, recurrence_type, recurrence_interval, season, cost, notes } = req.body;
    const { data, error } = await supabase.from("maintenance_tasks").update({
      property_id, asset_id: asset_id || null, title, description,
      status, priority, due_date, completed_date, assigned_to: assigned_to || null,
      recurring: recurring || false, recurrence_type: recurrence_type || null,
      recurrence_interval: recurrence_interval || 1, season: season || null,
      cost, notes
    }).eq("id", req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.delete("/api/maintenance-tasks/:id", async (req, res) => {
    const { error } = await supabase.from("maintenance_tasks").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  });

  // Service Providers CRUD
  app.get("/api/service-providers", async (_req, res) => {
    const { data, error } = await supabase.from("service_providers").select("*").order("name");
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.post("/api/service-providers", async (req, res) => {
    const id = nanoid();
    const { name, company, specialty, phone, email, address, rating, notes } = req.body;
    const { data, error } = await supabase.from("service_providers").insert([{ id, name, company, specialty: specialty || "general", phone, email, address, rating, notes }]).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.put("/api/service-providers/:id", async (req, res) => {
    const { name, company, specialty, phone, email, address, rating, notes } = req.body;
    const { data, error } = await supabase.from("service_providers").update({ name, company, specialty, phone, email, address, rating, notes }).eq("id", req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.delete("/api/service-providers/:id", async (req, res) => {
    const { error } = await supabase.from("service_providers").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  });

  // Maintenance Log CRUD
  app.get("/api/maintenance-log", async (req, res) => {
    const propertyId = req.query.property_id as string | undefined;
    let query = supabase.from("maintenance_log").select("*").order("date", { ascending: false });
    if (propertyId) query = query.eq("property_id", propertyId);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.post("/api/maintenance-log", async (req, res) => {
    const id = nanoid();
    const { property_id, asset_id, task_id, provider_id, title, date, cost, description, notes } = req.body;
    const { data, error } = await supabase.from("maintenance_log").insert([{
      id, property_id, asset_id: asset_id || null, task_id: task_id || null,
      provider_id: provider_id || null, title, date, cost, description, notes
    }]).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.put("/api/maintenance-log/:id", async (req, res) => {
    const { property_id, asset_id, task_id, provider_id, title, date, cost, description, notes } = req.body;
    const { data, error } = await supabase.from("maintenance_log").update({
      property_id, asset_id: asset_id || null, task_id: task_id || null,
      provider_id: provider_id || null, title, date, cost, description, notes
    }).eq("id", req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.delete("/api/maintenance-log/:id", async (req, res) => {
    const { error } = await supabase.from("maintenance_log").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  });

  // POST /api/sms/inbound — Twilio webhook for inbound SMS
  // Twilio posts application/x-www-form-urlencoded with From, Body, etc.
  //
  // SMART ROUTING:
  //   - If the text contains #TAG syntax → route through extraction pipeline (quick-add)
  //   - Otherwise → save as a plain message in the activity log
  //
  // Response: Always TwiML (Twilio requires XML response)
  app.post("/api/sms/inbound", async (req, res) => {
    const from: string = req.body.From || "";
    const body: string = req.body.Body || "";
    if (!from || !body) {
      res.set("Content-Type", "text/xml");
      return res.send("<?xml version='1.0' encoding='UTF-8'?><Response></Response>");
    }

    // Resolve sender name from phone_contacts table
    const { data: contact } = await supabase
      .from("phone_contacts")
      .select("name")
      .eq("phone", from)
      .single();
    const author = contact?.name || from;

    // ─── Smart routing: check if text contains #TAG syntax ─────────────────
    const hasTag = /#(CAMP|SPORT|SCHOOL|MED|PAY|REG|PET|FAM|OFFICE|TRAVEL|HOUSE|INVITE)/i.test(body);

    let replyText = "";

    if (hasTag) {
      // ── Quick-add: route through extraction pipeline ──────────────────────
      try {
        const smsId = `sms-${Date.now()}-${nanoid(6)}`;
        const extracted = await extractFromEmail(
          body.trim(),   // SMS body treated as email subject (fast-path)
          from,
          "",            // no snippet
          "",            // no body
          undefined,     // no HTML
          undefined      // no attachments
        );

        if (extracted.length > 0) {
          // Save to pending_imports for review in the Inbox
          const importId = nanoid();
          await supabase.from("pending_imports").insert({
            id: importId,
            source: "sms",
            raw_subject: body.trim(),
            raw_from: author,
            raw_date: new Date().toISOString(),
            raw_snippet: `SMS from ${author}`,
            gmail_id: smsId,
            extracted,
            status: "pending",
          });

          // Log the activity
          const { logActivity } = await import("./notifications");
          await logActivity(
            `SMS quick-add from ${author}`,
            `"${body.trim()}" → ${extracted.length} item(s) added to inbox`,
            "item_added"
          );

          replyText = `Got it! ${extracted.length} item(s) added to the Family Hub inbox for review.`;
        } else {
          replyText = `Received, but couldn't extract an actionable item. Try: #TAG @Name description`;
        }
      } catch (err: any) {
        console.error("[sms/inbound] Extraction error:", err.message);
        replyText = `Error processing your message. Try again or check the app.`;
      }
    } else {
      // ── Plain message: log to activity feed ───────────────────────────────
      const { logActivity } = await import("./notifications");
      await logActivity(
        `SMS from ${author}`,
        body.trim(),
        "system"
      );
      replyText = "";
    }

    // Respond with TwiML (optional auto-reply)
    res.set("Content-Type", "text/xml");
    if (replyText) {
      res.send(`<?xml version='1.0' encoding='UTF-8'?><Response><Message>${replyText}</Message></Response>`);
    } else {
      res.send("<?xml version='1.0' encoding='UTF-8'?><Response></Response>");
    }
  });

  // POST /api/sms/send — outbound SMS (used by notification engine)
  // Body: { to: string, body: string }
  app.post("/api/sms/send", async (req, res) => {
    const { to, body: msgBody } = req.body;
    if (!to || !msgBody) return res.status(400).json({ error: "to and body required" });

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      return res.status(501).json({ error: "Twilio not configured" });
    }

    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
      const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
      const params = new URLSearchParams({ To: to, From: fromNumber, Body: msgBody });

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const err = await response.text();
        return res.status(500).json({ error: err });
      }

      const result = await response.json();
      res.json({ ok: true, sid: result.sid });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
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
        end_date: item.end_date || null,
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
    case "task":
      // Home maintenance tasks → save to maintenance_tasks table
      return supabase.from("maintenance_tasks").insert({
        id,
        property_id: item.property_id || "prop-cedarview",  // default to primary property
        title: item.title,
        description: item.notes,
        status: "pending",
        priority: "normal",
        due_date: item.date,
        assigned_to: item.child_ids?.[0] || null,  // parents are in child_ids for #HOUSE
        notes: item.source_hint || null,
      });
    default:
      // Unknown types → save as events with category "other"
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
  // Manual scan endpoint — accepts a single email payload (enhanced with attachments)
  app.post("/api/inbox/scan", async (req, res) => {
    const { subject, from, date, snippet, body, html_body, attachments, gmail_id } = req.body;
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

    // Enhanced extraction with HTML body and attachments
    const extracted = await extractFromEmail(
      subject || "",
      from || "",
      snippet || "",
      body,
      html_body,
      attachments
    );

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
    res.json({ id: importId, extracted, attachments_processed: attachments?.length || 0 });
  });

  // POST /api/inbox/trigger-scan — manual off-schedule email scan
  // Strategy: Use direct IMAP connection (primary), fall back to Python script if IMAP not configured
  app.post("/api/inbox/trigger-scan", async (_req, res) => {
    const { isGmailConfigured, scanGmailInbox } = await import("./gmailScanner");

    // ─── Primary: Direct IMAP scan ────────────────────────────────────────────
    if (isGmailConfigured()) {
      try {
        console.log("[trigger-scan] Using direct IMAP connection...");
        const { emails, errors } = await scanGmailInbox();

        if (emails.length === 0) {
          return res.json({
            ok: true,
            new_items: 0,
            skipped: 0,
            method: "imap",
            log: ["No relevant emails found in the lookback period."],
          });
        }

        // Process each email through the extraction pipeline
        let newItems = 0;
        let skipped = 0;
        const extractErrors: string[] = [...errors];

        for (const email of emails) {
          try {
            // Check for duplicates
            if (email.gmail_id) {
              const { data: existing } = await supabase
                .from("pending_imports")
                .select("id")
                .eq("gmail_id", email.gmail_id)
                .single();
              if (existing) {
                skipped++;
                continue;
              }
            }

            // Run extraction
            const extracted = await extractFromEmail(
              email.subject,
              email.from,
              email.snippet,
              email.body,
              email.html_body,
              email.attachments
            );

            if (extracted.length === 0) continue;

            // Save to pending_imports
            const importId = nanoid();
            const { error: insertErr } = await supabase.from("pending_imports").insert({
              id: importId,
              source: "email",
              raw_subject: email.subject,
              raw_from: email.from,
              raw_date: email.date,
              raw_snippet: email.snippet,
              gmail_id: email.gmail_id || null,
              extracted,
              status: "pending",
            });

            if (insertErr) {
              extractErrors.push(`Insert failed for '${email.subject}': ${insertErr.message}`);
            } else {
              newItems += extracted.length;
            }
          } catch (emailErr: any) {
            extractErrors.push(`Failed '${email.subject}': ${emailErr.message}`);
          }
        }

        return res.json({
          ok: true,
          new_items: newItems,
          skipped,
          method: "imap",
          emails_scanned: emails.length,
          log: [
            `Scanned ${emails.length} relevant emails via IMAP`,
            `${newItems} new items extracted, ${skipped} already processed`,
            ...(extractErrors.length > 0 ? [`${extractErrors.length} error(s)`] : []),
          ],
        });
      } catch (imapErr: any) {
        console.error("[trigger-scan] IMAP scan failed:", imapErr.message);
        // Fall through to Python script fallback
        return res.status(500).json({
          ok: false,
          error: imapErr.message,
          method: "imap",
          hint: "Check GMAIL_USER and GMAIL_APP_PASSWORD environment variables on Render.",
        });
      }
    }

    // ─── Fallback: Python script (for Manus sandbox or local dev) ─────────────
    const { exec } = await import("child_process");
    const path = await import("path");
    const scriptPath = path.resolve(__dirname, "../scripts/gmail_scan.py");

    const fs = await import("fs");
    if (!fs.existsSync(scriptPath)) {
      return res.status(501).json({
        ok: false,
        error: "Gmail scanning not configured",
        detail: "Neither IMAP credentials (GMAIL_USER + GMAIL_APP_PASSWORD) nor the gmail_scan.py script are available. See the Help page for setup instructions.",
      });
    }

    try {
      const child = exec(`python3 "${scriptPath}"`, {
        timeout: 60_000,
        env: { ...process.env, FAMILY_HUB_API: `http://localhost:${process.env.PORT || 5000}` },
      });

      let stdout = "";
      let stderr = "";
      child.stdout?.on("data", (d: string) => { stdout += d; });
      child.stderr?.on("data", (d: string) => { stderr += d; });

      child.on("close", (code: number | null) => {
        if (code === 0) {
          const match = stdout.match(/(\d+) new items?, (\d+) skipped/);
          res.json({
            ok: true,
            new_items: match ? parseInt(match[1]) : 0,
            skipped: match ? parseInt(match[2]) : 0,
            method: "script",
            log: stdout.trim().split("\n").slice(-5),
          });
        } else {
          res.status(500).json({
            ok: false,
            error: "Scan script exited with error",
            code,
            method: "script",
            log: (stderr || stdout).trim().split("\n").slice(-5),
          });
        }
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message, method: "script" });
    }
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

// ─── CARPOOL & TRANSPORTATION ─────────────────────────────────────────────────
export function registerCarpoolRoutes(app: Express) {

  // ─── VEHICLES ─────────────────────────────────────────────────────────────
  app.get("/api/vehicles", async (_req, res) => {
    const { data, error } = await supabase.from("vehicles").select("*").order("name");
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  });
  app.post("/api/vehicles", async (req, res) => {
    const { name, make_model, color, seats, notes } = req.body;
    const { data, error } = await supabase.from("vehicles").insert([{ id: nanoid(), name, make_model, color, seats, notes }]).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });
  app.put("/api/vehicles/:id", async (req, res) => {
    const { name, make_model, color, seats, notes, active } = req.body;
    const { data, error } = await supabase.from("vehicles").update({ name, make_model, color, seats, notes, active }).eq("id", req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });
  app.delete("/api/vehicles/:id", async (req, res) => {
    const { error } = await supabase.from("vehicles").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  });

  // ─── DRIVERS ──────────────────────────────────────────────────────────────
  app.get("/api/drivers", async (_req, res) => {
    const { data, error } = await supabase.from("drivers").select("*, vehicles(name, color)").order("name");
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  });
  app.post("/api/drivers", async (req, res) => {
    const { name, relationship, phone, email, vehicle_id, is_family, notes } = req.body;
    const { data, error } = await supabase.from("drivers").insert([{ id: nanoid(), name, relationship, phone, email, vehicle_id, is_family, notes }]).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });
  app.put("/api/drivers/:id", async (req, res) => {
    const { name, relationship, phone, email, vehicle_id, is_family, notes, active } = req.body;
    const { data, error } = await supabase.from("drivers").update({ name, relationship, phone, email, vehicle_id, is_family, notes, active }).eq("id", req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });
  app.delete("/api/drivers/:id", async (req, res) => {
    const { error } = await supabase.from("drivers").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  });

  // ─── RIDE REQUESTS ────────────────────────────────────────────────────────
  app.get("/api/rides", async (req, res) => {
    const { date, from, to, child_id, status } = req.query as any;
    let query = supabase.from("ride_requests").select("*, drivers(name), vehicles(name, color)").order("date").order("pickup_time");
    if (date) query = query.eq("date", date);
    if (from) query = query.gte("date", from);
    if (to) query = query.lte("date", to);
    if (child_id) query = query.eq("child_id", child_id);
    if (status) query = query.eq("status", status);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  });
  app.post("/api/rides", async (req, res) => {
    const { child_id, date, pickup_time, pickup_location, dropoff_time, dropoff_location, activity, source_event_id, source_type, notes } = req.body;
    const { data, error } = await supabase.from("ride_requests").insert([{
      id: nanoid(), child_id, date, pickup_time, pickup_location, dropoff_time, dropoff_location,
      activity, source_event_id, source_type, status: "unassigned", notes
    }]).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });
  app.put("/api/rides/:id", async (req, res) => {
    const { child_id, date, pickup_time, pickup_location, dropoff_time, dropoff_location, activity, status, assigned_driver, assigned_vehicle, notes } = req.body;
    const { data, error } = await supabase.from("ride_requests").update({
      child_id, date, pickup_time, pickup_location, dropoff_time, dropoff_location,
      activity, status, assigned_driver, assigned_vehicle, notes
    }).eq("id", req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });
  app.delete("/api/rides/:id", async (req, res) => {
    const { error } = await supabase.from("ride_requests").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  });

  // Assign driver to a ride
  app.post("/api/rides/:id/assign", async (req, res) => {
    const { driver_id, vehicle_id } = req.body;
    const { data, error } = await supabase.from("ride_requests").update({
      assigned_driver: driver_id,
      assigned_vehicle: vehicle_id || null,
      status: "assigned"
    }).eq("id", req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  // Mark ride as completed and log it
  app.post("/api/rides/:id/complete", async (req, res) => {
    const { miles, notes } = req.body;
    const { data: ride, error: fetchErr } = await supabase.from("ride_requests").select("*").eq("id", req.params.id).single();
    if (fetchErr || !ride) return res.status(404).json({ error: "Ride not found" });

    // Update ride status
    await supabase.from("ride_requests").update({ status: "completed" }).eq("id", req.params.id);

    // Create transport log entry
    const { data, error } = await supabase.from("transport_log").insert([{
      id: nanoid(),
      date: ride.date,
      driver_id: ride.assigned_driver,
      vehicle_id: ride.assigned_vehicle,
      child_ids: [ride.child_id],
      pickup_location: ride.pickup_location,
      dropoff_location: ride.dropoff_location,
      activity: ride.activity,
      miles: miles || null,
      notes: notes || ride.notes,
    }]).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  // ─── CARPOOL GROUPS ───────────────────────────────────────────────────────
  app.get("/api/carpool-groups", async (_req, res) => {
    const { data, error } = await supabase.from("carpool_groups").select("*").order("name");
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  });
  app.post("/api/carpool-groups", async (req, res) => {
    const { name, activity, day_of_week, pickup_time, dropoff_time, pickup_location, dropoff_location, child_ids, rotation, notes } = req.body;
    const { data, error } = await supabase.from("carpool_groups").insert([{
      id: nanoid(), name, activity, day_of_week, pickup_time, dropoff_time,
      pickup_location, dropoff_location, child_ids: child_ids || [], rotation: rotation || [], notes
    }]).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });
  app.put("/api/carpool-groups/:id", async (req, res) => {
    const { name, activity, day_of_week, pickup_time, dropoff_time, pickup_location, dropoff_location, child_ids, rotation, notes, active } = req.body;
    const { data, error } = await supabase.from("carpool_groups").update({
      name, activity, day_of_week, pickup_time, dropoff_time,
      pickup_location, dropoff_location, child_ids, rotation, notes, active
    }).eq("id", req.params.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });
  app.delete("/api/carpool-groups/:id", async (req, res) => {
    const { error } = await supabase.from("carpool_groups").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  });

  // ─── TRANSPORT LOG ────────────────────────────────────────────────────────
  app.get("/api/transport-log", async (req, res) => {
    const { from, to } = req.query as any;
    let query = supabase.from("transport_log").select("*, drivers(name), vehicles(name)").order("date", { ascending: false });
    if (from) query = query.gte("date", from);
    if (to) query = query.lte("date", to);
    const { data, error } = await query.limit(100);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  });
  app.post("/api/transport-log", async (req, res) => {
    const { date, driver_id, vehicle_id, child_ids, pickup_location, dropoff_location, activity, miles, notes } = req.body;
    const { data, error } = await supabase.from("transport_log").insert([{
      id: nanoid(), date, driver_id, vehicle_id, child_ids: child_ids || [],
      pickup_location, dropoff_location, activity, miles, notes
    }]).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  // ─── DAILY SCHEDULE VIEW ──────────────────────────────────────────────────
  // Returns a merged view of all transport needs for a given date
  // Pulls from: ride_requests + sports schedules + events with locations
  app.get("/api/transport/daily/:date", async (req, res) => {
    const { date } = req.params;
    const dayOfWeek = new Date(date + "T12:00:00").getDay(); // 0=Sun, 1=Mon...
    const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const dayName = dayNames[dayOfWeek];

    // 1. Explicit ride requests for this date
    const { data: rides } = await supabase.from("ride_requests")
      .select("*, drivers(name), vehicles(name, color)")
      .eq("date", date)
      .order("pickup_time");

    // 2. Active sports that practice on this day of week
    const { data: sports } = await supabase.from("sports")
      .select("*")
      .eq("active", true);

    const sportRides = (sports || [])
      .filter((s: any) => {
        const days: string[] = Array.isArray(s.days) ? s.days : [];
        return days.some((d: string) => d.toLowerCase() === dayName);
      })
      .map((s: any) => ({
        id: `sport-${s.id}-${date}`,
        child_id: s.child_id,
        date,
        pickup_time: null,
        pickup_location: "Home",
        dropoff_time: s.time,
        dropoff_location: s.location || s.sport,
        activity: `${s.sport}${s.team ? " (" + s.team + ")" : ""}`,
        source_type: "sports",
        source_event_id: s.id,
        status: "auto",
        assigned_driver: null,
        assigned_vehicle: null,
        notes: null,
      }));

    // 3. Events on this date that have a location (likely need transport)
    const { data: events } = await supabase.from("events")
      .select("*")
      .eq("date", date)
      .not("is_template", "eq", true);

    const eventRides = (events || [])
      .filter((e: any) => e.child_ids && e.child_ids.length > 0)
      .flatMap((e: any) => {
        const childIds: string[] = Array.isArray(e.child_ids) ? e.child_ids : [];
        return childIds.map((cid: string) => ({
          id: `event-${e.id}-${cid}`,
          child_id: cid,
          date,
          pickup_time: null,
          pickup_location: "Home",
          dropoff_time: e.time || null,
          dropoff_location: e.notes || e.title,
          activity: e.title,
          source_type: "event",
          source_event_id: e.id,
          status: "auto",
          assigned_driver: null,
          assigned_vehicle: null,
          notes: null,
        }));
      });

    // 4. Carpool groups active on this day
    const { data: carpools } = await supabase.from("carpool_groups")
      .select("*")
      .eq("active", true);

    const carpoolRides = (carpools || [])
      .filter((c: any) => c.day_of_week?.toLowerCase() === dayName)
      .flatMap((c: any) => {
        const childIds: string[] = Array.isArray(c.child_ids) ? c.child_ids : [];
        return childIds.map((cid: string) => ({
          id: `carpool-${c.id}-${cid}`,
          child_id: cid,
          date,
          pickup_time: c.pickup_time,
          pickup_location: c.pickup_location || "Home",
          dropoff_time: c.dropoff_time,
          dropoff_location: c.dropoff_location,
          activity: `${c.name} (carpool)`,
          source_type: "carpool",
          source_event_id: c.id,
          status: "carpool",
          assigned_driver: null,
          assigned_vehicle: null,
          notes: c.notes,
        }));
      });

    const allRides = [
      ...(rides || []),
      ...sportRides,
      ...eventRides,
      ...carpoolRides,
    ].sort((a: any, b: any) => (a.dropoff_time || a.pickup_time || "99:99").localeCompare(b.dropoff_time || b.pickup_time || "99:99"));

    res.json(allRides);
  });

  // ─── CONFLICT DETECTION ───────────────────────────────────────────────────
  // Returns conflicts: two kids needing rides at overlapping times
  app.get("/api/transport/conflicts/:date", async (req, res) => {
    const { date } = req.params;

    // Get all rides for this date (use the daily endpoint logic)
    const { data: rides } = await supabase.from("ride_requests")
      .select("*")
      .eq("date", date)
      .neq("status", "completed")
      .order("pickup_time");

    if (!rides || rides.length < 2) {
      return res.json({ conflicts: [] });
    }

    // Find overlapping time windows for different children
    const conflicts: any[] = [];
    for (let i = 0; i < rides.length; i++) {
      for (let j = i + 1; j < rides.length; j++) {
        const a = rides[i];
        const b = rides[j];
        if (a.child_id === b.child_id) continue; // same kid, not a conflict

        // Check if times overlap (within 15 min window)
        const aTime = a.dropoff_time || a.pickup_time;
        const bTime = b.dropoff_time || b.pickup_time;
        if (aTime && bTime) {
          const diff = Math.abs(timeToMinutes(aTime) - timeToMinutes(bTime));
          if (diff <= 15) {
            conflicts.push({
              ride_a: a,
              ride_b: b,
              overlap_minutes: diff,
              suggestion: "These rides are within 15 minutes of each other — consider combining or assigning different drivers.",
            });
          }
        }
      }
    }

    res.json({ conflicts });
  });

  // ─── RIDE COUNT BADGE ─────────────────────────────────────────────────────
  app.get("/api/rides/count", async (_req, res) => {
    const today = new Date().toISOString().split("T")[0];
    const { count, error } = await supabase.from("ride_requests")
      .select("*", { count: "exact", head: true })
      .eq("date", today)
      .eq("status", "unassigned");
    if (error) return res.status(500).json({ error: error.message });
    res.json({ count: count || 0 });
  });

  // ─── AUTO-GENERATE RIDES FROM SCHEDULE ────────────────────────────────────
  // Creates ride_requests for a given date based on sports/events
  app.post("/api/transport/generate/:date", async (req, res) => {
    const { date } = req.params;
    const dayOfWeek = new Date(date + "T12:00:00").getDay();
    const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const dayName = dayNames[dayOfWeek];

    // Get sports that practice on this day
    const { data: sports } = await supabase.from("sports").select("*").eq("active", true);
    const generated: any[] = [];

    for (const s of sports || []) {
      const days: string[] = Array.isArray(s.days) ? s.days : [];
      if (!days.some((d: string) => d.toLowerCase() === dayName)) continue;

      // Check if a ride already exists for this sport+child+date
      const { data: existing } = await supabase.from("ride_requests")
        .select("id")
        .eq("child_id", s.child_id)
        .eq("date", date)
        .eq("source_event_id", s.id)
        .single();
      if (existing) continue;

      const ride = {
        id: nanoid(),
        child_id: s.child_id,
        date,
        pickup_time: null,
        pickup_location: "Home",
        dropoff_time: s.time || null,
        dropoff_location: s.location || null,
        activity: `${s.sport}${s.team ? " (" + s.team + ")" : ""}`,
        source_event_id: s.id,
        source_type: "sports",
        status: "unassigned",
        notes: null,
      };
      const { error } = await supabase.from("ride_requests").insert([ride]);
      if (!error) generated.push(ride);
    }

    res.json({ generated: generated.length, rides: generated });
  });
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

// ─── ACTIVITY LOG ─────────────────────────────────────────────────────────────
export function registerActivityRoutes(app: Express) {

  // GET /api/activity — latest 200 activity items, newest first
  app.get("/api/activity", async (_req, res) => {
    const { data, error } = await supabase
      .from("activity_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  });

  // GET /api/activity/count?since=ISO — count new items since timestamp
  app.get("/api/activity/count", async (req, res) => {
    const since = req.query.since as string || new Date(0).toISOString();
    const { count, error } = await supabase
      .from("activity_log")
      .select("*", { count: "exact", head: true })
      .gt("created_at", since);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ count: count || 0 });
  });

  // DELETE /api/activity/:id — delete a single activity item
  app.delete("/api/activity/:id", async (req, res) => {
    const { error } = await supabase
      .from("activity_log")
      .delete()
      .eq("id", req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  });

  // POST /api/activity/clear — clear all activity older than 30 days
  app.post("/api/activity/clear", async (_req, res) => {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase
      .from("activity_log")
      .delete()
      .lt("created_at", cutoff);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true, message: "Cleared activity older than 30 days" });
  });
}
