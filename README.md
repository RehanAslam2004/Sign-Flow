# SignFlow — Translate signs. Bridge conversations.

> **Live Preview:** [https://sign-flow-kappa.vercel.app](https://sign-flow-kappa.vercel.app)  
> **Repository:** [https://github.com/RehanAslam2004/Sign-Flow](https://github.com/RehanAslam2004/Sign-Flow)  
> **Hackathon Submission:** Built for Devpost's *Build With AI: Basics* Hackathon.

---

## 🌟 Overview

**SignFlow** is an in-browser accessibility tool designed to bridge the communication gap between deaf or hard-of-hearing signers and hearing conversation partners. By using standard laptop or smartphone cameras—with no special gloves, sensors, or external hardware—SignFlow translates continuous sign language and core communication gestures into natural text and spoken audio in real time.

Built with an emphasis on **dignity, calm usability, and low latency**, SignFlow doesn't just display isolated hand shapes: it uses an intelligent bilingual grammar engine to assemble signs into complete, natural sentences (such as *"Hello, how are you?"*, *"Nice to meet you."*, and *"I am ill, I want to buy medicine."*).

---

## 🚀 Key Features

- **In-Browser Hand Landmark Extraction:** Uses MediaPipe Tasks Vision WebAssembly (`@mediapipe/tasks-vision`) to detect 21 3D hand coordinates in real time directly on the device.
- **Privacy by Design:** Video frames remain inside the local browser buffer; only numeric coordinate landmarks are processed.
- **Instant Dual-Track Recognition:** 
  - **Zero-Latency In-Browser Edge Classifier:** Detects core deictic and conversational signs instantly with calibrated geometric heuristics.
  - **High-Speed WebSocket Backend:** Connects to an optional FastAPI CV service for multi-class sign recognition over persistent WebSockets.
- **Fluent Conversational Sentence Formation:** An intelligent grammar engine transforms accumulated sign tokens into natural, grammatically correct English and Urdu sentences.
- **Text-to-Speech Voice Output:** Automatically voices translated sentences using the Web Speech Synthesis API, with one-tap replay controls.
- **Essential Deaf Communication Quick Bar:** Instant one-tap assistive shortcuts for critical phrases (e.g., medical needs, greetings, requests for assistance).
- **Session Lifecycle & Privacy Isolation:** Every conversation runs under an isolated session token (`crypto.randomUUID()`), completely wiping candidate buffers, transcripts, and media streams upon session completion.

---

## 🛠️ Architecture & Technology Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | [Next.js 14](https://nextjs.org/) (App Router), React 18, TypeScript |
| **Styling & UI** | [Tailwind CSS](https://tailwindcss.com/), [Lucide React](https://lucide.dev/) icons |
| **Computer Vision** | [MediaPipe Tasks Vision](https://developers.google.com/mediapipe/solutions/vision/hand_landmarker) (v0.10.14) |
| **Speech Engine** | Browser Web Speech API (`window.speechSynthesis`) |
| **Optional Inference Backend** | Python 3.10+, [FastAPI](https://fastapi.tiangolo.com/), WebSockets, NumPy, scikit-learn |
| **Deployment** | [Vercel](https://vercel.com/) |

---

## 📋 Verified Conversational Vocabulary

SignFlow is grounded in practical, everyday conversational and healthcare situations:

1. **Greetings & Social Interaction:**
   - `HELLO` + `YOU` / `Assalamulaikum` + `Ap` → *"Hello, how are you?"* (ہیلو، آپ کیسے ہیں؟)
   - `NICE` + `MEET` + `YOU` → *"Nice to meet you."* (آپ سے مل کر خوشی ہوئی۔)
   - `THANKS` + `YOU` → *"Thank you very much."* (آپ کا بہت شکریہ۔)
2. **Medical & Urgent Assistance:**
   - `Bemar` + `MEDICINE` + `BUY` → *"I am ill, I want to buy medicine."* (میں بیمار ہوں، مجھے دوائی خریدنی ہے۔)
   - `Bemar` + `MEDICINE` → *"I am ill, I need medicine."* (مجھے دوائی چاہیے۔)
   - `YOU` + `HELP` → *"Can you please help me?"* (کیا آپ میری مدد کر سکتے ہیں؟)
   - `WATER` → *"I need water, please."* (مجھے پانی چاہیے۔)

---

## 💻 Local Development Setup

### 1. Prerequisites
- **Node.js** v18.17+ or v20+
- **Git**

### 2. Clone and Install
```bash
git clone https://github.com/RehanAslam2004/Sign-Flow.git
cd Sign-Flow
npm install
```

### 3. Run the Development Server
```bash
npm run dev:next
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Run Automated Test Suites
SignFlow includes 9 automated unit and integration test suites:
```bash
npm test
```
- Session lifecycle & privacy isolation
- In-browser client classifier heuristics
- Pakistan Sign Language & ASL mappings
- Grammar engine & bilingual formatter
- Recognition reliability & temporal stabilization
- 3D deictic pointing recognition
- TranscriptManager sentence deduplication
- Deaf practical communication sentences

### 5. Production Build
```bash
npm run build
```

---

## 📁 Repository Structure

```text
/
├── app/                     # Next.js App Router (pages, layout, API routes)
│   ├── page.tsx             # Main SignFlow application & translation canvas
│   ├── layout.tsx           # Metadata and font setup
│   └── api/
│       └── suggest-replies/ # Contextual reply suggestion endpoint
├── components/              # Modular React UI components
│   ├── CameraViewport.tsx   # Video element with hand landmark canvas overlay
│   ├── TranscriptView.tsx   # Dual-layer conversation transcript with audio replay
│   ├── SessionControlBar.tsx# Camera flip, end session, and clear controls
│   └── ErrorBanner.tsx      # Dignified permission & connection recovery UI
├── lib/                     # Core business logic and engine
│   ├── bilingualFormatter.ts# English/Urdu dual-layer sentence formatter
│   ├── clientClassifier.ts  # Zero-latency in-browser geometric classifier
│   ├── grammarEngine.ts     # Deterministic conversational grammar rules
│   ├── mediapipe.ts         # MediaPipe HandLandmarker lifecycle & inference
│   ├── speech.ts            # SpeechSynthesis wrapper with session protection
│   ├── stateMachine.ts      # Multi-frame consensus & temporal stabilization
│   └── websocketClient.ts   # Resilient WebSocket client with auto-reconnect
├── cv-service/              # Optional Python FastAPI inference service
│   ├── main.py              # WebSocket endpoint /ws/predict
│   ├── inference.py         # Model loading and landmark prediction
│   └── preprocessing.py     # Canonical normalization and feature extraction
├── devpost/                 # Hackathon planning artifacts (Devpost Learn Pack)
│   ├── scope.md             # Project scope and core proof-of-concept boundary
│   ├── prd.md               # Product Requirements Document
│   ├── spec.md              # Technical Specification & system architecture
│   └── checklist.md         # Slices and verification checkpoints
├── tests/                   # TypeScript test suites
└── README.md                # Project documentation
```

---

## 📖 Devpost Hackathon Planning Documents

In accordance with the Devpost **Build With AI: Basics** curriculum, all planning documents generated during the project lifecycle are preserved in the [`devpost/`](./devpost/) folder:
- [Scope Document](devpost/scope.md) — Problem definition, core journey, and PoC boundary.
- [Product Requirements Document](devpost/prd.md) — User journeys, state transitions, and error handling.
- [Technical Specification](devpost/spec.md) — System architecture, data contracts, and component design.
- [Build Checklist](devpost/checklist.md) — Incremental slice plan and verification milestones.

---

## 🔒 Privacy & Safety

SignFlow does not record, upload, or store video streams or camera frames. Hand landmarks are extracted locally in the client browser using WebAssembly. Camera access is requested only when starting a translation session and is immediately released when the session ends or the window is closed.

---

## 👥 Authors

- **Muhammad Rehan** ([@RehanAslam2004](https://github.com/RehanAslam2004)) — Product integration, Next.js frontend, state machine, accessibility, deployment.
- **Team Partner / ML Contributor** — Computer vision pipeline, dataset research, and model normalization.

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
