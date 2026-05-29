# Changelog

All notable changes to Bieri Family Hub are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.5.0] — 2026-05-29

### Added
- **Vaccine tracker — children** — per-child collapsible sections in Medical page showing all vaccine records with status badges (Completed /  Scheduled / Overdue / Not required / Declined); overdue + due-soon auto-detected from `next_due` date; alert banner at top of Medical page when action needed
- **Vaccine tracker — pets** — new Vaccines tab in each pet card (Otis, Athena, Persephone); same status badge system; red badge on tab when overdue vaccines exist
- **Shared fields on all vaccine records:** status, administered_by, lot number, notes, next due/booster date
- New Supabase table: `pet_vaccines` (pet_id, name, date_given, next_due, status, provider, administered_by, lot_number, notes)
- Supabase migration: added `status`, `administered_by`, `lot_number` columns to existing `vaccines` table

### Changed
- Medical page: Vaccines tab moved to be the primary (default) tab; per-child accordion layout replaces flat list
- Pets page: Vaccines tab added between Vet and Medications

## [1.4.0] — 2026-05-29

### Added
- **Pets module** — profiles for Otis, Athena, Persephone; vet appointments, medications & grooming tabs per pet
- **`#TAG @Name` flag syntax** — replaces `[TAG]` prefix; supports `#CAMP`, `#SPORT`, `#SCHOOL`, `#MED`, `#PAY`, `#REG`, `#PET`, `#FAM`; `@mentions` match children and pets by prefix (e.g. `@Air` → Airlie)
- **Pets in Family Calendar** — vet and grooming appointments appear in unified calendar view with brown color coding
- **Pets category** in Supabase categories table (color `#78350f`)
- New Supabase tables: `pets`, `pet_vet_appointments`, `pet_medications`, `pet_grooming`

### Changed
- `emailExtractor.ts` fully rewritten: fast-path now uses `#TAG` syntax, `@mention` detection for both children and pets, smarter date extraction (month-name prioritised over ISO timestamps)
- `PawPrint` icon added to sidebar nav between Categories and Inbox

## [1.3.0] — 2026-05-29

### Added
- **Inbox Scanner** — daily automated Gmail scan with human-in-the-loop review
  - Dedicated Gmail account (`bieri.family.hub@gmail.com`) for clean signal — forward relevant emails there from any address
  - Subject-line tag shortcuts: `[CAMP]`, `[SPORT]`, `[SCHOOL]`, `[MED]`, `[PAY]`, `[REG]` — tagged emails skip the LLM entirely for instant, reliable classification
  - Child name detection from subject line — auto-assigns `child_ids` when a child's name appears in the subject
  - Full LLM extraction (Perplexity `sonar` model) for untagged emails — extracts type, title, date, time, amount, children, category, confidence, and source quote
  - Regex fallback extractor — works without an API key for basic pattern matching
  - Deduplication by `gmail_id` — emails already processed are silently skipped on subsequent runs
- **Inbox page** — new sidebar nav item with live unread-count badge
  - Each scanned email shown as a collapsible card with per-item Accept / Skip actions
  - Accept commits the item directly to the right Supabase table (events, medical_appointments, payments, or registrations)
  - Dismiss all — clears an entire email from the queue
  - Auto-refreshes every 30 seconds
- **Daily cron** — runs at 7:00 AM EDT (11:00 UTC), sends in-app notification only when new items are found; silent if nothing new
- `scripts/gmail_scan.py` — standalone scan script, fully documented and portable
- `docs/EMAIL_SCANNER.md` — full architecture docs including platform migration paths (Gmail API OAuth2, Postmark webhook, IMAP)

### Changed
- `server/routes.ts` — added `registerInboxRoutes()` with `/api/inbox/scan`, `/api/inbox/pending`, `/api/inbox/count`, `/api/inbox/:id/accept`, `/api/inbox/:id/dismiss`
- `server/index.ts` — registers inbox routes alongside main routes
- `Layout.tsx` — Inbox nav item with live badge count (polls `/api/inbox/count` every 60s)
- `App.tsx` — added `/inbox` route

