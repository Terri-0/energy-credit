package models

import "time"

// Status values: available, reserved, listed, offset, expired
// WarningLevel values: "", "amber", "red"
type WhBatch struct {
	ID           uint       `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID       uint       `json:"user_id"`
	User         User       `gorm:"foreignKey:UserID" json:"-"`
	EnergyLogID  uint       `json:"energy_log_id"`
	EnergyLog    EnergyLog  `gorm:"foreignKey:EnergyLogID" json:"-"`
	WhRemaining  float64    `json:"wh_remaining"`
	Status       string     `gorm:"default:available" json:"status"`
	WarningLevel string     `gorm:"default:''" json:"warning_level"`
	LastWarnedAt *time.Time `json:"last_warned_at"`
	CreatedAt    time.Time  `json:"created_at"`
	ExpiresAt    time.Time  `json:"expires_at"`
}
