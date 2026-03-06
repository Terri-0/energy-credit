package models

import "time"

type Panel struct {
	ID           uint `gorm:"primaryKey;autoIncrement"`
	UserID       uint
	User         User `gorm:"foreignKey:UserID"`
	Name         string
	CapacityWh   float64
	IsActive     bool `gorm:"default:true"`
	RegisteredAt time.Time
}
