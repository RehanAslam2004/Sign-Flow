"""
SignFlow FastAPI Computer Vision Service
Handles WebSocket streaming for real-time PSL landmark prediction,
calibrated uncertainty, multi-hand spatial tracking, and failure sample collection.
"""

import os
import json
import time
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from preprocessing import extract_frame_features_extended, extract_frame_features
from inference import PSLClassifier

app = FastAPI(
    title="SignFlow CV Inference Service",
    description="WebSocket inference service for American Sign Language (ASL) and Pakistan Sign Language (PSL)",
    version="1.1.0"
)

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

classifier = PSLClassifier()

# Data directory for reviewed failure samples
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
FEEDBACK_FILE = os.path.join(DATA_DIR, "reviewed_samples.jsonl")
os.makedirs(DATA_DIR, exist_ok=True)


class FeedbackSampleModel(BaseModel):
    sample_id: str
    session_id: str
    timestamp: int
    language: str
    predicted_label: Optional[str] = None
    true_label: str
    confidence: float
    margin: Optional[float] = None
    review_status: str = Field(default="pending_review")
    notes: Optional[str] = None
    features: Optional[List[float]] = None
    landmarks: Optional[List[Dict[str, float]]] = None


@app.get("/")
async def root():
    return {
        "status": "online",
        "service": "SignFlow CV Inference Service",
        "version": "1.1",
        "available_languages": list(classifier.models.keys()),
        "models_loaded": {k: True for k in classifier.models.keys()},
        "supported_signs": classifier.labels_map,
        "calibration": {
            "confidence_threshold": classifier.confidence_threshold,
            "margin_threshold": classifier.margin_threshold,
            "candidate_threshold": classifier.candidate_threshold,
        },
        "health_check": "/health",
        "websocket": "/ws/predict",
        "feedback_api": "/api/feedback/sample",
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "SignFlow CV Inference",
        "version": "1.1",
        "available_languages": list(classifier.models.keys()),
        "models_loaded": {k: True for k in classifier.models.keys()},
        "supported_signs": classifier.labels_map
    }


# ---------------------------------------------------------------------------
# Feedback & Failure Collection APIs
# ---------------------------------------------------------------------------

