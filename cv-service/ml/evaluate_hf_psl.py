"""
SignFlow PSL Extended (89 Classes) Champion Model Evaluation
Evaluates exported psl_extended_classifier.joblib against held-out test split.
Computes Top-1, Top-3, Top-5 accuracy, Macro F1, and latency percentiles.
"""

import os
import sys
import time
import json
import numpy as np
import joblib
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, f1_score

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def evaluate_model(features_path: str, model_path: str, labels_path: str, output_path: str):
    print(f"[EvaluatePSLExtended] Loading model from {model_path}...")
    model = joblib.load(model_path)
    with open(labels_path, "r", encoding="utf-8") as f:
        labels = json.load(f)

    print(f"[EvaluatePSLExtended] Model has {len(labels)} classes.")

    data = np.load(features_path, allow_pickle=True)
    X = data["X"]
    y = data["y"]

    # Use identical stratified test split
    _, X_test, _, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )

    print(f"[EvaluatePSLExtended] Running inference on {len(X_test)} held-out test samples...")

    # Benchmark Latency per sample
    latencies = []
    for i in range(min(1000, len(X_test))):
        t0 = time.perf_counter()
        _ = model.predict(X_test[i : i + 1])
        latencies.append((time.perf_counter() - t0) * 1_000_000)

    p50 = float(np.percentile(latencies, 50))
    p95 = float(np.percentile(latencies, 95))
    p99 = float(np.percentile(latencies, 99))

    # Top-1 Accuracy & Macro F1
    y_pred = model.predict(X_test)
    acc = float(accuracy_score(y_test, y_pred))
    macro_f1 = float(f1_score(y_test, y_pred, average="macro", zero_division=0))

    # Top-3 and Top-5 Accuracy
    top3_acc = 0.0
    top5_acc = 0.0
    if hasattr(model, "predict_proba"):
        probs = model.predict_proba(X_test)
        model_classes = list(model.classes_)
        top3_hits = 0
        top5_hits = 0
        for i, true_label in enumerate(y_test):
            sorted_idx = np.argsort(probs[i])
            top3_labels = [model_classes[idx] for idx in sorted_idx[-3:]]
            top5_labels = [model_classes[idx] for idx in sorted_idx[-5:]]
            if true_label in top3_labels:
                top3_hits += 1
            if true_label in top5_labels:
                top5_hits += 1
        top3_acc = float(top3_hits / len(y_test))
        top5_acc = float(top5_hits / len(y_test))

    print(f"\n================ Evaluation Results ================")
    print(f"Top-1 Accuracy: {acc*100:.2f}%")
    print(f"Top-3 Accuracy: {top3_acc*100:.2f}%")
    print(f"Top-5 Accuracy: {top5_acc*100:.2f}%")
    print(f"Macro F1 Score: {macro_f1:.4f}")
    print(f"Latency (p50):   {p50:.1f} us ({p50/1000:.3f} ms)")
    print(f"Latency (p95):   {p95:.1f} us ({p95/1000:.3f} ms)")
    print(f"Latency (p99):   {p99:.1f} us ({p99/1000:.3f} ms)")
    print(f"====================================================\n")

    summary = {
        "num_classes": len(labels),
        "test_samples": len(X_test),
        "top1_accuracy": acc,
        "top3_accuracy": top3_acc,
        "top5_accuracy": top5_acc,
        "macro_f1": macro_f1,
        "latency_us_p50": p50,
        "latency_us_p95": p95,
        "latency_us_p99": p99,
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    print(f"Saved evaluation summary to: {output_path}")


if __name__ == "__main__":
    base_dir = os.path.dirname(__file__)
    feats = os.path.join(base_dir, "psl_extended_features.npz")
    models = os.path.join(base_dir, "..", "model", "psl_extended_classifier.joblib")
    lbls = os.path.join(base_dir, "..", "model", "psl_extended_labels.json")
    out = os.path.join(base_dir, "psl_extended_eval_summary.json")
    evaluate_model(feats, models, lbls, out)
