// Market simulation for EnergyCredit.
// Run from ec-backend/: go run ./cmd/simulate/main.go
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
)

const (
	baseURL      = "http://localhost:8080"
	simPassword  = "SimPass123!"
	mintRate     = 0.0007
	mintFeeRate  = 0.06
	gridPrice    = 0.10 // CAD per kWh
)

// ─── HTTP helpers ────────────────────────────────────────────────────────────

func apiPost(path, token string, body any) (int, map[string]any) {
	return apiRequest("POST", path, token, body)
}

func apiGet(path, token string) (int, map[string]any) {
	return apiRequest("GET", path, token, nil)
}

func apiRequest(method, path, token string, body any) (int, map[string]any) {
	var bodyReader io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		bodyReader = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, baseURL+path, bodyReader)
	if err != nil {
		fmt.Printf("  [HTTP ERROR] %s %s: %v\n", method, path, err)
		return 0, nil
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		fmt.Printf("  [HTTP ERROR] %s %s: %v\n", method, path, err)
		return 0, nil
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	var parsed map[string]any
	_ = json.Unmarshal(raw, &parsed)
	return resp.StatusCode, parsed
}

// ─── auth helpers ─────────────────────────────────────────────────────────────

// registerOrLogin tries to register; if the email already exists, logs in instead.
func registerOrLogin(name, email, password string) (string, float64) {
	status, body := apiPost("/api/auth/register", "", map[string]any{
		"name": name, "email": email, "password": password,
	})
	if status == http.StatusCreated {
		token, _ := body["token"].(string)
		user, _ := body["user"].(map[string]any)
		balance, _ := user["ec_balance"].(float64)
		return token, balance
	}
	// Duplicate — try login.
	status, body = apiPost("/api/auth/login", "", map[string]any{
		"email": email, "password": password,
	})
	if status == http.StatusOK {
		token, _ := body["token"].(string)
		user, _ := body["user"].(map[string]any)
		balance, _ := user["ec_balance"].(float64)
		return token, balance
	}
	fmt.Printf("  [WARN] could not register or login %s\n", email)
	return "", 0
}

// ─── math helpers ─────────────────────────────────────────────────────────────

func roundTo(v float64, d int) float64 {
	m := math.Pow(10, float64(d))
	return math.Round(v*m) / m
}

func mintCalc(wh float64) (gross, fee, net float64) {
	gross = roundTo(wh*mintRate, 6)
	fee = roundTo(gross*mintFeeRate, 6)
	net = roundTo(gross-fee, 6)
	return
}

// ─── simulation data ──────────────────────────────────────────────────────────

type participant struct {
	name         string
	email        string
	token        string
	startBalance float64
	endBalance   float64
}

