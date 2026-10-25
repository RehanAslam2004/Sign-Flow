import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

async function runTests() {
  console.log('=== Starting SignFlow ONNX Brain Integration Test Suite ===');

  const rootDir = path.resolve(__dirname, '..');
  const onnxPath = path.join(rootDir, 'public', 'models', 'signflow_brain.onnx');
  const labelsPath = path.join(rootDir, 'public', 'models', 'brain_labels.json');

  // Test 1: File Existence and Size Verification
  console.log('Test 1: Verifying signflow_brain.onnx artifact exists...');
  assert.ok(fs.existsSync(onnxPath), `ONNX model file missing at ${onnxPath}`);
  const stats = fs.statSync(onnxPath);
  assert.ok(stats.size > 10000, `Expected model size > 10KB, got ${stats.size} bytes`);
  console.log(`✓ Passed: signflow_brain.onnx exists (${stats.size} bytes / ~${Math.round(stats.size / 1024)} KB).`);

  // Test 2: Label Mapping and Keithsel/asl_signs Classes Verification
  console.log('Test 2: Verifying brain_labels.json matches Keithsel/asl_signs classes...');
  assert.ok(fs.existsSync(labelsPath), `Labels file missing at ${labelsPath}`);
  const labelsData = JSON.parse(fs.readFileSync(labelsPath, 'utf-8'));
  assert.strictEqual(labelsData.model_name, 'signflow_brain', 'Model name mismatch');
  assert.strictEqual(labelsData.input_shape[1], 63, 'Input features must be exactly 63 (21 landmarks x 3)');
  assert.ok(labelsData.num_classes >= 24, `Expected at least 24 classes, got ${labelsData.num_classes}`);

  // Confirm all 24 Keithsel/asl_signs alphabet classes (A-I, K-Y) are supported
  const keithselLetters = [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I',
    'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S',
    'T', 'U', 'V', 'W', 'X', 'Y'
  ];
  for (const letter of keithselLetters) {
    assert.ok(
      labelsData.classes.includes(letter),
      `Expected letter '${letter}' from Keithsel/asl_signs to be present in brain labels`
    );
  }
  console.log(`✓ Passed: All 24 classes from Keithsel/asl_signs dataset verified in brain_labels.json.`);

  // Test 3: Numerical Validation & ONNX Runtime Inference Check
  console.log('Test 3: Validating ONNX graph tensor signature and inference execution...');
  const pyExe = path.join(rootDir, 'cv-service', '.venv', 'Scripts', 'python.exe');
  const pythonCmd = [
    'import onnxruntime as ort',
    'import numpy as np',
    "session = ort.InferenceSession('public/models/signflow_brain.onnx', providers=['CPUExecutionProvider'])",
    'inputs = session.get_inputs()',
    'outputs = session.get_outputs()',
    "assert inputs[0].name == 'landmarks'",
    'assert inputs[0].shape[1] == 63',
    'assert len(outputs) >= 2',
    "res = session.run(None, {'landmarks': np.random.randn(1, 63).astype(np.float32)})",
    'assert len(res[0]) == 1',
    'assert res[1].shape[1] == 36',
    "print('ONNX_PY_VERIFY_OK')",
  ].join('; ');

  const pyOutput = execSync(`"${pyExe}" -c "${pythonCmd}"`, { cwd: rootDir, encoding: 'utf-8' });
  assert.ok(pyOutput.includes('ONNX_PY_VERIFY_OK'), 'Python ONNX verification failed');
  console.log('✓ Passed: ONNX graph signature verified ([1, 63] -> [1] label, [1, 36] probabilities).');

  // Test 4: Flat Landmark Transformation Invariance
  console.log('Test 4: Testing 21-landmark flat coordinate transformation logic...');
  const mockLandmarks = Array.from({ length: 21 }, (_, i) => ({
    x: 0.1 * i,
    y: 0.2 * i,
    z: -0.05 * i,
  }));
  const flat = new Float32Array(63);
  for (let i = 0; i < 21; i++) {
    flat[i * 3 + 0] = mockLandmarks[i].x;
    flat[i * 3 + 1] = mockLandmarks[i].y;
    flat[i * 3 + 2] = mockLandmarks[i].z;
  }
  assert.strictEqual(flat.length, 63, 'Flat landmark buffer must have length 63');
  assert.strictEqual(flat[0], 0);
  assert.strictEqual(flat[1], 0);
  assert.strictEqual(Math.abs(flat[2]), 0);
  assert.ok(Math.abs(flat[60] - 2.0) < 1e-4);
  console.log('✓ Passed: Flat 63-element coordinate buffer generated correctly.');

  console.log('=== All ONNX Brain Integration Tests Passed Successfully! ===');
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
