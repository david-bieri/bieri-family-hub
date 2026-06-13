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
 *   7. Thread-aware: strips quoted replies to focus on new content
 *   8. LLM fallback with enhanced prompt (multi-item, location, deadline)
 *   9. Regex fallback when LLM is unavailable
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
// Maps known sender patterns to auto-tags. Checked before LLM to save API calls.
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
];

function detectSenderCategory(fromAddress: string): SenderRule | null {
  for (const rule of SENDER_RULES) {
    if (rule.pattern.test(fromAddress)) return rule;
  }
  return null;
}

// ─── Thread Stripping ────────────────────────────────────────────────────────
// Remove quoted replies and forwarded content to focus on new information
function stripQuotedContent(body: string): string {
  // Common reply markers
  const markers = [
    /^-{3,}\s*Original Message\s*-{3,}/im,
    /^On .+ wrote:$/im,
    /^>{1,}/m,
    /^From:\s+.+\nSent:\s+.+\nTo:\s+/im,
    /^-{3,}\s*Forwarded message\s*-{3,}/im,
    /^_{3,}$/m,
  ];

  let cleaned = body;
  for (const marker of markers) {
    const match = cleaned.match(marker);
    if (match && match.index !== undefined) {
      // Only strip if the marker appears after some content
      if (match.index > 50) {
        cleaned = cleaned.slice(0, match.index).trim();
        break;
      }
    }
  }
  return cleaned;
}

// ─── HTML Body Parser ────────────────────────────────────────────────────────
// Extract meaningful text from HTML email bodies
function parseHtmlBody(html: string): string {
  // Remove style, script, and head tags with content
  let text = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  // Convert common block elements to newlines
  text = text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n");

  // Remove remaining tags
  text = text.replace(/<[^>]+>/g, " ");

  // Decode HTML entities
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

  // Collapse whitespace
  text = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

  return text;
}

