package handlers

import (
	"errors"
	"net/http"
	"strconv"

	"energy-credit/backend/config"
	"energy-credit/backend/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func MintBatch(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		return
	}

	batchID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || batchID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid batch id"})
		return
	}

	mintRate, err := getEnvFloat("EC_MINT_RATE", 0.0007) // 0.7 EC per kWh — 30% below grid parity to incentivise marketplace
	if err != nil || mintRate <= 0 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid EC_MINT_RATE configuration"})
		return
	}
	mintFee, err := getEnvFloat("EC_MINT_FEE", 0.06)
	if err != nil || mintFee < 0 || mintFee >= 1 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid EC_MINT_FEE configuration"})
		return
	}

	var ecMinted, ecFee float64

	txErr := config.DB.Transaction(func(tx *gorm.DB) error {
		// Lock the batch row.
		var batch models.WhBatch
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND user_id = ? AND status = ?", batchID, userID, batchStatusAvailable).
			First(&batch).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return &listingHTTPError{status: http.StatusForbidden, message: "batch not found or not available for minting"}
			}
			return err
		}

		// Calculate EC amounts.
		ecGross := roundTo(batch.WhRemaining*mintRate, 6)
		ecFee = roundTo(ecGross*mintFee, 6)
		ecMinted = roundTo(ecGross-ecFee, 6)

		// Mark batch as minted.
		batchUpdate := tx.Model(&models.WhBatch{}).
			Where("id = ? AND user_id = ? AND status = ?", batchID, userID, batchStatusAvailable).
			Updates(map[string]any{"status": batchStatusMinted, "wh_remaining": 0})
		if batchUpdate.Error != nil {
			return batchUpdate.Error
		}
		if batchUpdate.RowsAffected != 1 {
			return &listingHTTPError{status: http.StatusConflict, message: "batch is no longer available"}
		}

		// Update energy log with minted amounts.
		if err := tx.Model(&models.EnergyLog{}).
			Where("id = ?", batch.EnergyLogID).
			Updates(map[string]any{"ec_minted": ecMinted, "fee_burned": ecFee}).Error; err != nil {
			return err
		}

		// Credit user.
		userUpdate := tx.Model(&models.User{}).
			Where("id = ?", userID).
			Update("ec_balance", gorm.Expr("ec_balance + ?", ecMinted))
		if userUpdate.Error != nil {
			return userUpdate.Error
		}
		if userUpdate.RowsAffected != 1 {
			return errors.New("could not credit user EC balance")
		}

		// Ensure reserve row exists, then update it.
		reserve := models.PlatformReserve{ID: 1}
		if err := tx.Where("id = ?", 1).FirstOrCreate(&reserve, models.PlatformReserve{ID: 1}).Error; err != nil {
			return err
		}
		reserveUpdate := tx.Model(&models.PlatformReserve{}).
			Where("id = 1").
			Updates(map[string]any{
				"ec_available":    gorm.Expr("ec_available + ?", ecFee),
				"total_ec_issued": gorm.Expr("total_ec_issued + ?", ecMinted),
				"total_ec_burned": gorm.Expr("total_ec_burned + ?", ecFee),
				"updated_at":      gorm.Expr("NOW()"),
			})
		if reserveUpdate.Error != nil {
			return reserveUpdate.Error
		}
		if reserveUpdate.RowsAffected != 1 {
			return errors.New("could not update platform reserve")
		}

		return nil
	})
	if txErr != nil {
		var httpErr *listingHTTPError
		if errors.As(txErr, &httpErr) {
			c.JSON(httpErr.status, gin.H{"error": httpErr.message})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not mint batch"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"ec_minted": ecMinted,
		"ec_fee":    ecFee,
		"message":   "Batch minted successfully",
	})
}
