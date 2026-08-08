# Phase 3 database hardening gate

PR 20 only commits the SQL migration. It does **not** execute SQL against your Supabase project.

Before PR 21:

1. Make a Supabase database backup/snapshot.
2. Apply `supabase/migrations/202608082306_phase3_version_audit.sql` to a non-production project first.
3. Verify:
   - `attendance_sheets.version` exists and defaults to `1`;
   - `branch_payroll_confirmations.version` exists and defaults to `1`;
   - updating either table increments `version`;
   - `audit_logs` exists with RLS enabled;
   - an owner can read audit logs;
   - a manager can read only their branch audit logs.
4. Apply the same migration to production during a controlled deployment window.
5. Only then merge/deploy PRs that use optimistic concurrency.

Rollback note: adding nullable-independent metadata is low-risk, but do not drop version/audit columns as an automatic rollback if production writes have already begun using them.
