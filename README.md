# Bieri Family Hub

A private family administration dashboard for tracking schedules, medical records, sports, summer camps, payments, pets, and more — built for a family of 8 (2 parents + 6 kids + 3 pets).

## Features

- **Dashboard** — at-a-glance view of upcoming events, appointments, and payment deadlines
- **Family Calendar** — unified monthly calendar across all modules, color-coded by category and child; filterable by child or event type; shareable read-only link (no login required)
- **Schedule** — one-off and recurring events (daily + weekly patterns) with per-child tagging
- **Medical** — per-child vaccine tracker with status badges (completed / scheduled / overdue / not_required / declined), overdue auto-detection, and appointment tracking
- **Sports** — sport registrations and practice schedules per child
- **Camps & Registrations** — summer camp and program tracking with deadline alerts
- **Payments** — payment ledger with due-date reminders and status tracking
- **Categories** — 8 built-in categories + unlimited custom categories with color picker
- **Pets** — profiles for Otis, Athena, and Persephone; per-pet Vet, Vaccines, Medications, and Grooming tabs; vaccine tracker with overdue detection
- **Inbox Scanner** — daily Gmail scan extracts deadlines, appointments, and payments from forwarded emails; `#TAG @Name` subject syntax bypasses the LLM for instant classification; human-in-the-loop review before anything is committed

## Documentation

| Document | Description |
|---|---|
| `README.md` | This file — setup, tech stack, project structure |
| `CHANGELOG.md` | Full version history |
| `CONTRIBUTING.md` | How to add pages, endpoints, children; key gotchas |
| `DEPLOYMENT.md` | Self-hosting on Render, Vercel, Fly.io, Docker |
| `docs/EMAIL_SCANNER.md` | Full email scanner docs — architecture, tags, migration paths |
| `migration.sql` | Complete Supabase schema, runnable on any fresh project |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS v3, shadcn/ui, TanStack Query v5 |
| Backend | Express 5, Node.js 20, TypeScript |
| Database | Supabase (Postgres) |
| Routing | wouter (hash-based, works in iframes) |
| Auth | Single shared password; token stored in URL query param |

## Environment Variables

See [`.env.example`](./.env.example) for the full list. Key variables:

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `APP_PASSWORD` | Yes | Shared family login password |
| `PPLX_API_KEY` | For email scanner | Perplexity API key (LLM extraction fallback) |
| `VITE_API_URL` | Self-hosting only | Backend URL when frontend/backend are on separate domains |

---

## Local Development

### Prerequisites

- Node.js 20+
- A Supabase project (free tier is fine)

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/david-bieri/bieri-family-hub.git
cd bieri-family-hub

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env and fill in your Supabase URL, anon key, and app password

# 4. Apply the database migration
# Paste the contents of migration.sql into the Supabase SQL editor and run it

# 5. Start the dev server
npm run dev
```

The app will be available at `http://localhost:5000`.

### Database Migration

The full migration SQL is in [`migration.sql`](./migration.sql). Run it once in the Supabase SQL editor to create all tables and seed the built-in categories.

## Building for Production

```bash
npm run build
# Output: dist/index.cjs (server) + dist/public/ (frontend assets)

npm start
# Starts the production server on port 5000
```

## Deployment

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for full instructions on deploying to:

- **Render** (recommended for the backend)
- **Vercel** (recommended for the frontend, if deploying separately)
- **Fly.io** (single-service deployment)
- **Docker** (self-hosted VPS)

## Project Structure

```
bieri-family-hub/
├── client/                 # React frontend (Vite)
│   ├── index.html
│   └── src/
│       ├── App.tsx         # Root component + routing + share-token detection
│       ├── components/
│       │   ├── Layout.tsx  # Sidebar navigation (includes Pets + Inbox badge)
│       │   ├── ChildBadge.tsx
│       │   └── ui/         # shadcn/ui components
│       ├── lib/
│       │   ├── auth.tsx    # Auth context + URL-token logic
│       │   ├── categories.ts
│       │   ├── children.ts # Kids data (names, colors, birthdates)
│       │   └── queryClient.ts
│       └── pages/
│           ├── Dashboard.tsx
│           ├── FamilyCalendar.tsx
│           ├── SharedCalendar.tsx  # Public read-only view (no auth)
│           ├── Schedule.tsx
│           ├── Medical.tsx         # Per-child vaccine tracker
│           ├── Sports.tsx
│           ├── Camps.tsx
│           ├── Payments.tsx
│           ├── Categories.tsx
│           ├── InboxImports.tsx    # Email review UI
│           └── Pets.tsx            # Pet profiles + Vet/Vaccines/Meds/Grooming
├── server/
│   ├── index.ts            # Express app setup
│   ├── routes.ts           # All API endpoints
│   ├── emailExtractor.ts   # Tag parsing + LLM extraction
│   ├── supabase.ts
│   └── static.ts           # Static file serving (production)
├── shared/
│   └── schema.ts           # Shared types
├── scripts/
│   └── gmail_scan.py       # Standalone Gmail scan script (daily cron)
├── docs/
│   └── EMAIL_SCANNER.md    # Email scanner documentation
├── migration.sql           # Full Supabase schema
├── Dockerfile
├── .env.example
└── package.json
```

## Children

| Name | Birthday | Color |
|---|---|---|
| Cole | June 29, 2012 | Blue (`#3b82f6`) |
| Greta | September 25, 2013 | Purple (`#8b5cf6`) |
| Airlie | March 9, 2015 | Green (`#22c55e`) |
| Clara | August 23, 2016 | Amber (`#f59e0b`) |
| Heidi | March 9, 2023 | Rose (`#ec4899`) |
| Daisy | January 28, 2025 | Teal (`#14b8a6`) |

## Pets

| Name | Breed | Color |
|---|---|---|
| Otis | Bernese Mountain Dog | Brown (`#78350f`) |
| Athena | Russian Blue cat | Slate (`#64748b`) |
| Persephone | Black Bombay cat | Dark indigo (`#1e1b4b`) |

## Supabase Tables

| Table | Description |
|---|---|
| `events` | All calendar events (includes recurrence columns) |
| `vaccines` | Child vaccine records with status, lot number, administered_by |
| `medical_appointments` | Child doctor/dentist appointments |
| `sports` | Sport registrations and schedules |
| `registrations` | Camp and program registrations |
| `payments` | Payment ledger |
| `categories` | 8 built-in + unlimited custom categories |
| `share_tokens` | Read-only calendar share tokens |
| `pending_imports` | Email scan queue (human review before commit) |
| `pets` | Pet profiles (Otis, Athena, Persephone) |
| `pet_vet_appointments` | Vet appointment records per pet |
| `pet_medications` | Medication records per pet |
| `pet_grooming` | Grooming records per pet |
| `pet_vaccines` | Pet vaccine records with status, lot number, administered_by |

## License

MIT
