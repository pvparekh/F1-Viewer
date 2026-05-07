# F1 Race Viewer — Backend

FastAPI server that streams precomputed race telemetry to a frontend via WebSocket.

## Setup

```bash
pip install -r requirements.txt
```

## Step 1 — Precompute race data

Run this once to generate all race data files. **Expected time: 20–30 minutes for 8 races.**
The script can be run from anywhere in the repo — it resolves paths automatically.

```bash
python backend/precompute.py
```

To reprocess races that already have output files:

```bash
python backend/precompute.py --force
```

The script reads `backend/sessions.json` for the list of races, downloads telemetry via
FastF1 (caching raw data to `F1RaceViewer/.fastf1-cache/`), and writes two files per race
into `F1RaceViewer/computed_data/`:

| File | Size | Contents |
|------|------|----------|
| `{year}_{round}_meta.json` | ~5 KB | track points, driver colors, total frames/laps |
| `{year}_{round}_frames.json` | ~15–20 MB | stripped, downsampled frame data |

**Total expected size across 8 races: ~120–160 MB.**

> These files should be committed to Git so the deployed app has data without needing
> to run precompute again. `computed_data/` is intentionally NOT in `.gitignore`.

## Step 2 — Start the server

```bash
cd backend
uvicorn main:app --reload
```

The server starts on `http://localhost:8000` by default.

## API Reference

### `GET /health`
```json
{ "status": "ok", "races_loaded": 8 }
```

### `GET /api/sessions`
Lists all races that have both meta and frames files ready.
```json
[{ "year": 2024, "round": 8, "name": "Monaco Grand Prix" }, ...]
```

### `GET /api/sessions/{year}/{round}/metadata`
Full metadata for a race including track centerline points and driver colors.
```json
{
  "year": 2024, "round": 8, "name": "Monaco Grand Prix",
  "total_frames": 75000, "total_laps": 78, "drivers": ["HAM", "VER", ...],
  "driver_colors": { "HAM": "#00D2BE", ... },
  "track_points": [{ "x": 12345.6, "y": 23456.7 }, ...],
  "approximate_duration_seconds": 7500.0
}
```

### `WS /ws/sessions/{year}/{round}/replay`
WebSocket endpoint for streaming race frames.

**Server → client messages:**

| Message | Description |
|---------|-------------|
| `{ "type": "status", "status": "loading" }` | Frames loading from disk |
| `{ "type": "total_frames", "total_frames": 75000 }` | Sent once after load |
| `{ "type": "status", "status": "ready" }` | Ready to receive play command |
| `{ "type": "frame", "frame_index": 0, "t": 0.0, "lap": 1, "drivers": {...} }` | One frame |
| `{ "type": "status", "status": "ended" }` | Race over, connection closing |

**Client → server messages:**

| Message | Description |
|---------|-------------|
| `{ "action": "play", "from_frame": 0, "speed": 1.0 }` | Start/resume playback |
| `{ "action": "pause" }` | Pause |
| `{ "action": "seek", "to_frame": 5000 }` | Jump to frame |
| `{ "action": "set_speed", "speed": 2.0 }` | Change speed multiplier |

Speed `1.0` → one frame every 100ms. Speed `2.0` → every 50ms. Speed `0.5` → every 200ms.

## Testing WebSocket

Using [wscat](https://github.com/websockets/wscat):

```bash
npm install -g wscat
wscat -c ws://localhost:8000/ws/sessions/2024/8/replay
# After connecting, send:
{"action": "play", "from_frame": 0, "speed": 1.0}
```

Using [Insomnia](https://insomnia.rest/): create a WebSocket request to `ws://localhost:8000/ws/sessions/2024/8/replay`.
