package integration_test

import (
	"encoding/base64"
	"net/http"
	"testing"
)

const protectedPath = "/api/energy/batches"

func TestNoToken(t *testing.T) {
	t.Parallel()
	status, _ := doRequest(t, "GET", protectedPath, "", nil)
	if status != http.StatusUnauthorized {
		t.Fatalf("FAIL TestNoToken: expected 401, got %d", status)
	}
	t.Log("PASS TestNoToken")
}

func TestInvalidToken(t *testing.T) {
	t.Parallel()
	status := doRawToken(t, protectedPath, "garbage123")
	if status != http.StatusUnauthorized {
		t.Fatalf("FAIL TestInvalidToken: expected 401, got %d", status)
	}
	t.Log("PASS TestInvalidToken")
}

func TestTamperedToken(t *testing.T) {
	t.Parallel()
	// Obtain a real token, then corrupt the signature segment.
	email := uniqueEmail()
	token := mustRegister(t, "Tamper User", email, "Password123!")

	// Split into header.payload.signature and replace the last segment.
	tampered := token[:len(token)-5] + "XXXXX"
	status := doRawToken(t, protectedPath, tampered)
	if status != http.StatusUnauthorized {
		t.Fatalf("FAIL TestTamperedToken: expected 401, got %d", status)
	}
	t.Log("PASS TestTamperedToken")
}

// TestAlgorithmNone proves algorithm confusion defence works.
// The middleware must reject a JWT with alg:none even if the payload looks valid.
func TestAlgorithmNone(t *testing.T) {
	t.Parallel()

	// Manually construct: base64url(header).base64url(payload).
	// An empty signature ("") is the alg:none convention.
	header := base64.RawURLEncoding.EncodeToString(
		[]byte(`{"alg":"none","typ":"JWT"}`),
	)
	payload := base64.RawURLEncoding.EncodeToString(
		[]byte(`{"user_id":1,"exp":9999999999}`),
	)
	algNoneToken := header + "." + payload + "."

	status := doRawToken(t, protectedPath, algNoneToken)
	if status != http.StatusUnauthorized {
		t.Fatalf("FAIL TestAlgorithmNone: expected 401, got %d — algorithm confusion defence failed!", status)
	}
	t.Log("PASS TestAlgorithmNone — alg:none correctly rejected")
}

func TestValidToken(t *testing.T) {
	t.Parallel()
	email := uniqueEmail()
	token := mustRegister(t, "Valid User", email, "Password123!")

	status, _ := doRequest(t, "GET", protectedPath, token, nil)
	if status != http.StatusOK {
		t.Fatalf("FAIL TestValidToken: expected 200, got %d", status)
	}
	t.Log("PASS TestValidToken")
}
