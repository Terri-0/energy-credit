package models

import "time"

type PlatformReserve struct {
	ID            uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	EcAvailable   float64   `gorm:"default:0" json:"ec_available"`
	TotalEcIssued float64   `gorm:"default:0" json:"total_ec_issued"`
	TotalEcBurned float64   `gorm:"default:0" json:"total_ec_burned"`
	UpdatedAt     time.Time `json:"updated_at"`
}
