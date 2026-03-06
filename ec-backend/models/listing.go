package models

import "time"

// Status values: open, filled, cancelled, expired
type Listing struct {
	ID        uint `gorm:"primaryKey;autoIncrement"`
	SellerID  uint
	Seller    User `gorm:"foreignKey:SellerID"`
	BatchID   uint
	Batch     WhBatch `gorm:"foreignKey:BatchID"`
	WhAmount  float64
	EcPrice   float64
	Status    string `gorm:"default:open"`
	CreatedAt time.Time
	ExpiresAt time.Time
}
