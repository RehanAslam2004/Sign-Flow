/**
 * SignFlow Pointing & Unified Recognition Test Suite
 *
 * Validates:
 * 1. 3D pointing toward camera -> "YOU" / "Ap"
 * 2. 3D pointing toward self -> "ME" / "Mujhay"
 * 3. 3D pointing downward/spatial -> "THIS" / "Ye"
 * 4. 3D pointing upward -> "Alif" / "HELP"
 * 5. Multi-finger non-pointing gestures do not falsely trigger deixis
 * 6. Sentence formation with deictic pronouns
 * 7. In-browser client inference under unified mode
 */

import assert from 'node:assert';
import { analyzePointingLandmarks } from '../lib/pointingAnalyzer';
import { runClientInference, classifyHandFeatures } from '../lib/clientClassifier';
import { formatSentence } from '../lib/bilingualFormatter';
import { FramePayload, LandmarkPoint } from '../types/contract';

function makeBaseHand(): LandmarkPoint[] {
  const landmarks: LandmarkPoint[] = [];
  for (let i = 0; i < 21; i++) {
    landmarks.push({ x: 0.5, y: 0.6, z: 0.0 });
  }
  // Wrist at (0.5, 0.7, 0.0)
  landmarks[0] = { x: 0.5, y: 0.7, z: 0.0 };
  // Middle MCP (index 9) at (0.5, 0.5, 0.0)
  landmarks[9] = { x: 0.5, y: 0.5, z: 0.0 };
  return landmarks;
}

function makePointingHand(tipDx: number, tipDy: number, tipDz: number): LandmarkPoint[] {
  const landmarks = makeBaseHand();
  // Index MCP (5) at (0.48, 0.5, 0.0)
  landmarks[5] = { x: 0.48, y: 0.5, z: 0.0 };
  landmarks[6] = { x: 0.48 + tipDx * 0.33, y: 0.5 + tipDy * 0.33, z: tipDz * 0.33 };
  landmarks[7] = { x: 0.48 + tipDx * 0.66, y: 0.5 + tipDy * 0.66, z: tipDz * 0.66 };
  // Index Tip (8)
  landmarks[8] = { x: 0.48 + tipDx, y: 0.5 + tipDy, z: tipDz };

  // Curled middle, ring, pinky (tips close to wrist)
  landmarks[12] = { x: 0.51, y: 0.62, z: 0.0 };
  landmarks[13] = { x: 0.53, y: 0.52, z: 0.0 };
  landmarks[16] = { x: 0.53, y: 0.63, z: 0.0 };
  landmarks[17] = { x: 0.55, y: 0.54, z: 0.0 };
  landmarks[20] = { x: 0.55, y: 0.65, z: 0.0 };

  return landmarks;
}

