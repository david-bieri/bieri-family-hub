# Bieri Family Hub

A private family administration dashboard for tracking schedules, medical records, sports, summer camps, payments, and more — built for a family of 8 (2 parents + 6 kids).

## Features

- **Dashboard** — at-a-glance view of upcoming events, appointments, and payment deadlines
- **Family Calendar** — unified monthly calendar across all modules, color-coded by category; filterable by child or event type; shareable read-only link (no login required)
- **Schedule** — one-off and recurring events (daily + weekly patterns) with per-child tagging
- **Medical** — vaccine records and appointment tracking per child
- **Sports** — sport registrations and practice schedules per child
- **Camps & Registrations** — summer camp and program tracking with deadline alerts
- **Payments** — payment ledger with due-date reminders and status tracking
- **Categories** — 7 built-in categories + unlimited custom categories with color picker
- **Inbox Scanner** — daily Gmail scan extracts deadlines, appointments, and payments from forwarded emails; subject-line tags (`[CAMP]`, `[SPORT]`, `[MED]`, `[PAY]`, `[SCHOOL]`, `[REG]`) bypass the LLM for instant classification; human-in-the-loop review before anything is committed

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
| `PPLX_API_KEY` | For email scanner | Perplexity API key (LLM extraction) |
| `VITE_API_URL` | Self-hosting only | Backend URL when frontend/backend are on separate domains |

---

## Local Development

### Prerequisites

- Node.js 20+
- A Supabase project (free tier is fine)

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/your-username/family-admin.git
cd family-admin

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
family-admin/
├── client/                 # React frontend (Vite)
│   ├── index.html
│   └── src/
│       ├── App.tsx         # Root component + routing + share-token detection
│       ├── components/
│       │   ├── Layout.tsx  # Sidebar navigation
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
│           ├── SharedCalendar.tsx  # Public read-only view
│           ├── Schedule.tsx
│           ├── Medical.tsx
│           ├── Sports.tsx
│           ├── Camps.tsx
│           ├── Payments.tsx
│           └── Categories.tsx
├── server/
│   ├── index.ts            # Express app setup
│   ├── routes.ts           # All API endpoints
│   ├── supabase.ts
│   └── static.ts           # Static file serving (production)
├── shared/
│   └── schema.ts           # Shared types
├── migration.sql           # Full Supabase schema
├── Dockerfile
├── .env.example
└── package.json
```

## Children

| Name | Birthday | Color |
|---|---|---|
| Cole | June 29, 2012 | Blue |
| Greta | September 25, 2013 | Purple |
| Airlie | March 9, 2015 | Green |
| Clara | August 23, 2016 | Amber |
| Heidi | March 9, 2023 | Rose |
| Daisy | January 28, 2025 | Teal |

## License

MIT
