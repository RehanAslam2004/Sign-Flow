# Prompt/context to provide during the `1-start` interview

First install the skill pack in the empty project directory and start the workflow by entering exactly `run 1-start` in Antigravity. When the skill asks you to introduce the idea, or when you need to provide the project context, paste the content below.

Read `AGENTS.md`, `RULES.md`, and `.agents/rules/signflow-design.md` first and keep them in context for this workspace.

This is a new project for Devpost's **Build With AI: Basics** hackathon. We must use the official Devpost Learn Skill Pack honestly, and the required planning documents must be created by the skills themselves. Do not begin coding the application yet.

Our idea is **SignFlow**, a browser-based sign-language communication product. The long-term vision is a full sign-language translator, but we need the skill pack to help us scope a realistic, honest proof of concept that completes one capability end to end. Do not claim full language coverage until it exists and has been tested. We have not yet locked the specific sign language, dataset, exact MVP vocabulary, or the inference deployment pattern; interview me and help decide these through the required skills rather than silently assuming them.

Our preferred technical direction, subject to `4-spec`, is Next.js App Router + React + TypeScript + Tailwind CSS + Lucide React for the web app; browser camera APIs; Python with MediaPipe/OpenCV/NumPy and scikit-learn for computer vision/ML; FastAPI where useful for inference/integration; browser SpeechSynthesis for text-to-speech; Vercel for the frontend and a Python-compatible host only if needed. We should keep the proof of concept small and avoid a database, authentication, admin panel, and unrelated features unless the approved scope requires them.

Team ownership:
- I (Rehan) own the frontend, application/backend integration and orchestration, text-to-speech, any optional speech-to-text approved in scope, responsive/accessibility QA, deployment, DevOps, and overall integration.
- My cousin owns the computer-vision/ML pipeline, dataset processing, classifier/inference, and model evaluation.
- Help us agree on a clear typed API/data contract during the technical-spec stage before either side integrates against it. Do not overwrite my cousin's CV/model work or change the contract without coordination.

Design requirements: very minimal, very easy to use, quick, calm and accessibility-first, with clean and consistent spacing and responsive behavior on mobile and desktop browsers. Brand colors are Pacific Cyan `#068D9D` and Dusty Grape `#53599A`, primarily on white `#FFFFFF` and a soft neutral surface `#F7FAFA`. Avoid decorative gradients—especially blue-purple gradients—AI-slop patterns, fake stats, excessive cards, and any decorative “AI-powered” or “AI magic” text badge. Use accessible contrast, readable typography, clear focus states, Lucide icons, meaningful camera/microphone states, and honest recognition feedback.

**During the `1-start` interview, follow the skill's questions and workspace checks.** Do not skip ahead, batch-answer the learner's questions on my behalf, generate application code, or hand-write `scope.md`, `prd.md`, or `spec.md`. Let the official skills lead us through `1-start` → `2-scope` → `3-prd` → `4-spec` → `5-build` → `6-ship`. Keep their generated planning artifacts in the location the skills choose (expected under `devpost/`) and preserve the status fields. Before any implementation, show me the proposed scope, product requirements and technical plan through the skill process and wait for my approval as directed by the skills.

For every later work session, read the persistent project instructions, inspect the current plans and Git status, identify the next approved step, work in a small verified slice, and report checks honestly. The final project must be explainable by our team, behave as shown in the 1–3 minute demo video, and be safe to publish in a public repository.
