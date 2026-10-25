# LearnQuest — AI-Powered Adaptive Learning Platform

<div align="center">

![LearnQuest](https://img.shields.io/badge/LearnQuest-v2.0-6c63ff?style=for-the-badge&logo=react)
![ML Heavy](https://img.shields.io/badge/ML-Bayesian%20KT%20%2B%20IRT-ff7aa2?style=for-the-badge)
![MERN Stack](https://img.shields.io/badge/Stack-MERN%20%2B%20FastAPI-2bb673?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-ffca3a?style=for-the-badge)

**Bridging India's learning gap — one quiz at a time 🌟**

[Live Demo](#) · [Documentation](docs/) · [Architecture](docs/ARCHITECTURE.md) · [Deploy Guide](docs/DEPLOY.md)

</div>

---

## 🎯 The Problem

ASER 2024 found only **27%** of Class 3 children could read a Class 2 text.  
Nearly **8%** of 15–16-year-olds are out of school. **10.1 million** children aged 5–14 work instead of learning.

LearnQuest addresses this with adaptive AI tutoring + micro-reward incentives for steady effort.

---

## ✨ What It Does

### 👶 For Children
- Short adaptive quizzes matched to their exact skill level
- Instant feedback with explanations in English or Hindi  
- Earn ⭐ stars → convert to ₹ rewards (parent-controlled)
- Game mechanics: XP, levels, streaks, achievements, badges
- Anti-cheat: server-timed, server-scored, one-answer-per-question

### 👨‍👩‍👧 For Guardians
- Add children with recorded consent
- Set 4-digit PIN per child
- Review progress with mastery charts and session analytics
- Approve or decline payout requests
- UPI payout destination (AES-256-GCM encrypted at rest)

### 🛡️ For Admins
- Question review queue (human gate before questions reach children)
- AI question draft generation
- Difficulty calibration from real answer data (ML-powered)
- Sponsor pool management
- Payout pipeline with risk flagging

---

## 🤖 ML Pipeline (Heavy ML Focus)

```
Answer submitted
      │
      ▼
┌─────────────────────────────────────────────────────────┐
│                    ML Service (FastAPI)                   │
│                                                           │
│  1. BKT Update ────► P(skill known) updated              │
│  2. IRT Theta ──────► Ability estimate updated           │
│  3. Anomaly Score ──► Risk flag if suspicious timing     │
│  4. Forgetting ─────► Decay P if long gap since practice │
│  5. Selector ───────► Next question at ~70% p_correct    │
│  6. Recommendations► Next skill to study                 │
│  7. Calibrate ──────► Suggest difficulty adjustments     │
└─────────────────────────────────────────────────────────┘
      │
      ▼
Node.js fallback (mirrors BKT + IRT formulas)
if ML service is down — learning NEVER stops
```

### Algorithms
| Algorithm | Purpose |
|-----------|---------|
| **Bayesian Knowledge Tracing (BKT)** | Estimate P(skill known) from answer history |
| **2-Parameter IRT (2PL)** | Item difficulty + discrimination modeling |
| **EM Parameter Fitting** | Fit BKT/IRT params from real classroom data |
| **Ebbinghaus Forgetting Curve** | Decay mastery estimate if not practiced |
| **SM-2 Spaced Repetition** | Schedule next review for each skill |
| **Rasch Item Selection** | Pick question where P(correct) ≈ 0.70 |
| **Z-score Anomaly Detection** | Flag suspiciously fast answers |
| **Skill Prerequisite DAG** | Order topics by dependency graph |
| **Learning Velocity Estimator** | Predict mastery gain rate per child |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Browser / PWA                          │
│           React + Vite + Tailwind + Framer Motion            │
│      Game UI (child) │ Dashboard (guardian) │ Admin          │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS / httpOnly cookies
┌──────────────────────▼──────────────────────────────────────┐
│               Node.js + Express API Server                   │
│  Auth · Children · Learn · Payouts · Admin · Analytics       │
│  JWT cookies · Helmet · CORS · Rate limiting · Zod           │
└──────────┬──────────────────────────┬───────────────────────┘
           │ Mongoose                  │ HTTP + API key
┌──────────▼──────────┐   ┌───────────▼────────────────────┐
│      MongoDB 7       │   │   Python FastAPI ML Service    │
│  9 collections       │   │   BKT · IRT · EM · Anomaly    │
│  TTL on attempts     │   │   Spaced Rep · Calibration    │
│  AES-encrypted UPI   │   │   Recommendations · Heatmap   │
└─────────────────────┘   └────────────────────────────────┘
```

---

## 💰 Reward System

| Event | Points |
|-------|--------|
| Correct answer | +2 + difficulty (1–5) |
| Considered wrong (effort) | +1 (max 10/day) |
| Improve skill today | +15 (once per skill per day) |
| Complete 5 questions | +10 (once per day) |
| **Daily cap** | **100 points** |
| **Conversion** | 10 points = ₹1 |
| **Minimum payout** | ₹50 (= 500 points) |

Answers under **1.5 seconds** earn nothing (anti-cheat).  
Money flows: Sponsor Pool → Guardian UPI (never to child directly).

---

## 🚀 Quick Start

### Prerequisites
- Node.js 22+
- Python 3.12+
- MongoDB 7 (local or Atlas)
- Docker (optional)

### Development Setup

```bash
# 1. Clone and setup
git clone <repo> learnquest && cd learnquest

# 2. Copy env files
cp .env.example .env
cp server/.env.example server/.env
# Fill in values!

# 3. Install dependencies
cd server && npm install
cd ../client && npm install
cd ../ml-service && pip install -r requirements.txt

# 4. Seed the database
cd ../server && npm run seed

# 5. Start all services (3 terminals)
# Terminal 1: ML service
cd ml-service && uvicorn app.main:app --reload --port 8001

# Terminal 2: API server  
cd server && npm run dev

# Terminal 3: React client
cd client && npm run dev
```

Open **http://localhost:5173**

Default admin: `admin@learnquest.org` / `Admin@LearnQuest2024!`

### Docker (One command)

```bash
cp .env.example .env
# Edit .env with your values
docker compose up --build
```

Open **http://localhost:3000**

---

## 📁 Project Structure

```
learnquest/
├── client/                    # React + Vite frontend
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── pages/             # Route pages
│   │   ├── context/           # React context (auth)
│   │   ├── hooks/             # Custom hooks
│   │   ├── utils/             # API client, i18n, helpers
│   │   └── store/             # Zustand stores
│   ├── package.json
│   └── Dockerfile
├── server/                    # Node.js + Express API
│   ├── src/
│   │   ├── lib/               # BKT, crypto, errors, time, logger
│   │   ├── middleware/        # Auth, error handlers
│   │   ├── models/            # Mongoose schemas
│   │   ├── routes/            # API routes
│   │   ├── services/          # Business logic
│   │   └── seed/              # Database seeder
│   ├── tests/                 # Jest test suites
│   ├── package.json
│   └── Dockerfile
├── ml-service/                # Python FastAPI ML microservice
│   ├── app/
│   │   ├── bkt.py             # Bayesian Knowledge Tracing + IRT
│   │   ├── irt.py             # 2PL Item Response Theory
│   │   ├── selector.py        # Adaptive question selection
│   │   ├── calibrate.py       # EM difficulty calibration
│   │   ├── anomaly.py         # Anti-cheat risk scoring
│   │   ├── spaced_repetition.py # Forgetting curve + SM-2
│   │   ├── recommendations.py # Next skill recommendations
│   │   ├── analytics.py       # Learning velocity + heatmaps
│   │   └── main.py            # FastAPI app + all endpoints
│   ├── tests/                 # pytest test suite
│   ├── requirements.txt
│   └── Dockerfile
├── docs/
│   ├── ARCHITECTURE.md        # System design deep-dive
│   ├── DEPLOY.md              # Deployment guide
│   └── STARTUP.md             # Business model & roadmap
├── .github/
│   └── workflows/ci.yml       # GitHub Actions CI pipeline
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 🧪 Testing

```bash
# Server tests (Jest + mongodb-memory-server)
cd server && npm test

# ML tests (pytest)
cd ml-service && python -m pytest tests/ -v

# Client build check
cd client && npm run build
```

---

## 🔒 Security

- **httpOnly cookies** — JS cannot read auth tokens
- **AES-256-GCM** — UPI IDs encrypted at rest
- **bcrypt (rounds=12)** — passwords and PINs
- **Zod validation** — all inputs validated server-side
- **Rate limiting** — login/register endpoints strictly limited
- **Helmet** — security headers
- **JWT JTI** — one answer per question (replay prevention)
- **Server-side timing** — browser cannot fake response time
- **GDPR-inspired** — data deletion, TTL on attempts, consent logs

---

## 📊 Database Collections

| Collection | Purpose | TTL |
|------------|---------|-----|
| users | Guardians + admins | — |
| children | Child profiles + daily stats | — |
| mastery | Per-skill BKT state | — |
| questions | Question bank | — |
| attempts | Answer records | 180 days |
| ledger | Points earn/redeem log | — |
| payouts | Payout pipeline | — |
| pool | Sponsor fund pool | — |
| consentlogs | Consent audit trail | — |
| achievements | Achievement definitions | — |
| childachievements | Earned badges | — |
| learningsessions | Session metadata | — |
| notifications | In-app alerts | 30 days |

---

## 🤝 Contributing

See [CONTRIBUTING.md](docs/CONTRIBUTING.md). Questions must be teacher-reviewed before reaching children.

## 📜 License

MIT — See [LICENSE](LICENSE).

---

<div align="center">
Built with ❤️ for India's children who deserve to learn and thrive.
</div>
