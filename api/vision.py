"""Vision and AI Stage Prediction router for ZoneMatrix.

Level 1 AI & System Progression:
- Decodes image bytes directly using OpenCV (cv2.imdecode).
- Resizes to (224, 224) and normalizes pixel values to [0.0, 1.0] as a (1, 224, 224, 3) tensor.
- Performs forward-pass inference using the pretrained 'growth_stage_model.h5' via tf_keras.
- Maps softmax outputs to stage classes: 'seedling', 'vegetative', 'fruiting'.
- Stores frames in 'captured_frames' and inferences in 'stage_predictions'.
- Provides human-in-the-loop endpoint (/validate) to record whether the AI 'nailed it' (true/false)
  for future model retraining.
"""

from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

import cv2
import numpy as np
import tf_keras as keras
from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from pydantic import BaseModel

from api import db
from api.errors import api_error

router = APIRouter(prefix="/api/zones", tags=["vision"])

UPLOAD_DIR = os.path.join("uploads", "frames")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Stage labels matching the 3 output units of growth_stage_model.h5
GROWTH_STAGE_LABELS = ["seedling", "vegetative", "fruiting"]


class ModelEngine:
    _instance: Optional[ModelEngine] = None
    _model = None

    @classmethod
    def get_model(cls):
        if cls._model is None:
            model_path = os.path.join("models", "growth_stage_model.h5")
            print(f"[AI Vision] Loading growth stage model from: {model_path}...")
            cls._model = keras.models.load_model(model_path, compile=False)
            print(f"[AI Vision] Model loaded successfully: input={cls._model.input_shape}, output={cls._model.output_shape}")
        return cls._model

    @classmethod
    def predict(cls, image_bytes: bytes) -> dict:
        # 1. Decode compressed image bytes into OpenCV matrix (BGR format)
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Failed to decode image with OpenCV")

        # 2. Resize to 224x224 (the required input dimension)
        img_resized = cv2.resize(img, (224, 224), interpolation=cv2.INTER_AREA)

        # 3. Convert BGR -> RGB and normalize integer pixels [0, 255] -> float32 [0.0, 1.0]
        img_rgb = cv2.cvtColor(img_resized, cv2.COLOR_BGR2RGB)
        img_norm = img_rgb.astype(np.float32) / 255.0

        # 4. Reshape to Batch Tensor (1, 224, 224, 3)
        tensor = np.expand_dims(img_norm, axis=0)

        # 5. Model forward pass inference
        model = cls.get_model()
        raw_preds = model.predict(tensor, verbose=0)[0]

        top_idx = int(np.argmax(raw_preds))
        confidence = float(raw_preds[top_idx]) * 100.0
        predicted_stage = GROWTH_STAGE_LABELS[top_idx] if top_idx < len(GROWTH_STAGE_LABELS) else "unknown"

        probabilities = {
            GROWTH_STAGE_LABELS[i] if i < len(GROWTH_STAGE_LABELS) else f"class_{i}": round(float(raw_preds[i]), 4)
            for i in range(len(raw_preds))
        }

        return {
            "predicted_stage": predicted_stage,
            "confidence": round(confidence, 2),
            "probabilities": probabilities,
        }


