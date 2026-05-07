"""
Precompute race data for the backend API.

Run from anywhere — the script resolves paths automatically.
Usage:
    python backend/precompute.py
    python backend/precompute.py --force
"""

import argparse
import json
import os
import sys

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(BACKEND_DIR)
F1_DIR = os.path.join(REPO_ROOT, "F1RaceViewer")

# Change working directory so fastf1 cache and computed_data/ paths in
# f1_racetelemetry.py resolve correctly (they use bare relative paths).
os.chdir(F1_DIR)
sys.path.insert(0, F1_DIR)

from src.f1_racetelemetry import open_race_session, extract_race_telemetry, map_driver_colors  # noqa: E402


def _rgb_to_hex(rgb_tuple):
    return "#{:02X}{:02X}{:02X}".format(*rgb_tuple)


def _build_track_points(sess):
    tel = sess.laps.pick_fastest().get_telemetry()
    sampled = tel.iloc[::5]
    return [{"x": float(x), "y": float(y)} for x, y in zip(sampled["X"], sampled["Y"])]


def _strip_frames(full_frames):
    """Downsample 25 FPS → ~12.5 FPS (step=2) and strip to minimal shape."""
    stripped = []
    for frame in full_frames[::2]:
        stripped.append({
            "t": frame["t"],
            "lap": frame["lap"],
            "drivers": {
                code: {
                    "x": d["x"],
                    "y": d["y"],
                    "pos": d["position"],
                }
                for code, d in frame["drivers"].items()
            },
        })
    return stripped


def process_race(entry, force):
    year = entry["year"]
    rnd = entry["round"]
    name = entry["name"]
    key = f"{year}_{rnd}"

    meta_path = os.path.join("computed_data", f"{key}_meta.json")
    frames_path = os.path.join("computed_data", f"{key}_frames.json")

    if not force and os.path.exists(meta_path) and os.path.exists(frames_path):
        print(f"[SKIP]  {year} {name} — both files exist, use --force to reprocess")
        return

    print(f"[COMPUTE] {year} {name} (round {rnd})")

    sess = open_race_session(year, rnd)
    print(f"  Session loaded: {sess.event['EventName']}")

    full_frames = extract_race_telemetry(sess)
    print(f"  Full frames: {len(full_frames)} at 25 FPS")

    stripped = _strip_frames(full_frames)
    print(f"  Stripped frames: {len(stripped)} at ~12.5 FPS")

    last_frame = stripped[-1] if stripped else {}
    total_laps = last_frame.get("lap", 0)
    driver_list = list(last_frame.get("drivers", {}).keys())

    rgb_map = map_driver_colors(sess)
    driver_colors = {drv: _rgb_to_hex(rgb) for drv, rgb in rgb_map.items()}

    track_points = _build_track_points(sess)

    meta = {
        "year": year,
        "round": rnd,
        "name": name,
        "total_frames": len(stripped),
        "total_laps": int(total_laps),
        "drivers": driver_list,
        "driver_colors": driver_colors,
        "track_points": track_points,
        "approximate_duration_seconds": len(stripped) / 10,
    }

    os.makedirs("computed_data", exist_ok=True)

    with open(meta_path, "w") as f:
        json.dump(meta, f)

    meta_kb = os.path.getsize(meta_path) / 1024
    print(f"  Saved {meta_path} ({meta_kb:.1f} KB)")

    with open(frames_path, "w") as f:
        json.dump(stripped, f)

    frames_mb = os.path.getsize(frames_path) / (1024 * 1024)
    print(f"  Saved {frames_path} ({frames_mb:.1f} MB)")
    print(f"[DONE]  {year} {name}")


def main():
    parser = argparse.ArgumentParser(description="Precompute F1 race data for backend API")
    parser.add_argument("--force", action="store_true", help="Reprocess even if output files exist")
    args = parser.parse_args()

    sessions_path = os.path.join(BACKEND_DIR, "sessions.json")
    with open(sessions_path) as f:
        sessions = json.load(f)

    print(f"Processing {len(sessions)} races (force={args.force})\n")

    for entry in sessions:
        process_race(entry, args.force)
        print()

    print("All races processed.")


if __name__ == "__main__":
    main()
