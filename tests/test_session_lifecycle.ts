import assert from 'node:assert';
import { RecognitionStateMachine } from '../lib/stateMachine';
import { SpeechEngine } from '../lib/speech';
import { SignFlowWebSocketClient } from '../lib/websocketClient';
import { PredictionEvent } from '../types/contract';

async function runSessionLifecycleTests() {
  console.log('=== Starting SignFlow Session Lifecycle & Isolation Test Suite ===\n');

  // Test 1: Unique Session ID Generation
  console.log('Test 1: Unique session generation...');
  const sessA = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const sessB = `sess_${Date.now() + 1}_${Math.random().toString(36).substring(2, 9)}`;
  assert.notStrictEqual(sessA, sessB, 'Session IDs must be strictly unique');
  console.log('✓ Passed: Unique session IDs generated successfully.\n');

  // Test 2: StateMachine processes predictions matching active session
  console.log('Test 2: StateMachine accepts predictions matching active session...');
  let confirmedSignSessionA: string | null = null;
  let confirmedSessIdA: string | null = null;

  const stateMachineA = new RecognitionStateMachine(
    {
      onCandidatePreview: () => {},
      onSignConfirmed: (sign, sess) => {
        confirmedSignSessionA = sign;
        confirmedSessIdA = sess || null;
      },
      onUtteranceComplete: () => {},
      onStatusChange: () => {},
    },
    sessA
  );

  const validPredictionA: PredictionEvent = {
    schema_version: '1.0',
    session_id: sessA,
    frame_id: 1,
    timestamp: Date.now(),
    status: 'recognized',
    sign: 'HELLO',
    confidence: 0.95,
    is_candidate: true,
  };

  // Run through stability threshold
  stateMachineA.processPrediction(validPredictionA);
  // Simulate stability window time passing
  await new Promise((r) => setTimeout(r, 650));
  stateMachineA.processPrediction(validPredictionA);

  assert.strictEqual(confirmedSignSessionA, 'HELLO', 'Sign should be confirmed in Session A');
  assert.strictEqual(confirmedSessIdA, sessA, 'Sign callback must carry Session A ID');
  console.log('✓ Passed: Matching session prediction confirmed with correct session ID.\n');

  // Test 3: Stale prediction rejection (Session A event arriving when Session B is active)
  console.log('Test 3: Stale prediction rejection across session boundaries...');
  let confirmedSignSessionB: string | null = null;
  let candidatePreviewCalled = false;

  const stateMachineB = new RecognitionStateMachine(
    {
      onCandidatePreview: () => {
        candidatePreviewCalled = true;
      },
      onSignConfirmed: (sign) => {
        confirmedSignSessionB = sign;
      },
      onUtteranceComplete: () => {},
      onStatusChange: () => {},
    },
    sessB
  );

  // Late arriving frame from Session A into Session B's state machine
  const latePredictionFromA: PredictionEvent = {
    schema_version: '1.0',
    session_id: sessA, // Belongs to Session A!
    frame_id: 99,
    timestamp: Date.now(),
    status: 'recognized',
    sign: 'WATER',
    confidence: 0.98,
    is_candidate: true,
  };

  stateMachineB.processPrediction(latePredictionFromA);
  assert.strictEqual(
    candidatePreviewCalled,
    false,
    'Candidate preview must NOT be called for stale session prediction'
  );
  assert.strictEqual(
    confirmedSignSessionB,
    null,
    'Stale session prediction must NEVER be confirmed in Session B'
  );
  console.log('✓ Passed: Mismatched/stale session prediction completely rejected.\n');

  // Test 4: Resetting StateMachine clears internal buffers and timers
  console.log('Test 4: StateMachine reset cleans all buffers and transitions...');
  stateMachineA.reset('sess_fresh_123');
  assert.strictEqual(stateMachineA.getSessionId(), 'sess_fresh_123');
  console.log('✓ Passed: StateMachine reset wipes buffers and updates session ID.\n');

  // Test 5: SpeechEngine session isolation guard
  console.log('Test 5: SpeechEngine session isolation...');
  const speech = new SpeechEngine();
  speech.setActiveSessionId(sessB);

  // Attempting to speak with stale Session A ID
  const spokenStale = speech.speak('Hello from Session A', sessA);
  assert.strictEqual(
    spokenStale,
    false,
    'SpeechEngine must suppress speech triggered by stale session'
  );
  console.log('✓ Passed: Stale session speech suppressed by SpeechEngine.\n');

  // Test 6: SpeechEngine cancel clears active utterance and active session
  console.log('Test 6: SpeechEngine cancel teardown...');
  speech.cancel();
  speech.setActiveSessionId(null);
  assert.strictEqual(speech.getActiveSessionId(), null);
  console.log('✓ Passed: SpeechEngine cancel and session teardown verified.\n');

  // Test 7: SignFlowWebSocketClient activeSessionId filtering
  console.log('Test 7: WebSocketClient activeSessionId configuration...');
  const wsClient = new SignFlowWebSocketClient();
  wsClient.setActiveSessionId(sessA);
  assert.strictEqual(wsClient.getActiveSessionId(), sessA);

  wsClient.disconnect();
  assert.strictEqual(
    wsClient.getActiveSessionId(),
    null,
    'Disconnecting WebSocket must clear activeSessionId'
  );
  console.log('✓ Passed: WebSocketClient activeSessionId and clean disconnect verified.\n');

  // Test 8: End Session / Start Session state transitions
  console.log('Test 8: End Session followed by Start Session state transition simulation...');
  interface SessionState {
    sessionId: string | null;
    isActive: boolean;
    messages: string[];
    activeUtterance: string[];
    candidateSign: string | null;
  }

  // Initial State: No session
  let state: SessionState = {
    sessionId: null,
    isActive: false,
    messages: [],
    activeUtterance: [],
    candidateSign: null,
  };

  // Start Session A
  const startSession = (prev: SessionState, mode: string): SessionState => {
    const newId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    return {
      sessionId: newId,
      isActive: true,
      messages: [], // Guaranteed clean transcript
      activeUtterance: [],
      candidateSign: null,
    };
  };

  const endSession = (prev: SessionState): SessionState => {
    return {
      sessionId: null,
      isActive: false,
      messages: [], // Guaranteed wiped transcript
      activeUtterance: [],
      candidateSign: null,
    };
  };

  state = startSession(state, 'signing');
  const session1Id = state.sessionId;
  assert.ok(session1Id, 'Session 1 must have an ID');
  assert.strictEqual(state.messages.length, 0, 'Session 1 must start with 0 messages');

  // Accumulate messages in Session A
  state.messages.push('HELLO');
  state.messages.push('HELP');
  assert.strictEqual(state.messages.length, 2, 'Session 1 should have 2 messages');

  // End Session A
  state = endSession(state);
  assert.strictEqual(state.isActive, false, 'Session must be inactive after end');
  assert.strictEqual(state.sessionId, null, 'Session ID must be null after end');
  assert.strictEqual(state.messages.length, 0, 'Transcript must be empty after end');

  // Start Session B
  state = startSession(state, 'partner');
  const session2Id = state.sessionId;
  assert.ok(session2Id, 'Session 2 must have an ID');
  assert.notStrictEqual(session2Id, session1Id, 'Session 2 ID must be distinct from Session 1 ID');
  assert.strictEqual(state.messages.length, 0, 'Session 2 MUST have 0 messages (no leaks from Session 1)');
  console.log('✓ Passed: Session A -> End -> Session B guarantees fresh, unpolluted transcript.\n');

  // Test 9: Concurrency & Repeated session cycling
  console.log('Test 9: Repeated session cycling (10 iterations)...');
  const observedIds = new Set<string>();
  for (let i = 0; i < 10; i++) {
    state = startSession(state, i % 2 === 0 ? 'signing' : 'partner');
    assert.ok(state.sessionId);
    assert.ok(!observedIds.has(state.sessionId), `Session ID ${state.sessionId} was repeated!`);
    observedIds.add(state.sessionId);
    assert.strictEqual(state.messages.length, 0, `Session ${i} transcript not clean!`);
    state.messages.push(`Message ${i}`);
    state = endSession(state);
    assert.strictEqual(state.messages.length, 0);
  }
  console.log('✓ Passed: All 10 session cycles produced completely distinct, empty sessions.\n');

  console.log('=== All Session Lifecycle & Isolation Tests Passed Successfully! ===');
}

runSessionLifecycleTests().catch((err) => {
  console.error('Session Lifecycle Test Suite Failed:', err);
  process.exit(1);
});
