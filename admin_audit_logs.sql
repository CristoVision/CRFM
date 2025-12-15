-- Admin audit trail (apply in Supabase)
create table if not exists public.admin_audit_logs (
  id uuid primary key default uuid_generate_v4(),
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  target_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  details jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_logs enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where polname = 'admin_audit_logs_admin_read') then
    create policy admin_audit_logs_admin_read on public.admin_audit_logs
      for select using (is_admin_uid(auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where polname = 'admin_audit_logs_admin_insert') then
    create policy admin_audit_logs_admin_insert on public.admin_audit_logs
      for insert with check (is_admin_uid(auth.uid()));
  end if;
end $$;

comment on table public.admin_audit_logs is 'Immutable audit entries for admin actions.';
comment on column public.admin_audit_logs.details is 'JSON detail (e.g., fields changed, amounts).';
