/*
  ESP32 - Production Hardware Code (Updated)

  Hardware Setup:
  ================================
  POWER:
  - Power Supply Module: 5V rail (servo, ultrasonic) + 3.3V rail (DHT11, PH, ESP32 logic)
  - Common GND: Power Module GND connected to ESP32 GND

  SENSORS (Input - Left Side / ADC Cluster):
  - pH Sensor (HW-828): Po -> GPIO 34 (Analog), VCC -> 3.3V, GND -> GND
  - DHT11 (Temp & Humidity): Data -> GPIO 32, VCC -> 3.3V, GND -> GND
  - Ultrasonic (HC-SR04): Trig -> GPIO 33, Echo -> GPIO 25 ,VCC -> 5V, GND -> GND.

  OUTPUTS (Right Side / PWM Cluster):
  - Servo 9g: Signal -> GPIO 13, VCC -> 5V, GND -> GND
  - Blue LED: Anode -> 220Ω -> GPIO 12, Cathode -> GND
  - Yellow LED: Anode -> 220Ω -> GPIO 14, Cathode -> GND

  LED Behavior:
  - Inbuilt LED (GPIO 2): Solid ON = WiFi connected, OFF = Disconnected
  - Blue LED (GPIO 12): Flashes when sending sensor data
  - Yellow LED (GPIO 14): Solid ON during feeding

  WiFi: Flip4 / homemade
  Server: 192.168.1.175:3000
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <ESP32Servo.h>

// ============== PIN DEFINITIONS ==============
const int LED_INBUILT = 2;
const int LED_BLUE = 14;
const int LED_YELLOW = 12;
const int SERVO_PIN = 13;
const int DHT_PIN = 32;
const int DHT_TYPE = DHT11;
const int PH_PIN = 34;
const int TRIG_PIN = 33;
const int ECHO_PIN = 25;

// ============== CONNECTION & IDENTITY ==============
const char* WIFI_SSID = "Flip4";
const char* WIFI_PASSWORD = "homemade";
const char* SERVER_IP = "10.89.126.125";
const int SERVER_PORT = 3000;
const char* DEVICE_ID = "ESP32_POND_001";
const char* POND_ID = "P001";

// Pond registration details (used on first boot to create pond if missing)
const char* POND_NAME = "Main Pond A1";
const char* POND_LOCATION = "Domasi";
const char* POND_SIZE = "500";   // square meters
const char* POND_DEPTH = "1.5";  // meters
const char* POND_SPECIES = "Chambo";

// ============== TIMING ==============
const unsigned long SENSOR_INTERVAL = 10000;       // Send sensor data every 10 seconds
const unsigned long FEEDING_POLL_INTERVAL = 2000;  // Poll for feeding commands every 2 seconds

// ============== CALIBRATION ==============
// pH: Adjust OFFSET to shift reading up/down. SLOPE controls sensitivity.
const float PH_SLOPE = 5.71;
const float PH_OFFSET = -8.12;

// Water Level: Distance from the sensor face down to the pond floor (in cm).
const float SENSOR_MOUNT_HEIGHT_CM = 200.0;  // e.g. 200 cm = 2.0 m

// Feeder: Change angle or milliseconds to control how much feed drops.
const int SERVO_OPEN_ANGLE = 25;
const int SERVO_CLOSE_ANGLE = 0;
const int SERVO_PULSE_OPEN_MS = 150;
const int SERVO_PULSE_CLOSE_MS = 200;

// ============== GLOBALS ==============
WiFiClient client;
HTTPClient http;
DHT dht(DHT_PIN, DHT_TYPE);
Servo feedingServo;

unsigned long lastSensorSend = 0;
unsigned long lastFeedingPoll = 0;
bool isFeeding = false;
unsigned long lastFeedingTime = 0;  // Track when feeding last occurred
const unsigned long MIN_FEED_INTERVAL = 30000; // Minimum 30 seconds between feedings (safety)

float currentTemperature = 0;
float currentHumidity = 0;
float currentPH = 7.0;
float currentWaterLevel = 0;  // stored internally in METERS

// ============== SETUP ==============
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n=== Pond Monitor ESP32 Starting [v2.1-PENDING-API] ===");
  Serial.println("[VERSION] Using /api/feeding/pending endpoint");
  // Pin modes
  pinMode(LED_INBUILT, OUTPUT);
  pinMode(LED_BLUE, OUTPUT);
  pinMode(LED_YELLOW, OUTPUT);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(PH_PIN, INPUT);
  // LED startup flash
  testLEDs();
  dht.begin();
  feedingServo.attach(SERVO_PIN);
  feedingServo.write(SERVO_CLOSE_ANGLE);
  // ADC resolution fix: 12-bit (0-4095), full 3.3V range
  analogReadResolution(12);
  analogSetPinAttenuation(PH_PIN, ADC_11db);
  //
  connectToWiFi();
  registerPond();
  Serial.println("[SETUP] Complete");
}

// ============== MAIN LOOP ==============
void loop() {
  // WiFi watchdog: if connection drops, reconnect before doing anything
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WIFI] Connection lost — reconnecting...");
    digitalWrite(LED_INBUILT, LOW);
    connectToWiFi();
    return;
  }
  digitalWrite(LED_INBUILT, HIGH);  // Solid ON = connected

  // Poll for feeding commands (high frequency, 2s)
  if (millis() - lastFeedingPoll >= FEEDING_POLL_INTERVAL) {
    checkForFeedingCommands();
    lastFeedingPoll = millis();
  }

  // Read and send sensor data (every 10s)
  if (millis() - lastSensorSend >= SENSOR_INTERVAL) {
    readAllSensors();
    sendSensorData();
    lastSensorSend = millis();
  }
}

// ============== WIFI ==============
// Blocking connect — loops until WiFi is up. Avoids the hang bug from
// attempt-limited versions that could exit the function still disconnected.
void connectToWiFi() {
  Serial.print("[WIFI] Connecting to ");
  Serial.print(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n[WIFI] Connected. IP: " + WiFi.localIP().toString());
  digitalWrite(LED_INBUILT, HIGH);
}

// ============== LED HELPERS ==============
void testLEDs() {
  Serial.println("[LED] Running startup test...");
  digitalWrite(LED_INBUILT, HIGH);
  delay(300);
  digitalWrite(LED_INBUILT, LOW);
  for (int i = 0; i < 2; i++) {
    digitalWrite(LED_BLUE, HIGH);
    delay(200);
    digitalWrite(LED_BLUE, LOW);
    delay(200);
  }
  for (int i = 0; i < 3; i++) {
    digitalWrite(LED_YELLOW, HIGH);
    delay(150);
    digitalWrite(LED_YELLOW, LOW);
    delay(150);
  }
  Serial.println("[LED] Test complete");
}

// ============== SENSOR READING ==============
void readAllSensors() {
  Serial.println("[SENSOR] Reading...");

  // DHT11 — retry once on failure
  currentTemperature = dht.readTemperature();
  currentHumidity = dht.readHumidity();
  if (isnan(currentTemperature) || isnan(currentHumidity)) {
    Serial.println("[SENSOR] DHT11 failed — retrying...");
    delay(2000);
    currentTemperature = dht.readTemperature();
    currentHumidity = dht.readHumidity();
    if (isnan(currentTemperature) || isnan(currentHumidity)) {
      Serial.println("[SENSOR] DHT11 still failed — using safe defaults");
      currentTemperature = 25.0;
      currentHumidity = 60.0;
    }
  }

  currentPH = readPHSensor();
  currentWaterLevel = readWaterLevel();  // returns meters

  Serial.printf("[SENSOR] Temp: %.1fC | Humidity: %.1f%% | pH: %.2f | Water Level: %.3fm\n",
                currentTemperature, currentHumidity, currentPH, currentWaterLevel);
}

// pH averaged over 30 samples for stability. ADC fix applied in setup().
float readPHSensor() {
  long sum = 0;
  for (int i = 0; i < 30; i++) {
    sum += analogRead(PH_PIN);
    delay(10);
  }
  float averageRaw = sum / 30.0;
  float voltage = averageRaw * (3.3 / 4095.0);
  float ph = (PH_SLOPE * voltage) + PH_OFFSET;

  Serial.printf("[PH] AvgRaw: %.1f | Voltage: %.3fV | pH: %.2f\n", averageRaw, voltage, ph);

  return constrain(ph, 0.0, 14.0);
}

// Water level measured in cm internally, returned as meters.
// Sensor measures distance DOWN to water surface. We subtract from mount height.
float readWaterLevel() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long bounceTime = pulseIn(ECHO_PIN, HIGH, 30000);  // 30ms timeout
  if (bounceTime == 0) {
    Serial.println("[SENSOR] Ultrasonic — no echo");
    return 0.0;
  }

  // Distance to water surface in cm
  float distanceCm = (bounceTime * 0.0343) / 2.0;

  // Water depth in cm (mount height minus air gap)
  float waterDepthCm = SENSOR_MOUNT_HEIGHT_CM - distanceCm;

  // Convert cm → meters for transmission
  float waterDepthM = waterDepthCm / 100.0;

  return constrain(waterDepthM, 0.0, 5.0);
}

// ============== POND REGISTRATION ==============
// Called once at startup. Creates the pond record if it doesn't exist.
void registerPond() {
  Serial.println("[POND] Registering with server...");

  // Both LEDs blink during registration
  for (int i = 0; i < 5; i++) {
    digitalWrite(LED_BLUE, HIGH);
    digitalWrite(LED_YELLOW, HIGH);
    delay(100);
    digitalWrite(LED_BLUE, LOW);
    digitalWrite(LED_YELLOW, LOW);
    delay(100);
  }

  StaticJsonDocument<512> doc;
  doc["id"] = POND_ID;
  doc["name"] = POND_NAME;
  doc["location"] = POND_LOCATION;
  doc["size"] = POND_SIZE;
  doc["depth"] = POND_DEPTH;
  doc["species"] = POND_SPECIES;
  doc["device_id"] = DEVICE_ID;
  doc["is_hardware_registration"] = true;

  char jsonBuffer[512];
  serializeJson(doc, jsonBuffer);

  String url = "http://" + String(SERVER_IP) + ":" + String(SERVER_PORT) + "/api/ponds";

  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(jsonBuffer);

  if (code == 200 || code == 201) {
    Serial.println("[POND] Registered successfully");
  } else {
    Serial.print("[POND] Registration failed. HTTP: ");
    Serial.println(code);
  }
  http.end();
}

// ============== SENSOR DATA TRANSMISSION ==============
void sendSensorData() {
  Serial.println("[HTTP] Sending sensor data...");
  digitalWrite(LED_BLUE, HIGH);

  StaticJsonDocument<256> doc;
  doc["device_id"] = DEVICE_ID;
  doc["pondId"] = POND_ID;
  doc["temp"] = currentTemperature;
  doc["ph"] = currentPH;
  doc["humidity"] = currentHumidity;
  doc["level"] = currentWaterLevel;  // already in meters

  String json;
  serializeJson(doc, json);
  Serial.println("[HTTP] Payload: " + json);

  String url = "http://" + String(SERVER_IP) + ":" + String(SERVER_PORT) + "/api/sensors";

  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(json);

  Serial.print("[HTTP] Response: ");
  Serial.println(code);

  if (code != 200) {
    // Brief yellow flash on failure
    digitalWrite(LED_YELLOW, HIGH);
    delay(500);
    digitalWrite(LED_YELLOW, LOW);
  }
  http.end();
  digitalWrite(LED_BLUE, LOW);
}

// ============== FEEDING ==============
void checkForFeedingCommands() {
  if (isFeeding) return;

  // Safety check: prevent feeding if we just fed recently (30 second minimum)
  if (millis() - lastFeedingTime < MIN_FEED_INTERVAL && lastFeedingTime > 0) {
    return;
  }

  String url = "http://" + String(SERVER_IP) + ":" + String(SERVER_PORT) + "/api/feeding/pending?pondId=" + POND_ID + "&deviceId=" + DEVICE_ID;

  http.begin(url);
  int httpCode = http.GET();
  if (httpCode == 200) {
    String response = http.getString();
    Serial.println("[FEED POLL] Response: " + response);

    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, response);

    if (error) {
      Serial.print("[FEED POLL] JSON parse failed: ");
      Serial.println(error.c_str());
      http.end();
      return;
    }

    JsonArray manual = doc["manualTriggers"];
    JsonArray scheduled = doc["scheduledFeedings"];

    Serial.printf("[FEED POLL] Manual triggers: %d, Scheduled: %d\n", manual.size(), scheduled.size());

    if (manual.size() > 0) {
      String recordId = manual[0]["id"].as<String>();
      Serial.println("[FEED] Manual trigger received. Feeding...");
      performFeeding();
      bool ackSuccess = acknowledgeFeedingComplete(recordId, false);  // false = manual trigger (logId)
      if (!ackSuccess) {
        // Force longer safety delay on ack failure to prevent re-trigger
        lastFeedingTime = millis() + 60000; // Add extra minute
        Serial.println("[FEED] Manual ACK failed - extended safety delay applied");
      }
    } else if (scheduled.size() > 0) {
      // Interval-based scheduled feedings
      String recordId = scheduled[0]["id"].as<String>();
      int intervalMinutes = scheduled[0]["interval_minutes"].as<int>();
      Serial.printf("[FEED] Interval schedule triggered (every %d min). Feeding...\n", intervalMinutes);
      performFeeding();
      bool ackSuccess = acknowledgeFeedingComplete(recordId, true);  // true = schedule (scheduleId)
      if (!ackSuccess) {
        // Force longer safety delay on ack failure to prevent re-trigger
        lastFeedingTime = millis() + 60000; // Add extra minute
        Serial.println("[FEED] Schedule ACK failed - extended safety delay applied");
      }
    } else {
      Serial.println("[FEED POLL] No pending feedings");
    }
  } else {
    Serial.printf("[FEED POLL] HTTP error: %d\n", httpCode);
  }
  http.end();
}

// Simple one-shot feeding: open servo, wait, close. No gram calculations.
void performFeeding() {
  isFeeding = true;
  lastFeedingTime = millis();  // Record when we fed
  Serial.println("[FEED] Dispensing feed...");
  digitalWrite(LED_YELLOW, HIGH);

  feedingServo.write(SERVO_OPEN_ANGLE);
  delay(SERVO_PULSE_OPEN_MS);

  feedingServo.write(SERVO_CLOSE_ANGLE);
  delay(SERVO_PULSE_CLOSE_MS);

  digitalWrite(LED_YELLOW, LOW);
  isFeeding = false;
  Serial.println("[FEED] Done. Fish have been fed.");
}

// Report feeding completion back to the server with retry logic
bool acknowledgeFeedingComplete(String recordId, bool isSchedule) {
  Serial.println("[FEED] Acknowledging completion...");

  String url = "http://" + String(SERVER_IP) + ":" + String(SERVER_PORT) + "/api/feeding/pending";

  StaticJsonDocument<256> doc;
  doc["deviceId"] = DEVICE_ID;
  doc["pondId"] = POND_ID;
  doc["status"] = "completed";

  if (isSchedule) {
    doc["scheduleId"] = recordId;
  } else {
    doc["logId"] = recordId;
  }

  String json;
  serializeJson(doc, json);

  // Retry up to 3 times
  for (int attempt = 1; attempt <= 3; attempt++) {
    Serial.printf("[FEED] ACK Attempt %d/3...\n", attempt);
    Serial.println("[FEED] ACK Payload: " + json);

    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    int code = http.POST(json);
    http.end();

    Serial.printf("[FEED] ACK Response: %d\n", code);

    if (code == 200) {
      Serial.println("[FEED] Acknowledgment successful - server updated last_executed");
      return true;
    }

    Serial.printf("[FEED] ACK failed, retrying in 1 second...\n");
    delay(1000);
  }

  Serial.println("[FEED] ACK FAILED after 3 attempts - will use extended safety delay");
  return false;
}
