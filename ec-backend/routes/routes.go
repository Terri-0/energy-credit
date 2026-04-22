package routes

import (
	"energy-credit/backend/handlers"
	"energy-credit/backend/middleware"

	"github.com/gin-gonic/gin"
)

func Register(r *gin.Engine) {
	api := r.Group("/api")

	// Public routes — no token needed
	auth := api.Group("/auth")
	{
		auth.POST("/register", handlers.Register)
		auth.POST("/login", handlers.Login)
	}

	// Protected routes — JWT required
	protected := api.Group("/")
	protected.Use(middleware.AuthRequired())
	{
		// Panels
		protected.POST("panels/register", handlers.RegisterPanel)
		protected.GET("panels", handlers.GetPanels)

		// Energy
		protected.POST("energy/log", handlers.LogEnergy)
		protected.GET("energy/batches", handlers.GetBatches)
		protected.POST("energy/batches/:id/mint", handlers.MintBatch)

		// Listings
		protected.POST("listings", handlers.CreateListing)
		protected.GET("listings", handlers.GetListings)
		protected.POST("listings/:id/buy", handlers.BuyListing)
		protected.DELETE("listings/:id", handlers.CancelListing)

		// Economy
		protected.POST("economy/offset", handlers.OffsetBatch)
		protected.GET("economy/offsets", handlers.GetOffsets)
		protected.POST("economy/buy-ec", handlers.BuyEC)
		protected.GET("economy/reserve", handlers.GetReserve)
	}
}
