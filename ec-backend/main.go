package main

import (
	"energy-credit/backend/config"
	"fmt"
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load("../.env"); err != nil {
		log.Printf("warning: could not load ../.env: %v", err)
	}
	fmt.Println("DB_URL:", os.Getenv("DB_URL"))

	config.ConnectDB()

	r := gin.Default()

	if err := r.Run(":8080"); err != nil {
		log.Fatal(err)
	}
}
