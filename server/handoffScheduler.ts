/**
 * server/handoffScheduler.ts
 * Homeschool Module — Custody Handoff Digest Scheduler
 *
 * Automatically generates and sends a weekly academic summary digest
 * when custody transitions between households (Sunday evening).
 *
 * INTEGRATION:
 *   - Hooks into the main hub's notificationScheduler pattern
 *   - Uses Telegram and/or SMS (Twilio) for delivery
 *   - Queries academic_progress and portfolio_artifacts for the week
 *   - Generates summary via LLM (Perplexity Sonar / OpenAI fallback)
 *
 * SCHEDULE:
 *   - Runs every Sunday at 6:00 PM local time
 *   - Checks custody_schedule to determine if a transition is happening
 *   - If yes, generates digest and sends to the receiving household
 */

import { createClient } from "@supabase/supabase-js";
import { nanoid } from "nanoid";
import ws from "ws";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
// Service-role key bypasses RLS; fall back to anon key (scheduled tasks run server-side)
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey, { realtime: { transport: ws } });

// ─── Types ───────────────────────────────────────────────────────────────────

interface NotificationChannel {
  type: 'telegram' | 'sms' | 'email';
  target: string;  // chat_id, phone number, or email address
}

interface HandoffConfig {
  // Notification targets for each household
  bieriHousehold: NotificationChannel[];
  coparentHousehold: NotificationChannel[];
  // Schedule
  handoffDay: number;  // 0 = Sunday, 1 = Monday, etc.
  handoffHour: number; // 24h format
}

const DEFAULT_CONFIG: HandoffConfig = {
  bieriHousehold: [
    { type: 'telegram', target: process.env.TELEGRAM_CHAT_ID_DAVID || '' },
    { type: 'telegram', target: process.env.TELEGRAM_CHAT_ID_NANCY || '' },
  ],
  coparentHousehold: [
    { type: 'sms', target: process.env.COPARENT_PHONE || '' },
  ],
  handoffDay: 0,  // Sunday
  handoffHour: 18, // 6 PM
};

// ─── Main Scheduler Function ─────────────────────────────────────────────────

/**
 * Called by the main notification scheduler (e.g., via cron or setInterval).
 * Checks if today is a custody transition day and generates/sends the digest.
 */
export async function checkAndSendHandoffDigest(config?: Partial<HandoffConfig>): Promise<void> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const now = new Date();

  // Only run on the configured handoff day
  if (now.getDay() !== cfg.handoffDay) return;
  if (now.getHours() !== cfg.handoffHour) return;

  console.log("[handoff] Checking for custody transition...");

  // Determine the current week (Monday start)
  const monday = getMonday(now);
  const mondayStr = monday.toISOString().split('T')[0];

  // Check custody schedule for this week
  const { data: schedule } = await supabase
    .from("custody_schedule")
    .select("*")
    .eq("week_start", mondayStr)
    .single();

  if (!schedule) {
    console.log("[handoff] No custody schedule entry for this week, inferring from alternating pattern...");
    // If no explicit schedule, use alternating week logic
    // (Week number since epoch, mod 2)
  }

  // Determine which household is handing off and which is receiving
  const currentHousehold = schedule?.household_id || inferCurrentHousehold(monday);
  const nextHousehold = currentHousehold === 'hh-bieri' ? 'hh-coparent' : 'hh-bieri';

  console.log(`[handoff] Transition: ${currentHousehold} → ${nextHousehold}`);

  // Fetch this week's progress for Cole & Airlie
  const weekEnd = new Date(monday);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndStr = weekEnd.toISOString().split('T')[0];

  const { data: progress } = await supabase
    .from("academic_progress")
    .select("*")
    .in("child_id", ["cole", "airlie"])
    .gte("date", mondayStr)
    .lte("date", weekEndStr)
    .order("date");

  const { data: artifacts } = await supabase
    .from("portfolio_artifacts")
    .select("*")
    .in("child_id", ["cole", "airlie"])
    .gte("date", mondayStr)
    .lte("date", weekEndStr);

  // Fetch upcoming plans for next week
  const nextMonday = new Date(monday);
  nextMonday.setDate(nextMonday.getDate() + 7);
  const nextMondayStr = nextMonday.toISOString().split('T')[0];

  const { data: plans } = await supabase
    .from("curriculum_plans")
    .select("*")
    .in("child_id", ["cole", "airlie"])
    .eq("status", "active")
    .gte("start_date", nextMondayStr);

  // Generate the digest
  const summaryText = await generateDigest(progress || [], artifacts || [], plans || [], mondayStr);

  // Store in database
  const digestId = nanoid();
  await supabase.from("handoff_digests").insert([{
    id: digestId,
    week_start: mondayStr,
    from_household: currentHousehold,
    to_household: nextHousehold,
    child_ids: ["cole", "airlie"],
    summary_text: summaryText,
    progress_data: { progress, artifacts, plans },
    sent_at: new Date().toISOString(),
    sent_via: 'telegram',
  }]);

  // Send notifications to the receiving household
  const targets = nextHousehold === 'hh-bieri' ? cfg.bieriHousehold : cfg.coparentHousehold;
  for (const channel of targets) {
    await sendNotification(channel, summaryText);
  }

  console.log(`[handoff] Digest ${digestId} sent successfully.`);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function inferCurrentHousehold(monday: Date): string {
  // Simple alternating week pattern based on a known reference week.
  // Reference: Week of 2026-01-05 = Bieri household
  const referenceMonday = new Date('2026-01-05');
  const weeksDiff = Math.floor((monday.getTime() - referenceMonday.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return weeksDiff % 2 === 0 ? 'hh-bieri' : 'hh-coparent';
}

async function generateDigest(
  progress: any[],
  artifacts: any[],
  plans: any[],
  weekStart: string,
): Promise<string> {
  const prompt = `Generate a warm, concise weekly academic handoff digest for a shared-custody homeschooling arrangement.

Week: ${weekStart}
Children: Cole (14) and Airlie (11)

PROGRESS THIS WEEK:
${JSON.stringify(progress.map(p => ({ child: p.child_id, subject: p.subject_name || p.subject_id, title: p.title, duration: p.duration_min, score: p.mastery_score })), null, 2)}

PORTFOLIO ITEMS:
${JSON.stringify(artifacts.map(a => ({ child: a.child_id, title: a.title, type: a.artifact_type })), null, 2)}

UPCOMING PLANS:
${JSON.stringify(plans.map(p => ({ child: p.child_id, title: p.title, objectives: p.objectives })), null, 2)}

Format as a brief, friendly message suitable for SMS/Telegram. Include:
1. Quick summary of each child's week (2-3 bullet points each)
2. Any highlights or milestones
3. What's planned for next week
4. Any items needing attention from the receiving household

Keep it under 500 words. Use emoji sparingly for readability.`;

  try {
    const apiKey = process.env.PERPLEXITY_API_KEY || process.env.OPENAI_API_KEY;
    const apiBase = process.env.PERPLEXITY_API_KEY
      ? "https://api.perplexity.ai/chat/completions"
      : `${process.env.OPENAI_API_BASE || "https://api.openai.com/v1"}/chat/completions`;
    const model = process.env.PERPLEXITY_API_KEY ? "sonar" : "gpt-4o-mini";

    if (!apiKey) return buildFallbackDigest(progress, artifacts, plans, weekStart);

    const response = await fetch(apiBase, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 800,
      }),
    });

    const result = await response.json();
    return result.choices?.[0]?.message?.content || buildFallbackDigest(progress, artifacts, plans, weekStart);
  } catch (err) {
    console.error("[handoff] LLM failed:", err);
    return buildFallbackDigest(progress, artifacts, plans, weekStart);
  }
}

