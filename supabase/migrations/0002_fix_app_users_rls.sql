-- ============================================================================
-- Fix: app_users self-read policy caused a login drop-out.
--
-- The original app_users_self_read policy used `id = auth.uid() OR is_admin()`.
-- Combined with how the profile is read immediately after sign-in, a logged-in
-- user could fail to read their OWN row, so the app bounced them back to login.
--
-- This migration splits it into a pure, non-recursive self-read
-- (`id = auth.uid()`) plus a separate admin-read-all policy, and restates the
-- helper functions cleanly. Applied live on 2026-07-04; recorded here for
-- version control.
-- ============================================================================

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_users where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_users where id = auth.uid());
$$;

-- Pure self-read: a logged-in user can always read their own profile row,
-- with no function call (no recursion risk).
drop policy if exists app_users_self_read on public.app_users;
create policy app_users_self_read on public.app_users
  for select using (id = auth.uid());

-- Admins can read every profile.
drop policy if exists app_users_admin_read on public.app_users;
create policy app_users_admin_read on public.app_users
  for select using (public.is_admin());

-- Admins can insert/update/delete profiles.
drop policy if exists app_users_admin_all on public.app_users;
drop policy if exists app_users_admin_write on public.app_users;
create policy app_users_admin_write on public.app_users
  for all using (public.is_admin()) with check (public.is_admin());
