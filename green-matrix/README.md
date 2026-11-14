# ZoneMatrix — Expo app

**ZoneMatrix** frontend, built with **React Native Expo (SDK 58)** and
[Expo Router](https://docs.expo.dev/router/introduction). General-purpose farm
automation for zones — greenhouses, ponds, pens and kraals. It talks directly
to the FastAPI backend at the repository root; there is no Next.js proxy.

```
Expo app (web :8081 / Expo Go) --EXPO_PUBLIC_API_URL (/api/*)--> FastAPI (:8000) --> PostgreSQL db_zone
```

## Get started

```bash
npm install

# 1. backend must be running (repo root)
.venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000

# 2. start the app (this folder)
npm run web          # browser  -> http://localhost:8081
npx expo start       # QR code  -> scan with Expo Go on a phone
```

Backend URL lives in `.env`; if FastAPI runs on a different host/port, update it:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.105:8000
```

Android emulators fall back to `http://10.0.2.2:8000`; a phone will try the
Expo dev server's LAN IP automatically.

Seed login: `admin` / `admin123` (see `database/db_zone.sql`).

## Screens

| Route | What it is |
|---|---|
| `/` , `/register` | Login / registration (public) |
| `/dashboard` | KPI cards + threshold guide |
| `/vision` | Camera capture and AI growth-stage inference |
| `/monitoring` | Sensor history charts |
| `/triggers` | Manual and scheduled actuator triggers |
| `/zones` | Farm zone matrix + AI stage telemetry |
| `/zone-config` | Zone details, device metadata and thresholds (admin) |
| `/reports` | Period reports + PDF export |
| `/alerts` | Active alerts and history |
| `/usage` | User management (admin) |

## Project structure

| Path | What it is |
|---|---|
| `src/app/_layout.tsx` | Root layout: splash/session hydration + `Stack.Protected` auth gate |
| `src/app/(app)/` | Authenticated drawer area |
| `src/components/ui/` | Design-system primitives (Button, Card, Input, Badge, Tabs, Select, DataTable, states) |
| `src/components/drawer-content.tsx` | Role-filtered drawer nav + user footer |
| `src/components/logo.tsx` | ZoneMatrix brand mark |
| `src/lib/api.ts` | Fetch wrapper around `EXPO_PUBLIC_API_URL` |
| `src/stores/authStore.ts` | Zustand auth session, persisted with AsyncStorage |
| `src/constants/theme.ts` | Design tokens (colors, spacing, radius, shadows) |
| `database/`, `hardware_esp32/` | SQL schema/seed + ESP32 firmware |

## Scripts

```bash
npm run web        # expo start --web
npm run android    # expo start --android
npm run ios        # expo start --ios (macOS only)
npm run lint       # expo lint
npm run simulator  # ESP32 simulator (runs ../simulator.py against FastAPI :8000)
npx tsc --noEmit   # typecheck
```
