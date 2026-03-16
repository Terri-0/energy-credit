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
		// Phase 3 — energy handlers go here
		// Phase 4 — marketplace handlers go here
		// Phase 5 — EC economy handlers go here
	}
}
