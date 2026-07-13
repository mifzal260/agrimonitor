from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.alert import Alert
from app.models.activity import Activity
from app.models.harvest import Harvest
from app.models.market_price import MarketPrice
from app.models.planting_record import PlantingRecord
from app.schemas.dashboard import DashboardSummary, PricePoint, StatusCount


def get_dashboard_summary(db: Session, user_id: int) -> DashboardSummary:
    total_records = db.scalar(
        select(func.count()).select_from(PlantingRecord).where(PlantingRecord.user_id == user_id)
    ) or 0

    status_rows = db.execute(
        select(PlantingRecord.status, func.count())
        .where(PlantingRecord.user_id == user_id)
        .group_by(PlantingRecord.status)
    ).all()
    crop_status = [StatusCount(status=row[0], count=row[1]) for row in status_rows]

    high_risk_alerts = db.scalar(
        select(func.count()).select_from(Alert).where(Alert.user_id == user_id, Alert.risk_level == "high", Alert.is_read.is_(False))
    ) or 0

    activity_cost = func.coalesce(Activity.cost_amount, 0) + func.coalesce(Activity.labor_cost_amount, 0)
    total_cost = db.scalar(
        select(func.coalesce(func.sum(activity_cost), 0)).where(Activity.user_id == user_id)
    ) or Decimal("0")
    total_revenue = db.scalar(select(func.coalesce(func.sum(Harvest.revenue), 0)).where(Harvest.user_id == user_id)) or Decimal("0")
    profit_loss = Decimal(total_revenue) - Decimal(total_cost)

    market_price_rows = db.scalars(
        select(MarketPrice).order_by(MarketPrice.recorded_date.desc(), MarketPrice.commodity_name).limit(12)
    ).all()
    price_trend = [
        PricePoint(
            recorded_date=row.recorded_date.isoformat(),
            commodity_name=row.commodity_name,
            price=row.price,
        )
        for row in reversed(market_price_rows)
    ]

    latest_market_prices = len({(row.commodity_name, row.location, row.price_type) for row in market_price_rows})

    return DashboardSummary(
        total_planting_records=total_records,
        crop_status=crop_status,
        high_risk_alerts=high_risk_alerts,
        latest_market_prices=latest_market_prices,
        total_cost=Decimal(total_cost),
        total_revenue=Decimal(total_revenue),
        profit_loss=profit_loss,
        price_trend=price_trend,
    )
