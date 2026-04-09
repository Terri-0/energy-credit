package handlers

import (
	"errors"
	"math"
	"net/http"
	"strings"
	"time"

	"energy-credit/backend/config"
	"energy-credit/backend/models"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type CreateListingInput struct {
	BatchID  uint    `json:"batch_id"  binding:"required"`
	WhAmount float64 `json:"wh_amount" binding:"required,gt=0"`
	EcPrice  float64 `json:"ec_price"  binding:"required,gt=0"`
}

func createListingValidationDetails(err error) map[string]string {
	var validationErrs validator.ValidationErrors
	if !errors.As(err, &validationErrs) {
		return nil
	}

	details := map[string]string{}
	for _, fieldErr := range validationErrs {
		switch fieldErr.Field() {
		case "BatchID":
			details["batch_id"] = "batch_id is required"
		case "WhAmount":
			details["wh_amount"] = "wh_amount must be greater than 0"
		case "EcPrice":
			details["ec_price"] = "ec_price must be greater than 0"
		default:
			details[strings.ToLower(fieldErr.Field())] = "invalid value"
		}
	}

	return details
}

func CreateListing(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		return
	}

	var input CreateListingInput
	if err := c.ShouldBindJSON(&input); err != nil {
		if details := createListingValidationDetails(err); details != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid request payload",
				"details": details,
			})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request payload"})
		return
	}

	whAmount := roundTo(input.WhAmount, 6)
	ecPrice := roundTo(input.EcPrice, 6)
	if whAmount <= 0 || ecPrice <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "wh_amount and ec_price must be greater than 0"})
		return
	}

	// Ceiling: ec_price is in EC/Wh; the grid parity ceiling is 1 EC/kWh = 0.001 EC/Wh
	// (since 1 EC = 1 kWh = $0.10 CAD — you cannot sell Wh for more than its grid value).
	listingCeiling, err := getEnvFloat("EC_LISTING_CEILING", 0.001)
	if err != nil || listingCeiling <= 0 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid EC_LISTING_CEILING configuration"})
		return
	}
	if ecPrice > listingCeiling {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ec_price cannot exceed grid parity ceiling (0.001 EC/Wh)"})
		return
	}

	var listing models.Listing
	txErr := config.DB.Transaction(func(tx *gorm.DB) error {
		// Lock the row so listing state cannot change mid-transaction.
		var batch models.WhBatch
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND user_id = ? AND status = ?", input.BatchID, userID, batchStatusAvailable).
			First(&batch).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return &listingHTTPError{status: http.StatusForbidden, message: "batch not found or not available"}
			}
			return err
		}

		now := time.Now()
		if !batch.ExpiresAt.After(now) {
			return &listingHTTPError{status: http.StatusBadRequest, message: "batch is expired and cannot be listed"}
		}

		if whAmount > batch.WhRemaining {
			return &listingHTTPError{status: http.StatusBadRequest, message: "wh_amount exceeds batch remaining"}
		}
		if math.Abs(whAmount-batch.WhRemaining) > 1e-6 {
			return &listingHTTPError{status: http.StatusBadRequest, message: "wh_amount must equal full batch remaining"}
		}

		// Re-assert ownership and status at write time.
		batchUpdate := tx.Model(&models.WhBatch{}).
			Where("id = ? AND user_id = ? AND status = ?", input.BatchID, userID, batchStatusAvailable).
			Update("status", batchStatusListed)
		if batchUpdate.Error != nil {
			return batchUpdate.Error
		}
		if batchUpdate.RowsAffected != 1 {
			return &listingHTTPError{status: http.StatusConflict, message: "batch is no longer available"}
		}

		listing = models.Listing{
			SellerID:  userID,
			BatchID:   input.BatchID,
			WhAmount:  whAmount,
			EcPrice:   ecPrice,
			Status:    listingStatusOpen,
			CreatedAt: now,
			ExpiresAt: batch.ExpiresAt, // listing expires when batch expires
		}
		if err := tx.Create(&listing).Error; err != nil {
			return err
		}

		return nil
	})
	if txErr != nil {
		var httpErr *listingHTTPError
		if errors.As(txErr, &httpErr) {
			c.JSON(httpErr.status, gin.H{"error": httpErr.message})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create listing"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"listing": listing})
}
