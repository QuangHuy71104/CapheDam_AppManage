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
  phone text not null default '',
  role text not null default 'employee' check (role in ('owner', 'manager', 'employee')),
  branch_id text references public.branches(id) on update cascade on delete restrict,
  employment_type text not null default 'part_time' check (employment_type in ('full_time', 'part_time')),
  start_date date not null default current_date,
  date_of_birth date,
  hourly_rate integer not null default 24000,
  allowance integer not null default 200000,
  breakfast_allowance integer not null default 27000,
  avatar_url text not null default '',
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

-- Add account-management fields when upgrading an existing database.
alter table public.profiles add column if not exists phone text not null default '';
alter table public.profiles add column if not exists employment_type text not null default 'part_time';
alter table public.profiles add column if not exists start_date date not null default current_date;
alter table public.profiles add column if not exists date_of_birth date;
alter table public.profiles add column if not exists hourly_rate integer not null default 24000;
alter table public.profiles add column if not exists allowance integer not null default 200000;
alter table public.profiles add column if not exists breakfast_allowance integer not null default 27000;
alter table public.profiles add column if not exists avatar_url text not null default '';

update public.profiles
set employment_type = 'part_time'
where employment_type not in ('full_time', 'part_time');

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_employment_type_check'
  ) then
    alter table public.profiles
      add constraint profiles_employment_type_check
      check (employment_type in ('full_time', 'part_time'));
  end if;
end $$;

