package handlers

type listingHTTPError struct {
	status  int
	message string
}

func (e *listingHTTPError) Error() string {
	return e.message
}

const (
	listingStatusOpen      = "open"
	listingStatusFilled    = "filled"
	listingStatusCancelled = "cancelled"
	listingStatusExpired   = "expired"
)

const (
	batchStatusAvailable = "available"
	batchStatusListed    = "listed"
	batchStatusOffset    = "offset"
	batchStatusExpired   = "expired"
)
