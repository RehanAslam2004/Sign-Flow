import assert from 'node:assert';
import { TranscriptManager } from '../lib/transcriptManager';
import { PredictionEvent } from '../types/contract';

function runTests() {
  console.log('=== Testing SignFlow TranscriptManager ===\n');

  // Test 1: Overlap alignment logic
  console.log('Test 1: Prefix-suffix overlap alignment...');
  const res1 = TranscriptManager.reconcileOverlap('I want', 'want to learn ASL');
  assert.strictEqual(res1, 'I want to learn ASL');

  const res2 = TranscriptManager.reconcileOverlap('Where is the nearest', 'nearest hospital please');
  assert.strictEqual(res2, 'Where is the nearest hospital please');

  const res3 = TranscriptManager.reconcileOverlap('Hello', 'Hello, how are you?');
  assert.strictEqual(res3, 'Hello, how are you?');

  const res4 = TranscriptManager.reconcileOverlap('Thank you', 'Have a nice day');
  assert.strictEqual(res4, 'Thank you Have a nice day');
  console.log('✓ Passed: Overlap alignment accurately eliminates duplicate words.\n');

  // Test 2: Provisional streaming and sentence commitment
  console.log('Test 2: Provisional updates and sentence completion...');
  let latestProvisional: string | null = null;
  const confirmedSentences: string[] = [];

  const manager = new TranscriptManager({
    onProvisionalUpdate: (text) => {
      latestProvisional = text;
    },
    onSentenceConfirmed: (sentence) => {
      confirmedSentences.push(sentence);
    },
  }, 'sess_123');

  // Partial prediction 1
  const event1: PredictionEvent = {
    schema_version: '2.0',
    session_id: 'sess_123',
    frame_id: 1,
    timestamp: 1000,
    end_timestamp_ms: 1500,
    status: 'partial',
    sign: 'I want',
    recognized_text: 'I want',
    confidence: 0.8,
    is_candidate: true,
  };
  manager.processPrediction(event1);
  assert.strictEqual(latestProvisional, 'I want');
  assert.strictEqual(confirmedSentences.length, 0);

  // Partial prediction 2 with overlap
  const event2: PredictionEvent = {
    schema_version: '2.0',
    session_id: 'sess_123',
    frame_id: 2,
    timestamp: 2000,
    end_timestamp_ms: 2500,
    status: 'partial',
    sign: 'want water',
    recognized_text: 'want water',
    confidence: 0.82,
    is_candidate: true,
  };
  manager.processPrediction(event2);
  assert.strictEqual(latestProvisional, 'I want water');
  assert.strictEqual(confirmedSentences.length, 0);

  // Complete prediction
  const event3: PredictionEvent = {
    schema_version: '2.0',
    session_id: 'sess_123',
    frame_id: 3,
    timestamp: 3000,
    end_timestamp_ms: 3500,
    status: 'complete',
    sign: 'water please',
    recognized_text: 'water please',
    confidence: 0.95,
    is_candidate: true,
  };
  manager.processPrediction(event3);
  assert.strictEqual(latestProvisional, null);
  assert.strictEqual(confirmedSentences.length, 1);
  assert.strictEqual(confirmedSentences[0], 'I want water please.');
  console.log('✓ Passed: Provisional updates merged and finalized into punctuated sentence.\n');

  // Test 3: Deduplication
  console.log('Test 3: Duplicate sentence suppression...');
  manager.commitSentence('I want water please.');
  assert.strictEqual(confirmedSentences.length, 1); // Not duplicated
  console.log('✓ Passed: Duplicate confirmed sentences cleanly suppressed.\n');

  // Test 4: Out-of-order response rejection
  console.log('Test 4: Out-of-order timestamp rejection...');
  const staleEvent: PredictionEvent = {
    schema_version: '2.0',
    session_id: 'sess_123',
    frame_id: 0,
    timestamp: 1500,
    end_timestamp_ms: 1800, // < 3500
    status: 'complete',
    sign: 'stale text',
    recognized_text: 'stale text',
    confidence: 0.95,
    is_candidate: true,
  };
  manager.processPrediction(staleEvent);
  assert.strictEqual(confirmedSentences.length, 1); // Stale event dropped
  console.log('✓ Passed: Stale out-of-order responses rejected.\n');

  console.log('=== All TranscriptManager Tests Passed Successfully! ===');
}

runTests();
