"""
SignFlow FastAPI Computer Vision Service
Handles WebSocket streaming for real-time PSL landmark prediction.
"""

import json
import time
from typing import Dict, Any
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from preprocessing import extract_frame_features
from inference import PSLClassifier

app = FastAPI(
    title="SignFlow CV Inference Service",
    description="WebSocket inference service for Pakistan Sign Language recognition",
    version="1.0.0"
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

@app.get("/")
async def root():
    return {
        "status": "online",
        "service": "SignFlow CV Inference Service",
        "version": "1.0",
        "health_check": "/health",
        "websocket": "/ws/predict",
        "supported_signs": classifier.labels
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "SignFlow CV Inference",
        "version": "1.0",
        "supported_signs": classifier.labels
    }

@app.websocket("/ws/predict")
async def websocket_predict(websocket: WebSocket):
    await websocket.accept()
    default_session_id = f"sess_{int(time.time() * 1000)}"
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
                    "is_candidate": False,
                    "message": "Malformed JSON payload"
                })
                continue

            session_id = frame_data.get("session_id", default_session_id)

            # Explicit session reset message from frontend
            if frame_data.get("type") == "reset":
                await websocket.send_json({
                    "schema_version": "1.0",
                    "session_id": session_id,
                    "frame_id": 0,
                    "timestamp": int(time.time() * 1000),
                    "status": "ready",
                    "sign": None,
                    "confidence": 0.0,
                    "is_candidate": False,
                    "message": "Session reset acknowledged"
                })
                continue

            frame_id = frame_data.get("frame_id", 0)
            timestamp = frame_data.get("timestamp", int(time.time() * 1000))
            hands_detected = frame_data.get("hands_detected", 0)

            # Handle case where no hands are detected
            if hands_detected == 0 or not frame_data.get("hands"):
                response = {
                    "schema_version": "1.0",
                    "session_id": session_id,
                    "frame_id": frame_id,
                    "timestamp": timestamp,
                    "status": "no_hands",
                    "sign": None,
                    "confidence": 0.0,
                    "is_candidate": False,
                    "message": "No hands detected in frame"
                }
                await websocket.send_json(response)
                continue

            # Extract normalized feature vector
            features, status_msg = extract_frame_features(frame_data)
            if features is None:
                response = {
                    "schema_version": "1.0",
                    "session_id": session_id,
                    "frame_id": frame_id,
                    "timestamp": timestamp,
                    "status": "uncertain",
                    "sign": None,
                    "confidence": 0.0,
                    "is_candidate": False,
                    "message": f"Feature extraction issue: {status_msg}"
                }
                await websocket.send_json(response)
                continue

            # Run inference
            pred = classifier.predict(features)

            response = {
                "schema_version": "1.0",
                "session_id": session_id,
                "frame_id": frame_id,
                "timestamp": timestamp,
                "status": pred["status"],
                "sign": pred["sign"],
                "confidence": pred["confidence"],
                "is_candidate": pred["is_candidate"],
                "message": pred.get("message")
            }
            await websocket.send_json(response)

    except WebSocketDisconnect:
        print(f"Client disconnected from /ws/predict [{default_session_id}]")
    except Exception as e:
        print(f"WebSocket session error [{default_session_id}]: {e}")
