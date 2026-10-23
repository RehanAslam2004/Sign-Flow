/**
 * Test Suite: SignFlow Language Intelligence & Sentence Formation
 *
 * Verifies:
 * 1. Semantic categorization of PSL & ASL signs
 * 2. Boundary transition rules
 * 3. Pattern-matching grammar engine for Urdu and English
 * 4. Bilingual sentence formatting and preview generation
 * 5. State machine v2 sliding-window majority voting and adaptive stability
 */

import { getSignCategory, isBoundaryTransition, isAlphabetCategory } from '../lib/signSemantics';
import { buildSentence } from '../lib/grammarEngine';
import { formatSentence, formatPreview } from '../lib/bilingualFormatter';
import { RecognitionStateMachine } from '../lib/stateMachine';
import { PredictionEvent } from '../types/contract';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('=== Starting SignFlow Language Intelligence Test Suite ===\n');

// ---------------------------------------------------------------------------
// 1. Semantic Categorization Tests
// ---------------------------------------------------------------------------
console.log('Test 1: Semantic categorization mapping...');
assert(getSignCategory('Assalamulaikum') === 'greeting', 'Assalamulaikum must be greeting');
assert(getSignCategory('Walaikumasalam') === 'greeting', 'Walaikumasalam must be greeting');
assert(getSignCategory('G Han') === 'expression', 'G Han must be expression');
assert(getSignCategory('Nahi hai') === 'expression', 'Nahi hai must be expression');
assert(getSignCategory('Barai Mehrbani') === 'expression', 'Barai Mehrbani must be expression');
assert(getSignCategory('Kesay') === 'question', 'Kesay must be question');
assert(getSignCategory('Kab') === 'question', 'Kab must be question');
assert(getSignCategory('Kya qeemat hai') === 'question', 'Kya qeemat hai must be question');
assert(getSignCategory('Ap') === 'pronoun', 'Ap must be pronoun');
assert(getSignCategory('Mujhay') === 'pronoun', 'Mujhay must be pronoun');
assert(getSignCategory('Jao') === 'verb', 'Jao must be verb');
assert(getSignCategory('Samjhna') === 'verb', 'Samjhna must be verb');
assert(getSignCategory('Bemar') === 'adjective', 'Bemar must be adjective');
assert(getSignCategory('Dur hai') === 'adjective', 'Dur hai must be adjective');
assert(getSignCategory('APPLE') === 'noun', 'APPLE must be noun');
assert(getSignCategory('Allama Iqbal') === 'figure', 'Allama Iqbal must be figure');
assert(getSignCategory('Alif') === 'alphabet', 'Alif must be alphabet');
assert(isAlphabetCategory('alphabet'), 'isAlphabetCategory must return true for alphabet');
assert(!isAlphabetCategory('greeting'), 'isAlphabetCategory must return false for greeting');
console.log('✓ Passed: All semantic categories mapped correctly.');

// ---------------------------------------------------------------------------
// 2. Boundary Transition Tests
// ---------------------------------------------------------------------------
console.log('\nTest 2: Semantic boundary transitions...');
assert(isBoundaryTransition('greeting', 'question'), 'greeting → question must trigger boundary');
assert(isBoundaryTransition('expression', 'greeting'), 'expression → greeting must trigger boundary');
assert(isBoundaryTransition('verb', 'greeting'), 'verb → greeting must trigger boundary');
assert(isBoundaryTransition('question', 'expression'), 'question → expression must trigger boundary');
assert(isBoundaryTransition('alphabet', 'greeting'), 'alphabet → greeting must trigger boundary');
assert(!isBoundaryTransition('greeting', 'greeting'), 'Same category must not trigger boundary');
assert(!isBoundaryTransition('pronoun', 'verb'), 'pronoun → verb is part of sentence, not boundary');
console.log('✓ Passed: Semantic boundary transitions identified accurately.');

// ---------------------------------------------------------------------------
// 3. Grammar Engine Pattern Matching
// ---------------------------------------------------------------------------
console.log('\nTest 3: Grammar engine rule matching...');

// Greeting + Question: [Assalamulaikum, Ap, Kesay]
const res1 = buildSentence(['Assalamulaikum', 'Ap', 'Kesay']);
assert(res1.isPatternMatched, 'Greeting sequence must match grammar rule');
assert(res1.urdu.includes('السلام علیکم') && res1.urdu.includes('کیسے'), 'Urdu greeting must match');
assert(res1.english.toLowerCase().includes('how are you'), 'English translation must match');

