/**
 * SignFlow ONNX Brain Inference Engine
 *
 * Implements the on-device AI Brain:
 * Webcam Feed -> MediaPipe Hands -> 21 Canonical Landmarks (63 floats) -> ONNX Inference
 * Compatible with Keithsel/asl_signs alphabet mapping and target ASL vocabulary.
 */

import { LandmarkPoint, PredictionCandidate } from '@/types/contract';

export interface BrainPrediction {
  sign: string;
  confidence: number;
  margin: number;
  topCandidates: PredictionCandidate[];
  latencyMs: number;
  isBrainModel: boolean;
}

let cachedOrt: any = null;

async function getOrt(): Promise<any> {
  if (cachedOrt) return cachedOrt;
  if (typeof window === 'undefined') return null;

  if ((window as any).ort) {
    cachedOrt = (window as any).ort;
    return cachedOrt;
  }

  return new Promise((resolve, reject) => {
    let script = document.querySelector('script[data-ort="true"]') as HTMLScriptElement;
    if (script) {
      if ((window as any).ort) {
        cachedOrt = (window as any).ort;
        return resolve(cachedOrt);
      }
      script.addEventListener('load', () => {
        cachedOrt = (window as any).ort;
        resolve(cachedOrt);
      });
      script.addEventListener('error', (err) => reject(err));
      return;
    }

    script = document.createElement('script');
    script.src = '/ort/ort.min.js';
    script.setAttribute('data-ort', 'true');
    script.async = true;
    script.onload = () => {
      cachedOrt = (window as any).ort;
      resolve(cachedOrt);
    };
    script.onerror = () => {
      // CDN Fallback
      const cdnScript = document.createElement('script');
      cdnScript.src = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/ort.min.js';
      cdnScript.setAttribute('data-ort', 'true');
      cdnScript.async = true;
      cdnScript.onload = () => {
        cachedOrt = (window as any).ort;
        resolve(cachedOrt);
      };
      cdnScript.onerror = (e) => reject(new Error('Failed to load ONNX Runtime Web engine'));
      document.head.appendChild(cdnScript);
    };
    document.head.appendChild(script);
  });
}

class ONNXBrainManager {
  private session: any = null;
  private isInitializing: boolean = false;
  private isLoaded: boolean = false;
  private classes: string[] = [];

