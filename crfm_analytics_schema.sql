-- =====================================================================
-- CRFM Analytics – Stream + View tracking
-- Instrucciones: copiar y ejecutar en el SQL Editor de Supabase.
-- Ajusta nombres/valores si tu proyecto usa prefijos o esquemas distintos.
-- =====================================================================

-- Referencia (lo que vemos en el código actual)
-- track_streams: track_id, user_id, streamed_at
-- playlist_stream_events: playlist_id, listener_user_id, played_at
-- daily_track_streams: (agregado diario usado como fallback)

-- =====================================================================
-- 1) Streams: marcar gratis vs pagado y origen
-- =====================================================================
ALTER TABLE track_streams
  ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE NOT NULL,
  ADD COLUMN IF NOT EXISTS amount_creator_cents INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS amount_org_cents INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS currency_code CHAR(3) DEFAULT 'USD' NOT NULL,
  ADD COLUMN IF NOT EXISTS source TEXT CHECK (source IN ('web','embed','radio','preview','other')) DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS client_session_id UUID,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS ip_hash TEXT,          -- guarda hash, no IP cruda
  ADD COLUMN IF NOT EXISTS user_agent_hash TEXT,  -- opcional para dedupe
  ADD COLUMN IF NOT EXISTS play_ms INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS completed BOOLEAN DEFAULT FALSE NOT NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_track_streams_track_paid_day
  ON track_streams (track_id, is_paid, date_trunc('day', streamed_at));

CREATE INDEX IF NOT EXISTS idx_track_streams_country_day
  ON track_streams (country, date_trunc('day', streamed_at));

CREATE INDEX IF NOT EXISTS idx_track_streams_client_session
  ON track_streams (client_session_id)
  WHERE client_session_id IS NOT NULL;

-- =====================================================================
-- 2) Page/views: cualquier clic/vista a cards, playlists, albums, etc.
-- =====================================================================
CREATE TABLE IF NOT EXISTS content_view_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID REFERENCES auth.users(id),
  session_id TEXT NOT NULL,               -- generado en cliente
  resource_type TEXT NOT NULL CHECK (resource_type IN ('track_card','creator_card','playlist','album','hub_page','other_page')),
  resource_id UUID,                       -- null para páginas sin ID
  path TEXT,                              -- e.g. /hub/creators/123
  referrer TEXT,
  country TEXT,
  city TEXT,
  ip_hash TEXT,
  user_agent_hash TEXT,
  source TEXT,                            -- e.g. web, embed, campaign tag
  medium TEXT,                            -- optional UTM-ish field
  campaign TEXT                           -- optional campaign name
);

ALTER TABLE content_view_events ENABLE ROW LEVEL SECURITY;

-- Inserción: permitimos anon y auth; lectura solo con service role o vistas filtradas.
DROP POLICY IF EXISTS content_view_events_insert_any ON content_view_events;
CREATE POLICY content_view_events_insert_any
  ON content_view_events FOR INSERT
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS content_view_events_select_service ON content_view_events;
CREATE POLICY content_view_events_select_service
  ON content_view_events FOR SELECT
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_content_view_events_type_day
  ON content_view_events (resource_type, date_trunc('day', created_at));

CREATE INDEX IF NOT EXISTS idx_content_view_events_country_day
  ON content_view_events (country, date_trunc('day', created_at));

CREATE INDEX IF NOT EXISTS idx_content_view_events_session
  ON content_view_events (session_id);

-- =====================================================================
-- 3) (Opcional) Vista para que los creadores solo lean sus datos
--    Ajusta join según nombres reales de columnas de owner:
--    tracks.uploader_id, playlists.creator_id, albums.uploader_id
-- =====================================================================
DROP VIEW IF EXISTS creator_content_view_events;
CREATE VIEW creator_content_view_events AS
SELECT
  cve.*,
  COALESCE(t.uploader_id, pl.creator_id, al.uploader_id) AS owner_id
FROM content_view_events cve
LEFT JOIN tracks t ON cve.resource_type = 'track_card' AND cve.resource_id = t.id
LEFT JOIN playlists pl ON cve.resource_type = 'playlist' AND cve.resource_id = pl.id
LEFT JOIN albums al ON cve.resource_type = 'album' AND cve.resource_id = al.id;

ALTER VIEW creator_content_view_events SET (security_invoker = true);

DROP POLICY IF EXISTS creator_content_view_events_select_owner ON creator_content_view_events;
CREATE POLICY creator_content_view_events_select_owner
  ON creator_content_view_events FOR SELECT
  USING (owner_id = auth.uid());
