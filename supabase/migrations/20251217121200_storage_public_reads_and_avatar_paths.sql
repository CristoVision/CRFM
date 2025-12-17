-- Storage policy adjustments:
-- - Allow public SELECT on public buckets used by the UI (logo, avatars).
-- - Allow avatar uploads under either:
--   - `${auth.uid()}/...` (current)
--   - `public/${auth.uid()}_...` (legacy build path)

create extension if not exists pgcrypto;

create or replace function public.storage_is_own_or_legacy_avatar_path(p_name text)
returns boolean
language sql
stable
as $$
  select
    (select auth.uid()) is not null
    and (
      p_name like ((select auth.uid())::text || '/%')
      or p_name like ('public/' || (select auth.uid())::text || '_%')
    );
$$;

-- Public read for public buckets (these URLs are public anyway; this unblocks list/select via API).
drop policy if exists logo_select_public on storage.objects;
create policy logo_select_public on storage.objects
  for select
  using (bucket_id = 'logo');

drop policy if exists avatars_select_public on storage.objects;
create policy avatars_select_public on storage.objects
  for select
  using (bucket_id = 'avatars');

-- Keep curated writes for logo, but do not block reads.
drop policy if exists logo_admin_all on storage.objects;

drop policy if exists logo_admin_insert on storage.objects;
create policy logo_admin_insert on storage.objects
  for insert
  with check (bucket_id = 'logo' and public.is_admin_uid(auth.uid()));

drop policy if exists logo_admin_update on storage.objects;
create policy logo_admin_update on storage.objects
  for update
  using (bucket_id = 'logo' and public.is_admin_uid(auth.uid()))
  with check (bucket_id = 'logo' and public.is_admin_uid(auth.uid()));

drop policy if exists logo_admin_delete on storage.objects;
create policy logo_admin_delete on storage.objects
  for delete
  using (bucket_id = 'logo' and public.is_admin_uid(auth.uid()));

-- Avatars: allow insert/update/delete in own folder (or legacy public/ prefix).
drop policy if exists avatars_insert_own on storage.objects;
create policy avatars_insert_own on storage.objects
  for insert
  with check (bucket_id = 'avatars' and public.storage_is_own_or_legacy_avatar_path(name));

drop policy if exists avatars_update_own on storage.objects;
create policy avatars_update_own on storage.objects
  for update
  using (bucket_id = 'avatars' and public.storage_is_own_or_legacy_avatar_path(name))
  with check (bucket_id = 'avatars' and public.storage_is_own_or_legacy_avatar_path(name));

drop policy if exists avatars_delete_own on storage.objects;
create policy avatars_delete_own on storage.objects
  for delete
  using (bucket_id = 'avatars' and public.storage_is_own_or_legacy_avatar_path(name));
