/**
 * telegramBot.ts
 *
 * Telegram Bot for Bieri Family Hub.
 *
 * COMMANDS:
 *   /start        — Welcome message and quick reference
 *   /today        — Today's schedule for the family (or a specific person)
 *   /week         — This week's upcoming events
 *   /add <text>   — Quick-add an item (same #TAG @Name syntax as SMS)
 *   /rides        — Today's carpool/transport needs
 *   /overdue      — List overdue payments and registrations
 *   /help         — Show available commands and tag syntax
 *
 * CALLBACK QUERIES (inline button actions):
 *   confirm_add:<importId>       — Confirm a quick-add item
 *   dismiss_add:<importId>       — Dismiss a quick-add item
 *   assign_ride:<rideId>:<driver> — Assign a driver to a ride
 *   complete_ride:<rideId>       — Mark a ride as completed
 *   mark_paid:<paymentId>        — Mark a payment as paid
 *
 * SETUP:
 *   1. Create a bot via @BotFather on Telegram
 *   2. Set TELEGRAM_BOT_TOKEN env var
 *   3. Optionally set TELEGRAM_FAMILY_GROUP_ID for group notifications
 *   4. Bot uses polling (no webhook needed) — simpler for Render free tier
 */

import { createClient } from "@supabase/supabase-js";
import ws from "ws";
import { extractFromEmail } from "./emailExtractor";
import { logActivity } from "./notifications";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey, { realtime: { transport: ws } }) : null as any;

// ─── Types ──────────────────────────────────────────────────────────────────

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

interface TelegramMessage {
  message_id: number;
  chat: { id: number; type: string; title?: string; first_name?: string };
  from?: { id: number; first_name: string; username?: string };
  text?: string;
  date: number;
}

interface TelegramCallbackQuery {
  id: string;
  from: { id: number; first_name: string };
  message?: TelegramMessage;
  data?: string;
}

// ─── Bot State ──────────────────────────────────────────────────────────────

let pollingActive = false;
let lastUpdateId = 0;
const BOT_TOKEN = () => process.env.TELEGRAM_BOT_TOKEN || "";

// ─── Telegram API Helpers ───────────────────────────────────────────────────

async function tgApi(method: string, body?: any): Promise<any> {
  const token = BOT_TOKEN();
  if (!token) return null;

  const url = `https://api.telegram.org/bot${token}/${method}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const err = await response.text();
    console.error(`[telegram] API error (${method}):`, err);
    return null;
  }

  return response.json();
}

async function sendMessage(
  chatId: number | string,
  text: string,
  buttons?: { text: string; callback_data: string }[][],
  parseMode: string = "Markdown"
): Promise<any> {
  const body: any = {
    chat_id: chatId,
    text,
    parse_mode: parseMode,
    disable_web_page_preview: true,
  };

  if (buttons && buttons.length > 0) {
    body.reply_markup = { inline_keyboard: buttons };
  }

  return tgApi("sendMessage", body);
}

async function answerCallback(callbackId: string, text?: string): Promise<void> {
  await tgApi("answerCallbackQuery", {
    callback_query_id: callbackId,
    text: text || "Done!",
  });
}

async function editMessage(
  chatId: number | string,
  messageId: number,
  text: string,
  buttons?: { text: string; callback_data: string }[][]
): Promise<void> {
  const body: any = {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "Markdown",
  };
  if (buttons) {
    body.reply_markup = { inline_keyboard: buttons };
  }
  await tgApi("editMessageText", body);
}

// ─── Command Handlers ───────────────────────────────────────────────────────

async function handleStart(msg: TelegramMessage): Promise<void> {
  const name = msg.from?.first_name || "there";
  await sendMessage(msg.chat.id, `👋 Hi ${name}! I'm the *Bieri Family Hub* bot.

I can help you:
• Add items quickly: \`/add #MED @Clara dentist Thu 2pm\`
• Check today's schedule: \`/today\`
• See this week: \`/week\`
• Check rides: \`/rides\`
• View overdue items: \`/overdue\`

Type /help for the full command list and tag syntax.`);
}

