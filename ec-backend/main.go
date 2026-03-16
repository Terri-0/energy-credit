package main

import (
	"fmt"
	"log"
	"os"

	"energy-credit/backend/config"
	"energy-credit/backend/routes"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(".env"); err != nil {
		if err := godotenv.Load("../.env"); err != nil {
			log.Printf("warning: could not load .env: %v", err)
		}
	}

	config.ConnectDB()

	r := gin.Default()
	routes.Register(r)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("Server running on :%s\n", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatal(err)
	}
}
