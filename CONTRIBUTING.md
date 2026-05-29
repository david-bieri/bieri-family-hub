# Contributing to Bieri Family Hub

This is a private family project. These notes are for future-you (or anyone trusted with access) making changes.

---

## Development Workflow

```bash
# Start dev server (hot reload, frontend + backend on port 5000)
npm run dev

# Type-check
npm run check

# Build for production
npm run build

# Run production build locally
npm start
```

## Adding a New Page

1. Create `client/src/pages/YourPage.tsx`
2. Import and add a `<Route path="/your-path" component={YourPage} />` in `client/src/App.tsx`
3. Add a nav entry in the `NAV` array in `client/src/components/Layout.tsx` (pick an icon from `lucide-react`)

## Adding a New API Endpoint

All routes live in `server/routes.ts` inside `registerRoutes()`. Follow the existing pattern:

```ts
app.get("/api/your-resource", async (req, res) => {
  const { data, error } = await supabase.from("your_table").select("*");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});
```

Always use `apiRequest` from `@/lib/queryClient` on the frontend — never raw `fetch()`. Raw fetch bypasses the `VITE_API_URL` / `__PORT_5000__` rewriting and will 404 in production.

## Adding a New Supabase Table

1. Write the `CREATE TABLE` SQL
2. Run it in the Supabase SQL editor
3. Append it to `migration.sql` so future fresh installs pick it up
4. Add any Row Level Security policies if needed (currently all tables use `anon` key with open policies — fine for a private app behind a password)

## Adding a New Child

Edit `client/src/lib/children.ts`. Each child needs:

```ts
{
  id: "firstname-lowercase",   // used as foreign key in DB
  name: "Firstname",
  dob: "YYYY-MM-DD",
  colorClass: "bg-[#hexcode]", // Tailwind arbitrary value for avatar backgrounds
}
```

Also add the hex colour to the `CHILD_COLORS` map in `SharedCalendar.tsx`.

The `@mention` parser in `server/emailExtractor.ts` reads from the same `CHILDREN` constant — prefix-matching is automatic once you add the child there.

## Adding a New Pet

Add a row to the `pets` table in Supabase (or edit the seed data in `migration.sql`). Pets are data-driven — no code changes needed in `Pets.tsx` unless you want to change the UI.

To associate a pet color with the Family Calendar, add an entry to the `PET_COLORS` map in `SharedCalendar.tsx`.

The `@mention` parser in `server/emailExtractor.ts` fetches pet names from Supabase at runtime — new pets are picked up automatically.

## Categories

Built-in category IDs are in `client/src/lib/categories.ts` (`BUILTIN_IDS`). The `Categories` page prevents deletion of built-ins by checking against this list on the frontend. The backend does not enforce this — if you want server-side protection, add a check in the DELETE route in `routes.ts`.

Currently protected built-ins: `school`, `sports`, `medical`, `camp`, `family`, `payment`, `other`. Note that `pets` is seeded in the database but is not in `BUILTIN_IDS` — add it there if you want to protect it from accidental deletion.

## Auth

Auth is a single shared password stored in the `APP_PASSWORD` environment variable (default: `bieri2026`). The client receives a base64 token on login and stores it in the URL query param `?t=`. This is intentional — `localStorage` and `sessionStorage` are blocked inside Perplexity's sandboxed iframe environment. On a self-hosted deployment, you could replace this with a proper cookie-based session if preferred.

## Code Style

- TypeScript everywhere — avoid `any` where practical
- No raw `fetch()` on the frontend — always `apiRequest`
- No `localStorage` / `sessionStorage` / `indexedDB` — React state or URL params only
- Keep components in `client/src/pages/`, shared UI in `client/src/components/ui/`
- Data-testid attributes on every interactive element: `{action}-{target}` pattern

## Email Scanner

The scanner lives in two places:

- **`server/emailExtractor.ts`** — tag parsing and LLM extraction logic. The `#TAG @Name` fast-path runs first (instant, no LLM). If no tag is found, calls `POST https://api.perplexity.ai/chat/completions` with the `sonar` model. If the API key is missing or the call fails, `fallbackExtract()` runs a regex pass instead.
- **`scripts/gmail_scan.py`** — the standalone Python script that talks to Gmail via the `external-tool` CLI and POSTs each email to `/api/inbox/scan`. This is what the daily cron runs.

### Flag syntax (`#TAG @Name`)

The current subject-line syntax is `#TAG @Name1 @Name2 rest of subject`:

```
#CAMP @Airlie VA Techniques Summer Camp
#SPORT @Cole @Greta soccer practice Tue/Thu
#MED @Clara dentist June 3 2pm
#PAY @Heidi swim lessons $120 due June 1
#PET @Otis annual vaccines due
```

Rules:
- `#TAG` can appear anywhere in the subject (not just the start)
- `@Name` prefix-matches children AND pets (e.g. `@Air` → Airlie, `@Oth` → Otis)
- Everything that isn't a `#TAG` or `@mention` becomes the clean item title
- Tags are case-insensitive

### Supported tags

| Tag | Category | Type |
|---|---|---|
| `#CAMP` | camp | registration |
| `#SPORT` | sports | event |
| `#SCHOOL` | school | event |
| `#MED` | medical | appointment |
| `#PAY` | payment | payment |
| `#REG` | other | registration |
| `#PET` | pets | appointment |
| `#FAM` | family | event |

### Adding or changing tags

To add a new tag:

1. Add it to `TAG_MAP` in `server/emailExtractor.ts`
2. Add it to `TAG_MAP` in `scripts/gmail_scan.py`
3. Document it in `docs/EMAIL_SCANNER.md`

### Updating the Gmail search queries

The queries are in `scripts/gmail_scan.py` under `SEARCH_QUERIES`. Keep them broad — false positives are fine (the LLM will return an empty array for irrelevant emails). False negatives (missed emails) are the real cost.

### Platform migration for Gmail

See `docs/EMAIL_SCANNER.md` — Platform Migration section for Gmail API OAuth2, Postmark webhook, and IMAP alternatives that don't depend on the Perplexity `external-tool` CLI.

---

## Vaccine Tracker

### Children (`vaccines` table)

Columns: `id`, `child_id`, `name`, `date_given`, `next_due`, `status`, `provider`, `administered_by`, `lot_number`, `notes`

Valid status values: `completed` | `scheduled` | `overdue` | `not_required` | `declined`

Overdue detection is automatic on the Medical page — any record with status `scheduled` and a `next_due` date in the past is displayed as `overdue` with a red badge.

### Pets (`pet_vaccines` table)

Same column structure as `vaccines` but with `pet_id` instead of `child_id`. The Pets page shows a red badge on the Vaccines tab when any vaccine is overdue. API routes: `GET/POST/PUT/DELETE /api/pet-vaccines`.

---

## Dependency Notes

- `nanoid` is pinned to v3 (`nanoid@3`) — v4+ uses ESM-only exports incompatible with the CJS server bundle
- `ws` is explicitly imported and passed to the Supabase client constructor to fix a Node.js 20 WebSocket issue
- Tailwind is v3 — do **not** upgrade to v4 without updating all `@tailwind` directives (v4 uses `@import "tailwindcss"`)
