---
doc: prd
status: approved
---

# SignFlow — Product Requirements

A browser-based Pakistan Sign Language (PSL) communication tool that recognizes live webcam signing for a verified vocabulary, presents a running conversation transcript, and speaks translated utterances aloud.
Source: `scope.md > The Unique Kernel` and `scope.md > Who It's For`.

## The Core Journey

1. **Arrival & Situation Choice:** The user opens SignFlow and sees a clean landing surface with the logo, the headline *"Let's make conversation flow"*, and two clear mode cards: *"I'm the one signing"* and *"Someone with me is signing"*.
2. **Camera Initialization:** Selecting a mode requests camera permission just-in-time and opens the translator. On mobile, *"I'm the one signing"* defaults to the front-facing camera, while *"Someone with me is signing"* defaults to the rear camera. On desktop, the default webcam is initialized.
3. **Framing & Readiness:** The live camera view displays a subtle hand-positioning guide. The interface confirms when hands are detected in frame.
4. **Live Signing & Preview:** As the user signs, the application displays a subtle, live candidate preview of the detected sign without immediately committing it to the conversation transcript.
5. **Debounced Sign Commit:** When a supported PSL sign is held stably within the confidence and stability window (~500–800ms) and reaches a gesture boundary (or returns to rest), the word is committed to the active utterance and transcript exactly once. Holding the pose does not duplicate words.
6. **Utterance Formation & Speech:** Confirmed signs accumulate into an active message. When the signer pauses (~1–1.5s) or clicks *"Finish & Speak"*, the browser speaks the accumulated text aloud (if auto-speech is enabled).
7. **Dialogue Persistence & Review:** The translated message remains visible in the running conversation transcript with controls to replay speech. Both conversation partners can read and follow along.
8. **Session Continuation or Reset:** The user continues signing the next message, switches cameras if needed, or explicitly ends/resets the conversation.

## Screens and Layout

### 1. Landing / Mode Selection Surface
- **Header:** SignFlow logo, headline (*"Let's make conversation flow"*), brief subtitle explaining sign-language communication support.
- **Mode Cards:**
  - Card A: *"I'm the one signing"* — short explanation that signs will be translated to text and speech; sets front-camera preference on mobile.
  - Card B: *"Someone with me is signing"* — short explanation for pointing the camera at a signing partner; sets rear-camera preference on mobile.
- **Privacy notice:** Clear statement that video is processed in real time and never recorded or stored.

### 2. Main Translator Surface
- **Desktop Layout:** Balanced two-column view.
  - **Left column:** Prominent live camera viewport with hand-framing guides, live status badge (*"Recognizing"*, *"Sign confirmed"*, *"Ready to speak"*), and subtle interim candidate preview.
  - **Right column:** Active translation display, audio speech controls (*Auto-speak toggle*, *Speak*, *Replay*), and the running conversation transcript.
- **Mobile Layout:** Natural vertical stack.
  - Live camera view at the top.
  - Active recognized message & primary speech controls in the middle.
  - Scrollable conversation transcript below.
- **Session Control Bar:** Compact, non-intrusive toolbar providing:
  - *Switch camera* (toggles between front/rear or desktop video devices without erasing transcript).
  - *End conversation* (stops camera, releases stream, stops audio).
  - *New conversation / Clear* (resets transcript with confirmation if messages exist).
  - *Change mode* (returns to landing selection).

## Look and Feel

- **Aesthetic:** Calm, dignified, accessible health-grade product; zero generic AI gimmicks.
- **Color Palette:**
  - Canvas / Background: Pure White (`#FFFFFF`) and Light Neutral slate (`#F8FAFC`, `#F1F5F9`).
  - Primary Brand / Action: Pacific Cyan (`#068D9D`).
  - Secondary Accent / Status: Dusty Grape (`#53599A`).
  - Typography & Borders: Deep Slate (`#1E293B`, `#475569`, border `#E2E8F0`).
- **Typography:** Modern, highly legible sans-serif with strong hierarchy and accessible sizing (min 16px body, large high-contrast translation text).
- **Anti-patterns:** No AI badges ("POWERED BY AI"), no purple-neon gradients, no glassmorphism, no fabricated confidence statistics (e.g. "98.4% accurate").

