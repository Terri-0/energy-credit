package integration_test

import (
	"net/http"
	"testing"
)

func TestRegister_Success(t *testing.T) {
	t.Parallel()
	email := uniqueEmail()
	status, body := doRequest(t, "POST", "/api/auth/register", "", map[string]any{
		"name":     "Alice",
		"email":    email,
		"password": "Password123!",
	})
	if status != http.StatusCreated {
		t.Fatalf("FAIL: expected 201, got %d (body: %v)", status, body)
	}
	token, _ := body["token"].(string)
	if token == "" {
		t.Fatal("FAIL: token missing from response")
	}
	user, ok := body["user"].(map[string]any)
	if !ok {
		t.Fatal("FAIL: user missing from response")
	}
	balance, _ := user["ec_balance"].(float64)
	if balance != 50 {
		t.Errorf("FAIL: expected ec_balance=50, got %v", balance)
	}
	t.Log("PASS TestRegister_Success")
}

func TestRegister_DuplicateEmail(t *testing.T) {
	t.Parallel()
	email := uniqueEmail()
	payload := map[string]any{"name": "Bob", "email": email, "password": "Password123!"}

	status, _ := doRequest(t, "POST", "/api/auth/register", "", payload)
	if status != http.StatusCreated {
		t.Fatalf("FAIL: first register expected 201, got %d", status)
	}

	status, _ = doRequest(t, "POST", "/api/auth/register", "", payload)
	if status != http.StatusBadRequest {
		t.Fatalf("FAIL: duplicate register expected 400, got %d", status)
	}
	t.Log("PASS TestRegister_DuplicateEmail")
}

func TestRegister_PasswordTooShort(t *testing.T) {
	t.Parallel()
	status, _ := doRequest(t, "POST", "/api/auth/register", "", map[string]any{
		"name":     "Carol",
		"email":    uniqueEmail(),
		"password": "abc",
	})
	if status != http.StatusBadRequest {
		t.Fatalf("FAIL: expected 400, got %d", status)
	}
	t.Log("PASS TestRegister_PasswordTooShort")
}

func TestRegister_MissingName(t *testing.T) {
	t.Parallel()
	status, _ := doRequest(t, "POST", "/api/auth/register", "", map[string]any{
		"email":    uniqueEmail(),
		"password": "Password123!",
	})
	if status != http.StatusBadRequest {
		t.Fatalf("FAIL: expected 400, got %d", status)
	}
	t.Log("PASS TestRegister_MissingName")
}

func TestRegister_MissingEmail(t *testing.T) {
	t.Parallel()
	status, _ := doRequest(t, "POST", "/api/auth/register", "", map[string]any{
		"name":     "Dave",
		"password": "Password123!",
	})
	if status != http.StatusBadRequest {
		t.Fatalf("FAIL: expected 400, got %d", status)
	}
	t.Log("PASS TestRegister_MissingEmail")
}

func TestRegister_InvalidEmail(t *testing.T) {
	t.Parallel()
	status, _ := doRequest(t, "POST", "/api/auth/register", "", map[string]any{
		"name":     "Eve",
		"email":    "not-an-email",
		"password": "Password123!",
	})
	if status != http.StatusBadRequest {
		t.Fatalf("FAIL: expected 400, got %d", status)
	}
	t.Log("PASS TestRegister_InvalidEmail")
}

func TestLogin_Success(t *testing.T) {
	t.Parallel()
	email := uniqueEmail()
	mustRegister(t, "Frank", email, "Password123!")

	status, body := doRequest(t, "POST", "/api/auth/login", "", map[string]any{
		"email":    email,
		"password": "Password123!",
	})
	if status != http.StatusOK {
		t.Fatalf("FAIL: expected 200, got %d (body: %v)", status, body)
	}
	token, _ := body["token"].(string)
	if token == "" {
		t.Fatal("FAIL: token missing from login response")
	}
	t.Log("PASS TestLogin_Success")
}

func TestLogin_WrongPassword(t *testing.T) {
	t.Parallel()
	email := uniqueEmail()
	mustRegister(t, "Grace", email, "Password123!")

	status, _ := doRequest(t, "POST", "/api/auth/login", "", map[string]any{
		"email":    email,
		"password": "WrongPassword!",
	})
	if status != http.StatusUnauthorized {
		t.Fatalf("FAIL: expected 401, got %d", status)
	}
	t.Log("PASS TestLogin_WrongPassword")
}

func TestLogin_NonexistentEmail(t *testing.T) {
	t.Parallel()
	status, body := doRequest(t, "POST", "/api/auth/login", "", map[string]any{
		"email":    "nonexistent_" + uniqueEmail(),
		"password": "Password123!",
	})
	if status != http.StatusUnauthorized {
		t.Fatalf("FAIL: expected 401, got %d", status)
	}
	// Enumeration protection: same error message as wrong password.
	errMsg, _ := body["error"].(string)
	if errMsg != "invalid email or password" {
		t.Errorf("FAIL: expected enumeration-safe error, got %q", errMsg)
	}
	t.Log("PASS TestLogin_NonexistentEmail")
}

func TestLogin_MissingFields(t *testing.T) {
	t.Parallel()
	status, _ := doRequest(t, "POST", "/api/auth/login", "", map[string]any{})
	if status != http.StatusBadRequest {
		t.Fatalf("FAIL: expected 400, got %d", status)
	}
	t.Log("PASS TestLogin_MissingFields")
}
