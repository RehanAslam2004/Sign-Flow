"""
SignFlow Gemini ASL Interpretation Service
Calls Google GenAI SDK (google-genai) to translate chronological frame sequences
into structured continuous American Sign Language (ASL) interpretations.
"""

import os
import time
import asyncio
from typing import List, Dict, Optional, Any, Literal
from pathlib import Path
from pydantic import BaseModel, Field

# Load environment variables from .env file
from dotenv import load_dotenv
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

from temporal_buffer import TimestampedFrame

try:
    from google import genai
    from google.genai import types
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False


class ASLInterpretationResponse(BaseModel):
    status: Literal["partial", "complete", "uncertain"] = Field(
        description="Status of the interpretation: partial (in-flight clause), complete (finalized thought/sentence), or uncertain (insufficient evidence)."
    )
    recognized_text: str = Field(
        description="Natural English translation of the continuous ASL signing observed in this temporal window."
    )
    alternatives: List[str] = Field(
        default_factory=list,
        description="Alternative interpretations if visual evidence is ambiguous."
    )
    uncertainty_reason: Optional[str] = Field(
        default=None,
        description="Reason for uncertainty (e.g. 'hands occluded', 'motion blur', 'incomplete sign', 'idle non-signing movement')."
    )
    observations: List[str] = Field(
        default_factory=list,
        description="Key visual motion observations (e.g. 'two-handed circular motion', 'raised eyebrows question marker')."
    )
    start_timestamp_ms: int = Field(
        description="Start timestamp of the analyzed temporal window in milliseconds."
    )
    end_timestamp_ms: int = Field(
        description="End timestamp of the analyzed temporal window in milliseconds."
    )
    sequence_id: str = Field(
        description="Unique identifier for this interpretation sequence."
    )


ASL_SYSTEM_INSTRUCTION = """You are SignFlow's expert American Sign Language (ASL) interpreter.
Your task is to observe a chronological sequence of timestamped video frames captured from a user's webcam and translate ASL into natural, fluent English sentences.

Linguistic and Recognition Directives:
1. Support both continuous dynamic signing AND static or held signs/fingerspelling:
   - Dynamic continuous signing (sentences, multi-sign phrases, compound signs).
   - Conversational signs: "HELLO", "THANK YOU", "PLEASE", "YES", "NO", "GOOD", "HELP", "I LOVE YOU", "WATER", "NAME", "NICE TO MEET YOU".
   - Deictic pointing: Index finger pointing directly forward at camera -> "You" / "Your"; index finger pointing toward chest/self -> "I" / "Me" / "My"; downward pointing -> "This" / "Here".
   - Static letters, numbers, and fingerspelled words held steady in frame.
2. Carefully evaluate:
   - Handshapes, finger extensions, palm orientations, locations relative to body/face, and movement trajectories.
   - Non-manual markers (facial expressions, mouth morphemes, eyebrow movements, head nods/shakes).
   - One-handed and two-handed interactions.
3. Formulate natural, coherent English sentences from recognized signs rather than emitting disjointed glosses.
4. Only classify as "uncertain" if the person is clearly not signing (e.g. resting hands on desk, adjusting camera, scratching nose, completely off screen, or random non-sign motion). If the user is actively posing or signing, translate their intended sign or phrase.
5. Provide concise observations and confidence rating adhering strictly to the response schema.
"""


