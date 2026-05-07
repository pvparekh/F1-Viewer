#!/usr/bin/env python3
"""
Truncate a race frames JSON file by ~20%, keeping the exciting start and finish
while sampling the middle section.

Usage:
    cd F1RaceViewer/computed_data
    python ../../backend/truncate_race.py 2024_1_frames.json
"""

import json
import os
import sys


def truncate_frames(filepath: str) -> None:
    size_before = os.path.getsize(filepath)
    print(f"Reading {filepath} ({size_before / 1_000_000:.1f} MB)...")

    with open(filepath, "r") as f:
        frames = json.load(f)

    n = len(frames)
    print(f"Frames before: {n:,}")

    start_end = int(n * 0.20)
    head = frames[:start_end]
    tail = frames[n - start_end:]
    middle = frames[start_end : n - start_end]

    # Keep every 1.25th frame (80% of middle)
    sampled_middle = []
    pos = 0.0
    while pos < len(middle):
        sampled_middle.append(middle[int(pos)])
        pos += 1.25

    result = head + sampled_middle + tail
    print(f"Frames after:  {len(result):,} ({len(result)/n*100:.1f}% kept)")

    print(f"Writing {filepath}...")
    with open(filepath, "w") as f:
        json.dump(result, f, separators=(",", ":"))

    size_after = os.path.getsize(filepath)
    print(
        f"Size: {size_before / 1_000_000:.1f} MB → {size_after / 1_000_000:.1f} MB "
        f"({(1 - size_after / size_before) * 100:.1f}% reduction)\n"
    )


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python truncate_race.py <frames_file.json>")
        sys.exit(1)

    filepath = sys.argv[1]
    if not os.path.exists(filepath):
        print(f"Error: file not found: {filepath}")
        sys.exit(1)

    truncate_frames(filepath)