// ─── ICS Calendar File Parser ────────────────────────────────────────────────
// Parse .ics content into structured event data (no external dependency needed)
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
      // Handle folded lines (continuation lines start with space/tab)
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

    // Parse DTSTART — handles both date-only (20260615) and datetime (20260615T140000Z)
    const parseICSDate = (dt: string): { date: string; time?: string } => {
      // Remove VALUE=DATE: prefix or TZID parameter
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
// Uses pdf-parse if available, otherwise falls back to basic extraction
async function extractPDFText(pdfBuffer: Buffer): Promise<string> {
  try {
    // Dynamic import — pdf-parse is an optional dependency
    const pdfParse = (await import("pdf-parse")).default;
    const result = await pdfParse(pdfBuffer);
    return result.text || "";
  } catch (err) {
    console.warn("[emailExtractor] pdf-parse not available, skipping PDF extraction:", err);
    return "";
  }
}

// ─── Location Extraction ─────────────────────────────────────────────────────
// Detect addresses, venue names, and room numbers from text
function extractLocation(text: string): string | undefined {
  // Street address pattern: "123 Main St" or "456 Oak Avenue, Suite 200"
  const addressRe = /\b(\d{1,5}\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*\s+(?:St(?:reet)?|Ave(?:nue)?|Blvd|Boulevard|Dr(?:ive)?|Rd|Road|Ln|Lane|Way|Ct|Court|Cir(?:cle)?|Pl(?:ace)?|Pkwy|Parkway)\.?(?:,?\s*(?:Suite|Ste|Apt|#)\s*\d+)?(?:,?\s*[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)?(?:,?\s*[A-Z]{2}\s*\d{5})?)\b/;
  const addrMatch = text.match(addressRe);
  if (addrMatch) return addrMatch[1].trim();

  // Venue/building patterns
  const venueRe = /(?:at|@|location:|venue:|where:)\s*([A-Z][^,.\n]{3,50})/i;
  const venueMatch = text.match(venueRe);
  if (venueMatch) return venueMatch[1].trim();

  // Room/field patterns
  const roomRe = /(?:room|field|gym|court|pool|building|bldg)\s*[#:]?\s*([A-Za-z0-9\-]+(?:\s+[A-Za-z0-9]+)?)/i;
  const roomMatch = text.match(roomRe);
  if (roomMatch) return `Room/Field ${roomMatch[1].trim()}`;

  return undefined;
}

// ─── Time Extraction ─────────────────────────────────────────────────────────
function extractTime(text: string): string | undefined {
  // "2:30 PM", "14:30", "2pm", "2:30pm"
  const timeRe = /\b(\d{1,2}):(\d{2})\s*(am|pm|AM|PM)\b|\b(\d{1,2})\s*(am|pm|AM|PM)\b|\b(\d{2}):(\d{2})\b/;
  const m = text.match(timeRe);
  if (!m) return undefined;

  if (m[1] && m[3]) {
    // "2:30 PM" format
    let hour = parseInt(m[1]);
    const min = m[2];
    const ampm = m[3].toLowerCase();
    if (ampm === "pm" && hour < 12) hour += 12;
    if (ampm === "am" && hour === 12) hour = 0;
    return `${hour.toString().padStart(2, "0")}:${min}`;
  } else if (m[4] && m[5]) {
    // "2pm" format
    let hour = parseInt(m[4]);
    const ampm = m[5].toLowerCase();
    if (ampm === "pm" && hour < 12) hour += 12;
    if (ampm === "am" && hour === 12) hour = 0;
    return `${hour.toString().padStart(2, "0")}:00`;
  } else if (m[6] && m[7]) {
    // "14:30" format
    return `${m[6]}:${m[7]}`;
  }
  return undefined;
}

// ─── Flag syntax parser ───────────────────────────────────────────────────────

interface FlagParseResult {
  tag: string | null;
  mentions: string[];   // lowercased matched names
  petMentions: string[];
  cleanSubject: string;
}

/**
 * Parses the new #TAG @Name flag syntax from a subject line.
 */
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
  may:"05",     june:"06",     july:"07",  august:"08",
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

  // ── Special handling for #INVITE — extract RSVP deadline as separate item ──
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

// ─── LLM extraction (enhanced prompt) ────────────────────────────────────────

const SYSTEM_PROMPT = `You are an assistant that extracts structured calendar items from family email content.

The family has 2 parents (David and Nancy) and 6 children: Cole (13), Greta (12), Airlie (11), Clara (9), Heidi (3), Daisy (1).
Pets: Otis (Bernese Mountain Dog), Athena (Russian Blue cat), Persephone (Black Bombay cat).
Properties: 709 Cedarview Dr. (primary home), 1016 Highland Cir. (secondary property).

## What to extract

From the email (and any attachment text provided), extract ALL of the following that apply:
- Events (school events, performances, field trips, sports games, camp sessions, birthday parties, social gatherings)
- Appointments (doctor, dentist, therapy, vet visits)
- Payment deadlines (camp fees, registration fees, sports fees, vet bills, school fees)
- Registration deadlines (camp sign-ups, school enrollment, sports registration)
- Tasks / reminders (forms to fill, things to return, actions needed, RSVP deadlines, permission slips to sign)

## IMPORTANT: Extract MULTIPLE items from a single email

Many emails (especially school newsletters or camp communications) contain MULTIPLE dates, deadlines, or events.
You MUST extract ALL of them as separate items. Do NOT stop at the first one.

## Critical: distinguish event vs. deadline

These are DIFFERENT things — extract them as SEPARATE items:
- A REGISTRATION DEADLINE is a date by which you must sign up / pay. Use type="registration".
- A CAMP/PROGRAM EVENT is the actual dates the program runs. Use type="event".
- An RSVP DEADLINE is a date by which you must respond. Use type="task" with title "RSVP: ..."

If an email mentions BOTH a registration deadline AND a program start/end date, return TWO separate items.

## Location extraction

If a location, address, venue, field, room, or building is mentioned, include it in the "location" field.
Examples: "709 Cedarview Dr.", "Field 3", "Room 204", "Riverside Park Pavilion", "Dr. Smith's office"

## Deadline detection

Look for phrases like:
- "register by June 10" → registration with date June 10
- "RSVP by Friday" → task with the Friday date
- "due by June 15" → payment with date June 15
- "last day to sign up: June 8" → registration with date June 8
- "respond by end of day Tuesday" → task with that Tuesday's date

## Field definitions

For each item return a JSON object with these fields:
- id: a short random slug (8 chars)
- type: one of: event | appointment | payment | registration | task
- title: concise title (max 60 chars)
- date: ISO date yyyy-MM-dd — for events this is the START date; for registration/payment this is the DEADLINE
- time: 24h time HH:mm if found, else omit
- end_date: ISO date — for events/camps that span multiple days, this is the LAST day
- amount: dollar amount as string if mentioned (e.g. "$150"), else omit
- child_ids: array of child first names (lowercase), e.g. ["cole", "airlie"]. Include parents ["david", "nancy"] if specifically relevant to them. Empty array if family-wide.
- pet_ids: array of pet first names (lowercase) if relevant. Omit or empty if not pet-related.
- category: one of: school | sports | medical | camp | family | payment | pets | home | office | travel | social | other
- location: venue, address, field, room, or building name if mentioned. Omit if not found.
- notes: any extra context worth preserving (max 120 chars)
- confidence: high | medium | low — how certain you are about the extracted date/details
- source_hint: short direct quote (max 80 chars) from the email that triggered this item

Return ONLY a valid JSON array. No markdown, no explanation. If nothing extractable is found, return [].`;

// ─── Main extraction function ────────────────────────────────────────────────

export interface EmailInput {
  subject: string;
  from: string;
  snippet: string;
  body?: string;
  html_body?: string;
  attachments?: AttachmentInput[];
}

export interface AttachmentInput {
  filename: string;
  mime_type: string;
  content_base64?: string;  // base64-encoded file content
  content_text?: string;    // pre-extracted text (for .ics, .txt)
}

export async function extractFromEmail(
  subject: string,
  from: string,
  snippet: string,
  body?: string,
  html_body?: string,
  attachments?: AttachmentInput[]
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
  let enrichedBody = body || "";

  // Parse HTML body if plain text is empty/short
  if ((!enrichedBody || enrichedBody.length < 50) && html_body) {
    enrichedBody = parseHtmlBody(html_body);
    console.log(`[emailExtractor] Parsed HTML body: ${enrichedBody.length} chars`);
  }

  // Strip quoted/forwarded content to focus on new information
  if (enrichedBody.length > 100) {
    enrichedBody = stripQuotedContent(enrichedBody);
  }

  // ── Process attachments ──────────────────────────────────────────────────
  const attachmentTexts: string[] = [];
  const parsedAttachmentNames: string[] = [];
  const icsEvents: ICSEvent[] = [];

  if (attachments && attachments.length > 0) {
    for (const att of attachments) {
      parsedAttachmentNames.push(att.filename);

      // ICS calendar files — parse directly for high-confidence events
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

      // PDF files — extract text
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

      // Plain text / HTML attachments
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

  // ── Sender recognition: auto-detect category if no #TAG ──────────────────
  const senderRule = detectSenderCategory(from);
  const senderHint = senderRule
    ? `\n[Sender auto-detected as: ${senderRule.tag} (${senderRule.category})]`
    : "";

  // ── Combine all text for LLM ─────────────────────────────────────────────
  const fullContent = [
    `From: ${from}`,
    `Subject: ${subject}`,
    senderHint,
    `---`,
    enrichedBody || snippet,
    ...attachmentTexts,
  ].join("\n").slice(0, 6000); // Cap at 6K chars for LLM context

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
        temperature: 0.1,
        max_tokens: 2000, // Increased for multi-item extraction
      }),
    });

    if (!res.ok) {
      console.error("[emailExtractor] API error:", res.status, await res.text());
      // Fall back but still include ICS items
      const fallback = fallbackExtract(subject, snippet, enrichedBody, from);
      return [...icsItems, ...fallback];
    }

    const json = await res.json();
    const text: string = json.choices?.[0]?.message?.content || "[]";
    const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const items: ExtractedItem[] = JSON.parse(clean);

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

    // Merge ICS items (dedup by title+date)
    const merged = [...icsItems];
    for (const item of validated) {
      const isDup = merged.some(
        (m) => m.title === item.title && m.date === item.date
      );
      if (!isDup) merged.push(item);
    }

    return merged;
  } catch (err) {
    console.error("[emailExtractor] parse error:", err);
    const fallback = fallbackExtract(subject, snippet, enrichedBody, from);
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
  return "other";
}

// ─── Enhanced regex fallback ─────────────────────────────────────────────────

function fallbackExtract(subject: string, snippet: string, body?: string, from?: string): ExtractedItem[] {
  const text = `${subject} ${snippet} ${body || ""}`;
  const items: ExtractedItem[] = [];

  // Use sender recognition for category hints
  const senderRule = from ? detectSenderCategory(from) : null;

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

    items.push({
      id: Math.random().toString(36).slice(2, 10),
      type,
      title: subject.slice(0, 60),
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
