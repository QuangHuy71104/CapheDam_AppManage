-- Harden operational writes and make payroll synchronization compare-and-swap.
-- Apply after 202608082306_phase3_version_audit.sql.

begin;

-- This is an internal workforce app. Authentication users must be provisioned by
-- a trusted administrator; a newly authenticated user cannot choose a branch and
-- create their own employee profile.
drop policy if exists "profiles_insert_own_employee" on public.profiles;

alter table public.ingredient_reports
  add column if not exists created_by uuid references auth.users(id) on delete set null
  default auth.uid();

alter table public.shift_close_reports
  add column if not exists created_by uuid references auth.users(id) on delete set null
  default auth.uid();

alter table public.attendance_sheets
  add column if not exists hourly_rate_snapshot integer not null default 24000,
  add column if not exists allowance_snapshot integer not null default 200000,
  add column if not exists breakfast_allowance_snapshot integer not null default 27000;

update public.attendance_sheets as sheets
set
  hourly_rate_snapshot = profiles.hourly_rate,
  allowance_snapshot = profiles.allowance,
  breakfast_allowance_snapshot = profiles.breakfast_allowance
from public.profiles as profiles
where sheets.user_id = profiles.id;

create or replace function public.snapshot_attendance_pay_policy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  if new.user_id is null then
    return new;
  end if;

  if tg_op = 'INSERT'
     or (new.employee_confirmed_at is not null and old.employee_confirmed_at is null) then
    select * into v_profile from public.profiles where id = new.user_id;
    if v_profile.id is not null then
      new.hourly_rate_snapshot := v_profile.hourly_rate;
      new.allowance_snapshot := v_profile.allowance;
      new.breakfast_allowance_snapshot := v_profile.breakfast_allowance;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists attendance_sheets_snapshot_pay_policy on public.attendance_sheets;
create trigger attendance_sheets_snapshot_pay_policy
before insert or update on public.attendance_sheets
for each row execute function public.snapshot_attendance_pay_policy();

create index if not exists ingredient_reports_created_by_idx
  on public.ingredient_reports (created_by, reported_at desc);

create index if not exists shift_close_reports_created_by_idx
  on public.shift_close_reports (created_by, reported_at desc);

create or replace function public.guard_attendance_sheet_write()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- Service-role maintenance has no end-user auth context and remains trusted.
  if auth.uid() is null then
    return new;
  end if;

  if public.current_role() = 'employee' then
    if new.user_id is distinct from auth.uid()
       or new.branch_id is distinct from public.current_branch_id() then
      raise exception 'Employees may only write their own attendance sheet';
    end if;

    if tg_op = 'INSERT' then
      if new.manager_approved_at is not null or new.manager_approved_by is not null then
        raise exception 'Employees cannot approve payroll';
      end if;
    else
      if new.id is distinct from old.id
         or new.user_id is distinct from old.user_id
         or new.branch_id is distinct from old.branch_id
         or new.month_key is distinct from old.month_key then
        raise exception 'Attendance sheet identity is immutable';
      end if;

      if new.manager_approved_at is distinct from old.manager_approved_at
         or new.manager_approved_by is distinct from old.manager_approved_by then
        raise exception 'Employees cannot change manager approval';
      end if;

      if old.manager_approved_at is not null and new.days is distinct from old.days then
        raise exception 'Approved attendance cannot be changed by an employee';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists attendance_sheets_guard_write on public.attendance_sheets;
create trigger attendance_sheets_guard_write
before insert or update on public.attendance_sheets
for each row execute function public.guard_attendance_sheet_write();

create or replace function public.guard_branch_payroll_write()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_last_day date;
begin
  if auth.uid() is null or public.is_owner() then
    return new;
  end if;

  if not public.is_manager_for(new.branch_id) then
    raise exception 'Managers may only write payroll for their branch';
  end if;

  if tg_op = 'UPDATE'
     and old.manager_confirmed_at is not null
     and new.manager_confirmed_at is null then
    v_last_day := (to_date(old.month_key || '-01', 'YYYY-MM-DD') + interval '1 month - 1 day')::date;
    if current_date >= v_last_day then
      raise exception 'The payroll cancellation deadline has passed';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists branch_payroll_confirmations_guard_write on public.branch_payroll_confirmations;
create trigger branch_payroll_confirmations_guard_write
before insert or update on public.branch_payroll_confirmations
for each row execute function public.guard_branch_payroll_write();

