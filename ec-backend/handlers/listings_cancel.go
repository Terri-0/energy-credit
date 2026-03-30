package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"energy-credit/backend/config"
	"energy-credit/backend/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func CancelListing(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		return
	}

	listingID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || listingID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid listing id"})
		return
	}

	txErr := config.DB.Transaction(func(tx *gorm.DB) error {
		// Lock listing FOR UPDATE
		var listing models.Listing
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			First(&listing, listingID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return &listingHTTPError{status: http.StatusNotFound, message: "listing not found"}
			}
			return err
		}

		// Only the seller can cancel
		if listing.SellerID != userID {
			return &listingHTTPError{status: http.StatusForbidden, message: "only the seller can cancel this listing"}
		}

		// Check listing is open
		if listing.Status != listingStatusOpen {
			return &listingHTTPError{status: http.StatusConflict, message: "listing is not open"}
		}

		// Lock and validate the backing batch before any status transition.
		var batch models.WhBatch
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND user_id = ?", listing.BatchID, userID).
			First(&batch).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return &listingHTTPError{status: http.StatusConflict, message: "listing batch is unavailable"}
			}
			return err
		}
		if batch.Status != batchStatusListed {
			return &listingHTTPError{status: http.StatusConflict, message: "listing batch is unavailable"}
		}

		now := time.Now()
		if !listing.ExpiresAt.After(now) || !batch.ExpiresAt.After(now) {
			listingExpire := tx.Model(&models.Listing{}).
				Where("id = ? AND status = ?", listing.ID, listingStatusOpen).
				Update("status", listingStatusExpired)
			if listingExpire.Error != nil {
				return listingExpire.Error
			}
			if listingExpire.RowsAffected != 1 {
				return &listingHTTPError{status: http.StatusConflict, message: "listing is no longer open"}
			}

			batchExpire := tx.Model(&models.WhBatch{}).
				Where("id = ? AND user_id = ? AND status = ?", listing.BatchID, userID, batchStatusListed).
				Update("status", batchStatusExpired)
			if batchExpire.Error != nil {
				return batchExpire.Error
			}
			if batchExpire.RowsAffected != 1 {
				return &listingHTTPError{status: http.StatusConflict, message: "listing batch is unavailable"}
			}

			return &listingHTTPError{status: http.StatusConflict, message: "listing has expired"}
		}

		// Set listing status = "cancelled"
		listingUpdate := tx.Model(&models.Listing{}).
			Where("id = ? AND status = ?", listing.ID, listingStatusOpen).
			Update("status", listingStatusCancelled)
		if listingUpdate.Error != nil {
			return listingUpdate.Error
		}
		if listingUpdate.RowsAffected != 1 {
			return &listingHTTPError{status: http.StatusConflict, message: "listing is no longer open"}
		}

		// Set batch status back to "available"
		batchUpdate := tx.Model(&models.WhBatch{}).
			Where("id = ? AND user_id = ? AND status = ?", listing.BatchID, userID, batchStatusListed).
			Update("status", batchStatusAvailable)
		if batchUpdate.Error != nil {
			return batchUpdate.Error
		}
		if batchUpdate.RowsAffected != 1 {
			return errors.New("could not restore batch status")
		}

		return nil
	})
	if txErr != nil {
		var httpErr *listingHTTPError
		if errors.As(txErr, &httpErr) {
			c.JSON(httpErr.status, gin.H{"error": httpErr.message})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not cancel listing"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "listing cancelled"})
}
