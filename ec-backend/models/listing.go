package models

import "time"

// Status values: open, filled, cancelled, expired
type Listing struct {
	ID        uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	SellerID  uint      `gorm:"index:idx_listings_seller_status,priority:1" json:"seller_id"`
	Seller    User      `gorm:"foreignKey:SellerID" json:"-"`
	BatchID   uint      `gorm:"index:idx_listings_batch_id" json:"batch_id"`
	Batch     WhBatch   `gorm:"foreignKey:BatchID" json:"-"`
	WhAmount  float64   `gorm:"type:numeric(18,6);check:ck_listings_wh_amount_positive,wh_amount > 0" json:"wh_amount"`
	EcPrice   float64   `gorm:"type:numeric(18,6);check:ck_listings_ec_price_positive,ec_price > 0" json:"ec_price"`
	Status    string    `gorm:"default:open;index:idx_listings_seller_status,priority:2;index:idx_listings_status_expires,priority:1" json:"status"`
	CreatedAt time.Time `json:"created_at"`
	ExpiresAt time.Time `gorm:"index:idx_listings_status_expires,priority:2" json:"expires_at"`
}
