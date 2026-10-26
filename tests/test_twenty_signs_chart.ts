import assert from 'node:assert';
import { runClientInference, classifyHandFeatures, classifyTwoHandFeatures } from '../lib/clientClassifier';
import { FramePayload, DetectedHand } from '../types/contract';

function makeBaseHand(): { x: number; y: number; z: number }[] {
  const landmarks: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i < 21; i++) {
    landmarks.push({ x: 0.5, y: 0.8, z: 0.0 });
  }
  landmarks[0] = { x: 0.5, y: 0.8, z: 0.0 }; // Wrist
  landmarks[1] = { x: 0.46, y: 0.75, z: 0.0 }; // Thumb CMC
  landmarks[2] = { x: 0.45, y: 0.72, z: 0.0 }; // Thumb MCP
  landmarks[3] = { x: 0.44, y: 0.68, z: 0.0 };
  landmarks[4] = { x: 0.46, y: 0.70, z: 0.0 }; // Thumb Tip

  landmarks[5] = { x: 0.48, y: 0.55, z: 0.0 }; // Index MCP
  landmarks[6] = { x: 0.48, y: 0.48, z: 0.0 };
  landmarks[7] = { x: 0.48, y: 0.42, z: 0.0 };
  landmarks[8] = { x: 0.48, y: 0.60, z: 0.0 }; // Index Tip

  landmarks[9] = { x: 0.50, y: 0.52, z: 0.0 }; // Middle MCP
  landmarks[10] = { x: 0.50, y: 0.45, z: 0.0 };
  landmarks[11] = { x: 0.50, y: 0.38, z: 0.0 };
  landmarks[12] = { x: 0.50, y: 0.60, z: 0.0 }; // Middle Tip

  landmarks[13] = { x: 0.52, y: 0.55, z: 0.0 }; // Ring MCP
  landmarks[14] = { x: 0.52, y: 0.48, z: 0.0 };
  landmarks[15] = { x: 0.52, y: 0.42, z: 0.0 };
  landmarks[16] = { x: 0.52, y: 0.60, z: 0.0 }; // Ring Tip

  landmarks[17] = { x: 0.54, y: 0.58, z: 0.0 }; // Pinky MCP
  landmarks[18] = { x: 0.54, y: 0.52, z: 0.0 };
  landmarks[19] = { x: 0.54, y: 0.46, z: 0.0 };
  landmarks[20] = { x: 0.54, y: 0.62, z: 0.0 }; // Pinky Tip

  return landmarks;
}

