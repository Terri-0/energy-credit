# EnergyCredit

Peer-to-peer renewable energy trading platform powered by an energy-backed digital currency (EC).
CS Honours final project — April 2026.

---

## Overview

EnergyCredit lets solar panel owners log generated energy, convert it into EnergyCredits (EC), and trade those credits on a peer-to-peer marketplace. Buyers can use purchased energy to offset their electricity bill or re-trade it. The platform uses a fee-based mint system and a price ceiling tied to grid parity to keep the market honest.

### Economic Model

| Parameter       | Value                                                      |
| --------------- | ---------------------------------------------------------- |
| 1 EC            | 1 kWh ≈ $0.10 CAD                                          |
| Mint rate       | 0.7 EC/kWh (30% below grid parity)                         |
| Mint fee        | 6% burned to platform reserve                              |
| Listing ceiling | 1.0 EC/kWh (grid parity — buyers always save vs. the grid) |
| Signup grant    | 50 EC (~$5 CAD)                                            |
| Batch expiry    | 30 days                                                    |

The mint rate is intentionally set below the listing ceiling to incentivise selling on the marketplace rather than minting directly.

---

## Stack

| Layer    | Technology                                     |
| -------- | ---------------------------------------------- |
| Frontend | React 19 + Vite 7 + Tailwind v4 + lucide-react |
| Backend  | Go 1.25 + Gin v1.11 + GORM v1.31 + JWT v5      |
| Database | PostgreSQL 16 (Docker)                         |

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

Copy `.env.example` to `.env` and fill in your values (the defaults work for local Docker):

```bash
cp .env.example .env
```

Key variables:

```
DB_URL=postgres://ec_user:ec_pass@localhost:5432/energy_credit?sslmode=disable
JWT_SECRET=change-me-in-production
EC_MINT_RATE=0.0007       # EC per Wh minted (0.7 EC/kWh)
EC_MINT_FEE=0.06          # platform fee fraction (6%)
EC_LISTING_CEILING=0.001  # max EC/Wh on marketplace (grid parity)
GRID_PRICE=0.10           # CAD per kWh
SIM_PERIOD_SECONDS=120    # seconds for a panel to accumulate full capacity
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

## Testing

The test suite has three layers: unit tests (no server needed), integration tests (server required), and the concurrent buy stress test. All tests live in `ec-backend/tests/`.

### Unit Tests

Pure Go function tests — no server or database required. Tests the minting formula, `roundTo`, and `getEnvFloat` across edge cases.

```bash
cd ec-backend
go test ./tests/unit/... -v
```

### Integration Tests

Tests every API endpoint end-to-end against the live server. Each test registers its own isolated users with unique emails so tests are fully independent and can run in parallel.

**The server must be running on `:8080` before running these.**

```bash
# All integration tests except the concurrent buy test
go test ./tests/integration/... -v -timeout 60s -run "^Test[^C]"

# Run specific groups
go test ./tests/integration/... -v -timeout 60s -run "^TestRegister"
go test ./tests/integration/... -v -timeout 60s -run "^Test(Create|Cancel)"
```

### Concurrent Buy Stress Test

The most important test. Registers 10 buyers and fires all 10 purchase requests at the same listing simultaneously using `sync.WaitGroup`. Asserts exactly 1 succeeds (HTTP 200) and exactly 9 are rejected (HTTP 409). This proves the `SELECT FOR UPDATE` row locking prevents double-selling.

```bash
go test ./tests/integration/... -v -timeout 30s -run TestConcurrentBuy
```

Expected output:
```
Concurrent buy test: 1/10 succeeded, 9/10 correctly rejected
PASS TestConcurrentBuy_ExactlyOneSucceeds — SELECT FOR UPDATE works correctly
```

### Run Everything with the Test Script

The script runs unit tests, all integration tests, the concurrent buy test, and the market simulation in sequence.

**Requires the server to be running on `:8080`.**

```bash
cd ec-backend
bash scripts/run_tests.sh
```

---

## Market Simulation

The simulation registers 5 producers and 3 consumers, logs energy, creates marketplace listings, executes trades, applies a bill offset, and prints a formatted market report with real API numbers.

**Requires the server to be running on `:8080`.**

```bash
cd ec-backend
go run ./cmd/simulate/main.go
```

The simulation is idempotent — re-running it will log in to existing accounts rather than failing on duplicate emails. It waits `SIM_PERIOD_SECONDS + 5` seconds (default: 125s) for panels to accumulate energy before logging.

Example output:
```
╔══════════════════════════════════════════════════════╗
║         ENERGYCREDIT MARKET SIMULATION               ║
╚══════════════════════════════════════════════════════╝

