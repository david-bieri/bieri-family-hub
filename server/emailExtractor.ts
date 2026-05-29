/**
 * emailExtractor.ts
 *
 * Takes raw email data (subject, from, body snippet) and calls the
 * Perplexity LLM API to extract structured events/tasks.
 *
 * Returns an array of ExtractedItem — each one is a proposed addition
 * to the family calendar that the user can accept or dismiss.
 */

export interface ExtractedItem {
  id: string;
  type: "event" | "appointment" | "payment" | "registration" | "task";
  title: string;
  date?: string;        // ISO yyyy-MM-dd
  time?: string;        // HH:mm 24h
  end_date?: string;
  amount?: string;      // for payments
  child_ids?: string[]; // inferred child names matched to ids
  category?: string;    // matched to a category id
  notes?: string;
  confidence: "high" | "medium" | "low";
  source_hint: string;  // short quote from email that triggered this
}

const CHILD_NAMES = ["cole", "greta", "airlie", "clara", "heidi", "daisy"];
const CATEGORY_IDS = ["school", "sports", "medical", "camp", "family", "payment", "other"];

const SYSTEM_PROMPT = `You are an assistant that extracts structured calendar items from family email content.

The family has 6 children: Cole (13), Greta (12), Airlie (11), Clara (9), Heidi (3), Daisy (1).

From the email, extract any:
- Events (school events, performances, field trips, sports games)
- Appointments (doctor, dentist, therapy)
- Payment deadlines (camp fees, registration fees, sports fees)
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
- category: one of: school | sports | medical | camp | family | payment | other
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
          { role: "user", content },
        ],
        temperature: 0.1,
        max_tokens: 1200,
      }),
    });

    if (!res.ok) {
      console.error("[emailExtractor] API error:", res.status, await res.text());
      return fallbackExtract(subject, snippet);
    }

    const json = await res.json();
    const text: string = json.choices?.[0]?.message?.content || "[]";

    // Strip any accidental markdown fences
    const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const items: ExtractedItem[] = JSON.parse(clean);

    // Validate and sanitise each item
    return items
      .filter((item) => item && item.title)
      .map((item) => ({
        ...item,
        id: item.id || Math.random().toString(36).slice(2, 10),
        child_ids: (item.child_ids || []).filter((c) =>
          CHILD_NAMES.includes(c.toLowerCase())
        ),
        category: CATEGORY_IDS.includes(item.category || "")
          ? item.category
          : "other",
        confidence: item.confidence || "medium",
        source_hint: item.source_hint || subject,
      }));
  } catch (err) {
    console.error("[emailExtractor] parse error:", err);
    return fallbackExtract(subject, snippet);
  }
}

/**
 * Lightweight regex fallback used if the LLM API is unavailable.
 * Catches the most common patterns without requiring any API key.
 */
function fallbackExtract(subject: string, snippet: string): ExtractedItem[] {
  const text = `${subject} ${snippet}`;
  const items: ExtractedItem[] = [];

  // Date patterns: "June 15", "6/15/2026", "2026-06-15"
  const dateMatch = text.match(
    /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:,\s*\d{4})?/i
  );

  // Money patterns
  const moneyMatch = text.match(/\$[\d,]+(?:\.\d{2})?/);

  // Deadline / due patterns
  const isDeadline =
    /deadline|due|register|enroll|sign.?up|last day|by \w+ \d/i.test(text);
  const isPayment = /pay|fee|payment|cost|tuition|deposit/i.test(text);
  const isAppointment = /appointment|visit|checkup|check-up|dr\.|doctor|dentist/i.test(text);

  if (dateMatch || moneyMatch || isDeadline || isPayment || isAppointment) {
    const type = isPayment
      ? "payment"
      : isDeadline
      ? "registration"
      : isAppointment
      ? "appointment"
      : "event";

    items.push({
      id: Math.random().toString(36).slice(2, 10),
      type,
      title: subject.slice(0, 60),
      date: undefined,
      amount: moneyMatch?.[0],
      child_ids: [],
      category:
        type === "payment"
          ? "payment"
          : type === "appointment"
          ? "medical"
          : "other",
      notes: snippet.slice(0, 120),
      confidence: "low",
      source_hint: subject.slice(0, 80),
    });
  }

  return items;
}