class GeminiASLService:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY", "").strip()
        self.model_name = os.getenv("GEMINI_MODEL", "gemini-flash-lite-latest").strip()
        max_concurrent = int(os.getenv("MAX_CONCURRENT_GEMINI_REQUESTS", "2"))
        self.semaphore = asyncio.Semaphore(max_concurrent)

        self.client: Optional[Any] = None
        if GENAI_AVAILABLE and self.api_key:
            try:
                self.client = genai.Client(api_key=self.api_key)
            except Exception as e:
                print(f"[GeminiASLService] Initialization warning: {e}")
                self.client = None

    def is_configured(self) -> bool:
        return bool(self.client and self.api_key and GENAI_AVAILABLE)

    async def interpret_asl_window(
        self,
        sequence_id: str,
        frames: List[TimestampedFrame],
        start_ts: int,
        end_ts: int,
        previous_context: Optional[str] = None,
        is_boundary_pause: bool = False,
    ) -> ASLInterpretationResponse:
        """
        Translates a temporal window of frames using Gemini Flash with structured output.
        """
        if not self.is_configured():
            return ASLInterpretationResponse(
                status="uncertain",
                recognized_text="",
                alternatives=[],
                uncertainty_reason="GEMINI_API_KEY is not configured or google-genai is unavailable on backend",
                observations=["Local service ready; server API key required"],
                start_timestamp_ms=start_ts,
                end_timestamp_ms=end_ts,
                sequence_id=sequence_id,
            )

        if not frames:
            return ASLInterpretationResponse(
                status="uncertain",
                recognized_text="",
                alternatives=[],
                uncertainty_reason="No frames provided in temporal window",
                observations=[],
                start_timestamp_ms=start_ts,
                end_timestamp_ms=end_ts,
                sequence_id=sequence_id,
            )

        # Build multimodal contents with timestamp markers
        contents = []
        for idx, f in enumerate(frames):
            rel_ms = f.timestamp_ms - start_ts
            # Add JPEG image part
            image_part = types.Part.from_bytes(
                data=f.image_bytes,
                mime_type="image/jpeg",
            )
            contents.append(f"[Frame {idx + 1}/{len(frames)} at +{rel_ms}ms]")
            contents.append(image_part)

        # Context prompt
        prompt = (
            f"Analyze these {len(frames)} chronological frames captured from t={start_ts}ms to t={end_ts}ms (duration: {end_ts - start_ts}ms). "
            f"{'Note: The user paused or completed their thought after this sequence. ' if is_boundary_pause else ''}"
            f"{f'Preceding conversational context: \"{previous_context}\". ' if previous_context else ''}"
            "Translate the observed American Sign Language (ASL) — including continuous sentences, static signs, pointing, or fingerspelling — into natural English text adhering strictly to the response schema."
        )
        contents.append(prompt)

        # Resilient model failover pool to eliminate 503 capacity spikes and 404 deprecations
        model_pool = [
            self.model_name,
            "gemini-flash-lite-latest",
            "gemini-flash-latest",
            "gemini-3.5-flash-lite",
            "gemini-3.7-flash",
        ]
        # Deduplicate while preserving order
        models_to_try = []
        for m in model_pool:
            if m and m not in models_to_try:
                models_to_try.append(m)

        async with self.semaphore:
            t0 = time.perf_counter()
            last_err_msg = ""
            for target_model in models_to_try:
                try:
                    # Run generate_content inside executor to keep async loop non-blocking
                    loop = asyncio.get_running_loop()
                    response = await loop.run_in_executor(
                        None,
                        lambda m=target_model: self.client.models.generate_content(
                            model=m,
                            contents=contents,
                            config=types.GenerateContentConfig(
                                system_instruction=ASL_SYSTEM_INSTRUCTION,
                                response_mime_type="application/json",
                                response_schema=ASLInterpretationResponse,
                                temperature=0.2,
                            ),
                        ),
                    )
                    latency_ms = round((time.perf_counter() - t0) * 1000, 2)
                    self.model_name = target_model

                    # Parse parsed model output
                    if hasattr(response, "parsed") and response.parsed:
                        parsed_res: ASLInterpretationResponse = response.parsed
                        parsed_res.start_timestamp_ms = start_ts
                        parsed_res.end_timestamp_ms = end_ts
                        parsed_res.sequence_id = sequence_id
                        return parsed_res

                    # Fallback to parsing text JSON
                    raw_text = response.text or "{}"
                    parsed_res = ASLInterpretationResponse.model_validate_json(raw_text)
                    parsed_res.start_timestamp_ms = start_ts
                    parsed_res.end_timestamp_ms = end_ts
                    parsed_res.sequence_id = sequence_id
                    return parsed_res

                except Exception as e:
                    last_err_msg = str(e)
                    err_lower = last_err_msg.lower()
                    print(f"[GeminiASLService] Model {target_model} temporary error: {last_err_msg}")
                    # If model is 503 (high demand), 404 (not found), or 429 (rate limit), failover to next model
                    if any(c in err_lower for c in ("503", "404", "429", "unavailable", "high demand", "not found")):
                        continue
                    break

            latency_ms = round((time.perf_counter() - t0) * 1000, 2)
            # Create a calm, user-friendly status message without raw internal JSON
            err_lower = last_err_msg.lower()
            if "503" in err_lower or "high demand" in err_lower or "unavailable" in err_lower:
                user_friendly_reason = "Cloud AI busy — retrying next window"
            elif "quota" in err_lower or "429" in err_lower:
                user_friendly_reason = "Rate limit reached — pausing briefly"
            elif "timeout" in err_lower:
                user_friendly_reason = "Request timeout — retrying"
            else:
                user_friendly_reason = "Analyzing continuous motion..."

            return ASLInterpretationResponse(
                status="uncertain",
                recognized_text="",
                alternatives=[],
                uncertainty_reason=user_friendly_reason,
                observations=[],
                start_timestamp_ms=start_ts,
                end_timestamp_ms=end_ts,
                sequence_id=sequence_id,
            )


# Singleton instance
gemini_asl_service = GeminiASLService()
