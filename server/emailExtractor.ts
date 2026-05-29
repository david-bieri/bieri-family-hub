/**
 * emailExtractor.ts
 *
 * Parses raw email data and extracts structured family calendar items.
 *
 * FLAG SYNTAX (subject-line shorthand — skips LLM entirely):
 *   #CAMP @Clara @Airlie VA Techniques: Ninja Warrior Camp
 *   #SPORT @Cole Soccer practice Tuesday 6pm
 *   #PAY @Airlie @Clara Camp deposit due June 15 $250
 *   #MED @Otis Vet checkup reminder
 *
 *   Supported #tags: CAMP, SPORT, SCHOOL, MED, PAY, REG, PET, FAM
 *   @mentions: any child or pet name (case-insensitive, prefix match ok)
 *
 * If no flags are present, falls back to LLM extraction (sonar model).
 * If LLM is unavailable, falls back to lightweight regex heuristics.
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
  notes?: string;
  confidence: "high" | "medium" | "low";
  source_hint: string;  // short quote / hint that triggered this item
}

// ─── Known family members ─────────────────────────────────────────────────────
const CHILD_NAMES  = ["cole", "greta", "airlie", "clara", "heidi", "daisy"];
const PET_NAMES    = ["otis", "athena", "persephone"];
const ALL_MEMBERS  = [...CHILD_NAMES, ...PET_NAMES];

const CATEGORY_IDS = ["school", "sports", "medical", "camp", "family", "payment", "pets", "other"];

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
};

// ─── Flag syntax parser ───────────────────────────────────────────────────────

interface FlagParseResult {
  tag: string | null;
  mentions: string[];   // lowercased matched names
  petMentions: string[];
  cleanSubject: string;
}

/**
 * Parses the new #TAG @Name flag syntax from a subject line.
 *
 * Examples:
 *   "#CAMP @Clara @Airlie VA Techniques: Ninja Camp"
 *     → { tag:"CAMP", mentions:["clara","airlie"], cleanSubject:"VA Techniques: Ninja Camp" }
 *   "Regular subject with no flags"
 *     → { tag:null, mentions:[], cleanSubject:"Regular subject with no flags" }
 */
