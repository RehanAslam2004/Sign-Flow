"""
SignFlow PSL Dataset Preparation Script
Extracts landmark coordinates from main_dataset.db for both:
1. wordDataset (12 PSL Conversational Words) -> psl_words_features.npz
2. rightHandDataset (37 Urdu Alphabets) -> psl_alphabets_features.npz
Applies canonical wrist-centering and palm MCP scaling.
"""

import os
import sys
import json
import sqlite3
import argparse
import numpy as np
from typing import Dict, Any, Tuple, List

# Ensure safe printing of Urdu characters on Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# Ensure cv-service root is on python path for importing normalize
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from normalize import canonical_normalize_21

DEFAULT_DB_PATH = os.path.expanduser(
    r"~/.cache/kagglehub/datasets/saadbutt321/pakistan-sign-language-dataset/versions/2/main_dataset.db"
)

def normalize_openpose_landmarks_21(raw_coords_2d: np.ndarray) -> np.ndarray:
    """
    Normalizes 21 2D landmarks (shape: (21, 2)) to SignFlow canonical 63-dim feature vector.
    1. Embeds in 3D: [x, y, 0.0].
    2. Applies canonical wrist-centering (landmark 0).
    3. Scales by distance between wrist (0) and middle MCP (landmark 9).
    """
    coords_3d = np.zeros((21, 3), dtype=np.float32)
    coords_3d[:, 0] = raw_coords_2d[:, 0].astype(np.float32)
    coords_3d[:, 1] = raw_coords_2d[:, 1].astype(np.float32)
    coords_3d[:, 2] = 0.0
    return canonical_normalize_21(coords_3d, aspect_ratio=1.0, handedness=None)


def process_table(
    db_path: str,
    table_name: str,
    output_filename: str,
    label_filter: Dict[str, str] = None
) -> Tuple[np.ndarray, np.ndarray, List[str]]:
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    # Get column names
    cur.execute(f"PRAGMA table_info({table_name})")
    cols = [col[1] for col in cur.fetchall()]
    
    # Identify x and y columns
    x_cols = [f"x{i}" for i in range(1, 22)]
    y_cols = [f"y{i}" for i in range(1, 22)]
    query_cols = ", ".join(x_cols + y_cols + ["label"])

    cur.execute(f"SELECT {query_cols} FROM {table_name}")
    rows = cur.fetchall()
    conn.close()

    features_list = []
    labels_list = []

    for row in rows:
        xs = np.array(row[0:21], dtype=np.float32)
        ys = np.array(row[21:42], dtype=np.float32)
        raw_label = str(row[42]).replace('\u202c', '').replace('\u202a', '').strip()

        if label_filter and raw_label in label_filter:
            raw_label = label_filter[raw_label]

        # Stack into (21, 2)
        coords_21 = np.column_stack([xs, ys])
        
        # Guard against degenerate / unextracted rows
        if np.all(coords_21 == 0.0):
            continue

        feat_63 = normalize_openpose_landmarks_21(coords_21)
        features_list.append(feat_63)
        labels_list.append(raw_label)

    features_arr = np.array(features_list, dtype=np.float32)
    labels_arr = np.array(labels_list)
    unique_classes = sorted(list(np.unique(labels_arr)))

    out_path = os.path.join(os.path.dirname(__file__), output_filename)
    np.savez_compressed(
        out_path,
        features=features_arr,
        labels=labels_arr,
        classes=np.array(unique_classes)
    )

    print(f"\n--- Extracted Table: {table_name} ---")
    print(f"Total Samples: {len(features_arr)}")
    print(f"Total Classes ({len(unique_classes)}): {unique_classes}")
    print(f"Feature Dimension: {features_arr.shape[1]}")
    print(f"Saved to: {out_path}")

    return features_arr, labels_arr, unique_classes

def main():
    parser = argparse.ArgumentParser(description="Prepare PSL datasets from SQLite DB")
    parser.add_argument("--db-path", default=DEFAULT_DB_PATH, help="Path to main_dataset.db")
    args = parser.parse_args()

    if not os.path.exists(args.db_path):
        raise FileNotFoundError(f"Database not found: {args.db_path}")

    print(f"Reading PSL Database: {args.db_path}")

    # 1. Process 12 Conversational Words
    # Clean word label casings
    word_filter = {
        "thanks": "THANKS",
        "my": "MY",
        "little": "LITTLE",
        "good": "GOOD",
        "me": "ME",
        "what": "WHAT",
        "eat": "EAT",
        "you": "YOU",
        "name": "NAME",
        "know": "KNOW",
        "your": "YOUR",
        "phone": "PHONE"
    }
    process_table(args.db_path, "wordDataset", "psl_words_features.npz", label_filter=word_filter)

    # 2. Process 37 Urdu Alphabets
    process_table(args.db_path, "rightHandDataset", "psl_alphabets_features.npz")

if __name__ == "__main__":
    main()
