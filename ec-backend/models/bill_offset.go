package models

import "time"

type BillOffset struct {
	ID           uint `gorm:"primaryKey;autoIncrement"`
	UserID       uint
	User         User `gorm:"foreignKey:UserID"`
	BatchID      uint
	Batch        WhBatch `gorm:"foreignKey:BatchID"`
	WhAmount     float64
	EcEquivalent float64
	CreatedAt    time.Time
}
