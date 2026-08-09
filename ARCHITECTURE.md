# Cà phê Đạm — target architecture

## Direction

The application is being refactored incrementally; no big-bang rewrite.

- `src/shared/`: generic UI/config/API utilities.
- `src/features/`: feature-owned domain types, pure rules, and screens.
- `src/app/`: application composition and temporary cross-feature boundaries.
- `lib/`: legacy compatibility modules being reduced over time.
- `api/`: server-only Vercel handlers.
- `supabase/migrations/`: ordered database changes.

## Dependency rule

UI -> feature domain/repository -> shared API -> Supabase/API.

Pure domain modules must not import React, browser UI primitives, or Supabase.

## Server state

Supabase is the long-term source of truth. `src/features/payroll/workspace.ts` contains the intentionally narrow offline
attendance/payroll workspace. Report data is loaded directly from Supabase.

The next data-layer phase should migrate, in order:

1. inventory reports;
2. closing reports;
3. staff/schedule;
4. attendance;
5. payroll approval.

Attendance/payroll are last because they contain cross-device approval state and
must be migrated with concurrency tests.

## Safety

A UI action labelled refresh must never delete persisted operational records.
Destructive maintenance tools, if ever required, belong behind explicit admin
flows and server-side authorization.

## Phase 2 migration status

Inventory (`ingredient_reports`) is the first domain removed from aggregate
snapshot persistence. Reads and writes are owned by
`src/features/inventory/repository.ts`. `AppData.ingredients` remains
temporarily as a UI cache; new inventory writes must not be added back to
`syncAppDataToSupabase`.

Closing (`shift_close_reports`) is also removed from aggregate snapshot
persistence. Reads and writes are owned by
`src/features/closing/repository.ts`. `AppData.closings` remains temporarily
as a UI cache and must not be reintroduced into `syncAppDataToSupabase`.

## Phase 2 report cache split

Report UI caches are now independent from the offline payroll workspace.
Inventory and Closing are never serialized inside legacy AppData/localStorage.
Their source of truth is Supabase through their feature repositories.

## Payroll workspace synchronization

Payroll workspace synchronization is feature-owned under
`src/features/payroll/workspace-sync.ts`. App.tsx no longer contains table
upsert/deduplication logic. The remaining snapshot is an offline payroll
workspace only, not a copy of report tables.

## Phase 2 complete

The generic legacy AppData boundary has been retired. Inventory, Closing,
Attendance and Payroll persistence are owned by feature repositories. The only
local snapshot that remains is the attendance/payroll workspace used for
offline edits and retry behavior.

## Phase 3 hardening complete

Optimistic concurrency uses explicit `version` metadata and compare-and-swap RPCs
for attendance/payroll records. Database triggers enforce employee/manager write
boundaries and create audit rows from canonical `OLD`/`NEW` values.

`audit_logs` is written by database triggers; authenticated clients cannot call
the legacy audit append RPC.

## Current module boundary

- App composition and temporary shared UI live in `src/app/`.
- Staff and schedule implementations live in `src/features/staff` and
  `src/features/schedule`; their `lib/` files are compatibility re-exports only.
- Feature repositories own bounded, paginated Supabase reads. Realtime events
  invalidate only the affected data domain.
- `App.tsx` still contains several screen-level compositions; further extraction
  should preserve the characterization tests and move one leaf screen at a time.
