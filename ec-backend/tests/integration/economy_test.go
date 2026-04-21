package integration_test

import (
	"fmt"
	"net/http"
	"testing"
)

// ─── bill offset ─────────────────────────────────────────────────────────────

func TestOffsetBatch_Success(t *testing.T) {
	t.Parallel()
	token := mustRegister(t, "Offsetter", uniqueEmail(), "Password123!")
	panelID := mustRegisterPanel(t, token, "Panel", panelCapacityWh)
	batchID := mustLogEnergy(t, token, panelID, 100.0)

	status, body := doRequest(t, "POST", "/api/economy/offset", token, map[string]any{
		"batch_id": batchID,
	})
	if status != http.StatusCreated {
		t.Fatalf("FAIL TestOffsetBatch_Success: expected 201, got %d (body: %v)", status, body)
	}
	offset, ok := body["offset"].(map[string]any)
	if !ok {
		t.Fatal("FAIL: offset missing from response")
	}
	if offset["id"] == nil {
		t.Error("FAIL: offset id missing")
	}

	// Confirm batch is now offset status.
	_, batchBody := doRequest(t, "GET", "/api/energy/batches", token, nil)
	batches, _ := batchBody["batches"].([]any)
	for _, raw := range batches {
		b, _ := raw.(map[string]any)
		if b["id"] == batchID {
			if b["status"] != "offset" {
				t.Errorf("FAIL: expected batch status=offset, got %v", b["status"])
			}
		}
	}
	t.Log("PASS TestOffsetBatch_Success")
}

func TestOffsetBatch_WrongOwner(t *testing.T) {
	t.Parallel()
	// User A creates a batch.
	tokenA := mustRegister(t, "Owner A", uniqueEmail(), "Password123!")
	panelA := mustRegisterPanel(t, tokenA, "Panel", panelCapacityWh)
	batchIDA := mustLogEnergy(t, tokenA, panelA, 100.0)

	// User B tries to offset user A's batch.
	tokenB := mustRegister(t, "Thief B", uniqueEmail(), "Password123!")
	status, _ := doRequest(t, "POST", "/api/economy/offset", tokenB, map[string]any{
		"batch_id": batchIDA,
	})
	if status != http.StatusForbidden {
		t.Fatalf("FAIL TestOffsetBatch_WrongOwner: expected 403, got %d", status)
	}
	t.Log("PASS TestOffsetBatch_WrongOwner")
}

func TestOffsetBatch_ListedBatch(t *testing.T) {
	t.Parallel()
	// Create a batch and list it.
	token := mustRegister(t, "Lister", uniqueEmail(), "Password123!")
	panelID := mustRegisterPanel(t, token, "Panel", panelCapacityWh)
	batchID := mustLogEnergy(t, token, panelID, 100.0)
	mustCreateListing(t, token, batchID, 100.0, 0.0005)

	// Attempt to offset the same batch (status is now "listed", not "available").
	status, _ := doRequest(t, "POST", "/api/economy/offset", token, map[string]any{
		"batch_id": batchID,
	})
	// Handler returns 403 because the WHERE status='available' query finds nothing.
	if status != http.StatusForbidden {
		t.Fatalf("FAIL TestOffsetBatch_ListedBatch: expected 403, got %d", status)
	}
	t.Log("PASS TestOffsetBatch_ListedBatch")
}

// ─── buy EC with fiat ────────────────────────────────────────────────────────

func TestBuyEC_Success(t *testing.T) {
	t.Parallel()
	token := mustRegister(t, "EC Buyer", uniqueEmail(), "Password123!")

	// Login first to capture starting balance.
	_, loginBody := doRequest(t, "POST", "/api/auth/login", "", map[string]any{
		"email":    "SKIP", // we just need to call this via token-based check
		"password": "SKIP",
	})
	_ = loginBody

	status, body := doRequest(t, "POST", "/api/economy/buy-ec", token, map[string]any{
		"fiat_amount": 10.0,
	})
	if status != http.StatusCreated {
		t.Fatalf("FAIL TestBuyEC_Success: expected 201, got %d (body: %v)", status, body)
	}
	purchase, ok := body["purchase"].(map[string]any)
	if !ok {
		t.Fatal("FAIL: purchase missing from response")
	}
	ecAmount, _ := purchase["ec_amount"].(float64)
	// $10 CAD / $0.10 per EC = 100 EC
	if ecAmount != 100.0 {
		t.Errorf("FAIL: expected ec_amount=100, got %v", ecAmount)
	}
	t.Logf("PASS TestBuyEC_Success: purchased %.2f EC for $10.00 CAD", ecAmount)
}

func TestBuyEC_ZeroAmount(t *testing.T) {
	t.Parallel()
	token := mustRegister(t, "Zero Buyer", uniqueEmail(), "Password123!")
	status, _ := doRequest(t, "POST", "/api/economy/buy-ec", token, map[string]any{
		"fiat_amount": 0,
	})
	if status != http.StatusBadRequest {
		t.Fatalf("FAIL TestBuyEC_ZeroAmount: expected 400, got %d", status)
	}
	t.Log("PASS TestBuyEC_ZeroAmount")
}

func TestBuyEC_NegativeAmount(t *testing.T) {
	t.Parallel()
	token := mustRegister(t, "Negative Buyer", uniqueEmail(), "Password123!")
	status, _ := doRequest(t, "POST", "/api/economy/buy-ec", token, map[string]any{
		"fiat_amount": -5.0,
	})
	if status != http.StatusBadRequest {
		t.Fatalf("FAIL TestBuyEC_NegativeAmount: expected 400, got %d", status)
	}
	t.Log("PASS TestBuyEC_NegativeAmount")
}

// ─── platform reserve ────────────────────────────────────────────────────────

func TestGetReserve_ReturnsStats(t *testing.T) {
	t.Parallel()
	token := mustRegister(t, "Reserve Viewer", uniqueEmail(), "Password123!")

	// Ensure reserve row exists by buying some EC first.
	doRequest(t, "POST", "/api/economy/buy-ec", token, map[string]any{"fiat_amount": 1.0})

	status, body := doRequest(t, "GET", "/api/economy/reserve", token, nil)
	if status != http.StatusOK {
		t.Fatalf("FAIL TestGetReserve_ReturnsStats: expected 200, got %d (body: %v)", status, body)
	}

	for _, field := range []string{"ec_available", "total_ec_issued", "total_ec_burned"} {
		val, ok := body[field]
		if !ok {
			t.Errorf("FAIL: field %q missing from reserve response", field)
			continue
		}
		n, _ := val.(float64)
		if n < 0 {
			t.Errorf("FAIL: field %q is negative: %v", field, n)
		}
		fmt.Printf("  reserve.%s = %v\n", field, n)
	}
	t.Log("PASS TestGetReserve_ReturnsStats")
}
