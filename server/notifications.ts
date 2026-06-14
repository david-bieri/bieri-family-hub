/**
 * notifications.ts
 *
 * Shared notification engine for Bieri Family Hub.
 * Dispatches messages to multiple channels: SMS (Twilio), Telegram, and Activity Log (Supabase).
 *
 * ARCHITECTURE:
 *   notify(event) → dispatches to all configured channels
 *   Each channel is independently enabled via env vars.
 *   If a channel fails, others still fire (fail-open).
 *
 * CHANNELS:
 *   - SMS (Twilio): outbound text to David/Nancy
 *   - Telegram Bot: rich messages with inline buttons to family group + DMs
 *   - Activity Log: always writes to `activity_log` table in Supabase
 */

import { createClient } from "@supabase/supabase-js";

// ─── Supabase client ────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_ANON_KEY || ""
);

// ─── Types ──────────────────────────────────────────────────────────────────

export type NotificationType =
  | "digest"           // Morning schedule summary
  | "carpool_reminder" // Upcoming pickup/dropoff
  | "overdue_alert"    // Payment or registration overdue
  | "item_added"       // New item added via SMS/email/Telegram
  | "conflict"         // Scheduling conflict detected
  | "maintenance"      // Home maintenance due
  | "system";          // System events (scan complete, errors)

export type NotificationPriority = "low" | "normal" | "high" | "urgent";

export type NotificationChannel = "sms" | "telegram" | "log";

export interface NotificationPayload {
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  body: string;
  // Rich content (Telegram only)
  markdown?: string;
  buttons?: TelegramButton[];
  // Targeting
  recipients?: string[];  // "david", "nancy", "family_group", "all"
  // Metadata
  related_id?: string;
  related_type?: string;
  channels?: NotificationChannel[];  // Override default channel selection
}

export interface TelegramButton {
  text: string;
  callback_data: string;
}

// ─── Channel Configuration ──────────────────────────────────────────────────

function isTwilioConfigured(): boolean {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  );
}

function isTelegramConfigured(): boolean {
  return !!process.env.TELEGRAM_BOT_TOKEN;
}

// Phone numbers for SMS recipients
const PHONE_BOOK: Record<string, string> = {
  david: process.env.DAVID_PHONE || "",
  nancy: process.env.NANCY_PHONE || "",
};

// Telegram chat IDs
const TELEGRAM_CHATS: Record<string, string> = {
  david: process.env.TELEGRAM_DAVID_CHAT_ID || "",
  nancy: process.env.TELEGRAM_NANCY_CHAT_ID || "",
  family_group: process.env.TELEGRAM_FAMILY_GROUP_ID || "",
};

// ─── Default Channel Selection ──────────────────────────────────────────────

function getDefaultChannels(payload: NotificationPayload): NotificationChannel[] {
  if (payload.channels) return payload.channels;

  // Always log
  const channels: NotificationChannel[] = ["log"];

  // High/urgent priority → SMS + Telegram
  if (payload.priority === "urgent" || payload.priority === "high") {
    if (isTwilioConfigured()) channels.push("sms");
    if (isTelegramConfigured()) channels.push("telegram");
  }
  // Normal priority → Telegram only (less intrusive)
  else if (payload.priority === "normal") {
    if (isTelegramConfigured()) channels.push("telegram");
  }
  // Low priority → log only (visible in Activity Feed)

  // Digests always go to both if configured
  if (payload.type === "digest") {
    if (isTwilioConfigured() && !channels.includes("sms")) channels.push("sms");
    if (isTelegramConfigured() && !channels.includes("telegram")) channels.push("telegram");
  }

  return channels;
}

// ─── SMS (Twilio) Dispatcher ────────────────────────────────────────────────

async function sendSMS(to: string, body: string): Promise<boolean> {
  if (!isTwilioConfigured() || !to) return false;

  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID!;
    const authToken = process.env.TWILIO_AUTH_TOKEN!;
    const fromNumber = process.env.TWILIO_PHONE_NUMBER!;

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

    const params = new URLSearchParams({
      To: to,
      From: fromNumber,
      Body: body,
    });

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
      console.error(`[notifications] SMS failed to ${to}: ${err}`);
      return false;
    }

    console.log(`[notifications] SMS sent to ${to}`);
    return true;
  } catch (err) {
    console.error(`[notifications] SMS error:`, err);
    return false;
  }
}

async function dispatchSMS(payload: NotificationPayload): Promise<void> {
  const recipients = payload.recipients || ["david", "nancy"];
  const text = `${payload.title}\n\n${payload.body}`;

  for (const recipient of recipients) {
    if (recipient === "family_group" || recipient === "all") {
      // Send to both parents
      await sendSMS(PHONE_BOOK.david, text);
      await sendSMS(PHONE_BOOK.nancy, text);
    } else {
      const phone = PHONE_BOOK[recipient];
      if (phone) await sendSMS(phone, text);
    }
  }
}

