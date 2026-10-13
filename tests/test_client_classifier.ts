import assert from 'node:assert';
import { runClientInference, normalizeClientLandmarks, classifyHandFeatures } from '../lib/clientClassifier';
import { FramePayload } from '../types/contract';

function makeMockHand(thumb: boolean, index: boolean, middle: boolean, ring: boolean, pinky: boolean) {
  // 21 landmarks: 0 is wrist at (0.5, 0.8, 0)
  const landmarks: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i < 21; i++) {
    landmarks.push({ x: 0.5, y: 0.8, z: 0.0 });
  }

  // Landmark 0: Wrist
  landmarks[0] = { x: 0.5, y: 0.8, z: 0.0 };
  // Landmark 9: Middle MCP (used for scale)
  landmarks[9] = { x: 0.5, y: 0.5, z: 0.0 };

  // Thumb: 3 is IP, 4 is Tip
  landmarks[3] = { x: 0.45, y: 0.7, z: 0.0 };
  landmarks[4] = { x: thumb ? 0.48 : 0.44, y: 0.68, z: 0.0 };

  // Index: 6 is PIP, 8 is Tip
  landmarks[6] = { x: 0.48, y: 0.5, z: 0.0 };
  landmarks[8] = { x: 0.48, y: index ? 0.3 : 0.6, z: 0.0 };

  // Middle: 10 is PIP, 12 is Tip
  landmarks[10] = { x: 0.50, y: 0.48, z: 0.0 };
  landmarks[12] = { x: 0.50, y: middle ? 0.28 : 0.6, z: 0.0 };

  // Ring: 14 is PIP, 16 is Tip
  landmarks[14] = { x: 0.52, y: 0.5, z: 0.0 };
  landmarks[16] = { x: 0.52, y: ring ? 0.32 : 0.6, z: 0.0 };

  // Pinky: 18 is PIP, 20 is Tip
  landmarks[18] = { x: 0.54, y: 0.55, z: 0.0 };
  landmarks[20] = { x: 0.54, y: pinky ? 0.35 : 0.65, z: 0.0 };

  return landmarks;
}

function runTests() {
  console.log('=== Testing In-Browser Client-Side Classifier ===\n');

  // Test 1: No hands detected
  console.log('Test 1: Empty hand frame...');
  const emptyPayload: FramePayload = {
    schema_version: '1.0',
    session_id: 'test_sess',
    frame_id: 1,
    timestamp: Date.now(),
    image_width: 1280,
    image_height: 720,
    hands_detected: 0,
    hands: [],
  };
  const emptyRes = runClientInference(emptyPayload);
  assert.strictEqual(emptyRes.status, 'no_hands');
  assert.strictEqual(emptyRes.sign, null);
  console.log('✓ Passed: Empty frame correctly produces "no_hands".\n');

  // Test 2: Open Palm -> HELLO
  console.log('Test 2: Open palm recognition (HELLO)...');
  const helloHand = makeMockHand(true, true, true, true, true);
  const helloPayload: FramePayload = {
    schema_version: '1.0',
    session_id: 'test_sess',
    frame_id: 2,
    timestamp: Date.now(),
    image_width: 1280,
    image_height: 720,
    hands_detected: 1,
    hands: [{ handedness: 'Right', score: 0.95, landmarks: helloHand }],
  };
  const helloRes = runClientInference(helloPayload);
  assert.strictEqual(helloRes.status, 'recognized');
  assert.strictEqual(helloRes.sign, 'HELLO');
  assert.ok(helloRes.confidence >= 0.9);
  console.log('✓ Passed: Open palm recognizes as HELLO with high confidence.\n');

  // Test 3: Closed Fist -> STOP
  console.log('Test 3: Closed fist recognition (STOP)...');
  const stopHand = makeMockHand(false, false, false, false, false);
  const stopPayload: FramePayload = {
    schema_version: '1.0',
    session_id: 'test_sess',
    frame_id: 3,
    timestamp: Date.now(),
    image_width: 1280,
    image_height: 720,
    hands_detected: 1,
    hands: [{ handedness: 'Right', score: 0.95, landmarks: stopHand }],
  };
  const stopRes = runClientInference(stopPayload);
  assert.strictEqual(stopRes.status, 'recognized');
  assert.strictEqual(stopRes.sign, 'STOP');
  console.log('✓ Passed: Closed fist recognizes as STOP.\n');

  // Test 4: Thumbs Up -> YES
  console.log('Test 4: Thumbs up recognition (YES)...');
  const yesHand = makeMockHand(true, false, false, false, false);
  const yesPayload: FramePayload = {
    schema_version: '1.0',
    session_id: 'test_sess',
    frame_id: 4,
    timestamp: Date.now(),
    image_width: 1280,
    image_height: 720,
    hands_detected: 1,
    hands: [{ handedness: 'Right', score: 0.95, landmarks: yesHand }],
  };
  const yesRes = runClientInference(yesPayload);
  assert.strictEqual(yesRes.status, 'recognized');
  assert.strictEqual(yesRes.sign, 'YES');
  console.log('✓ Passed: Thumbs up recognizes as YES.\n');

  // Test 5: Index finger up -> HELP
  console.log('Test 5: Index point recognition (HELP)...');
  const helpHand = makeMockHand(false, true, false, false, false);
  const helpPayload: FramePayload = {
    schema_version: '1.0',
    session_id: 'test_sess',
    frame_id: 5,
    timestamp: Date.now(),
    image_width: 1280,
    image_height: 720,
    hands_detected: 1,
    hands: [{ handedness: 'Right', score: 0.95, landmarks: helpHand }],
  };
  const helpRes = runClientInference(helpPayload);
  assert.strictEqual(helpRes.status, 'recognized');
  assert.strictEqual(helpRes.sign, 'HELP');
  console.log('✓ Passed: Index point recognizes as HELP.\n');

  // Test 6: 3 fingers -> WATER
  console.log('Test 6: 3 fingers recognition (WATER)...');
  const waterHand = makeMockHand(false, true, true, true, false);
  const waterPayload: FramePayload = {
    schema_version: '1.0',
    session_id: 'test_sess',
    frame_id: 6,
    timestamp: Date.now(),
    image_width: 1280,
    image_height: 720,
    hands_detected: 1,
    hands: [{ handedness: 'Right', score: 0.95, landmarks: waterHand }],
  };
  const waterRes = runClientInference(waterPayload);
  assert.strictEqual(waterRes.status, 'recognized');
  assert.strictEqual(waterRes.sign, 'WATER');
  console.log('✓ Passed: 3 fingers recognizes as WATER.\n');

  console.log('=== All In-Browser Classifier Tests Passed Successfully! ===');
}

runTests();
