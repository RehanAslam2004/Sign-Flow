"""
SignFlow Temporal Frame Buffer
Maintains timestamped rolling frame sequences for continuous ASL visual motion interpretation.
Supports overlapping windows, sequence identification, and memory bounds.
"""

import time
import base64
from typing import List, Dict, Optional, Tuple, Any
from dataclasses import dataclass


@dataclass
class TimestampedFrame:
    frame_id: int
    timestamp_ms: int
    image_bytes: bytes
    hands_detected: int
    metadata: Dict[str, Any]


class SessionTemporalBuffer:
    def __init__(
        self,
        session_id: str,
        max_buffer_duration_ms: int = 4000,
        target_fps: int = 5,
        default_window_ms: int = 2000,
    ):
        self.session_id = session_id
        self.max_buffer_duration_ms = max_buffer_duration_ms
        self.target_fps = target_fps
        self.default_window_ms = default_window_ms

        self.frames: List[TimestampedFrame] = []
        self.last_window_end_ts: int = 0
        self.window_counter: int = 0
        self.last_activity_ts: int = int(time.time() * 1000)

    def add_frame(
        self,
        frame_id: int,
        timestamp_ms: int,
        image_data: Any,
        hands_detected: int = 1,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """
        Adds a timestamped frame to the buffer.
        image_data can be raw bytes or a base64 encoded JPEG string (with or without data: URL prefix).
        """
        if isinstance(image_data, str):
            # Strip data URL prefix if present (e.g. "data:image/jpeg;base64,...")
            if "," in image_data:
                image_data = image_data.split(",", 1)[1]
            try:
                frame_bytes = base64.b64decode(image_data)
            except Exception:
                return False
        elif isinstance(image_data, bytes):
            frame_bytes = image_data
        else:
            return False

        if not frame_bytes or len(frame_bytes) < 10:
            return False


        frame = TimestampedFrame(
            frame_id=frame_id,
            timestamp_ms=timestamp_ms,
            image_bytes=frame_bytes,
            hands_detected=hands_detected,
            metadata=metadata or {},
        )
        self.frames.append(frame)

        if hands_detected > 0:
            self.last_activity_ts = timestamp_ms

        # Prune frames older than max_buffer_duration_ms relative to this frame
        cutoff_ts = timestamp_ms - self.max_buffer_duration_ms
        self.frames = [f for f in self.frames if f.timestamp_ms >= cutoff_ts]
        return True

    def is_window_ready(self, min_interval_ms: int = 1000, min_frames: int = 4) -> bool:
        """
        Checks if enough time has passed since the last emitted window (overlap interval)
        and sufficient frames are present.
        """
        if not self.frames or len(self.frames) < min_frames:
            return False

        latest_ts = self.frames[-1].timestamp_ms
        if latest_ts - self.last_window_end_ts < min_interval_ms:
            return False

        # Only emit window if there has been active signing within the buffer
        recent_active = any(f.hands_detected > 0 for f in self.frames[-min_frames:])
        return recent_active

    def get_overlapping_window(
        self,
        window_duration_ms: Optional[int] = None,
        min_frames: int = 4,
    ) -> Optional[Tuple[str, List[TimestampedFrame], int, int]]:
        """
        Extracts the most recent overlapping temporal window.
        Returns: (sequence_id, frames_list, start_ts, end_ts)
        """
        duration = window_duration_ms or self.default_window_ms
        if not self.frames or len(self.frames) < min_frames:
            return None

        end_ts = self.frames[-1].timestamp_ms
        start_ts = end_ts - duration

        window_frames = [f for f in self.frames if f.timestamp_ms >= start_ts]
        if len(window_frames) < min_frames:
            return None

        self.window_counter += 1
        self.last_window_end_ts = end_ts
        seq_id = f"seq_{self.session_id}_{self.window_counter}_{start_ts}_{end_ts}"

        return seq_id, window_frames, start_ts, end_ts

    def check_boundary_pause(self, current_ts: int, pause_threshold_ms: int = 800) -> bool:
        """
        Returns True if hands were previously active but have ceased moving / dropped for > pause_threshold_ms.
        """
        if not self.frames:
            return False
        return (current_ts - self.last_activity_ts) >= pause_threshold_ms

    def clear(self):
        self.frames.clear()
        self.last_window_end_ts = 0
        self.window_counter = 0


class TemporalBufferManager:
    """
    Manages session-isolated temporal buffers for multiple concurrent clients.
    """
    def __init__(self):
        self.sessions: Dict[str, SessionTemporalBuffer] = {}

    def get_session_buffer(self, session_id: str) -> SessionTemporalBuffer:
        if session_id not in self.sessions:
            self.sessions[session_id] = SessionTemporalBuffer(session_id=session_id)
        return self.sessions[session_id]

    def remove_session(self, session_id: str):
        if session_id in self.sessions:
            del self.sessions[session_id]
