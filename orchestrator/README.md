# Bulk Upload (CRFM) — Albums & Singles

Este folder contiene un script de importación masiva pensado para:
- re-subir tu librería completa (albums + singles) a un proyecto nuevo de Supabase
- mantener idempotencia (puedes re-ejecutar sin duplicar filas si usas `key`/`import_key`)
- respetar RLS y el upload policy (free / pay_per_upload / subscription) usando login real del usuario

## Requisitos
- Tener los archivos **locales** (no placeholders de iCloud). Recomendación: copia todo a un folder local como `bulk/media/`.
- Buckets existentes (ver migración `supabase/migrations/20251217095100_storage_buckets_and_policies.sql`):
  - `track-audio`, `track-cover`, `album-covers` (públicos)
- DB migrations aplicadas, incluyendo:
  - `supabase/migrations/20251218161000_bulk_import_keys.sql`

## Env vars requeridas
Exporta estas variables (o crea un `.env` y `source`):
- `SUPABASE_URL` (o `VITE_SUPABASE_URL`)
- `SUPABASE_ANON_KEY` (o `VITE_SUPABASE_ANON_KEY`)
- `BULK_AUTH_EMAIL`
- `BULK_AUTH_PASSWORD`

## Manifest
Copia `orchestrator/manifest.example.yml` y edítalo.

Campos principales:
- `root_dir`: raíz para paths relativos en `audio`/`cover_art`
- `defaults.upload_policy`: `free | pay_per_upload | subscription | null`
  - `null` = no setea `upload_policy` en tracks/albums (se usa `profiles.creator_upload_policy`)
- `albums[]`: cada album con `title`, `cover_art`, y `tracks[]`
- `singles[]`: tracks sueltos

## Ejecutar
Dry-run (valida archivos y estructura):

`node orchestrator/bulk_upload.mjs --manifest orchestrator/manifest.example.yml --dry-run`

Upload real:

`node orchestrator/bulk_upload.mjs --manifest /ruta/a/tu/manifest.yml`

Output:
- `orchestrator/bulk_upload_report.json` con IDs/URLs creados.

