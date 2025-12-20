# Capacitor (iOS/iPadOS + Android) — CRFM

Este documento prepara este proyecto para ejecutarse como app “native wrapper” usando Capacitor, manteniendo la misma web app como UI.

## Requisitos
- Node.js 20+
- `npm install`
- macOS + Xcode (para iOS/iPadOS)
- Android Studio (para Android)

## Importante (cuenta Apple gratis)
- Puedes instalar la app en tus propios dispositivos conectados a tu Mac (firmado con tu Apple ID).
- No podrás distribuir por TestFlight/App Store hasta pagar el Apple Developer Program.

## Setup inicial (una vez)
Desde el root del repo:

```bash
npm install
```

Inicializa plataformas (genera carpetas `ios/` y `android/`):

```bash
npx cap add ios
npx cap add android
```

Recomendación: commitea `ios/` y `android/` al repo para que el proyecto nativo esté versionado.

## Ejecutar en iPhone/iPad (Xcode)

```bash
npm run ios
```

Esto construye `dist/`, sincroniza a `ios/` y abre Xcode.

## Ejecutar en Android (Android Studio)

```bash
npm run android
```

Esto construye `dist/`, sincroniza a `android/` y abre Android Studio.

## Mantener paridad con la web
- Cada cambio en React/Vite se refleja en mobile con `npm run ios` / `npm run android`.
- La lógica (Supabase, Stripe, etc.) se mantiene igual porque la UI es la web dentro del wrapper.

## macOS (Catalyst) — después
Cuando iOS/iPadOS esté estable, se puede habilitar Mac Catalyst desde Xcode reutilizando el wrapper.