PARTICIPANTS
  Producers: 5  |  Consumers: 3

EC MINTING SUMMARY
  Total Wh Logged:      11,500 Wh
  Total EC Gross:       8.050 EC
  Total Fees Burned:    0.483 EC  (6.0%)
  Total EC Minted:      7.567 EC

MARKETPLACE ACTIVITY
  Listings Created:     4
  Trades Attempted:     4
  Trades Completed:     3
  Trades Failed:        1  (insufficient balance)
  Avg Price:            0.000065 EC/Wh
  Grid Ceiling:         0.001000 EC/Wh
  Avg Discount vs Grid: 93.5%
...
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
GET    /api/economy/offsets           [protected]  ← monthly offset log
POST   /api/economy/buy-ec            [protected]
GET    /api/economy/reserve           [protected]
```

---

## Wh Batch Lifecycle

```
available → listed    (listed on marketplace)
available → minted    (converted to EC)
available → offset    (applied to bill)
listed    → available (listing cancelled)
listed    → offset    (listing purchased by buyer)
any       → expired   (30-day TTL elapsed — pure loss by design)
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
- JWT HS256 with algorithm confusion defence (rejects `alg:none` and any non-HMAC algorithm)
- User enumeration protection on login (identical error for unknown email vs. wrong password)
- All marketplace operations use `SELECT FOR UPDATE` with ascending ID ordering to prevent deadlocks
- `RowsAffected == 1` assertion on every critical write

---

## Known Limitations

- **Fiat payments are simulated** — no real payment processor; EC is credited directly
- **No token blacklist** — logout only clears the client-side token; the JWT remains valid until expiry
- **Flat generation simulation** — panels generate at a constant rate (no day/night solar curve)
- **No partial batch listings** — a batch must be listed in full
- **Frontend optimistic updates** — EC balance is updated client-side after transactions; a hard refresh always shows the authoritative database value

---

## Project Structure

```
energy-credit/
├── docker-compose.yml
├── .env.example
├── ec-backend/
│   ├── main.go
│   ├── config/           # DB connection + AutoMigrate
│   ├── middleware/       # JWT auth (algorithm confusion defence)
│   ├── models/           # GORM models (9 tables)
│   ├── handlers/         # Route handlers
│   ├── routes/           # Route registration
│   ├── cmd/
│   │   └── simulate/     # Market simulation (go run ./cmd/simulate/main.go)
│   ├── tests/
│   │   ├── unit/         # Pure function tests (no server required)
│   │   └── integration/  # End-to-end API tests + concurrent buy stress test
│   └── scripts/
│       └── run_tests.sh  # Runs all tests + simulation in sequence
└── ec-frontend/
    ├── vite.config.js
    └── src/
        ├── App.jsx           # Root component + shared state
        ├── constants.js      # EC economic constants + helpers
        ├── api/client.js     # Axios instance with auth interceptor
        ├── components/       # Sidebar, modals (Mint/Buy/Offset), shared UI
        └── pages/            # Dashboard, Marketplace, LogEnergy, MyPanels,
                              # BillOffset, BuyEC, AuthPage
```