@app.post("/api/feedback/sample")
async def record_feedback_sample(sample: FeedbackSampleModel):
    """
    Records a user-reported or developer-flagged failure example.
    Stores landmarks/features and label metadata in JSONL format for future training review.
    Does NOT store camera video or raw images.
    """
    record = sample.model_dump()
    try:
        with open(FEEDBACK_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
        return {"status": "success", "sample_id": sample.sample_id, "message": "Feedback sample recorded"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to record feedback sample: {str(e)}")


@app.get("/api/feedback/stats")
async def get_feedback_stats():
    """
    Returns counts of pending, verified, and rejected failure samples.
    """
    if not os.path.exists(FEEDBACK_FILE):
        return {"total_samples": 0, "pending_review": 0, "verified": 0, "rejected": 0}

    stats = {"total_samples": 0, "pending_review": 0, "verified": 0, "rejected": 0}
    try:
        with open(FEEDBACK_FILE, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                stats["total_samples"] += 1
                try:
                    data = json.loads(line)
                    status = data.get("review_status", "pending_review")
                    if status in stats:
                        stats[status] += 1
                except json.JSONDecodeError:
                    pass
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read feedback stats: {str(e)}")


# ---------------------------------------------------------------------------
# WebSocket Streaming Inference Loop
# ---------------------------------------------------------------------------

@app.websocket("/ws/predict")
async def websocket_predict(websocket: WebSocket):
    await websocket.accept()
    default_session_id = f"sess_{int(time.time() * 1000)}"
    prev_wrist_norm: Optional[tuple] = None
    print(f"Client connected to /ws/predict [{default_session_id}]")

    try:
        while True:
            # Receive raw text JSON frame from frontend
            raw_data = await websocket.receive_text()
            try:
                frame_data = json.loads(raw_data)
            except json.JSONDecodeError:
                await websocket.send_json({
                    "schema_version": "1.0",
                    "session_id": default_session_id,
                    "frame_id": 0,
                    "timestamp": int(time.time() * 1000),
                    "status": "error",
                    "sign": None,
                    "confidence": 0.0,
                    "margin": 0.0,
                    "is_candidate": False,
                    "rejection_reason": "malformed_json",
                    "message": "Malformed JSON payload"
                })
                continue

            session_id = frame_data.get("session_id", default_session_id)

            # Explicit session reset message from frontend
            if frame_data.get("type") == "reset":
                prev_wrist_norm = None
                await websocket.send_json({
                    "schema_version": "1.0",
                    "session_id": session_id,
                    "frame_id": 0,
                    "timestamp": int(time.time() * 1000),
                    "status": "ready",
                    "sign": None,
                    "confidence": 0.0,
                    "margin": 0.0,
                    "is_candidate": False,
                    "rejection_reason": None,
                    "message": "Session reset acknowledged"
                })
                continue

            frame_id = frame_data.get("frame_id", 0)
            timestamp = frame_data.get("timestamp", int(time.time() * 1000))
            hands_detected = frame_data.get("hands_detected", 0)

            # Handle case where no hands are detected
            if hands_detected == 0 or not frame_data.get("hands"):
                prev_wrist_norm = None
                response = {
                    "schema_version": "1.0",
                    "session_id": session_id,
                    "frame_id": frame_id,
                    "timestamp": timestamp,
                    "status": "no_hands",
                    "sign": None,
                    "confidence": 0.0,
                    "margin": 0.0,
                    "is_candidate": False,
                    "hands_count": 0,
                    "rejection_reason": "no_hands",
                    "message": "No hands detected in frame"
                }
                await websocket.send_json(response)
                continue

            # Extract normalized feature vector with spatial continuity
            features, status_msg, meta = extract_frame_features_extended(frame_data, prev_wrist_norm)
            if features is None:
                response = {
                    "schema_version": "1.0",
                    "session_id": session_id,
                    "frame_id": frame_id,
                    "timestamp": timestamp,
                    "status": "uncertain",
                    "sign": None,
                    "confidence": 0.0,
                    "margin": 0.0,
                    "is_candidate": False,
                    "hands_count": meta.get("hands_count", hands_detected),
                    "rejection_reason": "tracking_loss",
                    "message": f"Feature extraction issue: {status_msg}"
                }
                await websocket.send_json(response)
                continue

            # Update tracked wrist position for spatial continuity in next frame
            prev_wrist_norm = meta.get("wrist_pos")

            # Run unified inference (defaults to unified mode)
            requested_lang = frame_data.get("language", "unified")
            near_boundary = meta.get("near_boundary", False)
            pred = classifier.predict(
                features,
                language=requested_lang,
                near_boundary=near_boundary,
                landmarks=meta.get("landmarks"),
                handedness=meta.get("handedness", "Right"),
            )

            response = {
                "schema_version": "1.0",
                "session_id": session_id,
                "frame_id": frame_id,
                "timestamp": timestamp,
                "status": pred["status"],
                "sign": pred["sign"],
                "confidence": pred["confidence"],
                "margin": pred.get("margin", 0.0),
                "top_candidates": pred.get("top_candidates", []),
                "is_candidate": pred["is_candidate"],
                "language": pred.get("language", requested_lang),
                "rejection_reason": pred.get("rejection_reason"),
                "hands_count": meta.get("hands_count", hands_detected),
                "handedness": meta.get("handedness", "Right"),
                "inference_latency_ms": pred.get("inference_latency_ms", 0.0),
                "message": pred.get("message")
            }
            await websocket.send_json(response)

    except WebSocketDisconnect:
        print(f"Client disconnected from /ws/predict [{default_session_id}]")
    except Exception as e:
        print(f"WebSocket session error [{default_session_id}]: {e}")
