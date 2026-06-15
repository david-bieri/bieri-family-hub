# Integration Guide — Merging Homeschool Module into Main Hub

This document outlines the step-by-step process for integrating the homeschool module into the main `bieri-family-hub` repository once development and testing are complete.

## Prerequisites

Before merging, ensure:
1. The Supabase project has been upgraded to support Supabase Auth (email/password)
2. At least one admin user and one co-parent user have been created in Supabase Auth
3. The main hub's shared-password auth has been replaced or augmented with JWT-based auth

## Step 1: Database Migration

Run the full migration in the Supabase SQL Editor:

```sql
-- Copy the entire contents of:
-- supabase/migrations/001_homeschool_module.sql
```

After running, verify:
- All 9 new tables exist
- RLS is enabled on academic tables
- Helper functions (`get_user_role`, `get_user_child_scope`, `can_access_child`) are created
- Policies are attached to each table

### Update Existing Tables

Add the `academics` category to the existing categories table:

```sql
INSERT INTO categories (id, name, color) VALUES
  ('academics', 'Academics', '#7c3aed')
ON CONFLICT (id) DO NOTHING;
```

## Step 2: Auth Upgrade

The current main hub uses a single shared password. The homeschool module requires per-user authentication. Two approaches:

### Option A: Full Supabase Auth Migration (Recommended)

1. Enable Email/Password auth in Supabase Dashboard → Authentication → Providers
2. Create user accounts for David, Nancy, and the co-parent
3. Replace `client/src/lib/auth.tsx` with a Supabase Auth context:

```tsx
import { createClient } from '@supabase/supabase-js';
import { useEffect, useState, createContext, useContext } from 'react';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ... standard Supabase Auth context pattern
```

4. Update `server/routes.ts` to validate JWT tokens instead of the base64 password check
5. Pass the user's JWT in all API requests via `Authorization: Bearer <token>`

### Option B: Dual Auth (Transitional)

Keep the shared password for the main family hub pages, but add a separate login flow for the co-parent portal:

1. Add a `/coparent-login` route that authenticates against Supabase Auth
2. The co-parent portal pages check for a valid Supabase session
3. Main hub pages continue using the shared password
4. Eventually migrate everything to Option A

## Step 3: Backend Integration

### Register Academic Routes

In `server/index.ts`, add:

```typescript
import { registerAcademicRoutes } from "./routes/academic";

// Inside the server setup, after other route registrations:
registerAcademicRoutes(app);
```

### Merge Email Extractor

In `server/emailExtractor.ts`, add the academic extraction as a pre-check:

```typescript
import { extractAcademicItems, parseAcademicSMS } from "./emailExtractorAcademic";

// Inside the main extractFromEmail function, before the LLM call:
const academicItems = extractAcademicItems(subject, body, fromAddress, childHints, date);
if (academicItems && academicItems.length > 0) {
  // Convert to the standard ExtractedItem format and return
  return academicItems.map(item => ({
    id: item.id,
    type: "event" as const,
    title: item.title,
    date: item.date,
    child_ids: [item.child_id],
    category: "academics",
    notes: item.notes,
    confidence: item.confidence,
    source_hint: item.source_ref,
  }));
}
```

### Add Handoff Scheduler

In `server/notificationScheduler.ts`, add:

```typescript
import { checkAndSendHandoffDigest } from "./handoffScheduler";

// Inside the existing scheduler interval (or add a new one):
// Check every hour; the function self-gates to only run on Sunday at 6 PM
setInterval(() => {
  checkAndSendHandoffDigest().catch(err => {
    console.error("[scheduler] Handoff digest check failed:", err);
  });
}, 60 * 60 * 1000); // hourly
```

## Step 4: Frontend Integration

### Add Routes

In `client/src/App.tsx`:

```tsx
import Academics from "./pages/Academics";
import CoParentPortal from "./pages/CoParentPortal";

// Inside the Switch block:
<Route path="/academics" component={Academics} />
<Route path="/coparent-portal" component={CoParentPortal} />
```

### Add Navigation

In `client/src/components/Layout.tsx`, add to the `NAV` array:

```typescript
{ path: "/academics", label: "Academics", icon: BookOpen },
```

The co-parent portal should NOT appear in the main nav. Instead, co-parent users should be automatically redirected to `/coparent-portal` on login.

### Role-Based Route Guard

Add a route guard component:

```tsx
function RoleGuard({ allowedRoles, children }: { allowedRoles: string[]; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/" />;
  }
  return <>{children}</>;
}

// Usage:
<Route path="/academics">
  <RoleGuard allowedRoles={["admin"]}>
    <Academics />
  </RoleGuard>
</Route>

<Route path="/coparent-portal">
  <RoleGuard allowedRoles={["coparent", "admin"]}>
    <CoParentPortal />
  </RoleGuard>
</Route>
```

## Step 5: Shared Schema Update

Merge the types from `shared/schema.ts` in this repo into the main hub's `shared/schema.ts`. The homeschool types are additive and do not conflict with existing types.

## Step 6: Environment Variables

Add the following to the deployment environment (Render, etc.):

```env
SUPABASE_SERVICE_KEY=...     # For scheduled tasks
COPARENT_PHONE=...           # Co-parent's phone for SMS digests
```

The existing `TELEGRAM_BOT_TOKEN`, `TWILIO_*`, and `PERPLEXITY_API_KEY` variables are already configured in the main hub.

## Step 7: Testing Checklist

- [ ] Admin can view all 4 children's academic data
- [ ] Admin can create/edit/delete subjects, progress, plans, and compliance filings
- [ ] Co-parent can ONLY see Cole & Airlie data (verify with browser dev tools)
- [ ] Co-parent can log progress entries
- [ ] Co-parent CANNOT see Greta, Clara, Heidi, or Daisy data
- [ ] Co-parent CANNOT modify curriculum plans
- [ ] Email extraction correctly parses Khan Academy / IXL reports
- [ ] SMS quick-add with `#SCHOOL @Cole` creates a progress entry
- [ ] Handoff digest generates on Sunday evening
- [ ] Handoff digest is delivered via Telegram/SMS
- [ ] Virginia compliance tracker shows correct deadlines
- [ ] Custody calendar correctly alternates weeks

## Rollback Plan

If issues arise after merge:
1. The homeschool tables are independent — dropping them does not affect existing data
2. Remove the route registrations from `server/index.ts`
3. Remove page imports from `App.tsx`
4. The auth upgrade is the only irreversible change — test thoroughly before deploying