function buildFallbackDigest(progress: any[], artifacts: any[], plans: any[], weekStart: string): string {
  const cole = progress.filter(p => p.child_id === 'cole');
  const airlie = progress.filter(p => p.child_id === 'airlie');

  return `📚 Weekly Academic Handoff — Week of ${weekStart}

**Cole** (${cole.length} sessions logged)
${cole.slice(0, 5).map(p => `• ${p.title || 'Activity'} ${p.duration_min ? `(${p.duration_min}min)` : ''}`).join('\n') || '• No entries this week'}

**Airlie** (${airlie.length} sessions logged)
${airlie.slice(0, 5).map(p => `• ${p.title || 'Activity'} ${p.duration_min ? `(${p.duration_min}min)` : ''}`).join('\n') || '• No entries this week'}

📎 ${artifacts.length} portfolio item(s) uploaded
📋 ${plans.length} plan(s) active for next week

—
Auto-generated by Bieri Family Hub`;
}

// ─── Notification Delivery ───────────────────────────────────────────────────

async function sendNotification(channel: NotificationChannel, message: string): Promise<void> {
  if (!channel.target) return;

  switch (channel.type) {
    case 'telegram':
      await sendTelegram(channel.target, message);
      break;
    case 'sms':
      await sendSMS(channel.target, message);
      break;
    case 'email':
      // Email delivery can be added later
      console.log(`[handoff] Email delivery not yet implemented for ${channel.target}`);
      break;
  }
}

async function sendTelegram(chatId: string, message: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken || !chatId) return;

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "Markdown",
      }),
    });
  } catch (err) {
    console.error("[handoff] Telegram send failed:", err);
  }
}

async function sendSMS(phone: string, message: string): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber || !phone) return;

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: phone,
        From: fromNumber,
        Body: message.slice(0, 1600), // SMS character limit
      }),
    });
  } catch (err) {
    console.error("[handoff] SMS send failed:", err);
  }
}

// ─── Scheduler Entry Point ───────────────────────────────────────────────────
/**
 * Start the handoff digest scheduler.
 * Checks every hour if it's Sunday evening (6 PM) and sends the digest.
 */
export function startHandoffScheduler(): void {
  console.log("[handoff] Scheduler started — checks hourly for custody transitions");

  // Check every hour
  setInterval(async () => {
    try {
      await checkAndSendHandoffDigest();
    } catch (err) {
      console.error("[handoff] Digest generation failed:", err);
    }
  }, 60 * 60 * 1000); // 1 hour
}

// ─── Export for testing ──────────────────────────────────────────────────────
export { getMonday, inferCurrentHousehold, buildFallbackDigest };
