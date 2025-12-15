-- Allow admins to update profile flags directly (RLS policy) and add identity_reference if missing.
alter table public.profiles enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where polname = 'profiles_admin_update') then
    create policy profiles_admin_update on public.profiles
      for update using (is_admin_uid(auth.uid()))
      with check (is_admin_uid(auth.uid()));
  end if;
end $$;

alter table public.profiles add column if not exists identity_reference text;
