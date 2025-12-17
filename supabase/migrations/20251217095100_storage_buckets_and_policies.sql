-- CRFM storage buckets + basic RLS policies (new Supabase project bootstrap).
-- Run via `supabase db push`.

do $$
begin
  if to_regclass('storage.buckets') is null then
    raise exception 'storage.buckets not found';
  end if;
  if to_regclass('storage.objects') is null then
    raise exception 'storage.objects not found';
  end if;
end $$;

-- Buckets (public)
insert into storage.buckets (id, name, public)
values
  ('logo', 'logo', true),
  ('avatars', 'avatars', true),
  ('track-audio', 'track-audio', true),
  ('track-cover', 'track-cover', true),
  ('album-covers', 'album-covers', true),
  ('playlist-covers', 'playlist-covers', true),
  ('video', 'video', true),
  ('videocoverart', 'videocoverart', true),
  ('ads', 'ads', true),
  ('app-assets', 'app-assets', true)
on conflict (id) do nothing;

-- Buckets (private)
insert into storage.buckets (id, name, public)
values
  ('downloads', 'downloads', false),
  ('lyrics-sync-files', 'lyrics-sync-files', false)
on conflict (id) do nothing;

-- Helper predicate: object belongs to current user namespace.
create or replace function public.storage_is_own_path(p_name text)
returns boolean
language sql
stable
as $$
  select (select auth.uid()) is not null and p_name like ((select auth.uid())::text || '/%');
$$;

-- Authenticated users: manage their own namespace uploads for creator/user content buckets.
do $$
declare
  b text;
begin
  foreach b in array[
    'avatars',
    'track-audio',
    'track-cover',
    'album-covers',
    'playlist-covers',
    'video',
    'videocoverart',
    'downloads',
    'lyrics-sync-files'
  ]
  loop
    execute format($f$
      drop policy if exists %I on storage.objects;
      create policy %I on storage.objects
        for insert
        with check (bucket_id = %L and public.storage_is_own_path(name));
    $f$, b || '_insert_own', b || '_insert_own', b);

    execute format($f$
      drop policy if exists %I on storage.objects;
      create policy %I on storage.objects
        for select
        using (bucket_id = %L and public.storage_is_own_path(name));
    $f$, b || '_select_own', b || '_select_own', b);

    execute format($f$
      drop policy if exists %I on storage.objects;
      create policy %I on storage.objects
        for update
        using (bucket_id = %L and public.storage_is_own_path(name))
        with check (bucket_id = %L and public.storage_is_own_path(name));
    $f$, b || '_update_own', b || '_update_own', b, b);

    execute format($f$
      drop policy if exists %I on storage.objects;
      create policy %I on storage.objects
        for delete
        using (bucket_id = %L and public.storage_is_own_path(name));
    $f$, b || '_delete_own', b || '_delete_own', b);
  end loop;
end $$;

-- Admin-only buckets: logo / ads / app-assets (uploads should be curated).
drop policy if exists logo_admin_all on storage.objects;
create policy logo_admin_all on storage.objects
  for all
  using (bucket_id = 'logo' and public.is_admin_uid(auth.uid()))
  with check (bucket_id = 'logo' and public.is_admin_uid(auth.uid()));

drop policy if exists ads_admin_all on storage.objects;
create policy ads_admin_all on storage.objects
  for all
  using (bucket_id = 'ads' and public.is_admin_uid(auth.uid()))
  with check (bucket_id = 'ads' and public.is_admin_uid(auth.uid()));

drop policy if exists app_assets_admin_all on storage.objects;
create policy app_assets_admin_all on storage.objects
  for all
  using (bucket_id = 'app-assets' and public.is_admin_uid(auth.uid()))
  with check (bucket_id = 'app-assets' and public.is_admin_uid(auth.uid()));

