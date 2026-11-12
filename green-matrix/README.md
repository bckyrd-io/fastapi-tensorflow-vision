# GreenMatrix — Expo app

AquaMonitor / **GreenMatrix** frontend, converted from Next.js to **React Native
Expo (SDK 58)** with [Expo Router](https://docs.expo.dev/router/introduction).
General-purpose farm automation — ponds, greenhouses, animal kraals/pens —
so the UI speaks of **zones** everywhere (the API/DB still uses the original
`ponds` schema, so nothing broke). It talks directly to the FastAPI backend at
the repository root — there is no Next.js proxy anymore.

```
Expo app (web :8081 / Expo Go)  --EXPO_PUBLIC_API_URL (/api/*)-->  FastAPI (:8000)  -->  PostgreSQL db_pond
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

Backend URL lives in `.env`; if you run FastAPI on a different host/port, update it to match:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.105:8080   # example: same LAN IP as the FastAPI server
```

For Android emulators, the app defaults to `http://10.0.2.2:8000`. For a phone running Expo Go, it will try the same LAN IP as the Expo dev server, so you usually do not need to hard-code a specific IP unless the backend is on a different port or machine.

Seed login: `admin` / `admin123` (see `database/db_pond.sql`).

## Project structure

| Path | What it is |
|---|---|
| `src/app/_layout.tsx` | Root layout: splash/session hydration + `Stack.Protected` auth gate |
| `src/app/index.tsx`, `register.tsx` | Login / registration screens (public) |
| `src/app/(app)/` | Authenticated area — Drawer navigation (replaces the old sidebar) |
| `src/components/ui/` | Design-system primitives ported from the shadcn components (Button, Card, Input, Badge, Tabs, Select, DataTable, states) |
| `src/components/drawer-content.tsx` | Sidebar replacement: role-filtered nav + user footer |
| `src/components/toast.tsx` | sonner replacement (ToastProvider / useToast) |
| `src/lib/api.ts` | Fetch wrapper around `EXPO_PUBLIC_API_URL` |
| `src/stores/authStore.ts` | Zustand auth session, persisted with AsyncStorage |
| `src/constants/theme.ts` | Design tokens (colors light/dark, spacing, radius, shadows) — ported from the old `globals.css` |
| `database/`, `hardware_esp32/` | SQL seed + ESP32 firmware (unchanged, shared with the backend) |

## Scripts

```bash
npm run web        # expo start --web
npm run android    # expo start --android
npm run ios        # expo start --ios (macOS only)
npm run lint       # expo lint
npm run simulator  # ESP32 simulator (runs ../simulator.py against FastAPI :8000)
npx tsc --noEmit   # typecheck
```

# Terminal 3 — ESP32 simulator (live sensor data + feeding)
cd C:\Users\Administrator\Documents\Github\fastapi-green-matrix
.\.venv\Scripts\python.exe simulator.py
