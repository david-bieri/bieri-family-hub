/**
 * emailExtractor.ts
 *
 * Enhanced email parsing engine for Bieri Family Hub.
 *
 * CAPABILITIES:
 *   1. Fast-path: #TAG @Name subject-line syntax (no LLM)
 *   2. Sender recognition: auto-tag based on known sender domains/addresses
 *   3. Attachment intelligence: PDF text extraction, ICS calendar parsing, HTML body parsing
 *   4. Multi-item extraction: single email → multiple structured items
 *   5. Deadline detection: "RSVP by", "register by", "due by" phrases
 *   6. Location extraction: addresses, venue names, room numbers
 *   7. Forward-aware: PRESERVES forwarded content (booking confirmations, reservations)
 *   8. Date disambiguation: distinguishes transaction/email dates from event dates
 *   9. LLM extraction with chain-of-thought date reasoning
 *  10. Regex fallback when LLM is unavailable
 *
 * FLAG SYNTAX (subject-line shorthand — skips LLM entirely):
 *   #CAMP @Clara @Airlie VA Techniques: Ninja Warrior Camp
 *   #SPORT @Cole Soccer practice Tuesday 6pm
 *   #PAY @Airlie @Clara Camp deposit due June 15 $250
 *   #MED @Otis Vet checkup reminder
 *   #INVITE @Cole @Greta Birthday party at the Johnsons Sat 2pm
 *
 *   Supported #tags: CAMP, SPORT, SCHOOL, MED, PAY, REG, PET, FAM, OFFICE, TRAVEL, HOUSE, INVITE
 *   @mentions: any family member name (case-insensitive, prefix match ok)
 */

export interface ExtractedItem {
  id: string;
  type: "event" | "appointment" | "payment" | "registration" | "task";
  title: string;
  date?: string;        // ISO yyyy-MM-dd
  time?: string;        // HH:mm 24h
  end_date?: string;
  end_time?: string;
  amount?: string;      // for payments, e.g. "$150"
  child_ids?: string[]; // matched child first names (lowercase)
  pet_ids?: string[];   // matched pet first names (lowercase)
  category?: string;    // matched to a category id
  location?: string;    // extracted venue/address
  notes?: string;
  confidence: "high" | "medium" | "low";
  source_hint: string;  // short quote / hint that triggered this item
  attachments_parsed?: string[];  // list of attachment filenames that were processed
}

// ─── Known family members ─────────────────────────────────────────────────────
const PARENT_NAMES = ["david", "nancy"];
const CHILD_NAMES  = ["cole", "greta", "airlie", "clara", "heidi", "daisy"];
const PET_NAMES    = ["otis", "athena", "persephone"];
const ALL_MEMBERS  = [...PARENT_NAMES, ...CHILD_NAMES, ...PET_NAMES];

const CATEGORY_IDS = ["school", "sports", "medical", "camp", "family", "payment", "pets", "home", "office", "travel", "social", "other"];

// ─── #TAG → category + type mapping ──────────────────────────────────────────
const TAG_MAP: Record<string, { category: string; type: ExtractedItem["type"] }> = {
  CAMP:   { category: "camp",    type: "registration" },
  SPORT:  { category: "sports",  type: "event"        },
  SCHOOL: { category: "school",  type: "event"        },
  MED:    { category: "medical", type: "appointment"  },
  PAY:    { category: "payment", type: "payment"      },
  REG:    { category: "other",   type: "registration" },
  PET:    { category: "pets",    type: "appointment"  },
  FAM:    { category: "family",  type: "event"        },
  OFFICE: { category: "office",  type: "event"        },
  TRAVEL: { category: "travel",  type: "event"        },
  HOUSE:  { category: "home",    type: "task"         },
  INVITE: { category: "social",  type: "event"        },
};

// ─── Sender Recognition ──────────────────────────────────────────────────────
interface SenderRule {
  pattern: RegExp;
  tag: string;
  category: string;
  type: ExtractedItem["type"];
}

const SENDER_RULES: SenderRule[] = [
  // Schools
  { pattern: /k12|school|edu|teacher|principal|classroom/i, tag: "SCHOOL", category: "school", type: "event" },
  // Sports organizations
  { pattern: /soccer|football|baseball|basketball|swim|tennis|gymnastics|league|athletic|coach/i, tag: "SPORT", category: "sports", type: "event" },
  // Medical
  { pattern: /doctor|dentist|pediatr|clinic|hospital|health|medical|pharmacy|vet/i, tag: "MED", category: "medical", type: "appointment" },
  // Camps & programs
  { pattern: /camp|ymca|recreation|rec\.gov|summer\s*program/i, tag: "CAMP", category: "camp", type: "registration" },
  // Payment / billing
  { pattern: /billing|invoice|payment|paypal|venmo|stripe|square/i, tag: "PAY", category: "payment", type: "payment" },
  // Travel / bookings
  { pattern: /booking\.com|airbnb|vrbo|expedia|hotels?\.com|airline|delta|united|southwest|american|frontier|spirit|kayak|tripadvisor/i, tag: "TRAVEL", category: "travel", type: "event" },
  // Reservations / restaurants
  { pattern: /opentable|resy|yelp.*reserv|reservation/i, tag: "FAM", category: "social", type: "event" },
];

function detectSenderCategory(fromAddress: string): SenderRule | null {
  for (const rule of SENDER_RULES) {
    if (rule.pattern.test(fromAddress)) return rule;
  }
  return null;
}

