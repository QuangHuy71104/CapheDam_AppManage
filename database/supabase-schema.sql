-- Cafe Dam operational database schema.
-- Run this entire file once in Supabase Dashboard > SQL Editor.

begin;

create table if not exists public.branches (
  id text primary key,
  name text not null,
  area text not null,
  address text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.branches (id, name, area, address)
values
  ('minh-khai-1', 'Chi nhánh Minh Khai 1', 'Nguyễn Thị Minh Khai', '147A Nguyễn Thị Minh Khai, Phường Phạm Ngũ Lão, Bến Thành, Hồ Chí Minh'),
  ('minh-khai-2', 'Chi nhánh Minh Khai 2', 'Nguyễn Thị Minh Khai', '123 Nguyễn Thị Minh Khai, Phường Phạm Ngũ Lão, Bến Thành, Hồ Chí Minh'),
  ('nam-ky-khoi-nghia', 'Chi nhánh Nam Kỳ Khởi Nghĩa', 'Nam Kỳ Khởi Nghĩa', '151C Nam Kỳ Khởi Nghĩa, Phường 6, Xuân Hòa, Hồ Chí Minh'),
  ('dien-bien-phu', 'Chi nhánh Điện Biên Phủ', 'Điện Biên Phủ', '435 Điện Biên Phủ, Phường 3, Bàn Cờ, Hồ Chí Minh'),
  ('pham-dinh-ho', 'Chi nhánh Phạm Đình Hổ', 'Phạm Đình Hổ', '49 Phạm Đình Hổ, Phường 2, Bình Tây, Hồ Chí Minh'),
  ('tung-thien-vuong', 'Chi nhánh Tùng Thiện Vương', 'Tùng Thiện Vương', '415 Tùng Thiện Vương, Phường Xóm Củi, Phú Định, Hồ Chí Minh')
on conflict (id) do update
set
  name = excluded.name,
  area = excluded.area,
  address = excluded.address,
  updated_at = now();

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role text not null default 'employee' check (role in ('owner', 'manager', 'employee')),
  branch_id text references public.branches(id) on update cascade on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_role_branch_check check (
    (role = 'owner' and branch_id is null)
    or (role in ('manager', 'employee') and branch_id is not null)
  )
);

-- Migration support for an older development database that used phone instead of email.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'phone'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'email'
  ) then
    alter table public.profiles rename column phone to email;
  end if;
end $$;

create table if not exists public.attendance_sheets (
  id text primary key,
  user_id uuid references auth.users(id) on delete set null,
  branch_id text not null references public.branches(id) on update cascade on delete restrict,
  employee_name text not null,
  month_key text not null check (month_key ~ '^\\d{4}-\\d{2}$'),
  days jsonb not null default '{}'::jsonb check (jsonb_typeof(days) = 'object'),
  employee_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_id, employee_name, month_key)
);

create table if not exists public.branch_payroll_confirmations (
  id text primary key,
  branch_id text not null references public.branches(id) on update cascade on delete restrict,
  month_key text not null check (month_key ~ '^\\d{4}-\\d{2}$'),
  manager_confirmed_at timestamptz,
  manager_cancelled_at timestamptz,
  manager_name text,
  auto_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_id, month_key)
);

