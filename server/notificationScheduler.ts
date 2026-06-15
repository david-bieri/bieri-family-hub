/**
 * notificationScheduler.ts
 *
 * Scheduled outbound notifications for Bieri Family Hub.
 *
 * SCHEDULES:
 *   - Morning Digest: 6:45am EDT daily → summary of today's events, rides, overdue items
 *   - Carpool Reminders: 30 min before each unassigned ride → urgent alert to parents
 *   - Overdue Sweep: 8:00am EDT daily → flag newly overdue payments/registrations
 *   - Evening Prep: 8:00pm EDT daily → tomorrow's preview (optional)
 *
 * All notifications go through the shared notification engine (notifications.ts)
 * which dispatches to SMS + Telegram based on priority and configuration.
 */

import { createClient } from "@supabase/supabase-js";
import ws from "ws";
import { notify, alertParents, notifyFamily, logActivity } from "./notifications";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey, { realtime: { transport: ws } }) : null as any;

// ─── Time Utilities ─────────────────────────────────────────────────────────

function getEDTNow(): Date {
  // Get current time in EDT (UTC-4)
  const now = new Date();
  const utcOffset = now.getTimezoneOffset();
  const edtOffset = 4 * 60; // EDT is UTC-4
  const edtTime = new Date(now.getTime() + (utcOffset - edtOffset) * 60000);
  return edtTime;
}

function getTodayStr(): string {
  return getEDTNow().toISOString().split("T")[0];
}

function getTomorrowStr(): string {
  const tomorrow = getEDTNow();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split("T")[0];
}

// ─── Morning Digest ─────────────────────────────────────────────────────────

