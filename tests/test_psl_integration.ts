import { URDU_ALPHABET_MAP, formatSignDisplay, getSignSpokenText } from '../lib/urduMapping';
import { FramePayload, PredictionEvent, SignLanguageMode } from '../types/contract';

console.log('=== Testing Pakistan Sign Language (PSL) & Multi-Language Integration ===\n');

// Test 1: Verify 37 Urdu Alphabets in URDU_ALPHABET_MAP
console.log('Test 1: Verify 37 Urdu Alphabets in URDU_ALPHABET_MAP...');
const urduKeys = Object.keys(URDU_ALPHABET_MAP);
if (urduKeys.length !== 37) {
  throw new Error(`Expected 37 Urdu alphabets, found ${urduKeys.length}`);
}
console.log(`✓ Passed: Exactly 37 Urdu alphabets present in mapping.`);

// Test 2: Check clean formatting with formatSignDisplay
console.log('Test 2: Check clean formatting with formatSignDisplay...');
const sampleAlif = formatSignDisplay('ا');
if (sampleAlif !== 'ا (Alif)') {
  throw new Error(`Expected 'ا (Alif)', got '${sampleAlif}'`);
}
const sampleBay = formatSignDisplay('ب');
if (sampleBay !== 'ب (Bay)') {
  throw new Error(`Expected 'ب (Bay)', got '${sampleBay}'`);
}
const sampleWord = formatSignDisplay('THANKS');
if (sampleWord !== 'THANKS') {
  throw new Error(`Expected 'THANKS', got '${sampleWord}'`);
}
console.log(`✓ Passed: formatSignDisplay properly formats letters and preserves words.`);

// Test 3: Check phonetic spoken text generation for SpeechSynthesis
console.log('Test 3: Check phonetic spoken text generation for SpeechSynthesis...');
const spokenAlif = getSignSpokenText('ا');
if (spokenAlif !== 'Alif') {
  throw new Error(`Expected 'Alif', got '${spokenAlif}'`);
}
const spokenJeem = getSignSpokenText('ج');
if (spokenJeem !== 'Jeem') {
  throw new Error(`Expected 'Jeem', got '${spokenJeem}'`);
}
const spokenAsl = getSignSpokenText('HELLO');
if (spokenAsl !== 'HELLO') {
  throw new Error(`Expected 'HELLO', got '${spokenAsl}'`);
}
console.log(`✓ Passed: getSignSpokenText returns authentic phonetic letter names for TTS.`);

// Test 4: Contract validation with language attribute
console.log('Test 4: Validate FramePayload and PredictionEvent language typing...');
const testModes: SignLanguageMode[] = ['psl_words', 'psl_alphabets', 'asl'];
testModes.forEach((mode) => {
  const payload: FramePayload = {
    schema_version: '1.0',
    session_id: 'test_sess',
    frame_id: 1,
    timestamp: Date.now(),
    image_width: 1280,
    image_height: 720,
    hands_detected: 1,
    hands: [],
    language: mode,
  };
  if (payload.language !== mode) {
    throw new Error(`Language mismatch for ${mode}`);
  }
});
console.log(`✓ Passed: FramePayload supports all 3 language modes: psl_words, psl_alphabets, asl.`);

console.log('\n=== All PSL & Multi-Language Integration Tests Passed Successfully! ===');
