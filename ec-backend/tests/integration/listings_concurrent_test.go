package integration_test

import (
	"fmt"
	"net/http"
	"sync"
	"testing"
)

// TestConcurrentBuy_ExactlyOneSucceeds proves that SELECT FOR UPDATE prevents
// double-selling: 10 consumers race to buy the same listing simultaneously,
// exactly 1 must succeed (200) and exactly 9 must be rejected (409).
func TestConcurrentBuy_ExactlyOneSucceeds(t *testing.T) {
	// Do NOT use t.Parallel() here — this test is CPU-intensive and
	// the goroutine coordination must not be disrupted by the scheduler.

	const numBuyers = 10

	// 1. Set up a single listing (10 Wh, cheap price so all buyers can afford it).
	_, _, listingID := setupProducerWithListing(t, 10.0, 0.00001)

	// 2. Register 10 consumer accounts.
	buyerTokens := make([]string, numBuyers)
	for i := range buyerTokens {
		buyerTokens[i] = mustRegister(t,
			fmt.Sprintf("Consumer%d", i),
			uniqueEmail(),
			"Password123!",
		)
	}

	// 3. All 10 goroutines block on startCh, then fire simultaneously.
	path := fmt.Sprintf("/api/listings/%.0f/buy", listingID)
	results := make([]int, numBuyers)
	startCh := make(chan struct{})
	var wg sync.WaitGroup

	for i := 0; i < numBuyers; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			<-startCh // wait for the starting pistol
			status, _ := doRequest(t, "POST", path, buyerTokens[idx], nil)
			results[idx] = status
		}(i)
	}

	close(startCh) // release all goroutines at once
	wg.Wait()

	// 4. Tally results.
	succeeded := 0
	rejected := 0
	for _, s := range results {
		switch s {
		case http.StatusOK:
			succeeded++
		case http.StatusConflict:
			rejected++
		}
	}

	fmt.Printf("\nConcurrent buy test: %d/%d succeeded, %d/%d correctly rejected\n",
		succeeded, numBuyers, rejected, numBuyers)

	// 5. Assert exactly one winner.
	if succeeded != 1 {
		t.Errorf("FAIL TestConcurrentBuy_ExactlyOneSucceeds: expected exactly 1 success, got %d", succeeded)
	}
	if rejected != numBuyers-1 {
		t.Errorf("FAIL TestConcurrentBuy_ExactlyOneSucceeds: expected %d rejections, got %d",
			numBuyers-1, rejected)
	}

	// 6. Confirm listing is no longer visible (status="filled").
	viewerToken := mustRegister(t, "Viewer", uniqueEmail(), "Password123!")
	_, listBody := doRequest(t, "GET", "/api/listings", viewerToken, nil)
	listings, _ := listBody["listings"].([]any)
	for _, raw := range listings {
		l, _ := raw.(map[string]any)
		if l["id"] == listingID {
			t.Error("FAIL: filled listing still visible in GET /api/listings")
		}
	}

	if succeeded == 1 && rejected == numBuyers-1 {
		t.Logf("PASS TestConcurrentBuy_ExactlyOneSucceeds — SELECT FOR UPDATE works correctly")
	}
}
