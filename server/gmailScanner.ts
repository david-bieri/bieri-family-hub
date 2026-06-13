/**
 * gmailScanner.ts — Direct Gmail IMAP scanner for Bieri Family Hub
 *
 * This module provides a self-contained email scanner that connects directly
 * to Gmail via IMAP using an App Password. It's used by the "Scan Now" button
 * and can also run as a standalone cron replacement.
 *
 * Requirements:
 *   - GMAIL_USER: the Gmail address (e.g. bieri.family.hub@gmail.com)
 *   - GMAIL_APP_PASSWORD: a Google App Password (not the account password)
 *     Generate at: https://myaccount.google.com/apppasswords (2FA must be enabled)
 *
 * Architecture:
 *   1. Connect to Gmail via IMAP (imapflow)
 *   2. Search for recent unread/relevant emails (last N days)
 *   3. Parse each message (mailparser) — body, HTML, attachments
 *   4. Return structured email data for the emailExtractor to process
 */

import { ImapFlow } from "imapflow";
import { simpleParser, ParsedMail } from "mailparser";

// ─── Config ─────────────────────────────────────────────────────────────────

const GMAIL_USER = process.env.GMAIL_USER || process.env.GMAIL_ADDRESS || "";
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || "";
const LOOK_BACK_DAYS = parseInt(process.env.GMAIL_LOOKBACK_DAYS || "3", 10);

// Search queries to match family-relevant emails
const SEARCH_KEYWORDS = [
  "registration", "deadline", "payment", "appointment",
  "schedule", "practice", "camp", "school", "field trip",
  "permission", "vaccine", "doctor", "invitation", "RSVP",
  "maintenance", "repair", "enrollment", "birthday",
];

// Max attachment size to process (5MB)
const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024;

// Processable attachment types
const PROCESSABLE_TYPES = new Set([
  "application/pdf",
  "text/calendar",
  "text/plain",
  "text/html",
  "text/csv",
  "application/ics",
]);

const PROCESSABLE_EXTENSIONS = new Set([".pdf", ".ics", ".txt", ".html", ".htm", ".csv"]);

export interface ScannedEmail {
  gmail_id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
  body: string | null;
  html_body: string | null;
  attachments: ScannedAttachment[];
}

export interface ScannedAttachment {
  filename: string;
  mime_type: string;
  content_text: string;
  content_base64: string;
}

/**
 * Check if Gmail IMAP credentials are configured
 */
export function isGmailConfigured(): boolean {
  return !!(GMAIL_USER && GMAIL_APP_PASSWORD);
}

/**
 * Connect to Gmail via IMAP, search for recent relevant emails,
 * parse them, and return structured data ready for the extractor.
 */
export async function scanGmailInbox(): Promise<{
  emails: ScannedEmail[];
  errors: string[];
}> {
  if (!isGmailConfigured()) {
    throw new Error(
      "Gmail IMAP not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD environment variables."
    );
  }

  const errors: string[] = [];
  const emails: ScannedEmail[] = [];

  // Calculate the search date
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - LOOK_BACK_DAYS);

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD,
    },
    logger: false, // Suppress verbose IMAP logging
  });

  try {
    await client.connect();
    console.log(`[gmail-imap] Connected as ${GMAIL_USER}`);

    // Open INBOX
    const lock = await client.getMailboxLock("INBOX");

    try {
      // Search for recent emails (UNSEEN or within lookback period)
      // We search broadly and let the extractor decide relevance
      const searchCriteria = {
        since: sinceDate,
        or: [
          { unseen: true },
          // Also get seen emails from the lookback period that might be relevant
          { since: sinceDate },
        ],
      };

      // Use a simpler search: all emails since the lookback date
      const messageUids: number[] = [];
      for await (const msg of client.fetch(
        { since: sinceDate },
        { uid: true, envelope: true, source: true }
      )) {
        messageUids.push(msg.uid);
      }

      console.log(`[gmail-imap] Found ${messageUids.length} messages since ${sinceDate.toISOString().split("T")[0]}`);

      // Process each message (limit to 50 to avoid timeout)
      const toProcess = messageUids.slice(0, 50);

      for (const uid of toProcess) {
        try {
          // Fetch the full message source
          const download = await client.download(uid.toString(), undefined, { uid: true });
          if (!download || !download.content) continue;

          // Collect the stream into a buffer
          const chunks: Buffer[] = [];
          for await (const chunk of download.content) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }
          const rawEmail = Buffer.concat(chunks);

          // Parse with mailparser
          const parsed: ParsedMail = await simpleParser(rawEmail);

          // Extract relevant fields
          const subject = parsed.subject || "(no subject)";
          const from = parsed.from?.text || "";
          const date = parsed.date?.toISOString() || "";
          const textBody = parsed.text || "";
          const htmlBody = parsed.html || "";
          const messageId = parsed.messageId || `uid-${uid}`;

          // Quick relevance check — skip if clearly irrelevant
          const combinedText = `${subject} ${textBody}`.toLowerCase();
          const isRelevant = SEARCH_KEYWORDS.some((kw) => combinedText.includes(kw));
          if (!isRelevant && !subject.match(/#(CAMP|SPORT|SCHOOL|MED|PAY|REG|PET|FAM|OFFICE|INVITE|TRAVEL|HOUSE)/i)) {
            continue; // Skip irrelevant emails
          }

          // Process attachments
          const attachments: ScannedAttachment[] = [];
          if (parsed.attachments && parsed.attachments.length > 0) {
            for (const att of parsed.attachments) {
              const filename = att.filename || "unnamed";
              const mimeType = att.contentType || "";
              const ext = filename.includes(".") ? "." + filename.split(".").pop()!.toLowerCase() : "";

              // Check if processable
              if (!PROCESSABLE_TYPES.has(mimeType) && !PROCESSABLE_EXTENSIONS.has(ext)) {
                continue;
              }
              if (att.size && att.size > MAX_ATTACHMENT_SIZE) {
                continue;
              }

              let contentText = "";
              const contentBase64 = att.content.toString("base64");

              // Extract text from text-based attachments
              if (mimeType.startsWith("text/") || ext === ".ics" || ext === ".txt" || ext === ".html" || ext === ".csv") {
                contentText = att.content.toString("utf-8");
              }
              // For PDFs, we'll pass the base64 and let the extractor handle it
              // (server-side PDF parsing would require additional dependencies)

              attachments.push({
                filename,
                mime_type: mimeType,
                content_text: contentText.slice(0, 10000), // Limit text size
                content_base64: mimeType === "application/pdf" ? contentBase64 : "",
              });
            }
          }

          emails.push({
            gmail_id: messageId,
            subject,
            from,
            date,
            snippet: textBody.slice(0, 500),
            body: textBody.slice(0, 4000) || null,
            html_body: htmlBody.slice(0, 8000) || null,
            attachments,
          });
        } catch (msgErr: any) {
          errors.push(`Failed to parse message UID ${uid}: ${msgErr.message}`);
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();
    console.log(`[gmail-imap] Done — ${emails.length} relevant emails found, ${errors.length} errors`);
  } catch (connErr: any) {
    const msg = connErr.message || String(connErr);
    if (msg.includes("Invalid credentials") || msg.includes("AUTHENTICATIONFAILED")) {
      throw new Error(
        "Gmail authentication failed. Check GMAIL_USER and GMAIL_APP_PASSWORD. " +
        "Make sure 2FA is enabled and you're using an App Password (not your account password). " +
        "Generate one at: https://myaccount.google.com/apppasswords"
      );
    }
    throw new Error(`Gmail IMAP connection failed: ${msg}`);
  }

  return { emails, errors };
}
