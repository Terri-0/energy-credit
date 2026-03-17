package models

import "time"

type EcPurchase struct {
	ID         uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID     uint      `json:"user_id"`
	User       User      `gorm:"foreignKey:UserID" json:"-"`
	EcAmount   float64   `json:"ec_amount"`
	FiatAmount float64   `json:"fiat_amount"`
	RateUsed   float64   `json:"rate_used"`
	CreatedAt  time.Time `json:"created_at"`
}
