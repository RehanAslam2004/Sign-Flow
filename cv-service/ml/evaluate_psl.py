"""
SignFlow PSL Model Evaluation Script
Evaluates psl_words_classifier.joblib and psl_alphabets_classifier.joblib
against held-out test datasets.
"""

import os
import sys
import json
import time
import argparse
import numpy as np
import joblib
from typing import Dict, Any
from sklearn.metrics import classification_report, accuracy_score, f1_score, confusion_matrix

DEFAULT_MODEL_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "model")

def evaluate_suite(prefix: str, npz_filename: str) -> Dict[str, Any]:
    model_path = os.path.join(DEFAULT_MODEL_DIR, f"{prefix}_classifier.joblib")
    labels_path = os.path.join(DEFAULT_MODEL_DIR, f"{prefix}_labels.json")
    npz_path = os.path.join(os.path.dirname(__file__), npz_filename)

    print(f"\n--- Evaluating {prefix} ---")
    print(f"Model: {model_path}")
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model file not found: {model_path}")

    model = joblib.load(model_path)
    with open(labels_path, "r", encoding="utf-8") as f:
        labels = json.load(f)

    data = np.load(npz_path, allow_pickle=True)
    X = data["features"]
    y = data["labels"].astype(str)

    has_proba = hasattr(model, "predict_proba")
    latencies = []
    preds = []
    probs_list = []

    for i in range(len(X)):
        feat = X[i].reshape(1, -1)
        t0 = time.perf_counter()
        if has_proba:
            p = model.predict_proba(feat)[0]
            pred_class = model.classes_[np.argmax(p)]
            probs_list.append(p)
        else:
            pred_class = model.predict(feat)[0]
        t1 = time.perf_counter()
        latencies.append((t1 - t0) * 1e6)
        preds.append(str(pred_class))

    preds = np.array(preds)
    latencies = np.array(latencies)

    acc = round(accuracy_score(y, preds), 4)
    macro_f1 = round(f1_score(y, preds, average="macro", zero_division=0), 4)
    weighted_f1 = round(f1_score(y, preds, average="weighted", zero_division=0), 4)

    top3_acc = 0.0
    if has_proba:
        top3_hits = 0
        for i, true_val in enumerate(y):
            ranked_idx = np.argsort(probs_list[i])[::-1]
            ranked_classes = [str(model.classes_[idx]) for idx in ranked_idx]
            if true_val in ranked_classes[:3]:
                top3_hits += 1
        top3_acc = round(top3_hits / len(y), 4)

    avg_latency = round(float(np.mean(latencies)), 2)
    p95_latency = round(float(np.percentile(latencies, 95)), 2)

    print(f"Total Samples: {len(X)}")
    print(f"Top-1 Accuracy: {acc * 100:.2f}%")
    if has_proba:
        print(f"Top-3 Accuracy: {top3_acc * 100:.2f}%")
    print(f"Macro F1 Score: {macro_f1:.4f}")
    print(f"Average Latency: {avg_latency} us/sample (p95: {p95_latency} us)")

    report = {
        "suite": prefix,
        "total_samples": len(X),
        "total_classes": len(labels),
        "accuracy": acc,
        "top3_accuracy": top3_acc,
        "macro_f1": macro_f1,
        "weighted_f1": weighted_f1,
        "latency_us": {"mean": avg_latency, "p95": p95_latency}
    }

    out_file = os.path.join(os.path.dirname(__file__), f"{prefix}_eval_summary.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    return report

def main():
    evaluate_suite("psl_words", "psl_words_features.npz")
    evaluate_suite("psl_alphabets", "psl_alphabets_features.npz")

if __name__ == "__main__":
    main()