async function handleHelp(msg: TelegramMessage): Promise<void> {
  await sendMessage(msg.chat.id, `📖 *Family Hub Bot Commands*

/today — Today's schedule (all or /today Cole)
/week — This week's events
/add <text> — Quick-add (e.g. /add #SPORT @Cole soccer Tue 6pm)
/rides — Today's transport needs
/overdue — Overdue payments & registrations
/help — This message

*Tag Syntax:*
\`#CAMP\` \`#SPORT\` \`#SCHOOL\` \`#MED\` \`#PAY\`
\`#REG\` \`#PET\` \`#FAM\` \`#OFFICE\` \`#TRAVEL\`
\`#HOUSE\` \`#INVITE\`

*People:*
\`@David\` \`@Nancy\` \`@Cole\` \`@Greta\` \`@Airlie\`
\`@Clara\` \`@Heidi\` \`@Daisy\` \`@Otis\` \`@Athena\` \`@Persephone\`

*Example:*
\`/add #INVITE @Cole @Greta Birthday party at Johnsons Sat 2pm\``);
}

async function handleToday(msg: TelegramMessage, args: string): Promise<void> {
  const today = new Date().toISOString().split("T")[0];

  // Fetch today's events from unified calendar
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
    .order("time", { ascending: true });

  // Fetch today's rides
  const { data: rides } = await supabase
    .from("ride_requests")
    .select("*")
    .eq("date", today)
    .order("pickup_time", { ascending: true });

  const personFilter = args.trim().toLowerCase();
  let lines: string[] = [];

  // Events
  const filteredEvents = personFilter
    ? (events || []).filter((e: any) => e.child_ids?.some((c: string) => c.toLowerCase().includes(personFilter)))
    : (events || []);

  if (filteredEvents.length > 0) {
    lines.push("*📅 Events:*");
    for (const e of filteredEvents) {
      const time = e.time ? `${e.time}` : "all day";
      const who = e.child_ids?.length > 0 ? ` (${e.child_ids.join(", ")})` : "";
      lines.push(`  • ${time} — ${e.title}${who}`);
    }
  }

  // Appointments
  const filteredAppts = personFilter
    ? (appointments || []).filter((a: any) => a.child_id?.toLowerCase().includes(personFilter))
    : (appointments || []);

  if (filteredAppts.length > 0) {
    lines.push("\n*🏥 Appointments:*");
    for (const a of filteredAppts) {
      const time = a.time || "TBD";
      lines.push(`  • ${time} — ${a.type} (${a.child_id})`);
    }
  }

  // Rides
  const filteredRides = personFilter
    ? (rides || []).filter((r: any) => r.child_id?.toLowerCase().includes(personFilter))
    : (rides || []);

  if (filteredRides.length > 0) {
    lines.push("\n*🚗 Transport:*");
    for (const r of filteredRides) {
      const status = r.status === "unassigned" ? "⚠️ NEEDS DRIVER" : `✓ ${r.assigned_driver || "assigned"}`;
      lines.push(`  • ${r.pickup_time || "?"} ${r.child_id} → ${r.dropoff_location || r.activity || "?"} [${status}]`);
    }
  }

  if (lines.length === 0) {
    const who = personFilter ? ` for ${personFilter}` : "";
    await sendMessage(msg.chat.id, `📅 *Today${who}*\n\nNothing scheduled! Enjoy the free day. 🎉`);
  } else {
    const header = personFilter ? `📅 *Today — ${personFilter}*` : `📅 *Today — ${today}*`;
    await sendMessage(msg.chat.id, `${header}\n\n${lines.join("\n")}`);
  }
}

