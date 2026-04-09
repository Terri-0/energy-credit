package handlers

import (
	"net/http"
	"time"

	"energy-credit/backend/config"
	"energy-credit/backend/models"

	"github.com/gin-gonic/gin"
)

type panelResponse struct {
	models.Panel
	AccumulatedWh float64 `json:"accumulated_wh"`
}

// simPeriod returns the configured simulation period (SIM_PERIOD_SECONDS env var,
// default 120s). Panels accumulate their full capacity over this duration.
func simPeriod() time.Duration {
	return time.Duration(getEnvInt("SIM_PERIOD_SECONDS", 120)) * time.Second
}

func accumulatedWh(p models.Panel, now time.Time) float64 {
	baseline := p.RegisteredAt
	if p.LastLoggedAt != nil {
		baseline = *p.LastLoggedAt
	}
	period := simPeriod()
	elapsed := now.Sub(baseline)
	if elapsed > period {
		elapsed = period
	}
	if elapsed < 0 {
		return 0
	}
	return roundTo((elapsed.Seconds()/period.Seconds())*p.CapacityWh, 6)
}

func GetPanels(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		return
	}

	var panels []models.Panel
	if err := config.DB.Where("user_id = ? AND is_active = true", userID).
		Find(&panels).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not retrieve panels"})
		return
	}

	now := time.Now()
	result := make([]panelResponse, len(panels))
	for i, p := range panels {
		result[i] = panelResponse{Panel: p, AccumulatedWh: accumulatedWh(p, now)}
	}

	c.JSON(http.StatusOK, gin.H{"panels": result})
}

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
