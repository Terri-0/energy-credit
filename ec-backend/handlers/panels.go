package handlers

import (
	"net/http"
	"time"

	"energy-credit/backend/config"
	"energy-credit/backend/models"

	"github.com/gin-gonic/gin"
)

type RegisterPanelInput struct {
	Name       string  `json:"name"        binding:"required"`
	CapacityWh float64 `json:"capacity_wh" binding:"required,gt=0"`
}

func RegisterPanel(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		return
	}

	var input RegisterPanelInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	panel := models.Panel{
		UserID:       userID,
		Name:         input.Name,
		CapacityWh:   input.CapacityWh,
		RegisteredAt: time.Now(),
	}

	tx := config.DB.Begin()
	if tx.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not start transaction"})
		return
	}

	if err := tx.Create(&panel).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not register panel"})
		return
	}

	userUpdate := tx.Model(&models.User{}).
		Where("id = ?", userID).
		Update("has_panels", true)
	if userUpdate.Error != nil || userUpdate.RowsAffected != 1 {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update user"})
		return
	}

	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not complete panel registration"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"panel": panel})
}
