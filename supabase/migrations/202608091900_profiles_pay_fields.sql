-- Repair production projects whose baseline migration was recorded before
-- compensation fields were added to the canonical profiles schema.
--
-- This migration must run before 202608091930_security_cas.sql because that
-- migration snapshots these values into attendance sheets.

begin;

alter table public.profiles
  add column if not exists hourly_rate integer not null default 24000,
  add column if not exists allowance integer not null default 200000,
  add column if not exists breakfast_allowance integer not null default 27000;

commit;
