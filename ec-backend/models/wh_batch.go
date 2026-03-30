package models

import "time"

// Status values: available, reserved, listed, offset, expired
// WarningLevel values: "", "amber", "red"
type WhBatch struct {
	ID           uint       `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID       uint       `gorm:"index:idx_wh_batches_user_status,priority:1" json:"user_id"`
	User         User       `gorm:"foreignKey:UserID" json:"-"`
	EnergyLogID  uint       `json:"energy_log_id"`
	EnergyLog    EnergyLog  `gorm:"foreignKey:EnergyLogID" json:"-"`
	WhRemaining  float64    `gorm:"type:numeric(18,6);check:ck_wh_batches_wh_remaining_non_negative,wh_remaining >= 0" json:"wh_remaining"`
	Status       string     `gorm:"default:available;index:idx_wh_batches_user_status,priority:2;index:idx_wh_batches_status_expires,priority:1" json:"status"`
	WarningLevel string     `gorm:"default:''" json:"warning_level"`
	LastWarnedAt *time.Time `json:"last_warned_at"`
	CreatedAt    time.Time  `json:"created_at"`
	ExpiresAt    time.Time  `gorm:"index:idx_wh_batches_status_expires,priority:2" json:"expires_at"`
}
