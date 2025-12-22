-- Dual Island (IslaDual) schema + RLS for CRFM shared Supabase

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Core listings
-- ------------------------------------------------------------

create table if not exists public.pr_service_listings (
  id uuid primary key default gen_random_uuid(),
  provider_user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  title text not null,
  description text,
  base_location text,
  price_mode text not null check (price_mode in ('hourly','fixed','estimate')),
  price_cents integer,
  currency text not null default 'USD',
  is_active boolean not null default true,
  verified_required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pr_vehicle_listings (
  id uuid primary key default gen_random_uuid(),
  host_user_id uuid not null references auth.users(id) on delete cascade,
  vehicle_class text not null check (vehicle_class in ('road','water','heavy')),
  vehicle_type text not null,
  insurance_kind text,
  make text not null,
  model text not null,
  year integer not null,
  vin text,
  plate text,
  location text not null,
  daily_price_cents integer not null,
  currency text not null default 'USD',
  seats integer,
  transmission text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pr_vehicle_bookings (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.pr_vehicle_listings(id) on delete cascade,
  renter_user_id uuid not null references auth.users(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null check (status in ('requested','accepted','declined','cancelled','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pr_jobs (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.pr_service_listings(id) on delete cascade,
  consumer_user_id uuid not null references auth.users(id) on delete cascade,
  category text,
  description text not null,
  location text,
  scheduled_for timestamptz,
  status text not null check (status in ('requested','quoted','accepted','declined','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Roles + messaging
-- ------------------------------------------------------------

create table if not exists public.pr_user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('provider','vehicle_host')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table if not exists public.pr_threads (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('vehicle_booking','service_job')),
  ref_id uuid not null,
  last_message_at timestamptz,
  last_message_preview text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pr_threads_kind_ref_idx on public.pr_threads(kind, ref_id);

create table if not exists public.pr_thread_participants (
  thread_id uuid not null references public.pr_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);
create index if not exists pr_thread_participants_user_idx on public.pr_thread_participants(user_id);

create table if not exists public.pr_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.pr_threads(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists pr_messages_thread_idx on public.pr_messages(thread_id, created_at);

-- ------------------------------------------------------------
-- Verifications
-- ------------------------------------------------------------

create table if not exists public.pr_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('identity','driver_license','trade_license','vehicle_ownership','insurance')),
  status text not null default 'pending' check (status in ('pending','verified','rejected')),
  notes text,
  reviewer_user_id uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, kind)
);

create table if not exists public.pr_verification_files (
  id uuid primary key default gen_random_uuid(),
  verification_id uuid not null references public.pr_verifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_bucket text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);
create index if not exists pr_verification_files_user_idx on public.pr_verification_files(user_id);
create index if not exists pr_verification_files_verification_idx on public.pr_verification_files(verification_id);

-- ------------------------------------------------------------
-- Admin helpers
-- ------------------------------------------------------------

create or replace function public.pr_is_admin(uid uuid)
returns boolean
language sql
stable
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = uid), false);
$$;

create or replace function public.pr_has_verified(uid uuid, verification_kind text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.pr_verifications v
    where v.user_id = uid
      and v.kind = verification_kind
      and v.status = 'verified'
  );
$$;

create or replace function public.pr_is_verified_provider(uid uuid)
returns boolean
language sql
stable
as $$
  select public.pr_has_verified(uid, 'trade_license') and public.pr_has_verified(uid, 'identity');
$$;

create or replace function public.pr_is_verified_host(uid uuid)
returns boolean
language sql
stable
as $$
  select public.pr_has_verified(uid, 'vehicle_ownership')
    and public.pr_has_verified(uid, 'insurance')
    and public.pr_has_verified(uid, 'identity');
$$;

-- ------------------------------------------------------------
-- RLS policies
-- ------------------------------------------------------------

alter table public.pr_service_listings enable row level security;
alter table public.pr_vehicle_listings enable row level security;
alter table public.pr_vehicle_bookings enable row level security;
alter table public.pr_jobs enable row level security;
alter table public.pr_user_roles enable row level security;
alter table public.pr_threads enable row level security;
alter table public.pr_thread_participants enable row level security;
alter table public.pr_messages enable row level security;
alter table public.pr_verifications enable row level security;
alter table public.pr_verification_files enable row level security;

-- Listings: public can read active, owners can manage
drop policy if exists pr_service_listings_select_public on public.pr_service_listings;
create policy pr_service_listings_select_public
  on public.pr_service_listings for select
  using (is_active = true or provider_user_id = auth.uid());

drop policy if exists pr_service_listings_insert_owner on public.pr_service_listings;
create policy pr_service_listings_insert_owner
  on public.pr_service_listings for insert
  with check (provider_user_id = auth.uid());

drop policy if exists pr_service_listings_update_owner on public.pr_service_listings;
create policy pr_service_listings_update_owner
  on public.pr_service_listings for update
  using (provider_user_id = auth.uid())
  with check (provider_user_id = auth.uid());

drop policy if exists pr_service_listings_delete_owner on public.pr_service_listings;
create policy pr_service_listings_delete_owner
  on public.pr_service_listings for delete
  using (provider_user_id = auth.uid());

drop policy if exists pr_vehicle_listings_select_public on public.pr_vehicle_listings;
create policy pr_vehicle_listings_select_public
  on public.pr_vehicle_listings for select
  using (is_active = true or host_user_id = auth.uid());

drop policy if exists pr_vehicle_listings_insert_owner on public.pr_vehicle_listings;
create policy pr_vehicle_listings_insert_owner
  on public.pr_vehicle_listings for insert
  with check (host_user_id = auth.uid());

drop policy if exists pr_vehicle_listings_update_owner on public.pr_vehicle_listings;
create policy pr_vehicle_listings_update_owner
  on public.pr_vehicle_listings for update
  using (host_user_id = auth.uid())
  with check (host_user_id = auth.uid());

drop policy if exists pr_vehicle_listings_delete_owner on public.pr_vehicle_listings;
create policy pr_vehicle_listings_delete_owner
  on public.pr_vehicle_listings for delete
  using (host_user_id = auth.uid());

-- Bookings: renter + host
drop policy if exists pr_vehicle_bookings_select_participants on public.pr_vehicle_bookings;
create policy pr_vehicle_bookings_select_participants
  on public.pr_vehicle_bookings for select
  using (
    renter_user_id = auth.uid()
    or exists (
      select 1 from public.pr_vehicle_listings l
      where l.id = pr_vehicle_bookings.listing_id and l.host_user_id = auth.uid()
    )
  );

drop policy if exists pr_vehicle_bookings_insert_renter on public.pr_vehicle_bookings;
create policy pr_vehicle_bookings_insert_renter
  on public.pr_vehicle_bookings for insert
  with check (renter_user_id = auth.uid());

drop policy if exists pr_vehicle_bookings_update_participants on public.pr_vehicle_bookings;
create policy pr_vehicle_bookings_update_participants
  on public.pr_vehicle_bookings for update
  using (
    renter_user_id = auth.uid()
    or exists (
      select 1 from public.pr_vehicle_listings l
      where l.id = pr_vehicle_bookings.listing_id and l.host_user_id = auth.uid()
    )
  )
  with check (
    renter_user_id = auth.uid()
    or exists (
      select 1 from public.pr_vehicle_listings l
      where l.id = pr_vehicle_bookings.listing_id and l.host_user_id = auth.uid()
    )
  );

-- Jobs: consumer + provider
drop policy if exists pr_jobs_select_participants on public.pr_jobs;
create policy pr_jobs_select_participants
  on public.pr_jobs for select
  using (
    consumer_user_id = auth.uid()
    or exists (
      select 1 from public.pr_service_listings l
      where l.id = pr_jobs.listing_id and l.provider_user_id = auth.uid()
    )
  );

drop policy if exists pr_jobs_insert_consumer on public.pr_jobs;
create policy pr_jobs_insert_consumer
  on public.pr_jobs for insert
  with check (consumer_user_id = auth.uid());

drop policy if exists pr_jobs_update_participants on public.pr_jobs;
create policy pr_jobs_update_participants
  on public.pr_jobs for update
  using (
    consumer_user_id = auth.uid()
    or exists (
      select 1 from public.pr_service_listings l
      where l.id = pr_jobs.listing_id and l.provider_user_id = auth.uid()
    )
  )
  with check (
    consumer_user_id = auth.uid()
    or exists (
      select 1 from public.pr_service_listings l
      where l.id = pr_jobs.listing_id and l.provider_user_id = auth.uid()
    )
  );

-- Roles
drop policy if exists pr_user_roles_select_own on public.pr_user_roles;
create policy pr_user_roles_select_own
  on public.pr_user_roles for select
  using (auth.uid() = user_id);

drop policy if exists pr_user_roles_insert_own on public.pr_user_roles;
create policy pr_user_roles_insert_own
  on public.pr_user_roles for insert
  with check (auth.uid() = user_id);

drop policy if exists pr_user_roles_delete_own on public.pr_user_roles;
create policy pr_user_roles_delete_own
  on public.pr_user_roles for delete
  using (auth.uid() = user_id);

-- Threads/messages
drop policy if exists pr_threads_select_participants on public.pr_threads;
create policy pr_threads_select_participants
  on public.pr_threads for select
  using (
    exists (
      select 1 from public.pr_thread_participants p
      where p.thread_id = pr_threads.id and p.user_id = auth.uid()
    )
  );

drop policy if exists pr_threads_insert_authed on public.pr_threads;
create policy pr_threads_insert_authed
  on public.pr_threads for insert
  with check (auth.uid() is not null);

drop policy if exists pr_thread_participants_select_participants on public.pr_thread_participants;
create policy pr_thread_participants_select_participants
  on public.pr_thread_participants for select
  using (auth.uid() = user_id);

drop policy if exists pr_thread_participants_insert_authed on public.pr_thread_participants;
create policy pr_thread_participants_insert_authed
  on public.pr_thread_participants for insert
  with check (auth.uid() is not null);

drop policy if exists pr_messages_select_participants on public.pr_messages;
create policy pr_messages_select_participants
  on public.pr_messages for select
  using (
    exists (
      select 1 from public.pr_thread_participants p
      where p.thread_id = pr_messages.thread_id and p.user_id = auth.uid()
    )
  );

drop policy if exists pr_messages_insert_author_participant on public.pr_messages;
create policy pr_messages_insert_author_participant
  on public.pr_messages for insert
  with check (
    auth.uid() = author_user_id
    and exists (
      select 1 from public.pr_thread_participants p
      where p.thread_id = pr_messages.thread_id and p.user_id = auth.uid()
    )
  );

-- Verifications
drop policy if exists pr_verifications_select_own_or_admin on public.pr_verifications;
create policy pr_verifications_select_own_or_admin
  on public.pr_verifications for select
  using (auth.uid() = user_id or public.pr_is_admin(auth.uid()));

drop policy if exists pr_verifications_insert_own on public.pr_verifications;
create policy pr_verifications_insert_own
  on public.pr_verifications for insert
  with check (auth.uid() = user_id);

drop policy if exists pr_verifications_update_own_pending on public.pr_verifications;
create policy pr_verifications_update_own_pending
  on public.pr_verifications for update
  using (auth.uid() = user_id and status = 'pending')
  with check (auth.uid() = user_id and status = 'pending');

drop policy if exists pr_verifications_admin_update on public.pr_verifications;
create policy pr_verifications_admin_update
  on public.pr_verifications for update
  using (public.pr_is_admin(auth.uid()))
  with check (public.pr_is_admin(auth.uid()));

drop policy if exists pr_verification_files_select_own_or_admin on public.pr_verification_files;
create policy pr_verification_files_select_own_or_admin
  on public.pr_verification_files for select
  using (auth.uid() = user_id or public.pr_is_admin(auth.uid()));

drop policy if exists pr_verification_files_insert_own on public.pr_verification_files;
create policy pr_verification_files_insert_own
  on public.pr_verification_files for insert
  with check (auth.uid() = user_id);

drop policy if exists pr_verification_files_delete_own on public.pr_verification_files;
create policy pr_verification_files_delete_own
  on public.pr_verification_files for delete
  using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- Storage bucket policies (private)
-- ------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('isladual-verifications', 'isladual-verifications', false)
on conflict (id) do nothing;

drop policy if exists "isladual_verifications_read_own" on storage.objects;
create policy "isladual_verifications_read_own"
on storage.objects for select
using (
  bucket_id = 'isladual-verifications'
  and auth.uid()::text = split_part(name, '/', 2)
  and split_part(name, '/', 1) = 'verifications'
);

drop policy if exists "isladual_verifications_write_own" on storage.objects;
create policy "isladual_verifications_write_own"
on storage.objects for insert
with check (
  bucket_id = 'isladual-verifications'
  and auth.uid()::text = split_part(name, '/', 2)
  and split_part(name, '/', 1) = 'verifications'
);

drop policy if exists "isladual_verifications_update_own" on storage.objects;
create policy "isladual_verifications_update_own"
on storage.objects for update
using (
  bucket_id = 'isladual-verifications'
  and auth.uid()::text = split_part(name, '/', 2)
  and split_part(name, '/', 1) = 'verifications'
)
with check (
  bucket_id = 'isladual-verifications'
  and auth.uid()::text = split_part(name, '/', 2)
  and split_part(name, '/', 1) = 'verifications'
);

drop policy if exists "isladual_verifications_delete_own" on storage.objects;
create policy "isladual_verifications_delete_own"
on storage.objects for delete
using (
  bucket_id = 'isladual-verifications'
  and auth.uid()::text = split_part(name, '/', 2)
  and split_part(name, '/', 1) = 'verifications'
);

-- Thread last message helper
create or replace function public.pr_on_message_insert()
returns trigger
language plpgsql
security definer
as $$
begin
  update public.pr_threads
  set
    last_message_at = new.created_at,
    last_message_preview = left(new.body, 140),
    updated_at = now()
  where id = new.thread_id;
  return new;
end;
$$;

drop trigger if exists pr_messages_after_insert on public.pr_messages;
create trigger pr_messages_after_insert
after insert on public.pr_messages
for each row execute function public.pr_on_message_insert();
