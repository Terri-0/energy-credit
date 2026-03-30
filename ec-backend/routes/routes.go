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

		// Energy
		protected.POST("energy/log", handlers.LogEnergy)
		protected.GET("energy/batches", handlers.GetBatches)

		// Listings
		protected.POST("listings", handlers.CreateListing)
		protected.GET("listings", handlers.GetListings)
		protected.POST("listings/:id/buy", handlers.BuyListing)
		protected.DELETE("listings/:id", handlers.CancelListing)

		// Phase 5 — EC economy handlers go here
	}
}
