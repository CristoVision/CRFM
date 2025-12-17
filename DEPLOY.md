# Deploy & Versioning — CRFM (Hostinger)

## Objetivo
Mantener `crfministry.com` actualizado automáticamente con cada push a `main`, y mostrar una versión visible dentro de la app para soporte y control de releases (web + futuro mobile).

## Deploy automático (GitHub Actions → Hostinger)
- Workflow: `.github/workflows/deploy_hostinger.yml`
- Build: `npm ci` → `npm run build` (Vite) → output `dist/`
- Deploy: sube `dist/` a Hostinger vía FTP hacia `public_html/` con `dangerous-clean-slate: true` (reemplaza el sitio completo).
- SPA routing: `public/.htaccess` reescribe rutas a `index.html` para que `/login`, `/profile`, etc. no den 404.

### Secrets requeridos (repo `CRFM`)
GitHub → `Settings → Secrets and variables → Actions`:

**FTP (Hostinger)**
- `HOSTINGER_FTP_SERVER` (ej. `82.29.157.187`)
- `HOSTINGER_FTP_USERNAME` (ej. `u367319632.crfministry.com`)
- `HOSTINGER_FTP_PASSWORD`
- `HOSTINGER_FTP_PORT` (ej. `21`)
- `HOSTINGER_FTP_SERVER_DIR` (ej. `/public_html/`)
- `HOSTINGER_FTP_PROTOCOL` (`ftp` o `ftps`; si falla con timeout, prueba `ftps`)

**Supabase (para build)**
- `VITE_SUPABASE_URL` (ej. `https://<project>.supabase.co`)
- `VITE_SUPABASE_ANON_KEY` (si Supabase te da “publishable key”, úsala aquí)
- `VITE_STRIPE_PUBLISHABLE_KEY` (Stripe publishable key `pk_...`, requerido para abrir checkout embebido)

## Pagos (Stripe) — Edge Functions
Este repo incluye Edge Functions de Supabase para iniciar Checkout y procesar el webhook de Stripe.

### Archivos
- `supabase/functions/stripe-create-payment-intent/index.ts` (top-ups con PaymentElement)
- `supabase/functions/stripe-create-subscription-checkout-session/index.ts`
- `supabase/functions/stripe-create-upload-fee-checkout-session/index.ts`
- `supabase/functions/stripe-webhook/index.ts`
- SQL: `stripe_wallet.sql` (tablas + RPC idempotente)
- SQL: `stripe_creator_billing.sql` (suscripciones + fees + créditos)
- SQL: `stripe_upload_enforcement.sql` (enforcement server-side + consumo de créditos)
- SQL: `creator_billing_cc.sql` (compras de Unlimited + créditos usando CrossCoins)

### Secrets (Supabase Edge Functions)
Configura en tu proyecto Supabase (CLI: `supabase secrets set ...`):
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SUPABASE_PROJECT_URL`
- `SUPABASE_PROJECT_ANON_KEY`
- `SUPABASE_PROJECT_SERVICE_ROLE_KEY`
- `CC_TO_USD` (default recomendado: `0.01`)
- `MIN_TOPUP_USD` (default recomendado: `5`)
- `MAX_TOPUP_USD` (default recomendado: `100`)

### Price IDs (Stripe)
- `STRIPE_PRICE_UNLIMITED_MONTHLY`
- `STRIPE_PRICE_UNLIMITED_6MO`
- `STRIPE_PRICE_UNLIMITED_YEARLY`
- `STRIPE_PRICE_UPLOAD_TRACK`
- `STRIPE_PRICE_UPLOAD_ALBUM`

### Precios (CrossCoins)
Si quieres permitir pagar planes/fees usando CrossCoins (balance interno), primero ejecuta `creator_billing_cc.sql` y luego configura la tabla:
- `public.crfm_creator_billing_prices` (`price_cc` + `is_active=true`)
  - Claves: `unlimited_monthly`, `unlimited_6mo`, `unlimited_yearly`, `upload_track_credit`, `upload_album_credit`
  - Recomendación: si `1 CC = $0.01`, entonces `price_cc = price_usd * 100`.

### URLs
- Webhook endpoint: `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`
- Checkout session: llamado desde la app vía `supabase.functions.invoke('stripe-create-checkout-session', ...)`
  - Suscripción: `supabase.functions.invoke('stripe-create-subscription-checkout-session', { body: { plan: 'monthly'|'six_months'|'yearly' } })`
  - Upload fee: `supabase.functions.invoke('stripe-create-upload-fee-checkout-session', { body: { fee_type: 'track'|'album' } })`

### Stripe Webhook events requeridos
En Stripe → Developers → Webhooks, habilita estos eventos hacia `.../stripe-webhook`:
- `payment_intent.succeeded` (top-ups via Wallet PaymentElement)
- `checkout.session.completed` (top-ups via Checkout + creator upload fees)
- `customer.subscription.updated`
- `customer.subscription.deleted`

## Checklist rápido (Top Up / Stripe)
1) En Supabase SQL editor, correr: `stripe_wallet.sql` (crea `rpc_apply_stripe_topup` + tablas idempotentes).
2) En Supabase Edge Functions, desplegar: `stripe-create-payment-intent` y `stripe-webhook`.
3) En Supabase Edge secrets, setear: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
4) En Stripe Webhooks, agregar el endpoint `https://<project-ref>.supabase.co/functions/v1/stripe-webhook` con los eventos listados arriba.
5) En GitHub Actions, setear `VITE_STRIPE_PUBLISHABLE_KEY` y redeploy para que el frontend tenga Stripe habilitado.

