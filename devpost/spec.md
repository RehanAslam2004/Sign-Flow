---
doc: spec
status: approved
---

# SignFlow — Technical Spec

A hybrid client-server technical blueprint for SignFlow: in-browser MediaPipe hand-landmark extraction paired with a Python FastAPI inference service via WebSocket, powering real-time Pakistan Sign Language (PSL) recognition, an interactive transcript, and speech synthesis.

## How This Works, In Plain Language

SignFlow splits responsibilities cleanly between the browser and a local Python service:

1. **In the browser:** You open the web application at `http://localhost:3000`. When you pick a usage mode (*"I'm the one signing"* or *"Someone with me is signing"*), the browser opens your camera and uses MediaPipe's client-side library to track your hands. Instead of streaming heavy, privacy-sensitive video frames over the network, the browser extracts the raw 21 landmark coordinate points of your hand in real time.
2. **Over the wire:** The browser streams lightweight JSON packets containing only these numeric landmark coordinates, frame IDs, and timestamps over a high-speed WebSocket connection to a Python service running locally at `http://localhost:8000`.
3. **In Python:** The FastAPI service receives the raw coordinates and passes them through a canonical normalization function (handling wrist-centering, scaling, and aspect-ratio adjustment). It runs the trained classifier to recognize the PSL sign and streams structured prediction events back over the WebSocket.
4. **Back in the browser:** The frontend feeds prediction events into a client-side state machine. When a sign is held stably (~500–800ms) and reaches a gesture boundary or returns to rest, it commits the word once to the transcript. When you pause signing (~1–1.5s) or click *"Finish & Speak"*, the browser's built-in speech engine voices the phrase aloud.

This architecture lets Rehan build a responsive, accessible React/Next.js frontend while allowing his cousin to train and evaluate models entirely in native Python without requiring complex web model conversions.

## The Core Journey Through the System

Implements: `prd.md > The Core Journey`.

```text
[User Action]                 [Browser / Next.js]               [Python / FastAPI]
      │                                │                                │
      ▼                                │                                │
Selects Mode ───────────────► Requests Camera (facingMode)              │
                                       │                                │
                               Starts Video & MediaPipe                 │
                                       │                                │
Signing in frame ────────────► Extracts 21 Hand Landmarks               │
                                       │                                │
                               Sends Raw JSON Vector ──WebSocket───────► Receives Frame
                                                                        │
                                                                 Canonical Normalization
                                                                        │
                                                                 Classifier Inference
                                                                        │
                               ◄──Sends Prediction Event ─WebSocket─────┘
                                       │
                               Recognition State Machine
                               (Preview -> Stability -> Boundary)
                                       │
                               Appends Word to Transcript
                                       │
                               Pause Detected (~1.2s)
                                       │
                               SpeechSynthesis Voices Output
```

1. **Arrival & Mode Select:** User selects a card on `LandingSurface` → triggers `navigator.mediaDevices.getUserMedia` with requested `facingMode` (`user` or `environment`).
2. **Frame Capture & Landmark Tracking:** Video plays into an HTML `<video>` element → `MediaPipeLandmarkExtractor` detects hand landmarks on `requestVideoFrameCallback` → extracts 21 landmark points (x, y, z) + handedness.
3. **WebSocket Transmission:** `WebSocketClient` serializes raw landmark coordinates and metadata into a versioned JSON payload and sends it over `ws://localhost:8000/ws/predict`.
4. **Backend Processing:** `FastApiInferenceService` receives payload → `FeatureNormalizer` executes canonical wrist-centering and palm-scale normalization → scikit-learn model predicts the sign → returns structured JSON event.
5. **State Machine & Transcript:** `RecognitionStateMachine` filters predictions via a 500–800ms stability window → on gesture boundary or rest, commits word to `UtteranceAccumulator` and displays in `ConversationTranscript`.
6. **Utterance Speech:** After an idle timeout (~1–1.5s) or clicking *"Finish & Speak"*, `SpeechSynthesizer` calls `window.speechSynthesis.speak()` to voice the accumulated utterance.

## Stack