drop policy if exists "attendance_insert" on public.attendance_sheets;
create policy "attendance_insert"
on public.attendance_sheets
for insert
to authenticated
with check (
  public.is_owner()
  or public.is_manager_for(branch_id)
  or (
    public.current_role() = 'employee'
    and user_id = auth.uid()
    and branch_id = public.current_branch_id()
    and manager_approved_at is null
    and manager_approved_by is null
  )
);

create or replace function public.keep_report_creator_immutable()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'Report creator is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists ingredient_reports_keep_creator on public.ingredient_reports;
create trigger ingredient_reports_keep_creator
before update on public.ingredient_reports
for each row execute function public.keep_report_creator_immutable();

drop trigger if exists shift_close_reports_keep_creator on public.shift_close_reports;
create trigger shift_close_reports_keep_creator
before update on public.shift_close_reports
for each row execute function public.keep_report_creator_immutable();

drop policy if exists "ingredient_reports_insert" on public.ingredient_reports;
create policy "ingredient_reports_insert"
on public.ingredient_reports
for insert
to authenticated
with check (public.is_staff_for(branch_id) and created_by = auth.uid());

drop policy if exists "ingredient_reports_update" on public.ingredient_reports;
create policy "ingredient_reports_update"
on public.ingredient_reports
for update
to authenticated
using (
  public.is_owner()
  or public.is_manager_for(branch_id)
  or created_by = auth.uid()
)
with check (
  public.is_owner()
  or public.is_manager_for(branch_id)
  or (created_by = auth.uid() and branch_id = public.current_branch_id())
);

drop policy if exists "shift_close_reports_insert" on public.shift_close_reports;
create policy "shift_close_reports_insert"
on public.shift_close_reports
for insert
to authenticated
with check (public.is_staff_for(branch_id) and created_by = auth.uid());

drop policy if exists "shift_close_reports_update" on public.shift_close_reports;
create policy "shift_close_reports_update"
on public.shift_close_reports
for update
to authenticated
using (
  public.is_owner()
  or public.is_manager_for(branch_id)
  or created_by = auth.uid()
)
with check (
  public.is_owner()
  or public.is_manager_for(branch_id)
  or (created_by = auth.uid() and branch_id = public.current_branch_id())
);