## Si falla el deploy a Hostinger (Timeout control socket)
Ese error normalmente significa:
- El server/puerto/protocolo no coincide, o
- El hosting solo acepta `FTPS` (TLS) o `SFTP`, o
- Firewall bloquea conexiones desde GitHub Actions.

Qué probar, en orden:
1) Verifica en Hostinger (hPanel → Files → FTP Accounts) el `Host`, `Port` y si requiere `FTPS (Explicit)` o `FTP`.
2) Si Hostinger dice FTPS, crea/edita el secret `HOSTINGER_FTP_PROTOCOL` = `ftps` (y usa el puerto que te indique Hostinger, a veces `21` o `990`).
3) Si Hostinger es solo SFTP (SSH), este workflow no va a funcionar con `FTP-Deploy-Action`: necesitas credenciales SSH/SFTP y cambiar el deploy step a un action de SFTP.

## Versiones visibles (Web)
La web muestra la versión en la página `About` (parte inferior):
- Archivo: `src/lib/buildInfo.js`
- UI: `src/pages/AboutPage.jsx`

### Qué muestra
- `vX.Y.Z (abcdefg) · 2025-12-15T13:15:00Z`
  - `X.Y.Z`: viene de `package.json#version`
  - `abcdefg`: short SHA del commit deployado
  - timestamp: hora UTC del build

### Cómo se genera
En el workflow se exportan variables Vite:
- `VITE_APP_VERSION` (desde `package.json`)
- `VITE_BUILD_SHA` (desde `GITHUB_SHA`)
- `VITE_BUILD_TIME` (UTC)

## Cómo manejar versiones (SemVer)
Recomendación simple (manual, confiable):
- `fix`/parches: `npm version patch`
- nuevas features: `npm version minor`
- cambios breaking: `npm version major`

Flujo típico:
1) `npm version patch`
2) `git push`
3) GitHub Actions deploya y la app muestra la versión nueva automáticamente.

## Versionado automático (SemVer desde commits)
Este repo también soporta versionado automático en cada push a `main` usando `semantic-release`:
- Config: `.releaserc.json`
- Comportamiento: crea tags `vX.Y.Z` + GitHub Release automáticamente según el mensaje de commit (Conventional Commits).

### Reglas recomendadas para commits
- `feat: ...` → sube `minor`
- `fix: ...` → sube `patch`
- `docs: ...`, `chore: ...`, `refactor: ...` → sube `patch`
- Breaking changes: usar `feat!: ...` o incluir `BREAKING CHANGE:` en el body.

La versión que se muestra en la app se toma del release más reciente (tag) si existe, o de `package.json` en local.

## Notas para futuro Mobile (Android/iOS)
- Mantener el mismo `X.Y.Z` como “marketing version” entre web y mobile cuando se sincronice un release.
- Usar tags de Git (`v1.2.3`) cuando quieras “congelar” una versión para App Store/Play Store.
- El SHA puede servir como identificador interno para soporte (qué build exacto tiene un usuario).
