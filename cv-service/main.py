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
from temporal_buffer import TemporalBufferManager
from gemini_service import gemini_asl_service, ASLInterpretationResponse

app = FastAPI(
    title="SignFlow CV Inference Service",
    description="WebSocket inference service for American Sign Language (ASL) powered by Google Gemini 2.0 Flash",
    version="2.0.0"
)

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

classifier = PSLClassifier()
temporal_buffer_manager = TemporalBufferManager()

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
        "version": "2.0",
        "active_backend": "gemini" if gemini_asl_service.is_configured() else "legacy_landmarks",
        "gemini": {
            "configured": gemini_asl_service.is_configured(),
            "model": gemini_asl_service.model_name,
        },
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
        "version": "2.0",
        "gemini_configured": gemini_asl_service.is_configured(),
        "gemini_model": gemini_asl_service.model_name,
        "active_backend": "gemini" if gemini_asl_service.is_configured() else "legacy_landmarks",
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

    active_session_id = default_session_id
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
            active_session_id = session_id

            # Explicit session reset message from frontend
            if frame_data.get("type") == "reset":
                prev_wrist_norm = None
                temporal_buffer_manager.get_session_buffer(session_id).clear()
                await websocket.send_json({
                    "schema_version": "2.0",
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
            image_data = frame_data.get("image_data")

            # --- Check Hands Detection First ---
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

            # --- High-Speed Landmark Feature Extraction & Inference (<5ms) ---
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

            # Update tracked wrist position for spatial continuity
            prev_wrist_norm = meta.get("wrist_pos")

            # Run unified inference
            requested_lang = frame_data.get("language", "unified")
            near_boundary = meta.get("near_boundary", False)
            pred = classifier.predict(
                features,
                language=requested_lang,
                near_boundary=near_boundary,
                landmarks=meta.get("landmarks"),
                handedness=meta.get("handedness", "Right"),
            )

            # --- Concurrent Gemini Continuous ASL Window Processing ---
            gemini_emitted = False
            if image_data:
                buf = temporal_buffer_manager.get_session_buffer(session_id)
                buf.add_frame(
                    frame_id=frame_id,
                    timestamp_ms=timestamp,
                    image_data=image_data,
                    hands_detected=hands_detected,
                    metadata={"near_boundary": near_boundary}
                )

                is_pause = frame_data.get("is_boundary_pause", False) or buf.check_boundary_pause(timestamp)
                if buf.is_window_ready(min_interval_ms=1000, min_frames=3) or (is_pause and len(buf.frames) >= 3):
                    window = buf.get_overlapping_window(min_frames=3)
                    if window:
                        seq_id, w_frames, start_ts, end_ts = window
                        asl_res = await gemini_asl_service.interpret_asl_window(
                            sequence_id=seq_id,
                            frames=w_frames,
                            start_ts=start_ts,
                            end_ts=end_ts,
                            previous_context=frame_data.get("context_sentence"),
                            is_boundary_pause=is_pause
                        )

                        # Emit Gemini sentence if it recognized communicative text
                        if (
                            asl_res.status in ("complete", "partial")
                            and asl_res.recognized_text
                            and asl_res.recognized_text.strip()
                        ):
                            response = {
                                "schema_version": "2.0",
                                "session_id": session_id,
                                "sequence_id": asl_res.sequence_id,
                                "frame_id": frame_id,
                                "timestamp": timestamp,
                                "status": asl_res.status,
                                "recognized_text": asl_res.recognized_text,
                                "sign": asl_res.recognized_text,
                                "confidence": 0.95 if asl_res.status == "complete" else 0.80,
                                "alternatives": asl_res.alternatives,
                                "uncertainty_reason": asl_res.uncertainty_reason,
                                "observations": asl_res.observations,
                                "start_timestamp_ms": asl_res.start_timestamp_ms,
                                "end_timestamp_ms": asl_res.end_timestamp_ms,
                                "hands_count": hands_detected,
                                "language": "asl_continuous",
                                "backend": "gemini",
                                "model": gemini_asl_service.model_name
                            }
                            await websocket.send_json(response)
                            gemini_emitted = True

            if not gemini_emitted:
                # Emit instantaneous, high-speed landmark prediction (<5ms)
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
        print(f"Client disconnected from /ws/predict [{active_session_id}]")
    except Exception as e:
        print(f"WebSocket session error [{active_session_id}]: {e}")
    finally:
        temporal_buffer_manager.remove_session(active_session_id)
        if active_session_id != default_session_id:
            temporal_buffer_manager.remove_session(default_session_id)