async function handleWeek(msg: TelegramMessage): Promise<void> {
  const today = new Date();
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const startStr = today.toISOString().split("T")[0];
  const endStr = weekEnd.toISOString().split("T")[0];

  const { data: events } = await supabase
    .from("events")
    .select("*")
    .gte("date", startStr)
    .lte("date", endStr)
    .order("date", { ascending: true })
    .order("time", { ascending: true })
    .limit(20);

  if (!events || events.length === 0) {
    await sendMessage(msg.chat.id, "📅 *This Week*\n\nNo events scheduled for the next 7 days.");
    return;
  }

  let lines: string[] = [];
  let currentDate = "";

  for (const e of events) {
    if (e.date !== currentDate) {
      currentDate = e.date;
      const dayName = new Date(e.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      lines.push(`\n*${dayName}:*`);
    }
    const time = e.time || "all day";
    const who = e.child_ids?.length > 0 ? ` (${e.child_ids.join(", ")})` : "";
    lines.push(`  • ${time} — ${e.title}${who}`);
  }

  await sendMessage(msg.chat.id, `📅 *This Week*\n${lines.join("\n")}`);
}

async function handleAdd(msg: TelegramMessage, text: string): Promise<void> {
  if (!text.trim()) {
    await sendMessage(msg.chat.id, `❌ Please provide text to add.\n\nExample: \`/add #MED @Clara dentist Thursday 2pm\``);
    return;
  }

  try {
    const extracted = await extractFromEmail(
      text.trim(),
      msg.from?.first_name || "Telegram",
      "",
      "",
      undefined,
      undefined
    );

    if (extracted.length === 0) {
      await sendMessage(msg.chat.id, `🤔 Couldn't extract an item from that text.\n\nTry using a tag: \`#MED @Clara dentist Thu 2pm\``);
      return;
    }

    // Save to pending_imports
    const importId = `tg-${Date.now()}`;
    const { nanoid } = await import("nanoid");
    const id = nanoid();

    await supabase.from("pending_imports").insert({
      id,
      source: "telegram",
      raw_subject: text.trim(),
      raw_from: msg.from?.first_name || "Telegram",
      raw_date: new Date().toISOString(),
      raw_snippet: `Telegram from ${msg.from?.first_name}`,
      gmail_id: importId,
      extracted,
      status: "pending",
    });

    // Log activity
    await logActivity(
      `Telegram quick-add from ${msg.from?.first_name || "unknown"}`,
      `"${text.trim()}" → ${extracted.length} item(s)`,
      "item_added"
    );

    // Show confirmation with buttons
    const item = extracted[0];
    const details = [
      `📋 *${item.type}*: ${item.title}`,
      item.date ? `📅 ${item.date}${item.time ? ` at ${item.time}` : ""}` : null,
      item.child_ids?.length ? `👤 ${item.child_ids.join(", ")}` : null,
      item.location ? `📍 ${item.location}` : null,
      item.amount ? `💰 ${item.amount}` : null,
    ].filter(Boolean).join("\n");

    const buttons = [
      [
        { text: "✅ Confirm", callback_data: `confirm_add:${id}:0` },
        { text: "❌ Dismiss", callback_data: `dismiss_add:${id}:0` },
      ],
    ];

    await sendMessage(
      msg.chat.id,
      `Got it! Here's what I extracted:\n\n${details}\n\n_Tap Confirm to add to the hub, or Dismiss to discard._`,
      buttons
    );
  } catch (err: any) {
    console.error("[telegram] /add error:", err.message);
    await sendMessage(msg.chat.id, `❌ Error: ${err.message}`);
  }
}

async function handleRides(msg: TelegramMessage): Promise<void> {
  const today = new Date().toISOString().split("T")[0];

  const { data: rides } = await supabase
    .from("ride_requests")
    .select("*")
    .eq("date", today)
    .order("pickup_time", { ascending: true });

  if (!rides || rides.length === 0) {
    await sendMessage(msg.chat.id, "🚗 *Today's Rides*\n\nNo transport needs for today.");
    return;
  }

  const unassigned = rides.filter((r: any) => r.status === "unassigned");
  const assigned = rides.filter((r: any) => r.status !== "unassigned");

  let lines: string[] = [];

  if (unassigned.length > 0) {
    lines.push("⚠️ *Needs Driver:*");
    for (const r of unassigned) {
      lines.push(`  • ${r.pickup_time || "?"} ${r.child_id} → ${r.dropoff_location || r.activity || "?"}`);
    }
  }

  if (assigned.length > 0) {
    lines.push("\n✅ *Assigned:*");
    for (const r of assigned) {
      lines.push(`  • ${r.pickup_time || "?"} ${r.child_id} → ${r.dropoff_location || r.activity || "?"} (${r.assigned_driver || "?"})`);
    }
  }

  // Add "I'll get them" buttons for unassigned rides
  const buttons = unassigned.slice(0, 4).map((r: any) => [
    { text: `🙋 I'll take ${r.child_id} (${r.pickup_time})`, callback_data: `volunteer_ride:${r.id}` },
  ]);

  await sendMessage(msg.chat.id, `🚗 *Today's Rides*\n\n${lines.join("\n")}`, buttons.length > 0 ? buttons : undefined);
}

async function handleOverdue(msg: TelegramMessage): Promise<void> {
  const today = new Date().toISOString().split("T")[0];

  // Overdue payments
  const { data: payments } = await supabase
    .from("payments")
    .select("*")
    .in("status", ["pending", "overdue"])
    .lt("due_date", today);

  // Overdue registrations
  const { data: registrations } = await supabase
    .from("registrations")
    .select("*")
    .in("status", ["pending", "submitted", "in_progress"])
    .lt("deadline", today);

  let lines: string[] = [];

  if (payments && payments.length > 0) {
    lines.push("💰 *Overdue Payments:*");
    for (const p of payments) {
      const who = p.child_id ? ` (${p.child_id})` : "";
      lines.push(`  • ${p.description}${who} — ${p.amount || "?"} due ${p.due_date}`);
    }
  }

  if (registrations && registrations.length > 0) {
    lines.push("\n📝 *Overdue Registrations:*");
    for (const r of registrations) {
      lines.push(`  • ${r.program_name} (${r.child_id}) — deadline was ${r.deadline}`);
    }
  }

  if (lines.length === 0) {
    await sendMessage(msg.chat.id, "✅ *No Overdue Items*\n\nEverything is current! 🎉");
  } else {
    // Add quick-action buttons for payments
    const payButtons = (payments || []).slice(0, 3).map((p: any) => [
      { text: `✅ Mark paid: ${p.description.slice(0, 20)}`, callback_data: `mark_paid:${p.id}` },
    ]);

    await sendMessage(msg.chat.id, `⚠️ *Overdue Items*\n\n${lines.join("\n")}`, payButtons.length > 0 ? payButtons : undefined);
  }
}

// ─── Callback Query Handler ─────────────────────────────────────────────────

async function handleCallback(query: TelegramCallbackQuery): Promise<void> {
  const data = query.data || "";
  const chatId = query.message?.chat.id;
  const messageId = query.message?.message_id;

  if (!chatId || !messageId) {
    await answerCallback(query.id, "Error: no chat context");
    return;
  }

  // ── confirm_add:<importId>:<itemIndex> ──────────────────────────────────────
  if (data.startsWith("confirm_add:")) {
    const [, importId, indexStr] = data.split(":");
    const itemIndex = parseInt(indexStr || "0");

    const { data: record } = await supabase
      .from("pending_imports")
      .select("*")
      .eq("id", importId)
      .single();

    if (!record) {
      await answerCallback(query.id, "Item not found");
      return;
    }

    const items = record.extracted || [];
    const item = items[itemIndex];
    if (!item) {
      await answerCallback(query.id, "Item index invalid");
      return;
    }

    // Import the commit function via the accept endpoint logic
    const { nanoid } = await import("nanoid");
    const id = nanoid();

    // Commit directly based on type
    let commitResult;
    switch (item.type) {
      case "event":
        commitResult = await supabase.from("events").insert({
          id, title: item.title, date: item.date, end_date: item.end_date || null,
          time: item.time, child_ids: item.child_ids || [], category: item.category || "other",
          notes: item.notes, location: item.location,
        });
        break;
      case "appointment":
        commitResult = await supabase.from("medical_appointments").insert({
          id, child_id: item.child_ids?.[0] || "", type: item.title,
          date: item.date, time: item.time, notes: item.notes, status: "scheduled",
        });
        break;
      case "payment":
        commitResult = await supabase.from("payments").insert({
          id, description: item.title, amount: item.amount || "",
          due_date: item.date, child_id: item.child_ids?.[0] || null,
          category: item.category || "payment", status: "pending", notes: item.notes,
        });
        break;
      case "registration":
        commitResult = await supabase.from("registrations").insert({
          id, child_id: item.child_ids?.[0] || "", program_name: item.title,
          deadline: item.date, cost: item.amount, status: "pending", notes: item.notes,
        });
        break;
      case "task":
        commitResult = await supabase.from("maintenance_tasks").insert({
          id, property_id: "prop-cedarview", title: item.title,
          description: item.notes, status: "pending", priority: "normal",
          due_date: item.date, assigned_to: item.child_ids?.[0] || null,
        });
        break;
      default:
        commitResult = await supabase.from("events").insert({
          id, title: item.title, date: item.date, child_ids: item.child_ids || [],
          category: "other", notes: item.notes,
        });
    }

    // Mark as accepted in pending_imports
    items[itemIndex] = { ...item, _accepted: true };
    const allDone = items.every((i: any) => i._accepted || i._dismissed);
    await supabase.from("pending_imports").update({
      extracted: items,
      status: allDone ? "reviewed" : "pending",
      reviewed_at: allDone ? new Date().toISOString() : null,
    }).eq("id", importId);

    await editMessage(chatId, messageId, `✅ *Confirmed!* "${item.title}" has been added to the Family Hub.`);
    await answerCallback(query.id, "Added!");
  }

  // ── dismiss_add:<importId>:<itemIndex> ──────────────────────────────────────
  else if (data.startsWith("dismiss_add:")) {
    const [, importId, indexStr] = data.split(":");
    const itemIndex = parseInt(indexStr || "0");

    const { data: record } = await supabase
      .from("pending_imports")
      .select("extracted")
      .eq("id", importId)
      .single();

    if (record) {
      const items = record.extracted || [];
      if (items[itemIndex]) items[itemIndex]._dismissed = true;
      const allDone = items.every((i: any) => i._accepted || i._dismissed);
      await supabase.from("pending_imports").update({
        extracted: items,
        status: allDone ? "reviewed" : "pending",
      }).eq("id", importId);
    }

    await editMessage(chatId, messageId, `🗑️ Dismissed.`);
    await answerCallback(query.id, "Dismissed");
  }

  // ── volunteer_ride:<rideId> ─────────────────────────────────────────────────
  else if (data.startsWith("volunteer_ride:")) {
    const rideId = data.split(":")[1];
    const driverName = query.from.first_name;

    // Find or create driver
    const { data: driver } = await supabase
      .from("drivers")
      .select("id")
      .ilike("name", driverName)
      .single();

    const driverId = driver?.id || `driver-${driverName.toLowerCase()}`;

    if (!driver) {
      await supabase.from("drivers").insert({
        id: driverId, name: driverName, relationship: "parent", is_family: true, active: true,
      });
    }

    await supabase.from("ride_requests").update({
      status: "assigned",
      assigned_driver: driverId,
    }).eq("id", rideId);

    await editMessage(chatId, messageId, `✅ *${driverName}* is taking this ride!`);
    await answerCallback(query.id, "You're assigned!");

    // Notify the group
    const groupId = process.env.TELEGRAM_FAMILY_GROUP_ID;
    if (groupId && chatId.toString() !== groupId) {
      const { data: ride } = await supabase.from("ride_requests").select("*").eq("id", rideId).single();
      if (ride) {
        await sendMessage(groupId, `🚗 *${driverName}* volunteered to take ${ride.child_id} at ${ride.pickup_time || "?"}`);
      }
    }
  }

  // ── mark_paid:<paymentId> ───────────────────────────────────────────────────
  else if (data.startsWith("mark_paid:")) {
    const paymentId = data.split(":")[1];

    await supabase.from("payments").update({
      status: "paid",
      paid_date: new Date().toISOString().split("T")[0],
    }).eq("id", paymentId);

    await editMessage(chatId, messageId, `✅ Payment marked as paid!`);
    await answerCallback(query.id, "Marked as paid!");
  }
}

// ─── Message Router ─────────────────────────────────────────────────────────

async function handleMessage(msg: TelegramMessage): Promise<void> {
  // Strip @BotName suffix from commands in group chats (e.g., /today@BieriFamilyHubBot → /today)
  const rawText = msg.text || "";
  const text = rawText.replace(/@\w+/g, "").trim();

  if (text.startsWith("/start")) return handleStart(msg);
  if (text.startsWith("/help")) return handleHelp(msg);
  if (text.startsWith("/today")) return handleToday(msg, text.replace(/^\/today\s*/i, ""));
  if (text.startsWith("/week")) return handleWeek(msg);
  if (text.startsWith("/add")) return handleAdd(msg, text.replace(/^\/add\s*/i, ""));
  if (text.startsWith("/rides")) return handleRides(msg);
  if (text.startsWith("/overdue")) return handleOverdue(msg);

  // If text contains #TAG, treat as quick-add even without /add prefix
  if (/#(CAMP|SPORT|SCHOOL|MED|PAY|REG|PET|FAM|OFFICE|TRAVEL|HOUSE|INVITE)/i.test(text)) {
    return handleAdd(msg, text);
  }

  // Unknown command or plain text
  if (text.startsWith("/")) {
    await sendMessage(msg.chat.id, `Unknown command. Type /help for available commands.`);
  }
  // Plain text in group chats is ignored (don't spam)
  // Plain text in DMs gets a gentle nudge
  else if (msg.chat.type === "private") {
    await sendMessage(msg.chat.id, `💡 Tip: Use /add followed by your text, or include a #TAG to quick-add items.\n\nType /help for all commands.`);
  }
}

// ─── Polling Loop ───────────────────────────────────────────────────────────

async function pollUpdates(): Promise<void> {
  if (!BOT_TOKEN()) return;

  try {
    const result = await tgApi("getUpdates", {
      offset: lastUpdateId + 1,
      timeout: 30,
      allowed_updates: ["message", "callback_query"],
    });

    if (!result?.result) return;

    const updates: TelegramUpdate[] = result.result;

    for (const update of updates) {
      lastUpdateId = Math.max(lastUpdateId, update.update_id);

      try {
        if (update.message) {
          await handleMessage(update.message);
        } else if (update.callback_query) {
          await handleCallback(update.callback_query);
        }
      } catch (err: any) {
        console.error(`[telegram] Error handling update ${update.update_id}:`, err.message);
      }
    }
  } catch (err: any) {
    // Network errors during polling are normal (timeout, etc.)
    if (!err.message?.includes("ETIMEDOUT")) {
      console.error("[telegram] Polling error:", err.message);
    }
  }
}

// ─── Bot Lifecycle ──────────────────────────────────────────────────────────

let restartAttempts = 0;
const MAX_RESTART_ATTEMPTS = 10;
const BASE_RESTART_DELAY_MS = 3000; // 3 seconds, doubles each attempt

function scheduleRestart(): void {
  if (restartAttempts >= MAX_RESTART_ATTEMPTS) {
    console.error(`[telegram] Max restart attempts (${MAX_RESTART_ATTEMPTS}) reached. Bot stopped.`);
    return;
  }
  const delay = BASE_RESTART_DELAY_MS * Math.pow(2, restartAttempts);
  restartAttempts++;
  console.log(`[telegram] Scheduling restart attempt ${restartAttempts}/${MAX_RESTART_ATTEMPTS} in ${delay / 1000}s...`);
  setTimeout(() => {
    pollingActive = false; // Reset so startTelegramBot doesn't bail
    startTelegramBot();
  }, delay);
}

export function startTelegramBot(): void {
  if (!BOT_TOKEN()) {
    console.log("[telegram] TELEGRAM_BOT_TOKEN not set — bot disabled");
    return;
  }

  if (pollingActive) {
    console.log("[telegram] Bot already running");
    return;
  }

  pollingActive = true;
  console.log("[telegram] Bot starting (long-polling mode)...");

  // Set bot commands for autocomplete
  tgApi("setMyCommands", {
    commands: [
      { command: "today", description: "Today's schedule" },
      { command: "week", description: "This week's events" },
      { command: "add", description: "Quick-add an item (#TAG @Name text)" },
      { command: "rides", description: "Today's transport needs" },
      { command: "overdue", description: "Overdue payments & registrations" },
      { command: "help", description: "Show commands and syntax" },
    ],
  });

  // Start polling loop with auto-restart on crash
  const loop = async () => {
    while (pollingActive) {
      await pollUpdates();
      // Small delay between polls to prevent tight loops on error
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  loop()
    .then(() => {
      // Loop exited cleanly (pollingActive set to false externally)
      console.log("[telegram] Polling loop exited cleanly");
    })
    .catch(err => {
      console.error("[telegram] Polling loop crashed:", err.message || err);
      pollingActive = false;
      scheduleRestart();
    });

  // Reset restart counter on successful start (if we stay alive for 60s)
  setTimeout(() => {
    if (pollingActive) {
      restartAttempts = 0;
    }
  }, 60000);
}

export function stopTelegramBot(): void {
  pollingActive = false;
  console.log("[telegram] Bot stopped");
}

/** Check if the Telegram bot is configured */
export function isTelegramBotConfigured(): boolean {
  return !!BOT_TOKEN();
}
