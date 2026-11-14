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
| `migrate_to_zones.py` | One-shot, idempotent `ponds/feeding → zones/triggers` migration |
| `simulator.py` | ESP32 zone simulator (sensors + actuator triggers) |
| `requirements.txt`, `.env` | Python deps and DB / `SERVER_URL` config |
| `green-matrix/` | Expo frontend (SDK 58 + Expo Router) |
| `green-matrix/database/db_zone.sql` | Fresh schema + seed users/zones |
| `green-matrix/hardware_esp32/hardware_esp32.ino` | ESP32 firmware |
| `models/` | `growth_stage_model.h5` used by the vision router |

## Run it

### 1. Database (once)

```powershell
psql -U postgres -c "CREATE DATABASE db_zone;"
psql -U postgres -d db_zone -f green-matrix/database/db_zone.sql
```

Seed logins: `admin` / `operator` / `viewer`, password `admin123`.

Upgrading an existing ponds/feeding database instead? Rename the DB and run the
migration (idempotent):

```powershell
psql -U postgres -d postgres -c "ALTER DATABASE db_pond RENAME TO db_zone;"
.\.venv\Scripts\python.exe migrate_to_zones.py
```

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
