from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.cost import Cost
from app.models.harvest import Harvest
from app.models.user import User
from app.schemas.finance import CostCreate, CostRead, CostUpdate, HarvestCreate, HarvestRead, HarvestUpdate, ProfitLossSummary
from app.services.finance_service import create_cost, create_harvest, get_owned_cost, get_owned_harvest, get_profit_loss_summary, list_costs, list_harvests, update_cost, update_harvest

router = APIRouter()


@router.get("/summary", response_model=ProfitLossSummary)
def read_finance_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> ProfitLossSummary:
    return get_profit_loss_summary(db, current_user.id)


@router.post("/costs", response_model=CostRead, status_code=201)
def create_cost_record(payload: CostCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Cost:
    return create_cost(db, current_user.id, payload)


@router.get("/costs", response_model=list[CostRead])
def read_costs(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[Cost]:
    return list_costs(db, current_user.id)


@router.patch("/costs/{cost_id}", response_model=CostRead)
def update_cost_record(cost_id: int, payload: CostUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Cost:
    cost = get_owned_cost(db, cost_id, current_user.id)
    return update_cost(db, cost, payload)


@router.delete("/costs/{cost_id}", status_code=204)
def delete_cost_record(cost_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Response:
    cost = get_owned_cost(db, cost_id, current_user.id)
    db.delete(cost)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/harvests", response_model=HarvestRead, status_code=201)
def create_harvest_record(payload: HarvestCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Harvest:
    return create_harvest(db, current_user.id, payload)


@router.get("/harvests", response_model=list[HarvestRead])
def read_harvests(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[Harvest]:
    return list_harvests(db, current_user.id)


@router.patch("/harvests/{harvest_id}", response_model=HarvestRead)
def update_harvest_record(harvest_id: int, payload: HarvestUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Harvest:
    harvest = get_owned_harvest(db, harvest_id, current_user.id)
    return update_harvest(db, harvest, payload)


@router.delete("/harvests/{harvest_id}", status_code=204)
def delete_harvest_record(harvest_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Response:
    harvest = get_owned_harvest(db, harvest_id, current_user.id)
    db.delete(harvest)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)