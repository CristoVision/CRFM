# Supabase Schema — Achievements & Projects

Last updated: implemented multi-project achievements to support CRFM and DU TCG PR.

## Tables
### projects
- `id` (uuid, pk, default uuid_generate_v4)
- `code` (text, unique) — e.g. `CRFM`, `DU_TCG_PR`
- `name` (text)
- `description` (text)
- `created_at` (timestamptz, default now)

### project_seasons
- `id` (uuid, pk)
- `project_id` (uuid, fk projects.id, cascade)
- `code` (text) — e.g. `S1`, `2025Q1`
- `name` (text)
- `starts_at`, `ends_at` (timestamptz)
- `pass_required` (bool, default false)
- `pass_name` (text)
- Unique: (project_id, code)

### achievements (extended)
- `project_id` (uuid, fk projects.id)
- `season_id` (uuid, fk project_seasons.id)
- `unlock_rules` (jsonb, default `{}`) — criteria per project
- `rewards` (jsonb, default `[]`) — list of rewards (currency/items/passes)
- `active_from`, `active_to` (timestamptz)
- `rarity` (text: common/rare/epic/legendary, default common)
- Existing columns (name, description, icon_url, is_milestone, etc.) remain.
- Indexes: `idx_achievements_project`, `idx_achievements_season`.

### user_achievements (extended)
- `project_id` (uuid, fk projects.id)
- `season_id` (uuid, fk project_seasons.id)
- `rewards_claimed` (bool, default false)
- `claimed_at` (timestamptz)
- `progress` (jsonb, default `{}`)
- Index: `idx_user_achievements_project` on (user_id, project_id).

## Seeds / updates aplicados (2025-12)
- Se aseguró `projects.code` y filas base `CRFM`, `DU_TCG_PR`.
- Se reasignaron logros existentes a proyectos con `unlock_rules` y `rewards`.
- Se insertó set ampliado (evita duplicados por nombre+proyecto):
  - CRFM: Stream 100, Stream 1K, Upload Streak 5, Global Listener, Playlist Builder, Page Views 1K + ajustes a First Steps, Combo Starter, Cross Coin Keeper, Bonded in Faith, Faithful Explorer.
  - DU_TCG_PR: First Duel Win, Win 10, Collection 25, Collection 100, Win Streak 5, Season Completion + ajustes a Creature Collector, Trainer Rising.
- Script usado: bloque DO que resuelve `crfm_id` y `du_id`, actualiza existentes e inserta los nuevos (ver historial de sesión o solicitar fragmento).
- Backfill: `backfill_achievements.sql` (bloque DO) inserta en `user_achievements` logros ya cumplidos usando:
  - Streams (track_streams + tracks.uploader_id) para First Steps/Combo Starter/Stream 100/Stream 1K/Global Listener.
  - Uploads (tracks) para Upload Streak 5 (aprox total >=5).
  - Playlists públicas (playlists) para Playlist Builder.
  - Page views (page_views) para Page Views 1K y Faithful Explorer.
  - Wallet balance (profiles.wallet_balance) para Cross Coin Keeper.
  - Faction bonds (player_faction_bonds) para Bonded in Faith.
  - TCG: player_trainer_stats wins para First Duel Win / Win 10 / Win Streak 5 / Trainer Rising; player_creatures colección para Creature Collector / Collection 25 / Collection 100.

### content_view_events, track_streams
See `crfm_analytics_schema.sql` for analytics columns and indexes.

## JSON examples
```json
rewards: [
  {"type": "currency", "code": "CC", "amount": 100, "project": "CRFM"},
  {"type": "item", "code": "PACK_PR_BASIC", "project": "DU_TCG_PR"}
]
unlock_rules: {
  "project": "CRFM",
  "event": "streams",
  "threshold": 1000,
  "scope": "any"
}
```

## Usage notes
- Scope achievements by `project_id` (or `projects.code`) in queries and UI.
- Seasons/passes are optional; set `season_id` and `pass_required/pass_name` when needed.
- Rewards can mix currencies/items for different projects; the unlocker/claim flow should process them per type/project.
