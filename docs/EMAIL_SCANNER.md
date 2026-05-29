# Email Scanner — Bieri Family Hub

The email scanner automatically monitors a dedicated Gmail inbox, extracts structured calendar items (events, appointments, payments, registrations) using a tag parser and/or LLM, and queues them in the Family Hub for human review.

---

## Architecture

```
Forwarded email
    │
    ▼
bieri.family.hub@gmail.com
    │
    ▼
Daily cron (7am EDT)
    │
    ├── scripts/gmail_scan.py
    │       │
    │       ├── #TAG in subject? ──→ Fast-path parser (instant, no LLM)
    │       │                         └── @Name mentions → child_ids / pet_ids
    │       │
    │       └── No tag? ──────────→ Perplexity sonar LLM extraction
    │                                 └── Regex fallback if API key missing
    │
    ▼
POST /api/inbox/scan  (Express backend → emailExtractor.ts)
    │
    ▼
pending_imports  (Supabase table)
    │
    ▼
Inbox page in app  ──→  Accept / Skip each item
    │
    ▼
Committed to events / medical_appointments / payments / registrations / pets
```

---

## The Dedicated Gmail Account

The scanner uses a **dedicated** Gmail address (`bieri.family.hub@gmail.com`), not a personal inbox. This keeps the signal-to-noise ratio high — only emails you deliberately forward or direct-send ever get processed.

### Who sends to this address

| Sender | How | Example subject |
|---|---|---|
| You (manual forward) | Forward from your inbox | `#CAMP @Airlie Blue Ridge Summer` |
| Your wife (manual forward) | Forward from her inbox | `#PAY @Cole soccer fee $85` |
| School / coach (direct) | Give them the address | `#SCHOOL field trip permission slip` |
| Camp / program (direct) | Give them the address | `#CAMP registration deadline June 1` |

---

## Subject-Line Flag Syntax

The current syntax is `#TAG @Name1 @Name2 rest of subject`. Tags and mentions can appear **anywhere** in the subject — they don't need to be at the start.

### Tags

Tags **skip the LLM entirely** — classification is instant and always correct.

| Tag | Category | Type | Example |
|---|---|---|---|
| `#CAMP` | camp | registration | `#CAMP @Airlie VA Techniques Summer Session` |
| `#SPORT` | sports | event | `#SPORT @Cole @Greta soccer practice Tue/Thu` |
| `#SCHOOL` | school | event | `#SCHOOL @Greta field trip May 15` |
| `#MED` | medical | appointment | `#MED @Clara dentist June 3 2pm` |
| `#PAY` | payment | payment | `#PAY @Heidi swim lessons $120 due June 1` |
| `#REG` | other | registration | `#REG @Clara dance enrollment deadline` |
| `#PET` | pets | appointment | `#PET @Otis annual vaccines due` |
| `#FAM` | family | event | `#FAM summer vacation July 4–10` |
| *(none)* | inferred | inferred | Full LLM extraction (~2s) |

Tags are case-insensitive: `#camp`, `#CAMP`, and `#Camp` all work.

### @Mentions

`@mentions` **prefix-match** against both children and pets. You only need enough characters to be unambiguous:

| Mention | Resolves to | Type |
|---|---|---|
| `@Cole` or `@Col` | Cole | child |
| `@Greta` or `@Gre` | Greta | child |
| `@Airlie` or `@Air` | Airlie | child |
| `@Clara` or `@Cla` | Clara | child |
| `@Heidi` or `@Hei` | Heidi | child |
| `@Daisy` or `@Dai` | Daisy | child |
| `@Otis` or `@Ot` | Otis (Bernese Mountain Dog) | pet |
| `@Athena` or `@Ath` | Athena (Russian Blue cat) | pet |
| `@Persephone` or `@Per` | Persephone (Black Bombay cat) | pet |

Multiple mentions are supported: `#SPORT @Cole @Greta soccer`.

### Title extraction

Everything in the subject that is **not** a `#TAG` or `@mention` becomes the clean item title. Given:

```
#CAMP @Airlie VA Techniques: Important Summer Camp Details
```

The extracted title is: `VA Techniques: Important Summer Camp Details`

---

## The Scan Script

**Location:** `scripts/gmail_scan.py`

**What it does:**
1. Connects to Gmail via the `gcal` external-tool connector
2. Searches the dedicated inbox using a set of broad keyword queries
3. For each email — checks for a `#TAG`, then either fast-paths or calls the LLM
4. POSTs to `POST /api/inbox/scan` on the Express backend
5. The backend deduplicates by `gmail_id` (already-processed emails return `{skipped: true}`)
6. Extracted items land in the `pending_imports` Supabase table

**Running manually** (from the Perplexity Computer session):

Just say "run the inbox scan" in the chat — the agent will execute the script immediately.