- **Frontend Framework:** Next.js 14+ (App Router), React 18+, TypeScript.  
  *Rationale:* Fast development, strong typing, matches Rehan's core expertise.  
  *Docs:* [Next.js Documentation](https://nextjs.org/docs)
- **Styling & Icons:** Tailwind CSS, Lucide React.  
  *Rationale:* Clean utility styling matching brand tokens; crisp, non-emoji iconography.  
  *Docs:* [Tailwind CSS](https://tailwindcss.com/docs), [Lucide React](https://lucide.dev)
- **Client-Side Vision:** `@mediapipe/tasks-vision` (WebAssembly / GPU accelerated).  
  *Rationale:* High-performance landmark extraction in the browser; avoids sending video to servers.  
  *Docs:* [MediaPipe Hand Landmarker Web](https://developers.google.com/mediapipe/solutions/vision/hand_landmarker/web_js)
- **Backend Service:** Python 3.10+, FastAPI, Uvicorn.  
  *Rationale:* High-throughput asynchronous WebSocket server; native Python environment for CV/ML.  
  *Docs:* [FastAPI WebSockets](https://fastapi.tiangolo.com/advanced/websockets/)
- **Machine Learning & Preprocessing:** scikit-learn, NumPy, joblib.  
  *Rationale:* Lightweight, explainable classifiers (e.g. Random Forest, SVM, or MLP) suitable for verified ~8–12 PSL word proof of concept.  
  *Docs:* [scikit-learn](https://scikit-learn.org)
- **Text-to-Speech:** Browser Web Speech API (`SpeechSynthesis`).  
  *Rationale:* Zero external audio API costs or latency; standard across modern desktop and mobile browsers.  
  *Docs:* [Web Speech API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- **Process Orchestration:** `concurrently` (Node.js package).  
  *Rationale:* Starts both Next.js and FastAPI with a single cross-platform `npm run dev` command on Windows and POSIX systems.

## Where It Runs and How Someone Tries It

- **Runtime Environments:**
  - Node.js 18+ (for Next.js frontend).
  - Python 3.10+ with a local virtual environment in `cv-service/.venv`.
- **Single Start Command:**
  ```bash
  npm run dev
  ```
  This cross-platform command launches:
  - Frontend: `http://localhost:3000`
  - Python API & WebSockets: `http://localhost:8000`
- **Verification & Demo Instructions:**
  1. Open `http://localhost:3000` in Google Chrome or Microsoft Edge.
  2. Select *"I'm the one signing"* and allow webcam access.
  3. Verify green *"AI Service Connected"* badge is visible.
  4. Perform verified PSL signs (e.g. "Hello", "Water", "Help").
  5. Observe live candidate preview, debounced transcript entry, and spoken audio playback.
- **Submission Requirements:** Demo recorded locally with live webcam; repository pushed to public GitHub. Cloud deployment is optional and secondary to a rock-solid local demo.

## Look and Feel

Implements: `prd.md > Look and Feel` and `scope.md > Inspiration & Identity`.

- **Canvas & Surfaces:** Pure White (`#FFFFFF`) and Light Neutral slate (`#F8FAFC`, `#F1F5F9`).
- **Brand Identity:**
  - Primary Accent: Pacific Cyan (`#068D9D`) for primary buttons, active badges, and focus rings.
  - Secondary Accent: Dusty Grape (`#53599A`) for state highlights and transcript accents.
  - Text: Deep Slate (`#1E293B`, `#475569`).
- **Typography:** Modern clean sans-serif (Inter / system font stack); 16px base, clear headline contrast, large readable translation text area.
- **Constraints & Anti-Patterns:** Strictly no purple-neon gradients, no glassmorphism, no artificial "AI-powered" floating badges, and no fabricated confidence percentages.

## Components

### `LandingSurface`
- Implements: `prd.md > Mode Selection & Camera Setup`.
- Renders the header, headline (*"Let's make conversation flow"*), privacy notice, and two scenario cards (*"I'm the one signing"* vs. *"Someone with me is signing"*).
- Passes the chosen camera mode preference to `CameraViewport`.

### `CameraViewport`
- Implements: `prd.md > Mode Selection & Camera Setup`, `prd.md > States and Boundaries`.
- Manages `navigator.mediaDevices.getUserMedia` stream lifecycle, camera device enumeration, and front/rear switching.
- Displays the live video feed, subtle hand-framing guides, and active status badges (*"Connecting..."*, *"Recognizing"*, *"Sign Confirmed"*).
- Renders friendly empty states for permission denied and disconnected camera.

### `MediaPipeLandmarkExtractor`
- Implements: `prd.md > Recognition State Machine & Gesture Boundaries`.
- Initializes `@mediapipe/tasks-vision` `HandLandmarker` model asset in WebAssembly.
- Processes video frames at ~20–30 FPS; extracts 21 `(x, y, z)` landmarks per detected hand.
- Transmits raw coordinate data to `WebSocketClient`. Does not apply custom geometric normalization.

### `WebSocketClient`
- Implements: `prd.md > Recognition State Machine & Gesture Boundaries`.
- Maintains a persistent WebSocket connection to `ws://localhost:8000/ws/predict`.
- Manages auto-reconnect, connection state telemetry (`connecting`, `connected`, `disconnected`), and throttles frame transmission if network congestion occurs.

### `FastApiInferenceService`
- Implements: `prd.md > Recognition State Machine & Gesture Boundaries`.
- FastAPI WebSocket endpoint at `/ws/predict`.
- Deserializes incoming `v1.0` JSON frame payloads, routes landmarks to `FeatureNormalizer`, passes features to the scikit-learn model, and emits structured prediction events.

### `FeatureNormalizer`
- Implements: `prd.md > Recognition State Machine & Gesture Boundaries`.
- **Single Source of Truth:** Python module shared between offline dataset training and live inference.
- Performs wrist-centering: $p'_i = p_i - p_0$ for all 21 points.
- Performs palm-scale normalization: scales coordinates by distance between wrist (point 0) and middle finger MCP (point 9), incorporating image aspect-ratio correction.
- Handles edge cases: missing hands, zero-division guards.

### `RecognitionStateMachine`
- Implements: `prd.md > Recognition State Machine & Gesture Boundaries`.
- Frontend state machine:
  - *Candidate Preview:* Displays instantaneous model prediction subtly.
  - *Stability Check:* Requires identical prediction across a 500–800ms rolling window.
  - *Boundary & Deduplication:* Commits word only upon transition or return to rest; holding a gesture never repeats words.
  - *Uncertainty:* Displays *"Sign not recognized"* when confidence is below threshold; never guesses or hallucinates words.

### `UtteranceAccumulator`
- Implements: `prd.md > Utterance Accumulation & Speech Synthesis`.
- Collects confirmed isolated words into an active phrase buffer.
- Emits end-of-utterance signal on a 1.2s inactivity pause or manual *"Finish & Speak"* click.

### `SpeechSynthesizer`
- Implements: `prd.md > Utterance Accumulation & Speech Synthesis`.
- Wraps `window.speechSynthesis`.
- Automatically speaks finalized utterances when auto-speech is enabled.
- Exposes manual `speak()` and `replay(text)` methods; handles browser voice selection gracefully.

### `ConversationTranscript`
- Implements: `prd.md > Conversation Transcript & History`.
- Scrollable dialogue history displaying confirmed messages with timestamps.
- Provides individual message replay audio controls and copy actions.

### `SessionControlBar`
- Implements: `prd.md > Session Management & Recovery`.
- Compact toolbar providing: *Switch camera*, *End conversation* (stops media stream and audio), *New conversation* (clears transcript with confirmation), and *Change mode*.

### `ErrorRecoveryBanner`
- Implements: `prd.md > States and Boundaries`.
- Displays contextual recovery actions for camera permission denied, disconnected video stream, backend service offline, and audio synthesis errors.

## Data Model & WebSocket Contract

### Protocol: WebSocket (`ws://localhost:8000/ws/predict`)

#### Client → Server Frame Message (`v1.0`)
```json
{
  "schema_version": "1.0",
  "session_id": "sess_9f8a3c21",
  "frame_id": 1042,
  "timestamp": 1712345678912,
  "image_width": 1280,
  "image_height": 720,
  "hands_detected": 1,
  "hands": [
    {
      "handedness": "Right",
      "score": 0.96,
      "landmarks": [
        { "x": 0.542, "y": 0.421, "z": -0.045 },
        { "x": 0.531, "y": 0.395, "z": -0.052 }
      ]
    }
  ]
}
```
*Note: `landmarks` contains all 21 MediaPipe hand points in order (0 to 20).*

#### Server → Client Prediction Message (`v1.0`)
```json
{
  "schema_version": "1.0",
  "session_id": "sess_9f8a3c21",
  "frame_id": 1042,
  "timestamp": 1712345678950,
  "status": "recognized",
  "sign": "HELLO",
  "confidence": 0.91,
  "is_candidate": true,
  "message": null
}
```
*Status values:* `"recognized"`, `"candidate"`, `"uncertain"`, `"no_hands"`, `"error"`.

### Frontend State Schema
```typescript
interface ConversationMessage {
  id: string;
  text: string;
  timestamp: number;
  spoken: boolean;
}

interface RecognitionState {
  serviceStatus: 'connecting' | 'connected' | 'disconnected';
  candidateSign: string | null;
  candidateConfidence: number;
  lastConfirmedSign: string | null;
  activeUtterance: string[];
  autoSpeechEnabled: boolean;
  transcript: ConversationMessage[];
}

export interface SignReferenceEntry {
  id: string;
  phrase: string;
  pslLabel: string;
  intent: 'offer_help' | 'confirm' | 'acknowledge' | 'clarify';
  triggerKeywords: string[];
  mediaUrl?: string;
  validationStatus: 'verified' | 'pending_verification';
  source: string;
  usageNotes?: string;
  stepByStep?: string[];
}

export interface SuggestedReply {
  id: string;
  text: string;
  intent: string;
  referenceId?: string;
  validationStatus: 'verified' | 'pending_verification';
  reference?: SignReferenceEntry;
}

export interface SuggestRepliesRequest {
  mode: 'partner' | 'signing';
  messageId: string;
  text: string;
  context?: string[];
}

export interface SuggestRepliesResponse {
  messageId: string;
  suggestions: SuggestedReply[];
  isFallback: boolean;
  notice?: string;
}
```

## File Structure

```text
Sign flow/
├── app/
│   ├── api/
│   │   └── suggest-replies/
│   │       └── route.ts        # Contextual reply suggestion endpoint with mode validation
│   ├── layout.tsx              # Root HTML shell & metadata
│   ├── page.tsx                # Main page (switches Landing / Translator)
│   └── globals.css             # Tailwind utilities & CSS custom properties
├── components/
│   ├── LandingSurface.tsx      # Welcome header & mode selection cards
│   ├── TranslatorLayout.tsx    # Responsive 2-column desktop / stacked mobile container
│   ├── CameraViewport.tsx      # Video stream, hand overlay, device switcher
│   ├── RecognitionStatus.tsx   # Live status pill (Recognizing, Confirmed, Idle)
│   ├── TranscriptView.tsx      # Running conversation list with replay buttons
│   ├── SuggestedReplies.tsx    # Suggested responses section (exclusively partner mode)
│   ├── SignReferenceModal.tsx  # Detailed PSL sign reference and learning viewer
│   ├── SessionControlBar.tsx   # Switch camera, End, Clear, Change mode toolbar
│   └── ErrorBanner.tsx         # Permission denied, camera disconnect, backend offline
├── lib/
│   ├── mediapipe.ts            # MediaPipe HandLandmarker initialization & runner
│   ├── websocketClient.ts      # WebSocket connection, reconnection, and JSON parsing
│   ├── stateMachine.ts         # Stability window, gesture boundary, deduplication
│   ├── speech.ts               # Web Speech API wrapper (speak, replay, voice picker)
│   ├── replyCatalogue.ts       # Verified PSL reference catalogue and matching logic
│   └── config.ts               # Ports, timeouts, stability thresholds
├── types/
│   ├── contract.ts             # WebSocket v1.0 request/response TypeScript interfaces
│   └── app.ts                  # App-level types, messages, UI state, replies
├── cv-service/
│   ├── main.py                 # FastAPI app & WebSocket endpoint (/ws/predict)
│   ├── preprocessing.py        # Canonical wrist-centering & scale normalization
│   ├── inference.py            # Model loader & prediction evaluator
│   ├── model/
│   │   ├── classifier.joblib   # Trained PSL scikit-learn model artifact
│   │   └── labels.json         # Supported PSL vocabulary mapping (8–12 words)
│   ├── tests/
│   │   ├── test_preprocessing.py # Unit tests verifying normalization math
│   │   └── test_inference.py     # Unit test verifying model returns valid JSON
│   ├── requirements.txt        # fastapi, uvicorn, scikit-learn, numpy, websockets
│   └── run_service.py          # Cross-platform startup script with venv verification
├── devpost/                    # Preserved official Devpost Learn artifacts
│   ├── learner-profile.md
│   ├── scope.md
│   ├── scope.html
│   ├── prd.md
│   ├── prd.html
│   ├── spec.md
│   └── spec.html
├── package.json                # Root package.json with "dev" concurrently script
├── tsconfig.json
├── tailwind.config.js
└── README.md
```

## External Services and Dependencies

1. **Local FastAPI Service:**  
   - Endpoint: `ws://localhost:8000/ws/predict`  
   - Rate: Streaming at ~20–30 FPS during active signing.  
   - Cost: $0 (Local execution).
2. **MediaPipe Task Asset (CDN / Local Bundle):**  
   - Hand Landmarker `.task` file loaded via `@mediapipe/tasks-vision`.  
   - Cost: $0 (Google Open Source).
3. **Web Speech API:**  
   - Native browser API (`window.speechSynthesis`).  
   - Cost: $0, runs offline.

## Important Failure Modes

1. **FastAPI Service Offline or Crashed:**  
   - *Failure:* WebSocket connection fails to connect or closes unexpectedly.  
   - *Behavior:* Frontend displays a calm badge: *"AI Service Offline — make sure the Python service is running"*. Camera feed and transcript remain usable; no fake predictions are shown.
2. **Camera Permission Denied:**  
   - *Failure:* `getUserMedia` throws `NotAllowedError`.  
   - *Behavior:* Camera viewport displays *"Camera access is needed"* empty state with clear instructions on enabling permissions in browser settings and a *"Try again"* button.
3. **Web Speech API Voice Unavailable:**  
   - *Failure:* Browser does not have an installed voice or speech synthesis errors out.  
   - *Behavior:* Translated text remains clearly highlighted in transcript; an unobtrusive banner indicates *"Audio playback unavailable in this browser"*.
4. **Unsupported or Fast Unclear Signing:**  
   - *Failure:* Hand poses produce low confidence scores or no consistent prediction across 500ms.  
   - *Behavior:* Status displays *"Sign not recognized — try signing again"*. No false words are committed.

## What Was Simplified and Why

- **Client Landmark Extraction + Backend Python Classifier** instead of **Full Server-Side Video Streaming**: Transmitting raw landmarks over WebSocket saves massive network bandwidth and protects camera privacy, while still allowing the ML pipeline to be developed in native Python.
- **Python-Owned Canonical Normalization** instead of **Dual TS/Python Preprocessing**: Eliminates mathematical coordinate drift between training time and inference time.
- **Single Cross-Platform `npm run dev` Command** instead of **Complex Multi-Terminal Manual Start**: Uses `concurrently` to orchestrate Next.js and the Python service with clear logging, reducing setup friction on Windows.
- **Isolated Word Recognition with Utterance Accumulation** instead of **Full Continuous PSL Grammar Translation**: Keeps the scope honest and deliverable for a hackathon while proving the end-to-end communication kernel.

## Decisions and Open Issues

### Decisions Made
- **Hybrid Architecture with WebSocket:** Next.js frontend + FastAPI backend.
- **Canonical Feature Normalizer:** Python service owns landmark normalization and is reused across training and inference.
- **Schema Versioning:** WebSocket payloads explicitly include `v1.0` schema, image dimensions, and frame metadata to handle aspect-ratio geometry correctly.
- **Local Joint Startup:** Single `npm run dev` entrypoint orchestrates both processes cross-platform.

### One Useful Unknown Clarified
- **The Uncertainty:** How to prevent coordinate representation skew between client-side MediaPipe landmark extraction and the Python model's training pipeline.
- **How It Was Clarified:** We established that the frontend transmits raw MediaPipe landmark points without applying client-side scaling or centering. The Python service implements a single canonical `normalize_landmarks()` function in `cv-service/preprocessing.py`, accompanied by a unit test (`test_preprocessing.py`) to validate identical behavior before full end-to-end integration.

### Open Questions (Carried to Build)
- **Final PSL Vocabulary:** Cousin to provide the exact 8–12 supported sign labels and corresponding `.joblib` model weights after dataset verification.
