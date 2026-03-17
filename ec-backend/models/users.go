package models

import "time"

type User struct {
	ID           uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	Name         string    `json:"name"`
	Email        string    `gorm:"uniqueIndex" json:"email"`
	PasswordHash string    `json:"-"`
	ECBalance    float64   `gorm:"default:50" json:"ec_balance"`
	HasPanels    bool      `gorm:"default:false" json:"has_panels"`
	CreatedAt    time.Time `json:"created_at"`
}
