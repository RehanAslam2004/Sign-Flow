import assert from 'node:assert';
import { POST, TranslateRequest, TranslateResponse } from '../app/api/translate/route';

async function runTests() {
  console.log('=== Starting SignFlow AI Translation (/api/translate) Test Suite ===');

  // Test 1: Empty tokens payload handling
  console.log('Test 1: Empty tokens payload handling...');
  const emptyReq = {
    json: async () => ({
      tokens: [],
    } as TranslateRequest),
  } as any;
  const emptyRes = await POST(emptyReq);
  assert.strictEqual(emptyRes.status, 200, 'Expected 200 OK for empty tokens');
  const emptyData: TranslateResponse = await emptyRes.json();
  assert.strictEqual(emptyData.translatedText, '', 'Translated text should be empty');
  assert.strictEqual(emptyData.tokens.length, 0, 'Tokens array should be empty');
  console.log('✓ Passed: Empty tokens payload handled gracefully.');

  // Test 2: Whitespace-only tokens payload handling
  console.log('Test 2: Whitespace-only tokens payload handling...');
  const whitespaceReq = {
    json: async () => ({
      tokens: ['   ', ''],
    } as TranslateRequest),
  } as any;
  const whitespaceRes = await POST(whitespaceReq);
  assert.strictEqual(whitespaceRes.status, 200, 'Expected 200 OK for whitespace tokens');
  const whitespaceData: TranslateResponse = await whitespaceRes.json();
  assert.strictEqual(whitespaceData.translatedText, '', 'Whitespace should produce empty translation');
  console.log('✓ Passed: Whitespace tokens handled cleanly.');

  // Test 3: Single token translation
  console.log('Test 3: Single token translation (HELP)...');
  const helpReq = {
    json: async () => ({
      tokens: ['HELP'],
      language: 'asl',
    } as TranslateRequest),
  } as any;
  const helpRes = await POST(helpReq);
  assert.strictEqual(helpRes.status, 200, 'Expected 200 OK for HELP');
  const helpData: TranslateResponse = await helpRes.json();
  assert.ok(helpData.translatedText.length > 0, 'Expected translated text for HELP');
  assert.ok(
    helpData.translatedText.toLowerCase().includes('help'),
    `Expected 'help' in translation: got "${helpData.translatedText}"`
  );
  console.log(`✓ Passed: HELP translated to "${helpData.translatedText}" (model: ${helpData.model}).`);

  // Test 4: Multi-token continuous sign sequence synthesis (THANK YOU, GO, RESTROOM)
  console.log('Test 4: Multi-token continuous sign sequence synthesis (THANK YOU, GO, RESTROOM)...');
  const multiReq = {
    json: async () => ({
      tokens: ['THANK YOU', 'GO', 'RESTROOM'],
      language: 'asl',
    } as TranslateRequest),
  } as any;
  const multiRes = await POST(multiReq);
  assert.strictEqual(multiRes.status, 200, 'Expected 200 OK for multi-token sequence');
  const multiData: TranslateResponse = await multiRes.json();
  assert.ok(multiData.translatedText.length > 0, 'Expected synthesized sentence');
  assert.ok(
    multiData.translatedText.toLowerCase().includes('restroom') ||
      multiData.translatedText.toLowerCase().includes('thank'),
    `Expected fluid sentence with restroom/thank: got "${multiData.translatedText}"`
  );
  console.log(`✓ Passed: Tokens synthesized into: "${multiData.translatedText}" (model: ${multiData.model}, latency: ${multiData.latencyMs}ms).`);

  // Test 5: Two-token polite request synthesis (HELP, PLEASE)
  console.log('Test 5: Two-token polite request synthesis (HELP, PLEASE)...');
  const politeReq = {
    json: async () => ({
      tokens: ['HELP', 'PLEASE'],
      language: 'asl',
    } as TranslateRequest),
  } as any;
  const politeRes = await POST(politeReq);
  assert.strictEqual(politeRes.status, 200, 'Expected 200 OK for HELP, PLEASE');
  const politeData: TranslateResponse = await politeRes.json();
  assert.ok(
    politeData.translatedText.toLowerCase().includes('help') &&
      politeData.translatedText.toLowerCase().includes('please'),
    `Expected 'help' and 'please': got "${politeData.translatedText}"`
  );
  console.log(`✓ Passed: [HELP, PLEASE] synthesized into: "${politeData.translatedText}".`);

  // Test 6: Response payload structure completeness
  console.log('Test 6: Response payload structure completeness...');
  assert.ok(typeof multiData.translatedText === 'string', 'translatedText must be a string');
  assert.ok(Array.isArray(multiData.tokens), 'tokens must be an array');
  assert.ok(typeof multiData.isAiSynthesized === 'boolean', 'isAiSynthesized must be boolean');
  assert.ok(typeof multiData.model === 'string', 'model must be string');
  assert.ok(typeof multiData.latencyMs === 'number', 'latencyMs must be number');
  console.log('✓ Passed: Payload adheres strictly to TranslateResponse contract.');

  console.log('=== All AI Translation Tests Passed Successfully! ===');
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
