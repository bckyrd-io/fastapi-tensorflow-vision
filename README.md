# ZoneMatrix

ZoneMatrix — smart farm automation for **zones** (greenhouses, ponds, pens and
kraals). The UI in `green-matrix/` is a **React Native Expo (SDK 58)** app with
Expo Router; it talks directly to the **FastAPI** backend at the repository
root, which stores everything in PostgreSQL database **`db_zone`**. The ESP32
simulator and firmware use the same API.

```
Expo app (web :8081 / Expo Go) --EXPO_PUBLIC_API_URL (/api/*)--> FastAPI (:8000) --> PostgreSQL db_zone
ESP32 / simulator (simulator.py) ------------------------------/api/*------------^
```

> **Terminology:** everything is a **zone** (`zone_id`, `/api/zones`). The
> value `zone_type = 'pond'` is kept on purpose — a pond is one *kind* of zone,
> like `greenhouse`, `pen_kraal` or `custom`. Actuator work (fans, doors,
> pumps, aerators) is handled by **triggers**, not "feeding".

## Layout

| Path | What it is |
|---|---|
| `main.py` | FastAPI entrypoint (all `/api/*` routers, port 8000) |
| `api/` | Routers and `db.py` (PostgreSQL access layer) |
| `api/triggers.py` | Actuator triggers: history, pending queue, presets, schedules, states |
| `api/vision.py` | AI growth-stage capture + human validation |
| `simulator.py` | ESP32 zone simulator (sensors + actuator triggers) |
| `requirements.txt`, `.env` | Python deps and DB / `SERVER_URL` config |
| `schema.sql`, `init_db.py` | Cloud schema + seed rows, applied idempotently on deploy |
| `render.yaml` | Render Blueprint: `zonematrix-api` (web) + `zonematrix-db` (Postgres) |
| `green-matrix/` | Expo frontend (SDK 58 + Expo Router) |
| `hardware_esp32/` | ESP32 firmware |
| `models/` | `growth_stage_model.h5` used by the vision router |

## Run it

### 1. Database (once)

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -c "import psycopg2; c=psycopg2.connect('host=localhost user=postgres password=postgres'); c.autocommit=True; c.cursor().execute('CREATE DATABASE db_zone')"
.\.venv\Scripts\python.exe init_db.py     # applies schema.sql (DDL + seeds)
```

Seed logins: `admin` / `operator` / `viewer`, password `admin123`.
`init_db.py` is idempotent — Render runs it before every deploy.

### 2. FastAPI backend (repo root)

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000
```

### 3. Expo UI (second terminal)

```powershell
cd green-matrix
npm install
npm run web             # browser -> http://localhost:8081
npx expo start          # QR code -> Expo Go (set EXPO_PUBLIC_API_URL to your LAN IP)
```

### 4. Simulator (third terminal, repo root)

```powershell
.\.venv\Scripts\python.exe simulator.py
# or from green-matrix/: npm run simulator
```

The simulator registers `P001` ("Greenhouse A1", `zone_type = greenhouse`),
streams sensor readings, and executes manual/scheduled actuator triggers.

## Deploy

### 1. Render — FastAPI + PostgreSQL

`render.yaml` at the repo root is a Render Blueprint that creates both pieces:

| Resource | Name | Plan |
|---|---|---|
| Web service (Python) | `zonematrix-api` → `https://zonematrix-api.onrender.com` | free |
| PostgreSQL | `zonematrix-db` (db `db_zone`, user `postgres`) | free |

Steps:

1. Push this repository to GitHub (the Blueprint is read from the repo root).
2. Render dashboard → **New → Blueprint** → connect the repo → **Apply**.
   Render provisions both resources and wires `DATABASE_URL` automatically.
3. `preDeployCommand: python init_db.py` applies `schema.sql` (11 tables +
   seed users/zones/configs) before every deploy — safe to re-run.
4. Smoke test:
   `https://zonematrix-api.onrender.com/api/health` → `{"success":true,"database":"up"}`
   and log in with `admin` / `admin123`.

Gotchas on the free tier:

- **Free Postgres expires 30 days after creation** (then a 14-day grace period,
  then the data is deleted) — upgrade the database plan to keep it.
- The web service spins down when idle: the first request after ~15 min takes
  30–60 s to warm up.
- `uploads/` (captured camera frames) is ephemeral — files are lost on redeploy.
- The vision endpoint loads TensorFlow on first use (~60 s) and needs more than
  512 MB; if `/api/zones/{id}/capture` crashes the instance, move the service
  to a paid plan (everything else runs fine on free).

### 2. EAS — Android APK

```powershell
cd green-matrix
npx eas-cli@latest login
npx eas-cli@latest init            # creates/links the Expo project (writes projectId)
npm run build:android:preview      # signed APK (buildType: apk)
```

The `preview` profile bakes `EXPO_PUBLIC_API_URL=https://zonematrix-api.onrender.com`
into the bundle (see `eas.json`); install the APK from the build link in the
EAS dashboard. `npm run build:android` produces the Play-Store AAB.

## Configuration

`.env` (repo root, read by FastAPI and the simulator):

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/db_zone
PGDATABASE=db_zone
SERVER_URL=http://localhost:8000
HOST=0.0.0.0
PORT=8000
```

`green-matrix/.env` (Expo app):

```env
EXPO_PUBLIC_API_URL=http://192.168.1.105:8000
```

## API quick reference

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/auth/login` | Session login |
| `GET/POST/PUT/DELETE` | `/api/zones` | Zone list / create / update / deactivate |
| `GET/PUT` | `/api/zone-configs` | Per-zone thresholds + device metadata |
| `GET/POST` | `/api/sensors`, `/api/sensors/latest`, `/api/sensors/history` | Readings |
| `GET/POST` | `/api/triggers` | Trigger history, manual run, disable schedules |
| `GET/POST` | `/api/triggers/pending` | Device work queue + completion ACK |
| `GET/PUT/POST` | `/api/triggers/schedules`, `/presets`, `/states` | Schedules/presets |
| `GET/POST/PUT/DELETE` | `/api/alerts` | Alert feed and acknowledgements |
| `GET` | `/api/reports/stats` | Aggregated readings |
| `POST` | `/api/zones/{zone_id}/capture` | AI vision prediction |
| `POST` | `/api/zones/vision/predictions/{id}/validate` | Human validation |

`zoneId` is accepted (camelCase) by device-facing endpoints; `zone_id` works on
query strings too. All payloads and rows use `zone_id` / `zone_name`.

## Verification

- `npx tsc --noEmit` and `npx expo lint` in `green-matrix/`
- API smoke: `/api/health`, `/api/zones`, `/api/sensors/latest`, `/api/triggers`,
  `/api/alerts`, `/api/reports/stats`
- `test_vision_pipeline.py` for the OpenCV + Keras inference path
- Simulator: zone registration, sensor ingest, manual and scheduled triggers
  with device ACKs
