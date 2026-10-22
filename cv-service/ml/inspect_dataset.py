"""
SignFlow ASL Dataset Inspection Script
Validates the Kaggle ASL dataset directory structure, sample count, image dimensions,
color channels, duplicates, and corruptions.
"""

import os
import sys
import json
import argparse
import hashlib
from typing import Dict, Any, List
from PIL import Image

DEFAULT_KAGGLE_PATH = os.path.expanduser(
    r"~/.cache/kagglehub/datasets/jeyasrisenthil/hand-signs-asl-hand-sign-data/versions/1/DATASET"
)

def inspect_dataset(dataset_dir: str, output_manifest: str = "dataset_manifest.json") -> Dict[str, Any]:
    print(f"Inspecting dataset at: {dataset_dir}")
    if not os.path.exists(dataset_dir):
        raise FileNotFoundError(f"Dataset directory not found: {dataset_dir}")

    classes = sorted([d for d in os.listdir(dataset_dir) if os.path.isdir(os.path.join(dataset_dir, d))])
    if not classes:
        raise ValueError(f"No class subdirectories found in: {dataset_dir}")

    class_counts = {}
    dimensions = set()
    color_modes = set()
    corrupt_files = []
    file_hashes = {}
    duplicates = []
    total_samples = 0

    for cls in classes:
        cls_path = os.path.join(dataset_dir, cls)
        image_files = sorted([f for f in os.listdir(cls_path) if f.lower().endswith(('.jpg', '.jpeg', '.png'))])
        class_counts[cls] = len(image_files)
        total_samples += len(image_files)

        for img_name in image_files:
            img_path = os.path.join(cls_path, img_name)
            try:
                with open(img_path, 'rb') as fp:
                    content = fp.read()
                    file_hash = hashlib.md5(content).hexdigest()
                    if file_hash in file_hashes:
                        duplicates.append((cls, img_name, file_hashes[file_hash]))
                    else:
                        file_hashes[file_hash] = (cls, img_name)

                with Image.open(img_path) as img:
                    img.verify()
                with Image.open(img_path) as img:
                    dimensions.add(f"{img.size[0]}x{img.size[1]}")
                    color_modes.add(img.mode)
            except Exception as e:
                corrupt_files.append({"class": cls, "file": img_name, "error": str(e)})

    is_balanced = len(set(class_counts.values())) == 1
    min_count = min(class_counts.values()) if class_counts else 0
    max_count = max(class_counts.values()) if class_counts else 0

    report = {
        "dataset_path": dataset_dir,
        "total_classes": len(classes),
        "classes": classes,
        "total_samples": total_samples,
        "class_counts": class_counts,
        "is_balanced": is_balanced,
        "min_samples_per_class": min_count,
        "max_samples_per_class": max_count,
        "unique_dimensions": sorted(list(dimensions)),
        "color_modes": sorted(list(color_modes)),
        "corrupt_files_count": len(corrupt_files),
        "corrupt_files": corrupt_files,
        "duplicate_files_count": len(duplicates),
    }

    print("\n--- Dataset Inspection Summary ---")
    print(f"Total Classes: {report['total_classes']}")
    print(f"Classes: {', '.join(classes)}")
    print(f"Total Samples: {report['total_samples']}")
    print(f"Balanced: {is_balanced} ({min_count} samples per class)")
    print(f"Dimensions: {report['unique_dimensions']}")
    print(f"Color Modes: {report['color_modes']}")
    print(f"Corrupt Files: {report['corrupt_files_count']}")
    print(f"Duplicate Files: {report['duplicate_files_count']}")

    output_path = os.path.join(os.path.dirname(__file__), output_manifest)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    print(f"Manifest saved to: {output_path}")

    return report

def main():
    parser = argparse.ArgumentParser(description="Inspect Kaggle ASL Dataset")
    parser.add_argument("--dataset-dir", default=DEFAULT_KAGGLE_PATH, help="Path to DATASET folder")
    parser.add_argument("--output", default="dataset_manifest.json", help="Output JSON manifest file")
    args = parser.parse_args()

    inspect_dataset(args.dataset_dir, args.output)

if __name__ == "__main__":
    main()
