package handlers

import (
	"errors"
	"net/http"
	"time"

	"energy-credit/backend/config"
	"energy-credit/backend/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type OffsetBatchInput struct {
	BatchID uint `json:"batch_id" binding:"required"`
}

type BuyECInput struct {
	FiatAmount float64 `json:"fiat_amount" binding:"required,gt=0"`
}

func OffsetBatch(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		return
	}

	var input OffsetBatchInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request payload"})
		return
	}

	gridPrice, err := getEnvFloat("GRID_PRICE", 0.10)
	if err != nil || gridPrice <= 0 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid GRID_PRICE configuration"})
		return
	}

	var offset models.BillOffset
	txErr := config.DB.Transaction(func(tx *gorm.DB) error {
		now := time.Now()

		// Lock batch FOR UPDATE: must belong to user and be available.
		var batch models.WhBatch
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND user_id = ? AND status = ?", input.BatchID, userID, batchStatusAvailable).
			First(&batch).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return &listingHTTPError{status: http.StatusForbidden, message: "batch not found or not available"}
			}
			return err
		}

		if !batch.ExpiresAt.After(now) {
			expireUpdate := tx.Model(&models.WhBatch{}).
				Where("id = ? AND user_id = ? AND status = ?", input.BatchID, userID, batchStatusAvailable).
				Update("status", batchStatusExpired)
			if expireUpdate.Error != nil {
				return expireUpdate.Error
			}
			if expireUpdate.RowsAffected != 1 {
				return &listingHTTPError{status: http.StatusConflict, message: "batch is no longer available"}
			}
			return &listingHTTPError{status: http.StatusConflict, message: "batch has expired"}
		}

		whAmount := batch.WhRemaining
		if whAmount <= 0 {
			return &listingHTTPError{status: http.StatusConflict, message: "batch has no remaining energy to offset"}
		}
		// gridPrice is per kWh; convert Wh → kWh before multiplying.
		ecEquivalent := roundTo((whAmount/1000)*gridPrice, 6)

		// Set batch status = offset, wh_remaining = 0
		batchUpdate := tx.Model(&models.WhBatch{}).
			Where("id = ? AND user_id = ? AND status = ?", input.BatchID, userID, batchStatusAvailable).
			Updates(map[string]any{"status": batchStatusOffset, "wh_remaining": 0})
		if batchUpdate.Error != nil {
			return batchUpdate.Error
		}
		if batchUpdate.RowsAffected != 1 {
			return &listingHTTPError{status: http.StatusConflict, message: "batch is no longer available"}
		}

		offset = models.BillOffset{
			UserID:       userID,
			BatchID:      input.BatchID,
			WhAmount:     whAmount,
			EcEquivalent: ecEquivalent,
			CreatedAt:    now,
		}
		if err := tx.Create(&offset).Error; err != nil {
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not offset batch"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"offset": offset})
}

func BuyEC(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		return
	}

	var input BuyECInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request payload"})
		return
	}

	gridPrice, err := getEnvFloat("GRID_PRICE", 0.10)
	if err != nil || gridPrice <= 0 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid GRID_PRICE configuration"})
		return
	}

	fiatAmount := roundTo(input.FiatAmount, 6)
	ecAmount := roundTo(fiatAmount/gridPrice, 6)
	if fiatAmount <= 0 || ecAmount <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "fiat_amount is too small"})
		return
	}

	// Fiat purchases are simulated — no real payment, no reserve gate.
	// EC is issued directly to the user; total_ec_issued is tracked for audit.
	var purchase models.EcPurchase
	txErr := config.DB.Transaction(func(tx *gorm.DB) error {
		now := time.Now()

		// Credit user.
		userUpdate := tx.Model(&models.User{}).
			Where("id = ?", userID).
			Update("ec_balance", gorm.Expr("ec_balance + ?", ecAmount))
		if userUpdate.Error != nil {
			return userUpdate.Error
		}
		if userUpdate.RowsAffected != 1 {
			return errors.New("could not credit user account")
		}

		// Track issuance in reserve for audit (but don't gate on ec_available).
		reserve := models.PlatformReserve{ID: 1}
		if err := tx.Where("id = ?", 1).FirstOrCreate(&reserve, models.PlatformReserve{ID: 1}).Error; err != nil {
			return err
		}
		if err := tx.Model(&models.PlatformReserve{}).
			Where("id = 1").
			Update("total_ec_issued", gorm.Expr("total_ec_issued + ?", ecAmount)).Error; err != nil {
			return err
		}

		purchase = models.EcPurchase{
			UserID:     userID,
			EcAmount:   ecAmount,
			FiatAmount: fiatAmount,
			RateUsed:   gridPrice,
			CreatedAt:  now,
		}
		if err := tx.Create(&purchase).Error; err != nil {
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not complete EC purchase"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"purchase": purchase})
}

func GetOffsets(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		return
	}

	now := time.Now()
	startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())

	var offsets []models.BillOffset
	if err := config.DB.
		Where("user_id = ? AND created_at >= ?", userID, startOfMonth).
		Order("created_at desc").
		Find(&offsets).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not retrieve offsets"})
		return
	}

	gridPrice, err := getEnvFloat("GRID_PRICE", 0.10)
	if err != nil || gridPrice <= 0 {
		gridPrice = 0.10
	}

	var totalWh, totalEC float64
	for _, o := range offsets {
		totalWh += o.WhAmount
		totalEC += o.EcEquivalent
	}

	c.JSON(http.StatusOK, gin.H{
		"offsets":   offsets,
		"total_wh":  roundTo(totalWh, 4),
		"total_cad": roundTo(totalWh/1000*gridPrice, 4),
		"month":     now.Format("January 2006"),
	})
}

func GetReserve(c *gin.Context) {
	_, ok := getUserID(c)
	if !ok {
		return
	}

	var reserve models.PlatformReserve
	if err := config.DB.First(&reserve, 1).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusOK, gin.H{
				"ec_available":      0,
				"total_ec_issued":   0,
				"total_ec_burned":   0,
				"month_ec_issued":   0,
				"month_ec_burned":   0,
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not retrieve reserve"})
		return
	}

	// Compute this month's figures from source tables.
	now := time.Now()
	startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())

	var monthMinted, monthBurned, monthPurchased float64
	if err := config.DB.Model(&models.EnergyLog{}).
		Where("created_at >= ?", startOfMonth).
		Select("COALESCE(SUM(ec_minted), 0)").Scan(&monthMinted).Error; err != nil {
		monthMinted = 0
	}
	if err := config.DB.Model(&models.EnergyLog{}).
		Where("created_at >= ?", startOfMonth).
		Select("COALESCE(SUM(fee_burned), 0)").Scan(&monthBurned).Error; err != nil {
		monthBurned = 0
	}
	if err := config.DB.Model(&models.EcPurchase{}).
		Where("created_at >= ?", startOfMonth).
		Select("COALESCE(SUM(ec_amount), 0)").Scan(&monthPurchased).Error; err != nil {
		monthPurchased = 0
	}

	c.JSON(http.StatusOK, gin.H{
		"ec_available":    reserve.EcAvailable,
		"total_ec_issued": reserve.TotalEcIssued,
		"total_ec_burned": reserve.TotalEcBurned,
		"month_ec_issued": roundTo(monthMinted+monthPurchased, 6),
		"month_ec_burned": roundTo(monthBurned, 6),
	})
}
