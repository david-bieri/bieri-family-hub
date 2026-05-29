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

## Categories

Built-in category IDs are in `client/src/lib/categories.ts` (`BUILTIN_IDS`). The `Categories` page prevents deletion of built-ins by checking against this list on the frontend. The backend does not enforce this — if you want server-side protection, add a check in the DELETE route in `routes.ts`.

## Auth

Auth is a single shared password stored in the `APP_PASSWORD` environment variable (default: checked against `bieri2026`). The client receives a base64 token on login and stores it in the URL query param `?t=`. This is intentional — `localStorage` and `sessionStorage` are blocked inside Perplexity's sandboxed iframe environment. On a self-hosted deployment, you could replace this with a proper cookie-based session if preferred.

## Code Style

- TypeScript everywhere — avoid `any` where practical
- No raw `fetch()` on the frontend — always `apiRequest`
- No `localStorage` / `sessionStorage` / `indexedDB` — React state or URL params only
- Keep components in `client/src/pages/`, shared UI in `client/src/components/ui/`
- Data-testid attributes on every interactive element: `{action}-{target}` pattern

## Email Scanner

The scanner lives in two places:

- **`server/emailExtractor.ts`** — the LLM extraction logic. Takes raw email fields, calls `POST https://api.perplexity.ai/chat/completions` with the `sonar` model, parses the JSON response into `ExtractedItem[]`. If the API key is missing or the call fails, `fallbackExtract()` runs a regex pass instead.
- **`scripts/gmail_scan.py`** — the standalone Python script that talks to Gmail via the `external-tool` CLI and POSTs each email to `/api/inbox/scan`. This is what the daily cron runs.

### Adding or changing subject-line tags

Tags are parsed in `server/emailExtractor.ts` in the `parseTagFromSubject()` function (to be added — currently the tag logic lives in the scan script). To add a new tag:

1. Add it to the `TAG_MAP` in `emailExtractor.ts`
2. Add it to the `TAG_MAP` in `scripts/gmail_scan.py`
3. Document it in `docs/EMAIL_SCANNER.md`

### Updating the Gmail search queries

The queries are in `scripts/gmail_scan.py` under `SEARCH_QUERIES`. Keep them broad — false positives are fine (the LLM will return an empty array for irrelevant emails). False negatives (missed emails) are the real cost.

### Platform migration for Gmail

See `docs/EMAIL_SCANNER.md` — Platform Migration section for Gmail API OAuth2, Postmark webhook, and IMAP alternatives that don't depend on the Perplexity `external-tool` CLI.

---

## Dependency Notes

- `nanoid` is pinned to v3 (`nanoid@3`) — v4+ uses ESM-only exports incompatible with the CJS server bundle
- `ws` is explicitly imported and passed to the Supabase client constructor to fix a Node.js 20 WebSocket issue
- Tailwind is v3 — do **not** upgrade to v4 without updating all `@tailwind` directives (v4 uses `@import "tailwindcss"`)
