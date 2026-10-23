"""
SignFlow Failure Sample Management & Review CLI

Usage:
    python manage_feedback.py stats
    python manage_feedback.py list [--limit 20]
    python manage_feedback.py verify <sample_id>
    python manage_feedback.py reject <sample_id>
    python manage_feedback.py export [--out psl_reviewed_addon.npz] [--verified-only]
"""

import os
import sys
import json
import argparse
import numpy as np

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
FEEDBACK_FILE = os.path.join(DATA_DIR, "reviewed_samples.jsonl")


def load_samples() -> list:
    if not os.path.exists(FEEDBACK_FILE):
        return []
    samples = []
    with open(FEEDBACK_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    samples.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
    return samples


def save_samples(samples: list):
    with open(FEEDBACK_FILE, "w", encoding="utf-8") as f:
        for s in samples:
            f.write(json.dumps(s, ensure_ascii=False) + "\n")


def cmd_stats():
    samples = load_samples()
    counts = {"pending_review": 0, "verified": 0, "rejected": 0}
    for s in samples:
        st = s.get("review_status", "pending_review")
        counts[st] = counts.get(st, 0) + 1

    print("================ SignFlow Failure Sample Dataset Stats ================")
    print(f"Total Feedback Samples: {len(samples)}")
    print(f"  Pending Review:       {counts.get('pending_review', 0)}")
    print(f"  Verified / Ground-Tr: {counts.get('verified', 0)}")
    print(f"  Rejected / Noise:     {counts.get('rejected', 0)}")
    print(f"Storage File:           {FEEDBACK_FILE}")
    print("======================================================================")


def cmd_list(limit: int = 20):
    samples = load_samples()
    if not samples:
        print("No failure samples recorded yet.")
        return

    print(f"Displaying up to {limit} of {len(samples)} samples:")
    print(f"{'ID':<18} | {'Status':<14} | {'Lang':<12} | {'Predicted':<18} | {'True Label':<18} | {'Conf':<6}")
    print("-" * 95)
    for s in samples[-limit:]:
        sid = s.get("sample_id", "")[:16]
        st = s.get("review_status", "pending_review")
        lang = s.get("language", "psl")
        pred = str(s.get("predicted_label", "None"))[:16]
        true_lbl = str(s.get("true_label", "Unknown"))[:16]
        conf = f"{s.get('confidence', 0.0):.2f}"
        print(f"{sid:<18} | {st:<14} | {lang:<12} | {pred:<18} | {true_lbl:<18} | {conf:<6}")


def cmd_update_status(sample_id: str, new_status: str):
    samples = load_samples()
    found = False
    for s in samples:
        if s.get("sample_id") == sample_id:
            s["review_status"] = new_status
            found = True
            break

    if not found:
        print(f"Error: Sample with ID '{sample_id}' not found.")
        return

    save_samples(samples)
    print(f"Successfully updated sample '{sample_id}' status to '{new_status}'.")


def cmd_export(out_path: str, verified_only: bool = True):
    samples = load_samples()
    valid_samples = []
    for s in samples:
        if verified_only and s.get("review_status") != "verified":
            continue
        feats = s.get("features")
        true_lbl = s.get("true_label")
        if feats and len(feats) == 63 and true_lbl:
            valid_samples.append((feats, true_lbl))

    if not valid_samples:
        print(f"No {'verified' if verified_only else 'valid'} samples with 63 features found to export.")
        return

    X = np.array([item[0] for item in valid_samples], dtype=np.float32)
    y = np.array([item[1] for item in valid_samples])

    np.savez_compressed(out_path, X=X, y=y)
    print(f"Exported {len(valid_samples)} samples to: {out_path}")
    print(f"  Feature shape: {X.shape}")
    print(f"  Classes ({len(set(y))}): {sorted(list(set(y)))[:10]}...")


def main():
    parser = argparse.ArgumentParser(description="SignFlow Failure Sample Manager")
    subparsers = parser.add_subparsers(dest="subcommand", help="Sub-commands")

    # stats
    subparsers.add_parser("stats", help="Show review stats")

    # list
    list_p = subparsers.add_parser("list", help="List samples")
    list_p.add_argument("--limit", type=int, default=20, help="Max entries to list")

    # verify
    verify_p = subparsers.add_parser("verify", help="Mark sample as verified ground truth")
    verify_p.add_argument("sample_id", type=str, help="Sample ID to verify")

    # reject
    reject_p = subparsers.add_parser("reject", help="Mark sample as noise / rejected")
    reject_p.add_argument("sample_id", type=str, help="Sample ID to reject")

    # export
    export_p = subparsers.add_parser("export", help="Export reviewed samples to .npz for retraining")
    export_p.add_argument("--out", type=str, default="psl_reviewed_addon.npz", help="Output .npz path")
    export_p.add_argument("--all", action="store_true", help="Include pending samples as well as verified")

    args = parser.parse_args()

    if args.subcommand == "stats" or not args.subcommand:
        cmd_stats()
    elif args.subcommand == "list":
        cmd_list(args.limit)
    elif args.subcommand == "verify":
        cmd_update_status(args.sample_id, "verified")
    elif args.subcommand == "reject":
        cmd_update_status(args.sample_id, "rejected")
    elif args.subcommand == "export":
        cmd_export(args.out, verified_only=not args.all)


if __name__ == "__main__":
    main()
