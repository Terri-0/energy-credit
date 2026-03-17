package models

import "time"

type Transaction struct {
	ID        uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	BuyerID   uint      `json:"buyer_id"`
	Buyer     User      `gorm:"foreignKey:BuyerID" json:"-"`
	SellerID  uint      `json:"seller_id"`
	Seller    User      `gorm:"foreignKey:SellerID" json:"-"`
	ListingID uint      `json:"listing_id"`
	Listing   Listing   `gorm:"foreignKey:ListingID" json:"-"`
	WhAmount  float64   `json:"wh_amount"`
	EcAmount  float64   `json:"ec_amount"`
	CreatedAt time.Time `json:"created_at"`
}
