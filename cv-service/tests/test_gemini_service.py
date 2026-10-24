import pytest
import time
import base64
from pydantic import ValidationError
from temporal_buffer import SessionTemporalBuffer, TemporalBufferManager
from gemini_service import ASLInterpretationResponse, GeminiASLService


def test_asl_response_schema_validation():
    # Valid complete response
    data = {
        "status": "complete",
        "recognized_text": "I want to learn sign language.",
        "alternatives": ["I would like to learn signs."],
        "uncertainty_reason": None,
        "observations": ["Right hand flat on chest", "two-handed circular sweep"],
        "start_timestamp_ms": 1000,
        "end_timestamp_ms": 3000,
        "sequence_id": "seq_test_1",
    }
    res = ASLInterpretationResponse.model_validate(data)
    assert res.status == "complete"
    assert res.recognized_text == "I want to learn sign language."
    assert len(res.alternatives) == 1
    assert len(res.observations) == 2


def test_asl_response_schema_invalid_status():
    data = {
        "status": "invalid_status",
        "recognized_text": "Test",
        "start_timestamp_ms": 1000,
        "end_timestamp_ms": 3000,
        "sequence_id": "seq_test_1",
    }
    with pytest.raises(ValidationError):
        ASLInterpretationResponse.model_validate(data)


def test_temporal_buffer_add_and_prune():
    buf = SessionTemporalBuffer(session_id="test_sess", max_buffer_duration_ms=2000, default_window_ms=1000)
    fake_jpeg = base64.b64encode(b"fake_jpeg_bytes_for_testing_purposes_1234567890").decode("utf-8")

    # Add 6 frames spaced 200ms apart (0, 200, 400, 600, 800, 1000)
    for i in range(6):
        ts = 1000 + i * 200
        ok = buf.add_frame(frame_id=i, timestamp_ms=ts, image_data=fake_jpeg, hands_detected=1)
        assert ok is True

    assert len(buf.frames) == 6

    # Adding a frame at ts=3500 should prune frames older than 3500 - 2000 = 1500
    buf.add_frame(frame_id=7, timestamp_ms=3500, image_data=fake_jpeg, hands_detected=1)
    for f in buf.frames:
        assert f.timestamp_ms >= 1500


def test_temporal_buffer_overlapping_window():
    buf = SessionTemporalBuffer(session_id="test_sess", max_buffer_duration_ms=4000, default_window_ms=1000)
    fake_jpeg = base64.b64encode(b"fake_jpeg_bytes_for_testing_purposes_1234567890").decode("utf-8")

    for i in range(10):
        buf.add_frame(frame_id=i, timestamp_ms=1000 + i * 200, image_data=fake_jpeg, hands_detected=1)

    assert buf.is_window_ready(min_interval_ms=500, min_frames=4) is True

    window = buf.get_overlapping_window(window_duration_ms=1000, min_frames=4)
    assert window is not None
    seq_id, frames, start_ts, end_ts = window
    assert seq_id.startswith("seq_test_sess_1_")
    assert len(frames) >= 4
    assert end_ts == 1000 + 9 * 200


def test_temporal_buffer_boundary_pause():
    buf = SessionTemporalBuffer(session_id="test_sess")
    fake_jpeg = base64.b64encode(b"fake_jpeg_bytes_for_testing_purposes_1234567890").decode("utf-8")

    buf.add_frame(frame_id=1, timestamp_ms=1000, image_data=fake_jpeg, hands_detected=1)

    # 500ms later: no boundary pause yet
    assert buf.check_boundary_pause(1500, pause_threshold_ms=800) is False

    # 1000ms later: boundary pause triggered
    assert buf.check_boundary_pause(2000, pause_threshold_ms=800) is True


@pytest.mark.anyio
async def test_gemini_service_empty_frames():
    service = GeminiASLService()
    res = await service.interpret_asl_window(
        sequence_id="seq_test_empty",
        frames=[],
        start_ts=1000,
        end_ts=2000,
    )
    assert res.status == "uncertain"
    assert "No frames" in res.uncertainty_reason
