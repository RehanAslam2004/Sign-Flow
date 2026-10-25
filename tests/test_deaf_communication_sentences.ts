import assert from 'node:assert';
import { formatSentence } from '../lib/bilingualFormatter';
import { classifyHandFeatures } from '../lib/clientClassifier';

console.log('=== Running Deaf Practical Sentences Test Suite ===\n');

// Test 1: "Hello, how are you?"
console.log('Test 1: Hello, how are you?...');
const s1 = formatSentence(['HELLO', 'YOU'], 'unified', [0.95, 0.95]);
assert.strictEqual(s1.englishSentence, 'Hello, how are you?');
assert.strictEqual(s1.isPatternMatched, true);
console.log(`✓ Passed: ['HELLO', 'YOU'] -> "${s1.englishSentence}" [Urdu: ${s1.urduSentence}]`);

const s1_psl = formatSentence(['Assalamulaikum', 'Ap'], 'unified', [0.95, 0.95]);
assert.strictEqual(s1_psl.englishSentence, 'Hello, how are you?');
console.log(`✓ Passed: ['Assalamulaikum', 'Ap'] -> "${s1_psl.englishSentence}" [Urdu: ${s1_psl.urduSentence}]`);

// Test 2: "Nice to meet you."
console.log('\nTest 2: Nice to meet you?...');
const s2_full = formatSentence(['NICE', 'MEET', 'YOU'], 'unified', [0.9, 0.9, 0.95]);
assert.strictEqual(s2_full.englishSentence, 'Nice to meet you.');
assert.strictEqual(s2_full.isPatternMatched, true);
console.log(`✓ Passed: ['NICE', 'MEET', 'YOU'] -> "${s2_full.englishSentence}" [Urdu: ${s2_full.urduSentence}]`);

const s2_short = formatSentence(['NICE', 'MEET'], 'unified', [0.9, 0.95]);
assert.strictEqual(s2_short.englishSentence, 'Nice to meet you.');
console.log(`✓ Passed: ['NICE', 'MEET'] -> "${s2_short.englishSentence}" [Urdu: ${s2_short.urduSentence}]`);

const s2_meet_you = formatSentence(['MEET', 'YOU'], 'unified', [0.9, 0.95]);
assert.strictEqual(s2_meet_you.englishSentence, 'Nice to meet you.');
console.log(`✓ Passed: ['MEET', 'YOU'] -> "${s2_meet_you.englishSentence}" [Urdu: ${s2_meet_you.urduSentence}]`);

// Test 3: "I am ill, I want to buy medicine."
console.log('\nTest 3: I am ill, I want to buy medicine?...');
const s3_full_en = formatSentence(['ME', 'Bemar', 'MEDICINE', 'BUY'], 'unified', [0.9, 0.9, 0.9, 0.9]);
assert.strictEqual(s3_full_en.englishSentence, 'I am ill, I want to buy medicine.');
assert.strictEqual(s3_full_en.isPatternMatched, true);
console.log(`✓ Passed: ['ME', 'Bemar', 'MEDICINE', 'BUY'] -> "${s3_full_en.englishSentence}" [Urdu: ${s3_full_en.urduSentence}]`);

const s3_full_psl = formatSentence(['Mujhay', 'Bemar', 'Dawa', 'Kharidna'], 'unified', [0.9, 0.9, 0.9, 0.9]);
assert.strictEqual(s3_full_psl.englishSentence, 'I am ill, I want to buy medicine.');
console.log(`✓ Passed: ['Mujhay', 'Bemar', 'Dawa', 'Kharidna'] -> "${s3_full_psl.englishSentence}" [Urdu: ${s3_full_psl.urduSentence}]`);

const s3_short = formatSentence(['Bemar', 'MEDICINE', 'BUY'], 'unified', [0.9, 0.9, 0.9]);
assert.strictEqual(s3_short.englishSentence, 'I am ill, I want to buy medicine.');
console.log(`✓ Passed: ['Bemar', 'MEDICINE', 'BUY'] -> "${s3_short.englishSentence}" [Urdu: ${s3_short.urduSentence}]`);

// Test 4: "I am ill, I need medicine."
console.log('\nTest 4: I am ill, I need medicine?...');
const s4_en = formatSentence(['ME', 'Bemar', 'MEDICINE'], 'unified', [0.9, 0.9, 0.9]);
assert.strictEqual(s4_en.englishSentence, 'I am ill, I need medicine.');
console.log(`✓ Passed: ['ME', 'Bemar', 'MEDICINE'] -> "${s4_en.englishSentence}" [Urdu: ${s4_en.urduSentence}]`);

// Test 5: "Can you please help me?"
console.log('\nTest 5: Can you please help me?...');
const s5 = formatSentence(['YOU', 'HELP'], 'unified', [0.9, 0.9]);
assert.strictEqual(s5.englishSentence, 'Can you please help me?');
console.log(`✓ Passed: ['YOU', 'HELP'] -> "${s5.englishSentence}" [Urdu: ${s5.urduSentence}]`);

// Test 6: In-browser classifier heuristics for MEET (two fingers extended)
console.log('\nTest 6: Client classifier for MEET (2 fingers V-shape)...');
// Hand with index and middle extended, ring and pinky curled
const coordsMeet: number[][] = Array.from({ length: 21 }, () => [0, 0, 0]);
coordsMeet[8] = [0.1, -0.6, 0.0];  // index tip high
coordsMeet[6] = [0.1, -0.3, 0.0];  // index PIP
coordsMeet[12] = [0.2, -0.6, 0.0]; // middle tip high
coordsMeet[10] = [0.2, -0.3, 0.0]; // middle PIP
coordsMeet[16] = [0.3, -0.1, 0.0]; // ring tip down
coordsMeet[14] = [0.3, -0.2, 0.0]; // ring PIP
coordsMeet[20] = [0.4, -0.1, 0.0]; // pinky tip down
coordsMeet[18] = [0.4, -0.2, 0.0]; // pinky PIP
coordsMeet[4] = [0.0, -0.1, 0.0];  // thumb curled
coordsMeet[3] = [0.05, -0.1, 0.0];

const predMeet = classifyHandFeatures(coordsMeet);
assert.strictEqual(predMeet.sign, 'MEET');
assert.strictEqual(predMeet.status, 'recognized');
console.log(`✓ Passed: 2 fingers V-shape recognized as "${predMeet.sign}" (conf: ${predMeet.confidence})`);

console.log('\n=== All Deaf Practical Sentences Tests Passed! ===\n');
