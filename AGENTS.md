# SignFlow — Persistent Agent Instructions

These instructions apply to all work in this repository. Read `RULES.md`, `.agents/rules/signflow-design.md`, and the relevant generated planning files before making changes. Keep the Devpost Learn Skill Pack workflow intact; do not bypass it.

## 1. Product mission

**Product name:** SignFlow  
**Tagline:** Translate signs. Bridge conversations.

SignFlow is a browser-based accessibility product with the long-term vision of translating sign language into understandable text and speech, and eventually supporting communication in both directions. The product should make communication feel calm, dignified, and easy rather than technical.

**Hackathon context:** SignFlow is being created as a new proof of concept for Devpost's **Build With AI: Basics** hackathon. The submission must be created with the Devpost Learn Skill Pack and must include the planning documents the skills generate. The hackathon asks for a working proof of concept that completes at least one function end to end; it is not asking us to finish a production-grade universal sign-language interpreter.

Treat “full sign-language translator” as the product vision, not a claim about current prototype capability. The actual hackathon MVP must be honestly scoped through the Learn Skill Pack. Never advertise support for an entire sign language unless that capability has been implemented and properly evaluated.

## 2. Mandatory Devpost workflow — do not skip

The project must begin in a new, empty project folder. Node.js and Git must be installed.

1. In the empty project folder, install the official skills:
   `npx skills add challengepost/learn-ai-basics --all -y`
2. Open the workspace in Antigravity and invoke the skill by saying: `run 1-start`.
3. Follow the official skills in sequence as directed by the curriculum: `1-start`, `2-scope`, `3-prd`, `4-spec`, `5-build`, and `6-ship`.
4. Let the skills interview the learner, help define scope, and generate their own artifacts. Do not pre-write, replace, or fake the required planning documents.
5. Do not start application implementation until the learner has reviewed and approved the scope, PRD, and technical spec through the skill workflow.
6. Preserve the generated files under `devpost/` exactly where the skills put them, including `scope.md`, `prd.md`, `spec.md`, and later artifacts such as `checklist.md` and `app-map.html`.
7. Use the skills genuinely during development. Do not claim a step or tool was used if it was not.

This file and `RULES.md` provide persistent project context; they are not replacements for the official Devpost skill-pack workflow. If an instruction here conflicts with the active skill's required process, follow the skill's process and discuss any product/technical conflict with the learner rather than silently bypassing it.

## 3. Team ownership

### Rehan — product integration and application

Owns:
- Product decisions and cross-team coordination
- Next.js/React frontend and responsive UI
- Browser camera/microphone UX and permission states
- Application/backend integration and API contracts
- Text-to-speech and any approved speech-to-text interaction
- Accessibility behavior, error handling, testing and integration
- Deployment, environment configuration, Git workflow and demo preparation

### Cousin — computer vision and ML

Owns:
- Sign-language choice and dataset research with the team
- Dataset licensing/provenance and preprocessing
- MediaPipe/OpenCV landmark or feature extraction, as agreed
- Sign/gesture recognition model and inference implementation
- Evaluation and honest reporting of supported vocabulary/limitations
- CV module/service interface and model-specific tests

### Team integration rule

Agree on the CV/API interface during the `4-spec` stage before writing integration code. Record request/response fields, errors, timing expectations, supported signs/language, and ownership in the spec or an explicitly linked API contract. Do not independently rename or reshape a shared interface. Rehan owns the integration layer; the CV/ML owner owns the classifier and recognition logic.

## 4. Proposed technical direction

Use the Learn Skill Pack's planning steps to confirm the final stack before implementation. Current preferred direction:

- **Frontend:** Next.js App Router, React, TypeScript
- **Styling:** Tailwind CSS, with a small, consistent design-token system
- **Icons:** Lucide React; avoid emoji as UI icons
- **Camera:** Browser `getUserMedia` / standard browser media APIs
- **Computer vision:** Python, MediaPipe, OpenCV, NumPy as needed
- **ML:** scikit-learn for a feasible initial classifier; choose another framework only if the data and evaluation justify it
- **Service/integration:** FastAPI for Python model inference or integration where appropriate; finalize whether inference is browser-side or served by Python during `4-spec`
- **Text-to-speech:** Browser SpeechSynthesis API for the initial proof of concept if browser support and voice quality are adequate
- **Optional speech-to-text:** Browser Web Speech API or another suitable option only if the skill-driven scope includes the reverse direction
- **Deployment:** Vercel for the web frontend; use a Python-friendly host for the CV service only if the selected architecture needs one and it is tested
- **Data storage:** No database by default. Add persistence only when a documented MVP requirement needs it.