// ─── Forward-Aware Content Extraction ────────────────────────────────────────
/**
 * CRITICAL FIX: For forwarded emails, we PRESERVE the forwarded content because
 * it typically contains the actual booking/reservation/event details.
 * We only strip quoted REPLY threads (where someone is replying back and forth).
 *
 * Strategy:
 *   - If the email is a FORWARD: keep everything, mark it as forwarded
 *   - If the email is a REPLY thread: strip quoted replies but keep the latest message
 */
interface ContentAnalysis {
  isForwarded: boolean;
  isReply: boolean;
  primaryContent: string;   // The main content to analyze
  forwardedContent: string; // The forwarded portion (if any) — ALSO analyzed
  emailSentDate?: string;   // Extracted date the email was sent (for disambiguation)
}

function analyzeEmailContent(subject: string, body: string): ContentAnalysis {
  const isForwarded = /^(Fwd?|FW):/i.test(subject) ||
    /^-{3,}\s*Forwarded message\s*-{3,}/im.test(body) ||
    /^Begin forwarded message/im.test(body) ||
    /^From:\s+.+\nDate:\s+.+\nSubject:\s+/im.test(body);

  const isReply = /^Re:/i.test(subject) && !isForwarded;

  // Extract the email sent date from headers in forwarded content
  let emailSentDate: string | undefined;
  const dateHeaderMatch = body.match(
    /(?:Date|Sent|Received):\s*(?:\w+,?\s*)?(\w+ \d{1,2},?\s*\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2})/i
  );
  if (dateHeaderMatch) {
    emailSentDate = dateHeaderMatch[1];
  }

  if (isForwarded) {
    // For forwards: keep EVERYTHING. The forwarded content IS the important part.
    // Split into the forwarder's note (if any) and the forwarded body.
    const forwardMarkers = [
      /^-{3,}\s*Forwarded message\s*-{3,}/im,
      /^Begin forwarded message/im,
      /^From:\s+.+\n(?:Date|Sent):\s+.+\nTo:\s+/im,
    ];

    let splitIndex = -1;
    for (const marker of forwardMarkers) {
      const match = body.match(marker);
      if (match && match.index !== undefined) {
        splitIndex = match.index;
        break;
      }
    }

    if (splitIndex > 0) {
      return {
        isForwarded: true,
        isReply: false,
        primaryContent: body.slice(0, splitIndex).trim(),
        forwardedContent: body.slice(splitIndex).trim(),
        emailSentDate,
      };
    }

    // No clear split point — treat entire body as forwarded content
    return {
      isForwarded: true,
      isReply: false,
      primaryContent: "",
      forwardedContent: body,
      emailSentDate,
    };
  }

  if (isReply) {
    // For replies: strip quoted content, keep only the latest message
    const replyMarkers = [
      /^On .+ wrote:$/im,
      /^>{1,}/m,
      /^From:\s+.+\nSent:\s+.+\nTo:\s+/im,
      /^_{3,}$/m,
    ];

    let cleaned = body;
    for (const marker of replyMarkers) {
      const match = cleaned.match(marker);
      if (match && match.index !== undefined && match.index > 50) {
        cleaned = cleaned.slice(0, match.index).trim();
        break;
      }
    }

    return {
      isForwarded: false,
      isReply: true,
      primaryContent: cleaned,
      forwardedContent: "",
      emailSentDate,
    };
  }

  // Neither forward nor reply — use full body
  return {
    isForwarded: false,
    isReply: false,
    primaryContent: body,
    forwardedContent: "",
    emailSentDate,
  };
}

// ─── HTML Body Parser ────────────────────────────────────────────────────────
function parseHtmlBody(html: string): string {
  let text = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  text = text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n");

  text = text.replace(/<[^>]+>/g, " ");

  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–");

  text = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return text;
}

// ─── ICS Calendar File Parser ────────────────────────────────────────────────
interface ICSEvent {
  title: string;
  date: string;
  time?: string;
  end_date?: string;
  end_time?: string;
  location?: string;
  description?: string;
}

function parseICS(icsContent: string): ICSEvent[] {
  const events: ICSEvent[] = [];
  const eventBlocks = icsContent.split("BEGIN:VEVENT");

  for (let i = 1; i < eventBlocks.length; i++) {
    const block = eventBlocks[i].split("END:VEVENT")[0];

    const getField = (name: string): string | undefined => {
      const unfolded = block.replace(/\r?\n[ \t]/g, "");
      const match = unfolded.match(new RegExp(`^${name}[;:](.*)$`, "m"));
      return match ? match[1].trim() : undefined;
    };

    const summary = getField("SUMMARY") || "Calendar Event";
    const dtstart = getField("DTSTART");
    const dtend = getField("DTEND");
    const location = getField("LOCATION");
    const description = getField("DESCRIPTION");

    if (!dtstart) continue;

    const parseICSDate = (dt: string): { date: string; time?: string } => {
      const clean = dt.replace(/^[^:]*:/, "").replace(/^VALUE=DATE:/, "");
      if (clean.length >= 8) {
        const date = `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`;
        let time: string | undefined;
        if (clean.length >= 13 && clean[8] === "T") {
          time = `${clean.slice(9, 11)}:${clean.slice(11, 13)}`;
        }
        return { date, time };
      }
      return { date: clean };
    };

    const start = parseICSDate(dtstart);
    const end = dtend ? parseICSDate(dtend) : undefined;

    events.push({
      title: summary.replace(/\\,/g, ",").replace(/\\n/g, " ").replace(/\\/g, ""),
      date: start.date,
      time: start.time,
      end_date: end?.date !== start.date ? end?.date : undefined,
      end_time: end?.time,
      location: location?.replace(/\\,/g, ",").replace(/\\n/g, ", ").replace(/\\/g, ""),
      description: description?.replace(/\\n/g, " ").replace(/\\/g, "").slice(0, 200),
    });
  }

  return events;
}

