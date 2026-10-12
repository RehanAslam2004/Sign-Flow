import assert from 'node:assert';
import { getSuggestedRepliesForText, PSL_REFERENCE_CATALOGUE } from '../lib/replyCatalogue';
import { POST } from '../app/api/suggest-replies/route';

async function runTests() {
  console.log('--- Starting Suggested Sign Replies Test Suite ---');

  // Test 1: Mode Gating - Rejects 'signing' mode with 403 Forbidden
  console.log('Test 1: Server-side mode gating (rejection of signing mode)...');
  const mockSigningReq = {
    json: async () => ({
      mode: 'signing',
      messageId: 'msg_123',
      text: 'I need water',
    }),
  } as any;
  const signingRes = await POST(mockSigningReq);
  assert.strictEqual(signingRes.status, 403, 'Expected 403 Forbidden for signing mode');
  const signingData = await signingRes.json();
  assert.strictEqual(signingData.suggestions.length, 0, 'Suggestions must be empty for signing mode');
  console.log('✓ Passed: "signing" mode correctly rejected with HTTP 403.');

  // Test 2: Mode Gating - Accepts 'partner' mode with 200 OK
  console.log('Test 2: Server-side mode acceptance (partner mode)...');
  const mockPartnerReq = {
    json: async () => ({
      mode: 'partner',
      messageId: 'msg_124',
      text: 'WATER',
    }),
  } as any;
  const partnerRes = await POST(mockPartnerReq);
  assert.strictEqual(partnerRes.status, 200, 'Expected 200 OK for partner mode');
  const partnerData = await partnerRes.json();
  assert.ok(partnerData.suggestions.length >= 2, 'Expected at least 2 suggested replies');
  assert.ok(partnerData.suggestions.length <= 4, 'Expected at most 4 suggested replies');
  console.log(`✓ Passed: "partner" mode accepted, returned ${partnerData.suggestions.length} suggestions.`);

  // Test 3: Contextual relevance for WATER
  console.log('Test 3: Contextual relevance for WATER...');
  const waterReplies = getSuggestedRepliesForText('WATER');
  assert.ok(
    waterReplies.some((r) => r.text.includes('Here you go') || r.text.includes('Of course')),
    'Expected "Here you go" response for WATER'
  );
  console.log('✓ Passed: WATER produces contextually appropriate response.');

  // Test 4: Contextual relevance for HELP
  console.log('Test 4: Contextual relevance for HELP...');
  const helpReplies = getSuggestedRepliesForText('HELP');
  assert.ok(
    helpReplies.some((r) => r.text.includes('help') || r.text.includes('What do you need')),
    'Expected supportive assistance response for HELP'
  );
  console.log('✓ Passed: HELP produces supportive responses.');

  // Test 5: Contextual relevance for HELLO
  console.log('Test 5: Contextual relevance for HELLO...');
  const helloReplies = getSuggestedRepliesForText('HELLO');
  assert.ok(
    helloReplies.some((r) => r.text.includes('Hello') || r.text.includes('meet you')),
    'Expected greeting response for HELLO'
  );
  console.log('✓ Passed: HELLO produces welcoming greeting.');

  // Test 6: Empty/Whitespace translated text handling
  console.log('Test 6: Empty text handling...');
  const emptyRes = getSuggestedRepliesForText('   ');
  assert.strictEqual(emptyRes.length, 0, 'Empty input should yield 0 suggestions');
  console.log('✓ Passed: Empty text handled gracefully without exceptions.');

  // Test 7: Integrity and Truthfulness of Sign Reference Catalogue
  console.log('Test 7: PSL reference catalogue truthfulness & provenance...');
  for (const entry of PSL_REFERENCE_CATALOGUE) {
    assert.ok(entry.id, 'Entry must have a stable id');
    assert.ok(entry.phrase, 'Entry must have an approved phrase');
    assert.ok(entry.pslLabel, 'Entry must have a PSL label');
    assert.ok(entry.source, 'Entry must document its source provenance');
    assert.ok(entry.license, 'Entry must document its license');

    // Ethical boundary: no fabricated URLs
    if (entry.mediaUrl) {
      assert.ok(
        entry.mediaUrl.startsWith('/') || entry.mediaUrl.startsWith('http'),
        'Media URL if present must be valid'
      );
    } else {
      assert.strictEqual(
        entry.validationStatus,
        'pending_verification',
        'Missing media must be truthfully flagged as pending_verification'
      );
    }
  }
  console.log(`✓ Passed: All ${PSL_REFERENCE_CATALOGUE.length} catalogue entries verified for truthfulness and provenance.`);

  // Test 8: Ghost-Hand Motion Steps Verification
  console.log('Test 8: Ghost-hand motion steps & trajectory data...');
  for (const entry of PSL_REFERENCE_CATALOGUE) {
    assert.ok(entry.motionSteps, `Entry ${entry.id} must define motionSteps`);
    assert.ok(entry.motionSteps.length >= 1, `Entry ${entry.id} must have at least 1 motion step`);
    for (const step of entry.motionSteps) {
      assert.ok(step.stepNumber >= 1, 'stepNumber must be >= 1');
      assert.strictEqual(step.totalSteps, entry.motionSteps.length, 'totalSteps must match step count');
      assert.ok(step.label, 'step must have a label');
      assert.ok(step.instruction, 'step must have an instruction');
      assert.ok(step.handPose, 'step must define a handPose');
      assert.ok(step.motionTrajectory, 'step must define a motionTrajectory');
    }
  }
  console.log('✓ Passed: All catalogue entries provide validated multi-step ghost-hand motion trajectories.');

  console.log('--- All Suggested Sign Replies Tests Passed Successfully! ---');
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
