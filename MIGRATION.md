# Migration Plan — Perplexity Computer → OpenClaw + Self-Hosted

**Status:** Planned — not started  
**Target:** Fully self-hosted, platform-independent stack running 24/7  
**Trigger:** When the app is stable and in daily use (post stress-testing phase)

---

## Goals

1. **Direct message intake** — Nancy or David can add items from iMessage/WhatsApp using `#TAG @Name` syntax without email forwarding
2. **Platform independence** — app runs 24/7 without requiring an active Perplexity Computer session
3. **Same user experience** — React app, Supabase, and all existing workflows unchanged

---

## Target Architecture

```
iMessage / WhatsApp / Telegram
        │
        ▼
OpenClaw Gateway (DigitalOcean VPS, $6/mo)
        │  ├─ Receives #TAG @Name messages directly
        │  ├─ Runs daily Gmail cron (replaces Perplexity cron 1327ea9d)
        │  └─ Executes family-inbox-scanner skill
        │
        ▼
Express API Backend (Render, free tier)
        │  ├─ POST /api/inbox/scan
        │  ├─ All existing REST endpoints
        │  └─ Serves React frontend (or delegates to Vercel)
        │
        ▼
Supabase (already live — no changes)
        │
        ▼
React Frontend (Vercel, free tier — optional)
```

---

## What Transfers Unchanged

| Asset | Status |
|---|---|
| Express + Supabase backend | Zero changes — just pointed at from OpenClaw instead of Perplexity |
| React frontend | Zero changes |
| `migration.sql` | Zero changes |
| `#TAG @Name` flag syntax | Zero changes — works from iMessage just like email subjects |
| `family-inbox-scanner` skill | Trivial adapt — OpenClaw uses same AgentSkills markdown format |
| `post_emails.sh` | Adapt to OpenClaw cron task |
| All Supabase data | Stays in place — no export/import needed |

---

## What Changes

| Component | Current (Perplexity) | After (OpenClaw) |
|---|---|---|
| Agent runtime | Perplexity Computer session | OpenClaw gateway on DigitalOcean VPS |
| Daily Gmail cron | Perplexity `schedule_cron` (ID: 1327ea9d) | OpenClaw cron skill, same `0 11 * * *` schedule |
| Gmail auth | `gcal` connector (Perplexity OAuth) | Gmail API OAuth2 with service account or App Password |
| In-app notifications | Perplexity `send_notification` | OpenClaw → iMessage/WhatsApp message to David |
| Item intake (manual) | Email forward to bieri.family.hub@gmail.com | Direct iMessage/WhatsApp to OpenClaw |
| Item intake (automated) | Email forward → Gmail scan | Same Gmail scan OR direct message intake |

---

## Phase 1 — Stabilise (now, weeks 1–4)

**Do not migrate yet. Focus on:**

- [ ] Nancy completes large-scale email forwarding test
- [ ] Identify and fix extraction failures (wrong category, missed dates, wrong child)
- [ ] Populate vaccine records for all 6 kids
- [ ] Populate vaccine records for Otis, Athena, Persephone
- [ ] Enter recurring events (soccer practice, swim lessons, etc.)
- [ ] Live with the Family Calendar as the actual source of truth for one full week
- [ ] Identify any missing modules or UI gaps

**Migration readiness signal:** The app is open daily. The Inbox queue is being used. The calendar reflects real life.

---

## Phase 2 — Self-Host the Backend (Render + Vercel)

Deploy the Express API and React frontend independently of Perplexity.

### Steps

