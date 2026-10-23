/**
 * Test Suite: SignFlow Recognition Reliability & Robustness
 *
 * Verifies:
 * 1. Time-decayed sliding window consensus & transient glitch suppression.
 * 2. Confidence margin hysteresis (rejecting ambiguous near-ties).
 * 3. Rapid transition between genuinely different signs.
 * 4. Held gesture duplicate suppression and distinct re-arming.
 * 5. Chirality / Handedness normalization in client classifier.
 * 6. Diagnostics telemetry snapshot accuracy.
 */

import { RecognitionStateMachine } from '../lib/stateMachine';
import { normalizeClientLandmarks, classifyHandFeatures } from '../lib/clientClassifier';
import { PredictionEvent } from '../types/contract';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('=== Starting Recognition Reliability & Temporal Stabilization Test Suite ===\n');

// ---------------------------------------------------------------------------
// 1. Time-decayed consensus & Glitch Suppression
// ---------------------------------------------------------------------------
console.log('Test 1: Glitch suppression via time-decayed consensus...');
let confirmedSigns: string[] = [];
let previewCandidate: string | null = null;

const sm = new RecognitionStateMachine({
  onCandidatePreview: (sign) => { previewCandidate = sign; },
  onSignConfirmed: (sign) => { confirmedSigns.push(sign); },
  onUtteranceComplete: () => {},
  onStatusChange: () => {},
}, 'test-session-reliability');

const baseTime = Date.now();
const makePred = (sign: string, conf: number, margin: number = 0.35, offsetMs: number = 0): PredictionEvent => ({
  schema_version: '1.0',
  session_id: 'test-session-reliability',
  frame_id: 1,
  timestamp: baseTime + offsetMs,
  status: 'recognized',
  sign,
  confidence: conf,
  margin,
  is_candidate: true,
});

// Stream 3 frames of Assalamulaikum
sm.processPrediction(makePred('Assalamulaikum', 0.85, 0.30, 0));
sm.processPrediction(makePred('Assalamulaikum', 0.86, 0.30, 40));
// Sudden 1-frame transient glitch
sm.processPrediction(makePred('GLITCH', 0.60, 0.10, 80));
// Back to Assalamulaikum
sm.processPrediction(makePred('Assalamulaikum', 0.88, 0.30, 120));

assert(!confirmedSigns.includes('GLITCH'), 'Glitch frame must not confirm');
console.log('✓ Passed: Transient glitches rejected by consensus buffer.');

// ---------------------------------------------------------------------------
// 2. Margin Hysteresis (Ambiguity Rejection)
// ---------------------------------------------------------------------------
console.log('\nTest 2: Margin hysteresis rejects ambiguous near-ties...');
confirmedSigns = [];
sm.reset('test-session-reliability');

// Send prediction where top-1 is 0.52 and top-2 is 0.49 (margin = 0.03 < 0.12)
sm.processPrediction(makePred('Alif', 0.52, 0.03, 0));
sm.processPrediction(makePred('Alif', 0.53, 0.04, 40));
sm.processPrediction(makePred('Alif', 0.54, 0.03, 80));

assert(!confirmedSigns.includes('Alif'), 'Ambiguous margin (< 0.12) must not commit');
const snapshot = sm.getDiagnosticsSnapshot();
assert(snapshot.rejectionReason === 'ambiguous_margin', `Rejection reason must be ambiguous_margin, got: ${snapshot.rejectionReason}`);
console.log('✓ Passed: Ambiguous margins properly rejected with diagnostics status.');

// ---------------------------------------------------------------------------
// 3. Held Gesture Duplicate Suppression & Re-arming
// ---------------------------------------------------------------------------
console.log('\nTest 3: Held gesture duplicate suppression and distinct re-arming...');
confirmedSigns = [];
sm.reset('test-session-reliability');

