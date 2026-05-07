"""
FastAPI server for F1 Race Viewer backend.

Reads precomputed race data from ../F1RaceViewer/computed_data/.
Start with: uvicorn main:app --reload
"""

import asyncio
import json
import os
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager

import fastf1
import pandas as pd
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
COMPUTED_DATA_DIR = os.path.normpath(
    os.path.join(BACKEND_DIR, "..", "F1RaceViewer", "computed_data")
)
FASTF1_CACHE_DIR = os.path.normpath(
    os.path.join(BACKEND_DIR, "..", "F1RaceViewer", ".fastf1-cache")
)

try:
    fastf1.Cache.enable_cache(FASTF1_CACHE_DIR)
except Exception:
    pass

# Keyed by "{year}_{round}"
race_meta_cache: dict = {}
race_frames_cache: OrderedDict = OrderedDict()
race_results_cache: dict = {}
MAX_FRAMES_CACHE = 1

# Free-tier memory guard: only one race can stream at a time.
active_websocket_connections: int = 0
MAX_CONCURRENT_CONNECTIONS: int = 1

_io_executor = ThreadPoolExecutor(max_workers=2)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if os.path.isdir(COMPUTED_DATA_DIR):
        for fname in sorted(os.listdir(COMPUTED_DATA_DIR)):
            if fname.endswith("_meta.json"):
                key = fname[: -len("_meta.json")]
                meta_path = os.path.join(COMPUTED_DATA_DIR, fname)
                frames_path = os.path.join(COMPUTED_DATA_DIR, f"{key}_frames.json")
                if os.path.exists(frames_path):
                    with open(meta_path) as f:
                        race_meta_cache[key] = json.load(f)
        print(f"Loaded metadata for {len(race_meta_cache)} race(s): {list(race_meta_cache.keys())}")
    else:
        print(f"WARNING: computed_data directory not found at {COMPUTED_DATA_DIR}")
    yield


