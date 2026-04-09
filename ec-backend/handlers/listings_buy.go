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

func BuyListing(c *gin.Context) {
	buyerID, ok := getUserID(c)
	if !ok {
		return
	}

	listingID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || listingID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid listing id"})
		return
	}

	var txRecord models.Transaction
	var buyerBatch models.WhBatch
	txErr := config.DB.Transaction(func(tx *gorm.DB) error {
		// 1. Lock listing row FOR UPDATE
		var listing models.Listing
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			First(&listing, listingID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return &listingHTTPError{status: http.StatusNotFound, message: "listing not found"}
			}
			return err
		}

		now := time.Now()

		// 2. Check listing is open and not expired
		if listing.Status != listingStatusOpen {
			return &listingHTTPError{status: http.StatusConflict, message: "listing is no longer open"}
		}
		if !listing.ExpiresAt.After(now) {
			if err := tx.Model(&models.Listing{}).
				Where("id = ? AND status = ?", listing.ID, listingStatusOpen).
				Update("status", listingStatusExpired).Error; err != nil {
				return err
			}
			if err := tx.Model(&models.WhBatch{}).
				Where("id = ? AND user_id = ? AND status = ?", listing.BatchID, listing.SellerID, batchStatusListed).
				Update("status", batchStatusExpired).Error; err != nil {
				return err
			}
			return &listingHTTPError{status: http.StatusConflict, message: "listing has expired"}
		}

		// 3. Lock batch row and ensure listing is still backed by a listed batch.
		var batch models.WhBatch
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND user_id = ?", listing.BatchID, listing.SellerID).
			First(&batch).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return &listingHTTPError{status: http.StatusConflict, message: "listing batch is unavailable"}
			}
			return err
		}
		if batch.Status != batchStatusListed {
			return &listingHTTPError{status: http.StatusConflict, message: "listing batch is unavailable"}
		}
		if !batch.ExpiresAt.After(now) {
			if err := tx.Model(&models.Listing{}).
				Where("id = ? AND status = ?", listing.ID, listingStatusOpen).
				Update("status", listingStatusExpired).Error; err != nil {
				return err
			}
			if err := tx.Model(&models.WhBatch{}).
				Where("id = ? AND user_id = ? AND status = ?", listing.BatchID, listing.SellerID, batchStatusListed).
				Update("status", batchStatusExpired).Error; err != nil {
				return err
			}
			return &listingHTTPError{status: http.StatusConflict, message: "listing has expired"}
		}

		// 4. Check buyer is not the seller
		if listing.SellerID == buyerID {
			return &listingHTTPError{status: http.StatusForbidden, message: "cannot buy your own listing"}
		}

		// 5. Check buyer EC balance >= listing.wh_amount * listing.ec_price
		ecCost := roundTo(listing.WhAmount*listing.EcPrice, 6)

		// Lock users in deterministic order to avoid cross-buy deadlocks.
		firstUserID := buyerID
		secondUserID := listing.SellerID
		if secondUserID < firstUserID {
			firstUserID, secondUserID = secondUserID, firstUserID
		}
		userIDs := []uint{firstUserID, secondUserID}

		var users []models.User
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id IN ?", userIDs).
			Order("id ASC").
			Find(&users).Error; err != nil {
			return err
		}
		if len(users) != 2 {
			return errors.New("could not lock buyer and seller accounts")
		}

		buyerBalance := users[0].ECBalance
		if users[0].ID != buyerID {
			buyerBalance = users[1].ECBalance
		}
		if buyerBalance < ecCost {
			return &listingHTTPError{status: http.StatusPaymentRequired, message: "insufficient EC balance"}
		}

		// 6. Deduct EC from buyer
		buyerUpdate := tx.Model(&models.User{}).
			Where("id = ? AND ec_balance >= ?", buyerID, ecCost).
			Update("ec_balance", gorm.Expr("ec_balance - ?", ecCost))
		if buyerUpdate.Error != nil {
			return buyerUpdate.Error
		}
		if buyerUpdate.RowsAffected != 1 {
			return &listingHTTPError{status: http.StatusConflict, message: "insufficient EC balance"}
		}

		// 7. Add EC to seller
		sellerUpdate := tx.Model(&models.User{}).
			Where("id = ?", listing.SellerID).
			Update("ec_balance", gorm.Expr("ec_balance + ?", ecCost))
		if sellerUpdate.Error != nil {
			return sellerUpdate.Error
		}
		if sellerUpdate.RowsAffected != 1 {
			return errors.New("could not credit seller")
		}

		// 8. Set listing status = "filled"
		listingUpdate := tx.Model(&models.Listing{}).
			Where("id = ? AND status = ?", listing.ID, listingStatusOpen).
			Update("status", listingStatusFilled)
		if listingUpdate.Error != nil {
			return listingUpdate.Error
		}
		if listingUpdate.RowsAffected != 1 {
			return &listingHTTPError{status: http.StatusConflict, message: "listing is no longer open"}
		}

		// 9. Set wh_batch status = "offset" and wh_remaining = 0
		batchUpdate := tx.Model(&models.WhBatch{}).
			Where("id = ? AND user_id = ? AND status = ?", listing.BatchID, listing.SellerID, batchStatusListed).
			Updates(map[string]any{"status": batchStatusOffset, "wh_remaining": 0})
		if batchUpdate.Error != nil {
			return batchUpdate.Error
		}
		if batchUpdate.RowsAffected != 1 {
			return errors.New("could not update batch status")
		}

		// 10. Create transaction record
		txRecord = models.Transaction{
			BuyerID:   buyerID,
			SellerID:  listing.SellerID,
			ListingID: listing.ID,
			WhAmount:  listing.WhAmount,
			EcAmount:  ecCost,
			CreatedAt: now,
		}
		if err := tx.Create(&txRecord).Error; err != nil {
			return err
		}

		// 11. Create a new available batch for the buyer so they own the energy.
		buyerBatch = models.WhBatch{
			UserID:      buyerID,
			EnergyLogID: batch.EnergyLogID,
			WhRemaining: listing.WhAmount,
			Status:      batchStatusAvailable,
			CreatedAt:   now,
			ExpiresAt:   batch.ExpiresAt,
		}
		if err := tx.Create(&buyerBatch).Error; err != nil {
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not complete purchase"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"transaction": txRecord, "batch": buyerBatch})
}
