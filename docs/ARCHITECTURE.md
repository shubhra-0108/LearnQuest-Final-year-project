# LearnQuest — System Architecture

## Overview
LearnQuest is an AI-powered adaptive learning platform designed for children from low-income families. The platform combines:
1. **Bayesian Knowledge Tracing (BKT)** & **2PL Item Response Theory (IRT)** for adaptive question selection (targeting a 70% success probability).
2. **Effort-Weighted Micro-Incentives** converting learning progress into small financial rewards (10 points = ₹1, min payout ₹50).
3. **Strict Guardian Oversight & Safety Gates** (PIN lock, parental approval of payouts, AES-encrypted UPI handles).
4. **Anti-Cheat Anomaly Engine** analyzing response times, Z-scores, and accuracy spikes.

---

## 🏛️ High-Level Topology

```
┌────────────────────────────────────────────────────────┐
│             Web Client (React + Vite + Tailwind)       │
│    Star Map · Adaptive Quiz · Parent Portal · Admin    │
└───────────────────────────┬────────────────────────────┘
                            │ HTTPS / Cookie Auth
┌───────────────────────────▼────────────────────────────┐
│               Node.js + Express API Gateway            │
│  - JWT cookie auth (httpOnly, strict rate limiting)    │
│  - Optimistic locking for day counters (anti-overcap)  │
│  - JTI single-use question tokens                      │
│  - Fallback local BKT & IRT formulas                   │
└──────────────┬───────────────────────────┬─────────────┘
               │                           │
┌──────────────▼─────────────┐   ┌─────────▼─────────────┐
│       MongoDB 7.0           │   │  Python FastAPI ML    │
│  - Users & Children        │   │  - BKT Update Engine  │
│  - Mastery & Attempts (TTL)│   │  - 2PL IRT Selector   │
│  - Payouts & Sponsor Pool  │   │  - EM Calibration     │
│  - Achievements & Sessions │   │  - Anti-Cheat Z-Score │
└────────────────────────────┘   └───────────────────────┘
```

---

## 🔬 AI / Machine Learning Engine

### 1. Bayesian Knowledge Tracing (BKT)
Tracks latent skill knowledge $P(L_t)$ over a sequence of student answers:

$$P(L_t | \text{obs}) = \begin{cases}
\frac{P(L_{t-1})(1 - P(S))}{P(L_{t-1})(1 - P(S)) + (1 - P(L_{t-1}))P(G)} & \text{if correct} \\
\frac{P(L_{t-1})P(S)}{P(L_{t-1})P(S) + (1 - P(L_{t-1}))(1 - P(G))} & \text{if incorrect}
\end{cases}$$

Next state incorporates transition learning probability:
$$P(L_t) = P(L_t | \text{obs}) + (1 - P(L_t | \text{obs})) \cdot P(T)$$

- **Default Parameters**:
  - $P(L_0) = 0.30$ (Initial knowledge prior)
  - $P(T) = 0.15$ (Learning transition rate)
  - $P(S) = 0.10$ (Slip rate)
  - $P(G) = 0.20$ (Guess rate)

### 2. 2-Parameter Logistic IRT (Item Response Theory)
Predicts student probability of correct answer given mastery $\theta = \text{logit}(P(L_t))$ and item difficulty $b$:

$$P(\text{correct} | \theta, b, a) = c + (1 - c - s) \cdot \frac{1}{1 + e^{-1.7 a (\theta - b)}}$$

The selector picks items where $P(\text{correct}) \approx 0.70$, maintaining optimal challenge and engagement.

### 3. Ebbinghaus Forgetting Curve
Applies temporal decay if days have elapsed since last skill practice:
$$R = e^{-\lambda \cdot t}$$
$$P_{\text{decayed}} = P_{\text{init}} + (P(L) - P_{\text{init}}) \cdot R$$

### 4. Anti-Cheat Anomaly Detection
- Server-side duration measurement (answers under 1.5s yield 0 points).
- Rolling Z-score detection on answer response times against child's baseline.
- Anomaly risk scores accumulated into `child.risk`; score > 3.0 sends payout to Admin review.

---

## 💰 Economic Mechanics

| Event | Points Granted | Constraints |
| :--- | :--- | :--- |
| **Correct Answer** | $2 + \text{difficulty}$ (3 to 7) | Requires $ms \ge 1500$ |
| **Effort Answer** | $+1$ point | Max 10 effort points/day |
| **Streak Milestone** | $+10$ points | 5 answers with $\ge 3$ correct |
| **Mastery Delta** | $+15$ points | $\Delta P \ge 0.05$ (once/skill/day) |
| **Daily Limit** | **100 points** ($\approx$ ₹10) | Hard cap |
| **Min Redemption** | **500 points** ($\approx$ ₹50) | Guardian approval required |
