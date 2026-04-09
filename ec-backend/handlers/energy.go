package handlers

import (
	"fmt"
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

	// Verify panel belongs to this user and is active.
	var panel models.Panel
	if err := config.DB.Where("id = ? AND user_id = ? AND is_active = true",
		input.PanelID, userID).First(&panel).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "panel not found or not yours"})
		return
	}

	whAmount := roundTo(input.WhAmount, 6)

	// Enforce accumulated generation ceiling (simulation: panel generates capacity_wh per 24h).
	avail := accumulatedWh(panel, time.Now())
	if avail <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "panel has not generated any energy yet — check back later",
		})
		return
	}
	if whAmount > avail {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": fmt.Sprintf("panel has only accumulated %.2f Wh since last log", avail),
		})
		return
	}

	var energyLog models.EnergyLog
	var batch models.WhBatch
	txErr := config.DB.Transaction(func(tx *gorm.DB) error {
		now := time.Now()

		// Stamp last_logged_at on the panel so accumulation resets.
		if err := tx.Model(&models.Panel{}).Where("id = ?", input.PanelID).
			Update("last_logged_at", now).Error; err != nil {
			return err
		}

		energyLog = models.EnergyLog{
			UserID:   userID,
			PanelID:  input.PanelID,
			WhAmount: whAmount,
			// EcMinted and FeeBurned remain 0 until the batch is explicitly minted.
		}
		if err := tx.Create(&energyLog).Error; err != nil {
			return err
		}

		batch = models.WhBatch{
			UserID:      userID,
			EnergyLogID: energyLog.ID,
			WhRemaining: whAmount,
			Status:      batchStatusAvailable,
			CreatedAt:   now,
			ExpiresAt:   now.Add(30 * 24 * time.Hour),
		}
		if err := tx.Create(&batch).Error; err != nil {
			return err
		}

		return nil
	})
	if txErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not log energy"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"energy_log": energyLog,
		"batch":      batch,
		"message":    "Energy logged. Mint to EC, list on the marketplace, or apply to bill offset.",
	})
}

