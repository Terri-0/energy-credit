package models

import "time"

type EcPurchase struct {
	ID         uint `gorm:"primaryKey;autoIncrement"`
	UserID     uint
	User       User `gorm:"foreignKey:UserID"`
	EcAmount   float64
	FiatAmount float64
	RateUsed   float64
	CreatedAt  time.Time
}
