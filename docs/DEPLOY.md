# LearnQuest — Deployment Guide

## Production Deployment Topology

LearnQuest can be deployed via Docker Compose or on modern cloud platforms (Render, AWS, DigitalOcean, Railway).

---

## 🐳 One-Command Docker Compose

```bash
# 1. Clone repo and copy environment file
git clone <repo-url> learnquest
cd learnquest
cp .env.example .env

# 2. Start all services
docker compose up -d --build

# 3. Seed questions and admin credentials
docker compose exec server npm run seed
```

This starts:
- `mongo` on port 27017
- `ml-service` (FastAPI) on port 8001
- `server` (Express API) on port 5000
- `client` (Nginx static) on port 3000

---

## ☁️ Manual / Cloud Service Setup

### 1. MongoDB 7.0+
- Host locally or provision a MongoDB Atlas cluster.
- Obtain connection string: `mongodb+srv://user:pass@cluster.mongodb.net/learnquest`

### 2. Python FastAPI ML Service
```bash
cd ml-service
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001 --workers 2
```

### 3. Node.js API Server
```bash
cd server
npm ci --omit=dev
npm run seed  # populates questions and admin
node src/index.js
```

### 4. React Client
```bash
cd client
npm ci
npm run build
# dist/ folder can be served via Nginx, Cloudflare Pages, or static Express serving
```

---

## 🔒 Security Best Practices
1. Generate high-entropy keys for `JWT_SECRET`, `COOKIE_SECRET`, and `CRYPTO_KEY`.
2. `CRYPTO_KEY` must be at least 32 characters (AES-256-GCM).
3. Ensure `httpOnly` and `secure: true` cookies in production HTTPS.
4. Run regular DB backups on `users`, `children`, and `payouts` collections.
