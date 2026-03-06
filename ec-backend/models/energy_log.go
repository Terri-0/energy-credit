package models

import "time"

type EnergyLog struct {
	ID        uint `gorm:"primaryKey;autoIncrement"`
	UserID    uint
	User      User `gorm:"foreignKey:UserID"`
	PanelID   uint
	Panel     Panel `gorm:"foreignKey:PanelID"`
	WhAmount  float64
	EcMinted  float64
	FeeBurned float64
	CreatedAt time.Time
}
