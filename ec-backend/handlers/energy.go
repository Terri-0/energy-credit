package handlers

import (
	"net/http"
	"time"

	"energy-credit/backend/config"
	"energy-credit/backend/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type LogEnergyInput struct {
	PanelID  uint    `json:"panel_id"  binding:"required"`
	WhAmount float64 `json:"wh_amount" binding:"required,gt=0"`
}

func LogEnergy(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		return
	}

	var input LogEnergyInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Verify panel belongs to this user and is active
	var panel models.Panel
	if err := config.DB.Where("id = ? AND user_id = ? AND is_active = true",
		input.PanelID, userID).First(&panel).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "panel not found or not yours"})
		return
	}

	// Calculate EC minting
	mintRate, err := getEnvFloat("EC_MINT_RATE", 0.05)
	if err != nil || mintRate <= 0 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid EC_MINT_RATE configuration"})
		return
	}

	mintFee, err := getEnvFloat("EC_MINT_FEE", 0.06)
	if err != nil || mintFee < 0 || mintFee >= 1 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid EC_MINT_FEE configuration"})
		return
	}

	whAmount := roundTo(input.WhAmount, 6)
	ecGross := roundTo(whAmount*mintRate, 6)
	ecFee := roundTo(ecGross*mintFee, 6)
	ecMinted := roundTo(ecGross-ecFee, 6)

	tx := config.DB.Begin()
	if tx.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not start transaction"})
		return
	}

	// 1. Create energy log
	energyLog := models.EnergyLog{
		UserID:    userID,
		PanelID:   input.PanelID,
		WhAmount:  whAmount,
		EcMinted:  ecMinted,
		FeeBurned: ecFee,
	}
	if err := tx.Create(&energyLog).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create energy log"})
		return
	}

	// 2. Create Wh batch (expires in 30 days)
	now := time.Now()
	batch := models.WhBatch{
		UserID:      userID,
		EnergyLogID: energyLog.ID,
		WhRemaining: whAmount,
		Status:      "available",
		CreatedAt:   now,
		ExpiresAt:   now.Add(30 * 24 * time.Hour),
	}
	if err := tx.Create(&batch).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create Wh batch"})
		return
	}

	// 3. Add EC to user balance
	userUpdate := tx.Model(&models.User{}).
		Where("id = ?", userID).
		UpdateColumn("ec_balance", gorm.Expr("ec_balance + ?", ecMinted))
	if userUpdate.Error != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update EC balance"})
		return
	}
	if userUpdate.RowsAffected != 1 {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update EC balance"})
		return
	}

	// Ensure singleton reserve row exists.
	reserve := models.PlatformReserve{ID: 1}
	if err := tx.Where("id = ?", 1).FirstOrCreate(&reserve, models.PlatformReserve{ID: 1}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not initialize platform reserve"})
		return
	}

	// 4. Add fee to platform reserve
	reserveUpdate := tx.Model(&models.PlatformReserve{}).
		Where("id = 1").
		Updates(map[string]interface{}{
			"ec_available":    gorm.Expr("ec_available + ?", ecFee),
			"total_ec_issued": gorm.Expr("total_ec_issued + ?", ecMinted),
			"total_ec_burned": gorm.Expr("total_ec_burned + ?", ecFee),
		})
	if reserveUpdate.Error != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update platform reserve"})
		return
	}
	if reserveUpdate.RowsAffected != 1 {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update platform reserve"})
		return
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not finalize transaction"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"energy_log": energyLog,
		"batch":      batch,
		"ec_minted":  ecMinted,
		"ec_fee":     ecFee,
		"message":    "Energy logged and EC minted successfully",
	})
}