### Infrastructure
- New Supabase table: `pending_imports` (gmail_id unique index for deduplication)
- New file: `server/emailExtractor.ts` — LLM extraction + regex fallback
- New env var: `PPLX_API_KEY` — Perplexity API key for sonar model (optional; falls back to regex)
- Updated `.env.example`, `README.md`, `CONTRIBUTING.md`, `DEPLOYMENT.md`, `migration.sql`

---

## [1.2.0] — 2026-05-29

### Added
- **Family Calendar** — unified monthly calendar view across all modules (events, appointments, payments, registration deadlines)
  - Color-coded by category with a sidebar legend
  - Filter by individual child (toggle per child)
  - Filter by event type (Event, Appointment, Payment Due, Deadline)
  - Click any day to expand a detail panel with times, child badges, and recurrence indicators
  - "Coming Up" sidebar list of upcoming items
- **Shareable read-only calendar link** — POST `/api/share/create` generates a permanent token; anyone with `/?share=<token>` can view the full calendar without logging in
  - Public view includes the same calendar grid, legend, children panel, and upcoming list
  - "Read Only" badge and no edit controls
- **Categories system** — manage event categories across all modules
  - 7 built-in categories: School, Sports, Medical, Camp, Family, Payment, Other
  - Create unlimited custom categories with name + color picker (preset swatches + free hex input)
  - Live badge preview while editing
  - Built-ins are protected from deletion (color/name editable only)
- **Recurring events** — events on the Schedule page can now repeat
  - Daily pattern: every N days
  - Weekly pattern: choose specific days of the week
  - Optional end date; defaults to 6 months ahead
  - Recurring instances shown with a ↻ indicator on the calendar
- **Navigation** — added "Family Calendar" and "Categories" to the sidebar

### Changed
- `queryClient.ts` now resolves API base URL from `VITE_API_URL` env var first, enabling self-hosted deployments where frontend and backend are on separate domains
- `Schedule.tsx` fully rewritten to support recurrence UI alongside standard one-off events

### Infrastructure
- Added `Dockerfile` for containerised self-hosting
- Added `.env.example` with all required and optional variables documented
- Added `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `DEPLOYMENT.md`
- New Supabase tables: `categories` (seeded with 7 built-ins), `share_tokens`
- New columns on `events`: `recurrence_type`, `recurrence_interval`, `recurrence_days`, `recurrence_end_date`, `parent_event_id`, `is_template`

---

## [1.1.0] — 2026-05-28

### Added
- **Payments module** — track payments with amount, due date, status (pending / paid / overdue / cancelled), and per-child or family-wide tagging
- **Camps & Registrations module** — track program registrations with deadlines, status, and notes
- **Dashboard** — overview cards for upcoming events (next 14 days), payment status, upcoming appointments, and registration deadlines
- Dark mode toggle (persists via `document.documentElement.classList`)

### Fixed
- Supabase client `ws` transport issue on Node.js 20 — explicitly passed `{ realtime: { transport: ws } }` to avoid WebSocket connection errors in the build environment

---

## [1.0.0] — 2026-05-27

### Added
- Initial scaffold: Express 5 + Vite + React 18 + Tailwind CSS v3 + shadcn/ui
- Supabase integration replacing default SQLite — enables real-time sync across two devices
- Single shared-password authentication; token stored in `?t=` URL query param (works in sandboxed iframes where `localStorage` and `sessionStorage` are blocked)
- Hash-based routing via `wouter` + `useHashLocation` (required for correct behaviour when served inside an iframe)
- **Schedule module** — add, edit, delete events with date, time, child tags, and category
- **Medical module** — vaccine records and appointment tracking per child
- **Sports module** — sport and activity registrations per child with practice day tracking
- Child data: Cole, Greta, Airlie, Clara, Heidi, Daisy — each with distinct accent colour
- Logo: custom inline SVG house mark; favicon derived from same mark
- Font: Plus Jakarta Sans (Google Fonts)
- Colour palette: warm sage green primary (`hsl(152 35% 30%)`), warm cream background
