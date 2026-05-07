#!/usr/bin/env python3
"""
Truncate a race frames JSON file by ~30%, keeping the exciting start and finish
while uniformly sampling the middle section.

Strategy:
  - Keep first 20% (race start / lap 1 battles)
  - Keep last 20%  (race finish / final laps)
  - Sample middle 60% at step=2.0 → keep 50% of middle frames
  Total kept: 20% + 30% + 20% = 70%  →  ~30% reduction per run

Usage:
    cd F1RaceViewer/computed_data
    python ../../backend/truncate_race.py 2024_1_frames.json
"""

import json
import os
import sys

HEAD_TAIL_FRAC = 0.20   # fraction of total frames to keep at start and end
MIDDLE_STEP    = 2.0    # sample every Nth frame in the middle (2.0 → keep 50%)


def truncate_frames(filepath: str) -> None:
    size_before = os.path.getsize(filepath)
    print(f"\nReading  {filepath}")
    print(f"  Size before : {size_before / 1_000_000:.2f} MB")

    with open(filepath, "r") as f:
        frames = json.load(f)

    n = len(frames)
    print(f"  Frames before: {n:,}")

    boundary = int(n * HEAD_TAIL_FRAC)
    head   = frames[:boundary]
    tail   = frames[n - boundary:]
    middle = frames[boundary : n - boundary]

    sampled_middle: list = []
    pos = 0.0
    while pos < len(middle):
        sampled_middle.append(middle[int(pos)])
        pos += MIDDLE_STEP

    result = head + sampled_middle + tail
    kept_pct = len(result) / n * 100
    print(f"  Frames after : {len(result):,}  ({kept_pct:.1f}% kept, {100 - kept_pct:.1f}% removed)")

    print(f"  Writing …")
    with open(filepath, "w") as f:
        json.dump(result, f, separators=(",", ":"))

    size_after = os.path.getsize(filepath)
    reduction  = (1 - size_after / size_before) * 100
    print(f"  Size after  : {size_after / 1_000_000:.2f} MB  ({reduction:.1f}% reduction)")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python truncate_race.py <frames_file.json>")
        sys.exit(1)

    filepath = sys.argv[1]
    if not os.path.exists(filepath):
        print(f"Error: file not found: {filepath}")
        sys.exit(1)

    truncate_frames(filepath)
    print()
