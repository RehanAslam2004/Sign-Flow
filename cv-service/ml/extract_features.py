"""
SignFlow ASL Feature Extraction Pipeline
Extracts 21 3D MediaPipe hand landmarks from dataset images and normalizes them
using the canonical SignFlow feature normalizer (preprocessing.py).
"""

import os
import sys
import json
import argparse
import numpy as np
import cv2
from typing import List, Dict, Any, Tuple

# Import canonical preprocessing from cv-service
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from preprocessing import normalize_hand_landmarks

import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

DEFAULT_KAGGLE_PATH = os.path.expanduser(
    r"~/.cache/kagglehub/datasets/jeyasrisenthil/hand-signs-asl-hand-sign-data/versions/1/DATASET"
)
DEFAULT_MODEL_TASK = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "model", "hand_landmarker.task")

def create_detector(model_path: str, min_detection_confidence: float = 0.01):
    base_options = python.BaseOptions(model_asset_path=model_path)
    options = vision.HandLandmarkerOptions(
        base_options=base_options,
        num_hands=1,
        min_hand_detection_confidence=min_detection_confidence,
        min_hand_presence_confidence=min_detection_confidence,
        min_tracking_confidence=min_detection_confidence
    )
    return vision.HandLandmarker.create_from_options(options)

def extract_landmarks_from_image(detector, image_path: str) -> Tuple[bool, List[Dict[str, float]]]:
    bgr = cv2.imread(image_path)
    if bgr is None:
        return False, []

    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    h, w = rgb.shape[:2]

    # Try direct detection first
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
    result = detector.detect(mp_image)

    if result.hand_landmarks and len(result.hand_landmarks) > 0:
        hand_points = result.hand_landmarks[0]
        landmarks = [{"x": pt.x, "y": pt.y, "z": pt.z} for pt in hand_points]
        return True, landmarks

    # If direct detection fails due to edge crop / bounding box, try with neutral padding
    padded = cv2.copyMakeBorder(rgb, 50, 50, 50, 50, cv2.BORDER_CONSTANT, value=[240, 240, 240])
    mp_padded = mp.Image(image_format=mp.ImageFormat.SRGB, data=padded)
    res_pad = detector.detect(mp_padded)
    if res_pad.hand_landmarks and len(res_pad.hand_landmarks) > 0:
        hand_points = res_pad.hand_landmarks[0]
        # Re-scale normalized coordinates back from padded (w+100, h+100) to original (w, h)
        pw, ph = w + 100, h + 100
        landmarks = []
        for pt in hand_points:
            orig_x = (pt.x * pw - 50) / w
            orig_y = (pt.y * ph - 50) / h
            landmarks.append({"x": max(0.0, min(1.0, orig_x)), "y": max(0.0, min(1.0, orig_y)), "z": pt.z})
        return True, landmarks

    return False, []

def process_dataset(
    dataset_dir: str = DEFAULT_KAGGLE_PATH,
    model_task: str = DEFAULT_MODEL_TASK,
    output_path: str = "extracted_features.npz"
):
    print("Initializing MediaPipe HandLandmarker detector...")
    detector = create_detector(model_task)

    classes = sorted([d for d in os.listdir(dataset_dir) if os.path.isdir(os.path.join(dataset_dir, d))])
    print(f"Found {len(classes)} classes: {classes}")

    all_features = []
    all_labels = []
    metadata = []
    detected_per_class = {}

    for cls_idx, cls_name in enumerate(classes):
        cls_dir = os.path.join(dataset_dir, cls_name)
        images = sorted([f for f in os.listdir(cls_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))])
        cls_success = 0

        for img_name in images:
            img_path = os.path.join(cls_dir, img_name)
            success, raw_landmarks = extract_landmarks_from_image(detector, img_path)

            if success and len(raw_landmarks) == 21:
                try:
                    norm_features = normalize_hand_landmarks(raw_landmarks, image_width=300, image_height=300)
                    all_features.append(norm_features)
                    all_labels.append(cls_name)
                    metadata.append({"class": cls_name, "file": img_name, "class_index": cls_idx})
                    cls_success += 1
                except Exception as e:
                    print(f"Normalization error for {cls_name}/{img_name}: {e}")

        detected_per_class[cls_name] = cls_success
        print(f"Class {cls_name}: {cls_success}/{len(images)} landmark sets extracted")

    detector.close()

    features_arr = np.array(all_features, dtype=np.float32)
    labels_arr = np.array(all_labels)

    out_file = os.path.join(os.path.dirname(__file__), output_path)
    np.savez_compressed(
        out_file,
        features=features_arr,
        labels=labels_arr,
        classes=np.array(classes)
    )

    summary_file = os.path.join(os.path.dirname(__file__), "extraction_summary.json")
    with open(summary_file, "w", encoding="utf-8") as f:
        json.dump({
            "total_extracted": len(all_features),
            "feature_dim": int(features_arr.shape[1]) if len(all_features) > 0 else 0,
            "classes": classes,
            "per_class": detected_per_class
        }, f, indent=2)

    print("\n--- Feature Extraction Complete ---")
    print(f"Total Landmark Feature Vectors: {features_arr.shape[0]}")
    print(f"Feature Vector Dimension: {features_arr.shape[1] if len(all_features) > 0 else 0}")
    print(f"Saved features array to: {out_file}")
    print(f"Saved extraction summary to: {summary_file}")

    return features_arr, labels_arr, classes

def main():
    parser = argparse.ArgumentParser(description="Extract MediaPipe features from Kaggle ASL dataset")
    parser.add_argument("--dataset-dir", default=DEFAULT_KAGGLE_PATH, help="Path to DATASET folder")
    parser.add_argument("--model-task", default=DEFAULT_MODEL_TASK, help="Path to hand_landmarker.task")
    parser.add_argument("--output", default="extracted_features.npz", help="Output .npz file")
    args = parser.parse_args()

    process_dataset(args.dataset_dir, args.model_task, args.output)

if __name__ == "__main__":
    main()
