# Email Scanner — Bieri Family Hub

The email scanner automatically monitors a dedicated Gmail inbox, extracts structured calendar items (events, appointments, payments, registrations) using an LLM, and queues them in the Family Hub for human review.

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
    │       ├── [TAG] in subject? ──→ Tag parser (instant, no LLM)
    │       │
    │       └── No tag? ──────────→ Perplexity sonar LLM extraction
    │
    ▼
POST /api/inbox/scan  (Express backend)
    │
    ▼
pending_imports  (Supabase table)
    │
    ▼
Inbox page in app  ──→  Accept / Skip each item
    │
    ▼
Committed to events / medical_appointments / payments / registrations
```

---

## The Dedicated Gmail Account

The scanner uses a **dedicated** Gmail address (`bieri.family.hub@gmail.com`), not a personal inbox. This keeps the signal-to-noise ratio high — only emails you deliberately forward or direct-send ever get processed.

### Who sends to this address

| Sender | How | Example subject |
|---|---|---|
| You (manual forward) | Forward from your inbox | `[CAMP] Airlie — Blue Ridge Summer` |
| Your wife (manual forward) | Forward from her inbox | `[PAY] Cole soccer fee $85` |
| School / coach (direct) | Give them the address | `[SCHOOL] Field trip permission slip` |
| Camp / program (direct) | Give them the address | `[CAMP] Registration deadline June 1` |

---

## Subject-Line Tags

Tags in the subject line **skip the LLM entirely** — classification is instant and always correct.

| Tag | Event type | Category | Example |
|---|---|---|---|
| `[CAMP]` | registration | camp | `[CAMP] Airlie — Blue Ridge Summer Session` |
| `[SPORT]` | event | sports | `[SPORT] Cole soccer practice Tue/Thu` |
| `[SCHOOL]` | event | school | `[SCHOOL] Greta field trip May 15` |
| `[MED]` | appointment | medical | `[MED] Clara dentist June 3 2pm` |
| `[PAY]` | payment | payment | `[PAY] Heidi swim lessons $120 due June 1` |
| `[REG]` | registration | other | `[REG] Clara dance enrollment deadline` |
| *(none)* | inferred | inferred | Full LLM extraction (~2s) |

Tags are case-insensitive: `[camp]`, `[CAMP]`, and `[Camp]` all work.

### Child name detection

The scanner also checks the subject for child first names and auto-assigns `child_ids`:

```
"[CAMP] Airlie Blue Ridge"       → child_ids: ["airlie"]
"[PAY] Cole + Greta soccer"      → child_ids: ["cole", "greta"]
"[SPORT] practice schedule"      → child_ids: []  (family-wide)
```

Names checked: Cole, Greta, Airlie, Clara, Heidi, Daisy (case-insensitive).

---

## The Scan Script

**Location:** `scripts/gmail_scan.py`

**What it does:**
1. Connects to Gmail via the `gcal` external-tool connector
2. Fetches unread emails from the dedicated inbox
3. For each email — checks for a subject tag, then either fast-paths or calls the LLM
4. POSTs to `POST /api/inbox/scan` on the Express backend
5. The backend deduplicates by `gmail_id` (already-processed emails are skipped)
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

If you've migrated off Perplexity, replace the `call_tool()` function with a direct Gmail API call using a service account or OAuth2 credentials. The rest of the script is standard Python with no Perplexity dependencies. See [Platform Migration](#platform-migration) below.

---

## Daily Cron

The scan runs automatically every day at **7:00 AM EDT (11:00 UTC)** via a Perplexity scheduled task.

**Cron ID:** `1327ea9d`  
**Schedule:** `0 11 * * *` (UTC)  
**What happens:**
1. Gmail is searched for unread emails
2. Each email is processed through the tag parser / LLM
3. Items are queued in `pending_imports`
4. If new items were found, an in-app notification is sent
5. If nothing new, the run ends silently

---

## The Inbox UI

In the app, navigate to **Inbox** (sidebar). Each scanned email appears as a card showing:

- Email subject, sender, date
- Each extracted item with type, date, amount, child tags, confidence level, and the exact quote from the email that triggered it
- **Add** — commits the item to the right module (Schedule, Medical, Payments, or Camps)
- **Skip** — dismisses the item without saving
- **Dismiss all** — ignores the entire email

Once all items in an email are accepted or skipped, it disappears from the queue.

---

## Platform Migration

If you move off Perplexity, the Gmail integration needs to be replaced. Two options:

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

See `DEPLOYMENT.md` → Option C for Postmark setup details.

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

## Supabase Table

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
  category?: string;    // matches categories table
  notes?: string;
  confidence: "high" | "medium" | "low";
  source_hint: string;  // quote from email that triggered this
  _accepted?: boolean;  // set when user clicks Add
  _dismissed?: boolean; // set when user clicks Skip
}
```