func main() {
	// Load .env from project root (one level above ec-backend).
	_ = godotenv.Overload("../.env")

	simPeriodSec := 120
	if raw := os.Getenv("SIM_PERIOD_SECONDS"); raw != "" {
		if v, err := strconv.Atoi(raw); err == nil && v > 0 {
			simPeriodSec = v
		}
	}

	fmt.Println()
	fmt.Println("╔══════════════════════════════════════════════════════╗")
	fmt.Println("║         ENERGYCREDIT MARKET SIMULATION               ║")
	fmt.Println("╚══════════════════════════════════════════════════════╝")
	fmt.Println()

	// ── 1. Register participants ──────────────────────────────────────────────
	fmt.Println("▶ Registering participants...")

	producerData := []struct {
		name    string
		whLog   float64
		ecPrice float64
	}{
		{"Producer 1", 500, 0.00005},
		{"Producer 2", 1000, 0.00006},
		{"Producer 3", 2000, 0.00007},
		{"Producer 4", 3000, 0.00008},
		{"Producer 5", 5000, 0.00009},
	}

	producers := make([]participant, len(producerData))
	for i, p := range producerData {
		email := fmt.Sprintf("producer%d@sim.test", i+1)
		token, balance := registerOrLogin(p.name, email, simPassword)
		producers[i] = participant{name: p.name, email: email, token: token, startBalance: balance}
		fmt.Printf("  ✓ %s registered (%.2f EC)\n", p.name, balance)
	}

	consumerData := []string{"Consumer 1", "Consumer 2", "Consumer 3"}
	consumers := make([]participant, len(consumerData))
	for i, name := range consumerData {
		email := fmt.Sprintf("consumer%d@sim.test", i+1)
		token, balance := registerOrLogin(name, email, simPassword)
		consumers[i] = participant{name: name, email: email, token: token, startBalance: balance}
		fmt.Printf("  ✓ %s registered (%.2f EC)\n", name, balance)
	}

	// ── 2. Register solar panels ─────────────────────────────────────────────
	fmt.Println("\n▶ Registering solar panels (5000 Wh capacity each)...")
	panelIDs := make([]float64, len(producers))
	for i, p := range producers {
		if p.token == "" {
			fmt.Printf("  [SKIP] %s — no token\n", p.name)
			continue
		}
		status, body := apiPost("/api/panels/register", p.token, map[string]any{
			"name":        fmt.Sprintf("%s Solar Panel", p.name),
			"capacity_wh": 5000.0,
		})
		if status == http.StatusCreated {
			panel, _ := body["panel"].(map[string]any)
			panelIDs[i], _ = panel["id"].(float64)
			fmt.Printf("  ✓ %s — panel id=%.0f\n", p.name, panelIDs[i])
		} else {
			// Panel may already exist from a prior sim run — fetch from GET /api/panels.
			_, panelBody := apiGet("/api/panels", p.token)
			if panels, ok := panelBody["panels"].([]any); ok && len(panels) > 0 {
				firstPanel, _ := panels[0].(map[string]any)
				panelIDs[i], _ = firstPanel["id"].(float64)
				fmt.Printf("  ✓ %s — reusing existing panel id=%.0f\n", p.name, panelIDs[i])
			} else {
				fmt.Printf("  [WARN] %s — could not register or find panel\n", p.name)
			}
		}
	}

	// ── 3. Wait for energy accumulation ─────────────────────────────────────
	waitSec := simPeriodSec + 5
	fmt.Printf("\n▶ Waiting %ds for panels to accumulate energy (SIM_PERIOD_SECONDS=%d)...\n",
		waitSec, simPeriodSec)
	for remaining := waitSec; remaining > 0; remaining -= 10 {
		sleep := 10
		if remaining < 10 {
			sleep = remaining
		}
		time.Sleep(time.Duration(sleep) * time.Second)
		fmt.Printf("  %ds remaining...\n", remaining-sleep)
	}

	// ── 4. Log energy ─────────────────────────────────────────────────────────
	fmt.Println("\n▶ Logging energy...")
	batchIDs := make([]float64, len(producers))
	var totalWhLogged, totalGross, totalFee, totalNet float64

	for i, p := range producers {
		if p.token == "" || panelIDs[i] == 0 {
			fmt.Printf("  [SKIP] %s — no token or panel\n", p.name)
			continue
		}
		wh := producerData[i].whLog
		status, body := apiPost("/api/energy/log", p.token, map[string]any{
			"panel_id":  panelIDs[i],
			"wh_amount": wh,
		})
		if status == http.StatusCreated {
			batch, _ := body["batch"].(map[string]any)
			batchIDs[i], _ = batch["id"].(float64)
			g, f, n := mintCalc(wh)
			totalWhLogged += wh
			totalGross += g
			totalFee += f
			totalNet += n
			fmt.Printf("  ✓ %s logged %.0f Wh (batch id=%.0f)\n", p.name, wh, batchIDs[i])
		} else {
			fmt.Printf("  [WARN] %s energy log failed: %v (status=%d)\n", p.name, body, status)
		}
	}

	// ── 5. Create listings (Producers 1-4; Producer 5 will offset directly) ──
	fmt.Println("\n▶ Creating marketplace listings (Producers 1–4)...")
	listingIDs := make([]float64, len(producers))
	listingsCreated := 0

	for i, p := range producers {
		if i == 4 {
			fmt.Printf("  [SKIP] %s — will offset batch directly instead of listing\n", p.name)
			continue
		}
		if p.token == "" || batchIDs[i] == 0 {
			fmt.Printf("  [SKIP] %s — no batch\n", p.name)
			continue
		}
		wh := producerData[i].whLog
		price := producerData[i].ecPrice
		status, body := apiPost("/api/listings", p.token, map[string]any{
			"batch_id":  batchIDs[i],
			"wh_amount": wh,
			"ec_price":  price,
		})
		if status == http.StatusCreated {
			listing, _ := body["listing"].(map[string]any)
			listingIDs[i], _ = listing["id"].(float64)
			listingsCreated++
			fmt.Printf("  ✓ %s listed %.0f Wh @ %.5f EC/Wh (listing id=%.0f)\n",
				p.name, wh, price, listingIDs[i])
		} else {
			fmt.Printf("  [WARN] %s listing failed: %v (status=%d)\n", p.name, body, status)
		}
	}

	// ── 6 & 7. Consumer trades ────────────────────────────────────────────────
	fmt.Println("\n▶ Consumers buying listings...")
	tradesAttempted := 0
	tradesCompleted := 0
	tradesFailed := 0
	var priceSum float64
	priceCount := 0

	buyListing := func(buyer *participant, producerIdx int) bool {
		lid := listingIDs[producerIdx]
		if lid == 0 {
			fmt.Printf("  [SKIP] no listing for producer %d\n", producerIdx+1)
			return false
		}
		tradesAttempted++
		wh := producerData[producerIdx].whLog
		price := producerData[producerIdx].ecPrice
		ecCost := roundTo(wh*price, 6)

		status, body := apiPost(fmt.Sprintf("/api/listings/%.0f/buy", lid), buyer.token, nil)
		if status == http.StatusOK {
			tradesCompleted++
			priceSum += price
			priceCount++
			fmt.Printf("  ✓ %s bought from %s for %.6f EC\n",
				buyer.name, producerData[producerIdx].name, ecCost)
			return true
		}
		tradesFailed++
		errMsg, _ := body["error"].(string)
		fmt.Printf("  ✗ %s failed to buy from %s: %s (status=%d)\n",
			buyer.name, producerData[producerIdx].name, errMsg, status)
		return false
	}

	// Consumer 1 buys Producer 1 and Producer 2.
	buyListing(&consumers[0], 0)
	buyListing(&consumers[0], 1)

	// Consumer 2 buys Producer 3.
	buyListing(&consumers[1], 2)

	// Consumer 3 attempts to buy Producer 4.
	buyListing(&consumers[2], 3)

	// ── 8. Producer 5 offsets own batch ──────────────────────────────────────
	fmt.Println("\n▶ Producer 5 offsetting own batch...")
	offsetsCompleted := 0
	var p5OffsetWh float64
	if producers[4].token != "" && batchIDs[4] != 0 {
		status, body := apiPost("/api/economy/offset", producers[4].token, map[string]any{
			"batch_id": batchIDs[4],
		})
		if status == http.StatusCreated {
			offset, _ := body["offset"].(map[string]any)
			p5OffsetWh, _ = offset["wh_amount"].(float64)
			offsetsCompleted++
			fmt.Printf("  ✓ Producer 5 offset %.0f Wh to bill\n", p5OffsetWh)
		} else {
			fmt.Printf("  [WARN] Producer 5 offset failed: %v (status=%d)\n", body, status)
		}
	}

	// ── 9. Consumer 1 buys EC with fiat ──────────────────────────────────────
	fmt.Println("\n▶ Consumer 1 buying EC with fiat...")
	fiatSpend := 5.00
	var fiatEcBought float64
	if consumers[0].token != "" {
		status, body := apiPost("/api/economy/buy-ec", consumers[0].token, map[string]any{
			"fiat_amount": fiatSpend,
		})
		if status == http.StatusCreated {
			purchase, _ := body["purchase"].(map[string]any)
			fiatEcBought, _ = purchase["ec_amount"].(float64)
			fmt.Printf("  ✓ Consumer 1 bought %.2f EC for $%.2f CAD\n", fiatEcBought, fiatSpend)
		} else {
			fmt.Printf("  [WARN] Consumer 1 fiat purchase failed: %v\n", body)
		}
	}

	// ── 10. Fetch final balances and reserve ─────────────────────────────────
	fmt.Println("\n▶ Fetching final balances...")

	getBalance := func(token string) float64 {
		_, body := apiGet("/api/economy/reserve", token) // cheapest authenticated endpoint
		// We need a proper endpoint to get balance — use login.
		// Actually let's use GET /api/panels which returns user data implicitly via auth.
		// The cleanest: re-login isn't possible without the original email.
		// We'll just note we can't get balance without storing it.
		_ = body
		return -1
	}

	// Re-login each participant to get current balance.
	refreshBalance := func(p *participant) {
		status, body := apiPost("/api/auth/login", "", map[string]any{
			"email":    p.email,
			"password": simPassword,
		})
		if status == http.StatusOK {
			user, _ := body["user"].(map[string]any)
			p.endBalance, _ = user["ec_balance"].(float64)
		}
	}
	_ = getBalance

	for i := range producers {
		refreshBalance(&producers[i])
	}
	for i := range consumers {
		refreshBalance(&consumers[i])
	}

	// Reserve stats.
	_, reserveBody := apiGet("/api/economy/reserve", producers[0].token)
	ecAvailable, _ := reserveBody["ec_available"].(float64)
	totalEcIssued, _ := reserveBody["total_ec_issued"].(float64)
	totalEcBurned, _ := reserveBody["total_ec_burned"].(float64)

	// ── Print report ──────────────────────────────────────────────────────────
	totalGross = roundTo(totalGross, 3)
	totalFee = roundTo(totalFee, 3)
	totalNet = roundTo(totalNet, 3)

	avgPrice := 0.0
	if priceCount > 0 {
		avgPrice = priceSum / float64(priceCount)
	}
	gridCeiling := 0.0001 // 0.001 EC/Wh ceiling shown as EC/Wh * 10000 for readability
	_ = gridCeiling
	ceilingECperWh := 0.001
	avgDiscount := 0.0
	if avgPrice > 0 {
		avgDiscount = (1 - avgPrice/ceilingECperWh) * 100
	}

	fmt.Println()
	fmt.Println("╔══════════════════════════════════════════════════════╗")
	fmt.Println("║         ENERGYCREDIT MARKET SIMULATION               ║")
	fmt.Println("╚══════════════════════════════════════════════════════╝")
	fmt.Println()

	fmt.Println("PARTICIPANTS")
	fmt.Printf("  Producers: %d  |  Consumers: %d\n", len(producers), len(consumers))
	fmt.Println()

	fmt.Println("EC MINTING SUMMARY")
	fmt.Printf("  Total Wh Logged:      %s Wh\n", fmtComma(totalWhLogged))
	fmt.Printf("  Total EC Gross:       %.3f EC\n", totalGross)
	fmt.Printf("  Total Fees Burned:    %.3f EC  (%.1f%%)\n", totalFee, mintFeeRate*100)
	fmt.Printf("  Total EC Minted:      %.3f EC\n", totalNet)
	fmt.Println()

	fmt.Println("MARKETPLACE ACTIVITY")
	fmt.Printf("  Listings Created:     %d\n", listingsCreated)
	fmt.Printf("  Trades Attempted:     %d\n", tradesAttempted)
	fmt.Printf("  Trades Completed:     %d\n", tradesCompleted)
	fmt.Printf("  Trades Failed:        %d", tradesFailed)
	if tradesFailed > 0 {
		fmt.Print("  (insufficient balance)")
	}
	fmt.Println()
	if avgPrice > 0 {
		fmt.Printf("  Avg Price:            %.6f EC/Wh\n", avgPrice)
	}
	fmt.Printf("  Grid Ceiling:         %.6f EC/Wh\n", ceilingECperWh)
	if avgDiscount > 0 {
		fmt.Printf("  Avg Discount vs Grid: %.1f%%\n", avgDiscount)
	}
	fmt.Println()

	fmt.Println("BILL OFFSETS")
	if offsetsCompleted > 0 {
		fmt.Printf("  Direct Offsets:       %d  (Producer 5 — %.0f Wh)\n",
			offsetsCompleted, p5OffsetWh)
	} else {
		fmt.Printf("  Direct Offsets:       0\n")
	}
	fmt.Println()

	fmt.Println("FIAT EC PURCHASES")
	if fiatEcBought > 0 {
		fmt.Printf("  Consumer 1 bought:    %.0f EC for $%.2f CAD\n", fiatEcBought, fiatSpend)
	} else {
		fmt.Println("  (none completed)")
	}
	fmt.Println()

	fmt.Println("PLATFORM RESERVE")
	fmt.Printf("  EC Available:         %.3f EC\n", ecAvailable)
	fmt.Printf("  Total EC Issued:      %.3f EC\n", totalEcIssued)
	fmt.Printf("  Total EC Burned:      %.3f EC\n", totalEcBurned)
	fmt.Println()

	fmt.Println("USER BALANCES")
	for i, p := range producers {
		if p.endBalance < 0 {
			fmt.Printf("  %-12s started %.2f EC → balance unavailable\n", p.name+":", p.startBalance)
			continue
		}
		delta := p.endBalance - p.startBalance
		sign := "+"
		if delta < 0 {
			sign = ""
		}
		note := ""
		if i == 4 {
			note = "(direct bill offset — no EC traded)"
		} else if i < len(producerData) && listingIDs[i] > 0 {
			note = "(seller — trade EC received)"
		}
		fmt.Printf("  %-12s started %.2f EC → ended %.2f EC  (%s%.2f) %s\n",
			p.name+":", p.startBalance, p.endBalance, sign, delta, note)
	}
	for i, c := range consumers {
		if c.endBalance < 0 {
			fmt.Printf("  %-12s started %.2f EC → balance unavailable\n", c.name+":", c.startBalance)
			continue
		}
		delta := c.endBalance - c.startBalance
		sign := "+"
		if delta < 0 {
			sign = ""
		}
		note := ""
		if i == 0 && fiatEcBought > 0 {
			note = "(bought listings + fiat EC)"
		} else {
			note = "(buyer)"
		}
		fmt.Printf("  %-12s started %.2f EC → ended %.2f EC  (%s%.2f) %s\n",
			c.name+":", c.startBalance, c.endBalance, sign, delta, note)
	}
	fmt.Println()
	fmt.Println("✅ Simulation complete.")
}

func fmtComma(f float64) string {
	s := fmt.Sprintf("%.0f", f)
	if len(s) <= 3 {
		return s
	}
	// Insert commas every 3 digits from the right.
	result := []byte{}
	for i, ch := range []byte(s) {
		if i > 0 && (len(s)-i)%3 == 0 {
			result = append(result, ',')
		}
		result = append(result, ch)
	}
	return string(result)
}
