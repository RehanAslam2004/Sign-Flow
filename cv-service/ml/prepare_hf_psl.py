"""
SignFlow PSL Extended (89 Classes) Feature Extraction & Normalization
Extracts 63-dimensional canonical hand landmark features from the 30-frame
sequences in cv-service/data/data.zip (Hugging Face Bakhtyar12/Pakistani-Sign-Language).

Produces:
1. cv-service/ml/psl_extended_features.npz (X: float32, y: str)
2. cv-service/ml/psl_extended_manifest.json
"""

import os
import sys
import io
import json
import zipfile
import numpy as np

# Ensure cv-service root is on python path for importing normalize
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from normalize import canonical_normalize_21

# Ensure UTF-8 output on Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def normalize_coords_21(coords: np.ndarray, handedness: str = "Right") -> np.ndarray:
    """
    Applies canonical wrist-centering, chirality normalization, and palm scale normalization
    identically to cv-service/preprocessing.py and cv-service/normalize.py.
    """
    return canonical_normalize_21(coords, aspect_ratio=1.0, handedness=handedness)


def process_dataset(zip_path: str, output_dir: str):
    if not os.path.exists(zip_path):
        raise FileNotFoundError(f"Dataset zip not found at {zip_path}")

    print(f"[PreparePSLExtended] Reading dataset from {zip_path}...")
    z = zipfile.ZipFile(zip_path)
    all_npy_files = [f for f in z.namelist() if f.endswith(".npy")]
    print(f"[PreparePSLExtended] Found {len(all_npy_files)} sequence files.")

    # Frame sampling indices: sample representative frames across the sequence
    sample_frame_indices = [8, 12, 15, 18, 22]

    features_list = []
    labels_list = []
    sequence_ids_list = []
    category_counts = {}

    for idx, filename in enumerate(all_npy_files):
        parts = filename.split("/")
        if len(parts) < 2:
            continue
        category = parts[1].strip()

        try:
            content = z.read(filename)
            seq_data = np.load(io.BytesIO(content))  # shape: (30, 225)
        except Exception as e:
            print(f"Warning: Failed reading {filename}: {e}")
            continue

        if seq_data.shape != (30, 225):
            continue

        # Extract frames
        for frame_idx in sample_frame_indices:
            frame = seq_data[frame_idx]
            lh = frame[:63].reshape(21, 3)
            rh = frame[63:126].reshape(21, 3)

            lh_mag = np.abs(lh).sum()
            rh_mag = np.abs(rh).sum()

            # Identify active hand & normalize with chirality alignment
            if rh_mag >= lh_mag and rh_mag > 1e-3:
                normed = normalize_coords_21(rh, handedness="Right")
                features_list.append(normed)
                labels_list.append(category)
                sequence_ids_list.append(idx)
                category_counts[category] = category_counts.get(category, 0) + 1
            elif lh_mag > 1e-3:
                normed = normalize_coords_21(lh, handedness="Left")
                features_list.append(normed)
                labels_list.append(category)
                sequence_ids_list.append(idx)
                category_counts[category] = category_counts.get(category, 0) + 1

        if (idx + 1) % 500 == 0:
            print(f"  Processed {idx + 1}/{len(all_npy_files)} files ({len(features_list)} vectors extracted)...")

    X = np.array(features_list, dtype=np.float32)
    y = np.array(labels_list, dtype=object)
    seq_ids = np.array(sequence_ids_list, dtype=np.int32)

    classes = sorted(list(set(labels_list)))
    print(f"\n[PreparePSLExtended] Extraction Complete:")
    print(f"  Total Extracted Feature Vectors: {len(X)}")
    print(f"  Unique Classes: {len(classes)}")
    print(f"  Feature Dimensions: {X.shape[1]}")
    print(f"  Unique Sequences Tracked: {len(np.unique(seq_ids))}")

    # Save npz
    os.makedirs(output_dir, exist_ok=True)
    npz_path = os.path.join(output_dir, "psl_extended_features.npz")
    np.savez_compressed(npz_path, X=X, y=y, seq_ids=seq_ids)
    print(f"  Saved features archive to: {npz_path}")

    # Save manifest
    manifest_path = os.path.join(output_dir, "psl_extended_manifest.json")
    manifest = {
        "dataset_name": "Bakhtyar12/Pakistani-Sign-Language",
        "num_sequences": len(all_npy_files),
        "total_extracted_samples": len(X),
        "num_classes": len(classes),
        "feature_dim": 63,
        "classes": classes,
        "class_sample_counts": category_counts,
    }
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    print(f"  Saved manifest to: {manifest_path}")


if __name__ == "__main__":
    base_dir = os.path.dirname(__file__)
    zip_location = os.path.join(base_dir, "..", "data", "data.zip")
    process_dataset(zip_location, base_dir)
