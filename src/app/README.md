# App data boundary

`legacy-app-data.ts` is deliberately named as a transition boundary.

The existing application synchronizes one aggregate `AppData` snapshot. That
behavior is retained in this refactor because changing payroll/attendance
concurrency and offline semantics in the same change would be high-risk.

Rules for new work:

1. Do not add new domains to `AppData`.
2. Put domain types/calculations under `src/features/<feature>/`.
3. Prefer mutations for a single entity/row instead of writing an aggregate snapshot.
4. Treat Supabase as the source of truth.
5. When offline writes are required, use an explicit mutation queue (IndexedDB),
   not a second copy of the entire database in localStorage.

A later migration can replace the legacy snapshot feature-by-feature without
rewriting the UI again.
