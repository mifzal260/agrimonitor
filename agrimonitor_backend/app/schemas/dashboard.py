from decimal import Decimal

from pydantic import BaseModel


class StatusCount(BaseModel):
    status: str
    count: int


class PricePoint(BaseModel):
    recorded_date: str
    commodity_name: str
    price: Decimal


class DashboardSummary(BaseModel):
    total_planting_records: int
    crop_status: list[StatusCount]
    high_risk_alerts: int
    latest_market_prices: int
    total_cost: Decimal
    total_revenue: Decimal
    profit_loss: Decimal
    price_trend: list[PricePoint]