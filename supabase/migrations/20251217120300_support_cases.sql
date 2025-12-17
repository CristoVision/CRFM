-- Support cases (tickets + messages) + minimal RPCs used by the UI.
-- Replaces older uuid-ossp usage with pgcrypto/gen_random_uuid().

create extension if not exists pgcrypto;

create table if not exists public.support_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'open' check (status in ('open','waiting_user','in_progress','resolved','closed')),
  priority text check (priority in ('low','normal','high','urgent')),
  subject text not null,
  description text,
  channel text,
  assigned_admin_id uuid references auth.users(id) on delete set null,
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_case_messages (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.support_cases(id) on delete cascade,
  sender_user_id uuid references auth.users(id) on delete set null,
  sender_role text not null check (sender_role in ('user','admin','system','ai')),
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.support_cases enable row level security;
alter table public.support_case_messages enable row level security;

drop policy if exists support_cases_select_self_or_admin on public.support_cases;
create policy support_cases_select_self_or_admin
  on public.support_cases for select
  using (auth.uid() = user_id or is_admin_uid(auth.uid()));

drop policy if exists support_cases_insert_self on public.support_cases;
create policy support_cases_insert_self
  on public.support_cases for insert
  with check (auth.uid() = user_id);

drop policy if exists support_cases_update_admin on public.support_cases;
create policy support_cases_update_admin
  on public.support_cases for update
  using (is_admin_uid(auth.uid()));

drop policy if exists support_msgs_select_scope on public.support_case_messages;
create policy support_msgs_select_scope
  on public.support_case_messages for select
  using (
    is_admin_uid(auth.uid())
    or exists (select 1 from public.support_cases c where c.id = case_id and c.user_id = auth.uid())
    or sender_user_id = auth.uid()
  );

drop policy if exists support_msgs_insert_scope on public.support_case_messages;
create policy support_msgs_insert_scope
  on public.support_case_messages for insert
  with check (sender_user_id = auth.uid() or is_admin_uid(auth.uid()));

-- RPCs used by `SupportContactPanel.jsx`
create or replace function public.create_support_case(
  p_user_id uuid,
  p_subject text,
  p_description text,
  p_priority text default 'normal',
  p_channel text default 'app'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'auth required' using errcode = '42501';
  end if;
  if auth.uid() <> p_user_id and not is_admin_uid(auth.uid()) then
    raise exception 'not allowed' using errcode = '42501';
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
set search_path = public
as $$
declare
  v_case_user uuid;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'auth required' using errcode = '42501';
  end if;
  if p_sender_role not in ('user','admin','system','ai') then
    raise exception 'invalid sender role' using errcode = '22000';
  end if;

  select user_id into v_case_user from public.support_cases where id = p_case_id;
  if v_case_user is null then
    raise exception 'case not found' using errcode = '22000';
  end if;

  if not (is_admin_uid(auth.uid()) or auth.uid() = v_case_user) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  insert into public.support_case_messages (case_id, sender_user_id, sender_role, message)
  values (p_case_id, auth.uid(), p_sender_role, p_message)
  returning id into v_id;

  update public.support_cases set updated_at = now() where id = p_case_id;

  return v_id;
end;
$$;

