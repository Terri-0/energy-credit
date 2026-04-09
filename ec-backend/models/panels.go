package models

import "time"

type Panel struct {
	ID           uint       `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID       uint       `json:"user_id"`
	User         User       `gorm:"foreignKey:UserID" json:"-"`
	Name         string     `json:"name"`
	CapacityWh   float64    `json:"capacity_wh"`
	IsActive     bool       `gorm:"default:true" json:"is_active"`
	RegisteredAt time.Time  `json:"registered_at"`
	LastLoggedAt *time.Time `json:"last_logged_at"`
}
