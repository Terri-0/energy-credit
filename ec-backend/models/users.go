package models

import "time"

type User struct {
	ID           uint `gorm:"primaryKey;autoIncrement"`
	Name         string
	Email        string `gorm:"uniqueIndex"`
	PasswordHash string
	ECBalance    float64 `gorm:"default:50"`
	HasPanels    bool    `gorm:"default:false"`
	CreatedAt    time.Time
}
