import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health_check_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "supported_signs" in data
    assert "available_languages" in data
    assert "psl_words" in data["available_languages"]
    assert "psl_alphabets" in data["available_languages"]
    assert "asl" in data["available_languages"]

def test_websocket_no_hands():
    with client.websocket_connect("/ws/predict") as websocket:
        payload = {
            "schema_version": "1.0",
            "session_id": "test_sess_123",
            "frame_id": 10,
            "timestamp": 1234567,
            "image_width": 1280,
            "image_height": 720,
            "hands_detected": 0,
            "hands": []
        }
        websocket.send_json(payload)
        response = websocket.receive_json()
        assert response["status"] == "no_hands"
        assert response["frame_id"] == 10
        assert response["session_id"] == "test_sess_123"

def test_websocket_session_reset():
    with client.websocket_connect("/ws/predict") as websocket:
        payload = {
            "type": "reset",
            "session_id": "test_sess_reset_999"
        }
        websocket.send_json(payload)
        response = websocket.receive_json()
        assert response["status"] == "ready"
        assert response["session_id"] == "test_sess_reset_999"
        assert "Session reset acknowledged" in response["message"]

def test_websocket_valid_landmarks_psl_words():
    with client.websocket_connect("/ws/predict") as websocket:
        landmarks = [{"x": 0.5 + i * 0.01, "y": 0.5 + i * 0.01, "z": 0.0} for i in range(21)]
        payload = {
            "schema_version": "1.0",
            "session_id": "test_sess_psl_words",
            "frame_id": 42,
            "timestamp": 12345678,
            "language": "psl_words",
            "image_width": 1280,
            "image_height": 720,
            "hands_detected": 1,
            "hands": [{"handedness": "Right", "score": 0.95, "landmarks": landmarks}]
        }
        websocket.send_json(payload)
        response = websocket.receive_json()
        assert response["schema_version"] == "1.0"
        assert response["session_id"] == "test_sess_psl_words"
        assert response["status"] in ["recognized", "candidate", "uncertain"]
        assert response["language"] == "psl_words"

def test_websocket_valid_landmarks_psl_alphabets():
    with client.websocket_connect("/ws/predict") as websocket:
        landmarks = [{"x": 0.5 + i * 0.01, "y": 0.5 + i * 0.01, "z": 0.0} for i in range(21)]
        payload = {
            "schema_version": "1.0",
            "session_id": "test_sess_psl_alphabets",
            "frame_id": 43,
            "timestamp": 12345679,
            "language": "psl_alphabets",
            "image_width": 1280,
            "image_height": 720,
            "hands_detected": 1,
            "hands": [{"handedness": "Right", "score": 0.95, "landmarks": landmarks}]
        }
        websocket.send_json(payload)
        response = websocket.receive_json()
        assert response["status"] in ["recognized", "candidate", "uncertain"]
        assert response["language"] == "psl_alphabets"

def test_websocket_valid_landmarks_asl():
    with client.websocket_connect("/ws/predict") as websocket:
        landmarks = [{"x": 0.5 + i * 0.01, "y": 0.5 + i * 0.01, "z": 0.0} for i in range(21)]
        payload = {
            "schema_version": "1.0",
            "session_id": "test_sess_asl",
            "frame_id": 44,
            "timestamp": 12345680,
            "language": "asl",
            "image_width": 1280,
            "image_height": 720,
            "hands_detected": 1,
            "hands": [{"handedness": "Right", "score": 0.95, "landmarks": landmarks}]
        }
        websocket.send_json(payload)
        response = websocket.receive_json()
        assert response["status"] in ["recognized", "candidate", "uncertain"]
        assert response["language"] == "asl"

def test_websocket_valid_landmarks_psl_extended():
    with client.websocket_connect("/ws/predict") as websocket:
        landmarks = [{"x": 0.5 + i * 0.01, "y": 0.5 + i * 0.01, "z": 0.0} for i in range(21)]
        payload = {
            "schema_version": "1.0",
            "session_id": "test_sess_ext",
            "frame_id": 55,
            "timestamp": 12345690,
            "language": "psl_extended",
            "image_width": 1280,
            "image_height": 720,
            "hands_detected": 1,
            "hands": [{"handedness": "Right", "score": 0.95, "landmarks": landmarks}]
        }
        websocket.send_json(payload)
        response = websocket.receive_json()
        assert response["status"] in ["recognized", "candidate", "uncertain"]
        assert response["language"] == "psl_extended"
        assert "margin" in response
        assert "top_candidates" in response

def test_record_feedback_sample_and_stats():
    sample_payload = {
        "sample_id": f"fb_test_{int(pytest.__version__.replace('.', ''))}",
        "session_id": "test_sess_feedback",
        "timestamp": 1234567890,
        "language": "psl_extended",
        "predicted_label": "Assalamulaikum",
        "true_label": "Walaikumasalam",
        "confidence": 0.62,
        "margin": 0.05,
        "review_status": "pending_review",
        "notes": "Chirality test sample",
        "features": [0.0] * 63
    }
    res = client.post("/api/feedback/sample", json=sample_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["sample_id"] == sample_payload["sample_id"]

    stats_res = client.get("/api/feedback/stats")
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert stats["total_samples"] >= 1
    assert stats["pending_review"] >= 1




