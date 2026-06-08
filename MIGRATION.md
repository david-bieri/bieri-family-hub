# Migration Plan — Perplexity Computer → Self-Hosted (Render + Supabase + Twilio)

**Status:** Planned — not started  
**Target:** Fully self-hosted, platform-independent stack running 24/7  
**Trigger:** When the app is stable and in daily use (post stress-testing phase)

> **Note on OpenClaw:** Initially considered as the agent runtime, but not the right fit here.
> OpenClaw is a personal AI assistant for one user — its iMessage integration requires a
> macOS companion app running permanently, and running it on a Linux VPS means maintaining
> a server with no meaningful benefit over Render's built-in cron. The simpler path (below)
> achieves the same goals for less cost and zero VPS maintenance.
> See the bottom of this document for using OpenClaw as a **learning project** instead.

---

## Goals

1. **Direct message intake** — Nancy or David can add items from iMessage/WhatsApp/SMS using `#TAG @Name` syntax without email forwarding
2. **Platform independence** — app runs 24/7 without requiring an active Perplexity Computer session
3. **Same user experience** — React app, Supabase, and all existing workflows unchanged

---

## Target Architecture

```
SMS / WhatsApp (Twilio, ~$1-2/mo)
        │
        ▼  webhook POST
Express API — POST /api/sms-intake  ←── new endpoint (20 lines)
        │
        ├─ POST /api/inbox/scan (existing — unchanged)
        ├─ All other REST endpoints (unchanged)
        └─ Serves React frontend
        │
        ▼
Supabase (already live — no changes)

Render Cron Job (free, built into Render)
        │  runs daily at 7am EDT
        └─ bash scripts/post_emails.sh  (already written)

React Frontend → Vercel (free) or served by Express (already works)
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

## Phase 3 — Migrate Gmail Cron to Render

Replace the Perplexity daily cron with a **Render Cron Job** — free, no server to maintain.

### Steps

1. In the Render dashboard, create a **Cron Job** service (same repo as the Web Service)
2. Set the schedule: `0 11 * * *` (daily 11:00 UTC = 7:00 AM EDT)
3. Set the command:
   ```bash
   bash scripts/post_emails.sh
   ```
4. Set the same environment variables as the Web Service, plus:
   ```
   GMAIL_LOOKBACK_DAYS=3
   ```

### Gmail auth — swap out the Perplexity connector

The cron currently uses the `gcal` Perplexity connector for Gmail search. On Render, replace it with IMAP:

**Option A — IMAP App Password (simplest, no Google API setup)**
- Enable 2FA on `bieri.family.hub@gmail.com`
- Generate an [App Password](https://support.google.com/accounts/answer/185833)
- Add to Render env: `GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx`
- Update `scripts/gmail_scan.py` — swap `call_tool()` for `imaplib` search (see `docs/EMAIL_SCANNER.md` Option C)

**Option B — Gmail API OAuth2 (more robust, handles token refresh automatically)**
- Create a project at [console.cloud.google.com](https://console.cloud.google.com)
- Enable the Gmail API, create OAuth2 credentials
- Run auth flow locally once → upload `token.json` as a Render secret file

### Verification checklist
- [ ] Render cron job runs on schedule
- [ ] Gmail IMAP search returns emails from the last 3 days
- [ ] `post_emails.sh` completes without error
- [ ] New items appear in pending_imports in Supabase

---

## Phase 4 — SMS / WhatsApp Intake via Twilio

Add direct message intake so Nancy or David can add items by text — no email forwarding needed.

### How it works

1. Sign up for [Twilio](https://twilio.com) — get a phone number (~$1/mo) or use WhatsApp sandbox (free for testing)
2. Configure a webhook: inbound SMS/WhatsApp → `POST https://bieri-family-hub.onrender.com/api/sms-intake`
3. Add `POST /api/sms-intake` to `server/routes.ts` — about 20 lines:

```ts
app.post("/api/sms-intake", async (req, res) => {
  const body = req.body.Body || req.body.body || "";
  const from = req.body.From || req.body.from || "sms";
  const id = `sms-${Date.now()}`;

  // Reuse the exact same inbox scan logic
  const result = await scanEmail({
    gmail_id: id,
    subject: body.trim(),      // the text message becomes the "subject"
    from,
    date: new Date().toISOString(),
    snippet: "",
    body: "",
  });

  res.json(result);
});
```

Nancy texts **the Twilio number**:
```
#MED @Clara dentist Thursday June 12 2pm
```
→ item appears in the Inbox queue within seconds, ready to Accept or Skip.

### Why this works cleanly

The SMS body is treated as the email subject. The existing `#TAG @Name` fast-path parser handles it identically — no new extraction logic needed.

### Verification checklist
- [ ] Twilio number configured with webhook URL
- [ ] Text `#MED @Clara test` → item appears in Inbox queue
- [ ] Text `#CAMP @Airlie @Heidi test camp` → tagged with both children
- [ ] Duplicate text → deduplication works (unique ID per message timestamp)

