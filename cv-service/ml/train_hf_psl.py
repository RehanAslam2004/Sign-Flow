"""
SignFlow PSL Extended (89 Classes) ML Tournament & Training
Trains and benchmarks:
1. Random Forest Classifier
2. Multi-Layer Perceptron (MLP)
3. Calibrated Support Vector Machine (Linear SVM)

Evaluates on stratified held-out test split, selects champion,
and exports model artifacts to cv-service/model/.
"""

import os
import sys
import time
import json
import numpy as np
import joblib
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.svm import LinearSVC
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import accuracy_score, f1_score, classification_report

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def run_tournament(features_path: str, model_dir: str, reports_dir: str):
    print(f"[TrainPSLExtended] Loading dataset from {features_path}...")
    data = np.load(features_path, allow_pickle=True)
    X = data["X"]
    y = data["y"]

    classes = sorted(list(set(y)))
    num_classes = len(classes)
    print(f"[TrainPSLExtended] Total samples: {X.shape[0]}, Features: {X.shape[1]}, Classes: {num_classes}")

    seq_ids = data["seq_ids"] if "seq_ids" in data else None

    if seq_ids is not None:
        from sklearn.model_selection import GroupShuffleSplit
        print(f"[TrainPSLExtended] Using GroupShuffleSplit on {len(np.unique(seq_ids))} unique video sequences to prevent data leakage...")
        gss = GroupShuffleSplit(n_splits=1, test_size=0.20, random_state=42)
        train_idx, test_idx = next(gss.split(X, y, groups=seq_ids))
        X_train, X_test = X[train_idx], X[test_idx]
        y_train, y_test = y[train_idx], y[test_idx]
    else:
        # Fallback Stratified Train/Test Split (80% train, 20% test)
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.20, random_state=42, stratify=y
        )
    print(f"[TrainPSLExtended] Train set: {len(X_train)} samples, Test set: {len(X_test)} samples")


    candidates = {
        "RandomForest": RandomForestClassifier(
            n_estimators=150,
            max_depth=25,
            min_samples_split=2,
            n_jobs=-1,
            random_state=42,
        ),
        "MLPClassifier": MLPClassifier(
            hidden_layer_sizes=(256, 128),
            activation="relu",
            solver="adam",
            max_iter=300,
            early_stopping=True,
            validation_fraction=0.1,
            random_state=42,
        ),
        "LinearSVM": CalibratedClassifierCV(
            LinearSVC(C=1.0, dual=False, max_iter=2000, random_state=42),
            method="sigmoid",
            cv=3,
        ),
    }

    results = {}
    best_model_name = None
    best_score = -1.0

    print("\n--- Starting Model Tournament (89 PSL Classes) ---")
    for name, model in candidates.items():
        print(f"\n[Training] {name}...")
        t0 = time.time()
        model.fit(X_train, y_train)
        train_time = time.time() - t0

        # Predict & Benchmark Latency
        t1 = time.time()
        y_pred = model.predict(X_test)
        predict_time = time.time() - t1
        latency_us = (predict_time / len(X_test)) * 1_000_000

        acc = accuracy_score(y_test, y_pred)
        f1_macro = f1_score(y_test, y_pred, average="macro", zero_division=0)

        # Top-3 Accuracy if model supports predict_proba
        top3_acc = None
        if hasattr(model, "predict_proba"):
            probs = model.predict_proba(X_test)
            top3_correct = 0
            model_classes = list(model.classes_)
            for i, true_label in enumerate(y_test):
                top3_idx = np.argsort(probs[i])[-3:]
                top3_preds = [model_classes[idx] for idx in top3_idx]
                if true_label in top3_preds:
                    top3_correct += 1
            top3_acc = top3_correct / len(y_test)

        results[name] = {
            "test_accuracy": float(acc),
            "macro_f1": float(f1_macro),
            "top3_accuracy": float(top3_acc) if top3_acc is not None else None,
            "train_time_sec": round(train_time, 2),
            "latency_us_per_sample": round(latency_us, 1),
        }

        print(f"  -> Accuracy: {acc*100:.2f}% | Top-3: {top3_acc*100 if top3_acc else 0:.2f}% | Macro F1: {f1_macro:.4f} | Latency: {latency_us:.1f} us/sample | Train: {train_time:.2f}s")

        if acc > best_score:
            best_score = acc
            best_model_name = name

    print(f"\n🏆 Champion Model: {best_model_name} with {best_score*100:.2f}% Accuracy!")
    champion = candidates[best_model_name]

    # Export model and labels
    os.makedirs(model_dir, exist_ok=True)
    model_save_path = os.path.join(model_dir, "psl_extended_classifier.joblib")
    labels_save_path = os.path.join(model_dir, "psl_extended_labels.json")

    joblib.dump(champion, model_save_path, compress=3)
    with open(labels_save_path, "w", encoding="utf-8") as f:
        json.dump(classes, f, indent=2, ensure_ascii=False)

    print(f"  Saved Champion Model to: {model_save_path}")
    print(f"  Saved Class Labels to: {labels_save_path}")

    # Export report
    os.makedirs(reports_dir, exist_ok=True)
    report_path = os.path.join(reports_dir, "psl_extended_training_report.json")
    report = {
        "dataset": "Bakhtyar12/Pakistani-Sign-Language",
        "total_samples": int(X.shape[0]),
        "train_samples": int(X_train.shape[0]),
        "test_samples": int(X_test.shape[0]),
        "num_classes": num_classes,
        "classes": classes,
        "tournament_results": results,
        "champion": best_model_name,
        "champion_metrics": results[best_model_name],
    }
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"  Saved Tournament Report to: {report_path}")


if __name__ == "__main__":
    base_dir = os.path.dirname(__file__)
    feats = os.path.join(base_dir, "psl_extended_features.npz")
    models = os.path.join(base_dir, "..", "model")
    run_tournament(feats, models, base_dir)
