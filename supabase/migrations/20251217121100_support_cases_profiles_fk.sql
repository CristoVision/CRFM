-- Fix PostgREST embedded selects for support cases.
-- AdminSupportTab selects `user:profiles(...)` from support_cases.user_id, which requires a FK to profiles.

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'support_cases_user_id_profiles_fkey'
  ) then
    alter table public.support_cases
      add constraint support_cases_user_id_profiles_fkey
      foreign key (user_id) references public.profiles(id)
      on delete set null
      not valid;
  end if;
end $$;