## Features and Behavior

### Mode Selection & Camera Setup
- Source: `scope.md > The Core Loop`.
- The user selects how the app will be used rather than disclosing their personal hearing status.
- Camera permission is prompted strictly upon mode activation.
- Front/rear camera preference is automatically applied on mobile where hardware supports it.

### Recognition State Machine & Gesture Boundaries
- Source: `scope.md > The POC Boundary`.
- Continuous webcam frame analysis against the verified PSL model.
- **Candidate Preview:** Shows an unobtrusive preview of the tentative sign currently tracked.
- **Stability Window:** Prediction must remain consistent across a configurable time window (~500–800ms) before qualification.
- **Boundary & Rest Reset:** A sign is committed only once upon boundary detection or movement toward rest. The recognizer disarms until a neutral posture or a distinct subsequent gesture is observed, eliminating duplicate words.
- **Uncertain Signs:** If signing is detected but confidence is inadequate, SignFlow displays a gentle *"Sign not recognized — try signing again"* notice rather than guessing.

### Utterance Accumulation & Speech Synthesis
- Source: `scope.md > The Core Loop`.
- Individual confirmed signs accumulate sequentially in the active utterance buffer.
- **Speech Trigger:** If auto-speech is enabled, speech triggers after an idle pause (~1–1.5s) following a confirmed sign, or immediately when the user taps *"Finish & Speak"*.
- **Speech Controls:**
  - Auto-speak toggle (enabled by default).
  - Manual *"Speak"* button.
  - *"Replay"* button on active and historical transcript items.
- Speech failure (unsupported browser voice or audio error) displays an informative banner while keeping the recognized text intact.

### Conversation Transcript & History
- Source: `scope.md > The Core Loop`.
- Each confirmed utterance is timestamped and appended to the visible conversation transcript.
- Text remains visible indefinitely during the active session.
- Transcript is ephemeral in memory; ending a session offers the option to view the final transcript or clear it.

### Suggested Sign Replies (Partner Mode Exclusively)
- Source: `scope.md > The POC Boundary`.
- Purpose: Help a hearing conversation partner respond to a signing partner whose message SignFlow has translated.
- **Strict Mode Gating:** Active ONLY when `mode === 'partner'` ("Someone with me is signing"). Never rendered, triggered, or queried in "I'm the one signing" mode.
- **Trigger & Deduplication:** Triggers exclusively on newly committed transcript messages. Live fluctuating predictions or identical repeated messages do not fire repeat requests.
- **Contextual Suggestions:** Presents 2–4 concise, contextually relevant response options (e.g., offering help, confirming understanding, asking for clarification).
- **Verified PSL Reference Detail:** Selecting a reply opens a mobile-friendly detail view showing the full response, intended meaning, step-by-step signing instructions, and visual demonstrations if available.
- **Truthful Validation Status:** When visual assets are not yet verified or recorded, the UI clearly displays "Verified sign demonstration not available yet" rather than fabricated gestures. LLMs are never permitted to hallucinate hand signs.
- **Session Cleanup:** Switching modes, clearing transcripts, or ending the session clears suggestions and aborts pending requests.

### Session Management & Recovery
- Session states: `Ready` → `Camera starting` → `Translating` → `Paused/Error` → `Ended`.
- Switching cameras pauses recognition briefly, switches the video source, and resumes without losing conversation history.
- Ending a conversation explicitly releases the browser media stream and halts recognition workers.

## States and Boundaries

- **First Arrival:** Landing view with mode selection cards; camera is inactive.
- **Camera Permission Prompting:** Displayed when user taps a mode card.
- **Camera Denied:** Friendly in-frame empty state:
  - Title: *"Camera access is needed"*
  - Body: *"SignFlow needs camera access to recognize signing. Allow camera access in your browser settings, then try again."*
  - Actions: *"Try again"* button and *"How to enable camera access"* guidance.
- **Camera Disconnected / Unavailable:**
  - Title: *"Camera disconnected"*
  - Body: *"Your camera stopped working. Reconnect it or choose another camera to continue."*
  - Actions: *"Reconnect camera"* and *"Switch camera"*. Transcript is preserved.
