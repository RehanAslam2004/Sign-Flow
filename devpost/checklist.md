---
doc: checklist
status: approved
---

# Build Checklist

Build mode: fast

## Slices

- [x] **1. Scaffolding, Arrival Landing Surface, and Camera Stream**
  Becomes usable: The Next.js web application launches at `http://localhost:3000`. You see the branded SignFlow arrival screen with two mode cards (*"I'm the one signing"* vs. *"Someone with me is signing"*). Clicking a mode initializes the live camera feed with hand-framing guides and facing-mode defaults.
  Why now: Establishes the project scaffolding, branding, responsive layout, and camera permission UX that all subsequent recognition layers render into.
  PRD ref: `prd.md > Mode Selection & Camera Setup`, `prd.md > Look and Feel`
  Spec ref: `spec.md > Components > LandingSurface`, `spec.md > Components > CameraViewport`, `spec.md > File Structure`
  Build: Initialize Next.js TypeScript Tailwind project, configure brand tokens (#068D9D Pacific Cyan, #53599A Dusty Grape), build LandingSurface and CameraViewport with camera permission and device switching, configure root npm scripts with concurrently.
  Verify (mechanical): Run Next.js build; confirm LandingSurface and CameraViewport mount and render without runtime errors.
  Learner check: Open http://localhost:3000, select "I'm the one signing", allow camera access, and confirm the camera stream and hand framing guide appear.
  Commit: `Initialize SignFlow with mode selection and live camera viewport`

- [x] **2. Python Inference Service and Canonical Normalization Engine**
  Becomes usable: The Python FastAPI service in `cv-service/` runs at `http://localhost:8000`. It exposes the WebSocket endpoint at `/ws/predict`, executes canonical wrist-centering and palm-scale normalization, loads the PSL classifier, and returns valid structured `v1.0` prediction JSON packets.
  Why now: Proves the backend ML and math kernel early, establishing the verified contract that the frontend will stream into.
  PRD ref: `prd.md > Recognition State Machine & Gesture Boundaries`
  Spec ref: `spec.md > Components > FastApiInferenceService`, `spec.md > Components > FeatureNormalizer`, `spec.md > Data Model & WebSocket Contract`
  Build: Scaffold `cv-service/`, implement `preprocessing.py` (canonical normalization), `inference.py` (model loader for 8–12 verified PSL signs), `main.py` (FastAPI WebSocket), and automated tests in `cv-service/tests/`.
  Verify (mechanical): Run pytest on `cv-service/tests/` to verify feature normalization math, aspect ratio handling, and WebSocket payload response format.
  Learner check: Verify the FastAPI service starts at http://localhost:8000/docs and passes the automated normalization test suite.
  Commit: `Add FastAPI WebSocket service and canonical feature normalizer`

- [x] **3. Live MediaPipe Landmark Streaming and Real-Time PSL Sign Recognition**
  Becomes usable: Moving your hands in front of the camera tracks 21 hand landmarks via MediaPipe JS, streams coordinate vectors to FastAPI via WebSocket, and displays a live candidate preview and confirmed PSL sign on screen.
  Why now: This connects the frontend camera to the Python inference engine over WebSocket, delivering the unique AI recognition kernel.
  PRD ref: `prd.md > The Core Journey` (steps 3–5), `prd.md > Recognition State Machine & Gesture Boundaries`
  Spec ref: `spec.md > Components > MediaPipeLandmarkExtractor`, `spec.md > Components > WebSocketClient`, `spec.md > Components > RecognitionStateMachine`
  Build: Implement `@mediapipe/tasks-vision` runner in `lib/mediapipe.ts`, WebSocket client with auto-reconnect in `lib/websocketClient.ts`, and `RecognitionStateMachine.ts` with 500–800ms stability check and gesture-boundary / neutral reset to prevent duplicate repeats.
  Verify (mechanical): Run Next.js build; verify WebSocket client connection and mock landmark streaming pass without errors.
  Learner check: Open the translator, sign in front of the camera, and confirm that the status badge shows "Recognizing" and commits the confirmed sign once without duplicates.
  Commit: `Connect live MediaPipe streaming to FastAPI WebSocket recognition`

- [x] **4. Utterance Formation, Persistent Transcript, and Speech Synthesis**
  Becomes usable: Confirmed words accumulate into an utterance; pausing (~1.2s) or clicking *"Finish & Speak"* voices the translated message aloud via the browser Web Speech API and appends it to the persistent conversation transcript with replay controls.
  Why now: Completes the end-to-end communication loop (sign → text → speech) that hearing conversation partners rely on.
  PRD ref: `prd.md > The Core Journey` (steps 6–7), `prd.md > Utterance Accumulation & Speech Synthesis`, `prd.md > Conversation Transcript & History`
  Spec ref: `spec.md > Components > UtteranceAccumulator`, `spec.md > Components > SpeechSynthesizer`, `spec.md > Components > ConversationTranscript`
  Build: Implement `UtteranceAccumulator` in `lib/stateMachine.ts`, `SpeechSynthesizer` in `lib/speech.ts` (with auto-speak toggle and replay), and `TranscriptView.tsx` with timestamped history.
  Verify (mechanical): Run unit tests on utterance accumulation buffer and verify SpeechSynthesis wrapper calls without exceptions.
  Learner check: Sign a word, pause, and verify the browser speaks the word aloud and adds it to the readable transcript with a working audio replay button.
  Commit: `Add utterance accumulation, speech synthesis, and conversation transcript`

- [x] **5. Session Controls, Camera Switching, and Dignified Recovery States**
  Becomes usable: A complete, resilient product with toolbar controls (Switch camera, End conversation, Clear transcript, Change mode) and dignified handling for camera permission denied, disconnected video, and backend offline.
  Why now: Hardens the prototype into a calm, reliable demo that handles unexpected camera or service events gracefully.
  PRD ref: `prd.md > Session Management & Recovery`, `prd.md > States and Boundaries`
  Spec ref: `spec.md > Components > SessionControlBar`, `spec.md > Components > ErrorRecoveryBanner`, `spec.md > Important Failure Modes`
  Build: Implement `SessionControlBar` (camera toggle, session end with stream release, transcript clear confirmation) and `ErrorBanner` / empty states (permission denied guidance, camera disconnect, backend offline badge).
  Verify (mechanical): Test UI state transitions for camera toggle, end session cleanup, and error banner rendering.
  Learner check: Test switching cameras, ending the session, and verify the backend offline indicator when FastAPI is stopped.
  Commit: `Add session controls, camera switching, and error recovery states`

## Hands-on Checkpoints

- [x] Early usable behavior explored — after Slice 3 (live camera + MediaPipe + WebSocket PSL recognition verified)
- [x] Final kick-the-tires exploration and feedback completed — after Slice 5 (complete end-to-end loop)

## Final Review

- [ ] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [ ] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [ ] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [ ] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence: [to be recorded upon completion]
Route and stops: [to be recorded upon completion]
Edit outcome: [to be recorded upon completion]
Reflection: [to be recorded upon completion]
Activity mode: [to be recorded upon completion]

## Revisions