-- A manager can give each member of their own branch a local display name for
-- scheduling. This intentionally does not change profiles.full_name.
create table if not exists public.staff_branch_aliases (
  manager_id uuid not null references public.profiles(id) on delete cascade,
  employee_id uuid not null references public.profiles(id) on delete cascade,
  branch_id text not null references public.branches(id) on update cascade on delete restrict,
  display_name text not null check (char_length(trim(display_name)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (manager_id, employee_id, branch_id)
);

-- Schedules keep employee IDs (rather than a typed name) so a manager's
-- local display-name change is immediately reflected in every saved week.
create table if not exists public.work_schedules (
  id text primary key,
  manager_id uuid not null references public.profiles(id) on delete cascade,
  branch_id text not null references public.branches(id) on update cascade on delete restrict,
  week_start date not null,
  slots jsonb not null default '{}'::jsonb check (jsonb_typeof(slots) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (manager_id, branch_id, week_start)
);

create table if not exists public.attendance_sheets (
  id text primary key,
  user_id uuid references auth.users(id) on delete set null,
  branch_id text not null references public.branches(id) on update cascade on delete restrict,
  employee_name text not null,
  month_key text not null check (month_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  days jsonb not null default '{}'::jsonb check (jsonb_typeof(days) = 'object'),
  employee_confirmed_at timestamptz,
  manager_approved_at timestamptz,
  manager_approved_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_id, user_id, month_key)
);

create table if not exists public.branch_payroll_confirmations (
  id text primary key,
  branch_id text not null references public.branches(id) on update cascade on delete restrict,
  month_key text not null check (month_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
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

-- Repair the month checks created by early versions of this script. The old
-- expression rejected valid values such as 2026-08 on existing projects.
alter table public.attendance_sheets
  drop constraint if exists attendance_sheets_month_key_check;
alter table public.attendance_sheets
  add constraint attendance_sheets_month_key_check
  check (month_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

-- Per-employee approval lets a manager review, correct and approve payroll
-- one person at a time before sending the branch total to the owner.
alter table public.attendance_sheets
  add column if not exists manager_approved_at timestamptz;
alter table public.attendance_sheets
  add column if not exists manager_approved_by text;

-- Payroll sheets belong to an account, not a display name. This allows two
-- employees with the same name and preserves a sheet when a name is edited.
do $$
begin
  if exists (
    select 1
    from public.attendance_sheets
    where user_id is not null
    group by branch_id, user_id, month_key
    having count(*) > 1
  ) then
    raise notice 'Giữ nguyên khóa bảng công cũ vì còn dữ liệu trùng user_id. Hãy gộp các bảng công trùng trước khi chạy lại migration.';
  else
    if not exists (
      select 1
      from pg_constraint
      where conname = 'attendance_sheets_branch_id_user_id_month_key'
    ) then
      alter table public.attendance_sheets
        add constraint attendance_sheets_branch_id_user_id_month_key
        unique (branch_id, user_id, month_key);
    end if;

    alter table public.attendance_sheets
      drop constraint if exists attendance_sheets_branch_id_employee_name_month_key;
  end if;
end $$;
create unique index if not exists attendance_sheets_legacy_name_month_unique
  on public.attendance_sheets (branch_id, employee_name, month_key)
  where user_id is null;

alter table public.branch_payroll_confirmations
  drop constraint if exists branch_payroll_confirmations_month_key_check;
alter table public.branch_payroll_confirmations
  add constraint branch_payroll_confirmations_month_key_check
  check (month_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

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
create index if not exists staff_branch_aliases_employee_branch_idx
  on public.staff_branch_aliases (employee_id, branch_id);
create index if not exists work_schedules_branch_week_idx
  on public.work_schedules (branch_id, week_start desc);

-- Let managers receive submitted employee payroll without needing to sign out
-- or reload. The client also has a focus/polling fallback for older projects.
do $$
begin
  alter publication supabase_realtime add table public.attendance_sheets;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.branch_payroll_confirmations;
exception
  when duplicate_object then null;
end $$;

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

-- Guard JSON schedule contents at the database boundary as well as in the
-- UI. A manager can only assign members of the schedule's own branch, and
-- the saved dates must belong to its Monday-to-Sunday week.
create or replace function public.validate_work_schedule_slots()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  day_key text;
  day_slots jsonb;
  assignment jsonb;
  employee_id text;
  employee_ids jsonb;
  morning_end_hour integer;
  scheduled_date date;
  seen_employee_ids text[];
  shift_key text;
begin
  if extract(isodow from new.week_start) <> 1 then
    raise exception 'Tuần xếp lịch phải bắt đầu vào Thứ 2.';
  end if;

  if jsonb_typeof(new.slots) <> 'object' then
    raise exception 'Dữ liệu lịch làm không hợp lệ.';
  end if;

  if not exists (
    select 1
    from public.profiles as manager_profile
    where manager_profile.id = new.manager_id
      and manager_profile.role = 'manager'
      and manager_profile.branch_id = new.branch_id
  ) then
    raise exception 'Quản lí không thuộc chi nhánh của lịch làm.';
  end if;

  for day_key, day_slots in select key, value from jsonb_each(new.slots) loop
    if day_key !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or jsonb_typeof(day_slots) <> 'object' then
      raise exception 'Ngày hoặc ca trong lịch làm không hợp lệ.';
    end if;

    begin
      scheduled_date := day_key::date;
    exception
      when others then
        raise exception 'Ngày hoặc ca trong lịch làm không hợp lệ.';
    end;

    if scheduled_date < new.week_start or scheduled_date > new.week_start + 6 then
      raise exception 'Ngày trong lịch không thuộc tuần đã chọn.';
    end if;

    for shift_key, employee_ids in select key, value from jsonb_each(day_slots) loop
      if shift_key not in ('morning', 'afternoon', 'opening') or jsonb_typeof(employee_ids) <> 'array' then
        raise exception 'Ca làm không hợp lệ.';
      end if;

      if shift_key = 'afternoon' and extract(dow from scheduled_date) = 0 and jsonb_array_length(employee_ids) > 0 then
        raise exception 'Không thể xếp ca chiều vào Chủ Nhật.';
      end if;

      seen_employee_ids := '{}';
      for assignment in select value from jsonb_array_elements(employee_ids) loop
        -- Legacy schedules used a bare UUID string. New schedules persist an
        -- object so a morning assignment can remember its chosen end hour.
        if jsonb_typeof(assignment) = 'string' then
          employee_id := trim(both '"' from assignment::text);
          morning_end_hour := null;
        elsif jsonb_typeof(assignment) = 'object' and jsonb_typeof(assignment->'employeeId') = 'string' then
          employee_id := assignment->>'employeeId';
          morning_end_hour := nullif(assignment->>'morningEndHour', '')::integer;
        else
          raise exception 'Nhân sự trong ca làm không hợp lệ.';
        end if;

        if employee_id is null or btrim(employee_id) = '' then
          raise exception 'Nhân sự trong ca làm không hợp lệ.';
        end if;

        if employee_id = any(seen_employee_ids) then
          raise exception 'Một nhân sự không thể xuất hiện hai lần trong cùng một ca.';
        end if;
        seen_employee_ids := array_append(seen_employee_ids, employee_id);

        if shift_key = 'morning' and morning_end_hour is not null and morning_end_hour not in (9, 10, 11, 12) then
          raise exception 'Giờ về ca sáng phải là 9h, 10h, 11h hoặc 12h.';
        end if;
        if shift_key <> 'morning' and morning_end_hour is not null then
          raise exception 'Chỉ ca sáng mới được đặt giờ về.';
        end if;

        if not exists (
          select 1
          from public.profiles as employee_profile
          where employee_profile.id::text = employee_id
            and employee_profile.branch_id = new.branch_id
            and employee_profile.role in ('manager', 'employee')
        ) then
          raise exception 'Lịch làm chứa nhân sự không thuộc chi nhánh.';
        end if;
      end loop;
    end loop;
  end loop;

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

drop trigger if exists staff_branch_aliases_set_updated_at on public.staff_branch_aliases;
create trigger staff_branch_aliases_set_updated_at
before update on public.staff_branch_aliases
for each row execute function public.set_updated_at();

drop trigger if exists work_schedules_set_updated_at on public.work_schedules;
create trigger work_schedules_set_updated_at
before update on public.work_schedules
for each row execute function public.set_updated_at();

drop trigger if exists work_schedules_validate_slots on public.work_schedules;
create trigger work_schedules_validate_slots
before insert or update on public.work_schedules
for each row execute function public.validate_work_schedule_slots();

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
alter table public.staff_branch_aliases enable row level security;
alter table public.work_schedules enable row level security;
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

-- Employees can only change their own display name, phone number and avatar.
-- Role, branch, employment type and start date remain owner-only fields.
create or replace function public.update_own_profile(
  p_full_name text,
  p_phone text,
  p_avatar_url text
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if nullif(trim(p_full_name), '') is null then
    raise exception 'Full name is required';
  end if;

  update public.profiles
  set
    full_name = trim(p_full_name),
    phone = trim(coalesce(p_phone, '')),
    avatar_url = trim(coalesce(p_avatar_url, ''))
  where id = auth.uid()
  returning * into updated_profile;

  if updated_profile.id is null then
    raise exception 'Profile not found';
  end if;

  return updated_profile;
end;
$$;

revoke all on function public.update_own_profile(text, text, text) from public;
grant execute on function public.update_own_profile(text, text, text) to authenticated;

-- Public avatar bucket. Upload/update/delete policies are restricted to the
-- authenticated user's own UUID folder: avatars/<user-id>/avatar.webp.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatar_images_select_own" on storage.objects;
create policy "avatar_images_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "avatar_images_insert_own" on storage.objects;
create policy "avatar_images_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "avatar_images_update_own" on storage.objects;
create policy "avatar_images_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "avatar_images_delete_own" on storage.objects;
create policy "avatar_images_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

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

drop policy if exists "staff_branch_aliases_select" on public.staff_branch_aliases;
create policy "staff_branch_aliases_select"
on public.staff_branch_aliases
for select
to authenticated
using (
  public.is_owner()
  or (manager_id = auth.uid() and public.is_manager_for(branch_id))
);

drop policy if exists "staff_branch_aliases_insert_manager" on public.staff_branch_aliases;
create policy "staff_branch_aliases_insert_manager"
on public.staff_branch_aliases
for insert
to authenticated
with check (
  manager_id = auth.uid()
  and public.is_manager_for(branch_id)
  and exists (
    select 1
    from public.profiles as employee_profile
    where employee_profile.id = employee_id
      and employee_profile.branch_id = staff_branch_aliases.branch_id
  )
);

drop policy if exists "staff_branch_aliases_update_manager" on public.staff_branch_aliases;
create policy "staff_branch_aliases_update_manager"
on public.staff_branch_aliases
for update
to authenticated
using (manager_id = auth.uid() and public.is_manager_for(branch_id))
with check (
  manager_id = auth.uid()
  and public.is_manager_for(branch_id)
  and exists (
    select 1
    from public.profiles as employee_profile
    where employee_profile.id = employee_id
      and employee_profile.branch_id = staff_branch_aliases.branch_id
  )
);

drop policy if exists "staff_branch_aliases_delete_manager" on public.staff_branch_aliases;
create policy "staff_branch_aliases_delete_manager"
on public.staff_branch_aliases
for delete
to authenticated
using (manager_id = auth.uid() and public.is_manager_for(branch_id));

drop policy if exists "work_schedules_select" on public.work_schedules;
create policy "work_schedules_select"
on public.work_schedules
for select
to authenticated
using (
  public.is_owner()
  or (manager_id = auth.uid() and public.is_manager_for(branch_id))
);

drop policy if exists "work_schedules_insert_manager" on public.work_schedules;
create policy "work_schedules_insert_manager"
on public.work_schedules
for insert
to authenticated
with check (
  public.is_owner()
  or (manager_id = auth.uid() and public.is_manager_for(branch_id))
);

drop policy if exists "work_schedules_update_manager" on public.work_schedules;
create policy "work_schedules_update_manager"
on public.work_schedules
for update
to authenticated
using (
  public.is_owner()
  or (manager_id = auth.uid() and public.is_manager_for(branch_id))
)
with check (
  public.is_owner()
  or (manager_id = auth.uid() and public.is_manager_for(branch_id))
);

drop policy if exists "work_schedules_delete_manager" on public.work_schedules;
create policy "work_schedules_delete_manager"
on public.work_schedules
for delete
to authenticated
using (
  public.is_owner()
  or (manager_id = auth.uid() and public.is_manager_for(branch_id))
);

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
with check (
  public.is_owner()
  or public.is_manager_for(branch_id)
  or (
    public.current_role() = 'employee'
    and user_id = auth.uid()
    and branch_id = public.current_branch_id()
  )
);

drop policy if exists "attendance_update" on public.attendance_sheets;
create policy "attendance_update"
on public.attendance_sheets
for update
to authenticated
using (
  public.is_owner()
  or public.is_manager_for(branch_id)
  or (
    public.current_role() = 'employee'
    and user_id = auth.uid()
    and branch_id = public.current_branch_id()
  )
)
with check (
  public.is_owner()
  or public.is_manager_for(branch_id)
  or (
    public.current_role() = 'employee'
    and user_id = auth.uid()
    and branch_id = public.current_branch_id()
  )
);

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
