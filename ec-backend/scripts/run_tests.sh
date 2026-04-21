#!/bin/bash
set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║              ENERGYCREDIT TEST SUITE                         ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

echo "━━━ UNIT TESTS (no server required) ━━━"
go test ./tests/unit/... -v
echo ""

echo "━━━ INTEGRATION TESTS (requires server on :8080) ━━━"
go test ./tests/integration/... -v -timeout 60s -run "^Test[^C]"
echo ""

echo "━━━ CONCURRENT BUY TEST ━━━"
go test ./tests/integration/... -v -timeout 30s -run TestConcurrentBuy
echo ""

echo "━━━ MARKET SIMULATION ━━━"
go run ./cmd/simulate/main.go
echo ""

echo "All done."
