# FormulaVision — Deployment Guide

## Project Structure

```
Formula1RaceViewer/
├── backend/                  ← FastAPI server
│   ├── main.py
│   ├── sessions.json         ← Race manifest (committed to git)
│   └── requirements.txt
├── frontend/                 ← React/Vite app
│   └── src/
├── F1RaceViewer/
│   └── computed_data/        ← Race data (see below)
│       ├── 2023_8_meta.json  ← ~8KB each — committed to git ✅
│       ├── 2023_8_frames.json← ~80-140MB each — NOT in git ⚠️
│       └── ...
└── README.md
```

---

## Race Data — The Big File Problem

The 8 race frame files total **~791 MB**. They cannot go into a normal git repo
(GitHub rejects files >100 MB). The meta files (8 KB each) are committed normally.

### What's committed to git
- `F1RaceViewer/computed_data/*_meta.json` — track layout, driver colors, lap count
- `backend/sessions.json` — race list served to the frontend

### What is NOT committed (too large)
- `F1RaceViewer/computed_data/*_frames.json` — telemetry replay data

---

## Local Development

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

App runs at http://localhost:5173, API at http://localhost:8000.

---

## Deployment Options

### Option A — Railway (recommended for backend) + Vercel (frontend)

**Step 1: Backend to Railway**

Railway supports persistent volumes. The frames data must be uploaded separately
after the initial deploy (since it can't be in the git repo).

```bash
# 1. Push code to GitHub (frames excluded by .gitignore)
git push origin main

# 2. Create Railway project, link to GitHub repo
# 3. Set Railway working directory: /backend
# 4. Set start command: uvicorn main:app --host 0.0.0.0 --port $PORT
# 5. Add environment variable: PORT (Railway sets this automatically)

# 6. After deploy, upload frame files via Railway CLI:
railway run --service backend bash
# Then rsync or scp the *_frames.json files into the volume at:
# F1RaceViewer/computed_data/ (relative to project root)
```

**Important Railway env vars:**
```
CORS_ORIGINS=https://your-frontend.vercel.app
```

Update `backend/main.py` CORS to read from env:
```python
allow_origins=os.getenv("CORS_ORIGINS", "*").split(",")
```

**Step 2: Frontend to Vercel**

```bash
cd frontend
# Create .env.production:
echo "VITE_API_URL=https://your-backend.railway.app" > .env.production
echo "VITE_WS_URL=wss://your-backend.railway.app" >> .env.production
npm run build
# Deploy dist/ to Vercel, or connect GitHub repo
```

---

### Option B — Single VPS (simplest for large data)

A $6/month DigitalOcean droplet or Hetzner VPS gives you 25-40GB disk — plenty
for the 791MB of data. No git gymnastics needed.

```bash
# On the server:
git clone https://github.com/you/formula1raceviewer.git
cd Formula1RaceViewer

# Copy frame files (from your local machine):
scp F1RaceViewer/computed_data/*_frames.json user@server:~/Formula1RaceViewer/F1RaceViewer/computed_data/

# Start backend:
cd backend && pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000

# Build and serve frontend:
cd frontend && npm install && npm run build
# Serve dist/ with nginx or caddy
```

---

### Option C — Git LFS (keeps everything in one repo)

```bash
# Install Git LFS
git lfs install
git lfs track "F1RaceViewer/computed_data/*_frames.json"
git add .gitattributes
git add F1RaceViewer/computed_data/
git commit -m "Add frame data via LFS"
git push
```

⚠️ GitHub LFS free tier: 1 GB storage + 1 GB bandwidth/month.
  With 791 MB of data, you'll hit the bandwidth limit after ~1 full clone.
  Paid LFS or a data pack ($5/month) recommended.

---

## Environment Variables

### Backend `.env`
```
# Optional — only needed if you want to restrict CORS in production
CORS_ORIGINS=https://your-frontend.vercel.app
```

### Frontend `.env.production`
```
VITE_API_URL=https://your-backend-url.com
VITE_WS_URL=wss://your-backend-url.com
```

---

## Checklist Before Deploying

- [ ] `backend/requirements.txt` includes `fastf1`, `pandas`, `numpy`
- [ ] `backend/sessions.json` lists all 8 races correctly
- [ ] All 8 `*_meta.json` files present in `computed_data/`
- [ ] `.gitignore` excludes `*_frames.json` and `.fastf1-cache/`
- [ ] Frontend `VITE_API_URL` and `VITE_WS_URL` point to production backend
- [ ] Backend CORS allows frontend origin
- [ ] Frame files uploaded to server (via LFS, scp, or Railway volume)

---

## Data Inventory

| Race | Meta | Frames | Size |
|------|------|--------|------|
| 2023 Monaco GP (R8) | ✅ | ✅ | ~97 MB |
| 2023 British GP (R10) | ✅ | ✅ | ~88 MB |
| 2023 Singapore GP (R15) | ✅ | ✅ | ~107 MB |
| 2024 Bahrain GP (R1) | ✅ | ✅ | ~95 MB |
| 2024 Monaco GP (R8) | ✅ | ✅ | ~141 MB |
| 2024 British GP (R12) | ✅ | ✅ | ~82 MB |
| 2024 Italian GP (R16) | ✅ | ✅ | ~78 MB |
| 2025 Bahrain GP (R1) | ✅ | ✅ | ~103 MB |
| **Total** | 64 KB | **791 MB** | **~791 MB** |