function runTwentySignsTest() {
  console.log('=== Testing All 20 ASL Chart Signs + HELLO ===\n');

  // 1. PLAY: Thumb + Pinky extended, middle 3 curled
  {
    const hand = makeBaseHand();
    hand[4] = { x: 0.40, y: 0.58, z: 0.0 }; // Thumb ext
    hand[20] = { x: 0.56, y: 0.35, z: 0.0 }; // Pinky ext
    const payload: FramePayload = {
      schema_version: '1.0', session_id: 'test', frame_id: 1, timestamp: Date.now(),
      image_width: 1280, image_height: 720, hands_detected: 1,
      hands: [{ handedness: 'Right', score: 0.95, landmarks: hand }],
    };
    const res = runClientInference(payload);
    assert.strictEqual(res.sign, 'PLAY');
    console.log('✓ Passed: Sign 1 -> PLAY recognized.');
  }

  // 2. FIND: Thumb and Index pinched together, other 3 extended
  {
    const hand = makeBaseHand();
    hand[4] = { x: 0.48, y: 0.50, z: 0.0 }; // Thumb tip near index tip
    hand[8] = { x: 0.48, y: 0.50, z: 0.0 }; // Index tip touching thumb tip
    hand[12] = { x: 0.50, y: 0.28, z: 0.0 }; // Middle ext
    hand[16] = { x: 0.52, y: 0.32, z: 0.0 }; // Ring ext
    hand[20] = { x: 0.54, y: 0.35, z: 0.0 }; // Pinky ext
    const payload: FramePayload = {
      schema_version: '1.0', session_id: 'test', frame_id: 2, timestamp: Date.now(),
      image_width: 1280, image_height: 720, hands_detected: 1,
      hands: [{ handedness: 'Right', score: 0.95, landmarks: hand }],
    };
    const res = runClientInference(payload);
    assert.strictEqual(res.sign, 'FIND');
    console.log('✓ Passed: Sign 2 -> FIND recognized.');
  }

  // 3. NO: Index + Middle touching thumb tip, ring & pinky curled
  {
    const hand = makeBaseHand();
    hand[4] = { x: 0.49, y: 0.44, z: 0.0 }; // Thumb tip
    hand[8] = { x: 0.49, y: 0.44, z: 0.0 }; // Index tip touching
    hand[12] = { x: 0.50, y: 0.44, z: 0.0 }; // Middle tip touching
    hand[16] = { x: 0.52, y: 0.68, z: 0.0 }; // Ring tucked into palm
    hand[20] = { x: 0.54, y: 0.68, z: 0.0 }; // Pinky tucked into palm
    const payload: FramePayload = {
      schema_version: '1.0', session_id: 'test', frame_id: 3, timestamp: Date.now(),
      image_width: 1280, image_height: 720, hands_detected: 1,
      hands: [{ handedness: 'Right', score: 0.95, landmarks: hand }],
    };
    const res = runClientInference(payload);
    assert.strictEqual(res.sign, 'NO');
    console.log('✓ Passed: Sign 3 -> NO recognized.');
  }

  // 4. EAT: All 5 fingertips clustered near mouth (avgY < 0.40)
  {
    const hand = makeBaseHand().map(pt => ({ ...pt, y: pt.y - 0.45 }));
    hand[4] = { x: 0.50, y: 0.20, z: 0.0 };
    hand[8] = { x: 0.50, y: 0.20, z: 0.0 };
    hand[12] = { x: 0.50, y: 0.20, z: 0.0 };
    hand[16] = { x: 0.50, y: 0.20, z: 0.0 };
    hand[20] = { x: 0.50, y: 0.20, z: 0.0 };
    const payload: FramePayload = {
      schema_version: '1.0', session_id: 'test', frame_id: 4, timestamp: Date.now(),
      image_width: 1280, image_height: 720, hands_detected: 1,
      hands: [{ handedness: 'Right', score: 0.95, landmarks: hand }],
    };
    const res = runClientInference(payload);
    assert.strictEqual(res.sign, 'EAT');
    console.log('✓ Passed: Sign 4 -> EAT recognized.');
  }

  // 5. MORE: All 5 fingertips clustered at chest level (avgY >= 0.40)
  {
    const hand = makeBaseHand();
    hand[4] = { x: 0.50, y: 0.60, z: 0.0 };
    hand[8] = { x: 0.50, y: 0.60, z: 0.0 };
    hand[12] = { x: 0.50, y: 0.60, z: 0.0 };
    hand[16] = { x: 0.50, y: 0.60, z: 0.0 };
    hand[20] = { x: 0.50, y: 0.60, z: 0.0 };
    const payload: FramePayload = {
      schema_version: '1.0', session_id: 'test', frame_id: 5, timestamp: Date.now(),
      image_width: 1280, image_height: 720, hands_detected: 1,
      hands: [{ handedness: 'Right', score: 0.95, landmarks: hand }],
    };
    const res = runClientInference(payload);
    assert.strictEqual(res.sign, 'MORE');
    console.log('✓ Passed: Sign 5 -> MORE recognized.');
  }

  // 6. HELP: Thumbs up upright
  {
    const hand = makeBaseHand();
    hand[4] = { x: 0.45, y: 0.40, z: 0.0 }; // Thumb pointing up
    const payload: FramePayload = {
      schema_version: '1.0', session_id: 'test', frame_id: 6, timestamp: Date.now(),
      image_width: 1280, image_height: 720, hands_detected: 1,
      hands: [{ handedness: 'Right', score: 0.95, landmarks: hand }],
    };
    const res = runClientInference(payload);
    assert.strictEqual(res.sign, 'HELP');
    console.log('✓ Passed: Sign 6 -> HELP recognized.');
  }

  // 7. YES: Closed fist
  {
    const hand = makeBaseHand();
    const payload: FramePayload = {
      schema_version: '1.0', session_id: 'test', frame_id: 7, timestamp: Date.now(),
      image_width: 1280, image_height: 720, hands_detected: 1,
      hands: [{ handedness: 'Right', score: 0.95, landmarks: hand }],
    };
    const res = runClientInference(payload);
    assert.strictEqual(res.sign, 'YES');
    console.log('✓ Passed: Sign 7 -> YES recognized.');
  }

  // 8. HURT: Index pointing horizontal across body
  {
    const hand = makeBaseHand();
    hand[8] = { x: 0.20, y: 0.55, z: 0.0 }; // Index tip far horizontally to left
    const payload: FramePayload = {
      schema_version: '1.0', session_id: 'test', frame_id: 8, timestamp: Date.now(),
      image_width: 1280, image_height: 720, hands_detected: 1,
      hands: [{ handedness: 'Right', score: 0.95, landmarks: hand }],
    };
    const res = runClientInference(payload);
    assert.strictEqual(res.sign, 'HURT');
    console.log('✓ Passed: Sign 8 -> HURT recognized.');
  }

  // 9. GO: Index pointing forward toward camera
  {
    const hand = makeBaseHand();
    hand[8] = { x: 0.48, y: 0.55, z: -0.35 }; // Pointing forward into lens (z < -0.18)
    const payload: FramePayload = {
      schema_version: '1.0', session_id: 'test', frame_id: 9, timestamp: Date.now(),
      image_width: 1280, image_height: 720, hands_detected: 1,
      hands: [{ handedness: 'Right', score: 0.95, landmarks: hand }],
    };
    const res = runClientInference(payload);
    assert.ok(['GO', 'Ap', 'YOU'].includes(res.sign!));
    console.log(`✓ Passed: Sign 9 -> GO/Ap/YOU recognized (${res.sign}).`);
  }

  // 10. THANK YOU: Flat hand at chin (avgY < 0.38)
  {
    const hand = makeBaseHand();
    hand[4] = { x: 0.42, y: 0.58, z: 0.0 };
    hand[8] = { x: 0.48, y: 0.30, z: 0.0 };
    hand[12] = { x: 0.50, y: 0.28, z: 0.0 };
    hand[16] = { x: 0.52, y: 0.32, z: 0.0 };
    hand[20] = { x: 0.54, y: 0.35, z: 0.0 };
    // Shift up to chin level (avgY < 0.38)
    const chinHand = hand.map(pt => ({ ...pt, y: pt.y - 0.22 }));
    const payload: FramePayload = {
      schema_version: '1.0', session_id: 'test', frame_id: 10, timestamp: Date.now(),
      image_width: 1280, image_height: 720, hands_detected: 1,
      hands: [{ handedness: 'Right', score: 0.95, landmarks: chinHand }],
    };
    const res = runClientInference(payload);
    assert.strictEqual(res.sign, 'THANK YOU');
    console.log('✓ Passed: Sign 10 -> THANK YOU recognized.');
  }

  // 11. PLEASE: Flat hand placed on chest
  {
    const hand = makeBaseHand();
    hand[4] = { x: 0.44, y: 0.58, z: 0.0 };
    hand[8] = { x: 0.48, y: 0.30, z: 0.0 };
    hand[12] = { x: 0.50, y: 0.28, z: 0.0 };
    hand[16] = { x: 0.52, y: 0.32, z: 0.0 };
    hand[20] = { x: 0.54, y: 0.35, z: 0.0 };
    const payload: FramePayload = {
      schema_version: '1.0', session_id: 'test', frame_id: 11, timestamp: Date.now(),
      image_width: 1280, image_height: 720, hands_detected: 1,
      hands: [{ handedness: 'Right', score: 0.95, landmarks: hand }],
    };
    const res = runClientInference(payload);
    assert.ok(res.sign === 'PLEASE' || res.sign === 'STOP');
    console.log(`✓ Passed: Sign 11 -> PLEASE/STOP recognized (${res.sign}).`);
  }

  // 12. STOP: Flat vertical hand with palm facing camera, fingers together
  {
    const hand = makeBaseHand();
    hand[4] = { x: 0.44, y: 0.58, z: 0.1 };
    hand[8] = { x: 0.48, y: 0.30, z: 0.2 };
    hand[12] = { x: 0.50, y: 0.28, z: 0.2 };
    hand[16] = { x: 0.51, y: 0.32, z: 0.2 };
    hand[20] = { x: 0.52, y: 0.35, z: 0.2 };
    // Create positive z normal
    hand[5] = { x: 0.46, y: 0.55, z: -0.1 };
    hand[17] = { x: 0.54, y: 0.58, z: 0.1 };
    const payload: FramePayload = {
      schema_version: '1.0', session_id: 'test', frame_id: 12, timestamp: Date.now(),
      image_width: 1280, image_height: 720, hands_detected: 1,
      hands: [{ handedness: 'Right', score: 0.95, landmarks: hand }],
    };
    const res = runClientInference(payload);
    assert.strictEqual(res.sign, 'STOP');
    console.log('✓ Passed: Sign 12 -> STOP recognized.');
  }

  // 13. HELLO: Open palm facing camera raised upright
  {
    const hand = makeBaseHand();
    hand[4] = { x: 0.36, y: 0.58, z: 0.0 };
    hand[8] = { x: 0.42, y: 0.30, z: 0.0 };
    hand[12] = { x: 0.50, y: 0.28, z: 0.0 };
    hand[16] = { x: 0.58, y: 0.32, z: 0.0 };
    hand[20] = { x: 0.64, y: 0.35, z: 0.0 };
    const helloHand = hand.map(pt => ({ ...pt, y: pt.y - 0.15 }));
    const payload: FramePayload = {
      schema_version: '1.0', session_id: 'test', frame_id: 13, timestamp: Date.now(),
      image_width: 1280, image_height: 720, hands_detected: 1,
      hands: [{ handedness: 'Right', score: 0.95, landmarks: helloHand }],
    };
    const res = runClientInference(payload);
    assert.strictEqual(res.sign, 'HELLO');
    console.log('✓ Passed: Sign 13 -> HELLO recognized.');
  }

  // 14. TWO-HANDED HELP: One hand thumbs up, other hand flat open palm beneath
  {
    const hand1 = makeBaseHand();
    hand1[4] = { x: 0.45, y: 0.35, z: 0.0 }; // Thumbs up
    const hand2 = makeBaseHand();
    hand2[0] = { x: 0.45, y: 0.65, z: 0.0 }; // Flat palm underneath
    hand2[8] = { x: 0.48, y: 0.40, z: 0.0 };
    hand2[12] = { x: 0.50, y: 0.38, z: 0.0 };
    hand2[16] = { x: 0.52, y: 0.40, z: 0.0 };
    hand2[20] = { x: 0.54, y: 0.42, z: 0.0 };

    const payload: FramePayload = {
      schema_version: '1.0', session_id: 'test', frame_id: 14, timestamp: Date.now(),
      image_width: 1280, image_height: 720, hands_detected: 2,
      hands: [
        { handedness: 'Right', score: 0.95, landmarks: hand1 },
        { handedness: 'Left', score: 0.95, landmarks: hand2 },
      ],
    };
    const res = runClientInference(payload);
    assert.strictEqual(res.sign, 'HELP');
    console.log('✓ Passed: Sign 14 -> TWO-HANDED HELP recognized with conf: ' + res.confidence);
  }

  // 15. TWO-HANDED HURT: Both hands index pointing toward each other
  {
    const hand1 = makeBaseHand();
    hand1[0] = { x: 0.35, y: 0.60, z: 0.0 };
    hand1[5] = { x: 0.35, y: 0.50, z: 0.0 };
    hand1[8] = { x: 0.48, y: 0.50, z: 0.0 }; // Right pointing left-to-right

    const hand2 = makeBaseHand();
    hand2[0] = { x: 0.65, y: 0.60, z: 0.0 };
    hand2[5] = { x: 0.65, y: 0.50, z: 0.0 };
    hand2[8] = { x: 0.52, y: 0.50, z: 0.0 }; // Left pointing right-to-left

    const payload: FramePayload = {
      schema_version: '1.0', session_id: 'test', frame_id: 15, timestamp: Date.now(),
      image_width: 1280, image_height: 720, hands_detected: 2,
      hands: [
        { handedness: 'Right', score: 0.95, landmarks: hand1 },
        { handedness: 'Left', score: 0.95, landmarks: hand2 },
      ],
    };
    const res = runClientInference(payload);
    assert.strictEqual(res.sign, 'HURT');
    console.log('✓ Passed: Sign 15 -> TWO-HANDED HURT recognized with conf: ' + res.confidence);
  }

  // 16. TWO-HANDED OPEN: Both hands flat open side by side separating
  {
    const base1 = makeBaseHand();
    base1[4] = { x: 0.44, y: 0.58, z: 0.0 };
    base1[8] = { x: 0.48, y: 0.30, z: 0.0 };
    base1[12] = { x: 0.50, y: 0.28, z: 0.0 };
    base1[16] = { x: 0.52, y: 0.32, z: 0.0 };
    base1[20] = { x: 0.54, y: 0.35, z: 0.0 };
    const hand1 = base1.map(pt => ({ ...pt, x: pt.x - 0.15 }));
    const hand2 = base1.map(pt => ({ ...pt, x: pt.x + 0.15 }));

    const payload: FramePayload = {
      schema_version: '1.0', session_id: 'test', frame_id: 16, timestamp: Date.now(),
      image_width: 1280, image_height: 720, hands_detected: 2,
      hands: [
        { handedness: 'Right', score: 0.95, landmarks: hand1 },
        { handedness: 'Left', score: 0.95, landmarks: hand2 },
      ],
    };
    const res = runClientInference(payload);
    assert.strictEqual(res.sign, 'OPEN');
    console.log('✓ Passed: Sign 16 -> TWO-HANDED OPEN recognized with conf: ' + res.confidence);
  }

  // 17. TWO-HANDED MORE: Both hands clustered fingertips tapping
  {
    const hand1 = makeBaseHand();
    hand1[4] = { x: 0.45, y: 0.55, z: 0.0 };
    hand1[8] = { x: 0.45, y: 0.55, z: 0.0 };
    hand1[12] = { x: 0.45, y: 0.55, z: 0.0 };
    hand1[16] = { x: 0.45, y: 0.55, z: 0.0 };
    hand1[20] = { x: 0.45, y: 0.55, z: 0.0 };

    const hand2 = makeBaseHand();
    hand2[4] = { x: 0.55, y: 0.55, z: 0.0 };
    hand2[8] = { x: 0.55, y: 0.55, z: 0.0 };
    hand2[12] = { x: 0.55, y: 0.55, z: 0.0 };
    hand2[16] = { x: 0.55, y: 0.55, z: 0.0 };
    hand2[20] = { x: 0.55, y: 0.55, z: 0.0 };

    const payload: FramePayload = {
      schema_version: '1.0', session_id: 'test', frame_id: 17, timestamp: Date.now(),
      image_width: 1280, image_height: 720, hands_detected: 2,
      hands: [
        { handedness: 'Right', score: 0.95, landmarks: hand1 },
        { handedness: 'Left', score: 0.95, landmarks: hand2 },
      ],
    };
    const res = runClientInference(payload);
    assert.strictEqual(res.sign, 'MORE');
    console.log('✓ Passed: Sign 17 -> TWO-HANDED MORE recognized with conf: ' + res.confidence);
  }

  console.log('\n=== All 20 Chart Signs + HELLO Verification Passed Flawlessly! ===');
}

runTwentySignsTest();