**Running locally** (requires the `external-tool` CLI, which is Perplexity-specific):

```bash
# Requires: external-tool CLI authenticated with gcal connector
# Set FAMILY_HUB_API to your deployed backend URL
export FAMILY_HUB_API=https://your-backend.onrender.com
python3 scripts/gmail_scan.py
```

**Running on a self-hosted server** (platform-independent version):

Replace the `call_tool()` function with a direct Gmail API call using a service account or OAuth2 credentials. The rest of the script is standard Python with no Perplexity dependencies. See [Platform Migration](#platform-migration) below.

---

## Daily Cron

The scan runs automatically every day at **7:00 AM EDT (11:00 UTC)** via a Perplexity scheduled task.

**Cron ID:** `1327ea9d`  
**Schedule:** `0 11 * * *` (UTC)  
**What happens:**
1. Gmail is searched for unread emails matching family-relevant keywords
2. Each email is processed through the tag parser / LLM
3. New items are queued in `pending_imports`
4. If new items were found, an in-app notification is sent: "Family Hub — N new inbox items to review"
5. If nothing new (all skipped or 0 results), the run ends silently

---

## The Inbox UI

In the app, navigate to **Inbox** (sidebar). Each scanned email appears as a card showing:

- Email subject, sender, date
- Each extracted item with type, date, amount, child/pet tags, confidence level, and the exact quote from the email that triggered it
- **Add** — commits the item to the right module (Schedule, Medical, Payments, Camps, or Pets)
- **Skip** — dismisses the item without saving
- **Dismiss all** — ignores the entire email

Once all items in an email are accepted or skipped, it disappears from the queue.

---

## Platform Migration

If you move off Perplexity, the Gmail integration needs to be replaced. Three options:

### Option A — Gmail API with OAuth2 (recommended)

```python
# Replace call_tool() in gmail_scan.py with:
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

def get_gmail_service():
    creds = Credentials.from_authorized_user_file('token.json', SCOPES)
    return build('gmail', 'v1', credentials=creds)

def search_emails():
    service = get_gmail_service()
    results = service.users().messages().list(
        userId='me', q='is:unread', maxResults=50
    ).execute()
    # ... fetch full messages
```

Set up OAuth2 credentials at [console.cloud.google.com](https://console.cloud.google.com).

### Option B — Postmark inbound webhook (no polling)

Instead of polling Gmail, set up Postmark to receive emails at `hub@yourdomain.com` and fire a webhook to `POST /api/inbox/scan` on your server. No cron needed — emails are processed the moment they arrive.

### Option C — IMAP (universal, no Google API needed)

```python
import imaplib, email

def search_emails():
    mail = imaplib.IMAP4_SSL('imap.gmail.com')
    mail.login('bieri.family.hub@gmail.com', os.environ['GMAIL_APP_PASSWORD'])
    mail.select('inbox')
    _, ids = mail.search(None, 'UNSEEN')
    # fetch and parse each message
```

Requires an [App Password](https://support.google.com/accounts/answer/185833) from Google Account settings (2FA must be enabled).

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PPLX_API_KEY` | Yes (for LLM extraction) | Perplexity API key — get from [perplexity.ai/settings/api](https://www.perplexity.ai/settings/api) |
| `FAMILY_HUB_API` | Yes (for script) | Base URL of the deployed backend, e.g. `https://your-app.onrender.com` |
| `SUPABASE_URL` | Yes | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Your Supabase anon key |

Without `PPLX_API_KEY`, untagged emails fall back to regex extraction (lower accuracy, no LLM cost).

---

## Supabase Tables

### `pending_imports`

```sql
CREATE TABLE pending_imports (
  id           TEXT PRIMARY KEY,
  source       TEXT NOT NULL DEFAULT 'email',
  raw_subject  TEXT,
  raw_from     TEXT,
  raw_date     TEXT,
  raw_snippet  TEXT,
  gmail_id     TEXT UNIQUE,   -- deduplication key
  extracted    JSONB NOT NULL DEFAULT '[]',
  status       TEXT NOT NULL DEFAULT 'pending',
  reviewed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
```

### `ExtractedItem` shape

The `extracted` column is a JSONB array of `ExtractedItem` objects:

```ts
interface ExtractedItem {
  id: string;
  type: "event" | "appointment" | "payment" | "registration" | "task";
  title: string;
  date?: string;        // ISO yyyy-MM-dd
  time?: string;        // HH:mm 24h
  amount?: string;      // "$85"
  child_ids?: string[]; // ["cole", "airlie"]
  pet_ids?: string[];   // ["pet-otis"]
  category?: string;    // matches categories table
  notes?: string;
  confidence: "high" | "medium" | "low";
  source_hint: string;  // quote from email that triggered this
  _accepted?: boolean;  // set when user clicks Add
  _dismissed?: boolean; // set when user clicks Skip
}
```
