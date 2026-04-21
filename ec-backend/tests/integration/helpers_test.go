package integration_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"sync/atomic"
	"testing"
	"time"
)

var emailCounter int64

const baseURL = "http://localhost:8080"

// panelCapacityWh is intentionally large so panels accumulate energy fast
// during tests (capacity / simPeriod = Wh/s; at 120s period this is ~41667 Wh/s).
const panelCapacityWh = 5_000_000.0

// uniqueEmail returns an email address that won't collide across parallel tests.
// Uses an atomic counter so simultaneous goroutines never get the same value.
func uniqueEmail() string {
	n := atomic.AddInt64(&emailCounter, 1)
	return fmt.Sprintf("user_%d_%d@test.com", time.Now().UnixNano(), n)
}

// doRequest sends an HTTP request and returns (statusCode, parsed body map, raw bytes).
func doRequest(t *testing.T, method, path, token string, body any) (int, map[string]any) {
	t.Helper()

	var bodyReader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("doRequest: marshal body: %v", err)
		}
		bodyReader = bytes.NewReader(b)
	}

	req, err := http.NewRequest(method, baseURL+path, bodyReader)
	if err != nil {
		t.Fatalf("doRequest: new request: %v", err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("doRequest: %s %s: %v", method, path, err)
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	var parsed map[string]any
	_ = json.Unmarshal(raw, &parsed)
	return resp.StatusCode, parsed
}

// doRawRequest is like doRequest but lets the caller provide raw bytes for
// the body (used in the alg:none middleware test).
func doRawToken(t *testing.T, path, rawToken string) int {
	t.Helper()
	req, err := http.NewRequest(http.MethodGet, baseURL+path, nil)
	if err != nil {
		t.Fatalf("doRawToken: %v", err)
	}
	req.Header.Set("Authorization", "Bearer "+rawToken)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("doRawToken: %v", err)
	}
	defer resp.Body.Close()
	return resp.StatusCode
}

// mustRegister registers a new user and returns the JWT token.
func mustRegister(t *testing.T, name, email, password string) string {
	t.Helper()
	status, body := doRequest(t, "POST", "/api/auth/register", "", map[string]any{
		"name":     name,
		"email":    email,
		"password": password,
	})
	if status != http.StatusCreated {
		t.Fatalf("mustRegister: expected 201, got %d (body: %v)", status, body)
	}
	token, ok := body["token"].(string)
	if !ok || token == "" {
		t.Fatalf("mustRegister: no token in response: %v", body)
	}
	return token
}

// mustRegisterPanel registers a solar panel and returns its ID.
// It sleeps 50ms after registration so the accumulation timer starts before LogEnergy.
func mustRegisterPanel(t *testing.T, token, name string, capacityWh float64) float64 {
	t.Helper()
	status, body := doRequest(t, "POST", "/api/panels/register", token, map[string]any{
		"name":        name,
		"capacity_wh": capacityWh,
	})
	if status != http.StatusCreated {
		t.Fatalf("mustRegisterPanel: expected 201, got %d (body: %v)", status, body)
	}
	panel, ok := body["panel"].(map[string]any)
	if !ok {
		t.Fatalf("mustRegisterPanel: no panel in response: %v", body)
	}
	id, ok := panel["id"].(float64)
	if !ok || id == 0 {
		t.Fatalf("mustRegisterPanel: invalid panel id: %v", panel)
	}
	// Brief pause so energy accumulates before LogEnergy is called.
	time.Sleep(50 * time.Millisecond)
	return id
}

// mustLogEnergy logs energy for a panel and returns (batchID, whAmount).
func mustLogEnergy(t *testing.T, token string, panelID, whAmount float64) float64 {
	t.Helper()
	status, body := doRequest(t, "POST", "/api/energy/log", token, map[string]any{
		"panel_id":  panelID,
		"wh_amount": whAmount,
	})
	if status != http.StatusCreated {
		t.Fatalf("mustLogEnergy: expected 201, got %d (body: %v)", status, body)
	}
	batch, ok := body["batch"].(map[string]any)
	if !ok {
		t.Fatalf("mustLogEnergy: no batch in response: %v", body)
	}
	id, ok := batch["id"].(float64)
	if !ok || id == 0 {
		t.Fatalf("mustLogEnergy: invalid batch id: %v", batch)
	}
	return id
}

// mustCreateListing creates a marketplace listing and returns its ID.
func mustCreateListing(t *testing.T, token string, batchID, whAmount, ecPrice float64) float64 {
	t.Helper()
	status, body := doRequest(t, "POST", "/api/listings", token, map[string]any{
		"batch_id":  batchID,
		"wh_amount": whAmount,
		"ec_price":  ecPrice,
	})
	if status != http.StatusCreated {
		t.Fatalf("mustCreateListing: expected 201, got %d (body: %v)", status, body)
	}
	listing, ok := body["listing"].(map[string]any)
	if !ok {
		t.Fatalf("mustCreateListing: no listing in response: %v", body)
	}
	id, ok := listing["id"].(float64)
	if !ok || id == 0 {
		t.Fatalf("mustCreateListing: invalid listing id: %v", listing)
	}
	return id
}

// roundTo rounds value to the given number of decimal places (mirrors handlers/common.go).
func roundTo(value float64, decimals int) float64 {
	m := math.Pow(10, float64(decimals))
	return math.Round(value*m) / m
}

// setupProducerWithListing registers a user, panel, logs energy and creates a listing.
// Returns (token, batchID, listingID, whAmount).
func setupProducerWithListing(t *testing.T, whAmount, ecPrice float64) (token string, batchID, listingID float64) {
	t.Helper()
	email := uniqueEmail()
	token = mustRegister(t, "Producer", email, "Password123!")
	panelID := mustRegisterPanel(t, token, "Test Panel", panelCapacityWh)
	batchID = mustLogEnergy(t, token, panelID, whAmount)
	listingID = mustCreateListing(t, token, batchID, whAmount, ecPrice)
	return
}
