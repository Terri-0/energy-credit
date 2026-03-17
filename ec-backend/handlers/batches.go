package handlers

import (
	"net/http"
	"strconv"
	"time"

	"energy-credit/backend/config"
	"energy-credit/backend/models"

	"github.com/gin-gonic/gin"
)

func GetBatches(c *gin.Context) {
	userID, ok := getUserID(c)
	if !ok {
		return
	}

	limit := 50
	if rawLimit := c.Query("limit"); rawLimit != "" {
		parsedLimit, err := strconv.Atoi(rawLimit)
		if err != nil || parsedLimit <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid limit"})
			return
		}
		if parsedLimit > 200 {
			parsedLimit = 200
		}
		limit = parsedLimit
	}

	offset := 0
	if rawOffset := c.Query("offset"); rawOffset != "" {
		parsedOffset, err := strconv.Atoi(rawOffset)
		if err != nil || parsedOffset < 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid offset"})
			return
		}
		offset = parsedOffset
	}

	var batches []models.WhBatch
	if err := config.DB.Where("user_id = ?", userID).
		Order("created_at desc").
		Limit(limit).
		Offset(offset).
		Find(&batches).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch batches"})
		return
	}

	now := time.Now()
	for i := range batches {
		hoursUntilExpiry := batches[i].ExpiresAt.Sub(now).Hours()
		if hoursUntilExpiry <= 72 {
			batches[i].WarningLevel = "red"
		} else if hoursUntilExpiry <= 240 {
			batches[i].WarningLevel = "amber"
		} else {
			batches[i].WarningLevel = ""
		}
	}

	c.JSON(http.StatusOK, gin.H{"batches": batches})
}
