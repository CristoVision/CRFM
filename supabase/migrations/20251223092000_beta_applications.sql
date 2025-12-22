create extension if not exists pgcrypto;

create table if not exists public.beta_applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  artist_name text,
  email text not null,
  links text,
  genre text,
  role_interest text,
  notes text,
  status text not null default 'pending',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz
);

create index if not exists idx_beta_applications_status on public.beta_applications (status);
create index if not exists idx_beta_applications_created_at on public.beta_applications (created_at desc);

alter table public.beta_applications enable row level security;

drop policy if exists beta_applications_insert_public on public.beta_applications;
create policy beta_applications_insert_public
  on public.beta_applications for insert
  with check (true);

drop policy if exists beta_applications_select_admin on public.beta_applications;
create policy beta_applications_select_admin
  on public.beta_applications for select
  using (is_admin_uid(auth.uid()));

drop policy if exists beta_applications_update_admin on public.beta_applications;
create policy beta_applications_update_admin
  on public.beta_applications for update
  using (is_admin_uid(auth.uid()))
  with check (is_admin_uid(auth.uid()));

drop policy if exists beta_applications_delete_admin on public.beta_applications;
create policy beta_applications_delete_admin
  on public.beta_applications for delete
  using (is_admin_uid(auth.uid()));