create table if not exists public.ingredient_reports (
  id text primary key,
  branch_id text not null references public.branches(id) on update cascade on delete restrict,
  reporter_name text,
  reporter_role text check (reporter_role in ('owner', 'manager', 'employee')),
  note text not null default '',
  reported_at timestamptz not null,
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shift_close_reports (
  id text primary key,
  branch_id text not null references public.branches(id) on update cascade on delete restrict,
  reported_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists attendance_sheets_branch_month_idx
  on public.attendance_sheets (branch_id, month_key);
create index if not exists attendance_sheets_user_idx
  on public.attendance_sheets (user_id);
create index if not exists branch_payroll_branch_month_idx
  on public.branch_payroll_confirmations (branch_id, month_key);
create index if not exists ingredient_reports_branch_reported_idx
  on public.ingredient_reports (branch_id, reported_at desc);
create index if not exists shift_close_reports_branch_reported_idx
  on public.shift_close_reports (branch_id, reported_at desc);
create index if not exists profiles_branch_idx
  on public.profiles (branch_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists branches_set_updated_at on public.branches;
create trigger branches_set_updated_at
before update on public.branches
for each row execute function public.set_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists attendance_sheets_set_updated_at on public.attendance_sheets;
create trigger attendance_sheets_set_updated_at
before update on public.attendance_sheets
for each row execute function public.set_updated_at();

drop trigger if exists branch_payroll_confirmations_set_updated_at on public.branch_payroll_confirmations;
create trigger branch_payroll_confirmations_set_updated_at
before update on public.branch_payroll_confirmations
for each row execute function public.set_updated_at();

drop trigger if exists ingredient_reports_set_updated_at on public.ingredient_reports;
create trigger ingredient_reports_set_updated_at
before update on public.ingredient_reports
for each row execute function public.set_updated_at();

drop trigger if exists shift_close_reports_set_updated_at on public.shift_close_reports;
create trigger shift_close_reports_set_updated_at
before update on public.shift_close_reports
for each row execute function public.set_updated_at();

alter table public.branches enable row level security;
alter table public.profiles enable row level security;
alter table public.attendance_sheets enable row level security;
alter table public.branch_payroll_confirmations enable row level security;
alter table public.ingredient_reports enable row level security;
alter table public.shift_close_reports enable row level security;

create or replace function public.current_profile()
returns public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.profiles
  where id = auth.uid()
  limit 1
$$;

create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((public.current_profile()).role, 'employee')
$$;

create or replace function public.current_branch_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select (public.current_profile()).branch_id
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role() = 'owner'
$$;

create or replace function public.is_manager_for(target_branch_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role() = 'manager'
    and public.current_branch_id() = target_branch_id
$$;

create or replace function public.is_staff_for(target_branch_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_owner()
    or public.is_manager_for(target_branch_id)
    or public.current_branch_id() = target_branch_id
$$;

drop policy if exists "branches_select" on public.branches;
create policy "branches_select"
on public.branches
for select
to authenticated
using (true);

drop policy if exists "branches_update_owner" on public.branches;
create policy "branches_update_owner"
on public.branches
for update
to authenticated
using (public.is_owner())
with check (public.is_owner());

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.is_owner()
  or (public.current_role() = 'manager' and branch_id = public.current_branch_id())
);

drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_insert_own_employee" on public.profiles;
create policy "profiles_insert_own_employee"
on public.profiles
for insert
to authenticated
with check (
  id = auth.uid()
  and role = 'employee'
  and branch_id is not null
  and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_update_owner" on public.profiles;
create policy "profiles_update_owner"
on public.profiles
for update
to authenticated
using (public.is_owner())
with check (public.is_owner());

drop policy if exists "profiles_delete_owner" on public.profiles;
create policy "profiles_delete_owner"
on public.profiles
for delete
to authenticated
using (public.is_owner());

drop policy if exists "attendance_select" on public.attendance_sheets;
create policy "attendance_select"
on public.attendance_sheets
for select
to authenticated
using (public.is_owner() or public.is_manager_for(branch_id) or user_id = auth.uid());

drop policy if exists "attendance_insert" on public.attendance_sheets;
create policy "attendance_insert"
on public.attendance_sheets
for insert
to authenticated
with check (public.is_owner() or public.is_manager_for(branch_id) or user_id = auth.uid());

drop policy if exists "attendance_update" on public.attendance_sheets;
create policy "attendance_update"
on public.attendance_sheets
for update
to authenticated
using (public.is_owner() or public.is_manager_for(branch_id) or user_id = auth.uid())
with check (public.is_owner() or public.is_manager_for(branch_id) or user_id = auth.uid());

drop policy if exists "attendance_delete_owner" on public.attendance_sheets;
create policy "attendance_delete_owner"
on public.attendance_sheets
for delete
to authenticated
using (public.is_owner());

drop policy if exists "branch_payroll_select" on public.branch_payroll_confirmations;
create policy "branch_payroll_select"
on public.branch_payroll_confirmations
for select
to authenticated
using (public.is_owner() or public.is_manager_for(branch_id));

drop policy if exists "branch_payroll_insert" on public.branch_payroll_confirmations;
create policy "branch_payroll_insert"
on public.branch_payroll_confirmations
for insert
to authenticated
with check (public.is_owner() or public.is_manager_for(branch_id));

drop policy if exists "branch_payroll_update" on public.branch_payroll_confirmations;
create policy "branch_payroll_update"
on public.branch_payroll_confirmations
for update
to authenticated
using (public.is_owner() or public.is_manager_for(branch_id))
with check (public.is_owner() or public.is_manager_for(branch_id));

drop policy if exists "branch_payroll_delete_owner" on public.branch_payroll_confirmations;
create policy "branch_payroll_delete_owner"
on public.branch_payroll_confirmations
for delete
to authenticated
using (public.is_owner());

drop policy if exists "ingredient_reports_select" on public.ingredient_reports;
create policy "ingredient_reports_select"
on public.ingredient_reports
for select
to authenticated
using (public.is_staff_for(branch_id));

drop policy if exists "ingredient_reports_insert" on public.ingredient_reports;
create policy "ingredient_reports_insert"
on public.ingredient_reports
for insert
to authenticated
with check (public.is_staff_for(branch_id));

drop policy if exists "ingredient_reports_update" on public.ingredient_reports;
create policy "ingredient_reports_update"
on public.ingredient_reports
for update
to authenticated
using (public.is_staff_for(branch_id))
with check (public.is_staff_for(branch_id));

drop policy if exists "ingredient_reports_delete_owner" on public.ingredient_reports;
create policy "ingredient_reports_delete_owner"
on public.ingredient_reports
for delete
to authenticated
using (public.is_owner());

drop policy if exists "shift_close_reports_select" on public.shift_close_reports;
create policy "shift_close_reports_select"
on public.shift_close_reports
for select
to authenticated
using (public.is_staff_for(branch_id));

drop policy if exists "shift_close_reports_insert" on public.shift_close_reports;
create policy "shift_close_reports_insert"
on public.shift_close_reports
for insert
to authenticated
with check (public.is_staff_for(branch_id));

drop policy if exists "shift_close_reports_update" on public.shift_close_reports;
create policy "shift_close_reports_update"
on public.shift_close_reports
for update
to authenticated
using (public.is_staff_for(branch_id))
with check (public.is_staff_for(branch_id));

drop policy if exists "shift_close_reports_delete_owner" on public.shift_close_reports;
create policy "shift_close_reports_delete_owner"
on public.shift_close_reports
for delete
to authenticated
using (public.is_owner());

commit;

-- Bootstrap after running the script:
-- 1. Register the cafe owner in the web app as an employee.
-- 2. Run this in SQL Editor, replacing the email:
-- update public.profiles set role = 'owner', branch_id = null where email = 'owner@example.com';
-- 3. Register managers as employees, then promote each one with:
-- update public.profiles set role = 'manager', branch_id = 'minh-khai-1' where email = 'manager@example.com';