// Send high-confidence sign
sm.processPrediction(makePred('Assalamulaikum', 0.95, 0.40, 0));
// Hold it across 600ms
for (let t = 50; t <= 600; t += 50) {
  sm.processPrediction(makePred('Assalamulaikum', 0.95, 0.40, t));
}

assert(confirmedSigns.filter(s => s === 'Assalamulaikum').length === 1,
  `Assalamulaikum must commit exactly once while held, got ${confirmedSigns.length}`);
const holdSnapshot = sm.getDiagnosticsSnapshot();
assert(holdSnapshot.lifecycleState === 'committed_hold', 'Lifecycle must be committed_hold');
console.log('✓ Passed: Held gesture commits exactly once without duplicate spamming.');

// Now simulate hand retraction / rest for 300ms
const noHandsEvent: PredictionEvent = {
  schema_version: '1.0',
  session_id: 'test-session-reliability',
  frame_id: 99,
  timestamp: baseTime + 700,
  status: 'no_hands',
  sign: null,
  confidence: 0,
  is_candidate: false,
};
sm.processPrediction(noHandsEvent);

// Inactivity > 400ms resets lock
sm.processPrediction({ ...noHandsEvent, timestamp: baseTime + 1200 });

// User performs Assalamulaikum again intentionally!
for (let t = 1300; t <= 1800; t += 50) {
  sm.processPrediction(makePred('Assalamulaikum', 0.95, 0.40, t));
}
assert(confirmedSigns.filter(s => s === 'Assalamulaikum').length === 2,
  'Assalamulaikum should commit a second time after hand retraction');
console.log('✓ Passed: Recognizer cleanly re-arms for intentional repeated gestures.');

// ---------------------------------------------------------------------------
// 4. Rapid Transition Between Genuinely Different Signs
// ---------------------------------------------------------------------------
console.log('\nTest 4: Rapid transition between different signs...');
// Transition directly from Assalamulaikum to Ap
for (let t = 1900; t <= 2400; t += 50) {
  sm.processPrediction(makePred('Ap', 0.95, 0.40, t));
}
assert(confirmedSigns.includes('Ap'), 'Transitioning to different sign must commit without delay');
console.log('✓ Passed: Rapid transitions between different signs preserved.');

// ---------------------------------------------------------------------------
// 5. Chirality / Handedness Normalization in Client Classifier
// ---------------------------------------------------------------------------
console.log('\nTest 5: Chirality normalization in client classifier...');
// Generate synthetic right-hand landmarks
const rightLms = Array.from({ length: 21 }, (_, i) => ({ x: 0.5 + i * 0.01, y: 0.5, z: 0.0 }));
// Left-hand landmarks with mirrored x coordinates relative to center
const leftLms = Array.from({ length: 21 }, (_, i) => ({ x: 0.5 - i * 0.01, y: 0.5, z: 0.0 }));

const rightNorm = normalizeClientLandmarks(rightLms, 1280, 720, 'Right');
const leftNorm = normalizeClientLandmarks(leftLms, 1280, 720, 'Left');

// With left-hand chirality correction, the relative normalized x-coordinates align!
assert(Math.abs(rightNorm[10][0] - leftNorm[10][0]) < 1e-4,
  'Left hand normalized coordinates must mirror right hand coordinates');
console.log('✓ Passed: Handedness/chirality normalization verifies geometric alignment.');

// ---------------------------------------------------------------------------
// 6. Diagnostics Telemetry Snapshot
// ---------------------------------------------------------------------------
console.log('\nTest 6: Diagnostics snapshot accuracy...');
const diag = sm.getDiagnosticsSnapshot();
assert(typeof diag.effectiveFps === 'number', 'effectiveFps must be number');
assert(typeof diag.consensusRatio === 'number', 'consensusRatio must be number');
assert(diag.lastCommittedSign === 'Ap', 'lastCommittedSign must be Ap');
console.log('✓ Passed: Diagnostics telemetry snapshot fully accurate.');

console.log('\n=== All Recognition Reliability Tests Passed Successfully! ===\n');
