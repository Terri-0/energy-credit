package models

import "time"

type EnergyLog struct {
	ID        uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID    uint      `json:"user_id"`
	User      User      `gorm:"foreignKey:UserID" json:"-"`
	PanelID   uint      `json:"panel_id"`
	Panel     Panel     `gorm:"foreignKey:PanelID" json:"-"`
	WhAmount  float64   `json:"wh_amount"`
	EcMinted  float64   `json:"ec_minted"`
	FeeBurned float64   `json:"fee_burned"`
	CreatedAt time.Time `json:"created_at"`
}
