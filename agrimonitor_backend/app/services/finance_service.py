from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.cost import Cost
from app.models.harvest import Harvest
from app.schemas.finance import CostCreate, CostUpdate, HarvestCreate, HarvestUpdate, ProfitLossSummary
from app.services.monitoring_service import get_owned_planting_record


def calculate_revenue(quantity: Decimal, selling_price_per_unit: Decimal) -> Decimal:
    return quantity * selling_price_per_unit


def get_owned_cost(db: Session, cost_id: int, user_id: int) -> Cost:
    cost = db.scalar(select(Cost).where(Cost.id == cost_id, Cost.user_id == user_id))
    if cost is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cost not found")
    return cost


def get_owned_harvest(db: Session, harvest_id: int, user_id: int) -> Harvest:
    harvest = db.scalar(select(Harvest).where(Harvest.id == harvest_id, Harvest.user_id == user_id))
    if harvest is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Harvest not found")
    return harvest


def create_cost(db: Session, user_id: int, payload: CostCreate) -> Cost:
    get_owned_planting_record(db, payload.planting_record_id, user_id)
    cost = Cost(user_id=user_id, **payload.model_dump())
    db.add(cost)
    db.commit()
    db.refresh(cost)
    return cost


def update_cost(db: Session, cost: Cost, payload: CostUpdate) -> Cost:
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(cost, key, value)
    db.commit()
    db.refresh(cost)
    return cost


def create_harvest(db: Session, user_id: int, payload: HarvestCreate) -> Harvest:
    get_owned_planting_record(db, payload.planting_record_id, user_id)
    data = payload.model_dump()
    harvest = Harvest(user_id=user_id, revenue=calculate_revenue(payload.quantity, payload.selling_price_per_unit), **data)
    db.add(harvest)
    db.commit()
    db.refresh(harvest)
    return harvest


def update_harvest(db: Session, harvest: Harvest, payload: HarvestUpdate) -> Harvest:
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(harvest, key, value)
    harvest.revenue = calculate_revenue(harvest.quantity, harvest.selling_price_per_unit)
    db.commit()
    db.refresh(harvest)
    return harvest


def list_costs(db: Session, user_id: int) -> list[Cost]:
    return list(db.scalars(select(Cost).where(Cost.user_id == user_id).order_by(Cost.cost_date.desc())).all())


def list_harvests(db: Session, user_id: int) -> list[Harvest]:
    return list(db.scalars(select(Harvest).where(Harvest.user_id == user_id).order_by(Harvest.harvest_date.desc())).all())


def get_profit_loss_summary(db: Session, user_id: int) -> ProfitLossSummary:
    total_cost = db.scalar(select(func.coalesce(func.sum(Cost.amount), 0)).where(Cost.user_id == user_id)) or Decimal("0")
    total_revenue = db.scalar(select(func.coalesce(func.sum(Harvest.revenue), 0)).where(Harvest.user_id == user_id)) or Decimal("0")
    total_cost = Decimal(total_cost)
    total_revenue = Decimal(total_revenue)
    return ProfitLossSummary(total_cost=total_cost, total_revenue=total_revenue, profit_loss=total_revenue - total_cost)