---

## Cutover Checklist (final)

Before turning off Perplexity cron:

- [ ] Render Web Service live and stable for 1+ week
- [ ] Render Cron Job has run successfully for 3+ consecutive days
- [ ] All family members can reach the app via its Render URL
- [ ] SMS intake tested by both David and Nancy
- [ ] Cancel Perplexity cron: `pplx-tool schedule_cron --action delete --cron_id 1327ea9d`
- [ ] Update `DEPLOYMENT.md` to reflect new stack
- [ ] Update `docs/EMAIL_SCANNER.md` — replace Perplexity `gcal` connector section with IMAP section

---

## Cost Summary (post-migration)

| Service | Cost | Purpose |
|---|---|---|
| Render Web Service | Free | Express API backend + React frontend |
| Render Cron Job | Free | Daily Gmail scan |
| Twilio phone number | ~$1/mo | SMS/WhatsApp intake |
| Supabase | Free | Database |
| Vercel | Free | React frontend (optional, if splitting from backend) |
| **Total** | **~$1/mo** | |

Current cost on Perplexity: covered by subscription. Post-migration cost is essentially zero.

---

## Learning Project — OpenClaw on DigitalOcean

OpenClaw is not the right fit for the Family Hub migration, but it is an excellent hands-on
AI learning project. Setting it up teaches the core concepts behind every modern AI agent
system: model routing, tool use, memory, skills, and multi-channel messaging.

### Why it's a good learning vehicle

- **Skills system** — identical concept to Perplexity Computer skills, but fully open-source
  and inspectable. You can read exactly how skill loading, context injection, and tool
  registration work under the hood.
- **Multi-model routing** — point it at Claude, GPT-5, Gemini, local Ollama models.
  Swap models per task and see the difference hands-on.
- **Tool use in practice** — the browser tool, cron, file system, and webhook tools are all
  real implementations you can read, fork, and modify.
- **Memory architecture** — OpenClaw stores memory as local Markdown files. Inspecting and
  editing them directly builds intuition for how agent memory works.
- **Messaging integration** — connecting a real WhatsApp or Telegram channel to an AI agent
  is a foundational skill for any AI-augmented workflow.

### Suggested learning path

**Step 1 — Install locally first (not a VPS)**
```bash
curl -fsSL https://openclaw.ai/install.sh | bash
openclaw onboard
```
Run it on your Mac. Connect Telegram or Discord (easier than iMessage for testing).
Ask it to do simple tasks: search the web, read a file, set a reminder.

**Step 2 — Build a simple custom skill**
Write a skill that POSTs to your Family Hub `/api/inbox/scan`. This is the same
skill format you already know from the `family-inbox-scanner` skill in this repo.
Seeing the same skill work in two different runtimes (Perplexity and OpenClaw) builds
real transferable knowledge.

**Step 3 — Explore model swapping**
Point OpenClaw at a local Ollama model (e.g. `llama3.2`). Run the same task you use
the Perplexity `sonar` model for in `emailExtractor.ts`. Compare quality, latency, cost.
This is the fastest way to build practical intuition about model selection.

**Step 4 — Connect a real messaging channel**
Set up WhatsApp or Telegram as an input channel. This is the iMessage-equivalent
that doesn't require a macOS companion app. Once working, you'll understand exactly
what value the Twilio webhook approach gives you (and what it costs in complexity).

**Step 5 — VPS deployment (optional, advanced)**
Only after Steps 1–4 feel comfortable: spin up a $6 DigitalOcean droplet and run
OpenClaw as a systemd service. This teaches Linux server management, process supervision,
reverse proxying with nginx, and Let's Encrypt SSL — all foundational DevOps skills.

### What this teaches that Perplexity abstracts away

| Concept | Perplexity | OpenClaw (local) |
|---|---|---|
| How skills are loaded | Opaque | Open source — read `skills/loader.ts` |
| How tools are registered | Opaque | Open source — read `tools/registry.ts` |
| How memory persists | Opaque | Markdown files in `~/.openclaw/memory/` |
| Model API calls | Abstracted | You write the API call, see the raw response |
| Token costs | Abstracted | You see exactly what each call costs |

---

## Reference

- [OpenClaw docs](https://openclaw.ai)
- [OpenClaw GitHub](https://github.com/openclaw/openclaw)
- [Twilio SMS webhooks](https://www.twilio.com/docs/sms/tutorials/how-to-receive-and-reply)
- [Twilio WhatsApp sandbox](https://www.twilio.com/docs/whatsapp/sandbox)
- [Gmail IMAP App Passwords](https://support.google.com/accounts/answer/185833)
- [Render cron jobs](https://render.com/docs/cronjobs)
- [Gmail API setup](https://console.cloud.google.com)
- [Render deployment](https://render.com)
- Current Perplexity cron ID: `1327ea9d`
- Supabase project: `cebnubrjvtjeewaphcxf`
- GitHub repo: `https://github.com/david-bieri/bieri-family-hub`
