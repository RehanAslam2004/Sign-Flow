import { URDU_ALPHABET_MAP, PSL_EXTENDED_MAP, formatSignDisplay, getSignSpokenText } from '../lib/urduMapping';
import { FramePayload, PredictionEvent, SignLanguageMode } from '../types/contract';

console.log('=== Testing Pakistan Sign Language (PSL) & Multi-Language Integration ===\n');

// Test 1: Verify 37 Urdu Alphabets in URDU_ALPHABET_MAP
console.log('Test 1: Verify 37 Urdu Alphabets in URDU_ALPHABET_MAP...');
const urduKeys = Object.keys(URDU_ALPHABET_MAP);
if (urduKeys.length !== 37) {
  throw new Error(`Expected 37 Urdu alphabets, found ${urduKeys.length}`);
}
console.log(`✓ Passed: Exactly 37 Urdu alphabets present in mapping.`);

// Test 2: Verify 89 categories in PSL_EXTENDED_MAP
console.log('Test 2: Verify 89 categories in PSL_EXTENDED_MAP...');
const extendedKeys = Object.keys(PSL_EXTENDED_MAP);
if (extendedKeys.length !== 89) {
  throw new Error(`Expected 89 PSL Extended categories, found ${extendedKeys.length}`);
}
console.log(`✓ Passed: Exactly 89 PSL Extended categories mapped.`);

// Test 3: Check bilingual formatting for greetings and letters
console.log('Test 3: Check bilingual formatting for greetings and letters...');
const sampleAssalam = formatSignDisplay('Assalamulaikum');
if (!sampleAssalam.includes('السلام علیکم') || !sampleAssalam.includes('Assalam-o-Alaikum')) {
  throw new Error(`Expected Urdu script and romanized Assalam, got '${sampleAssalam}'`);
}
const sampleMehrbani = formatSignDisplay('Barai Mehrbani');
if (!sampleMehrbani.includes('برائے مہربانی') || !sampleMehrbani.includes('Barai Mehrbani')) {
  throw new Error(`Expected Urdu script and romanized Barai Mehrbani, got '${sampleMehrbani}'`);
}
const sampleAlif = formatSignDisplay('ا');
if (sampleAlif !== 'ا (Alif)') {
  throw new Error(`Expected 'ا (Alif)', got '${sampleAlif}'`);
}
console.log(`✓ Passed: formatSignDisplay properly formats greetings, phrases, and letters.`);

// Test 4: Check phonetic spoken text generation for SpeechSynthesis
console.log('Test 4: Check phonetic spoken text generation for SpeechSynthesis...');
const spokenAssalam = getSignSpokenText('Assalamulaikum');
if (spokenAssalam !== 'Assalam o Alaikum') {
  throw new Error(`Expected 'Assalam o Alaikum', got '${spokenAssalam}'`);
}
const spokenMehrbani = getSignSpokenText('Barai Mehrbani');
if (!spokenMehrbani.includes('Barai Mehrbani')) {
  throw new Error(`Expected 'Barai Mehrbani, please', got '${spokenMehrbani}'`);
}
const spokenAlif = getSignSpokenText('ا');
if (spokenAlif !== 'Alif') {
  throw new Error(`Expected 'Alif', got '${spokenAlif}'`);
}
console.log(`✓ Passed: getSignSpokenText returns authentic phonetic spoken text for TTS.`);

// Test 5: Contract validation with language attribute including psl_extended
console.log('Test 5: Validate FramePayload and PredictionEvent language typing...');
const testModes: SignLanguageMode[] = ['unified', 'psl_extended', 'psl_words', 'psl_alphabets', 'asl'];
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
console.log(`✓ Passed: FramePayload supports unified and legacy language modes.`);

console.log('\n=== All PSL & Multi-Language Integration Tests Passed Successfully! ===');
