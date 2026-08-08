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

Supabase is the long-term source of truth. `src/app/legacy-app-data.ts` retains
the current aggregate snapshot only as a migration boundary. New features must
not add fields to it.

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