export async function sendMorningDigest(): Promise<void> {
  const today = getTodayStr();
  const dayName = new Date(today + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  console.log(`[scheduler] Sending morning digest for ${today}...`);

  // Fetch today's events
  const { data: events } = await supabase
    .from("events")
    .select("*")
    .eq("date", today)
    .order("time", { ascending: true });

  // Fetch today's appointments
  const { data: appointments } = await supabase
    .from("medical_appointments")
    .select("*")
    .eq("date", today)
    .eq("status", "scheduled");

  // Fetch today's rides
  const { data: rides } = await supabase
    .from("ride_requests")
    .select("*")
    .eq("date", today)
    .order("pickup_time", { ascending: true });

  // Fetch overdue payments
  const { data: overduePayments } = await supabase
    .from("payments")
    .select("*")
    .in("status", ["pending", "overdue"])
    .lt("due_date", today);

  // Fetch overdue maintenance
  const { data: overdueTasks } = await supabase
    .from("maintenance_tasks")
    .select("*")
    .in("status", ["pending", "in_progress"])
    .lt("due_date", today);

  // Build digest
  const sections: string[] = [];
  let smsLines: string[] = [];

  // Events section
  if (events && events.length > 0) {
    const eventLines = events.map((e: any) => {
      const time = e.time || "all day";
      const who = e.child_ids?.length > 0 ? ` (${e.child_ids.join(", ")})` : "";
      return `  • ${time} — ${e.title}${who}`;
    });
    sections.push(`📅 *Events:*\n${eventLines.join("\n")}`);
    smsLines.push(...events.slice(0, 3).map((e: any) => `${e.time || "all day"}: ${e.title}`));
  }

  // Appointments section
  if (appointments && appointments.length > 0) {
    const apptLines = appointments.map((a: any) => {
      return `  • ${a.time || "TBD"} — ${a.type} (${a.child_id})`;
    });
    sections.push(`🏥 *Appointments:*\n${apptLines.join("\n")}`);
    smsLines.push(...appointments.map((a: any) => `${a.time || "?"}: ${a.type} (${a.child_id})`));
  }

  // Transport section
  if (rides && rides.length > 0) {
    const unassigned = rides.filter((r: any) => r.status === "unassigned");
    const rideLines = rides.map((r: any) => {
      const status = r.status === "unassigned" ? "⚠️ NEEDS DRIVER" : `✓ ${r.assigned_driver || "assigned"}`;
      return `  • ${r.pickup_time || "?"} ${r.child_id} → ${r.activity || "?"} [${status}]`;
    });
    sections.push(`🚗 *Transport (${unassigned.length} need drivers):*\n${rideLines.join("\n")}`);
    if (unassigned.length > 0) {
      smsLines.push(`⚠️ ${unassigned.length} ride(s) need a driver!`);
    }
  }

  // Overdue section
  const overdueCount = (overduePayments?.length || 0) + (overdueTasks?.length || 0);
  if (overdueCount > 0) {
    const items: string[] = [];
    if (overduePayments?.length) items.push(`${overduePayments.length} payment(s)`);
    if (overdueTasks?.length) items.push(`${overdueTasks.length} maintenance task(s)`);
    sections.push(`⚠️ *Overdue:* ${items.join(", ")}`);
    smsLines.push(`Overdue: ${items.join(", ")}`);
  }

  // If nothing at all
  if (sections.length === 0) {
    sections.push("Nothing scheduled today — enjoy the free day! 🎉");
    smsLines.push("Nothing scheduled today!");
  }

  const telegramBody = `☀️ *Good Morning! — ${dayName}*\n\n${sections.join("\n\n")}`;
  const smsBody = `Family Hub - ${dayName}\n${smsLines.join("\n")}`;

  await notify({
    type: "digest",
    priority: "normal",
    title: `Morning Digest — ${dayName}`,
    body: smsBody,
    markdown: telegramBody,
    recipients: ["family_group", "david", "nancy"],
    buttons: rides?.some((r: any) => r.status === "unassigned")
      ? [{ text: "🚗 View Rides", callback_data: "cmd:rides" }]
      : undefined,
  });

  console.log(`[scheduler] Morning digest sent (${events?.length || 0} events, ${rides?.length || 0} rides)`);
}

// ─── Carpool Reminders ──────────────────────────────────────────────────────

export async function checkCarpoolReminders(): Promise<void> {
  const today = getTodayStr();
  const now = getEDTNow();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Find unassigned rides in the next 45 minutes
  const { data: rides } = await supabase
    .from("ride_requests")
    .select("*")
    .eq("date", today)
    .eq("status", "unassigned");

  if (!rides || rides.length === 0) return;

  for (const ride of rides) {
    if (!ride.pickup_time) continue;

    // Parse pickup time (HH:MM format)
    const [hours, minutes] = ride.pickup_time.split(":").map(Number);
    if (isNaN(hours) || isNaN(minutes)) continue;

    const rideMinutes = hours * 60 + minutes;
    const minutesUntil = rideMinutes - currentMinutes;

    // Send reminder 30-45 minutes before
    if (minutesUntil > 0 && minutesUntil <= 45) {
      // Check if we already sent a reminder (use activity log to deduplicate)
      const reminderId = `carpool-remind-${ride.id}-${today}`;
      const { data: existing } = await supabase
        .from("activity_log")
        .select("id")
        .eq("related_id", reminderId)
        .single();

      if (existing) continue; // Already reminded

      await notify({
        type: "carpool_reminder",
        priority: "high",
        title: `🚗 Ride needed in ${minutesUntil} min!`,
        body: `${ride.child_id} needs a ride to ${ride.dropoff_location || ride.activity || "?"} at ${ride.pickup_time}. No driver assigned yet!`,
        markdown: `🚨 *Ride needed in ${minutesUntil} min!*\n\n👤 ${ride.child_id}\n📍 ${ride.dropoff_location || ride.activity || "?"}\n⏰ ${ride.pickup_time}\n\n_No driver assigned!_`,
        recipients: ["david", "nancy"],
        related_id: reminderId,
        related_type: "carpool_reminder",
        buttons: [
          { text: "🙋 I'll get them", callback_data: `volunteer_ride:${ride.id}` },
        ],
      });

      console.log(`[scheduler] Carpool reminder sent for ${ride.child_id} at ${ride.pickup_time}`);
    }
  }
}

// ─── Overdue Sweep ──────────────────────────────────────────────────────────

export async function runOverdueSweep(): Promise<void> {
  const today = getTodayStr();
  console.log(`[scheduler] Running overdue sweep for ${today}...`);

  // Auto-mark payments as overdue
  const { data: newlyOverdue } = await supabase
    .from("payments")
    .select("*")
    .eq("status", "pending")
    .lt("due_date", today);

  if (newlyOverdue && newlyOverdue.length > 0) {
    // Update status to overdue
    const ids = newlyOverdue.map((p: any) => p.id);
    await supabase
      .from("payments")
      .update({ status: "overdue" })
      .in("id", ids);

    // Notify
    const items = newlyOverdue.map((p: any) => `${p.description} (${p.amount || "?"})`).join(", ");
    await alertParents(
      `⚠️ ${newlyOverdue.length} payment(s) now overdue`,
      `The following are past due: ${items}`,
      "overdue_alert"
    );

    console.log(`[scheduler] Marked ${newlyOverdue.length} payment(s) as overdue`);
  }

  // Check for overdue registrations
  const { data: overdueRegs } = await supabase
    .from("registrations")
    .select("*")
    .in("status", ["pending", "submitted"])
    .lt("deadline", today);

  if (overdueRegs && overdueRegs.length > 0) {
    const items = overdueRegs.map((r: any) => `${r.program_name} (${r.child_id})`).join(", ");
    await alertParents(
      `⚠️ ${overdueRegs.length} registration deadline(s) passed`,
      `Past deadline: ${items}`,
      "overdue_alert"
    );
  }

  // Check for overdue maintenance tasks
  const { data: overdueMaint } = await supabase
    .from("maintenance_tasks")
    .select("*")
    .eq("status", "pending")
    .lt("due_date", today);

  if (overdueMaint && overdueMaint.length > 0) {
    await logActivity(
      `${overdueMaint.length} maintenance task(s) overdue`,
      overdueMaint.map((t: any) => t.title).join(", "),
      "maintenance"
    );
  }
}

// ─── Evening Preview (Tomorrow) ─────────────────────────────────────────────

export async function sendEveningPreview(): Promise<void> {
  const tomorrow = getTomorrowStr();
  const dayName = new Date(tomorrow + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  // Fetch tomorrow's events
  const { data: events } = await supabase
    .from("events")
    .select("*")
    .eq("date", tomorrow)
    .order("time", { ascending: true });

  // Fetch tomorrow's rides
  const { data: rides } = await supabase
    .from("ride_requests")
    .select("*")
    .eq("date", tomorrow)
    .order("pickup_time", { ascending: true });

  if ((!events || events.length === 0) && (!rides || rides.length === 0)) {
    // Nothing tomorrow — skip the notification
    return;
  }

  const sections: string[] = [];

  if (events && events.length > 0) {
    const lines = events.map((e: any) => {
      const time = e.time || "all day";
      const who = e.child_ids?.length > 0 ? ` (${e.child_ids.join(", ")})` : "";
      return `  • ${time} — ${e.title}${who}`;
    });
    sections.push(`📅 *Events:*\n${lines.join("\n")}`);
  }

  if (rides && rides.length > 0) {
    const unassigned = rides.filter((r: any) => r.status === "unassigned");
    if (unassigned.length > 0) {
      sections.push(`🚗 *${unassigned.length} ride(s) need drivers tomorrow*`);
    }
  }

  await notify({
    type: "digest",
    priority: "low",
    title: `Tomorrow — ${dayName}`,
    body: sections.join("\n"),
    markdown: `🌙 *Tomorrow — ${dayName}*\n\n${sections.join("\n\n")}`,
    recipients: ["family_group"],
    channels: ["telegram", "log"], // Evening preview is Telegram-only (not SMS)
  });
}

// ─── Scheduler Engine ───────────────────────────────────────────────────────

let schedulerInterval: NodeJS.Timeout | null = null;
let lastDigestDate = "";
let lastOverdueDate = "";
let lastEveningDate = "";

/**
 * Main scheduler tick — runs every 5 minutes.
 * Checks what notifications need to be sent based on current time.
 */
async function schedulerTick(): Promise<void> {
  const now = getEDTNow();
  const today = getTodayStr();
  const hour = now.getHours();
  const minute = now.getMinutes();

  try {
    // Morning Digest: 6:45am EDT (once per day)
    if (hour === 6 && minute >= 45 && minute < 50 && lastDigestDate !== today) {
      lastDigestDate = today;
      await sendMorningDigest();
    }

    // Overdue Sweep: 8:00am EDT (once per day)
    if (hour === 8 && minute >= 0 && minute < 5 && lastOverdueDate !== today) {
      lastOverdueDate = today;
      await runOverdueSweep();
    }

    // Carpool Reminders: check every tick (5 min) during active hours (7am-8pm)
    if (hour >= 7 && hour <= 20) {
      await checkCarpoolReminders();
    }

    // Evening Preview: 8:00pm EDT (once per day)
    if (hour === 20 && minute >= 0 && minute < 5 && lastEveningDate !== today) {
      lastEveningDate = today;
      await sendEveningPreview();
    }
  } catch (err: any) {
    console.error("[scheduler] Tick error:", err.message);
  }
}

/** Start the notification scheduler (5-minute interval) */
export function startNotificationScheduler(): void {
  if (schedulerInterval) {
    console.log("[scheduler] Already running");
    return;
  }

  console.log("[scheduler] Starting notification scheduler (5-min interval)...");

  // Run first tick after 10 seconds (let server finish starting)
  setTimeout(() => {
    schedulerTick();
  }, 10_000);

  // Then every 5 minutes
  schedulerInterval = setInterval(schedulerTick, 5 * 60 * 1000);
}

/** Stop the notification scheduler */
export function stopNotificationScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[scheduler] Stopped");
  }
}

