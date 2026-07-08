from datetime import date

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session, selectinload

from app.models.activity import Activity
from app.models.alert import Alert
from app.models.cost import Cost
from app.models.crop import Crop
from app.models.harvest import Harvest
from app.models.planting_record import PlantingRecord
from app.models.symptom import Symptom
from app.models.symptom_record import SymptomRecord
from app.schemas.monitoring import ActivityCreate, ActivityUpdate, PlantingRecordCreate, PlantingRecordUpdate, SymptomRecordCreate, SymptomRecordUpdate


def calculate_plant_age_days(planting_date: date) -> int:
    return max((date.today() - planting_date).days, 0)


def get_crop_or_404(db: Session, crop_id: int) -> Crop:
    crop = db.get(Crop, crop_id)
    if crop is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Crop not found")
    return crop


def get_symptom_or_404(db: Session, symptom_id: int) -> Symptom:
    symptom = db.get(Symptom, symptom_id)
    if symptom is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Symptom not found")
    return symptom


def get_owned_planting_record(db: Session, record_id: int, user_id: int) -> PlantingRecord:
    record = db.scalar(
        select(PlantingRecord)
        .options(selectinload(PlantingRecord.crop))
        .where(PlantingRecord.id == record_id, PlantingRecord.user_id == user_id)
    )
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Planting record not found")
    return record


def get_owned_activity(db: Session, activity_id: int, user_id: int) -> Activity:
    activity = db.scalar(select(Activity).where(Activity.id == activity_id, Activity.user_id == user_id))
    if activity is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activity not found")
    return activity


def get_owned_symptom_record(db: Session, symptom_record_id: int, user_id: int) -> SymptomRecord:
    record = db.scalar(
        select(SymptomRecord)
        .options(selectinload(SymptomRecord.symptom))
        .where(SymptomRecord.id == symptom_record_id, SymptomRecord.user_id == user_id)
    )
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Symptom record not found")
    return record


def create_planting_record(db: Session, user_id: int, payload: PlantingRecordCreate) -> PlantingRecord:
    get_crop_or_404(db, payload.crop_id)
    record = PlantingRecord(user_id=user_id, **payload.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return get_owned_planting_record(db, record.id, user_id)


def update_planting_record(db: Session, record: PlantingRecord, payload: PlantingRecordUpdate) -> PlantingRecord:
    data = payload.model_dump(exclude_unset=True)
    if "crop_id" in data and data["crop_id"] is not None:
        get_crop_or_404(db, data["crop_id"])
    for key, value in data.items():
        setattr(record, key, value)
    db.commit()
    db.refresh(record)
    return record



def delete_planting_record(db: Session, record: PlantingRecord) -> None:
    db.execute(delete(Alert).where(Alert.planting_record_id == record.id))
    db.execute(delete(Activity).where(Activity.planting_record_id == record.id))
    db.execute(delete(SymptomRecord).where(SymptomRecord.planting_record_id == record.id))
    db.execute(delete(Cost).where(Cost.planting_record_id == record.id))
    db.execute(delete(Harvest).where(Harvest.planting_record_id == record.id))
    db.delete(record)
    db.commit()

def create_activity(db: Session, user_id: int, payload: ActivityCreate) -> Activity:
    get_owned_planting_record(db, payload.planting_record_id, user_id)
    activity = Activity(user_id=user_id, **payload.model_dump())
    db.add(activity)
    db.commit()
    db.refresh(activity)
    return activity


def update_activity(db: Session, activity: Activity, payload: ActivityUpdate) -> Activity:
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(activity, key, value)
    db.commit()
    db.refresh(activity)
    return activity



def sync_planting_record_status_from_symptoms(db: Session, planting_record_id: int) -> None:
    planting_record = db.get(PlantingRecord, planting_record_id)
    if planting_record is None or planting_record.status == "harvested":
        return

    active_severities = list(
        db.scalars(
            select(SymptomRecord.severity).where(
                SymptomRecord.planting_record_id == planting_record_id,
                SymptomRecord.status != "resolved",
            )
        ).all()
    )
    if not active_severities:
        planting_record.status = "healthy"
    elif "high" in active_severities:
        planting_record.status = "risk"
    else:
        planting_record.status = "watch"

def create_symptom_record(db: Session, user_id: int, payload: SymptomRecordCreate) -> SymptomRecord:
    get_owned_planting_record(db, payload.planting_record_id, user_id)
    get_symptom_or_404(db, payload.symptom_id)
    record = SymptomRecord(user_id=user_id, **payload.model_dump())
    db.add(record)
    db.flush()
    sync_planting_record_status_from_symptoms(db, payload.planting_record_id)
    db.commit()
    db.refresh(record)
    return get_owned_symptom_record(db, record.id, user_id)


def update_symptom_record(db: Session, record: SymptomRecord, payload: SymptomRecordUpdate) -> SymptomRecord:
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(record, key, value)
    db.flush()
    sync_planting_record_status_from_symptoms(db, record.planting_record_id)
    db.commit()
    db.refresh(record)
    return record