1. **Create Render account** at [render.com](https://render.com)
2. **Create Web Service** — connect `david-bieri/bieri-family-hub` repo
   - Build: `npm ci && npm run build`
   - Start: `npm start`
   - Port: `5000`
3. **Set environment variables** on Render:
   ```
   SUPABASE_URL=https://cebnubrjvtjeewaphcxf.supabase.co
   SUPABASE_ANON_KEY=eyJ...
   APP_PASSWORD=bieri2026
   PPLX_API_KEY=pplx-...
   NODE_ENV=production
   ```
4. **Note the Render service URL** (e.g. `https://bieri-family-hub.onrender.com`)
5. **(Optional) Deploy frontend to Vercel** — set `VITE_API_URL` to Render URL
6. **Smoke test** — open the app, log in, check all modules

### Verification checklist
- [ ] Login works
- [ ] Dashboard loads data from Supabase
- [ ] POST /api/inbox/scan returns extracted items
- [ ] Family Calendar renders and sharing link works
- [ ] Pets module loads

---

## Phase 3 — Stand Up OpenClaw on DigitalOcean

### Steps

1. **Create DigitalOcean account** at [digitalocean.com](https://digitalocean.com)
2. **Create Droplet** — use the [1-Click OpenClaw deploy](https://openclaw.ai) or a plain Ubuntu 24.04 $6/mo droplet
3. **SSH into droplet** and run onboarding:
   ```bash
   curl -fsSL https://openclaw.ai/install.sh | bash
   openclaw onboard
   ```
   Follow the wizard — it configures the gateway, workspace, and channels.
4. **Connect a chat channel** — iMessage (via macOS companion) or WhatsApp/Telegram
   - For iMessage: install the OpenClaw macOS companion app, pair with the droplet
   - For WhatsApp/Telegram: follow the channel setup in `openclaw onboard`
5. **Set environment variables** on the droplet:
   ```bash
   export FAMILY_HUB_API=https://bieri-family-hub.onrender.com
   export PPLX_API_KEY=pplx-...   # or swap for any other model key
   ```
6. **Install the family-inbox-scanner skill:**
   ```bash
   openclaw skills install family-inbox-scanner
   # or copy the skill directory from the repo
   ```

### Verification checklist
- [ ] OpenClaw gateway running as systemd service (survives reboot)
- [ ] Can send a message from iMessage/WhatsApp and get a response
- [ ] `openclaw cron list` shows the daily scan job

---

## Phase 4 — Migrate Gmail Cron to OpenClaw

Replace Perplexity cron `1327ea9d` with an OpenClaw cron task.

### Gmail auth options (pick one)

**Option A — Gmail API OAuth2 (recommended)**
- Create a project at [console.cloud.google.com](https://console.cloud.google.com)
- Enable the Gmail API
- Create OAuth2 credentials → download `credentials.json`
- Run the auth flow once: `python3 scripts/gmail_auth.py` → generates `token.json`
- Store `token.json` on the droplet; refresh is automatic

**Option B — IMAP with App Password (simpler)**
- Enable 2FA on `bieri.family.hub@gmail.com`
- Generate an [App Password](https://support.google.com/accounts/answer/185833)
- Update `gmail_scan.py` to use `imaplib` instead of the `gcal` connector
- No OAuth dance needed

### Cron setup on OpenClaw
```bash
# Add to OpenClaw cron (runs daily at 7am EDT = 11:00 UTC)
openclaw cron add --schedule "0 11 * * *" --task "run family inbox scan"
```

The task body follows the same pattern as the current Perplexity cron:
1. Search Gmail (via Gmail API or IMAP instead of `gcal` connector)
2. Write `/tmp/emails_to_scan.json`
3. Run `bash /path/to/post_emails.sh`
4. Send iMessage/WhatsApp notification if new items found (instead of Perplexity `send_notification`)

### Verification checklist
- [ ] Cron fires at 7am EDT
- [ ] Gmail search returns results
- [ ] POST to Render backend succeeds
- [ ] Notification arrives via iMessage/WhatsApp

---

## Phase 5 — Direct Message Intake

Once the cron is working, enable the high-value feature: adding items directly from iMessage/WhatsApp.

### How it works

Nancy or David sends:
```
#MED @Clara dentist Thursday June 12 2pm
```

OpenClaw receives the message, extracts the text, and POSTs to:
```
POST https://bieri-family-hub.onrender.com/api/inbox/scan
{
  "gmail_id": "imessage-<timestamp>",
  "subject": "#MED @Clara dentist Thursday June 12 2pm",
  "from": "Nancy Bieri",
  "date": "<now>",
  "snippet": "",
  "body": ""
}
```

The existing fast-path parser handles it identically to an email subject. Item lands in the Inbox queue for review.

### OpenClaw skill addition needed

Add a `family-intake` skill to OpenClaw that:
- Detects messages containing `#TAG` patterns
- Constructs the POST payload
- Calls `/api/inbox/scan`
- Replies with a confirmation: "Got it — 1 item queued for review"

### Verification checklist
- [ ] Send `#MED @Clara test item` from iMessage → item appears in Inbox queue
- [ ] Send `#CAMP @Airlie @Heidi test camp` → item tagged with both children
- [ ] Send untagged message → LLM extraction still runs
- [ ] Duplicate message → returns "already queued" (dedup by content hash)

---

## Cutover Checklist (final)

Before turning off Perplexity cron:

- [ ] OpenClaw cron has run successfully for 3+ consecutive days
- [ ] Render backend has been live for 1+ week without issues
- [ ] All family members can reach the app via its Render/Vercel URL
- [ ] iMessage/WhatsApp intake tested by both David and Nancy
- [ ] Cancel Perplexity cron: `pplx-tool schedule_cron --action delete --cron_id 1327ea9d`
- [ ] Update `DEPLOYMENT.md` to reflect new stack
- [ ] Update `docs/EMAIL_SCANNER.md` — remove Perplexity-specific sections

---

## Cost Summary (post-migration)

| Service | Cost | Purpose |
|---|---|---|
| DigitalOcean Basic Droplet | $6/mo | OpenClaw gateway + cron runner |
| Render Web Service | Free | Express API backend |
| Vercel | Free | React frontend (optional) |
| Supabase | Free | Database |
| **Total** | **~$6/mo** | |

Current cost on Perplexity: covered by subscription. Post-migration is essentially free beyond the $6 droplet.

---

## Reference

- [OpenClaw docs](https://openclaw.ai)
- [OpenClaw GitHub](https://github.com/openclaw/openclaw)
- [DigitalOcean 1-Click OpenClaw](https://marketplace.digitalocean.com)
- [Gmail API setup](https://console.cloud.google.com)
- [Render deployment](https://render.com)
- Current Perplexity cron ID: `1327ea9d`
- Supabase project: `cebnubrjvtjeewaphcxf`
- GitHub repo: `https://github.com/david-bieri/bieri-family-hub`
