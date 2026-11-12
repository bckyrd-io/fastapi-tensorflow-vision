"""ESP32 Hardware Simulator (Python port of hardware_esp32/dev_esp32.js).

Simulates the ESP32 pond monitor without real hardware. Behaviour is a 1:1
port of the JavaScript simulator: same config constants, same timing, same
drift ranges, same ACK retry loop.

Run with:
    .venv\\Scripts\\python.exe simulator.py

Point it at a different backend with SERVER_URL (defaults to the FastAPI
server URL in .env — the Next.js proxy was removed when the frontend moved to Expo):
    SERVER_URL=http://localhost:8000 .venv\\Scripts\\python.exe simulator.py
"""

from __future__ import annotations

import json
import os
import random
import sys
import time
from datetime import datetime, timezone

import requests


def _load_env_file(path: str = ".env") -> None:
    """Read SERVER_URL (etc.) from the repo-root .env like the JS simulator's
    ``process.env`` got it from the dev environment."""
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            if key and key not in os.environ:
                os.environ[key] = value.strip()


_load_env_file(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

# ============== CONFIG ==============
SERVER_URL = os.environ.get("SERVER_URL", "http://localhost:3000")
DEVICE_ID = "ESP32_POND_001"
POND_ID = "P001"
POND_NAME = "Main Pond A1"
POND_LOCATION = "Domasi"
POND_SIZE = "500"
POND_DEPTH = "1.5"
POND_SPECIES = "Chambo"

SENSOR_INTERVAL_MS = 10000        # 10 seconds
FEEDING_POLL_INTERVAL_MS = 2000   # 2 seconds
MIN_FEED_INTERVAL_MS = 30000      # 30 seconds safety

# ============== SIMULATED STATE ==============
is_feeding = False
last_feeding_time = 0  # epoch ms; 0 == never fed (JS sentinel)
current_temperature = 25.0
current_humidity = 60.0
current_ph = 7.0
current_water_level = 1.5


# ============== HELPERS ==============
def log(tag: str, msg: str) -> None:
    t = datetime.now(timezone.utc).strftime("%H:%M:%S")
    print(f"[{t}] [{tag}] {msg}", flush=True)


def sleep(ms: int) -> None:
    time.sleep(ms / 1000.0)


def now_ms() -> int:
    return int(time.time() * 1000)


def drift_value(current: float, lo: float, hi: float, max_delta: float) -> float:
    """Generate a realistic drifted value within bounds."""
    delta = (random.random() - 0.5) * 2 * max_delta
    value = current + delta
    return max(lo, min(hi, value))


# ============== SIMULATED SENSORS ==============
def simulate_read_sensors() -> None:
    global current_temperature, current_humidity, current_ph, current_water_level
    current_temperature = drift_value(current_temperature, 22.0, 30.0, 0.5)
    current_humidity = drift_value(current_humidity, 50.0, 85.0, 2.0)
    current_ph = drift_value(current_ph, 6.0, 8.5, 0.15)
    current_water_level = drift_value(current_water_level, 1.0, 2.0, 0.05)

    log(
        "SENSOR",
        f"Temp: {current_temperature:.1f}C | "
        f"Humidity: {current_humidity:.1f}% | "
        f"pH: {current_ph:.2f} | "
        f"Water Level: {current_water_level:.3f}m",
    )


# ============== POND REGISTRATION ==============
def register_pond() -> None:
    log("POND", "Registering with server...")
    try:
        res = requests.post(
            f"{SERVER_URL}/api/ponds",
            json={
                "id": POND_ID,
                "name": POND_NAME,
                "location": POND_LOCATION,
                "size": POND_SIZE,
                "depth": POND_DEPTH,
                "species": POND_SPECIES,
                "device_id": DEVICE_ID,
                "is_hardware_registration": True,
            },
            timeout=10,
        )
        if res.status_code in (200, 201):
            log("POND", "Registered successfully")
        else:
            log("POND", f"Registration failed. HTTP: {res.status_code}")
    except Exception as err:  # requests.RequestException and friends
        log("POND", f"Registration error: {err}")


# ============== SENSOR DATA TRANSMISSION ==============
def send_sensor_data() -> None:
    log("HTTP", "Sending sensor data...")
    payload = {
        "device_id": DEVICE_ID,
        "pondId": POND_ID,
        "temp": current_temperature,
        "ph": current_ph,
        "humidity": current_humidity,
        "level": current_water_level,
    }
    log("HTTP", f"Payload: {json.dumps(payload)}")

    try:
        res = requests.post(
            f"{SERVER_URL}/api/sensors", json=payload, timeout=10
        )
        log("HTTP", f"Response: {res.status_code}")
        if res.status_code != 200:
            log("HTTP", "Sensor send failed — brief yellow flash (simulated)")
    except Exception as err:
        log("HTTP", f"Send error: {err}")


# ============== FEEDING ==============
def check_for_feeding_commands() -> None:
    global last_feeding_time

    if is_feeding:
        return

    now = now_ms()
    if last_feeding_time > 0 and now - last_feeding_time < MIN_FEED_INTERVAL_MS:
        return

    url = f"{SERVER_URL}/api/feeding/pending?pondId={POND_ID}&deviceId={DEVICE_ID}"

    try:
        res = requests.get(url, timeout=10)
        if res.status_code == 200:
            data = res.json()
            log("FEED POLL", f"Response: {json.dumps(data)}")

            manual = data.get("manualTriggers") or []
            scheduled = data.get("scheduledFeedings") or []

            log(
                "FEED POLL",
                f"Manual triggers: {len(manual)}, Scheduled: {len(scheduled)}",
            )

            if manual:
                record_id = manual[0]["id"]
                log("FEED", "Manual trigger received. Feeding...")
                perform_feeding()
                ack_ok = acknowledge_feeding_complete(record_id, is_schedule=False)
                if not ack_ok:
                    last_feeding_time = now_ms() + 60000
                    log("FEED", "Manual ACK failed — extended safety delay applied")
            elif scheduled:
                record_id = scheduled[0]["id"]
                interval_minutes = scheduled[0]["interval_minutes"]
                log(
                    "FEED",
                    f"Interval schedule triggered (every {interval_minutes} min). Feeding...",
                )
                perform_feeding()
                ack_ok = acknowledge_feeding_complete(record_id, is_schedule=True)
                if not ack_ok:
                    last_feeding_time = now_ms() + 60000
                    log("FEED", "Schedule ACK failed — extended safety delay applied")
            else:
                log("FEED POLL", "No pending feedings")
        else:
            log("FEED POLL", f"HTTP error: {res.status_code}")
    except Exception as err:
        log("FEED POLL", f"Poll error: {err}")


def perform_feeding() -> None:
    global is_feeding, last_feeding_time
    is_feeding = True
    last_feeding_time = now_ms()
    log("FEED", "Dispensing feed...")
    log("LED", "YELLOW LED ON (simulated)")

    log("SERVO", f"Writing angle {25} (open)")
    sleep(150)

    log("SERVO", f"Writing angle {0} (close)")
    sleep(200)

    log("LED", "YELLOW LED OFF (simulated)")
    is_feeding = False
    log("FEED", "Done. Fish have been fed.")


def acknowledge_feeding_complete(record_id, is_schedule: bool) -> bool:
    log("FEED", "Acknowledging completion...")
    payload = {
        "deviceId": DEVICE_ID,
        "pondId": POND_ID,
        "status": "completed",
    }
    if is_schedule:
        payload["scheduleId"] = record_id
    else:
        payload["logId"] = record_id

    for attempt in range(1, 4):
        log("FEED", f"ACK Attempt {attempt}/3...")
        log("FEED", f"ACK Payload: {json.dumps(payload)}")

        try:
            res = requests.post(
                f"{SERVER_URL}/api/feeding/pending", json=payload, timeout=10
            )
            log("FEED", f"ACK Response: {res.status_code}")
            if res.status_code == 200:
                log(
                    "FEED",
                    "Acknowledgment successful — server updated last_executed",
                )
                return True
        except Exception as err:
            log("FEED", f"ACK error: {err}")

        log("FEED", "ACK failed, retrying in 1 second...")
        sleep(1000)

    log("FEED", "ACK FAILED after 3 attempts — will use extended safety delay")
    return False


# ============== MAIN LOOP ==============
def main() -> None:
    print("\n=== Pond Monitor ESP32 Simulator Starting ===")
    print("[VERSION] Using /api/feeding/pending endpoint")
    print(f"[CONFIG] Server: {SERVER_URL}")
    print(f"[CONFIG] Device: {DEVICE_ID} | Pond: {POND_ID}")

    register_pond()
    log("SETUP", "Complete")

    last_sensor_send = 0
    last_feeding_poll = 0

    while True:
        now = now_ms()

        if now - last_feeding_poll >= FEEDING_POLL_INTERVAL_MS:
            check_for_feeding_commands()
            last_feeding_poll = now_ms()

        if now - last_sensor_send >= SENSOR_INTERVAL_MS:
            simulate_read_sensors()
            send_sensor_data()
            last_sensor_send = now_ms()

        sleep(500)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nSimulator stopped.")
        sys.exit(0)
    except Exception as err:  # pragma: no cover - fatal path
        print(f"Fatal error: {err}")
        sys.exit(1)
