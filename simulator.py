"""ESP32 zone/actuator simulator for ZoneMatrix.

Simulates an ESP32 zone monitor without real hardware: it registers a zone,
streams sensor readings, and executes actuator triggers (fans, doors, pumps)
queued from the web UI. Same timing/drift behaviour as the original simulator,
now speaking the zones/triggers API.

Run with:
    .venv\\Scripts\\python.exe simulator.py

Point it at a different backend with SERVER_URL (defaults to the FastAPI
server URL in .env):
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
SERVER_URL = os.environ.get("SERVER_URL", "http://localhost:8000")
DEVICE_ID = "ESP32_ZONE_001"
ZONE_ID = "P001"
ZONE_NAME = "Greenhouse A1"
ZONE_LOCATION = "North Sector"
ZONE_TYPE = "greenhouse"
ZONE_SIZE = "350"
ZONE_DEPTH = "3.5"
ZONE_SUBJECT = "Tomato (Roma)"

SENSOR_INTERVAL_MS = 10000        # 10 seconds
TRIGGER_POLL_INTERVAL_MS = 2000   # 2 seconds
MIN_TRIGGER_INTERVAL_MS = 30000   # 30 seconds safety

# ============== SIMULATED STATE ==============
is_triggering = False
last_trigger_time = 0  # epoch ms; 0 == never triggered (JS sentinel)
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


# ============== ZONE REGISTRATION ==============
def register_zone() -> None:
    log("ZONE", "Registering with server...")
    try:
        res = requests.post(
            f"{SERVER_URL}/api/zones",
            json={
                "id": ZONE_ID,
                "name": ZONE_NAME,
                "location": ZONE_LOCATION,
                "zone_type": ZONE_TYPE,
                "subject_name": ZONE_SUBJECT,
                "size": ZONE_SIZE,
                "depth": ZONE_DEPTH,
                "device_id": DEVICE_ID,
            },
            timeout=10,
        )
        if res.status_code in (200, 201):
            log("ZONE", "Registered successfully")
        else:
            log("ZONE", f"Registration failed. HTTP: {res.status_code}")
    except Exception as err:  # requests.RequestException and friends
        log("ZONE", f"Registration error: {err}")


# ============== SENSOR DATA TRANSMISSION ==============
def send_sensor_data() -> None:
    log("HTTP", "Sending sensor data...")
    payload = {
        "device_id": DEVICE_ID,
        "zoneId": ZONE_ID,
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


# ============== ACTUATOR TRIGGERS ==============
def check_for_triggers() -> None:
    global last_trigger_time

    if is_triggering:
        return

    now = now_ms()
    if last_trigger_time > 0 and now - last_trigger_time < MIN_TRIGGER_INTERVAL_MS:
        return

    url = f"{SERVER_URL}/api/triggers/pending?zoneId={ZONE_ID}&deviceId={DEVICE_ID}"

    try:
        res = requests.get(url, timeout=10)
        if res.status_code == 200:
            data = res.json()
            log("TRIGGER POLL", f"Response: {json.dumps(data)}")

            manual = data.get("manualTriggers") or []
            scheduled = data.get("scheduledTriggers") or []

            log(
                "TRIGGER POLL",
                f"Manual triggers: {len(manual)}, Scheduled: {len(scheduled)}",
            )

            if manual:
                trigger = manual[0]
                record_id = trigger["id"]
                actuator = trigger.get("actuator_name") or "Actuator"
                duration = trigger.get("duration_seconds") or 0
                log("TRIGGER", f"Manual trigger received for {actuator} ({duration}s)...")
                perform_trigger(actuator, duration)
                ack_ok = acknowledge_trigger_complete(record_id, is_schedule=False)
                if not ack_ok:
                    last_trigger_time = now_ms() + 60000
                    log("TRIGGER", "Manual ACK failed — extended safety delay applied")
            elif scheduled:
                trigger = scheduled[0]
                record_id = trigger["id"]
                interval_minutes = trigger.get("interval_minutes")
                actuator = trigger.get("actuator_name") or "Actuator"
                duration = trigger.get("duration_seconds") or 0
                log(
                    "TRIGGER",
                    f"Interval schedule triggered for {actuator} "
                    f"(every {interval_minutes} min, {duration}s)...",
                )
                perform_trigger(actuator, duration)
                ack_ok = acknowledge_trigger_complete(record_id, is_schedule=True)
                if not ack_ok:
                    last_trigger_time = now_ms() + 60000
                    log("TRIGGER", "Schedule ACK failed — extended safety delay applied")
            else:
                log("TRIGGER POLL", "No pending triggers")
        else:
            log("TRIGGER POLL", f"HTTP error: {res.status_code}")
    except Exception as err:
        log("TRIGGER POLL", f"Poll error: {err}")


def perform_trigger(actuator_name: str, duration_seconds: int) -> None:
    global is_triggering, last_trigger_time
    is_triggering = True
    last_trigger_time = now_ms()
    log("TRIGGER", f"Activating {actuator_name} for {duration_seconds}s...")
    log("LED", "YELLOW LED ON (simulated)")

    log("RELAY", f"{actuator_name} ON")
    sleep(min(duration_seconds, 5) * 1000)

    log("RELAY", f"{actuator_name} OFF")
    log("LED", "YELLOW LED OFF (simulated)")
    is_triggering = False
    log("TRIGGER", f"Done. {actuator_name} cycle complete.")


def acknowledge_trigger_complete(record_id, is_schedule: bool) -> bool:
    log("TRIGGER", "Acknowledging completion...")
    payload = {
        "deviceId": DEVICE_ID,
        "zoneId": ZONE_ID,
        "status": "completed",
    }
    if is_schedule:
        payload["scheduleId"] = record_id
    else:
        payload["logId"] = record_id

    for attempt in range(1, 4):
        log("TRIGGER", f"ACK Attempt {attempt}/3...")
        log("TRIGGER", f"ACK Payload: {json.dumps(payload)}")

        try:
            res = requests.post(
                f"{SERVER_URL}/api/triggers/pending", json=payload, timeout=10
            )
            log("TRIGGER", f"ACK Response: {res.status_code}")
            if res.status_code == 200:
                log(
                    "TRIGGER",
                    "Acknowledgment successful — server updated last_executed",
                )
                return True
        except Exception as err:
            log("TRIGGER", f"ACK error: {err}")

        log("TRIGGER", "ACK failed, retrying in 1 second...")
        sleep(1000)

    log("TRIGGER", "ACK FAILED after 3 attempts — will use extended safety delay")
    return False


# ============== MAIN LOOP ==============
def main() -> None:
    print("\n=== ZoneMatrix ESP32 Simulator Starting ===")
    print("[VERSION] Using /api/triggers/pending endpoint")
    print(f"[CONFIG] Server: {SERVER_URL}")
    print(f"[CONFIG] Device: {DEVICE_ID} | Zone: {ZONE_ID}")

    register_zone()
    log("SETUP", "Complete")

    last_sensor_send = 0
    last_trigger_poll = 0

    while True:
        now = now_ms()

        if now - last_trigger_poll >= TRIGGER_POLL_INTERVAL_MS:
            check_for_triggers()
            last_trigger_poll = now_ms()

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
