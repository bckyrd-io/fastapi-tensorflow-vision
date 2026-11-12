# fastapi-green-matrix

AquaMonitor / GreenMatrix — smart farm automation (ponds, greenhouses, animal
kraals/pens). The UI in `green-matrix/` is now a **React Native Expo (SDK 58)**
app (converted from Next.js, following Code with Beto's conventions and
docs.expo.dev); it talks directly to the **FastAPI**
backend at the repository root. The original Next.js API routes were ported to
Python 1:1 and removed after passing parity and end-to-end tests. The ESP32
hardware simulator is Python too. The UI says "zone" where the original said
"pond"; the API and DB keep their original `ponds` schema.

```
Expo app (web :8081 / Expo Go)  --/api/* via EXPO_PUBLIC_API_URL-->  FastAPI (:8000)  -->  PostgreSQL db_pond
ESP32 simulator (simulator.py)  -------------------------------------/api/*-----------^
```

## Layout

| Path | What it is |
|---|---|
| `main.py` | FastAPI entrypoint (all `/api/*` routers, port 8000) |
| `api/` | Routers ported from `green-matrix/app/api` + `db.py` (mirrors `lib/database.js`) |
| `simulator.py` | Python port of the JS ESP32 simulator (`dev_esp32.js`) |
| `requirements.txt`, `.env` | Python deps and DB/`SERVER_URL` config |
| `green-matrix/` | Expo frontend (SDK 58 + Expo Router; `EXPO_PUBLIC_API_URL` points at :8000) |
| `green-matrix/hardware_esp32/hardware_esp32.ino` | Real ESP32 firmware (unchanged) |
| `legacy-plant-app/` | The previous root application, moved aside unchanged |

## Run it

### One-command local startup

From the repo root:

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\start-dev.ps1
```

This script:
- starts the FastAPI backend on `0.0.0.0:8000`
- writes the current machine LAN IP into `green-matrix/.env`
- starts the Expo web app in the same command

### Manual startup

```bash
# 1. database (once)
psql -U postgres -c "CREATE DATABASE db_pond;"
psql -U postgres -d db_pond -f green-matrix/database/db_pond.sql
# seed users: admin / operator / viewer, password admin123

# 2. FastAPI backend (repo root)
py -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000

# 3. Expo UI (second terminal, green-matrix/)
cd green-matrix
npm install
npm run web             # browser  -> http://localhost:8081
npx expo start          # QR code  -> scan with Expo Go (set EXPO_PUBLIC_API_URL in .env
                        #            to your LAN IP for a physical device)

# 4. hardware simulator (third terminal, repo root)
npm run simulator      # from green-matrix/, or: .venv\Scripts\python.exe simulator.py
```

## Configuration

`.env` (repo root, read by FastAPI and the simulator):

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/db_pond
SERVER_URL=http://localhost:8000   # simulator target (FastAPI directly)
HOST=0.0.0.0
PORT=8000
```

## Tests used for the migration

- **Parity diff**: 31/31 GET endpoints returned byte-identical JSON
  (old TS API on :3000 vs FastAPI on :8000), including node-postgres
  quirks — NUMERIC and int8 as strings, ISO-8601 UTC timestamps, JS
  `toFixed` rounding.
- **E2E suite**: 17/17 checks (login, pond registration, sensor ingest,
  history, thresholds/alerts, manual + scheduled feeding with device ACKs,
  schedules, reports, users).
- **Simulator**: Python simulator registered the pond, streamed readings
  (`device_id=ESP32_POND_001`), and executed manual and 1-minute scheduled
  feedings with successful ACKs.

## Known quirks (kept from the original on purpose)

- `GET /api/auth/me` returns the first active user for any `Bearer` token.
- Identical sensor alerts are **not** deduplicated — a drifting sensor can
  raise repeated alerts, exactly as before.
