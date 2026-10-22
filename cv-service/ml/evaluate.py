"""
SignFlow ASL Model Evaluation Script
Loads the trained model from cv-service/model/ and evaluates performance,
top-k accuracy, per-class metrics, confusion matrix, and inference latency.
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

DEFAULT_MODEL_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "model", "classifier.joblib")
DEFAULT_LABELS_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "model", "labels.json")
DEFAULT_FEATURES_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "extracted_features.npz")

def evaluate_model(
    model_path: str = DEFAULT_MODEL_PATH,
    labels_path: str = DEFAULT_LABELS_PATH,
    features_path: str = DEFAULT_FEATURES_PATH,
    output_report: str = "evaluation_report.json"
) -> Dict[str, Any]:
    print(f"Loading model from: {model_path}")
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model file not found: {model_path}")

    model = joblib.load(model_path)
    model_size_kb = round(os.path.getsize(model_path) / 1024, 2)

    with open(labels_path, "r", encoding="utf-8") as f:
        labels = json.load(f)

    print(f"Model loaded successfully ({model_size_kb} KB). Total classes: {len(labels)}")

    data = np.load(features_path, allow_pickle=True)
    X = data["features"]
    y = data["labels"].astype(str)

    # Measure latency over all samples
    latencies = []
    preds = []
    probs_list = []

    has_proba = hasattr(model, "predict_proba")

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
        latencies.append((t1 - t0) * 1e6)  # microseconds
        preds.append(str(pred_class))

    preds = np.array(preds)
    latencies = np.array(latencies)

    # Metrics
    acc = round(accuracy_score(y, preds), 4)
    macro_f1 = round(f1_score(y, preds, average="macro", zero_division=0), 4)
    weighted_f1 = round(f1_score(y, preds, average="weighted", zero_division=0), 4)

    # Top-3 and Top-5 accuracy
    top3_acc = 0.0
    top5_acc = 0.0
    if has_proba:
        top3_hits = 0
        top5_hits = 0
        for i, true_val in enumerate(y):
            ranked_idx = np.argsort(probs_list[i])[::-1]
            ranked_classes = [str(model.classes_[idx]) for idx in ranked_idx]
            if true_val in ranked_classes[:3]:
                top3_hits += 1
            if true_val in ranked_classes[:5]:
                top5_hits += 1
        top3_acc = round(top3_hits / len(y), 4)
        top5_acc = round(top5_hits / len(y), 4)

    # Latency percentiles (microseconds)
    p50_latency = round(float(np.percentile(latencies, 50)), 2)
    p90_latency = round(float(np.percentile(latencies, 90)), 2)
    p99_latency = round(float(np.percentile(latencies, 99)), 2)
    avg_latency = round(float(np.mean(latencies)), 2)

    report_dict = classification_report(y, preds, output_dict=True, zero_division=0)
    conf_mat = confusion_matrix(y, preds, labels=labels).tolist()

    summary = {
        "model_file": model_path,
        "model_size_kb": model_size_kb,
        "total_test_samples": len(X),
        "total_classes": len(labels),
        "classes": labels,
        "metrics": {
            "top1_accuracy": acc,
            "top3_accuracy": top3_acc,
            "top5_accuracy": top5_acc,
            "macro_f1": macro_f1,
            "weighted_f1": weighted_f1
        },
        "latency_microseconds": {
            "mean": avg_latency,
            "p50": p50_latency,
            "p90": p90_latency,
            "p99": p99_latency
        },
        "per_class": report_dict,
        "confusion_matrix": conf_mat
    }

    print("\n--- Model Evaluation Summary ---")
    print(f"Top-1 Accuracy: {acc * 100:.2f}%")
    if has_proba:
        print(f"Top-3 Accuracy: {top3_acc * 100:.2f}%")
        print(f"Top-5 Accuracy: {top5_acc * 100:.2f}%")
    print(f"Macro F1 Score: {macro_f1:.4f}")
    print(f"Weighted F1 Score: {weighted_f1:.4f}")
    print(f"Average Latency: {avg_latency} us/sample (p95: {p90_latency} us)")

    out_file = os.path.join(os.path.dirname(__file__), output_report)
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    print(f"Saved evaluation report to: {out_file}")

    return summary

def main():
    parser = argparse.ArgumentParser(description="Evaluate SignFlow ASL Model")
    parser.add_argument("--model", default=DEFAULT_MODEL_PATH, help="Path to classifier.joblib")
    parser.add_argument("--labels", default=DEFAULT_LABELS_PATH, help="Path to labels.json")
    parser.add_argument("--features", default=DEFAULT_FEATURES_PATH, help="Path to extracted_features.npz")
    parser.add_argument("--output", default="evaluation_report.json", help="Output report JSON")
    args = parser.parse_args()

    evaluate_model(args.model, args.labels, args.features, args.output)

if __name__ == "__main__":
    main()
