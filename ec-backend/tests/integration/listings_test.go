package integration_test

import (
	"fmt"
	"net/http"
	"testing"
)

// ─── create listing ──────────────────────────────────────────────────────────

func TestCreateListing_Success(t *testing.T) {
	t.Parallel()
	token := mustRegister(t, "Seller", uniqueEmail(), "Password123!")
	panelID := mustRegisterPanel(t, token, "Panel", panelCapacityWh)
	batchID := mustLogEnergy(t, token, panelID, 100.0)

	status, body := doRequest(t, "POST", "/api/listings", token, map[string]any{
		"batch_id":  batchID,
		"wh_amount": 100.0,
		"ec_price":  0.0005, // EC/Wh — below ceiling
	})
	if status != http.StatusCreated {
		t.Fatalf("FAIL TestCreateListing_Success: expected 201, got %d (body: %v)", status, body)
	}
	listing, ok := body["listing"].(map[string]any)
	if !ok {
		t.Fatal("FAIL: listing missing from response")
	}
	if listing["status"] != "open" {
		t.Errorf("FAIL: expected listing status=open, got %v", listing["status"])
	}

	// Verify batch status is now "listed".
	_, batchBody := doRequest(t, "GET", "/api/energy/batches", token, nil)
	batches, _ := batchBody["batches"].([]any)
	found := false
	for _, raw := range batches {
		b, _ := raw.(map[string]any)
		if b["id"] == batchID {
			if b["status"] != "listed" {
				t.Errorf("FAIL: expected batch status=listed, got %v", b["status"])
			}
			found = true
		}
	}
	if !found {
		t.Error("FAIL: could not verify batch status (batch not found in GET /batches)")
	}
	t.Log("PASS TestCreateListing_Success")
}

func TestCreateListing_AboveGridCeiling(t *testing.T) {
	t.Parallel()
	token := mustRegister(t, "Greedy", uniqueEmail(), "Password123!")
	panelID := mustRegisterPanel(t, token, "Panel", panelCapacityWh)
	batchID := mustLogEnergy(t, token, panelID, 100.0)

	// ec_price 0.002 EC/Wh > ceiling of 0.001 EC/Wh (grid parity).
	status, _ := doRequest(t, "POST", "/api/listings", token, map[string]any{
		"batch_id":  batchID,
		"wh_amount": 100.0,
		"ec_price":  0.002,
	})
	if status != http.StatusBadRequest {
		t.Fatalf("FAIL TestCreateListing_AboveGridCeiling: expected 400, got %d", status)
	}
	t.Log("PASS TestCreateListing_AboveGridCeiling")
}

func TestCreateListing_WrongOwner(t *testing.T) {
	t.Parallel()
	// User A creates a batch.
	tokenA := mustRegister(t, "Owner A", uniqueEmail(), "Password123!")
	panelA := mustRegisterPanel(t, tokenA, "Panel A", panelCapacityWh)
	batchIDA := mustLogEnergy(t, tokenA, panelA, 100.0)

	// User B tries to list user A's batch.
	tokenB := mustRegister(t, "Thief B", uniqueEmail(), "Password123!")
	status, _ := doRequest(t, "POST", "/api/listings", tokenB, map[string]any{
		"batch_id":  batchIDA,
		"wh_amount": 100.0,
		"ec_price":  0.0005,
	})
	if status != http.StatusForbidden {
		t.Fatalf("FAIL TestCreateListing_WrongOwner: expected 403, got %d", status)
	}
	t.Log("PASS TestCreateListing_WrongOwner")
}

func TestCreateListing_ListedBatch(t *testing.T) {
	t.Parallel()
	token := mustRegister(t, "Double Lister", uniqueEmail(), "Password123!")
	panelID := mustRegisterPanel(t, token, "Panel", panelCapacityWh)
	batchID := mustLogEnergy(t, token, panelID, 100.0)
	mustCreateListing(t, token, batchID, 100.0, 0.0005)

	// Trying to list the same batch again should fail (status is now "listed").
	status, _ := doRequest(t, "POST", "/api/listings", token, map[string]any{
		"batch_id":  batchID,
		"wh_amount": 100.0,
		"ec_price":  0.0005,
	})
	if status != http.StatusForbidden {
		t.Fatalf("FAIL TestCreateListing_ListedBatch: expected 403, got %d", status)
	}
	t.Log("PASS TestCreateListing_ListedBatch")
}

