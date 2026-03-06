package config

import (
	"energy-credit/backend/models"
	"log"
	"os"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

func ConnectDB() {
	dsn := os.Getenv("DB_URL")
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	DB = db

	err = DB.AutoMigrate(
		&models.User{},
		&models.Panel{},
		&models.EnergyLog{},
		&models.WhBatch{},
		&models.Listing{},
		&models.Transaction{},
		&models.EcPurchase{},
		&models.BillOffset{},
		&models.PlatformReserve{},
	)
	if err != nil {
		log.Fatal("Failed to auto-migrate:", err)
	}
	log.Println("Database connected and migrated succesfully")
}
