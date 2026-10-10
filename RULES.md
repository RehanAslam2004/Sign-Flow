# SignFlow — Product, Design and Code Rules

These rules are mandatory unless the learner explicitly approves a documented change. The same core rules are also loaded by Antigravity from `.agents/rules/signflow-design.md`.

## A. Visual identity

### Brand palette
- **Pacific Cyan:** `#068D9D` — primary brand accent, key controls, active states, subtle links and highlights.
- **Dusty Grape:** `#53599A` — secondary accent used sparingly for secondary states or selective emphasis.
- **White:** `#FFFFFF` — primary canvas.
- **Soft neutral surface:** `#F7FAFA` — only where separation is helpful.
- **Primary text:** `#18292C`.
- **Secondary text:** `#526266`.
- **Borders/dividers:** `#DFE7E8`.

Pacific Cyan and Dusty Grape are brand colors, not permission to use blue-purple gradients. Use flat color. Check contrast for every text/background pairing. Where small white text does not meet contrast on Pacific Cyan, use dark text on the cyan or a darker, contrast-tested tint for the filled control. Do not quietly introduce a new accent palette.

### Strictly prohibited visual patterns
- No blue-to-purple, cyan-to-purple, or other decorative gradients.
- No rainbow/neon palettes, glowing backgrounds, cyberpunk effects, glassmorphism by default, or floating decorative blobs.
- No generic “AI slop” layouts, robot illustrations, random 3D objects, fake analytics, meaningless charts, fake testimonials, or placeholder statistics.
- No decorative text badges such as “AI POWERED”, “AI MAGIC”, “SMART AI”, “GENAI”, “NEXT-GEN AI”, or similar. Do not put “AI” in a pill/badge just to make the product sound advanced. Use status badges only when they communicate a real state such as “Camera connected” or “Service unavailable”.
- No emoji used as a substitute for proper interface icons. Use Lucide React icons with accessible labels.
- No excessive rounded cards, huge pills, heavy shadows, or borders around every section.

## B. Product design principles

- **Minimal first:** show only the controls needed for the current task.
- **Fast to use:** the primary interaction should be understandable within seconds; minimize steps, dialogs and repeated permissions.
- **Camera-first:** when the user is translating, make the signing/camera area and interpreted result the main focus.
- **Human language:** prefer “Hands detected”, “Sign unclear”, “Try again”, and “Speak translation” over implementation jargon like “Inference executing”.
- **Honest feedback:** no fake confidence percentages, fake live detections, placeholder translated sentences presented as real recognition, or success messages before success occurs.
- **User control:** let users start/stop the camera, see its state, retry errors, control speech playback, and clear any visible transcript.
- **Privacy-conscious:** never record/store camera or microphone streams by default. Do not persist conversations unless specifically scoped, explained and approved. Avoid shipping raw frames to a server when the agreed architecture can process more privately.
- **No overclaiming:** show which sign language and vocabulary/behavior are actually supported. Do not claim universal or continuous translation if the implementation supports only isolated signs or short sequences.

## C. Layout and spacing consistency

- Use a consistent 4/8 px spacing scale (or equivalent Tailwind spacing tokens); reuse shared tokens instead of improvising arbitrary margins for each component.
- Establish one spacing rhythm, predictable alignment, and a clear grid. Check the full page for uneven gaps, accidental blank regions, inconsistent padding, misaligned baselines, and overflow.
- Use deliberate max-widths for readable content. Align headings, content edges, form controls and primary actions.
- Use typography hierarchy rather than making every section large or bold. Body text must remain comfortably readable.
- Use whitespace intentionally; do not create giant empty areas that push the main action below the fold.
- Keep control sizes, border radii, focus rings, section gaps and button heights consistent across the product.
- Prefer one clear primary CTA per view. Secondary controls should look secondary.
- The translation output should be highly legible, with the interpreted sentence more prominent than internal technical details.

## D. Responsive behavior

Every screen must work on both desktop and mobile browsers, and should be checked at narrow, medium and wide viewports.