- **No Hands in Frame:**
  - Immediate: Camera stream active with subtle guide frame.
  - After short pause: Subtle hint *"Position your hands in the camera frame"*.
  - After extended pause: *"We can't see your hands yet — move into frame and ensure hands are visible."* Resumes immediately when hands appear.
- **Unclear / Unsupported Sign:**
  - Status: *"Sign not recognized"*
  - Body: *"Try signing again, or make sure the sign is supported."* Does not write to transcript.
- **Long Inactivity / Thinking Pause:**
  - Status: *"Ready when you are"*. Transcript remains completely intact.
- **Session Ended:** Camera stream stopped, hardware indicator turns off, clean option to start fresh or keep reading current transcript.

## Product Decisions

- **Use-Case Selection over Identity Labels:** Modes are based on physical setup (*"I'm signing"* vs. *"Someone with me is signing"*) instead of requiring users to label themselves as deaf or hearing.
- **Stability Window + Neutral Reset:** Prevents rapid prediction flickering and stops held signs from spamming duplicate words into the transcript.
- **Utterance-Level Speech rather than Word-by-Word:** Waiting for an utterance boundary or brief pause creates human-sounding phrases rather than robotic, overlapping audio bursts.
- **Suggested Sign Replies (Partner Mode):** Contextually recommends verified responses to help hearing partners reply to recognized signing; rigorously bounded to verified PSL catalogue with truthful pending-verification notices.
- **Privacy-First Ephemeral Video:** Camera frames are evaluated in memory and discarded immediately; no video or audio is ever recorded, transmitted for storage, or saved to a database.

## What We're Building

1. Landing surface with two use-case cards (*"I'm the one signing"* / *"Someone with me is signing"*).
2. Just-in-time camera permission handling and intelligent device orientation (front vs. rear camera).
3. Responsive desktop two-column and mobile stacked translator layout.
4. Real-time PSL recognition pipeline for an isolated vocabulary of 8–12 verified signs.
5. Recognition state machine with candidate preview, 500–800ms stability check, and gesture-boundary / rest reset.
6. Utterance builder with pause-based auto-speech and manual *"Finish & Speak"* control.
7. Text-to-speech integration with replay and auto-speech toggle.
8. Persistent in-session conversation transcript.
9. Comprehensive, dignified recovery states (permission denied, camera disconnected, no hands detected, unconfirmed sign).
10. Session controls (switch camera, end session, clear transcript, change mode).
11. Suggested Sign Replies (strictly partner mode): 2–4 contextual reply suggestions with verified PSL sign reference detail viewer and clear pending-verification disclaimers.

## Deferred From the POC

- **Large-Scale Video Clip Production:** Broad studio video recording of hundreds of colloquial PSL phrases deferred to subsequent releases.
- **In-line Transcript Editing:** Deferred; read-and-replay meets the proof-of-concept need without adding text editing complexity.
- **Speech-to-Text Reverse Communication:** Deferred; out of scope for the single-direction hackathon prototype.
- **User Accounts and Saved Conversation History:** Deferred; no database or login required for the core loop.
- **Continuous PSL Sentence Grammar Parsing:** Deferred; the POC proves verified isolated word recognition with utterance accumulation.

## Possible Later Enhancements

- **Visual Reply Drawer:** Tap-to-learn verified PSL response clips (e.g. *"Thank you"*, *"Here you go"*).
- **Urdu & English Bilingual Interface:** Full bilingual localization for the Pakistani community.
- **Expanded PSL Vocabulary:** Expanding beyond the initial 8–12 word proof-of-concept vocabulary to everyday domain sets (medical, retail, transport).

## Non-Goals

- Guessing signs or generating synthetic sign animations using an LLM.
- Claiming universal sign language translation or full continuous PSL syntax recognition in this initial prototype.
- Storing or streaming user video to external cloud servers.
- Adding complex onboarding wizards or user registration forms.

## Open Questions

1. **PSL Sign Selection:** Finalize the exact 8–12 words with the CV/ML owner based on available, licensed PSL dataset coverage and community verification.
2. **Inference Architecture (to be decided in `4-spec`):** Determine whether MediaPipe + model runs entirely client-side in the browser or communicates with a lightweight local/cloud Python inference service.
