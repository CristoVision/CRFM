-- Support cases + admin controls + RPCs (run in Supabase SQL editor)
-- Includes required extensions, tables, RLS, and helper RPCs.

create extension if not exists "uuid-ossp";

-- Support cases (tickets)
create table if not exists public.support_cases (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id),
  status text not null default 'open' check (status in ('open','waiting_user','in_progress','resolved','closed')),
  priority text check (priority in ('low','normal','high','urgent')),
  subject text not null,
  description text,
  channel text,
  assigned_admin_id uuid references auth.users(id),
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Support messages (threaded chat)
create table if not exists public.support_case_messages (
  id uuid primary key default uuid_generate_v4(),
  case_id uuid references public.support_cases(id) on delete cascade,
  sender_user_id uuid references auth.users(id),
  sender_role text not null check (sender_role in ('user','admin','system','ai')),
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.support_cases enable row level security;
alter table public.support_case_messages enable row level security;

-- RLS: users see their own cases; admins see all
do $$
begin
  if not exists (select 1 from pg_policies where polname='support_cases_select_self_or_admin') then
    create policy support_cases_select_self_or_admin on public.support_cases
      for select using (auth.uid() = user_id or is_admin_uid(auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where polname='support_cases_insert_self') then
    create policy support_cases_insert_self on public.support_cases
      for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where polname='support_cases_update_admin') then
    create policy support_cases_update_admin on public.support_cases
      for update using (is_admin_uid(auth.uid()));
  end if;
end $$;

-- RLS: messages visible to case owner or admins; insert only as self/admin
do $$
begin
  if not exists (select 1 from pg_policies where polname='support_msgs_select_scope') then
    create policy support_msgs_select_scope on public.support_case_messages
      for select using (
        is_admin_uid(auth.uid())
        or exists (select 1 from public.support_cases c where c.id = case_id and c.user_id = auth.uid())
        or sender_user_id = auth.uid()
      );
  end if;
  if not exists (select 1 from pg_policies where polname='support_msgs_insert_scope') then
    create policy support_msgs_insert_scope on public.support_case_messages
      for insert with check (
        sender_user_id = auth.uid() or is_admin_uid(auth.uid())
      );
  end if;
end $$;

-- Admin audit table (ensure present)
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
  if not exists (select 1 from pg_policies where polname='admin_audit_logs_admin_read') then
    create policy admin_audit_logs_admin_read on public.admin_audit_logs
      for select using (is_admin_uid(auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where polname='admin_audit_logs_admin_insert') then
    create policy admin_audit_logs_admin_insert on public.admin_audit_logs
      for insert with check (is_admin_uid(auth.uid()));
  end if;
end $$;

-- RPCs (SECURITY DEFINER)

create or replace function public.admin_lock_user(
  p_admin_id uuid,
  p_target_user_id uuid,
  p_until timestamptz,
  p_reason text
) returns void
language plpgsql
security definer
as $$
begin
  if not is_admin_uid(p_admin_id) then
    raise exception 'not allowed' using errcode='42501';
  end if;

  update auth.users set
    banned_until = p_until
  where id = p_target_user_id;

  insert into public.admin_audit_logs(admin_user_id, target_user_id, action, details)
  values (p_admin_id, p_target_user_id, 'lock_user', jsonb_build_object('until', p_until, 'reason', p_reason));
end;
$$;

create or replace function public.admin_require_password_reset(
  p_admin_id uuid,
  p_target_user_id uuid,
  p_reason text
) returns void
language plpgsql
security definer
as $$
begin
  if not is_admin_uid(p_admin_id) then
    raise exception 'not allowed' using errcode='42501';
  end if;

  update auth.users set password_updated_at = null where id = p_target_user_id;

  insert into public.admin_audit_logs(admin_user_id, target_user_id, action, details)
  values (p_admin_id, p_target_user_id, 'require_password_reset', jsonb_build_object('reason', p_reason));
end;
$$;

create or replace function public.admin_reset_mfa(
  p_admin_id uuid,
  p_target_user_id uuid,
  p_reason text
) returns void
language plpgsql
security definer
as $$
begin
  if not is_admin_uid(p_admin_id) then
    raise exception 'not allowed' using errcode='42501';
  end if;

  -- Supabase stores factors in auth schema; clearing factors revokes MFA
  delete from auth.mfa_factors where user_id = p_target_user_id;

  insert into public.admin_audit_logs(admin_user_id, target_user_id, action, details)
  values (p_admin_id, p_target_user_id, 'reset_mfa', jsonb_build_object('reason', p_reason));
end;
$$;

create or replace function public.admin_update_identity_verification(
  p_admin_id uuid,
  p_target_user_id uuid,
  p_is_verified boolean,
  p_reference text
) returns void
language plpgsql
security definer
as $$
begin
  if not is_admin_uid(p_admin_id) then
    raise exception 'not allowed' using errcode='42501';
  end if;

  update public.profiles
    set is_verified_creator = coalesce(p_is_verified, false),
        identity_reference = nullif(p_reference, ''),
        updated_at = now()
  where id = p_target_user_id;

  insert into public.admin_audit_logs(admin_user_id, target_user_id, action, details)
  values (p_admin_id, p_target_user_id, 'update_identity_verification', jsonb_build_object('verified', p_is_verified, 'reference', p_reference));
end;
$$;

create or replace function public.create_support_case(
  p_user_id uuid,
  p_subject text,
  p_description text,
  p_priority text default 'normal',
  p_channel text default 'app'
) returns uuid
language plpgsql
security definer
as $$
declare v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'auth required' using errcode='42501';
  end if;
  if auth.uid() <> p_user_id and not is_admin_uid(auth.uid()) then
    raise exception 'not allowed' using errcode='42501';
  end if;

  insert into public.support_cases (user_id, subject, description, priority, channel)
  values (p_user_id, p_subject, p_description, p_priority, p_channel)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.post_support_message(
  p_case_id uuid,
  p_sender_role text,
  p_message text
) returns uuid
language plpgsql
security definer
as $$
declare
  v_case_user uuid;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'auth required' using errcode='42501';
  end if;
  if p_sender_role not in ('user','admin','system','ai') then
    raise exception 'invalid sender role' using errcode='22000';
  end if;

  select user_id into v_case_user from public.support_cases where id = p_case_id;
  if v_case_user is null then
    raise exception 'case not found' using errcode='22000';
  end if;

  if not (is_admin_uid(auth.uid()) or auth.uid() = v_case_user) then
    raise exception 'not allowed' using errcode='42501';
  end if;

  insert into public.support_case_messages (case_id, sender_user_id, sender_role, message)
  values (p_case_id, auth.uid(), p_sender_role, p_message)
  returning id into v_id;

  update public.support_cases
    set updated_at = now()
  where id = p_case_id;

  return v_id;
end;
$$;
