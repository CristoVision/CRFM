-- CRFM Storage Policies: Video Cover Art (apply in Supabase SQL editor)
--
-- Bucket: 'videocoverart'
-- App upload convention: '<auth.uid()>/<timestamp>_<filename>' (see src/components/formUtils.js)
--
-- This enables authenticated users to:
-- - list/select their own uploaded video cover art objects
-- - insert/update/delete only within their own '<uid>/' namespace
do $$
begin
  if to_regclass('storage.objects') is null then
    return;
  end if;

  -- Allow listing/reading object rows for the user's own namespace (needed for Storage.list)
  if not exists (select 1 from pg_policies where polname = 'videocoverart_select_own') then
    create policy videocoverart_select_own on storage.objects
      for select
      using (
        bucket_id = 'videocoverart'
        and auth.uid() is not null
        and storage.objects.name like (auth.uid()::text || '/%')
      );
  end if;

  -- Allow INSERT into the user's own namespace
  if not exists (select 1 from pg_policies where polname = 'videocoverart_insert_own') then
    create policy videocoverart_insert_own on storage.objects
      for insert
      with check (
        bucket_id = 'videocoverart'
        and auth.uid() is not null
        and storage.objects.name like (auth.uid()::text || '/%')
      );
  end if;

  -- Allow UPDATE/DELETE only in the user's own namespace (optional safety)
  if not exists (select 1 from pg_policies where polname = 'videocoverart_update_own') then
    create policy videocoverart_update_own on storage.objects
      for update
      using (
        bucket_id = 'videocoverart'
        and auth.uid() is not null
        and storage.objects.name like (auth.uid()::text || '/%')
      );
  end if;

  if not exists (select 1 from pg_policies where polname = 'videocoverart_delete_own') then
    create policy videocoverart_delete_own on storage.objects
      for delete
      using (
        bucket_id = 'videocoverart'
        and auth.uid() is not null
        and storage.objects.name like (auth.uid()::text || '/%')
      );
  end if;
end $$;

