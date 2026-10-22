"""
SignFlow PSL Model Training & Tournament Pipeline
Trains and evaluates models for:
1. PSL Conversational Words (12 classes) -> model/psl_words_classifier.joblib
2. PSL Urdu Alphabets (37 classes) -> model/psl_alphabets_classifier.joblib
"""

import os
import sys
import json
import time
import argparse
import numpy as np
import joblib
from typing import Dict, Any, Tuple, List
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.svm import SVC
from sklearn.metrics import classification_report, accuracy_score, f1_score, confusion_matrix

RANDOM_STATE = 42

def augment_landmarks_2d(feature_vector: np.ndarray) -> np.ndarray:
    """In-plane 2D rotation, scale, and jitter augmentation."""
    coords = feature_vector.reshape(21, 3).copy()
    
    # 1. In-plane rotation around Z axis (roll +/- 6 degrees)
    angle = np.radians(np.random.uniform(-6.0, 6.0))
    cos_a, sin_a = np.cos(angle), np.sin(angle)
    R = np.array([
        [cos_a, -sin_a],
        [sin_a, cos_a]
    ])
    coords[:, :2] = coords[:, :2] @ R.T

    # 2. Scale jitter (+/- 5%)
    scale = np.random.uniform(0.95, 1.05)
    coords[:, :2] *= scale

    # 3. Coordinate noise
    noise = np.random.normal(0, 0.010, size=coords[:, :2].shape)
    coords[:, :2] += noise

    # Canonical re-normalization
    wrist = coords[0].copy()
    centered = coords - wrist
    scale_dist = np.hypot(centered[8, 0], centered[8, 1])
    if scale_dist < 1e-4:
        scale_dist = 1.0
    centered[:, :2] /= scale_dist

    return centered.flatten().astype(np.float32)

def augment_dataset(X_train: np.ndarray, y_train: np.ndarray, target_per_class: int = 120) -> Tuple[np.ndarray, np.ndarray]:
    unique_classes = np.unique(y_train)
    X_aug_list = [X_train]
    y_aug_list = [y_train]

    np.random.seed(RANDOM_STATE)
    for cls in unique_classes:
        cls_mask = (y_train == cls)
        cls_samples = X_train[cls_mask]
        current_count = len(cls_samples)
        needed = max(0, target_per_class - current_count)

        if needed > 0 and current_count > 0:
            indices = np.random.choice(current_count, size=needed, replace=True)
            for idx in indices:
                aug_feat = augment_landmarks_2d(cls_samples[idx])
                X_aug_list.append(aug_feat.reshape(1, -1))
                y_aug_list.append(np.array([cls]))

    X_augmented = np.vstack(X_aug_list)
    y_augmented = np.concatenate(y_aug_list)
    return X_augmented, y_augmented

