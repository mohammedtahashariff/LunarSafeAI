# 🚀 Deployment Guide — Nexora (LunarSafe AI)

This document provides step-by-step instructions for deploying both the **FastAPI Backend** and the **React / Vite Frontend** across multiple deployment environments.

---

## 🐋 Method 1: Docker & Docker Compose (Recommended)

The project includes pre-configured, production-optimized Docker files:
- `Dockerfile.backend` (Python 3.12, PyTorch, OpenCV, ReportLab, FastAPI)
- `Dockerfile.frontend` (Multi-stage build: Node.js 18 ➔ Nginx)
- `docker-compose.yml` (Orchestrates backend on port 8000 and frontend on port 80/5173)

### Step-by-Step Instructions:

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/mohammedtahashariff/LunarSafeAI.git
   cd LunarSafeAI
   ```

2. **Build and Launch Containers**:
   ```bash
   docker compose up --build -d
   ```

3. **Access Your Deployed Application**:
   - **Frontend App**: `http://localhost` (or `http://your-server-ip`)
   - **Backend API Docs**: `http://localhost:8000/docs`

---

## ☁️ Method 2: Cloud Deployment (Render / Railway / Render.yaml)

### Option A: Deploy on Render.com (Easiest Cloud Setup)

#### 1. Backend Service (Web Service):
1. Create a new **Web Service** on [Render.com](https://render.com).
2. Connect your GitHub repository: `LunarSafeAI`.
3. Set Environment to **Python 3**.
4. Set Build Command:
   ```bash
   pip install -r requirements.txt && python scripts/generate_regions.py
   ```
5. Set Start Command:
   ```bash
   uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT
   ```

#### 2. Frontend Service (Static Site):
1. Create a new **Static Site** on Render.com.
2. Connect your GitHub repository.
3. Set Build Command: `npm run build`
4. Set Publish Directory: `dist`
5. Add a rewrite rule for API requests:
   - Source: `/api/*`
   - Destination: `https://your-backend-service.onrender.com/api/*`

---

## 🌐 Method 3: Vercel (Frontend) + Render/Railway (Backend)

### 1. Deploy Frontend on Vercel:
1. Import `LunarSafeAI` repository on [Vercel](https://vercel.com).
2. Set Framework Preset: **Vite**.
3. Set Root Directory: `./`
4. Add a `vercel.json` file to handle API proxying:
   ```json
   {
     "rewrites": [
       {
         "source": "/api/:path*",
         "destination": "https://your-backend-url.onrender.com/api/:path*"
       }
     ]
   }
   ```

### 2. Deploy Backend on Railway or Render:
- Follow standard Python / FastAPI start command:
  `uvicorn backend.app.main:app --host 0.0.0.0 --port 8000`

---

## 🖥️ Method 4: Production Linux VPS (Ubuntu / Nginx / Systemd)

### 1. Run Backend as a Systemd Service:
Create `/etc/systemd/system/lunarsafe-backend.service`:
```ini
[Unit]
Description=LunarSafe AI FastAPI Backend
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/var/www/LunarSafeAI
ExecStart=/var/www/LunarSafeAI/venv/bin/uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```
Enable service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now lunarsafe-backend
```

### 2. Build & Serve Frontend with Nginx:
```bash
npm run build
sudo cp -r dist/* /var/www/html/
```

---

## ⚙️ Environment Variables & Security

| Environment Variable | Default Value | Description |
| :--- | :--- | :--- |
| `PORT` | `8000` | Port for FastAPI Uvicorn backend |
| `VITE_API_BASE_URL` | `/api` | Base URL path for frontend API calls |
| `ALLOWED_HOSTS` | `*` | CORS permitted origins list |
