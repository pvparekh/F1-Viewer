# Formula Vision

**Real-time F1 race replay with live telemetry visualization**

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React_18-61DAFB?style=flat&logo=react&logoColor=black)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white)
![Live Demo](https://img.shields.io/badge/Live_Demo-Online-brightgreen?style=flat)

**[→ Try it live at formulavision.vercel.app](https://formulavision.vercel.app)**

> First load may take 30–60 seconds (free-tier cold start).

---

## What It Is

Formula Vision replays real F1 races using official telemetry data from the FastF1 API. Every driver's GPS position is streamed from a Python backend, interpolated to 60 FPS on the client, and rendered as a live SVG track map with a timing tower, camera follow, and per-driver stats — all running on $0/month infrastructure.

Five races are available across Monaco, Silverstone, Monza, and Bahrain (2023–2024 seasons).

---

## Features

### Race Replay
- **Smooth 60 FPS playback** from 12.5 FPS server data — client-side `requestAnimationFrame` linearly interpolates driver positions between received frames, masking all network jitter
- **WebSocket streaming** — the server pushes frames at the requested playback speed; the client doesn't request them
- **Variable speed** — 0.5×, 1×, 2×, 4× with instant switching mid-race
- **Full scrubbing** — seek anywhere in the timeline; the server resumes streaming from that frame

### Track Map
- **SVG-rendered circuits** drawn from actual FastF1 telemetry (not hand-drawn assets)
- **Battle detection** — yellow dashed lines appear between any two drivers within ~4% of the viewport, making wheel-to-wheel fights instantly visible
- **Camera follow** — click any driver to lock the view with 2.5× zoom and smooth easing; a FOLLOWING badge appears top-left next to the timing grid; press `Esc` to release
- **Track draw animation** — the circuit outline draws itself via a CSS stroke-dash animation on each race load
- **Circuit decorations** — start/finish line, famous corner labels (Casino Square, Copse, Monza Chicane, etc.), and Monaco pit lane rendered per-circuit

### Timing Tower
- **Live position order** — Framer Motion layout animations keep driver rows sorted and smoothly animated as positions change
- **Grid deltas** — green ↑ / red ↓ arrows show gain or loss vs. the starting grid, computed from the very first frame
- **Fastest lap tracker** — the race's best lap time is tracked continuously; a purple flash highlights the timing row when a new fastest lap is set

### Driver Stats Panel
- Opens when you click a driver on the grid or track; slides in from the right
- **Three Recharts visualizations**: position over elapsed race time, position by lap, and gap to the race leader by lap
- **Key statistics**: best position, current position, laps led, and fastest lap time
- Computed from a 5,000-frame circular buffer that holds the last ~500 seconds of telemetry history without unbounded memory growth

### Controls & UX
- **Quick Guide** — keyboard reference anchored to the bottom-right; slides smoothly to the bottom-left when the driver stats panel opens so both are visible simultaneously
- **Race results modal** — auto-triggers after the final lap; shows official finishing times and points fetched live from the FastF1 API
- **Keyboard shortcuts**

| Key | Action |
|-----|--------|
| `Space` | Play / Pause |
| `← →` | Seek ±100 frames (~8 seconds) |
| `Shift ← →` | Seek ±500 frames (~40 seconds) |
| `1` `2` `3` `4` | 0.5× · 1× · 2× · 4× speed |
| `F` | Toggle fullscreen |
| `Esc` | Exit camera follow |
| `?` | Full shortcut reference |

---

## Architecture

```
FastF1 API (official F1 telemetry)
        │
        ▼
  Python ETL pipeline
  (GPS resampling, position ordering, coordinate mapping → JSON)
        │
        ▼
  Precomputed JSON dataset (~60–85 MB per race)
  stored on Render filesystem
        │
        ▼ WebSocket (frames at chosen playback speed)
  FastAPI server ──────────────────────► React client
  (LRU cache, 1 race in RAM,            (60 FPS rAF interpolation,
   exponential-backoff reconnect)         circular frame buffer,
                                          SVG imperative rendering)
```

### WebSocket Protocol

**Client → Server**

```json
{ "action": "play",      "from_frame": 12400, "speed": 2.0 }
{ "action": "pause" }
{ "action": "seek",      "to_frame": 8000 }
{ "action": "set_speed", "speed": 0.5 }
```

**Server → Client**

```json
{ "type": "status",       "status": "loading" }
{ "type": "total_frames", "total_frames": 71200 }
{ "type": "status",       "status": "ready" }
{ "type": "frame",        "frame_index": 0, "t": 0.0, "lap": 1,
  "drivers": { "VER": { "x": -379.6, "y": 1297.7, "pos": 1 }, ... } }
{ "type": "status",       "status": "ended" }
```

The server runs two concurrent asyncio tasks per connection: one reads incoming client actions into a shared state dict, the other streams frames at `delay = 0.1 / speed` seconds. Frames are never buffered on the server — one is sent, then the next.

### Frame Interpolation

The server streams at ~12.5 FPS. On every `requestAnimationFrame` tick the client computes:

```
α = clamp((now − lastFrameReceived) / 80ms, 0, 1)
position = lerp(prevFrame.position, currentFrame.position, α)
```

This gives silky 60 FPS motion regardless of network timing variance.

### Coordinate Transform

FastF1 GPS data uses a real-world coordinate system (meters, Y-up, origin arbitrary). SVG uses pixels, Y-down, origin top-left. The transform is computed once from the track bounding box:

```
sx = (svgWidth  × 0.9) / (maxX − minX)
sy = (svgHeight × 0.9) / (maxY − minY)
svgX =      sx × worldX + offsetX
svgY = h − (sy × worldY + offsetY)   // Y-flip
```

All 60 FPS SVG updates use these cached scale/offset values — no layout recalculation per frame.

---

## Data Pipeline

The ETL pipeline runs offline using FastF1 and outputs two JSON files per race.

**`{year}_{round}_meta.json`** (~5 KB)
- Race name, total frames, total laps, driver list, team color hex codes
- `track_points` — 150–200 `{x, y}` coordinates sampled every 5th point from the fastest lap's telemetry

**`{year}_{round}_frames.json`** (~60–85 MB)
- Array of frames at ~12.5 FPS (downsampled 2× from 25 FPS raw telemetry)
- Each frame: `{ t, lap, drivers: { CODE: { x, y, pos } } }`

**Processing steps:**
1. Load race session via `fastf1.get_session(year, round, 'R').load(telemetry=True)`
2. Extract each driver's `SessionTime`, `X`, `Y` telemetry
3. Resample all drivers onto a uniform 25 FPS time grid via `np.interp`
4. At each time sample, sort all drivers by race distance to assign positions 1–20
5. Downsample 2× to ~12.5 FPS and strip to the minimal `{t, lap, x, y, pos}` schema

```bash
python backend/precompute.py           # process new races only
python backend/precompute.py --force   # reprocess all
```

---

## Tech Stack

**Frontend**

| | |
|---|---|
| React 18 + TypeScript | UI and type safety |
| Vite | Build tool and dev server |
| Tailwind CSS | Styling |
| Framer Motion | Layout animations (timing tower reordering, panel slide-ins) |
| Recharts | Driver position and lap time charts |
| SVG + rAF | Custom imperative rendering loop for the track map |

**Backend**

| | |
|---|---|
| FastAPI + Uvicorn | Async Python web server |
| WebSockets | Bidirectional real-time frame streaming |
| FastF1 | Official F1 telemetry and session results |
| Pandas + NumPy | Telemetry processing and resampling |

**Infrastructure**

| | |
|---|---|
| Vercel | Frontend hosting and global CDN |
| Render | Backend hosting (free tier, 512 MB RAM) |

**Total hosting cost: $0/month**

---

## Engineering Decisions

### 512 MB RAM on a free backend
A single race's frame data is 60–85 MB as JSON, and Python's object overhead pushes that higher once parsed. The backend uses an LRU cache with `MAX_FRAMES_CACHE = 1`: before loading any new race, the old race is explicitly deleted, `gc.collect()` is called, and the server sleeps 500 ms to let the OS reclaim pages before the new allocation begins. This makes race-switching reliable without OOM crashes.

### Single concurrent viewer
Serving multiple viewers simultaneously would require keeping multiple races in memory. Rather than attempt this on 512 MB, the server enforces `MAX_CONCURRENT_CONNECTIONS = 1` and closes additional connections with a friendly error message (WebSocket code 1008). Limitation can be removed with render pro plan. 
### Battle line pooling
Allocating and removing SVG elements every frame is expensive. Instead, 25 `<line>` elements are pre-allocated in a pool. Each frame, the nearest driver pairs are found and the pool elements are repositioned. Unused lines are moved to `(-9999, -9999)` to hide them without DOM removal.

### Circular frame buffer
The driver stats panel needs position history going back to lap 1, but storing all frames indefinitely would grow without bound. A 5,000-frame circular ring buffer (~500 seconds of history) is maintained on the client. Reads and writes use modulo arithmetic with no allocations during playback.

### Lap time validation
FastF1's raw timing data includes safety car laps, red flag stoppages, and VSC periods that would distort fastest-lap calculations. Computed lap times are only accepted in the 40–600 second window — fast enough for any normal racing lap, conservative enough to exclude anomalies without requiring event-type data from the API.

### WebSocket reconnection
The client uses exponential backoff starting at 1 s, doubling up to 10 s, then holding. On reconnect it sends a `seek` to the last known frame index so playback resumes from where it left off. Intentional closes (codes 1000, 1008, 1011) skip reconnection entirely.

---

## Local Setup

**Requirements:** Node.js 18+, Python 3.11+

```bash
# Frontend
cd frontend
npm install
npm run dev          # → http://localhost:5173

# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload   # → http://localhost:8000
```

**`frontend/.env.local`**
```
VITE_WS_URL=ws://localhost:8000
VITE_API_URL=http://localhost:8000
```

The backend reads race data from `../F1RaceViewer/computed_data/` by default. Run `python backend/precompute.py` to generate race files if they are not present.

---

## Deployment

**Frontend (Vercel)**
```bash
cd frontend && vercel --prod
```
Set `VITE_WS_URL` and `VITE_API_URL` in the Vercel project environment variables to point at your Render backend.

**Backend (Render)**

Connect the GitHub repo to a Render Web Service with these settings:

```
Root directory:  backend
Build command:   pip install -r requirements.txt
Start command:   uvicorn main:app --host 0.0.0.0 --port $PORT
Runtime:         Python 3.11
```

Render auto-deploys on every push to `main`.

---

## Future Work

- [ ] Gear, throttle, brake, and speed telemetry overlays
- [ ] Pit stop detection and visualisation
- [ ] Tyre compound tracking per stint
- [ ] DRS zone highlighting
- [ ] Sector time colouring (green / purple / yellow)
- [ ] Driver-vs-driver comparison timeline

---

## Acknowledgments

- **[FastF1](https://github.com/theOehrly/Fast-F1)** — Python library for official F1 timing, telemetry, and session data
- **[Vercel](https://vercel.com)** and **[Render](https://render.com)** — generous free tiers that make zero-cost full-stack deployment possible

---

## License

MIT — see [LICENSE](LICENSE) for details.