Do not use LLM text generation as a substitute for sign recognition. The recognition layer must state what signs it actually detects; a language layer may only transform already recognized tokens into readable wording under clear constraints. Never let an LLM invent or guess what a person signed.

### Architecture principles

- Keep the UI, camera/media handling, translation orchestration, CV/ML inference, and speech output separated into understandable modules.
- Agree on a typed, versioned request/response contract between the web app and the CV module/service before integration.
- Prefer low-latency processing and avoid sending/storing raw video unless required by the agreed design. Explain any camera-frame data transfer to the user.
- Handle permission denial, missing camera, no hands detected, unsupported/uncertain signs, network/service failure, and unavailable speech voices explicitly.
- Use confidence values only if they are meaningfully produced and calibrated. Never fabricate accuracy or show fake “98% confidence” claims.
- A local demo path may be considered if it reduces deployment risk, but it must use the real recognition pipeline—not a hardcoded result disguised as live AI.

## 5. Suggested repository structure — subject to `4-spec`

Do not create every directory in advance. Follow the approved spec and keep the initial project as small as possible. A possible organization is:

```text
/
├── AGENTS.md
├── RULES.md
├── .agents/
│   └── rules/
│       └── signflow-design.md
├── devpost/                 # Generated and maintained by official skills
│   ├── learner-profile.md
│   ├── scope.md
│   ├── prd.md
│   ├── spec.md
│   └── checklist.md
├── app/                     # Next.js routes/layouts
├── components/              # Reusable UI components
├── features/
│   └── translator/          # Translator-specific UI and state
├── lib/                     # API client, speech, shared utilities
├── types/                   # Shared TypeScript types/contracts
├── cv-service/              # Only if agreed; coordinated with CV owner
├── tests/
└── README.md
```

This is a guide, not a command to scaffold the whole tree before the skills approve the spec. Keep the CV/ML owner's module boundary clear and avoid unrelated folders.

## 6. Product behavior and truthfulness

- The main flow should be easy to discover: camera/signing → interpreted text → optional speech playback.
- The prototype must clearly name the supported sign language and supported scope once decided with the team.
- Sign languages are distinct languages, not interchangeable collections of hand poses. Do not assume ASL, PSL, BSL, or another language without the team deciding and documenting it.
- Be transparent about whether the app recognizes isolated signs, short sequences, or continuous signing. Do not label isolated gesture recognition as full sign-language translation.
- Do not invent signs, data sources, model performance, user research, citations, or capabilities.
- Keep the first usable path reliable. Any stretch feature must not destabilize the end-to-end demo.

## 7. Engineering workflow

Before every work session:
1. Read this `AGENTS.md`, `RULES.md`, and `.agents/rules/signflow-design.md`.
2. Inspect the current repository, the latest relevant `devpost/` plans/checklist, `git status`, and recent changes.
3. Identify the current approved stage and the smallest next task. Do not redo completed work or overwrite the CV owner's work.
4. State briefly what will change and how it will be verified.
5. Make focused changes; do not rewrite unrelated files or add dependencies without a clear reason.
6. Run relevant checks (lint, type-check, tests, build, or model checks) and report results honestly. Do not say tests passed if they were not run.
7. Update documentation/checklist when required by the Devpost skill process.

Never commit API keys, credentials, `.env` values, private user data, or model datasets whose licenses prohibit sharing. Use `.env.example` with placeholders when needed. Review the repository and Git history for secrets before public submission.

## 8. Definition of quality

A successful submission is not measured by the number of frameworks or screens. It is a small, comprehensible, honest proof of concept that:
- completes its chosen interaction end to end;
- behaves reliably in the recorded demo;
- is responsive and accessible;
- has a visually consistent, minimal design;
- has understandable code the team can explain;
- follows the required Devpost Learn Skill Pack workflow and retains its planning artifacts.