  /**
   * Initializes the ONNX WebAssembly session.
   * Only runs in browser environment with WebAssembly support.
   */
  async init(): Promise<boolean> {
    if (this.isLoaded) return true;
    if (typeof window === 'undefined') return false; // SSR safety check
    if (this.isInitializing) return false;

    this.isInitializing = true;
    try {
      // Dynamically load labels metadata
      const labelsRes = await fetch('/models/brain_labels.json');
      if (labelsRes.ok) {
        const labelsData = await labelsRes.json();
        this.classes = labelsData.classes || [];
      }

      const ort = await getOrt();
      if (!ort) {
        console.warn('[ONNXBrain] ONNX runtime could not be loaded');
        return false;
      }

      // Configure ONNX WebAssembly execution
      if (ort.env?.wasm) {
        ort.env.wasm.numThreads = 1;
        ort.env.wasm.simd = true;
        ort.env.wasm.proxy = false; // Run directly on main thread for zero worker latency & no worker CSP issues
        ort.env.wasm.wasmPaths = '/ort/';
      }

      // Load signflow_brain.onnx from public/models/
      this.session = await ort.InferenceSession.create('/models/signflow_brain.onnx', {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
      });

      this.isLoaded = true;
      console.log(`[ONNXBrain] Successfully loaded ONNX Brain model (Wasm) with ${this.classes.length} classes.`);
      return true;
    } catch (err) {
      console.warn('[ONNXBrain] Failed to load ONNX model:', err);
      this.isLoaded = false;
      return false;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Executes inference on 21 3D hand landmarks using canonical wrist-centering
   * and scale-normalization matching the training feature distribution.
   */
  async predict(landmarks: LandmarkPoint[] | number[], handedness?: string): Promise<BrainPrediction | null> {
    if (!this.isLoaded || !this.session) {
      if (!this.isInitializing) {
        this.init();
      }
      return null;
    }

    if (!landmarks || landmarks.length === 0) {
      return null;
    }

    const t0 = performance.now();

    try {
      // Flatten 21 landmarks into standard Float32Array[63] with canonical normalization
      const flat = new Float32Array(63);

      if (typeof landmarks[0] === 'number') {
        const numArr = landmarks as number[];
        for (let i = 0; i < 63 && i < numArr.length; i++) {
          flat[i] = numArr[i];
        }
      } else {
        const pts = landmarks as LandmarkPoint[];
        if (pts.length < 21) return null;

        // Canonical normalization matching cv-service/preprocessing.py & training
        const wrist = pts[0];
        const mcpMiddle = pts[9];
        let scaleDist = Math.hypot(
          mcpMiddle.x - wrist.x,
          mcpMiddle.y - wrist.y,
          (mcpMiddle.z || 0) - (wrist.z || 0)
        );

        if (scaleDist < 1e-4) {
          // Fallback to median across MCP 5, 9, 17
          const spans = [
            Math.hypot(pts[5].x - wrist.x, pts[5].y - wrist.y, (pts[5].z || 0) - (wrist.z || 0)),
            Math.hypot(pts[9].x - wrist.x, pts[9].y - wrist.y, (pts[9].z || 0) - (wrist.z || 0)),
            Math.hypot(pts[17].x - wrist.x, pts[17].y - wrist.y, (pts[17].z || 0) - (wrist.z || 0)),
          ].filter((s) => s > 1e-4);
          spans.sort((a, b) => a - b);
          scaleDist = spans.length > 0 ? spans[Math.floor(spans.length / 2)] : 1.0;
        }

        const isLeft = handedness && handedness.trim().toLowerCase() === 'left';

        for (let i = 0; i < 21; i++) {
          let x = (pts[i].x - wrist.x) / scaleDist;
          let y = (pts[i].y - wrist.y) / scaleDist;
          let z = ((pts[i].z || 0) - (wrist.z || 0)) / scaleDist;
          if (isLeft) {
            x = -x; // Chirality normalization
          }
          flat[i * 3 + 0] = x;
          flat[i * 3 + 1] = y;
          flat[i * 3 + 2] = z;
        }
      }

      const ort = await getOrt();
      if (!ort) return null;

      const tensor = new ort.Tensor('float32', flat, [1, 63]);

      // Run ONNX inference
      const results = await this.session.run({ landmarks: tensor });

      // Extract probabilities tensor
      const probTensor = results.probabilities || results.output_probability || Object.values(results)[1];
      const probData = probTensor?.data ? (Array.from(probTensor.data) as number[]) : [];

      let bestIdx = 0;
      let maxProb = 0;
      let secondProb = 0;

      for (let i = 0; i < probData.length; i++) {
        const p = probData[i];
        if (p > maxProb) {
          secondProb = maxProb;
          maxProb = p;
          bestIdx = i;
        } else if (p > secondProb) {
          secondProb = p;
        }
      }

      const predictedSign = this.classes[bestIdx] || String(results.label?.data?.[0] || 'UNKNOWN');
      const margin = maxProb - secondProb;
      const latencyMs = Math.round((performance.now() - t0) * 100) / 100;

      // Construct top 3 candidates
      const sortedIndices = probData
        .map((p, idx) => ({ idx, prob: p }))
        .sort((a, b) => b.prob - a.prob)
        .slice(0, 3);

      const topCandidates: PredictionCandidate[] = sortedIndices.map((item) => ({
        sign: this.classes[item.idx] || String(item.idx),
        confidence: Math.round(item.prob * 100) / 100,
      }));

      return {
        sign: predictedSign,
        confidence: Math.round(maxProb * 100) / 100,
        margin: Math.round(margin * 100) / 100,
        topCandidates,
        latencyMs,
        isBrainModel: true,
      };
    } catch (err) {
      console.warn('[ONNXBrain] Inference error:', err);
      return null;
    }
  }

  isReady(): boolean {
    return this.isLoaded && this.session !== null;
  }
}

export const onnxBrain = new ONNXBrainManager();
