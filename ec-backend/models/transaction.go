package models

import "time"

type Transaction struct {
	ID        uint `gorm:"primaryKey;autoIncrement"`
	BuyerID   uint
	Buyer     User `gorm:"foreignKey:BuyerID"`
	SellerID  uint
	Seller    User `gorm:"foreignKey:SellerID"`
	ListingID uint
	Listing   Listing `gorm:"foreignKey:ListingID"`
	WhAmount  float64
	EcAmount  float64
	CreatedAt time.Time
}
