-- Storage bucket for DU TCG PR creature art

insert into storage.buckets (id, name, public)
values ('creatures', 'creatures', true)
on conflict (id) do nothing;

-- Public read for creature art bucket
 drop policy if exists creatures_select_public on storage.objects;
create policy creatures_select_public on storage.objects
  for select
  using (bucket_id = 'creatures');

-- Admin-only writes for curated art
 drop policy if exists creatures_admin_all on storage.objects;
create policy creatures_admin_all on storage.objects
  for all
  using (bucket_id = 'creatures' and public.is_admin_uid(auth.uid()))
  with check (bucket_id = 'creatures' and public.is_admin_uid(auth.uid()));
