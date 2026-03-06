package models

import "time"

type PlatformReserve struct {
	ID            uint    `gorm:"primaryKey;autoIncrement"`
	EcAvailable   float64 `gorm:"default:0"`
	TotalEcIssued float64 `gorm:"default:0"`
	TotalEcBurned float64 `gorm:"default:0"`
	UpdatedAt     time.Time
}
