# EnergyCredit

Peer-to-peer renewable energy trading platform powered by an energy-backed digital currency (EC).
CS Honours final project — April 2026.

---

## Overview

EnergyCredit lets solar panel owners log generated energy, convert it into EnergyCredits (EC), and trade those credits on a peer-to-peer marketplace. Buyers can use purchased energy to offset their electricity bill or re-trade it. The platform uses a fee-based mint system and a price ceiling tied to grid parity to keep the market honest.

### Economic Model

| Parameter | Value |
|-----------|-------|
| 1 EC | 1 kWh ≈ $0.10 CAD |
| Mint rate | 0.7 EC/kWh (30% below grid parity) |
| Mint fee | 6% burned to platform reserve |
| Listing ceiling | 1.0 EC/kWh (grid parity — buyers always save vs. the grid) |
| Signup grant | 50 EC (~$5 CAD) |
| Batch expiry | 30 days |

The mint rate is intentionally set below the listing ceiling to incentivise selling on the marketplace rather than minting directly.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite 7 + Tailwind v4 + lucide-react |
| Backend | Go 1.24 + Gin v1.11 + GORM v1.31 + JWT v5 |
| Database | PostgreSQL 16 (Docker) |

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (running)
- [Go 1.25+](https://go.dev/dl/)
- [Node.js 20+](https://nodejs.org/)

---

## Setup & Running

### 1. Clone the repository

```bash
git clone <repo-url>
cd energy-credit
```

The backend loads `.env` from the project root automatically. A `.env` is already included in the repository with sensible defaults — no changes needed to run locally.

Key variables in `.env`:
```
DB_URL                 # PostgreSQL connection string
JWT_SECRET             # signing secret for auth tokens
EC_MINT_RATE=0.0007    # EC per Wh minted (0.7 EC/kWh)
EC_MINT_FEE=0.06       # platform fee fraction (6%)
EC_LISTING_CEILING=0.001  # max EC/Wh on marketplace (grid parity)
GRID_PRICE=0.10        # CAD per kWh
SIM_PERIOD_SECONDS=120 # seconds for a panel to accumulate full capacity
```

### 2. Start the database

```bash
docker-compose up -d
```

### 3. Start the backend

```bash
cd ec-backend
go run main.go
```

The backend starts on **http://localhost:8080** and auto-migrates the database schema on first run.

### 4. Start the frontend

```bash
cd ec-frontend
npm install
npm run dev
```

The frontend starts on **http://localhost:5173**. Vite proxies all `/api` requests to the backend.

---

## Simulation Speed

Panels accumulate energy over `SIM_PERIOD_SECONDS` (default: 120 seconds). A panel fills from 0 to full capacity in 2 minutes for demo purposes. To use realistic 24-hour accumulation:

```
SIM_PERIOD_SECONDS=86400
```

---

## API Routes

All protected routes require `Authorization: Bearer <token>`.

```
POST   /api/auth/register
POST   /api/auth/login

GET    /api/panels                    [protected]
POST   /api/panels/register           [protected]

POST   /api/energy/log                [protected]
GET    /api/energy/batches            [protected]
POST   /api/energy/batches/:id/mint   [protected]

POST   /api/listings                  [protected]
GET    /api/listings                  [protected]
POST   /api/listings/:id/buy          [protected]
DELETE /api/listings/:id              [protected]

POST   /api/economy/offset            [protected]
POST   /api/economy/buy-ec            [protected]
GET    /api/economy/reserve           [protected]
```

---

## Wh Batch Lifecycle

```
available → listed   (listed on marketplace)
available → minted   (converted to EC)
available → offset   (applied to bill)
listed    → available (listing cancelled)
listed    → offset   (listing purchased by buyer)
any       → expired  (30-day TTL elapsed)
```

---

## Database Schema

```
users             id, name, email, password_hash, ec_balance, has_panels, created_at
panels            id, user_id, name, capacity_wh, is_active, registered_at, last_logged_at
energy_logs       id, user_id, panel_id, wh_amount, ec_minted, fee_burned, created_at
wh_batches        id, user_id, energy_log_id, wh_remaining, status, warning_level, created_at, expires_at
listings          id, seller_id, batch_id, wh_amount, ec_price, status, created_at, expires_at
transactions      id, buyer_id, seller_id, listing_id, wh_amount, ec_amount, created_at
ec_purchases      id, user_id, ec_amount, fiat_amount, rate_used, created_at
platform_reserve  id, ec_available, total_ec_issued, total_ec_burned, updated_at
bill_offsets      id, user_id, batch_id, wh_amount, ec_equivalent, created_at
```

---

## Security

- Passwords hashed with bcrypt
- JWT HS256 with algorithm confusion defence (rejects non-HMAC tokens)
- User enumeration protection on login (identical error for unknown email vs. wrong password)
- All marketplace operations use `SELECT FOR UPDATE` row locking with ascending ID ordering to prevent deadlocks
- `RowsAffected == 1` guards on all critical writes

---

## Known Limitations

- **Fiat payments are simulated** — no real payment processor; EC is credited directly
- **No token blacklist** — logout only clears the client-side token; the JWT remains valid until expiry
- **Flat generation simulation** — panels generate at a constant rate (no day/night solar curve)
- **Frontend single-user optimistic updates** — EC balance is updated client-side after transactions; a hard refresh will always show the authoritative value from the database

---

## Project Structure

```
energy-credit/
├── docker-compose.yml
├── ec-backend/
│   ├── main.go
│   ├── config/        # DB connection
│   ├── middleware/    # JWT auth
│   ├── models/        # GORM models (9 tables)
│   ├── handlers/      # Route handlers
│   └── routes/        # Route registration
└── ec-frontend/
    ├── vite.config.js
    └── src/
        ├── App.jsx           # Root component
        ├── constants.js      # EC economic constants + helpers
        ├── api/client.js     # Axios instance with auth interceptor
        ├── components/       # Shared UI components, Sidebar, MintModal
        └── pages/            # One file per page
```
