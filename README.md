# 🏎️ Formula Vision

**Netflix-style F1 race replay platform with real-time telemetry visualization**

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React_18-61DAFB?style=flat&logo=react&logoColor=black)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white)
![Live Demo](https://img.shields.io/badge/Live_Demo-Online-brightgreen?style=flat)

**[Live Demo](https://formulavision.vercel.app)** 
---

## 🎬 Demo

**[→ Try it live at formulavision.vercel.app](https://formulavision.vercel.app)**

> **Note:** First load may take 30–60s (free-tier cold start) — worth the wait!

<!-- Screenshots coming soon -->
<!-- ![Formula Vision Screenshot](docs/screenshot.png) -->

---

## ✨ Features

### Race Replay
- **60 FPS interpolated animation** from 12.5 FPS server data via client-side `requestAnimationFrame`
- **5 historic F1 races** across Monaco, Silverstone, Monza, and Bahrain (2023–2024 seasons)
- **WebSocket streaming architecture** — server pushes frames as fast as your chosen playback speed

### Interactive Controls
- **Camera follow system** with 2.5× zoom that tracks any driver around the circuit
- **Netflix-style playback bar** — play/pause, ±10s skip, 0.5×–4× speed control
- **Seek anywhere** in the race timeline with a scrubber
- **Keyboard shortcuts** — `Space` play/pause · `←/→` seek · `1–4` speed · `F` fullscreen · `?` help

### Data Visualization
- **Live timing tower ("The Grid")** with animated real-time position updates
- **Position change tracking** — green ↑ / red ↓ arrows vs. starting grid
- **Fastest lap detection** — race-level best lap shown with a purple flash on new records
- **Driver detail panel** — team-colored driver number (Orbitron font), fastest lap, position history charts, laps led
- **Verified race results** fetched live from the FastF1 API with official finishing times and points

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 18 + TypeScript | UI framework and type safety |
| Vite | Build tool and dev server |
| Tailwind CSS | Utility-first styling |
| Framer Motion | Animated transitions and timing tower layout |
| Recharts | Driver position and lap time charts |
| SVG rendering engine | Custom-built track map with rAF animation loop |
| WebSocket client | Real-time frame streaming from backend |

### Backend
| Technology | Purpose |
|---|---|
| FastAPI + Uvicorn | Async Python web server |
| WebSockets | Bidirectional real-time communication |
| FastF1 | Official F1 telemetry and results data |
| Pandas | Telemetry processing and coordinate mapping |
| ThreadPoolExecutor | Non-blocking file I/O alongside async handlers |

### Infrastructure
| Service | Role |
|---|---|
| Vercel | Frontend hosting, global CDN, auto-deploy |
| Render | Backend hosting (free tier, 512MB RAM) |
| GitHub | Source control, CI/CD triggers |

**Total hosting cost: $0/month**

---

## 🏗️ Architecture

```
FastF1 API
    │
    ▼
Python ETL Pipeline
(GPS → SVG coordinates, 12.5 FPS frame sampling)
    │
    ▼
440 MB JSON Dataset
(stored on Render filesystem)
    │
    ▼ WebSocket
FastAPI Server                     React Client
(streams frames at                 (interpolates to 60 FPS
 chosen playback speed)  ───────►   via requestAnimationFrame)
                                        │
                                        ▼
                                   SVG Track Map
                                   (dynamic viewBox for
                                    camera follow + zoom)
```

**Data flow in detail:**
1. **ETL** — FastF1 fetches official timing/GPS data; a Python pipeline resamples to 12.5 FPS and serialises to compact JSON
2. **Streaming** — On WebSocket connect, FastAPI loads the race into a LRU cache and pushes frames at the client's requested speed
3. **Interpolation** — The React client holds the last-received frame and smoothly interpolates driver positions at the display's native refresh rate (60+ FPS)
4. **Camera** — SVG `viewBox` is recalculated every frame to center and zoom on the followed driver
5. **Memory** — Only one race is ever held in RAM at a time; eviction happens before loading, followed by `gc.collect()` to free memory immediately

---

## ⚡ Performance Optimizations

| Problem | Solution | Impact |
|---|---|---|
| 512 MB RAM limit on free tier | `MAX_FRAMES_CACHE = 1` with pre-load eviction + `gc.collect()` | Prevents OOM crashes |
| Race files up to 95 MB | 30% frame truncation with strategic sampling (head/tail intact, middle thinned) | 95 MB → 66 MB per race |
| Server streams at 12.5 FPS | Client-side rAF interpolation loop | Silky 60 FPS playback |
| Multiple tabs crash the server | Single active WebSocket connection limit; friendly rejection message | Zero crash incidents |
| 30–60s cold start | Accepted on free tier; shown as loading indicator to user | Good UX with honest expectation-setting |

---

## 🔬 Technical Highlights

- **Real-time bidirectional WebSocket** — `play`, `pause`, `seek`, and `set_speed` actions flow back to the server; frame data streams to the client
- **Dynamic SVG `viewBox`** — Camera follow computes a live bounding box around the target driver and applies it each animation frame without re-rendering the DOM
- **Circular frame buffer** — A 5,000-frame ring buffer on the client enables the driver detail panel to chart position history without unbounded memory growth
- **Coordinate transformation** — Raw GPS latitude/longitude mapped to normalised SVG space via min/max scaling; inner/outer track boundaries derived from left/right-seat telemetry
- **Auto-reconnect with exponential backoff** — WebSocket client retries on unexpected disconnect (1 s → 2 s → 4 s … up to 10 s), skipping intentional closes (code 1000/1008/1011)
- **CORS-secured cross-origin** — Allowlist restricted to `localhost:5173` and the production Vercel domain

---

## 🚀 Local Setup

### Prerequisites
- Node.js 18+
- Python 3.11+

### Frontend
```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
# → http://localhost:8000
```

### Environment Variables

**`frontend/.env.local`**
```
VITE_WS_URL=ws://localhost:8000
VITE_API_URL=http://localhost:8000
```

**Backend** reads race data from `../F1RaceViewer/computed_data/` by default (configurable via `COMPUTED_DATA_DIR` in `main.py`).

---

## 🌐 Deployment

### Frontend (Vercel)
```bash
cd frontend
vercel --prod
```
Set `VITE_WS_URL` and `VITE_API_URL` in the Vercel project's environment variables.

### Backend (Render)
Connect the GitHub repo to a Render Web Service. Render auto-deploys on every push to `main`.

**Start command:**
```
uvicorn main:app --host 0.0.0.0 --port $PORT
```

### Free-tier constraints
- 512 MB RAM → single-race LRU cache
- 1 concurrent WebSocket viewer (second tab gets a friendly error)
- 30–60s cold start after inactivity

**Upgrade path:** Render Starter ($7/month) removes the cold start; bumping `MAX_FRAMES_CACHE` and `MAX_CONCURRENT_CONNECTIONS` enables multi-user without code changes.

---

## 🧩 Challenges & Solutions

### 1. 512 MB Memory Limit
Free-tier Render instances have a hard 512 MB cap. A single race's frame data can exceed 80 MB when parsed into Python objects. Solution: evict the current race *before* loading the next one, immediately call `gc.collect()`, and sleep 500 ms to let the OS reclaim pages before allocation.

### 2. 60 FPS from 12.5 FPS Server Data
Streaming full 60 FPS from the server would require ~5× the bandwidth and hit the RAM limit immediately. Instead, the server streams at 12.5 FPS and the client interpolates linearly between the last two received frames on every `requestAnimationFrame` tick — giving smooth motion at any display refresh rate.

### 3. Camera Follow
SVG `viewBox` is re-computed every animation frame to keep the target driver centred with a 2.5× zoom. The challenge was preventing the CSS pulse animation on the follow ring from overriding SVG `setAttribute('opacity', 0)` — CSS animations win over presentation attributes. Fix: move the ring elements off-screen (`cx/cy = -9999`) instead of toggling opacity.

### 4. GitHub 100 MB File Limit
Original race files exceeded GitHub's limit. A Python truncation script (`backend/truncate_race.py`) keeps the first and last 20% of frames intact (preserving race start and finish) while keeping every other frame in the middle — a ~30% reduction without visually degrading the replay.

---

## 🔭 Future Enhancements

- [ ] Gear, throttle, brake, and speed telemetry overlays
- [ ] Pit stop detection and lane visualisation
- [ ] Driver-vs-driver battle mode (split timeline)
- [ ] DRS zone highlighting on the track map
- [ ] Sector time analysis and mini-sector colouring
- [ ] Tyre compound tracking per stint

---

## 🤝 Contributing

Pull requests are welcome. For significant changes please open an issue first to discuss the approach.

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/your-idea`)
3. Commit your changes
4. Push and open a PR

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- **[FastF1](https://github.com/theOehrly/Fast-F1)** — Python library providing access to official F1 timing, telemetry, and session data
- **[Vercel](https://vercel.com)** & **[Render](https://render.com)** — Generous free tiers that make zero-cost full-stack deployment possible
- The F1 community whose enthusiasm for data makes projects like this worth building
  
 
 