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

- [x] **6. Contextual Suggested Sign Replies and Verified Reference Viewer**
  Becomes usable: In "Someone with me is signing" mode, confirmed incoming messages in the transcript reveal a "Suggested replies" section with 2–4 contextually ranked responses. Choosing a reply opens a mobile-friendly detail view with complete text, explanation of meaning, and verified PSL sign instructions/visual references (or an explicit "Verified sign demonstration not available yet" notice when pending). The feature is strictly disabled in "I'm the one signing" mode.
  Why now: Completes the full two-way communication loop by empowering the hearing conversation partner to respond in Pakistan Sign Language using verified sign references.
  PRD ref: `prd.md > Suggested Sign Replies (Partner Mode Exclusively)`, `prd.md > What We're Building`
  Spec ref: `spec.md > Frontend State Schema`, `spec.md > File Structure`, `spec.md > External Services and Dependencies`
  Build: Create `lib/replyCatalogue.ts` (data model and curated PSL catalogue), implement `app/api/suggest-replies/route.ts` with mode validation, build `components/SuggestedReplies.tsx` and `components/SignReferenceModal.tsx`, integrate into `app/page.tsx` with deduplication and mode gating, and write unit tests for the catalogue and endpoint.
  Verify (mechanical): Run automated tests verifying mode rejection, contextual reply ranking, deduplication, and `next build` passing without errors.
  Learner check: Switch to "Someone with me is signing", commit an utterance (e.g. "WATER" or "HELP"), confirm 2–4 suggested replies appear, select one to view its sign details, and verify that switching to "I'm the one signing" completely suppresses the feature.
  Commit: `Implement contextual suggested sign replies and verified reference viewer`

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

- **Scope Extension (Suggested Sign Replies):** Added Slice 6 to implement contextual suggested responses for hearing conversation partners in "Someone with me is signing" mode. Strictly restricted from "I'm the one signing" mode. Leverages a verified PSL catalogue with truthful pending-verification disclaimers where visual media is not yet available, ensuring zero hallucinated hand shapes.
- **Ghost-Hand Camera Integration (Refinement to Slice 6):** Refined Suggested Sign Replies from a separate text reference section into an in-camera AR-style translucent ghost-hand guide. Positioned in an unobtrusive lower region of the camera viewport, the guide demonstrates authentic multi-step PSL motions with play/pause, replay, and step controls, while keeping the live conversation video feed active.
- **Minimalist AR Ghost Hand & Automatic Triggering (UX Correction to Slice 6):** Streamlined user experience by eliminating the separate suggested-replies grid card, manual clicks, and large tutorial modals. Enabled automatic selection of the top verified reply upon confirmed incoming message in partner mode. Rendered as a subtle, translucent gray hand silhouette positioned unobtrusively in the camera corner with a single compact pill label (`Sign: [LABEL]`), zero bulky rectangular containers, and strict mode gating.
- **Temporary Bottom-Positioned Ghost Hand Lifecycle (Refinement to Slice 6):** Returned the ghost-hand overlay to the bottom of the camera frame with a temporary lifecycle: plays the demonstration motion once, holds visible for ~3 seconds, then smoothly fades out over 300ms. Leaves only an understated, unobtrusive "Replay" pill control so the user can easily re-watch the demonstration without re-triggering messages. Fully respects `prefers-reduced-motion` and ensures the overlay does not loop continuously or clutter the live camera view.
- **Session Lifecycle and Cross-Conversation Isolation Fix:** Resolved stale session resurrection and leaky transcript bug. Every conversation now creates a genuinely unique session ID (`crypto.randomUUID()`), resets active transcripts, wipes unconfirmed gesture candidates, clears active utterance buffers, cancels pending speech synthesis with clean listener detachment, sends a WebSocket reset handshake to FastAPI, filters out late arriving frames/predictions using strict session guards across React effects, StateMachine, and WebSocket clients, and tears down camera/MediaPipe loops safely.
- **Hackathon MVP Rescue & Simplification (Target ASL Vocabulary & End-Session Screen):** Streamlined architecture from unstable multi-model complexity to a real-time, deterministic 3D kinematic ASL recognizer implementing target signs from the official reference chart (`YES`, `NO`, `PLEASE`, `THANK YOU`, `HELP`, `MORE`, `EAT`, `DRINK`, `PLAY`, `RESTROOM`, `STOP`, `GO`). Eliminated the confusing mode selector to launch directly into the live workspace. Built the full End-Session Experience matching Image 2 mockup with camera release, duration metric (`MM:SS`), confirmed signs count, transcript copy/download, and new session re-arming. Pinned MediaPipe tasks-vision to 0.10.14, resolved camera flip freeze, and verified 24/24 pytest and 9/9 Node unit test suites.
