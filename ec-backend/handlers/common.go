package handlers

import (
	"math"
	"net/http"
	"os"
	"strconv"

	"github.com/gin-gonic/gin"
)

func getUserID(c *gin.Context) (uint, bool) {
	rawUserID, ok := c.Get("userID")
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return 0, false
	}

	userID, ok := rawUserID.(uint)
	if !ok || userID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return 0, false
	}

	return userID, true
}

func getEnvFloat(name string, defaultValue float64) (float64, error) {
	raw := os.Getenv(name)
	if raw == "" {
		return defaultValue, nil
	}

	value, err := strconv.ParseFloat(raw, 64)
	if err != nil {
		return 0, err
	}

	return value, nil
}

func roundTo(value float64, decimals int) float64 {
	multiplier := math.Pow(10, float64(decimals))
	return math.Round(value*multiplier) / multiplier
}
