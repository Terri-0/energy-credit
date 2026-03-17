package models

import "time"

type BillOffset struct {
	ID           uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID       uint      `json:"user_id"`
	User         User      `gorm:"foreignKey:UserID" json:"-"`
	BatchID      uint      `json:"batch_id"`
	Batch        WhBatch   `gorm:"foreignKey:BatchID" json:"-"`
	WhAmount     float64   `json:"wh_amount"`
	EcEquivalent float64   `json:"ec_equivalent"`
	CreatedAt    time.Time `json:"created_at"`
}
