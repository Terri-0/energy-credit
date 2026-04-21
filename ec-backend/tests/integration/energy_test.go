package integration_test

import (
	"fmt"
	"math"
	"net/http"
	"testing"
	"time"
)

// ─── panel registration ──────────────────────────────────────────────────────

func TestRegisterPanel_Success(t *testing.T) {
	t.Parallel()
	email := uniqueEmail()
	token := mustRegister(t, "Panel Owner", email, "Password123!")

	status, body := doRequest(t, "POST", "/api/panels/register", token, map[string]any{
		"name":        "Solar Roof A",
		"capacity_wh": 5000.0,
	})
	if status != http.StatusCreated {
		t.Fatalf("FAIL TestRegisterPanel_Success: expected 201, got %d (body: %v)", status, body)
	}
	panel, ok := body["panel"].(map[string]any)
	if !ok {
		t.Fatal("FAIL: panel missing from response")
	}
	if panel["id"] == nil {
		t.Fatal("FAIL: panel id missing")
	}

	// Verify has_panels is now true on subsequent login.
	_, loginBody := doRequest(t, "POST", "/api/auth/login", "", map[string]any{
		"email":    email,
		"password": "Password123!",
	})
	user, _ := loginBody["user"].(map[string]any)
	if hasPanels, _ := user["has_panels"].(bool); !hasPanels {
		t.Error("FAIL: expected has_panels=true after panel registration")
	}

	t.Log("PASS TestRegisterPanel_Success")
}

func TestRegisterPanel_NoAuth(t *testing.T) {
	t.Parallel()
	status, _ := doRequest(t, "POST", "/api/panels/register", "", map[string]any{
		"name":        "No Auth Panel",
		"capacity_wh": 5000.0,
	})
	if status != http.StatusUnauthorized {
		t.Fatalf("FAIL TestRegisterPanel_NoAuth: expected 401, got %d", status)
	}
	t.Log("PASS TestRegisterPanel_NoAuth")
}

func TestRegisterPanel_ZeroCapacity(t *testing.T) {
	t.Parallel()
	token := mustRegister(t, "User", uniqueEmail(), "Password123!")
	status, _ := doRequest(t, "POST", "/api/panels/register", token, map[string]any{
		"name":        "Zero Panel",
		"capacity_wh": 0,
	})
	if status != http.StatusBadRequest {
		t.Fatalf("FAIL TestRegisterPanel_ZeroCapacity: expected 400, got %d", status)
	}
	t.Log("PASS TestRegisterPanel_ZeroCapacity")
}

// ─── energy logging ──────────────────────────────────────────────────────────

func TestLogEnergy_Success(t *testing.T) {
	t.Parallel()
	token := mustRegister(t, "Logger", uniqueEmail(), "Password123!")
	panelID := mustRegisterPanel(t, token, "Panel", panelCapacityWh)

	status, body := doRequest(t, "POST", "/api/energy/log", token, map[string]any{
		"panel_id":  panelID,
		"wh_amount": 100.0,
	})
	if status != http.StatusCreated {
		t.Fatalf("FAIL TestLogEnergy_Success: expected 201, got %d (body: %v)", status, body)
	}
	batch, ok := body["batch"].(map[string]any)
	if !ok {
		t.Fatal("FAIL: batch missing from log response")
	}
	if batch["status"] != "available" {
		t.Errorf("FAIL: expected batch status=available, got %v", batch["status"])
	}
	t.Log("PASS TestLogEnergy_Success")
}