// ─── get listings ────────────────────────────────────────────────────────────

func TestGetListings_OnlyOpenNotExpired(t *testing.T) {
	t.Parallel()
	// Create a fresh open listing.
	_, _, listingID := setupProducerWithListing(t, 100.0, 0.0005)

	status, body := doRequest(t, "GET", "/api/listings",
		mustRegister(t, "Viewer", uniqueEmail(), "Password123!"), nil)
	if status != http.StatusOK {
		t.Fatalf("FAIL TestGetListings_OnlyOpenNotExpired: expected 200, got %d", status)
	}
	listings, _ := body["listings"].([]any)

	// The newly created open listing must appear.
	found := false
	for _, raw := range listings {
		l, _ := raw.(map[string]any)
		if l["id"] == listingID {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("FAIL: newly created listing %.0f not found in GET /api/listings", listingID)
	}
	t.Log("PASS TestGetListings_OnlyOpenNotExpired")
}

// ─── buy listing ─────────────────────────────────────────────────────────────

func TestBuyListing_Success(t *testing.T) {
	t.Parallel()
	sellerToken, _, listingID := setupProducerWithListing(t, 10.0, 0.0001)
	_ = sellerToken

	buyerToken := mustRegister(t, "Buyer", uniqueEmail(), "Password123!")
	status, body := doRequest(t, "POST", fmt.Sprintf("/api/listings/%.0f/buy", listingID), buyerToken, nil)
	if status != http.StatusOK {
		t.Fatalf("FAIL TestBuyListing_Success: expected 200, got %d (body: %v)", status, body)
	}
	txn, ok := body["transaction"].(map[string]any)
	if !ok {
		t.Fatal("FAIL: transaction missing from response")
	}
	if txn["buyer_id"] == nil || txn["seller_id"] == nil {
		t.Error("FAIL: transaction missing buyer_id or seller_id")
	}
	// Listing should no longer appear in GET /api/listings (it's filled).
	_, listBody := doRequest(t, "GET", "/api/listings", buyerToken, nil)
	listings, _ := listBody["listings"].([]any)
	for _, raw := range listings {
		l, _ := raw.(map[string]any)
		if l["id"] == listingID {
			t.Error("FAIL: filled listing still visible in GET /api/listings")
		}
	}
	t.Log("PASS TestBuyListing_Success")
}

func TestBuyListing_OwnListing(t *testing.T) {
	t.Parallel()
	sellerToken, _, listingID := setupProducerWithListing(t, 10.0, 0.0001)
	status, _ := doRequest(t, "POST", fmt.Sprintf("/api/listings/%.0f/buy", listingID), sellerToken, nil)
	if status != http.StatusForbidden {
		t.Fatalf("FAIL TestBuyListing_OwnListing: expected 403, got %d", status)
	}
	t.Log("PASS TestBuyListing_OwnListing")
}

// TestBuyListing_InsufficientBalance: a new user (50 EC) tries to buy a listing
// that costs 60 EC (60000 Wh at grid ceiling 0.001 EC/Wh = 60 EC).
func TestBuyListing_InsufficientBalance(t *testing.T) {
	t.Parallel()
	// Seller needs a batch of 60,000 Wh → use a huge panel capacity.
	sellerToken := mustRegister(t, "Big Seller", uniqueEmail(), "Password123!")
	hugePanelID := mustRegisterPanel(t, sellerToken, "Huge Panel", 500_000_000.0)
	bigBatchID := mustLogEnergy(t, sellerToken, hugePanelID, 60_000.0)
	listingID := mustCreateListing(t, sellerToken, bigBatchID, 60_000.0, 0.001) // 60 EC total

	// New buyer has exactly 50 EC — not enough.
	buyerToken := mustRegister(t, "Poor Buyer", uniqueEmail(), "Password123!")
	status, _ := doRequest(t, "POST", fmt.Sprintf("/api/listings/%.0f/buy", listingID), buyerToken, nil)
	if status != http.StatusPaymentRequired {
		t.Fatalf("FAIL TestBuyListing_InsufficientBalance: expected 402, got %d", status)
	}
	t.Log("PASS TestBuyListing_InsufficientBalance")
}

func TestBuyListing_AlreadyFilled(t *testing.T) {
	t.Parallel()
	_, _, listingID := setupProducerWithListing(t, 10.0, 0.0001)

	buyer1Token := mustRegister(t, "Buyer1", uniqueEmail(), "Password123!")
	buyer2Token := mustRegister(t, "Buyer2", uniqueEmail(), "Password123!")

	path := fmt.Sprintf("/api/listings/%.0f/buy", listingID)
	status1, _ := doRequest(t, "POST", path, buyer1Token, nil)
	if status1 != http.StatusOK {
		t.Fatalf("FAIL TestBuyListing_AlreadyFilled: first buy expected 200, got %d", status1)
	}
	status2, _ := doRequest(t, "POST", path, buyer2Token, nil)
	if status2 != http.StatusConflict {
		t.Fatalf("FAIL TestBuyListing_AlreadyFilled: second buy expected 409, got %d", status2)
	}
	t.Log("PASS TestBuyListing_AlreadyFilled")
}

// ─── cancel listing ──────────────────────────────────────────────────────────

func TestCancelListing_Success(t *testing.T) {
	t.Parallel()
	sellerToken, batchID, listingID := setupProducerWithListing(t, 100.0, 0.0005)

	status, _ := doRequest(t, "DELETE", fmt.Sprintf("/api/listings/%.0f", listingID), sellerToken, nil)
	if status != http.StatusOK {
		t.Fatalf("FAIL TestCancelListing_Success: expected 200, got %d", status)
	}

	// Batch should be available again.
	_, batchBody := doRequest(t, "GET", "/api/energy/batches", sellerToken, nil)
	batches, _ := batchBody["batches"].([]any)
	for _, raw := range batches {
		b, _ := raw.(map[string]any)
		if b["id"] == batchID {
			if b["status"] != "available" {
				t.Errorf("FAIL: expected batch restored to available, got %v", b["status"])
			}
		}
	}
	t.Log("PASS TestCancelListing_Success")
}

func TestCancelListing_WrongUser(t *testing.T) {
	t.Parallel()
	_, _, listingID := setupProducerWithListing(t, 100.0, 0.0005)
	otherToken := mustRegister(t, "Other", uniqueEmail(), "Password123!")

	status, _ := doRequest(t, "DELETE", fmt.Sprintf("/api/listings/%.0f", listingID), otherToken, nil)
	if status != http.StatusForbidden {
		t.Fatalf("FAIL TestCancelListing_WrongUser: expected 403, got %d", status)
	}
	t.Log("PASS TestCancelListing_WrongUser")
}

func TestCancelListing_AlreadyFilled(t *testing.T) {
	t.Parallel()
	sellerToken, _, listingID := setupProducerWithListing(t, 10.0, 0.0001)

	// Buy it first.
	buyerToken := mustRegister(t, "Quick Buyer", uniqueEmail(), "Password123!")
	doRequest(t, "POST", fmt.Sprintf("/api/listings/%.0f/buy", listingID), buyerToken, nil)

	// Seller tries to cancel the now-filled listing.
	status, _ := doRequest(t, "DELETE", fmt.Sprintf("/api/listings/%.0f", listingID), sellerToken, nil)
	if status != http.StatusConflict {
		t.Fatalf("FAIL TestCancelListing_AlreadyFilled: expected 409, got %d", status)
	}
	t.Log("PASS TestCancelListing_AlreadyFilled")
}
