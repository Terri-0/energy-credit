package handlers

import (
	"net/http"
	"strconv"
	"time"

	"energy-credit/backend/config"
	"energy-credit/backend/models"

	"github.com/gin-gonic/gin"
)

type listingResponse struct {
	models.Listing
	SellerName string `json:"seller_name"`
}

func GetListings(c *gin.Context) {
	_, ok := getUserID(c)
	if !ok {
		return
	}

	const defaultLimit = 50
	const maxLimit = 200

	limit := defaultLimit
	offset := 0

	if raw := c.Query("limit"); raw != "" {
		v, err := strconv.Atoi(raw)
		if err != nil || v <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid limit"})
			return
		}
		limit = min(v, maxLimit)
	}
	if raw := c.Query("offset"); raw != "" {
		v, err := strconv.Atoi(raw)
		if err != nil || v < 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid offset"})
			return
		}
		offset = v
	}

	var listings []models.Listing
	if err := config.DB.
		Preload("Seller").
		Where("status = ? AND expires_at > ?", listingStatusOpen, time.Now()).
		Order("created_at desc").
		Limit(limit).
		Offset(offset).
		Find(&listings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not retrieve listings"})
		return
	}

	result := make([]listingResponse, len(listings))
	for i, l := range listings {
		name := l.Seller.Name
		if name == "" {
			name = "Unknown"
		}
		result[i] = listingResponse{Listing: l, SellerName: name}
	}

	c.JSON(http.StatusOK, gin.H{"listings": result})
}
