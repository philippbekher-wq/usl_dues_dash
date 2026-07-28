# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Next.js (App Router, TypeScript) internal dashboard for USL front-office staff. Staff pick a **team** and a **date range**, and the app computes accumulated union dues owed per player, sourced live from Airtable (no database — Airtable is the system of record, queried server-side on every request).

- **Live**: https://usl-dues-dash-w74ti.ondigitalocean.app (DigitalOcean App Platform, `usl-dues-dash` app, `nyc` region, auto-deploys on push to `main`)
- **Repo**: https://github.com/philippbekher-wq/usl_dues_dash

## Commands

```
npm run dev          # dev server (Turbopack)
npm run build         # production build
npm start             # run the production build
npm test              # vitest run (single pass)
npm run test:watch    # vitest watch mode
npx vitest run lib/dues/calculate.test.ts   # run a single test file
npx tsc --noEmit       # typecheck
npx eslint .           # lint
```

`.env.local` (gitignored) needs `AIRTABLE_PAT`, `AIRTABLE_BASE_ID`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY` — copy `.env.local.example` and fill in real values. Never print these to the terminal or commit them; they're set as encrypted `SECRET` env vars in the DO app spec, not in the repo. **The Supabase `service_role` key is never used anywhere in this app** — only the `anon`/public key, which is safe to expose client-side.

## Architecture

**`lib/dues/`** — pure, Airtable-agnostic domain logic (no `airtable` import anywhere here; all dates are `YYYY-MM-DD` strings). This is where the financial-calculation risk lives and where test coverage is concentrated (82 vitest cases).

- `dateRange.ts` — generic date-range primitives: `rangesOverlap`, `intersectRanges` (n-way inclusive intersection), `inclusiveDayCount`.
- `season.ts` — the dues-collection season as a **recurring month-day rule** (`MonthDay { month, day }`), not a fixed year — the same month-day applies every year a query touches. Validated against a non-leap reference year so staff can't pick Feb 29 or day 31 of a 30-day month.
- `payPeriods.ts` — generates the real calendar pay periods for a team's payroll cycle (`Semi-Monthly`, `Bi-Weekly`, `Monthly` — exact, case-sensitive strings from Airtable's `Payroll Cycle` field). Also owns which cycles pay **in advance** vs **in arrears** (see Business rules) and which get a season-opening blackout.
- `calculate.ts` — `buildTeamDuesReport` is the entry point: finds a team's overlapping contracts, groups them by player, and for each contract runs `calculateDuesForContract`, which walks every generated pay period × every `Contract Term` × every `Contract Year Term`, intersects them against the contract's active range / query range / season window, and prorates by day-count. A single pay period can legitimately produce multiple `PeriodContribution` line items if it spans a Contract Year Term boundary or a contract renewal — this is intentional, not a bug.
- `types.ts` — `Contract`/`ContractTerm`/`ContractYearTerm`/`Team`/`Player` domain types, plus `DuesResult`/`PeriodContribution`/`TeamDuesReport`.

**`lib/airtable/`** — impure Airtable I/O, isolated from the calc engine above.

- `schema.ts` — single source of truth for every literal Airtable table/field name. If a field gets renamed in Airtable, this is the one place to edit.
- `contracts.ts` — `fetchContractsWithTermsForTeam`: fetches the full `Contracts` table, filters client-side by linked Team **record ID** (not `filterByFormula`, since a formula on a linked field resolves to display-name text via `ARRAYJOIN`, not the ID), then batch-fetches only the referenced Contract Terms / Contract Year Terms / Players by ID.
- `duesAccounting.ts` — `fetchActualDuesForPlayers`: fetches **real** payroll dues payments from the `Dues Accounting` table (separate from the calculated/owed figures above) for a given player list, team name, and date range. Uses `filterByFormula` on `Payroll Date` (a plain date field, so unlike `Contracts` this is safe to filter server-side — no linked-field ARRAYJOIN issue). Matches each record to a player via its linked `Player` record ID, falling back to an exact `Full Name` text match only for the records that have no linked Player (a real, if uncommon, gap in the source data). Also cross-checks the record's `Team Name` (trimmed/case-insensitive, since it's free text) against the selected team — confirmed necessary via real data: a player can have payroll dues records from a *previous* team within the same query window (e.g. traded mid-season), and matching by player alone would incorrectly attribute those payments to the currently-viewed team.
- `client.ts` — lazy singleton Airtable connection (throws a clear error if env vars are missing, doesn't crash at import time).

**`app/api/{teams,dues}/route.ts`** — thin HTTP layer: zod-validate the request (`lib/validation.ts`), call the Airtable layer, call `buildTeamDuesReport`, merge in `fetchActualDuesForPlayers` results, return JSON (`TeamDuesReportWithActuals`). `app/page.tsx` is `force-dynamic` (never statically prerendered — the team list is live Airtable data, must not get baked into the build).

**`components/`** — `DashboardClient.tsx` owns form state and the fetch lifecycle; `ResultsTable.tsx` renders one row per player (contracts are merged, not shown separately — see Business rules) with an expandable per-period breakdown of **calculated/owed** dues; `ActualPaidTable.tsx` is a separate section below it showing **real** dues payments per player (same expand-for-breakdown pattern, one row per Dues Accounting payment) — the two tables are intentionally not merged into one, so staff can compare owed vs. actually paid side by side without either figure being obscured; `DateField.tsx` is a custom MM/DD/YYYY text input (native `<input type="date">` renders in the browser/OS locale regardless of the page's `lang`, so a custom field was needed for a fixed US date format).

## Authentication

Staff login is gated by **Supabase Auth** (email/password, no self-signup — accounts are created manually in the Supabase dashboard under Authentication → Users, since this is an internal tool with a small, known staff list, not a public product).

- `middleware.ts` — runs on every route except static assets, calls `supabase.auth.getUser()`, and redirects to `/login` if there's no session (and redirects an already-logged-in user away from `/login`). This is what actually enforces the gate — it also covers `/api/*` routes, not just pages.
- `lib/supabase/client.ts` / `server.ts` — browser and server Supabase client factories (`@supabase/ssr`), following the standard Next.js App Router session-refresh pattern.
- `app/login/page.tsx` — client component, calls `supabase.auth.signInWithPassword` directly (no custom API route), then redirects to the `?next=` path or `/`. Has a "Forgot password?" toggle — this is **not** Supabase's built-in email-reset flow; it just redirects to an external Fillout form (`RESET_PASSWORD_FORM_URL`) with the entered email pre-filled as a query param, for the team to handle password resets manually rather than via an in-app flow.
- `components/LogoutButton.tsx` — calls `supabase.auth.signOut()`, rendered in the dashboard header.
- Only the Supabase **anon/public key** is used anywhere in this app (safe to expose client-side) — the `service_role` key is never needed and must never be added to this codebase.

## Airtable schema

`Teams` → `Name`, `Pay Periods per Year`, `Payroll Cycle`
`Players` → `Name`
`Contracts` → `Effective Date`, `Contract End Date`, `Termination Date`, `Contract Terms` (link), `Dues Authorization`, `Dues` (native Percent field — API returns a decimal fraction already), `Team` (link), `Player` (link)
`Contract Terms` → `Start Date`, `End Date`, `Contract Year Terms` (link)
`Contract Year Terms` → `Start Date`, `End Date`, `Base Compensation` (this is a **monthly** figure, not annual — `Annual Compensation = Base Compensation × 12`)
`Dues Accounting` → `Payroll Date`, `Player` (link — not every record has this populated), `Full Name` (text fallback match target when `Player` is empty), `Dues Paid`. Real payroll-remittance records, unrelated to the `Contracts`-derived calculation — this is "what was actually paid," not "what should be owed."

## Business rules (confirmed with the client — non-obvious, get these wrong and dues are wrong)

- **Compensation Per Paycheck** = `Base Compensation × 12 / Pay Periods per Year`. `Dues %` comes from the Contract, applied once (not compounded).
- **Proration**: for a natural pay period, `dues = CompensationPerPaycheck × Dues% × (coveredDays / periodTotalDays)`, where `coveredDays` is the intersection of the period with the contract's active range, the season window, and the query's date range.
- **Pay date ≠ always the period's end.** Semi-Monthly and Monthly pay **in arrears** (pay date = period end, the 15th / last day of month). Bi-Weekly pays **in advance** (pay date = period *start* — the season start itself is a pay date, then every 14 days). This matters for two things: (1) a period only shows up at all once its pay date has occurred on/before the query's end date — a not-yet-paid period must not appear even partially; (2) once an advance-pay period has been "paid," the query's end date must not clip its coverage back down — only the query's *start* date should.
- **Season-opening blackout**: the very first pay period of the season owes **$0 by policy**, for Semi-Monthly only (not Bi-Weekly, not Monthly) — confirmed after two rounds of correction. The blackout only applies when the season start falls **strictly inside** a period (an awkward partial-day sliver); if the season start lands exactly on a period's own natural start date, that period is charged normally (nothing to forgive).
- **Termination Date** is exclusive — the termination date itself is not a paid day; the last accruing day is the day *before* it. An open-ended contract (no `Contract End Date`) with a `Termination Date` set is a real case, not an edge case — don't let an empty-string comparison silently discard it.
- **Multiple contracts per player** (e.g. released and re-signed mid-season) are merged into **one row**, not shown as separate rows — summed dues, combined chronological period breakdown. A pay period can legitimately split across two different contracts (or two Contract Year Terms) if the transition falls mid-period; both contributions are shown as adjacent "(split)" line items, never silently collapsed into one.
- Full containment of the query range is *not* required for a contract to appear — any date overlap is enough, and coverage is prorated accordingly. Excluding partially-overlapping contracts entirely was the original bug report that started this rewrite.
- **Actual dues paid** (`Dues Accounting` table) is shown *alongside*, not merged into, the calculated/owed figures — the two numbers can legitimately diverge (e.g. a player owes dues by contract but `Dues Authorization` was never checked, so the calculated total is $0 while real payroll records show money was actually paid) and collapsing them into one number would hide that mismatch, which is the entire point of surfacing both.

## Testing

Vitest coverage is concentrated in `lib/dues/*.test.ts` (82 cases) — golden-number cases with hand-computed expected values, boundary/leap-year regressions, and integration-level tests reproducing the client's actual bug reports by name (season-opening blackout, advance-pay proration, termination date exclusivity, multi-contract merging). When touching `lib/dues/calculate.ts` or `payPeriods.ts`, add a case here before trusting a fix — this module has already had several rounds of "looked right, wasn't" corrections.

No e2e suite. Manual verification against the real Airtable base (via Playwright screenshots or `curl` against the app's own `/api/dues`, never raw Airtable calls from the shell — see below) is the standard acceptance step for calculation changes.

## Working with this codebase

- **Never dump environment variables or `.env.local` contents into shell commands whose output you'll see** (e.g. `source <(...)`, `cat .env.local`, `env`) — a credential leak happened this way earlier in development. To use the real Airtable credentials in a script (e.g. building a deploy spec), read them programmatically and write directly to a file/API call without ever echoing the value to stdout.
- The DO app spec's `SECRET` env vars need `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` added alongside `AIRTABLE_PAT`/`AIRTABLE_BASE_ID` before Supabase Auth will work in production.
- The Airtable base is a real production dataset with real player/contract data — a full `Contracts` table scan is not fast (production `/api/dues` calls can take 15–30s). Don't assume a quick response when testing live.