// ─── PDF Text Extraction ─────────────────────────────────────────────────────
async function extractPDFText(pdfBuffer: Buffer): Promise<string> {
  try {
    const pdfParse = (await import("pdf-parse")).default;
    const result = await pdfParse(pdfBuffer);
    return result.text || "";
  } catch (err) {
    console.warn("[emailExtractor] pdf-parse not available, skipping PDF extraction:", err);
    return "";
  }
}

// ─── Location Extraction ─────────────────────────────────────────────────────
function extractLocation(text: string): string | undefined {
  const addressRe = /\b(\d{1,5}\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*\s+(?:St(?:reet)?|Ave(?:nue)?|Blvd|Boulevard|Dr(?:ive)?|Rd|Road|Ln|Lane|Way|Ct|Court|Cir(?:cle)?|Pl(?:ace)?|Pkwy|Parkway)\.?(?:,?\s*(?:Suite|Ste|Apt|#)\s*\d+)?(?:,?\s*[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)?(?:,?\s*[A-Z]{2}\s*\d{5})?)\b/;
  const addrMatch = text.match(addressRe);
  if (addrMatch) return addrMatch[1].trim();

  const venueRe = /(?:at|@|location:|venue:|where:)\s*([A-Z][^,.\n]{3,50})/i;
  const venueMatch = text.match(venueRe);
  if (venueMatch) return venueMatch[1].trim();

  const roomRe = /(?:room|field|gym|court|pool|building|bldg)\s*[#:]?\s*([A-Za-z0-9\-]+(?:\s+[A-Za-z0-9]+)?)/i;
  const roomMatch = text.match(roomRe);
  if (roomMatch) return `Room/Field ${roomMatch[1].trim()}`;

  return undefined;
}

// ─── Time Extraction ─────────────────────────────────────────────────────────
function extractTime(text: string): string | undefined {
  const timeRe = /\b(\d{1,2}):(\d{2})\s*(am|pm|AM|PM)\b|\b(\d{1,2})\s*(am|pm|AM|PM)\b|\b(\d{2}):(\d{2})\b/;
  const m = text.match(timeRe);
  if (!m) return undefined;

  if (m[1] && m[3]) {
    let hour = parseInt(m[1]);
    const min = m[2];
    const ampm = m[3].toLowerCase();
    if (ampm === "pm" && hour < 12) hour += 12;
    if (ampm === "am" && hour === 12) hour = 0;
    return `${hour.toString().padStart(2, "0")}:${min}`;
  } else if (m[4] && m[5]) {
    let hour = parseInt(m[4]);
    const ampm = m[5].toLowerCase();
    if (ampm === "pm" && hour < 12) hour += 12;
    if (ampm === "am" && hour === 12) hour = 0;
    return `${hour.toString().padStart(2, "0")}:00`;
  } else if (m[6] && m[7]) {
    return `${m[6]}:${m[7]}`;
  }
  return undefined;
}

// ─── Flag syntax parser ───────────────────────────────────────────────────────

interface FlagParseResult {
  tag: string | null;
  mentions: string[];
  petMentions: string[];
  cleanSubject: string;
}

function parseFlagSyntax(subject: string): FlagParseResult {
  const tagMatches = subject.match(/#([A-Za-z]+)/g) || [];
  const tag = tagMatches.length > 0
    ? tagMatches[0].slice(1).toUpperCase()
    : null;

  const atMatches = subject.match(/@([A-Za-z]+)/g) || [];
  const mentions: string[] = [];
  const petMentions: string[] = [];

  for (const at of atMatches) {
    const raw = at.slice(1).toLowerCase();
    const parentMatch = PARENT_NAMES.find((n) => n === raw || n.startsWith(raw));
    const childMatch = CHILD_NAMES.find((n) => n === raw || n.startsWith(raw));
    const petMatch = PET_NAMES.find((n) => n === raw || n.startsWith(raw));
    if (parentMatch && !mentions.includes(parentMatch)) mentions.push(parentMatch);
    if (childMatch && !mentions.includes(childMatch)) mentions.push(childMatch);
    if (petMatch && !petMentions.includes(petMatch)) petMentions.push(petMatch);
  }

  const cleanSubject = subject
    .replace(/#[A-Za-z]+/g, "")
    .replace(/@[A-Za-z]+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return { tag, mentions, petMentions, cleanSubject };
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function detectMembersInText(text: string): { children: string[]; pets: string[]; parents: string[] } {
  const children = CHILD_NAMES.filter((n) => new RegExp(`\\b${n}\\b`, "i").test(text));
  const pets = PET_NAMES.filter((n) => new RegExp(`\\b${n}\\b`, "i").test(text));
  const parents = PARENT_NAMES.filter((n) => new RegExp(`\\b${n}\\b`, "i").test(text));
  return { children, pets, parents };
}

const MONTHS: Record<string, string> = {
  january:"01", february:"02", march:"03", april:"04",
  may:"05",     june:"06",     july:"07",   august:"08",
  september:"09", october:"10", november:"11", december:"12",
};

function extractFirstDate(text: string): string | undefined {
  const monthRe = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:[–\-](\d{1,2}))?(?:,?\s*(\d{4}))?/i;
  const mm = text.match(monthRe);
  if (mm) {
    const month = MONTHS[mm[1].toLowerCase()];
    const day = mm[2].padStart(2, "0");
    const year = mm[4] || new Date().getFullYear().toString();
    return `${year}-${month}-${day}`;
  }
  const iso = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];
  return undefined;
}

function extractDateRange(text: string): { start: string; end: string } | null {
  const year = new Date().getFullYear().toString();

  const sameMonthRe = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:\s*[–\-]\s*|\s+to\s+)(\d{1,2})(?:,?\s*(\d{4}))?\b/i;
  const sm = text.match(sameMonthRe);
  if (sm) {
    const m = MONTHS[sm[1].toLowerCase()];
    const y = sm[4] || year;
    return {
      start: `${y}-${m}-${sm[2].padStart(2, "0")}`,
      end: `${y}-${m}-${sm[3].padStart(2, "0")}`,
    };
  }

  const crossMonthRe = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})\s*(?:[–\-]|to)\s*(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:,?\s*(\d{4}))?\b/i;
  const cm = text.match(crossMonthRe);
  if (cm) {
    const y = cm[5] || year;
    return {
      start: `${y}-${MONTHS[cm[1].toLowerCase()]}-${cm[2].padStart(2, "0")}`,
      end: `${y}-${MONTHS[cm[3].toLowerCase()]}-${cm[4].padStart(2, "0")}`,
    };
  }

  return null;
}

function extractDeadlineDate(text: string): string | undefined {
  const deadlineRe = /(?:register\s+by|deadline[:\s]+|due\s+by|sign(?:\s*-?up)?\s+by|last\s+day\s+(?:to\s+register)?[:\s]*|rsvp\s+by|respond\s+by|reply\s+by)\s*((?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:,?\s*\d{4})?)/i;
  const dm = text.match(deadlineRe);
  if (dm) return extractFirstDate(dm[1]);
  return undefined;
}

// ─── Fast-path extractor ──────────────────────────────────────────────────────

function fastPathExtract(
  subject: string,
  _from: string,
  snippet: string,
  body: string | undefined
): ExtractedItem[] {
  const { tag, mentions, petMentions, cleanSubject } = parseFlagSyntax(subject);
  if (!tag || !TAG_MAP[tag]) return [];

  const { category, type } = TAG_MAP[tag];
  const fullText = `${cleanSubject} ${snippet} ${body || ""}`;

  const { children: detectedChildren, pets: detectedPets } = detectMembersInText(fullText);
  const child_ids = mentions.length > 0 ? mentions : detectedChildren;
  const pet_ids = petMentions.length > 0 ? petMentions : (
    (tag === "PET" || tag === "MED") ? detectedPets : []
  );

  const moneyMatch = fullText.match(/\$[\d,]+(?:\.\d{2})?/);
  const location = extractLocation(fullText);
  const time = extractTime(fullText);

  const baseItem = {
    child_ids, pet_ids, category, location, time,
    amount: moneyMatch?.[0],
    notes: snippet.slice(0, 120),
    confidence: "high" as const,
    source_hint: `#${tag} fast-path`,
  };

  // ── Special dual-item extraction for #CAMP ────────────────────────────────
  if (tag === "CAMP") {
    const range = extractDateRange(fullText);
    const deadline = extractDeadlineDate(fullText);
    const items: ExtractedItem[] = [];

    if (range) {
      items.push({
        ...baseItem,
        id: Math.random().toString(36).slice(2, 10),
        type: "event",
        title: cleanSubject.slice(0, 60),
        date: range.start,
        end_date: range.end,
        category: "camp",
        source_hint: `#CAMP fast-path — duration ${range.start} to ${range.end}`,
      });
    }

    if (deadline && deadline !== range?.start) {
      items.push({
        ...baseItem,
        id: Math.random().toString(36).slice(2, 10),
        type: "registration",
        title: `${cleanSubject.slice(0, 45)} — deadline`,
        date: deadline,
        category: "camp",
        source_hint: `#CAMP fast-path — deadline ${deadline}`,
      });
    }

    if (items.length > 0) return items;

    const date = extractFirstDate(fullText);
    return [{
      ...baseItem,
      id: Math.random().toString(36).slice(2, 10),
      type: "registration",
      title: cleanSubject.slice(0, 60),
      date,
    }];
  }

  // ── Special handling for #INVITE ──────────────────────────────────────────
  if (tag === "INVITE") {
    const items: ExtractedItem[] = [];
    const date = extractFirstDate(fullText);
    const deadline = extractDeadlineDate(fullText);

    items.push({
      ...baseItem,
      id: Math.random().toString(36).slice(2, 10),
      type: "event",
      title: cleanSubject.slice(0, 60),
      date,
    });

    if (deadline && deadline !== date) {
      items.push({
        ...baseItem,
        id: Math.random().toString(36).slice(2, 10),
        type: "task",
        title: `RSVP: ${cleanSubject.slice(0, 45)}`,
        date: deadline,
        category: "social",
        source_hint: `#INVITE — RSVP deadline ${deadline}`,
      });
    }

    return items;
  }

  // ── Default single-item extraction for all other tags ────────────────────
  const date = extractFirstDate(fullText);
  return [{
    ...baseItem,
    id: Math.random().toString(36).slice(2, 10),
    type,
    title: cleanSubject.slice(0, 60),
    date,
  }];
}

// ─── LLM extraction (redesigned prompt with date disambiguation) ─────────────

const SYSTEM_PROMPT = `You are an expert assistant that extracts structured calendar items from family emails.
You MUST carefully distinguish between different types of dates in emails.

## FAMILY CONTEXT
Parents: David and Nancy Bieri
Children: Cole (13), Greta (12), Airlie (11), Clara (9), Heidi (3), Daisy (1)
Pets: Otis (Bernese Mountain Dog), Athena (Russian Blue cat), Persephone (Black Bombay cat)
Properties: 709 Cedarview Dr. (primary home), 1016 Highland Cir. (secondary property)
Location: Blacksburg, Virginia

## CRITICAL: DATE DISAMBIGUATION

Emails contain MULTIPLE types of dates. You MUST identify the correct one for each item:

1. **Transaction/Email dates** (IGNORE these — they are NOT event dates):
   - "Order confirmed on June 15" → this is when the booking was MADE, not the event
   - "Date: Mon, Jun 15, 2026 3:42 PM" → email header timestamp
   - "Purchased on 06/15/2026" → purchase date
   - "Confirmation sent June 15" → notification date
   - "Thank you for your order placed June 15" → order date

2. **Event/Stay dates** (USE these — they are the ACTUAL dates to put on the calendar):
   - "Check-in: July 20" / "Check-out: July 25" → event is July 20-25
   - "Reservation for July 20-25" → event is July 20-25
   - "Camp runs June 23-27" → event is June 23-27
   - "Appointment on July 3 at 2:00 PM" → event is July 3
   - "Game on Saturday, June 28 at 10am" → event is June 28
   - "Flight departs July 20 at 8:15 AM" → event is July 20

3. **Deadline dates** (USE these for registration/payment items):
   - "Register by June 10" → deadline is June 10
   - "Payment due June 15" → deadline is June 15
   - "RSVP by Friday June 12" → deadline is June 12

## REASONING PROCESS

Before outputting JSON, mentally walk through these steps:
1. Is this email a forwarded booking/reservation/confirmation? If yes, look for check-in/check-out, departure/arrival, or event start dates — NOT the email date or purchase date.
2. What is the ACTIONABLE date the family needs on their calendar? (When do they need to BE somewhere or DO something?)
3. Are there multiple actionable items? (e.g., a camp confirmation has both the camp dates AND a packing list deadline)

## FORWARDED EMAILS

When you see forwarded email markers (--- Forwarded message ---, Fwd:, Begin forwarded message), the FORWARDED CONTENT is the important part. The forwarder's note (if any) is just context. Extract items from the forwarded content.

Common forwarded patterns:
- Booking confirmations (hotels, flights, rentals) → extract the STAY/TRAVEL dates, not the booking date
- Camp/program confirmations → extract the PROGRAM dates, not the registration date
- Appointment confirmations → extract the APPOINTMENT date
- Event invitations → extract the EVENT date
- Order confirmations → usually NOT calendar-worthy unless it's a delivery/pickup date

## WHAT TO EXTRACT

From the email, extract ALL actionable items:
- Events (school events, performances, field trips, sports games, camp sessions, parties, travel)
- Appointments (doctor, dentist, therapy, vet visits)
- Payment deadlines (fees, deposits, bills due)
- Registration deadlines (sign-ups, enrollment)
- Tasks/reminders (forms, RSVPs, permission slips, things to pack/bring)

## MULTI-ITEM EXTRACTION

Many emails contain MULTIPLE dates/items. Extract ALL of them separately.
Example: A camp confirmation might yield:
  1. Event: "Ninja Warrior Camp" June 23-27 (the camp itself)
  2. Task: "Pack lunch and water bottle" June 23 (first day reminder)
  3. Payment: "Remaining balance due" June 20 ($150)

## FIELD DEFINITIONS

Return a JSON array of objects with these fields:
- id: short random slug (8 chars)
- type: event | appointment | payment | registration | task
- title: concise title (max 60 chars) — should describe WHAT is happening, not the email subject
- date: ISO yyyy-MM-dd — the ACTIONABLE date (event start, deadline, appointment date)
- time: 24h HH:mm if mentioned, else omit
- end_date: ISO yyyy-MM-dd — for multi-day events (last day), else omit
- end_time: 24h HH:mm if mentioned, else omit
- amount: dollar amount as string (e.g. "$150"), else omit
- child_ids: array of child first names lowercase (e.g. ["cole"]). Empty [] if family-wide.
- pet_ids: array of pet names lowercase if relevant, else omit
- category: school | sports | medical | camp | family | payment | pets | home | office | travel | social | other
- location: venue, address, hotel name, field, etc. if mentioned. Omit if not found.
- notes: extra context (max 120 chars) — include confirmation numbers, flight numbers, etc.
- confidence: high | medium | low
- source_hint: short direct quote (max 80 chars) from the email that contains the key date/detail

## EXAMPLES

Input: Forwarded hotel confirmation — "Booking confirmed! Check-in: July 20, 2026. Check-out: July 25, 2026. Hampton Inn Roanoke. Confirmation #HX8829."
Output: [{"type":"event","title":"Hampton Inn Roanoke stay","date":"2026-07-20","end_date":"2026-07-25","category":"travel","location":"Hampton Inn Roanoke","notes":"Confirmation #HX8829","confidence":"high","source_hint":"Check-in: July 20, 2026. Check-out: July 25, 2026"}]

Input: "Your order is confirmed! Ordered June 15. Camp Ninja Warrior for Cole, June 23-27. Balance of $150 due by June 20."
Output: [{"type":"event","title":"Camp Ninja Warrior","date":"2026-06-23","end_date":"2026-06-27","child_ids":["cole"],"category":"camp","confidence":"high","source_hint":"Camp Ninja Warrior for Cole, June 23-27"},{"type":"payment","title":"Camp Ninja Warrior balance due","date":"2026-06-20","amount":"$150","child_ids":["cole"],"category":"camp","confidence":"high","source_hint":"Balance of $150 due by June 20"}]

Return ONLY a valid JSON array. No markdown, no explanation. If nothing calendar-worthy is found, return [].`;

// ─── Main extraction function ────────────────────────────────────────────────

export interface EmailInput {
  subject: string;
  from: string;
  snippet: string;
  body?: string;
  html_body?: string;
  attachments?: AttachmentInput[];
  received_date?: string; // ISO date when email was received (for disambiguation)
}

export interface AttachmentInput {
  filename: string;
  mime_type: string;
  content_base64?: string;
  content_text?: string;
}

export async function extractFromEmail(
  subject: string,
  from: string,
  snippet: string,
  body?: string,
  html_body?: string,
  attachments?: AttachmentInput[],
  received_date?: string
): Promise<ExtractedItem[]> {
  // ✔ Fast-path: subject contains #TAG flags → skip LLM entirely
  const { tag } = parseFlagSyntax(subject);
  if (tag && TAG_MAP[tag]) {
    const fastItems = fastPathExtract(subject, from, snippet, body);
    if (fastItems.length > 0) {
      console.log(`[emailExtractor] fast-path: #${tag} in "${subject}"`);
      return fastItems;
    }
  }

  // ── Build enriched content from all sources ──────────────────────────────
  let rawBody = body || "";

  // Parse HTML body if plain text is empty/short
  if ((!rawBody || rawBody.length < 50) && html_body) {
    rawBody = parseHtmlBody(html_body);
    console.log(`[emailExtractor] Parsed HTML body: ${rawBody.length} chars`);
  }

  // ── FORWARD-AWARE content analysis ──────────────────────────────────────
  // CRITICAL: Do NOT strip forwarded content — it contains the actual event details
  const contentAnalysis = analyzeEmailContent(subject, rawBody);
  const enrichedBody = contentAnalysis.primaryContent + "\n" + contentAnalysis.forwardedContent;

  console.log(`[emailExtractor] Content analysis: forwarded=${contentAnalysis.isForwarded}, reply=${contentAnalysis.isReply}, primaryLen=${contentAnalysis.primaryContent.length}, fwdLen=${contentAnalysis.forwardedContent.length}`);

  // ── Process attachments ──────────────────────────────────────────────────
  const attachmentTexts: string[] = [];
  const parsedAttachmentNames: string[] = [];
  const icsEvents: ICSEvent[] = [];

  if (attachments && attachments.length > 0) {
    for (const att of attachments) {
      parsedAttachmentNames.push(att.filename);

      if (att.mime_type === "text/calendar" || att.filename.endsWith(".ics")) {
        const icsText = att.content_text || (att.content_base64
          ? Buffer.from(att.content_base64, "base64").toString("utf-8")
          : "");
        if (icsText) {
          const events = parseICS(icsText);
          icsEvents.push(...events);
          console.log(`[emailExtractor] Parsed ICS "${att.filename}": ${events.length} events`);
        }
        continue;
      }

      if (att.mime_type === "application/pdf" || att.filename.endsWith(".pdf")) {
        if (att.content_base64) {
          const pdfBuffer = Buffer.from(att.content_base64, "base64");
          const pdfText = await extractPDFText(pdfBuffer);
          if (pdfText) {
            attachmentTexts.push(`\n--- Attachment: ${att.filename} ---\n${pdfText.slice(0, 3000)}`);
            console.log(`[emailExtractor] Extracted PDF "${att.filename}": ${pdfText.length} chars`);
          }
        }
        continue;
      }

      if (att.mime_type?.startsWith("text/") || att.filename.match(/\.(txt|html|htm|csv)$/i)) {
        const text = att.content_text || (att.content_base64
          ? Buffer.from(att.content_base64, "base64").toString("utf-8")
          : "");
        if (text) {
          const parsed = att.mime_type === "text/html" ? parseHtmlBody(text) : text;
          attachmentTexts.push(`\n--- Attachment: ${att.filename} ---\n${parsed.slice(0, 2000)}`);
        }
        continue;
      }
    }
  }

  // ── Convert ICS events directly to ExtractedItems (high confidence) ──────
  const icsItems: ExtractedItem[] = icsEvents.map((ev) => {
    const { children, pets, parents } = detectMembersInText(
      `${ev.title} ${ev.description || ""} ${ev.location || ""}`
    );
    return {
      id: Math.random().toString(36).slice(2, 10),
      type: "event" as const,
      title: ev.title.slice(0, 60),
      date: ev.date,
      time: ev.time,
      end_date: ev.end_date,
      child_ids: [...parents, ...children],
      pet_ids: pets,
      category: detectCategoryFromText(`${ev.title} ${ev.description || ""}`),
      location: ev.location,
      notes: ev.description?.slice(0, 120),
      confidence: "high" as const,
      source_hint: "ICS calendar attachment",
      attachments_parsed: parsedAttachmentNames,
    };
  });

  // ── Sender recognition ──────────────────────────────────────────────────
  const senderRule = detectSenderCategory(from);
  const senderHint = senderRule
    ? `\n[Sender auto-detected as: ${senderRule.tag} (${senderRule.category})]`
    : "";

  // ── Build context for LLM with date disambiguation hints ────────────────
  const today = new Date().toISOString().split("T")[0];
  const emailDate = received_date || contentAnalysis.emailSentDate || today;

  const contextHeader = [
    `TODAY'S DATE: ${today}`,
    `EMAIL RECEIVED/SENT: ${emailDate}`,
    contentAnalysis.isForwarded ? `⚠️ THIS IS A FORWARDED EMAIL — the forwarded content below contains the actual event details. Do NOT use the email/forward date as the event date.` : "",
    `From: ${from}`,
    `Subject: ${subject}`,
    senderHint,
  ].filter(Boolean).join("\n");

  const fullContent = [
    contextHeader,
    `---`,
    contentAnalysis.isForwarded && contentAnalysis.primaryContent
      ? `[Forwarder's note]: ${contentAnalysis.primaryContent.slice(0, 200)}`
      : "",
    contentAnalysis.isForwarded
      ? `[Forwarded content — EXTRACT EVENTS FROM HERE]:\n${contentAnalysis.forwardedContent}`
      : enrichedBody || snippet,
    ...attachmentTexts,
  ].filter(Boolean).join("\n").slice(0, 8000); // Increased cap for forwarded content

  // ── Call LLM for extraction ──────────────────────────────────────────────
  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.PPLX_API_KEY || ""}`,
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: fullContent },
        ],
        temperature: 0.05, // Lower temperature for more deterministic extraction
        max_tokens: 3000,  // Increased for multi-item + reasoning
      }),
    });

    if (!res.ok) {
      console.error("[emailExtractor] API error:", res.status, await res.text());
      const fallback = fallbackExtract(subject, snippet, enrichedBody, from, emailDate);
      return [...icsItems, ...fallback];
    }

    const json = await res.json();
    const text: string = json.choices?.[0]?.message?.content || "[]";
    const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    // Handle cases where LLM might output reasoning before JSON
    const jsonStart = clean.indexOf("[");
    const jsonEnd = clean.lastIndexOf("]");
    const jsonStr = jsonStart >= 0 && jsonEnd > jsonStart
      ? clean.slice(jsonStart, jsonEnd + 1)
      : clean;

    const items: ExtractedItem[] = JSON.parse(jsonStr);

    const validated = items
      .filter((item) => item && item.title)
      .map((item) => ({
        ...item,
        id: item.id || Math.random().toString(36).slice(2, 10),
        child_ids: (item.child_ids || []).filter((c) => ALL_MEMBERS.includes(c.toLowerCase())),
        pet_ids: (item.pet_ids || []).filter((p) => PET_NAMES.includes(p.toLowerCase())),
        category: CATEGORY_IDS.includes(item.category || "") ? item.category : "other",
        confidence: item.confidence || "medium",
        source_hint: item.source_hint || subject,
        attachments_parsed: parsedAttachmentNames.length > 0 ? parsedAttachmentNames : undefined,
      }));

    // ── Post-processing: validate dates aren't in the past (likely misclassified) ──
    const validatedWithDateCheck = validated.map((item) => {
      if (item.date && item.date < today && item.confidence !== "high") {
        // If the extracted date is in the past and it matches the email date,
        // it's likely a transaction date that was misidentified
        if (item.date === emailDate || item.date <= emailDate) {
          console.warn(`[emailExtractor] Suspicious past date ${item.date} for "${item.title}" — may be transaction date. Marking low confidence.`);
          return { ...item, confidence: "low" as const, notes: `${item.notes || ""} [⚠️ Date may be transaction date, not event date]`.trim() };
        }
      }
      return item;
    });

    // Merge ICS items (dedup by title+date)
    const merged = [...icsItems];
    for (const item of validatedWithDateCheck) {
      const isDup = merged.some(
        (m) => m.title === item.title && m.date === item.date
      );
      if (!isDup) merged.push(item);
    }

    return merged;
  } catch (err) {
    console.error("[emailExtractor] parse error:", err);
    const fallback = fallbackExtract(subject, snippet, enrichedBody, from, emailDate);
    return [...icsItems, ...fallback];
  }
}

// ─── Category detection from text ────────────────────────────────────────────
function detectCategoryFromText(text: string): string {
  const lower = text.toLowerCase();
  if (/school|class|teacher|homework|field trip|parent.?teacher/i.test(lower)) return "school";
  if (/soccer|football|baseball|basketball|swim|tennis|gymnastics|practice|game|match|tournament/i.test(lower)) return "sports";
  if (/doctor|dentist|appointment|checkup|vaccine|therapy|clinic/i.test(lower)) return "medical";
  if (/camp|summer program|week.?long/i.test(lower)) return "camp";
  if (/birthday|party|bbq|grill|dinner|lunch|playdate|invite/i.test(lower)) return "social";
  if (/vet|grooming|pet|dog|cat/i.test(lower)) return "pets";
  if (/payment|fee|invoice|bill|due|deposit/i.test(lower)) return "payment";
  if (/house|repair|maintenance|plumber|hvac|lawn|garden|roof/i.test(lower)) return "home";
  if (/hotel|flight|airbnb|vrbo|check.?in|check.?out|reservation|travel|trip|vacation/i.test(lower)) return "travel";
  if (/booking|restaurant|dinner reservation|table for/i.test(lower)) return "social";
  return "other";
}

// ─── Enhanced regex fallback ─────────────────────────────────────────────────

function fallbackExtract(subject: string, snippet: string, body?: string, from?: string, emailDate?: string): ExtractedItem[] {
  const text = `${subject} ${snippet} ${body || ""}`;
  const items: ExtractedItem[] = [];
  const today = new Date().toISOString().split("T")[0];

  const senderRule = from ? detectSenderCategory(from) : null;

  // ── Booking/Reservation pattern detection ──────────────────────────────
  const isBookingConfirmation = /confirm|reservation|booking|itinerary|check.?in|check.?out|departure|arrival/i.test(text);

  if (isBookingConfirmation) {
    // Look for check-in/check-out or travel dates specifically
    const checkinRe = /(?:check.?in|arrival|depart(?:ure|s)?|from|start(?:s|ing)?)[:\s]*(?:\w+,?\s*)?(\w+ \d{1,2}(?:,?\s*\d{4})?|\d{1,2}\/\d{1,2}\/\d{2,4})/i;
    const checkoutRe = /(?:check.?out|return|end(?:s|ing)?|to|through)[:\s]*(?:\w+,?\s*)?(\w+ \d{1,2}(?:,?\s*\d{4})?|\d{1,2}\/\d{1,2}\/\d{2,4})/i;

    const checkinMatch = text.match(checkinRe);
    const checkoutMatch = text.match(checkoutRe);

    const startDate = checkinMatch ? extractFirstDate(checkinMatch[1]) : undefined;
    const endDate = checkoutMatch ? extractFirstDate(checkoutMatch[1]) : undefined;

    if (startDate && startDate > (emailDate || today)) {
      const { children, pets } = detectMembersInText(text);
      const location = extractLocation(text);
      const time = extractTime(text);

      items.push({
        id: Math.random().toString(36).slice(2, 10),
        type: "event",
        title: subject.replace(/^(Fwd?|FW|Re):\s*/i, "").slice(0, 60),
        date: startDate,
        end_date: endDate && endDate > startDate ? endDate : undefined,
        time,
        child_ids: children,
        pet_ids: pets,
        category: senderRule?.category || "travel",
        location,
        notes: snippet.slice(0, 120),
        confidence: "medium",
        source_hint: checkinMatch?.[0]?.slice(0, 80) || subject.slice(0, 80),
      });

      return items;
    }
  }

  // ── General extraction (non-booking) ──────────────────────────────────
  const dateMatch = text.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:,\s*\d{4})?/i);
  const moneyMatch = text.match(/\$[\d,]+(?:\.\d{2})?/);
  const isDeadline = /deadline|due|register|enroll|sign.?up|last day|by \w+ \d|rsvp/i.test(text);
  const isPayment = /pay|fee|payment|cost|tuition|deposit|invoice|bill/i.test(text);
  const isAppointment = /appointment|visit|checkup|check-up|dr\.|doctor|dentist|vet/i.test(text);
  const isPet = /\b(otis|athena|persephone|vet|grooming|flea|heartworm)\b/i.test(text);

  if (dateMatch || moneyMatch || isDeadline || isPayment || isAppointment) {
    const type = isPayment ? "payment"
      : isDeadline ? "registration"
      : isAppointment ? "appointment"
      : "event";

    const { children, pets, parents } = detectMembersInText(text);
    const location = extractLocation(text);
    const time = extractTime(text);
    const date = extractFirstDate(text);
    const category = senderRule?.category
      || (isPet ? "pets"
        : type === "payment" ? "payment"
        : type === "appointment" ? "medical"
        : detectCategoryFromText(text));

    // Skip if the only date we found is the email date (likely not an event)
    if (date && date === emailDate && !isDeadline && !isAppointment) {
      // Probably a transaction confirmation — don't create an event
      console.log(`[emailExtractor] Skipping — only date found (${date}) matches email date`);
      return [];
    }

    items.push({
      id: Math.random().toString(36).slice(2, 10),
      type,
      title: subject.replace(/^(Fwd?|FW|Re):\s*/i, "").slice(0, 60),
      date,
      time,
      amount: moneyMatch?.[0],
      child_ids: [...parents, ...children],
      pet_ids: pets,
      category,
      location,
      notes: snippet.slice(0, 120),
      confidence: "low",
      source_hint: subject.slice(0, 80),
    });

    // Try to extract a second item (deadline) if we found an event
    if (type === "event") {
      const deadline = extractDeadlineDate(text);
      if (deadline && deadline !== date) {
        items.push({
          id: Math.random().toString(36).slice(2, 10),
          type: "registration",
          title: `${subject.slice(0, 40)} — deadline`,
          date: deadline,
          child_ids: [...parents, ...children],
          pet_ids: pets,
          category,
          notes: "Auto-detected deadline",
          confidence: "low",
          source_hint: `Deadline extracted from "${subject}"`,
        });
      }
    }
  }

  return items;
}