def train_suite(
    npz_filename: str,
    output_prefix: str,
    model_export_dir: str = "../model",
    target_samples_per_class: int = 120
) -> Dict[str, Any]:
    npz_path = os.path.join(os.path.dirname(__file__), npz_filename)
    if not os.path.exists(npz_path):
        raise FileNotFoundError(f"Feature dataset not found: {npz_path}. Run prepare_psl.py first.")

    data = np.load(npz_path, allow_pickle=True)
    X = data["features"]
    y = data["labels"].astype(str)
    classes = sorted(list(np.unique(y)))

    print(f"\n=======================================================")
    print(f"Training Pipeline: {output_prefix}")
    print(f"Loaded {len(X)} samples across {len(classes)} classes.")
    print(f"=======================================================")

    # Stratified Split 70/15/15
    X_train_raw, X_temp, y_train_raw, y_temp = train_test_split(
        X, y, test_size=0.30, random_state=RANDOM_STATE, stratify=y
    )
    X_val, X_test, y_val, y_test = train_test_split(
        X_temp, y_temp, test_size=0.50, random_state=RANDOM_STATE, stratify=y_temp
    )

    print(f"Raw Splits - Train: {len(X_train_raw)}, Val: {len(X_val)}, Test: {len(X_test)}")

    # Augment training set if needed
    if target_samples_per_class > 0:
        X_train, y_train = augment_dataset(X_train_raw, y_train_raw, target_per_class=target_samples_per_class)
        print(f"Augmented Train Size: {len(X_train)} samples")
    else:
        X_train, y_train = X_train_raw, y_train_raw

    # Tournament Candidates
    candidates = {
        "RandomForest": RandomForestClassifier(
            n_estimators=120,
            max_depth=16,
            min_samples_split=2,
            random_state=RANDOM_STATE,
            n_jobs=-1
        ),
        "MLP": MLPClassifier(
            hidden_layer_sizes=(128, 64),
            activation="relu",
            alpha=0.001,
            max_iter=350,
            early_stopping=True,
            random_state=RANDOM_STATE
        ),
        "SVM": SVC(
            C=5.0,
            kernel="rbf",
            probability=True,
            random_state=RANDOM_STATE
        )
    }

    tournament_results = {}
    best_candidate_name = None
    best_val_macro_f1 = -1.0
    best_model = None

    print("\n--- Running Tournament: Validation Benchmarks ---")
    for name, model in candidates.items():
        t0 = time.time()
        model.fit(X_train, y_train)
        train_time = round(time.time() - t0, 3)

        t_infer = time.time()
        val_preds = model.predict(X_val)
        latency_us = round(((time.time() - t_infer) / max(len(X_val), 1)) * 1e6, 2)

        val_acc = round(accuracy_score(y_val, val_preds), 4)
        val_macro_f1 = round(f1_score(y_val, val_preds, average="macro", zero_division=0), 4)
        val_weighted_f1 = round(f1_score(y_val, val_preds, average="weighted", zero_division=0), 4)

        print(f"  [{name}] Train Time: {train_time}s | Val Acc: {val_acc*100:.2f}% | Val Macro-F1: {val_macro_f1:.4f} | Latency: {latency_us} us/sample")

        tournament_results[name] = {
            "train_time_sec": train_time,
            "val_accuracy": val_acc,
            "val_macro_f1": val_macro_f1,
            "val_weighted_f1": val_weighted_f1,
            "latency_us_per_sample": latency_us
        }

        if val_macro_f1 > best_val_macro_f1:
            best_val_macro_f1 = val_macro_f1
            best_candidate_name = name
            best_model = model

    print(f"\n[CHAMPION]: {best_candidate_name} (Val Macro-F1: {best_val_macro_f1:.4f})")

    # Evaluate Champion on Held-Out Test Set
    test_preds = best_model.predict(X_test)
    test_acc = round(accuracy_score(y_test, test_preds), 4)
    test_macro_f1 = round(f1_score(y_test, test_preds, average="macro", zero_division=0), 4)
    test_weighted_f1 = round(f1_score(y_test, test_preds, average="weighted", zero_division=0), 4)

    # Top-3 Accuracy
    has_proba = hasattr(best_model, "predict_proba")
    top3_acc = 0.0
    if has_proba:
        probs = best_model.predict_proba(X_test)
        top3_hits = 0
        for i, true_val in enumerate(y_test):
            ranked_idx = np.argsort(probs[i])[::-1]
            ranked_classes = [str(best_model.classes_[idx]) for idx in ranked_idx]
            if true_val in ranked_classes[:3]:
                top3_hits += 1
        top3_acc = round(top3_hits / len(y_test), 4)

    print(f"--- Final Held-Out Test Evaluation ---")
    print(f"  Test Accuracy: {test_acc * 100:.2f}%")
    if has_proba:
        print(f"  Test Top-3 Accuracy: {top3_acc * 100:.2f}%")
    print(f"  Test Macro-F1: {test_macro_f1:.4f}")
    print(f"  Test Weighted-F1: {test_weighted_f1:.4f}")

    # Export Champion
    export_dir = os.path.join(os.path.dirname(__file__), model_export_dir)
    os.makedirs(export_dir, exist_ok=True)

    model_path = os.path.join(export_dir, f"{output_prefix}_classifier.joblib")
    labels_path = os.path.join(export_dir, f"{output_prefix}_labels.json")

    joblib.dump(best_model, model_path)
    with open(labels_path, "w", encoding="utf-8") as f:
        json.dump(classes, f, indent=2, ensure_ascii=False)

    print(f"Saved model artifact to: {model_path}")
    print(f"Saved labels mapping to: {labels_path}")

    # Save Report
    report = {
        "suite": output_prefix,
        "classes": classes,
        "total_classes": len(classes),
        "tournament_results": tournament_results,
        "selected_champion": best_candidate_name,
        "test_metrics": {
            "accuracy": test_acc,
            "top3_accuracy": top3_acc,
            "macro_f1": test_macro_f1,
            "weighted_f1": test_weighted_f1
        },
        "model_file": model_path,
        "labels_file": labels_path
    }

    report_path = os.path.join(os.path.dirname(__file__), f"{output_prefix}_report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    return report

def main():
    parser = argparse.ArgumentParser(description="Train PSL models")
    parser.add_argument("--suite", choices=["words", "alphabets", "all"], default="all")
    args = parser.parse_args()

    if args.suite in ["words", "all"]:
        train_suite(
            npz_filename="psl_words_features.npz",
            output_prefix="psl_words",
            target_samples_per_class=120
        )

    if args.suite in ["alphabets", "all"]:
        train_suite(
            npz_filename="psl_alphabets_features.npz",
            output_prefix="psl_alphabets",
            target_samples_per_class=0  # already 5,112 samples, no synthetic augmentation needed
        )

if __name__ == "__main__":
    main()