app = FastAPI(title="F1 Race Viewer API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://formulavision.vercel.app",  # Allow Vercel
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _read_frames_file(key: str):
    path = os.path.join(COMPUTED_DATA_DIR, f"{key}_frames.json")
    if not os.path.exists(path):
        return None
    with open(path) as f:
        return json.load(f)


async def _get_or_load_frames(key: str):
    if key in race_frames_cache:
        race_frames_cache.move_to_end(key)
        return race_frames_cache[key]

   # EVICT OLD RACE FIRST (before loading new one)
    if len(race_frames_cache) >= MAX_FRAMES_CACHE:
        evicted_key = next(iter(race_frames_cache))
        race_frames_cache.popitem(last=False)
        print(f"LRU evicted frames cache for {evicted_key} BEFORE loading {key}")
        import gc
        gc.collect()  # Force garbage collection
        await asyncio.sleep(0.5)  # Give GC time to free memory # Force garbage collection

    loop = asyncio.get_event_loop()
    frames = await loop.run_in_executor(_io_executor, _read_frames_file, key)

    if frames is not None:
        race_frames_cache[key] = frames
        race_frames_cache.move_to_end(key)

    return frames


@app.get("/health")
async def health():
    return {"status": "ok", "races_loaded": len(race_meta_cache)}


@app.get("/api/sessions")
async def list_sessions():
    sessions_path = os.path.join(BACKEND_DIR, "sessions.json")
    try:
        with open(sessions_path) as f:
            return json.load(f)
    except FileNotFoundError:
        return [
            {"year": meta["year"], "round": meta["round"], "name": meta["name"]}
            for meta in race_meta_cache.values()
        ]


@app.get("/api/sessions/{year}/{round}/metadata")
async def get_metadata(year: int, round: int):
    key = f"{year}_{round}"
    meta = race_meta_cache.get(key)
    if meta is None:
        raise HTTPException(status_code=404, detail=f"Race {key} not found")
    return meta


def _load_race_results_sync(year: int, round_num: int) -> list:
    key = f"{year}_{round_num}"
    if key in race_results_cache:
        return race_results_cache[key]

    session = fastf1.get_session(year, round_num, "R")
    session.load(laps=False, telemetry=False, weather=False, messages=False)

    results = session.results
    if results is None or len(results) == 0:
        return []

    rows = []
    for _, row in results.iterrows():
        pos = row.get("Position")
        try:
            pos = int(pos) if not pd.isna(pos) else None
        except (ValueError, TypeError):
            pos = None

        time_val = row.get("Time")
        time_str = None
        try:
            if not pd.isna(time_val):
                total_sec = time_val.total_seconds()
                h = int(total_sec // 3600)
                m = int((total_sec % 3600) // 60)
                s = int(total_sec % 60)
                ms = int(round((time_val.total_seconds() % 1) * 1000))
                if h > 0 or pos == 1:
                    time_str = f"{h}:{m:02d}:{s:02d}.{ms:03d}" if h > 0 else f"{m}:{s:02d}.{ms:03d}"
                else:
                    if m > 0:
                        time_str = f"+{m}:{s:02d}.{ms:03d}"
                    else:
                        time_str = f"+{s}.{ms:03d}s"
        except Exception:
            pass

        pts = row.get("Points", 0)
        try:
            pts = float(pts) if not pd.isna(pts) else 0.0
        except (ValueError, TypeError):
            pts = 0.0

        rows.append({
            "position": pos,
            "driver_number": str(row.get("DriverNumber", "")),
            "abbreviation": str(row.get("Abbreviation", "")),
            "full_name": str(row.get("FullName", "")),
            "team": str(row.get("TeamName", "")),
            "time": time_str,
            "status": str(row.get("Status", "")),
            "points": pts,
        })

    rows.sort(key=lambda r: (r["position"] is None, r["position"] or 9999))
    race_results_cache[key] = rows
    return rows


@app.get("/api/sessions/{year}/{round}/results")
async def get_race_results(year: int, round: int):
    loop = asyncio.get_event_loop()
    try:
        results = await loop.run_in_executor(_io_executor, _load_race_results_sync, year, round)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return {"year": year, "round": round, "results": results}


@app.websocket("/ws/sessions/{year}/{round}/replay")
async def websocket_replay(websocket: WebSocket, year: int, round: int):
    global active_websocket_connections
    await websocket.accept()

    # ── Capacity check — reject before touching any race data ─────────────
    if active_websocket_connections >= MAX_CONCURRENT_CONNECTIONS:
        await websocket.send_json({
            "type": "status",
            "status": "error",
            "message": "Server at capacity — only 1 viewer at a time on the free tier. Close other tabs and try again.",
        })
        await websocket.close(code=1008)
        return

    key = f"{year}_{round}"
    if key not in race_meta_cache:
        await websocket.send_json({"type": "status", "status": "error", "message": "Race not found"})
        await websocket.close(code=1008)
        return

    # ── Take a viewer slot; always release it when the connection closes ──
    active_websocket_connections += 1
    try:
        await websocket.send_json({"type": "status", "status": "loading"})

        frames = await _get_or_load_frames(key)
        if frames is None:
            await websocket.send_json({"type": "status", "status": "error", "message": "Frames file missing"})
            await websocket.close(code=1011)
            return

        await websocket.send_json({"type": "total_frames", "total_frames": len(frames)})
        await websocket.send_json({"type": "status", "status": "ready"})

        state = {"frame": 0, "speed": 1.0, "playing": False}

        async def message_handler():
            try:
                while True:
                    msg = await websocket.receive_json()
                    action = msg.get("action")
                    if action == "play":
                        state["frame"] = int(msg.get("from_frame", state["frame"]))
                        state["speed"] = float(msg.get("speed", state["speed"]))
                        state["playing"] = True
                    elif action == "pause":
                        state["playing"] = False
                    elif action == "seek":
                        state["frame"] = int(msg.get("to_frame", state["frame"]))
                    elif action == "set_speed":
                        state["speed"] = float(msg.get("speed", state["speed"]))
            except WebSocketDisconnect:
                pass
            except Exception:
                pass

        recv_task = asyncio.create_task(message_handler())

        try:
            while True:
                if recv_task.done():
                    break

                if state["playing"]:
                    idx = state["frame"]
                    if idx >= len(frames):
                        await websocket.send_json({"type": "status", "status": "ended"})
                        break

                    frame = frames[idx]
                    await websocket.send_json({
                        "type": "frame",
                        "frame_index": idx,
                        "t": frame["t"],
                        "lap": frame["lap"],
                        "drivers": frame["drivers"],
                    })
                    state["frame"] = idx + 1
                    delay = 0.1 / max(0.1, state["speed"])
                    await asyncio.sleep(delay)
                else:
                    await asyncio.sleep(0.05)
        except Exception:
            pass
        finally:
            recv_task.cancel()
            try:
                await recv_task
            except (asyncio.CancelledError, Exception):
                pass
    finally:
        active_websocket_connections -= 1