// ─── Telegram Dispatcher ────────────────────────────────────────────────────

async function sendTelegram(
  chatId: string,
  text: string,
  buttons?: TelegramButton[]
): Promise<boolean> {
  if (!isTelegramConfigured() || !chatId) return false;

  try {
    const token = process.env.TELEGRAM_BOT_TOKEN!;
    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    const body: any = {
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    };

    if (buttons && buttons.length > 0) {
      // Arrange buttons in rows of 2
      const rows: TelegramButton[][] = [];
      for (let i = 0; i < buttons.length; i += 2) {
        rows.push(buttons.slice(i, i + 2));
      }
      body.reply_markup = {
        inline_keyboard: rows.map(row =>
          row.map(btn => ({ text: btn.text, callback_data: btn.callback_data }))
        ),
      };
    }

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error(`[notifications] Telegram failed to ${chatId}: ${err}`);
      return false;
    }

    console.log(`[notifications] Telegram sent to ${chatId}`);
    return true;
  } catch (err) {
    console.error(`[notifications] Telegram error:`, err);
    return false;
  }
}

async function dispatchTelegram(payload: NotificationPayload): Promise<void> {
  const recipients = payload.recipients || ["family_group"];
  const text = payload.markdown || `*${payload.title}*\n\n${payload.body}`;

  for (const recipient of recipients) {
    if (recipient === "all") {
      // Send to group + individual DMs
      await sendTelegram(TELEGRAM_CHATS.family_group, text, payload.buttons);
      await sendTelegram(TELEGRAM_CHATS.david, text, payload.buttons);
      await sendTelegram(TELEGRAM_CHATS.nancy, text, payload.buttons);
    } else if (recipient === "family_group") {
      await sendTelegram(TELEGRAM_CHATS.family_group, text, payload.buttons);
    } else {
      const chatId = TELEGRAM_CHATS[recipient];
      if (chatId) await sendTelegram(chatId, text, payload.buttons);
    }
  }
}

// ─── Activity Log Dispatcher ────────────────────────────────────────────────

async function dispatchLog(payload: NotificationPayload): Promise<void> {
  try {
    const { error } = await supabase.from("activity_log").insert({
      type: payload.type,
      priority: payload.priority,
      title: payload.title,
      body: payload.body,
      related_id: payload.related_id || null,
      related_type: payload.related_type || null,
      channels_used: getDefaultChannels(payload).filter(c => c !== "log"),
    });
    if (error) {
      console.error(`[notifications] Activity log write failed:`, error.message);
    }
  } catch (err) {
    console.error(`[notifications] Activity log error:`, err);
  }
}

// ─── Main Notification Function ─────────────────────────────────────────────

export async function notify(payload: NotificationPayload): Promise<{
  channels_used: NotificationChannel[];
  errors: string[];
}> {
  const channels = getDefaultChannels(payload);
  const errors: string[] = [];
  const used: NotificationChannel[] = [];

  // Always log first
  if (channels.includes("log")) {
    await dispatchLog(payload);
    used.push("log");
  }

  // SMS
  if (channels.includes("sms")) {
    try {
      await dispatchSMS(payload);
      used.push("sms");
    } catch (err: any) {
      errors.push(`sms: ${err.message}`);
    }
  }

  // Telegram
  if (channels.includes("telegram")) {
    try {
      await dispatchTelegram(payload);
      used.push("telegram");
    } catch (err: any) {
      errors.push(`telegram: ${err.message}`);
    }
  }

  if (errors.length > 0) {
    console.warn(`[notifications] Partial failure:`, errors);
  }

  return { channels_used: used, errors };
}

// ─── Convenience Helpers ────────────────────────────────────────────────────

/** Send a quick system notification (log only by default) */
export async function logActivity(
  title: string,
  body: string,
  type: NotificationType = "system"
): Promise<void> {
  await notify({
    type,
    priority: "low",
    title,
    body,
    channels: ["log"],
  });
}

/** Send an urgent alert to parents via all channels */
export async function alertParents(
  title: string,
  body: string,
  type: NotificationType = "overdue_alert"
): Promise<void> {
  await notify({
    type,
    priority: "high",
    title,
    body,
    recipients: ["david", "nancy"],
  });
}

/** Send a message to the Telegram family group with optional buttons */
export async function notifyFamily(
  title: string,
  body: string,
  buttons?: TelegramButton[],
  type: NotificationType = "system"
): Promise<void> {
  await notify({
    type,
    priority: "normal",
    title,
    body,
    markdown: `*${title}*\n\n${body}`,
    buttons,
    recipients: ["family_group"],
  });
}
