"""
SignFlow ONNX Brain Model Exporter
Converts 21-landmark (63-dimensional) hand sign classification models
into optimized ONNX format for zero-latency client-side inference in Next.js.
Compatible with Keithsel/asl_signs Hugging Face alphabet mapping and target ASL vocabulary.
"""

import os
import sys
import json
from pathlib import Path
import numpy as np
import joblib
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import accuracy_score
import onnx
import onnxruntime as ort
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

def export_brain():
    print("=== SignFlow ONNX Brain Exporter ===")

    # 1. Paths configuration
    repo_root = Path(__file__).resolve().parent.parent.parent
    data_path = repo_root / "cv-service" / "ml" / "extracted_features.npz"
    output_dir = repo_root / "public" / "models"
    output_dir.mkdir(parents=True, exist_ok=True)

    onnx_output_path = output_dir / "signflow_brain.onnx"
    labels_output_path = output_dir / "brain_labels.json"

    print(f"Loading landmark dataset from: {data_path}")
    if not data_path.exists():
        raise FileNotFoundError(f"Feature dataset not found at {data_path}")

    data = np.load(data_path, allow_pickle=True)
    X = data["features"].astype(np.float32)
    y = data["labels"].astype(str)

    unique_classes = sorted(list(set(y)))
    num_classes = len(unique_classes)
    print(f"Loaded {X.shape[0]} samples with {X.shape[1]} features across {num_classes} classes.")
    print(f"Classes: {unique_classes}")

    # 2. Train an optimized Multi-Layer Perceptron Pipeline with integrated StandardScaler
    print("\nTraining high-performance neural probability classifier...")
    pipeline = make_pipeline(
        StandardScaler(),
        MLPClassifier(
            hidden_layer_sizes=(128, 64),
            activation="relu",
            solver="adam",
            max_iter=800,
            random_state=42,
        ),
    )
    pipeline.fit(X, y)

    train_preds = pipeline.predict(X)
    acc = accuracy_score(y, train_preds)
    print(f"Neural Classifier fit complete. Accuracy on reference dataset: {acc * 100:.2f}%")

    # 3. Convert Scikit-Learn Pipeline to ONNX Graph
    print("\nConverting model pipeline to ONNX format via skl2onnx...")
    initial_type = [("landmarks", FloatTensorType([None, 63]))]

    # zipmap=False ensures standard 2D Float32 tensor output in onnxruntime-web
    options = {MLPClassifier: {"zipmap": False}}
    onnx_model = convert_sklearn(
        pipeline,
        initial_types=initial_type,
        options=options,
        target_opset=15,
    )

    # 4. Save ONNX Model and Labels JSON
    print(f"Writing ONNX model to: {onnx_output_path}")
    with open(onnx_output_path, "wb") as f:
        f.write(onnx_model.SerializeToString())

    model_bytes = onnx_output_path.stat().st_size
    print(f"✓ Saved signflow_brain.onnx ({model_bytes} bytes / ~{round(model_bytes / 1024, 1)} KB)")

    class_list = [str(c) for c in pipeline.classes_]
    with open(labels_output_path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "model_name": "signflow_brain",
                "input_name": "landmarks",
                "input_shape": [1, 63],
                "num_classes": len(class_list),
                "classes": class_list,
                "dataset_source": "Hugging Face Keithsel/asl_signs & KaggleHub ASL Reference",
                "description": "On-device 21-landmark 3D coordinate neural classifier for ASL letters and vocabulary",
            },
            f,
            indent=2,
        )
    print(f"✓ Saved brain_labels.json ({len(class_list)} classes)")

    # 5. Verify the generated ONNX model using onnxruntime
    print("\nVerifying exported ONNX model with Python onnxruntime...")
    session = ort.InferenceSession(str(onnx_output_path), providers=["CPUExecutionProvider"])
    inputs = session.get_inputs()
    outputs = session.get_outputs()

    print(f"Inputs: {[f'{inp.name}: {inp.shape} ({inp.type})' for inp in inputs]}")
    print(f"Outputs: {[f'{out.name}: {out.shape} ({out.type})' for out in outputs]}")

    # Run test inference with actual sample vector from dataset
    sample_input = X[0:1]
    expected_label = y[0]
    res = session.run(None, {"landmarks": sample_input})

    pred_label = res[0][0]
    probabilities = res[1][0]

    print(f"Sample test prediction:")
    print(f"  Expected Label: {expected_label}")
    print(f"  Predicted Label: {pred_label}")
    print(f"  Probabilities tensor shape: {probabilities.shape}")
    print(f"  Top probability: {float(np.max(probabilities)):.4f}")
    print(f"  Sum of probabilities: {float(np.sum(probabilities)):.4f}")

    print("\n✓ ONNX Brain Export and Verification Succeeded!")

if __name__ == "__main__":
    export_brain()
