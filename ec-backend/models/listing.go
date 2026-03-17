package models

import "time"

// Status values: open, filled, cancelled, expired
type Listing struct {
	ID        uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	SellerID  uint      `json:"seller_id"`
	Seller    User      `gorm:"foreignKey:SellerID" json:"-"`
	BatchID   uint      `json:"batch_id"`
	Batch     WhBatch   `gorm:"foreignKey:BatchID" json:"-"`
	WhAmount  float64   `json:"wh_amount"`
	EcPrice   float64   `json:"ec_price"`
	Status    string    `gorm:"default:open" json:"status"`
	CreatedAt time.Time `json:"created_at"`
	ExpiresAt time.Time `json:"expires_at"`
}
