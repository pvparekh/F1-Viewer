# F1 Race Viewer 🏎️

A real-time Formula 1 race visualization and telemetry replay tool. Reconstruct and analyze races with interactive playback controls, live leaderboard updates, and accurate driver positioning on the track.

## Overview

F1 Race Viewer uses FastF1 telemetry data to generate a frame-by-frame replay of Formula 1 races. Watch drivers navigate the track, track position changes lap-by-lap, and inspect race dynamics with full playback control.

## Features

- **Live Race Replay**: Visualize driver positions and movements throughout the entire race
- **Dynamic Leaderboard**: Track positions, gaps, and driver status in real-time
- **Lap & Time Tracking**: Monitor current lap numbers and elapsed race time
- **Retirement Status**: See when drivers retire with "OUT" status on the leaderboard
- **Playback Control**: Play, pause, rewind, and fast-forward with adjustable speed (0.5x to 4x)
- **Track Rendering**: Full track layout with accurate inner/outer boundaries based on telemetry data
- **Driver Color Coding**: Official F1 team colors for each driver

## Requirements

- Python 3.8+
- Dependencies: `fastf1`, `pandas`, `matplotlib`, `numpy`, `arcade`

Install all dependencies:
```bash
pip install -r packages.txt
```

## Usage

Run the viewer with the season and race round you'd like:

```bash
python RaceView.py --year 2025 --round 12
```

Optional parameters:
- `--refresh-data`: Force re-fetch telemetry (bypasses cache)

## Controls

| Action | Keyboard | Effect |
|--------|----------|--------|
| **Pause/Resume** | SPACE | Toggle playback |
| **Rewind** | ← | Jump 5 frames backward |
| **Fast Forward** | → | Jump 5 frames forward |
| **Speed Down** | ↓ | Decrease playback speed |
| **Speed Up** | ↑ | Increase playback speed |
| **0.5x Speed** | 1 | Set to half speed |
| **1x Speed** | 2 | Set to normal speed |
| **2x Speed** | 3 | Set to double speed |
| **4x Speed** | 4 | Set to quadruple speed |

## Project Structure

```
├── RaceView.py              # Main entry point
├── packages.txt             # Python dependencies
├── src/
│   ├── f1_racetelemetry.py  # Telemetry fetching and frame generation
│   └── f1_replay.py         # Interactive replay visualization
├── computed_data/           # Cached race frame data
```

## How It Works

1. **Data Acquisition**: Fetches official F1 telemetry via FastF1 API
2. **Frame Generation**: Builds race snapshots by resampling driver positions at 25 FPS
3. **Caching**: Stores computed frames locally to avoid repeated API calls
4. **Visualization**: Renders track and driver positions using Arcade graphics library

