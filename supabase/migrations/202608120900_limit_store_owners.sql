-- Only the two named store owners receive owner-level RLS permissions.
-- Existing profile rows are preserved so account cleanup can remain explicit.
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'owner'
      and lower(trim(regexp_replace(profiles.full_name, '\s+', ' ', 'g'))) in (
        lower('Nguyễn Thanh Đạm'),
        lower('Trương Thanh Thảo')
      )
  )
$$;