create or replace function public.audit_operational_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_after jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  v_row jsonb := coalesce(v_after, v_before);
begin
  insert into public.audit_logs (
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    branch_id,
    before_data,
    after_data
  ) values (
    auth.uid(),
    case when auth.uid() is null then 'service_role' else public.current_role() end,
    lower(tg_op),
    tg_table_name,
    coalesce(v_row ->> 'id', ''),
    v_row ->> 'branch_id',
    v_before,
    v_after
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists attendance_sheets_audit_change on public.attendance_sheets;
create trigger attendance_sheets_audit_change
after insert or update or delete on public.attendance_sheets
for each row execute function public.audit_operational_change();

drop trigger if exists branch_payroll_confirmations_audit_change on public.branch_payroll_confirmations;
create trigger branch_payroll_confirmations_audit_change
after insert or update or delete on public.branch_payroll_confirmations
for each row execute function public.audit_operational_change();

drop trigger if exists ingredient_reports_audit_change on public.ingredient_reports;
create trigger ingredient_reports_audit_change
after insert or update or delete on public.ingredient_reports
for each row execute function public.audit_operational_change();

drop trigger if exists shift_close_reports_audit_change on public.shift_close_reports;
create trigger shift_close_reports_audit_change
after insert or update or delete on public.shift_close_reports
for each row execute function public.audit_operational_change();

-- Audit entries must describe an actual database mutation, not client claims.
revoke execute on function public.append_audit_log(text, text, text, text, jsonb, jsonb) from authenticated;

create or replace function public.save_attendance_sheet_cas(
  p_id text,
  p_user_id uuid,
  p_branch_id text,
  p_employee_name text,
  p_month_key text,
  p_days jsonb,
  p_employee_confirmed_at timestamptz,
  p_manager_approved_at timestamptz,
  p_manager_approved_by text,
  p_expected_version bigint
)
returns public.attendance_sheets
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_saved public.attendance_sheets;
begin
  if p_expected_version is null then
    insert into public.attendance_sheets (
      id, user_id, branch_id, employee_name, month_key, days,
      employee_confirmed_at, manager_approved_at, manager_approved_by
    ) values (
      p_id, p_user_id, p_branch_id, trim(p_employee_name), p_month_key, coalesce(p_days, '{}'::jsonb),
      p_employee_confirmed_at, p_manager_approved_at, p_manager_approved_by
    )
    returning * into v_saved;
  else
    update public.attendance_sheets
    set
      employee_name = trim(p_employee_name),
      days = coalesce(p_days, '{}'::jsonb),
      employee_confirmed_at = p_employee_confirmed_at,
      manager_approved_at = p_manager_approved_at,
      manager_approved_by = p_manager_approved_by
    where id = p_id and version = p_expected_version
    returning * into v_saved;

    if v_saved.id is null then
      raise exception using errcode = '40001', message = 'VERSION_CONFLICT';
    end if;
  end if;

  return v_saved;
exception
  when unique_violation then
    raise exception using errcode = '40001', message = 'VERSION_CONFLICT';
end;
$$;

revoke all on function public.save_attendance_sheet_cas(text, uuid, text, text, text, jsonb, timestamptz, timestamptz, text, bigint) from public;
grant execute on function public.save_attendance_sheet_cas(text, uuid, text, text, text, jsonb, timestamptz, timestamptz, text, bigint) to authenticated;

create or replace function public.save_branch_payroll_cas(
  p_id text,
  p_branch_id text,
  p_month_key text,
  p_manager_confirmed_at timestamptz,
  p_manager_cancelled_at timestamptz,
  p_manager_name text,
  p_auto_confirmed boolean,
  p_expected_version bigint
)
returns public.branch_payroll_confirmations
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_saved public.branch_payroll_confirmations;
begin
  if p_expected_version is null then
    insert into public.branch_payroll_confirmations (
      id, branch_id, month_key, manager_confirmed_at,
      manager_cancelled_at, manager_name, auto_confirmed
    ) values (
      p_id, p_branch_id, p_month_key, p_manager_confirmed_at,
      p_manager_cancelled_at, p_manager_name, coalesce(p_auto_confirmed, false)
    )
    returning * into v_saved;
  else
    update public.branch_payroll_confirmations
    set
      manager_confirmed_at = p_manager_confirmed_at,
      manager_cancelled_at = p_manager_cancelled_at,
      manager_name = p_manager_name,
      auto_confirmed = coalesce(p_auto_confirmed, false)
    where id = p_id and version = p_expected_version
    returning * into v_saved;

    if v_saved.id is null then
      raise exception using errcode = '40001', message = 'VERSION_CONFLICT';
    end if;
  end if;

  return v_saved;
exception
  when unique_violation then
    raise exception using errcode = '40001', message = 'VERSION_CONFLICT';
end;
$$;

revoke all on function public.save_branch_payroll_cas(text, text, text, timestamptz, timestamptz, text, boolean, bigint) from public;
grant execute on function public.save_branch_payroll_cas(text, text, text, timestamptz, timestamptz, text, boolean, bigint) to authenticated;

create or replace function public.auto_confirm_due_payrolls()
returns setof public.branch_payroll_confirmations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.current_role();
  v_branch_id text := public.current_branch_id();
begin
  if auth.uid() is null or v_role not in ('owner', 'manager') then
    raise exception 'Only owners and managers can run payroll auto-confirmation';
  end if;

  return query
  insert into public.branch_payroll_confirmations as confirmations (
    id,
    branch_id,
    month_key,
    manager_confirmed_at,
    manager_name,
    auto_confirmed
  )
  select
    'auto-' || sheets.branch_id || '-' || sheets.month_key,
    sheets.branch_id,
    sheets.month_key,
    now(),
    'Hệ thống',
    true
  from public.attendance_sheets as sheets
  where sheets.manager_approved_at is not null
    and current_date >= (
      (to_date(sheets.month_key || '-01', 'YYYY-MM-DD') + interval '1 month - 1 day')::date - 1
    )
    and (v_role = 'owner' or sheets.branch_id = v_branch_id)
  group by sheets.branch_id, sheets.month_key
  on conflict (branch_id, month_key) do update
  set
    manager_confirmed_at = excluded.manager_confirmed_at,
    manager_name = excluded.manager_name,
    auto_confirmed = true,
    manager_cancelled_at = null
  where confirmations.manager_confirmed_at is null
    and confirmations.manager_cancelled_at is null
  returning confirmations.*;
end;
$$;

revoke all on function public.auto_confirm_due_payrolls() from public;
grant execute on function public.auto_confirm_due_payrolls() to authenticated;

commit;