function parseFlagSyntax(subject: string): FlagParseResult {
  // Match all #WORD tokens
  const tagMatches = subject.match(/#([A-Za-z]+)/g) || [];
  const tag = tagMatches.length > 0
    ? tagMatches[0].slice(1).toUpperCase()   // first #tag wins
    : null;

  // Match all @Name tokens — prefix match against known names
  const atMatches = subject.match(/@([A-Za-z]+)/g) || [];
  const mentions: string[] = [];
  const petMentions: string[] = [];

  for (const at of atMatches) {
    const raw = at.slice(1).toLowerCase();
    // Exact match first, then prefix match
    const childMatch = CHILD_NAMES.find(
      (n) => n === raw || n.startsWith(raw)
    );
    const petMatch = PET_NAMES.find(
      (n) => n === raw || n.startsWith(raw)
    );
    if (childMatch && !mentions.includes(childMatch)) mentions.push(childMatch);
    if (petMatch  && !petMentions.includes(petMatch)) petMentions.push(petMatch);
  }

  // Remove all flag tokens from the subject to get a clean title
  const cleanSubject = subject
    .replace(/#[A-Za-z]+/g, "")
    .replace(/@[A-Za-z]+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return { tag, mentions, petMentions, cleanSubject };
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

/** Scan free text for child/pet name mentions (whole-word, case-insensitive) */
function detectMembersInText(text: string): { children: string[]; pets: string[] } {
  const children = CHILD_NAMES.filter((n) => new RegExp(`\\b${n}\\b`, "i").test(text));
  const pets     = PET_NAMES.filter((n)   => new RegExp(`\\b${n}\\b`, "i").test(text));
  return { children, pets };
}

/** Try to pull the first meaningful date from body text.
 *  Prioritises month-name dates over bare ISO dates to avoid hitting
 *  forwarding timestamps (e.g. "Sent: 2026-05-29") before event dates. */
function extractFirstDate(text: string): string | undefined {
  const MONTHS: Record<string, string> = {
    january:"01", february:"02", march:"03", april:"04",
    may:"05",     june:"06",     july:"07",  august:"08",
    september:"09", october:"10", november:"11", december:"12",
  };

  // Month-name form first: "June 8", "June 8-12", "July 4, 2026"
  const monthRe = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:[–\-](\d{1,2}))?(?:,?\s*(\d{4}))?/i;
  const mm = text.match(monthRe);
  if (mm) {
    const month = MONTHS[mm[1].toLowerCase()];
    const day   = mm[2].padStart(2, "0");
    const year  = mm[4] || new Date().getFullYear().toString();
    return `${year}-${month}-${day}`;
  }

  // ISO fallback: 2026-06-08
  const iso = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];

  return undefined;
}

// ─── Fast-path extractor ──────────────────────────────────────────────────────

/**
 * Called when the subject contains #TAG flags.
 * Returns a fully-formed ExtractedItem without touching the LLM.
 */
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

  // If no explicit @mentions, fall back to scanning the full text
  const { children: detectedChildren, pets: detectedPets } = detectMembersInText(fullText);
  const child_ids  = mentions.length > 0 ? mentions : detectedChildren;
  const pet_ids    = petMentions.length > 0 ? petMentions : (
    // Only auto-detect pets for PET/MED tags to avoid noise
    (tag === "PET" || tag === "MED") ? detectedPets : []
  );

  const date       = extractFirstDate(fullText);
  const moneyMatch = fullText.match(/\$[\d,]+(?:\.\d{2})?/);

  return [{
    id:          Math.random().toString(36).slice(2, 10),
    type,
    title:       cleanSubject.slice(0, 60),
    date,
    child_ids,
    pet_ids,
    category,
    amount:      moneyMatch?.[0],
    notes:       snippet.slice(0, 120),
    confidence:  "high",
    source_hint: `#${tag} fast-path`,
  }];
}

// ─── LLM extraction ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an assistant that extracts structured calendar items from family email content.

The family has 6 children: Cole (13), Greta (12), Airlie (11), Clara (9), Heidi (3), Daisy (1).
Pets: Otis (Bernese Mountain Dog), Athena (Russian Blue cat), Persephone (Black Bombay cat).

From the email, extract any:
- Events (school events, performances, field trips, sports games)
- Appointments (doctor, dentist, therapy, vet visits)
- Payment deadlines (camp fees, registration fees, sports fees, vet bills)
- Registration deadlines (camp sign-ups, school enrollment, sports registration)
- Tasks / reminders (forms to fill, things to return, actions needed)

For each item return a JSON object with these fields:
- id: a short random slug (8 chars)
- type: one of: event | appointment | payment | registration | task
- title: concise title (max 60 chars)
- date: ISO date yyyy-MM-dd if found, else omit
- time: 24h time HH:mm if found, else omit
- end_date: ISO date if a range is mentioned, else omit
- amount: dollar amount as string if mentioned (e.g. "$150"), else omit
- child_ids: array of child first names (lowercase) this applies to, e.g. ["cole", "airlie"]. Empty array if family-wide.
- pet_ids: array of pet first names (lowercase) if relevant, e.g. ["otis"]. Omit or empty array if not pet-related.
- category: one of: school | sports | medical | camp | family | payment | pets | other
- notes: any extra context worth preserving (max 120 chars)
- confidence: high | medium | low — how certain you are about the extracted date/details
- source_hint: a short direct quote (max 80 chars) from the email that triggered this item

Return ONLY a valid JSON array. No markdown, no explanation. If nothing extractable is found, return [].`;

export async function extractFromEmail(
  subject: string,
  from: string,
  snippet: string,
  body?: string
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

  const content = [
    `From: ${from}`,
    `Subject: ${subject}`,
    `---`,
    body || snippet,
  ].join("\n");

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
          { role: "user",   content },
        ],
        temperature: 0.1,
        max_tokens:  1200,
      }),
    });

    if (!res.ok) {
      console.error("[emailExtractor] API error:", res.status, await res.text());
      return fallbackExtract(subject, snippet);
    }

    const json = await res.json();
    const text: string = json.choices?.[0]?.message?.content || "[]";

    const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const items: ExtractedItem[] = JSON.parse(clean);

    return items
      .filter((item) => item && item.title)
      .map((item) => ({
        ...item,
        id:         item.id || Math.random().toString(36).slice(2, 10),
        child_ids:  (item.child_ids || []).filter((c) => CHILD_NAMES.includes(c.toLowerCase())),
        pet_ids:    (item.pet_ids   || []).filter((p) => PET_NAMES.includes(p.toLowerCase())),
        category:   CATEGORY_IDS.includes(item.category || "") ? item.category : "other",
        confidence: item.confidence || "medium",
        source_hint: item.source_hint || subject,
      }));
  } catch (err) {
    console.error("[emailExtractor] parse error:", err);
    return fallbackExtract(subject, snippet);
  }
}

// ─── Regex fallback ───────────────────────────────────────────────────────────

/**
 * Lightweight heuristic extractor — used when LLM API is unavailable.
 * No API key required.
 */
function fallbackExtract(subject: string, snippet: string): ExtractedItem[] {
  const text  = `${subject} ${snippet}`;
  const items: ExtractedItem[] = [];

  const dateMatch   = text.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:,\s*\d{4})?/i);
  const moneyMatch  = text.match(/\$[\d,]+(?:\.\d{2})?/);
  const isDeadline  = /deadline|due|register|enroll|sign.?up|last day|by \w+ \d/i.test(text);
  const isPayment   = /pay|fee|payment|cost|tuition|deposit/i.test(text);
  const isAppointment = /appointment|visit|checkup|check-up|dr\.|doctor|dentist|vet/i.test(text);
  const isPet       = /\b(otis|athena|persephone|vet|grooming|flea|heartworm)\b/i.test(text);

  if (dateMatch || moneyMatch || isDeadline || isPayment || isAppointment) {
    const type = isPayment ? "payment"
               : isDeadline ? "registration"
               : isAppointment ? "appointment"
               : "event";

    const { children, pets } = detectMembersInText(text);

    items.push({
      id:         Math.random().toString(36).slice(2, 10),
      type,
      title:      subject.slice(0, 60),
      date:       undefined,
      amount:     moneyMatch?.[0],
      child_ids:  children,
      pet_ids:    pets,
      category:   isPet ? "pets"
                : type === "payment" ? "payment"
                : type === "appointment" ? "medical"
                : "other",
      notes:      snippet.slice(0, 120),
      confidence: "low",
      source_hint: subject.slice(0, 80),
    });
  }

  return items;
}
