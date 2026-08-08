# Supabase migrations

`202608080000_baseline.sql` is a baseline copy of the idempotent schema that
was previously maintained in `database/supabase-schema.sql`.

For an existing production project that already has this schema, do **not**
treat the baseline as a new destructive reset. It records the starting point
for migration history.

For every future database change:

1. create a new timestamped SQL file under `supabase/migrations/`;
2. make the migration forward-only and narrowly scoped;
3. test it against a non-production Supabase project first;
4. review RLS/policies whenever a table or write path changes;
5. never put service-role secrets in frontend/Vite environment variables.
