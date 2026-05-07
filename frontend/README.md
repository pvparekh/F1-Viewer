# F1 Race Viewer — Frontend

React + Vite + TypeScript UI for the F1 Race Viewer backend.

## Local development

### 1. Install dependencies

```bash
cd frontend
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env.local` and adjust if your backend runs on a different port:

```bash
cp .env.example .env.local
```

Default values (works out of the box with the backend started locally):

```
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```

### 3. Start the dev server

Ensure the backend is running first (`uvicorn main:app --reload` in `/backend`), then:

```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

## Building for production

```bash
npm run build
```

Output goes to `dist/`. Serve it with any static file host.

## Pointing at a deployed backend (e.g. Railway)

Set the env vars in your hosting platform or in `.env.local`:

```
VITE_API_URL=https://your-app.up.railway.app
VITE_WS_URL=wss://your-app.up.railway.app
```

`wss://` (secure WebSocket) is required for HTTPS-hosted frontends.

## Stack

| Library | Purpose |
|---------|---------|
| React 18 | UI framework |
| Vite | Build tool & dev server |
| TypeScript | Type safety |
| Tailwind CSS | Styling |
| Framer Motion | Layout animations (timing tower reorder, driver detail slide) |
| Recharts | Charts in driver detail panel |

## Architecture notes

- **TrackMap** never re-renders during playback. Driver dot positions are updated directly via `element.setAttribute('cx', ...)` inside a `requestAnimationFrame` loop, bypassing React's VDOM entirely.
- **Interpolation**: the WebSocket delivers frames at ~10 FPS. The animation loop runs at 60 FPS and linearly interpolates each driver's position between the last two received frames.
- **Circular buffer**: the last 5000 frames are kept in memory for the DriverDetail charts. At 10 FPS this covers the last ~500 seconds of race data.
- **TimingTower** reads from the same frame ref but updates React state only every 500ms to stay readable.