// ─── Manual Trigger Endpoints (for testing) ─────────────────────────────────

import type { Express } from "express";

export function registerSchedulerRoutes(app: Express): void {
  // POST /api/notifications/digest — manually trigger morning digest
  app.post("/api/notifications/digest", async (_req, res) => {
    try {
      await sendMorningDigest();
      res.json({ ok: true, message: "Morning digest sent" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/notifications/overdue-sweep — manually trigger overdue sweep
  app.post("/api/notifications/overdue-sweep", async (_req, res) => {
    try {
      await runOverdueSweep();
      res.json({ ok: true, message: "Overdue sweep complete" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/notifications/carpool-check — manually trigger carpool reminders
  app.post("/api/notifications/carpool-check", async (_req, res) => {
    try {
      await checkCarpoolReminders();
      res.json({ ok: true, message: "Carpool check complete" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/notifications/evening-preview — manually trigger evening preview
  app.post("/api/notifications/evening-preview", async (_req, res) => {
    try {
      await sendEveningPreview();
      res.json({ ok: true, message: "Evening preview sent" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/notifications/status — check scheduler status
  app.get("/api/notifications/status", (_req, res) => {
    res.json({
      scheduler_running: !!schedulerInterval,
      last_digest_date: lastDigestDate || null,
      last_overdue_date: lastOverdueDate || null,
      last_evening_date: lastEveningDate || null,
      twilio_configured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
      telegram_configured: !!process.env.TELEGRAM_BOT_TOKEN,
      gmail_configured: !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD),
    });
  });
}
