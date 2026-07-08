from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.activity import Activity
from app.models.crop import Crop
from app.models.planting_record import PlantingRecord
from app.models.symptom import Symptom
from app.models.symptom_record import SymptomRecord
from app.models.user import User
from app.schemas.monitoring import ActivityCreate, ActivityRead, ActivityUpdate, CropRead, PlantingRecordCreate, PlantingRecordRead, PlantingRecordUpdate, SymptomRead, SymptomRecordCreate, SymptomRecordRead, SymptomRecordUpdate
from app.services.monitoring_service import calculate_plant_age_days, create_activity, create_planting_record, create_symptom_record, delete_planting_record, get_owned_activity, get_owned_planting_record, get_owned_symptom_record, update_activity, update_planting_record, sync_planting_record_status_from_symptoms, update_symptom_record

router = APIRouter()


def to_planting_record_read(record: PlantingRecord) -> PlantingRecordRead:
    return PlantingRecordRead(
        id=record.id,
        user_id=record.user_id,
        crop_id=record.crop_id,
        field_name=record.field_name,
        planting_date=record.planting_date,
        area_size=record.area_size,
        status=record.status,
        notes=record.notes,
        crop=record.crop,
        plant_age_days=calculate_plant_age_days(record.planting_date),
    )


@router.get("/crops", response_model=list[CropRead])
def list_crops(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[Crop]:
    return list(db.scalars(select(Crop).order_by(Crop.name)).all())


@router.get("/symptoms", response_model=list[SymptomRead])
def list_symptoms(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[Symptom]:
    return list(db.scalars(select(Symptom).order_by(Symptom.name)).all())


@router.post("/planting-records", response_model=PlantingRecordRead, status_code=201)
def create_record(payload: PlantingRecordCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> PlantingRecordRead:
    record = create_planting_record(db, current_user.id, payload)
    return to_planting_record_read(record)


@router.get("/planting-records", response_model=list[PlantingRecordRead])
def list_records(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[PlantingRecordRead]:
    records = db.scalars(
        select(PlantingRecord)
        .options(selectinload(PlantingRecord.crop))
        .where(PlantingRecord.user_id == current_user.id)
        .order_by(PlantingRecord.planting_date.desc())
    ).all()
    return [to_planting_record_read(record) for record in records]


@router.get("/planting-records/{record_id}", response_model=PlantingRecordRead)
def read_record(record_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> PlantingRecordRead:
    record = get_owned_planting_record(db, record_id, current_user.id)
    return to_planting_record_read(record)


@router.patch("/planting-records/{record_id}", response_model=PlantingRecordRead)
def update_record(record_id: int, payload: PlantingRecordUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> PlantingRecordRead:
    record = get_owned_planting_record(db, record_id, current_user.id)
    updated = update_planting_record(db, record, payload)
    return to_planting_record_read(updated)


@router.delete("/planting-records/{record_id}", status_code=204)
def delete_record(record_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Response:
    record = get_owned_planting_record(db, record_id, current_user.id)
    db.delete(record)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/activities", response_model=ActivityRead, status_code=201)
def create_farm_activity(payload: ActivityCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Activity:
    return create_activity(db, current_user.id, payload)


@router.get("/activities", response_model=list[ActivityRead])
def list_activities(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[Activity]:
    return list(db.scalars(select(Activity).where(Activity.user_id == current_user.id).order_by(Activity.activity_date.desc())).all())


@router.patch("/activities/{activity_id}", response_model=ActivityRead)
def update_farm_activity(activity_id: int, payload: ActivityUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Activity:
    activity = get_owned_activity(db, activity_id, current_user.id)
    return update_activity(db, activity, payload)


@router.delete("/activities/{activity_id}", status_code=204)
def delete_farm_activity(activity_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Response:
    activity = get_owned_activity(db, activity_id, current_user.id)
    db.delete(activity)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/symptom-records", response_model=SymptomRecordRead, status_code=201)
def create_observation(payload: SymptomRecordCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> SymptomRecord:
    return create_symptom_record(db, current_user.id, payload)


@router.get("/symptom-records", response_model=list[SymptomRecordRead])
def list_observations(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[SymptomRecord]:
    return list(
        db.scalars(
            select(SymptomRecord)
            .options(selectinload(SymptomRecord.symptom))
            .where(SymptomRecord.user_id == current_user.id)
            .order_by(SymptomRecord.observed_at.desc())
        ).all()
    )


@router.patch("/symptom-records/{symptom_record_id}", response_model=SymptomRecordRead)
def update_observation(symptom_record_id: int, payload: SymptomRecordUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> SymptomRecord:
    record = get_owned_symptom_record(db, symptom_record_id, current_user.id)
    return update_symptom_record(db, record, payload)


@router.delete("/symptom-records/{symptom_record_id}", status_code=204)
def delete_observation(symptom_record_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Response:
    record = get_owned_symptom_record(db, symptom_record_id, current_user.id)
    planting_record_id = record.planting_record_id
    db.delete(record)
    db.flush()
    sync_planting_record_status_from_symptoms(db, planting_record_id)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)