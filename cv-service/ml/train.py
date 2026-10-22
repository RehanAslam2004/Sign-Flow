"""
SignFlow ASL Model Training & Automated Tournament Pipeline
Trains and compares candidate classifiers (Random Forest, MLP, SVM)
on normalized MediaPipe hand landmark features, selecting and exporting
the champion model to cv-service/model/ for live FastAPI inference.
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

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from preprocessing import normalize_hand_landmarks

RANDOM_STATE = 42

def rotate_landmarks_3d(coords: np.ndarray, max_angle_deg: float = 8.0) -> np.ndarray:
    """Applies small random 3D rotations around X, Y, and Z axes."""
    angles = np.radians(np.random.uniform(-max_angle_deg, max_angle_deg, size=3))
    ax, ay, az = angles

    Rx = np.array([
        [1, 0, 0],
        [0, np.cos(ax), -np.sin(ax)],
        [0, np.sin(ax), np.cos(ax)]
    ])
    Ry = np.array([
        [np.cos(ay), 0, np.sin(ay)],
        [0, 1, 0],
        [-np.sin(ay), 0, np.cos(ay)]
    ])
    Rz = np.array([
        [np.cos(az), -np.sin(az), 0],
        [np.sin(az), np.cos(az), 0],
        [0, 0, 1]
    ])
    R = Rz @ Ry @ Rx
    return coords @ R.T

def augment_landmarks(feature_vector: np.ndarray) -> np.ndarray:
    """Applies realistic geometric augmentation and enforces canonical re-normalization."""
    coords = feature_vector.reshape(21, 3).copy()

    # 1. Random 3D Rotation
    coords = rotate_landmarks_3d(coords, max_angle_deg=8.0)

    # 2. Scale Jitter (±6%)
    scale_factor = np.random.uniform(0.94, 1.06)
    coords = coords * scale_factor

    # 3. Coordinate Jitter (Gaussian noise)
    noise = np.random.normal(0, 0.012, size=coords.shape)
    coords = coords + noise

    # 4. Enforce canonical normalization: wrist (0) centered, palm distance normalized
    wrist = coords[0].copy()
    centered = coords - wrist
    scale_dist = np.linalg.norm(centered[9])
    if scale_dist < 1e-4:
        scale_dist = 1.0
    normalized = centered / scale_dist

    return normalized.flatten().astype(np.float32)

def augment_training_set(X_train: np.ndarray, y_train: np.ndarray, target_per_class: int = 100) -> Tuple[np.ndarray, np.ndarray]:
    """Expands training set with augmented samples while keeping validation/test pristine."""
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
                aug_feat = augment_landmarks(cls_samples[idx])
                X_aug_list.append(aug_feat.reshape(1, -1))
                y_aug_list.append(np.array([cls]))

    X_augmented = np.vstack(X_aug_list)
    y_augmented = np.concatenate(y_aug_list)
    return X_augmented, y_augmented

def train_and_evaluate_models(
    features_npz: str = "extracted_features.npz",
    model_export_dir: str = "../model"
) -> Dict[str, Any]:
    npz_path = os.path.join(os.path.dirname(__file__), features_npz)
    if not os.path.exists(npz_path):
        raise FileNotFoundError(f"Feature dataset not found: {npz_path}. Run extract_features.py first.")

    data = np.load(npz_path, allow_pickle=True)
    X = data["features"]
    y = data["labels"]
    classes = sorted(list(data["classes"]))

    print(f"Loaded {len(X)} feature vectors across {len(classes)} classes.")

    # 1. Stratified Split: 70% Train, 15% Validation, 15% Test
    X_train_raw, X_temp, y_train_raw, y_temp = train_test_split(
        X, y, test_size=0.30, random_state=RANDOM_STATE, stratify=y
    )
    X_val, X_test, y_val, y_test = train_test_split(
        X_temp, y_temp, test_size=0.50, random_state=RANDOM_STATE, stratify=y_temp
    )

    print(f"Raw Splits - Train: {len(X_train_raw)}, Val: {len(X_val)}, Test: {len(X_test)}")

    # 2. Augment ONLY the training split
    print("Applying geometric feature augmentation to training split (target: 100 samples/class)...")
    X_train, y_train = augment_training_set(X_train_raw, y_train_raw, target_per_class=100)
    print(f"Augmented Training Set Size: {len(X_train)} samples across {len(classes)} classes.")

    # Ensure string label format
    y_train = y_train.astype(str)
    y_val = y_val.astype(str)
    y_test = y_test.astype(str)

    # 3. Define Tournament Candidates
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
            max_iter=400,
            early_stopping=True,
            random_state=RANDOM_STATE
        ),
        "SVM": SVC(
            C=3.0,
            kernel="rbf",
            probability=True,
            random_state=RANDOM_STATE
        )
    }

    tournament_results = {}
    best_candidate_name = None
    best_val_macro_f1 = -1.0
    best_model = None

    print("\n=== Model Tournament: Training & Validation ===")

    for name, model in candidates.items():
        print(f"\n--- Training Candidate: {name} ---")
        t0 = time.time()
        model.fit(X_train, y_train)
        train_time = round(time.time() - t0, 3)

        # Benchmark validation inference latency
        t_infer_start = time.time()
        val_preds = model.predict(X_val)
        infer_duration = time.time() - t_infer_start
        latency_us = round((infer_duration / max(len(X_val), 1)) * 1e6, 2)

        val_acc = round(accuracy_score(y_val, val_preds), 4)
        val_macro_f1 = round(f1_score(y_val, val_preds, average="macro", zero_division=0), 4)
        val_weighted_f1 = round(f1_score(y_val, val_preds, average="weighted", zero_division=0), 4)

        print(f"  Training Time: {train_time}s")
        print(f"  Validation Accuracy: {val_acc * 100:.2f}%")
        print(f"  Validation Macro-F1: {val_macro_f1:.4f}")
        print(f"  Validation Weighted-F1: {val_weighted_f1:.4f}")
        print(f"  Inference Latency: {latency_us} us/sample")

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

    print(f"\n[TOURNAMENT CHAMPION]: {best_candidate_name} (Val Macro-F1: {best_val_macro_f1:.4f})")

    # 4. Final Evaluation on Held-Out Test Set (Unseen during selection)
    print("\n=== Final Evaluation on Held-Out Test Set ===")
    test_preds = best_model.predict(X_test)
    test_acc = round(accuracy_score(y_test, test_preds), 4)
    test_macro_f1 = round(f1_score(y_test, test_preds, average="macro", zero_division=0), 4)
    test_weighted_f1 = round(f1_score(y_test, test_preds, average="weighted", zero_division=0), 4)
    per_class_report = classification_report(y_test, test_preds, output_dict=True, zero_division=0)
    conf_matrix = confusion_matrix(y_test, test_preds, labels=classes).tolist()

    print(f"Test Accuracy: {test_acc * 100:.2f}%")
    print(f"Test Macro-F1: {test_macro_f1:.4f}")
    print(f"Test Weighted-F1: {test_weighted_f1:.4f}")

    # 5. Export Model Artifacts
    export_dir = os.path.join(os.path.dirname(__file__), model_export_dir)
    os.makedirs(export_dir, exist_ok=True)

    model_path = os.path.join(export_dir, "classifier.joblib")
    labels_path = os.path.join(export_dir, "labels.json")

    joblib.dump(best_model, model_path)
    with open(labels_path, "w", encoding="utf-8") as f:
        json.dump(classes, f, indent=2)

    print(f"\nExported champion model to: {model_path}")
    print(f"Exported class labels to: {labels_path}")

    # 6. Save Comprehensive Evaluation Report
    report = {
        "dataset_name": "jeyasrisenthil/hand-signs-asl-hand-sign-data",
        "dataset_provenance": "KaggleHub v1",
        "random_state": RANDOM_STATE,
        "classes": classes,
        "total_classes": len(classes),
        "split_counts": {
            "train_augmented": len(X_train),
            "train_raw": len(X_train_raw),
            "val": len(X_val),
            "test": len(X_test)
        },
        "tournament_results": tournament_results,
        "selected_champion": best_candidate_name,
        "test_metrics": {
            "accuracy": test_acc,
            "macro_f1": test_macro_f1,
            "weighted_f1": test_weighted_f1
        },
        "per_class_report": per_class_report,
        "model_file": model_path,
        "labels_file": labels_path
    }

    report_path = os.path.join(os.path.dirname(__file__), "training_report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    conf_path = os.path.join(os.path.dirname(__file__), "confusion_matrix.json")
    with open(conf_path, "w", encoding="utf-8") as f:
        json.dump({"classes": classes, "matrix": conf_matrix}, f, indent=2)

    print(f"Saved training report to: {report_path}")
    print(f"Saved confusion matrix to: {conf_path}")

    return report

def main():
    parser = argparse.ArgumentParser(description="Train and evaluate SignFlow ASL model")
    parser.add_argument("--features", default="extracted_features.npz", help="Input .npz feature file")
    parser.add_argument("--export-dir", default="../model", help="Directory to export classifier.joblib and labels.json")
    args = parser.parse_args()

    train_and_evaluate_models(args.features, args.export_dir)

if __name__ == "__main__":
    main()