- Mobile must not be a squeezed desktop layout. Reflow intentionally into a single column when appropriate.
- Camera, transcript, buttons and dialogs must stay within viewport width; prevent horizontal scrolling.
- Keep touch targets comfortably large (aim for at least 44×44 CSS px when practical).
- Do not hide essential controls behind hover-only interactions.
- Ensure the camera remains usable in portrait and landscape where supported.
- Check long translated sentences, large text, keyboard focus, and error messages on small screens.
- Use consistent breakpoints and test around them; fix awkward gaps and sudden layout jumps.

## E. Accessibility

- Target WCAG 2.2 AA where practical, especially text contrast and keyboard operation.
- Semantic headings, landmarks, buttons, labels and form elements are required.
- All controls need visible keyboard focus and accessible names.
- Never rely on color alone to convey a state.
- Respect `prefers-reduced-motion`; motion must be subtle and purposeful.
- Support readable text resizing without clipping or breaking layouts.
- Announce meaningful translation/status changes to assistive technology without announcing every camera frame or flooding a screen reader.
- Provide visible camera/microphone status and explain permission errors in plain language.

## F. Motion and states

Use animation only to communicate a state change, detection, or playback. No constant motion or distracting effects. Provide reduced-motion alternatives.

Design and implement intentional states for:
- First visit/onboarding, if onboarding is necessary;
- Camera permission request, granted, denied, unavailable, and stopped;
- No hands/sign detected;
- Recognition in progress;
- Recognized sign/sequence;
- Ambiguous/unsupported sign;
- Speech playing, paused, finished, or unavailable;
- Service offline, timeout, and retry;
- Empty transcript and cleared transcript.

Do not use “AI is thinking…” as filler. Prefer specific, truthful states such as “Interpreting…” when processing is actually happening.

## G. Technical quality

- Use TypeScript for the web app and type shared API contracts.
- Keep components focused; separate presentation from camera control, network requests, translation state, and speech behavior.
- Reuse design tokens and components; do not duplicate near-identical styles across screens.
- Avoid dependency additions unless they solve a real, documented problem.
- Handle errors and clean up media tracks, event listeners, and speech playback when the relevant view unmounts or the user stops.
- Do not log raw camera frames, audio, API keys, or private transcript content.
- Validate API inputs and outputs. Handle timeouts and service failures visibly.
- Use environment variables for secrets. Commit no credentials, and never place private keys in client-side code.
- No hardcoded mock translations in the real live recognition path. A clearly labeled demo/sample state may exist only if the design and behavior make it impossible to confuse with live detection.
- Never report a lint, build, type check, test, or model evaluation as successful unless it was run and succeeded.

## H. Team boundaries and collaboration

- Rehan owns frontend, product integration/backend orchestration, speech behavior, responsive/accessibility QA, deployment and DevOps.
- The cousin owns the computer-vision/ML recognition pipeline and model evaluation.
- Agree on the API/data contract during the approved technical-spec stage. Do not change its field names or semantics unilaterally.
- Avoid editing or replacing the CV owner's model/data files without coordination.
- Do not create an elaborate admin dashboard, authentication system, database, analytics suite or unrelated pages unless the approved MVP explicitly requires one.

## I. Hackathon workflow and review

- The Devpost Learn Skill Pack is mandatory. Install it using the official command in a new project directory and invoke `run 1-start` before coding.
- Follow the pack's scope → PRD → spec → build → ship flow. The skills must create the required planning artifacts; never fabricate them or replace them with these instructions.
- Keep generated planning files and statuses intact. They are part of the public repository requirements.
- Do not start implementation while the scope, PRD and technical spec remain unreviewed/unapproved through the skill workflow.
- Build the smallest reliable end-to-end slice first. Stretch features are strictly secondary.
- Record the actual supported language, tested conditions, known limitations, install/run steps and demo path in the documentation.
- Review Git status and scan tracked files and history for secrets before publishing a public repository.
