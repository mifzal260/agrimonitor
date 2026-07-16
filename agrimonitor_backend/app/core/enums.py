from typing import Literal

PlantingStatus = Literal["healthy", "watch", "risk", "harvested"]
SymptomSeverity = Literal["low", "medium", "high"]
SymptomRecordStatus = Literal["active", "monitoring", "resolved"]
PriceType = Literal["farm", "wholesale", "retail"]
PriceTrend = Literal["up", "down", "stable"]

VALID_PRICE_TYPES = {"farm", "wholesale", "retail"}
VALID_PRICE_TRENDS = {"up", "down", "stable"}