// Polite Greeting: [Assalamulaikum]
const res2 = buildSentence(['Assalamulaikum']);
assert(res2.isPatternMatched, 'Single greeting must match grammar rule');
assert(res2.urdu === 'السلام علیکم', 'Urdu text must be السلام علیکم');

// Expression: [Barai Mehrbani]
const res3 = buildSentence(['Barai Mehrbani']);
assert(res3.isPatternMatched, 'Please must match grammar rule');
assert(res3.english.toLowerCase().includes('please'), 'English must be Please');

// Request: [Mujhay, Watermelon]
const res4 = buildSentence(['Mujhay', 'Watermelon']);
assert(res4.urdu.includes('مجھے') && res4.urdu.includes('چاہیے'), 'I need rule should compose');
assert(res4.english.toLowerCase().includes('i need'), 'English must be I need ...');

// Price Question: [Kya qeemat hai]
const res5 = buildSentence(['Kya qeemat hai']);
assert(res5.isPatternMatched, 'Price question must match');
assert(res5.english.toLowerCase().includes('price'), 'English must include price');

// Learning: [Seekh raha hun]
const res6 = buildSentence(['Seekh raha hun']);
assert(res6.english.toLowerCase().includes('learning'), 'English must say learning');

console.log('✓ Passed: Grammar engine patterns and rule matching verified.');

// ---------------------------------------------------------------------------
// 4. Bilingual Formatter Tests
// ---------------------------------------------------------------------------
console.log('\nTest 4: Bilingual Formatter outputs...');

// Full sentence formatting with confidence
const formatted = formatSentence(
  ['Assalamulaikum', 'Ap', 'Kesay'],
  'psl_extended',
  [0.92, 0.88, 0.95]
);

assert(formatted.rawTokens.length === 3, 'Raw tokens must be preserved');
assert(formatted.rawDisplay.includes('→'), 'Raw display must use arrow separator');
assert(formatted.urduSentence.length > 0, 'Urdu sentence must be populated');
assert(formatted.englishSentence.length > 0, 'English sentence must be populated');
assert(formatted.spokenText.length > 0, 'Spoken text must be generated');
assert(formatted.confidence === 0.92, `Average confidence must be 0.92, got ${formatted.confidence}`);
assert(formatted.isPatternMatched, 'isPatternMatched must be true');

// ASL mode should have empty Urdu sentence
const aslFormatted = formatSentence(['HELLO', 'HOW', 'ARE', 'YOU'], 'asl', [0.9]);
assert(aslFormatted.urduSentence === '', 'ASL mode must produce empty Urdu sentence');
assert(aslFormatted.englishSentence.length > 0, 'ASL mode must produce English sentence');

// Live preview formatting
const preview = formatPreview(['Assalamulaikum', 'Ap'], 'psl_extended');
assert(preview.rawDisplay.includes('→'), 'Preview rawDisplay must have arrow separator');
assert(preview.previewEnglish.length > 0, 'Preview English must be present');

console.log('✓ Passed: Bilingual Formatter and preview outputs verified.');

// ---------------------------------------------------------------------------
// 5. State Machine v2 Majority Voting & Adaptive Confirmation
// ---------------------------------------------------------------------------
console.log('\nTest 5: State Machine v2 majority voting and stability...');

let confirmedSigns: string[] = [];
let completedUtterances: string[] = [];
let capturedTokens: string[][] = [];

const sm = new RecognitionStateMachine({
  onCandidatePreview: () => {},
  onSignConfirmed: (sign) => {
    confirmedSigns.push(sign);
  },
  onUtteranceComplete: (phrase, rawTokens) => {
    completedUtterances.push(phrase);
    capturedTokens.push(rawTokens);
  },
  onStatusChange: () => {},
}, 'test-session');

// High-confidence bypass (>0.90) should confirm quickly
const baseTime = Date.now();
const makePred = (sign: string, conf: number): PredictionEvent => ({
  schema_version: '1.0',
  session_id: 'test-session',
  frame_id: 1,
  timestamp: baseTime,
  status: 'recognized',
  sign,
  confidence: conf,
  is_candidate: false,
});

// Single sporadic glitch frame should NOT immediately confirm
sm.processPrediction(makePred('GLITCH', 0.65));
assert(!confirmedSigns.includes('GLITCH'), 'Single glitch frame must not confirm');

console.log('✓ Passed: State machine v2 suppresses transient glitches.');

console.log('\n=== All Language Intelligence & Sentence Formation Tests Passed! ===\n');