function runTests() {
  console.log('=== Starting Pointing & Unified Recognition Test Suite ===\n');

  // Test 1: Pointing toward camera (YOU / Ap)
  console.log('Test 1: 3D Pointing toward camera (addressee)...');
  // tipDz is negative (-0.35) -> pointing forward toward camera lens
  const cameraHand = makePointingHand(0.0, 0.0, -0.35);
  const camResult = analyzePointingLandmarks(cameraHand, 'Right');

  assert.strictEqual(camResult.isPointing, true);
  assert.strictEqual(camResult.gestureType, 'point_addressee');
  assert.strictEqual(camResult.candidatePSL, 'Ap');
  assert.strictEqual(camResult.candidateEN, 'YOU');
  assert.ok(camResult.confidence >= 0.70, `Expected conf >= 0.70, got ${camResult.confidence}`);
  assert.ok(camResult.margin >= 0.15, `Expected margin >= 0.15, got ${camResult.margin}`);
  console.log(`✓ Passed: Forward pointing recognized as "${camResult.candidatePSL}" / "${camResult.candidateEN}" (conf: ${camResult.confidence}).\n`);

  // Test 2: Pointing toward self / chest (ME / Mujhay)
  console.log('Test 2: 3D Pointing toward self / chest...');
  // tipDz is positive (+0.28) -> pointing inward toward torso
  const selfHand = makePointingHand(0.0, 0.0, 0.28);
  const selfResult = analyzePointingLandmarks(selfHand, 'Right');

  assert.strictEqual(selfResult.isPointing, true);
  assert.strictEqual(selfResult.gestureType, 'point_self');
  assert.strictEqual(selfResult.candidatePSL, 'Mujhay');
  assert.strictEqual(selfResult.candidateEN, 'ME');
  assert.ok(selfResult.confidence >= 0.70, `Expected conf >= 0.70, got ${selfResult.confidence}`);
  console.log(`✓ Passed: Inward pointing recognized as "${selfResult.candidatePSL}" / "${selfResult.candidateEN}" (conf: ${selfResult.confidence}).\n`);

  // Test 3: Pointing downward (spatial reference -> THIS / Ye)
  console.log('Test 3: 3D Pointing downward (spatial deixis)...');
  // tipDy is positive downward (+0.30)
  const spatialHand = makePointingHand(0.0, 0.35, -0.05);
  const spatialResult = analyzePointingLandmarks(spatialHand, 'Right');

  assert.strictEqual(spatialResult.isPointing, true);
  assert.strictEqual(spatialResult.gestureType, 'point_spatial');
  assert.strictEqual(spatialResult.candidatePSL, 'Ye');
  assert.strictEqual(spatialResult.candidateEN, 'THIS');
  console.log(`✓ Passed: Downward pointing recognized as "${spatialResult.candidatePSL}" / "${spatialResult.candidateEN}".\n`);

  // Test 4: Pointing upward (Alif / HELP)
  console.log('Test 4: 3D Pointing upward (letter Alif / HELP)...');
  // tipDy is negative upward (-0.35)
  const upHand = makePointingHand(0.0, -0.35, 0.0);
  const upResult = analyzePointingLandmarks(upHand, 'Right');

  assert.strictEqual(upResult.isPointing, true);
  assert.strictEqual(upResult.gestureType, 'point_up');
  assert.strictEqual(upResult.candidatePSL, 'Alif');
  assert.strictEqual(upResult.candidateEN, 'HELP');
  console.log(`✓ Passed: Upward pointing recognized as "${upResult.candidatePSL}" / "${upResult.candidateEN}".\n`);

  // Test 5: Open palm (HELLO) does not falsely trigger pointing
  console.log('Test 5: Open palm does not trigger pointing analyzer...');
  const openHand = makeBaseHand();
  // All fingers extended
  openHand[4] = { x: 0.42, y: 0.6, z: 0.0 }; // thumb
  openHand[8] = { x: 0.48, y: 0.3, z: 0.0 }; // index
  openHand[12] = { x: 0.50, y: 0.28, z: 0.0 }; // middle
  openHand[16] = { x: 0.52, y: 0.32, z: 0.0 }; // ring
  openHand[20] = { x: 0.54, y: 0.35, z: 0.0 }; // pinky

  const openResult = analyzePointingLandmarks(openHand, 'Right');
  assert.strictEqual(openResult.isPointing, false);
  console.log('✓ Passed: Open palm correctly rejected by pointing analyzer.\n');

  // Test 6: In-browser edge inference under unified mode
  console.log('Test 6: In-browser edge inference with camera pointing payload...');
  const edgePayload: FramePayload = {
    schema_version: '1.0',
    session_id: 'sess_unified_test',
    frame_id: 101,
    timestamp: Date.now(),
    image_width: 1280,
    image_height: 720,
    hands_detected: 1,
    hands: [{ handedness: 'Right', score: 0.96, landmarks: cameraHand }],
    language: 'unified',
  };

  const edgePrediction = runClientInference(edgePayload);
  assert.strictEqual(edgePrediction.status, 'recognized');
  assert.strictEqual(edgePrediction.sign, 'Ap');
  assert.ok(edgePrediction.confidence >= 0.70);
  assert.strictEqual(edgePrediction.top_candidates?.[0].sign, 'Ap');
  console.log(`✓ Passed: Client inference recognized pointing as "${edgePrediction.sign}".\n`);

  // Test 7: Unified sentence formation with pointing tokens
  console.log('Test 7: Sentence formation with deictic tokens...');
  // Pointing to camera + Kesay -> "آپ کیسے ہیں؟" / "How are you?"
  const s1 = formatSentence(['YOU', 'Kesay'], 'unified', [0.9, 0.95]);
  assert.strictEqual(s1.urduSentence, 'آپ کیسے ہیں؟');
  assert.strictEqual(s1.englishSentence, 'How are you?');
  assert.strictEqual(s1.isPatternMatched, true);

  // Pointing to self + Bemar -> "میں بیمار ہوں" / "I am sick"
  const s2 = formatSentence(['ME', 'Bemar'], 'unified', [0.9, 0.95]);
  assert.strictEqual(s2.urduSentence, 'میں بیمار ہوں');
  assert.strictEqual(s2.englishSentence, 'I am sick');
  assert.strictEqual(s2.isPatternMatched, true);

  // Pointing to self + Seekh raha hun -> "میں سیکھ رہا ہوں" / "I am learning"
  const s3 = formatSentence(['ME', 'Seekh raha hun'], 'unified', [0.9, 0.95]);
  assert.strictEqual(s3.urduSentence, 'میں سیکھ رہا ہوں');
  assert.strictEqual(s3.englishSentence, 'I am learning');
  assert.strictEqual(s3.isPatternMatched, true);

  // Pointing to spatial + Kya qeemat hai -> "اس کی کیا قیمت ہے؟" / "What is the price of this?"
  const s4 = formatSentence(['THIS', 'Kya qeemat hai'], 'unified', [0.88, 0.92]);
  assert.strictEqual(s4.urduSentence, 'اس کی کیا قیمت ہے؟');
  assert.strictEqual(s4.englishSentence, 'What is the price of this?');
  assert.strictEqual(s4.isPatternMatched, true);

  // Greeting + Ap + Kesay -> "السلام علیکم، آپ کیسے ہیں؟"
  const s5 = formatSentence(['Assalamulaikum', 'Ap', 'Kesay'], 'unified', [0.95, 0.90, 0.92]);
  assert.strictEqual(s5.urduSentence, 'السلام علیکم، آپ کیسے ہیں؟');
  assert.strictEqual(s5.englishSentence, 'Hello, how are you?');

  console.log('✓ Passed: Sentence engine combines deictic tokens into natural bilingual sentences.\n');

  console.log('=== All Pointing & Unified Recognition Tests Passed Successfully! ===');
}

runTests();