// TestLogEnergy_CorrectMintAmount logs 1000 Wh, then mints the batch and
// verifies the EC amount matches the formula: gross=0.7, fee=0.042, net=0.658.
func TestLogEnergy_CorrectMintAmount(t *testing.T) {
	t.Parallel()
	token := mustRegister(t, "Minter", uniqueEmail(), "Password123!")
	panelID := mustRegisterPanel(t, token, "Panel", panelCapacityWh)
	batchID := mustLogEnergy(t, token, panelID, 1000.0)

	path := fmt.Sprintf("/api/energy/batches/%.0f/mint", batchID)
	status, body := doRequest(t, "POST", path, token, nil)
	if status != http.StatusOK {
		t.Fatalf("FAIL TestLogEnergy_CorrectMintAmount: mint expected 200, got %d (body: %v)", status, body)
	}

	// Expected: roundTo(1000 * 0.0007 * 0.94, 6) = 0.658
	expectedNet := roundTo(1000*0.0007*0.94, 6)
	ecMinted, _ := body["ec_minted"].(float64)
	if math.Abs(ecMinted-expectedNet) > 1e-9 {
		t.Errorf("FAIL: expected ec_minted=%.6f, got %.6f", expectedNet, ecMinted)
	} else {
		t.Logf("PASS TestLogEnergy_CorrectMintAmount: ec_minted=%.6f ✓", ecMinted)
	}
}

func TestLogEnergy_WrongPanel(t *testing.T) {
	t.Parallel()
	// User A registers a panel.
	tokenA := mustRegister(t, "Owner A", uniqueEmail(), "Password123!")
	panelID := mustRegisterPanel(t, tokenA, "Panel A", panelCapacityWh)

	// User B tries to log energy against user A's panel.
	tokenB := mustRegister(t, "Thief B", uniqueEmail(), "Password123!")
	status, _ := doRequest(t, "POST", "/api/energy/log", tokenB, map[string]any{
		"panel_id":  panelID,
		"wh_amount": 100.0,
	})
	if status != http.StatusForbidden {
		t.Fatalf("FAIL TestLogEnergy_WrongPanel: expected 403, got %d", status)
	}
	t.Log("PASS TestLogEnergy_WrongPanel")
}

func TestLogEnergy_NoPanel(t *testing.T) {
	t.Parallel()
	token := mustRegister(t, "No Panel", uniqueEmail(), "Password123!")
	status, _ := doRequest(t, "POST", "/api/energy/log", token, map[string]any{
		"panel_id":  999_999_999,
		"wh_amount": 100.0,
	})
	if status != http.StatusForbidden {
		t.Fatalf("FAIL TestLogEnergy_NoPanel: expected 403, got %d", status)
	}
	t.Log("PASS TestLogEnergy_NoPanel")
}

func TestGetBatches_ReturnsOnlyOwnerBatches(t *testing.T) {
	t.Parallel()

	// User A logs energy.
	tokenA := mustRegister(t, "Owner A", uniqueEmail(), "Password123!")
	panelA := mustRegisterPanel(t, tokenA, "Panel A", panelCapacityWh)
	batchIDA := mustLogEnergy(t, tokenA, panelA, 100.0)

	// User B logs energy.
	tokenB := mustRegister(t, "Owner B", uniqueEmail(), "Password123!")
	panelB := mustRegisterPanel(t, tokenB, "Panel B", panelCapacityWh)
	_ = mustLogEnergy(t, tokenB, panelB, 200.0)

	// Small pause to ensure both writes are visible.
	time.Sleep(10 * time.Millisecond)

	// User A fetches batches — must only see their own.
	status, body := doRequest(t, "GET", "/api/energy/batches", tokenA, nil)
	if status != http.StatusOK {
		t.Fatalf("FAIL TestGetBatches_ReturnsOnlyOwnerBatches: expected 200, got %d", status)
	}
	batches, ok := body["batches"].([]any)
	if !ok {
		t.Fatal("FAIL: batches key missing")
	}

	for _, raw := range batches {
		b, _ := raw.(map[string]any)
		id, _ := b["id"].(float64)
		if id != batchIDA {
			t.Errorf("FAIL: user A's batch list contains unexpected batch id=%.0f", id)
		}
	}
	t.Log("PASS TestGetBatches_ReturnsOnlyOwnerBatches")
}

