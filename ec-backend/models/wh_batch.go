package models

import "time"

// Status values: available, reserved, listed, offset, expired
// WarningLevel values: "", "amber", "red"
type WhBatch struct {
	ID           uint `gorm:"primaryKey;autoIncrement"`
	UserID       uint
	User         User `gorm:"foreignKey:UserID"`
	EnergyLogID  uint
	EnergyLog    EnergyLog `gorm:"foreignKey:EnergyLogID"`
	WhRemaining  float64
	Status       string `gorm:"default:available"`
	WarningLevel string `gorm:"default:''"`
	LastWarnedAt *time.Time
	CreatedAt    time.Time
	ExpiresAt    time.Time
}
