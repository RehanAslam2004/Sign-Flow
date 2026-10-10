---
doc: scope
status: approved
---

# SignFlow

A browser-based Pakistan Sign Language (PSL) word recognizer that interprets live signing through a webcam, displays the translated word, and speaks it aloud.

## The Unique Kernel

SignFlow uses a normal laptop or phone camera to recognize PSL signs and speak the result — no special hardware, gloves, or interpreters required. It is honest about what it can and cannot recognize, treats sign language as a real language rather than a collection of hand poses, and is designed as a dignified accessibility tool rather than a flashy AI demo.

## Who It's For

A deaf or hard-of-hearing person in Pakistan who uses Pakistan Sign Language and needs to communicate something to a hearing person who does not understand PSL — at a hospital, a shop, a school, or in everyday conversation. Today, they often rely on a human interpreter or struggle through gestures and written notes. SignFlow gives them a way to sign naturally and have the meaning spoken aloud.

## The Core Loop

1. Open SignFlow in a browser — the interface immediately shows where to sign and where the translation appears.
2. Start the camera — a live feed opens with guidance on hand positioning, confirmation when hands are detected.
3. Sign a word — the application recognizes the PSL sign, displays the corresponding word clearly, and offers to speak it aloud.
4. Trigger speech — the browser says the word.
5. Sign the next word, or repeat.

The person signs, sees the result, hears it spoken, and moves on. No configuration, no accounts, no setup beyond camera permission.

## Inspiration & Identity

- **Feel:** Calm, minimal, dignified — a thoughtful accessibility product, not a futuristic AI toy.
- **Design:** White canvas, Pacific Cyan `#068D9D` primary, Dusty Grape `#53599A` secondary accent. Clean spacing, strong typographic hierarchy, no decorative gradients or AI badges. Fully responsive — mobile must not feel like squeezed desktop.
- **Anti-patterns:** No blue-purple gradients, no fake statistics, no glassmorphism, no "AI POWERED" badges, no meaningless confidence percentages.
- **Reference mood:** Something closer to a well-designed health or accessibility app than a tech demo. Detailed design direction documented in RULES.md.

## Why This Matters to the Learner

"The idea came to me when I started thinking about how difficult ordinary interactions can become when two people do not share a language. Imagine a deaf person going to a hospital, visiting a shop, asking for directions… I want to explore whether we can use computer vision and AI to make these interactions easier using a normal laptop or mobile camera." Rehan also wants to learn a reliable workflow for keeping an AI agent on track across a project — the plan-first process is the practice.

## What "Working" Looks Like

A 1–2 minute live demo, recorded with a real person and a real webcam:

1. Open SignFlow — the reviewer sees the clean, branded interface.
2. Click "Start Translating" — camera opens, hands-detected state confirms readiness.
3. Perform the verified PSL sign for **"Hello"** — SignFlow displays "Hello," speaks it aloud.
4. Perform the verified PSL sign for **"Water"** — displays "Water," speaks it.
5. Perform the verified PSL sign for **"Help"** — displays "Help," speaks it.

The recognition comes from the actual model, not hardcoded demo steps. The interface shows sensible feedback for hands-not-detected and uncertain results. The reviewer watches a person sign, sees the app interpret it, reads the word, and hears the spoken output. That is the "oh, that's cool" moment.

Specific signs in the demo are subject to dataset verification — substitute any sign that the model actually supports and that a knowledgeable PSL signer can validate.

## The POC Boundary

**In:**
- Live webcam capture via browser camera APIs
- PSL sign recognition for a small verified vocabulary (~8–12 words: e.g., hello, help, yes, no, water, food, thank you, stop — subject to dataset availability and PSL validation)
- MediaPipe hand landmarks + lightweight classifier (approach subject to 4-spec; must fit the selected data)
- Translated word displayed in a clear, prominent text area
- Browser text-to-speech (SpeechSynthesis API) to speak the recognized word
- Honest recognition states: hands detected, sign recognized, uncertain/unsupported, camera off/denied
- Stable display — no rapid flickering between predictions or accidental repeated speech
- Responsive layout: desktop and mobile browsers
- Accessible: keyboard-operable, proper contrast, semantic HTML, screen-reader announcements for recognition results

**Conditional on investigation (first tasks before committing to full vocabulary):**
- PSL dataset feasibility: existence, licensing, quality, label coverage for target words
- PSL sign verification with a knowledgeable signer where possible
- Technical spike: webcam → MediaPipe → classifier → text → speech pipeline working end-to-end with at least 2–3 signs before expanding vocabulary

## Later

- Reverse direction: hearing person speaks → speech-to-text → displayed for the deaf person
- Conversation mode with lightweight transcript
- Larger PSL vocabulary beyond the initial ~8–12 words
- Sequence/phrase recognition (multiple signs forming a grammatical sentence)
- Two-handed and motion-dependent sign support beyond what the initial classifier handles
- Translation history, language preferences, voice settings
- Text-size controls, high-contrast mode, additional accessibility settings
- User onboarding/tutorial for first-time signers
- Multi-language UI (Urdu, English)
- Collecting additional PSL samples with consent for model improvement

## Explicitly Cut

- **Continuous sign-language translation** — the PoC recognizes isolated signs, not continuous signing. We will not label it "translation" in the UI unless the recognized output has been genuinely translated. Cut because honest scope requires distinguishing word recognition from language translation.
- **User accounts, authentication, database** — no login, no persistence, no stored data. Cut because the core loop doesn't need them and they add complexity without proving the kernel.
- **Admin panel, analytics dashboard, payment** — not relevant to a PoC. Cut to keep focus.
- **Speech-to-text / reverse communication** — explicitly deferred to keep the hackathon deliverable focused on one reliable direction.
- **Recording or storing camera/video streams** — privacy-first. Camera frames are processed and discarded. Cut because storing video adds risk without PoC value.
- **Multiple sign languages in one release** — we pick PSL (or a documented fallback) and support one language honestly. Cut because mixing languages would undermine accuracy claims.
- **Hardcoded or faked recognition results** — the demo must show real model output. Cut because honesty is non-negotiable.
