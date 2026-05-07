# FormulaVision — Free Deployment Guide (Render + Vercel)

## Overview

| Service | Platform | Cost |
|---------|----------|------|
| Backend (FastAPI + WebSocket) | Render (free tier) | $0 |
| Frontend (React/Vite) | Vercel (free tier) | $0 |

---

## Prerequisites

- GitHub account with this repo pushed
- Render account at https://render.com
- Vercel account at https://vercel.com

---

## Step 1 — Push to GitHub

```bash
git add .
git commit -m "Prepare for deployment"
git push origin main
```

> The 5 frame files (~440 MB total) are now tracked by git.
> GitHub allows files up to 100 MB per file. All 5 frames are under 100 MB.

---

## Step 2 — Deploy Backend to Render

1. Go to https://render.com → **New** → **Web Service**
2. Connect your GitHub repo
3. Configure:
   - **Name**: `formula-vision-backend`
   - **Root Directory**: `backend`
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type**: Free

4. Add environment variable:
   - Key: `CORS_ORIGINS`
   - Value: `https://your-app.vercel.app` ← fill in after Step 3

5. Click **Create Web Service**

Render will assign a URL like `https://formula-vision-backend.onrender.com`.

---

## Step 3 — Deploy Frontend to Vercel

1. Go to https://vercel.com → **Add New Project**
2. Import your GitHub repo
3. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
4. Add environment variables:
   - `VITE_API_URL` = `https://formula-vision-backend.onrender.com`
   - `VITE_WS_URL` = `wss://formula-vision-backend.onrender.com`
5. Click **Deploy**

---

## Step 4 — Wire Up CORS

1. Back in Render, update `CORS_ORIGINS` to your Vercel URL:
   ```
   https://your-app.vercel.app
   ```
2. Render auto-redeploys on env var changes.

---

## WebSocket on Render Free Tier

Render's free tier **does support WebSockets**. The replay uses `wss://` — this works out of the box.

> Note: Free tier instances spin down after 15 minutes of inactivity. The first request after sleep takes ~30 seconds to wake up.

---

## Data Size

| Race | Size |
|------|------|
| 2023 Monaco GP (R8) | ~97 MB |
| 2023 British GP (R10) | ~88 MB |
| 2024 Bahrain GP (R1) | ~95 MB |
| 2024 British GP (R12) | ~82 MB |
| 2024 Italian GP (R16) | ~78 MB |
| **Total** | **~440 MB** |

All files are under GitHub's 100 MB per-file limit and are committed directly to the repo. No LFS required.

---

## Checklist

- [ ] All 5 `*_frames.json` files committed to git (not in .gitignore)
- [ ] All 5 `*_meta.json` files committed to git
- [ ] `backend/sessions.json` has exactly 5 races
- [ ] Render: `CORS_ORIGINS` set to Vercel URL
- [ ] Vercel: `VITE_API_URL` and `VITE_WS_URL` set to Render URL
