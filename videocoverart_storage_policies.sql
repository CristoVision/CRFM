-- CRFM Storage Policies: Video Cover Art (apply in Supabase SQL editor)
-- Bucket: 'videocoverart'
-- App upload convention: '<auth.uid()>/<timestamp>_<filename>'
do $$
begin
  -- Asegura que la tabla de Storage exista
  if to_regclass('storage.objects') is null then
    raise notice 'storage.objects no existe; abortando creación de políticas.';
    return;
  end if;

  -- SELECT: listar/leer solo dentro del propio namespace '<uid>/...'
  if not exists (
    select 1
    from pg_policies
    where policyname = 'videocoverart_select_own'
      and schemaname = 'storage'
      and tablename = 'objects'
  ) then
    create policy videocoverart_select_own
      on storage.objects
      for select
      using (
        bucket_id = 'videocoverart'
        and (select auth.uid()) is not null
        and name like ((select auth.uid())::text || '/%')
      );
  end if;

  -- INSERT: sólo permitir inserciones en el propio namespace
  if not exists (
    select 1
    from pg_policies
    where policyname = 'videocoverart_insert_own'
      and schemaname = 'storage'
      and tablename = 'objects'
  ) then
    create policy videocoverart_insert_own
      on storage.objects
      for insert
      with check (
        bucket_id = 'videocoverart'
        and (select auth.uid()) is not null
        and name like ((select auth.uid())::text || '/%')
      );
  end if;

  -- UPDATE: sólo permitir cambios en el propio namespace
  if not exists (
    select 1
    from pg_policies
    where policyname = 'videocoverart_update_own'
      and schemaname = 'storage'
      and tablename = 'objects'
  ) then
    create policy videocoverart_update_own
      on storage.objects
      for update
      using (
        bucket_id = 'videocoverart'
        and (select auth.uid()) is not null
        and name like ((select auth.uid())::text || '/%')
      )
      with check (
        bucket_id = 'videocoverart'
        and (select auth.uid()) is not null
        and name like ((select auth.uid())::text || '/%')
      );
  end if;

  -- DELETE: sólo permitir borrados en el propio namespace
  if not exists (
    select 1
    from pg_policies
    where policyname = 'videocoverart_delete_own'
      and schemaname = 'storage'
      and tablename = 'objects'
  ) then
    create policy videocoverart_delete_own
      on storage.objects
      for delete
      using (
        bucket_id = 'videocoverart'
        and (select auth.uid()) is not null
        and name like ((select auth.uid())::text || '/%')
      );
  end if;
end
$$;
