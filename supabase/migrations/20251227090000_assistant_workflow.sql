create extension if not exists pgcrypto;

create table if not exists public.crfm_help_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  body_md text not null,
  tags text[] not null default '{}',
  roles_visible text[] not null default '{public}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.crfm_help_articles enable row level security;

drop policy if exists crfm_help_articles_select on public.crfm_help_articles;
create policy crfm_help_articles_select
  on public.crfm_help_articles for select
  using (
    roles_visible @> array['public']::text[]
    or (auth.role() = 'authenticated' and roles_visible @> array['user']::text[])
    or (
      auth.role() = 'authenticated'
      and roles_visible @> array['creator']::text[]
      and exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.is_verified_creator = true
      )
    )
    or is_admin_uid(auth.uid())
  );

drop policy if exists crfm_help_articles_admin_write on public.crfm_help_articles;
create policy crfm_help_articles_admin_write
  on public.crfm_help_articles for all
  using (is_admin_uid(auth.uid()))
  with check (is_admin_uid(auth.uid()));

create table if not exists public.assistant_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  role text,
  route_context jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_assistant_conversations_user
  on public.assistant_conversations (user_id, created_at desc);

alter table public.assistant_conversations enable row level security;

drop policy if exists assistant_conversations_select on public.assistant_conversations;
create policy assistant_conversations_select
  on public.assistant_conversations for select
  using (user_id = auth.uid() or is_admin_uid(auth.uid()));

drop policy if exists assistant_conversations_insert on public.assistant_conversations;
create policy assistant_conversations_insert
  on public.assistant_conversations for insert
  with check (user_id = auth.uid());

drop policy if exists assistant_conversations_update on public.assistant_conversations;
create policy assistant_conversations_update
  on public.assistant_conversations for update
  using (user_id = auth.uid() or is_admin_uid(auth.uid()))
  with check (user_id = auth.uid() or is_admin_uid(auth.uid()));

drop policy if exists assistant_conversations_delete on public.assistant_conversations;
create policy assistant_conversations_delete
  on public.assistant_conversations for delete
  using (user_id = auth.uid() or is_admin_uid(auth.uid()));

create table if not exists public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.assistant_conversations(id) on delete cascade,
  sender_role text not null,
  body text not null,
  tool_name text,
  tool_payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_assistant_messages_conversation
  on public.assistant_messages (conversation_id, created_at asc);

alter table public.assistant_messages enable row level security;

drop policy if exists assistant_messages_select on public.assistant_messages;
create policy assistant_messages_select
  on public.assistant_messages for select
  using (
    exists (
      select 1
      from public.assistant_conversations c
      where c.id = assistant_messages.conversation_id
        and (c.user_id = auth.uid() or is_admin_uid(auth.uid()))
    )
  );

drop policy if exists assistant_messages_insert on public.assistant_messages;
create policy assistant_messages_insert
  on public.assistant_messages for insert
  with check (
    exists (
      select 1
      from public.assistant_conversations c
      where c.id = assistant_messages.conversation_id
        and c.user_id = auth.uid()
    )
  );

create table if not exists public.distribution_partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'planned',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.distribution_import_jobs (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid references public.distribution_partners(id) on delete set null,
  creator_id uuid references public.profiles(id) on delete set null,
  status text not null default 'queued',
  logs text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.distribution_partners enable row level security;
alter table public.distribution_import_jobs enable row level security;

drop policy if exists distribution_partners_admin on public.distribution_partners;
create policy distribution_partners_admin
  on public.distribution_partners for all
  using (is_admin_uid(auth.uid()))
  with check (is_admin_uid(auth.uid()));

drop policy if exists distribution_import_jobs_admin on public.distribution_import_jobs;
create policy distribution_import_jobs_admin
  on public.distribution_import_jobs for all
  using (is_admin_uid(auth.uid()))
  with check (is_admin_uid(auth.uid()));

insert into public.crfm_help_articles (slug, title, body_md, tags, roles_visible)
values
  (
    'crosscoins-pay-per-play',
    'CrossCoins y pay-per-play',
    'CrossCoins (CC) son creditos internos usados para reproducir pistas y apoyar creadores. El modelo pay-per-play descuenta CC por cada reproduccion y asegura reparto transparente.',
    array['wallet', 'payments'],
    array['public']
  ),
  (
    'upload-options',
    'Opciones de subida: 10% gratis vs 100% permanente',
    'En CRFM puedes subir contenido con opciones gratuitas (10%) o adquirir acceso 100% permanente/membership para monetizacion completa. El asistente te guia segun tu rol.',
    array['upload', 'creator'],
    array['public']
  ),
  (
    'lrc-karaoke',
    'LRC karaoke y letras sincronizadas',
    'Los archivos .lrc permiten sincronizar letras con el audio. En el Hub puedes subirlos o editarlos para mejorar la experiencia del oyente.',
    array['lyrics', 'creator'],
    array['public']
  ),
  (
    'video-cover',
    'Video cover (5-10 segundos)',
    'El video cover es un clip corto (5-10s) que acompana a la pista. Usa contenido de alta calidad y respetuoso.',
    array['video', 'upload'],
    array['public']
  ),
  (
    'radio-stations',
    'Radio Stations en CRFM',
    'Las Radio Stations agrupan contenido en rotacion. Puedes explorar estaciones publicas o, si eres admin, gestionarlas.',
    array['radio'],
    array['public']
  ),
  (
    'marketplace-digital-downloads',
    'Marketplace y descargas digitales',
    'Crea productos digitales (mp3/wav/mp4) para vender directamente. Configura precio, activa/desactiva y administra formatos desde tu panel de creador.',
    array['marketplace', 'creator'],
    array['public']
  ),
  (
    'crfm-christian-standard',
    'Estilo cristiano CRFM',
    'El asistente mantiene un tono respetuoso, centrado en excelencia y servicio. No ofrece debates doctrinales profundos.',
    array['tone', 'guidelines'],
    array['public']
  ),
  (
    'integrations-upcoming',
    'Integraciones futuras',
    'Proximamente: integraciones con distribuidores (ej. DistroKid). Esta seccion es informativa y no activa ninguna API.',
    array['integrations'],
    array['public']
  )
on conflict (slug) do update
set title = excluded.title,
    body_md = excluded.body_md,
    tags = excluded.tags,
    roles_visible = excluded.roles_visible,
    updated_at = now();