@router.post("/{zone_id}/capture")
async def capture_and_predict(
    zone_id: str,
    file: UploadFile = File(...),
    source: str = Query("expo_camera_auto", description="Capture source")
):
    """Receive photo from Expo Camera, decode with OpenCV, infer stage, and persist prediction."""
    try:
        # Check zone existence
        zone = db.query_one("SELECT id, name, zone_type, subject_name FROM zones WHERE id = ?", [zone_id])
        if not zone:
            return api_error(404, f"Zone '{zone_id}' not found")

        # Read image contents
        contents = await file.read()
        if not contents:
            return api_error(400, "Empty image file received")

        # Save to disk
        filename = f"{zone_id}_{uuid.uuid4().hex[:8]}_{file.filename or 'frame.jpg'}"
        file_path = os.path.join(UPLOAD_DIR, filename)
        with open(file_path, "wb") as f:
            f.write(contents)

        image_url = f"/uploads/frames/{filename}"

        # Run OpenCV & Keras prediction
        prediction_result = ModelEngine.predict(contents)

        # Save to database: captured_frames
        frame_res = db.execute(
            """
            INSERT INTO captured_frames (zone_id, image_url, source)
            VALUES (?, ?, ?)
            """,
            [zone_id, image_url, source]
        )
        frame_id = frame_res.get("insertId")

        # Save to database: stage_predictions
        pred_res = db.execute(
            """
            INSERT INTO stage_predictions (frame_id, zone_id, model_name, predicted_stage, confidence, raw_probabilities)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            [
                frame_id,
                zone_id,
                "growth_stage_model.h5",
                prediction_result["predicted_stage"],
                prediction_result["confidence"],
                json.dumps(prediction_result["probabilities"]),
            ]
        )
        prediction_id = pred_res.get("insertId")

        return {
            "success": True,
            "zone_id": zone_id,
            "zone_name": zone["name"],
            "subject_name": zone.get("subject_name"),
            "frame_id": frame_id,
            "image_url": image_url,
            "prediction": {
                "id": prediction_id,
                "predicted_stage": prediction_result["predicted_stage"],
                "confidence": prediction_result["confidence"],
                "probabilities": prediction_result["probabilities"],
                "nailed_it": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        }
    except ValueError as ve:
        return api_error(400, str(ve))
    except Exception as exc:
        print(f"[Vision Error] {exc}")
        return api_error(500, f"Inference pipeline error: {exc}")


@router.post("/vision/predictions/{prediction_id}/validate")
async def validate_prediction(prediction_id: int, nailed_it: bool = Query(...)):
    """Human-in-the-Loop feedback: Record whether the AI 'nailed it' (true) or 'missed it' (false)."""
    try:
        res = db.execute(
            """
            UPDATE stage_predictions
            SET nailed_it = ?, validated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            [nailed_it, prediction_id]
        )
        if res.get("affectedRows", 0) == 0:
            return api_error(404, f"Prediction with ID {prediction_id} not found")

        return {
            "success": True,
            "prediction_id": prediction_id,
            "nailed_it": nailed_it,
            "message": "Human validation successfully recorded. Stored for model retraining."
        }
    except Exception as exc:
        return api_error(500, f"Failed to record validation: {exc}")


@router.get("/{zone_id}/predictions/latest")
async def get_latest_prediction(zone_id: str):
    """Retrieve the most recent prediction and image frame for a given zone."""
    try:
        row = db.query_one(
            """
            SELECT p.id, p.zone_id, p.model_name, p.predicted_stage, p.confidence,
                   p.raw_probabilities, p.nailed_it, p.created_at, p.validated_at,
                   f.image_url, f.source
            FROM stage_predictions p
            JOIN captured_frames f ON p.frame_id = f.id
            WHERE p.zone_id = ?
            ORDER BY p.created_at DESC
            LIMIT 1
            """,
            [zone_id]
        )
        if not row:
            return {"prediction": None}

        # Parse JSON probabilities if string
        if isinstance(row.get("raw_probabilities"), str):
            row["raw_probabilities"] = json.loads(row["raw_probabilities"])

        return {"prediction": row}
    except Exception as exc:
        return api_error(500, f"Failed to fetch latest prediction: {exc}")


@router.get("/{zone_id}/predictions")
async def list_zone_predictions(zone_id: str, limit: int = 20):
    """Retrieve history of vision predictions for a zone."""
    try:
        rows = db.query(
            """
            SELECT p.id, p.zone_id, p.model_name, p.predicted_stage, p.confidence,
                   p.raw_probabilities, p.nailed_it, p.created_at, p.validated_at,
                   f.image_url, f.source
            FROM stage_predictions p
            JOIN captured_frames f ON p.frame_id = f.id
            WHERE p.zone_id = ?
            ORDER BY p.created_at DESC
            LIMIT ?
            """,
            [zone_id, limit]
        )
        for r in rows:
            if isinstance(r.get("raw_probabilities"), str):
                r["raw_probabilities"] = json.loads(r["raw_probabilities"])

        return {"predictions": rows}
    except Exception as exc:
        return api_error(500, f"Failed to list predictions: {exc}")

