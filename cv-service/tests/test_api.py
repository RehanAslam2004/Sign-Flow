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
    assert len(data["supported_signs"]) >= 8

def test_websocket_no_hands():
    with client.websocket_connect("/ws/predict") as websocket:
        payload = {
            "schema_version": "1.0",
            "session_id": "test_sess",
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
