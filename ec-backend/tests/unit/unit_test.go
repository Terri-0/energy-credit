package unit_test

// Pure functions mirrored from handlers/common.go.
// They are unexported and cannot be imported from an external package,
// so the logic is re-implemented here to keep the tests isolated from
// server or database dependencies.

import (
	"math"
	"os"
	"strconv"
	"testing"
)

// ─── helpers ────────────────────────────────────────────────────────────────

func roundTo(value float64, decimals int) float64 {
	multiplier := math.Pow(10, float64(decimals))
	return math.Round(value*multiplier) / multiplier
}

func getEnvFloat(name string, defaultValue float64) (float64, error) {
	raw := os.Getenv(name)
	if raw == "" {
		return defaultValue, nil
	}
	value, err := strconv.ParseFloat(raw, 64)
	if err != nil {
		return 0, err
	}
	return value, nil
}

const (
	testMintRate = 0.0007 // EC per Wh
	testMintFee  = 0.06   // platform fee fraction
)

// mint computes (gross, fee, net) EC for a given Wh amount.
func mint(wh float64) (gross, fee, net float64) {
	gross = roundTo(wh*testMintRate, 6)
	fee = roundTo(gross*testMintFee, 6)
	net = roundTo(gross-fee, 6)
	return
}

// ─── roundTo ────────────────────────────────────────────────────────────────

func TestRoundTo_Precision(t *testing.T) {
	result := roundTo(0.69999999, 6)
	if result != 0.7 {
		t.Errorf("FAIL TestRoundTo_Precision: expected 0.7, got %v", result)
	} else {
		t.Log("PASS TestRoundTo_Precision")
	}
}

func TestRoundTo_NoChange(t *testing.T) {
	result := roundTo(0.658, 6)
	if result != 0.658 {
		t.Errorf("FAIL TestRoundTo_NoChange: expected 0.658, got %v", result)
	} else {
		t.Log("PASS TestRoundTo_NoChange")
	}
}

// ─── minting formula ────────────────────────────────────────────────────────

func TestMintingFormula_1000Wh(t *testing.T) {
	gross, fee, net := mint(1000)
	if gross != 0.7 {
		t.Errorf("FAIL gross: expected 0.7, got %v", gross)
	}
	if fee != 0.042 {
		t.Errorf("FAIL fee: expected 0.042, got %v", fee)
	}
	if net != 0.658 {
		t.Errorf("FAIL net: expected 0.658, got %v", net)
	}
	if gross == 0.7 && fee == 0.042 && net == 0.658 {
		t.Log("PASS TestMintingFormula_1000Wh")
	}
}

func TestMintingFormula_5000Wh(t *testing.T) {
	gross, fee, net := mint(5000)
	if gross != 3.5 {
		t.Errorf("FAIL gross: expected 3.5, got %v", gross)
	}
	if fee != 0.21 {
		t.Errorf("FAIL fee: expected 0.21, got %v", fee)
	}
	if net != 3.29 {
		t.Errorf("FAIL net: expected 3.29, got %v", net)
	}
	if gross == 3.5 && fee == 0.21 && net == 3.29 {
		t.Log("PASS TestMintingFormula_5000Wh")
	}
}

func TestMintingFormula_SmallAmount(t *testing.T) {
	_, _, net := mint(1)
	if net <= 0 {
		t.Errorf("FAIL TestMintingFormula_SmallAmount: expected net > 0 for 1 Wh, got %v", net)
	} else {
		t.Logf("PASS TestMintingFormula_SmallAmount: 1 Wh → net=%.6f EC", net)
	}
}

func TestMintingFormula_LargeAmount(t *testing.T) {
	gross, _, net := mint(1_000_000)
	if gross <= 0 || net <= 0 {
		t.Errorf("FAIL TestMintingFormula_LargeAmount: overflow? gross=%v, net=%v", gross, net)
	} else if net >= gross {
		t.Errorf("FAIL TestMintingFormula_LargeAmount: expected net < gross; gross=%v, net=%v", gross, net)
	} else {
		t.Logf("PASS TestMintingFormula_LargeAmount: 1,000,000 Wh → gross=%.2f, net=%.2f", gross, net)
	}
}

// ─── getEnvFloat ────────────────────────────────────────────────────────────

func TestGetEnvFloat_Default(t *testing.T) {
	const key = "UNIT_TEST_FLOAT_MISSING"
	os.Unsetenv(key)

	val, err := getEnvFloat(key, 42.5)
	if err != nil {
		t.Fatalf("FAIL TestGetEnvFloat_Default: unexpected error: %v", err)
	}
	if val != 42.5 {
		t.Errorf("FAIL TestGetEnvFloat_Default: expected 42.5, got %v", val)
	} else {
		t.Log("PASS TestGetEnvFloat_Default")
	}
}

func TestGetEnvFloat_Valid(t *testing.T) {
	const key = "UNIT_TEST_FLOAT_VALID"
	os.Setenv(key, "3.14")
	defer os.Unsetenv(key)

	val, err := getEnvFloat(key, 0)
	if err != nil {
		t.Fatalf("FAIL TestGetEnvFloat_Valid: unexpected error: %v", err)
	}
	if val != 3.14 {
		t.Errorf("FAIL TestGetEnvFloat_Valid: expected 3.14, got %v", val)
	} else {
		t.Log("PASS TestGetEnvFloat_Valid")
	}
}

func TestGetEnvFloat_Invalid(t *testing.T) {
	const key = "UNIT_TEST_FLOAT_INVALID"
	os.Setenv(key, "not-a-number")
	defer os.Unsetenv(key)

	_, err := getEnvFloat(key, 0)
	if err == nil {
		t.Error("FAIL TestGetEnvFloat_Invalid: expected error for non-numeric value, got nil")
	} else {
		t.Log("PASS TestGetEnvFloat_Invalid")
	}
}

func TestGetEnvFloat_Zero(t *testing.T) {
	const key = "UNIT_TEST_FLOAT_ZERO"
	os.Setenv(key, "0")
	defer os.Unsetenv(key)

	val, err := getEnvFloat(key, 99)
	if err != nil {
		t.Fatalf("FAIL TestGetEnvFloat_Zero: unexpected error: %v", err)
	}
	if val != 0 {
		t.Errorf("FAIL TestGetEnvFloat_Zero: expected 0, got %v", val)
	} else {
		t.Log("PASS TestGetEnvFloat_Zero")
	}
}
