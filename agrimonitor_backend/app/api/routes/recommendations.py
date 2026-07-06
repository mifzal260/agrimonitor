from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.recommendation import AlertRead, RecommendationResult
from app.services.recommendation_service import evaluate_planting_record, list_user_alerts

router = APIRouter()


@router.post("/planting-records/{planting_record_id}/evaluate", response_model=RecommendationResult)
def evaluate_record(
    planting_record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RecommendationResult:
    return evaluate_planting_record(db, planting_record_id, current_user.id)


@router.get("/alerts", response_model=list[AlertRead])
def read_alerts(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return list_user_alerts(db, current_user.id)