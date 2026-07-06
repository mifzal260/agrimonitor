from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.alert import Alert
from app.models.disease_rule import DiseaseRule
from app.models.planting_record import PlantingRecord
from app.models.symptom_record import SymptomRecord
from app.schemas.recommendation import RecommendationMatch, RecommendationResult
from app.services.monitoring_service import get_owned_planting_record

risk_rank = {"none": 0, "low": 1, "medium": 2, "high": 3}


def evaluate_planting_record(db: Session, planting_record_id: int, user_id: int) -> RecommendationResult:
    planting_record = get_owned_planting_record(db, planting_record_id, user_id)
    symptom_records = db.scalars(
        select(SymptomRecord)
        .options(selectinload(SymptomRecord.symptom))
        .where(SymptomRecord.planting_record_id == planting_record.id, SymptomRecord.user_id == user_id)
    ).all()
    observed_symptom_ids = {record.symptom_id for record in symptom_records}
    observed_symptom_names = {record.symptom_id: record.symptom.name for record in symptom_records}

    rules = db.scalars(
        select(DiseaseRule)
        .options(selectinload(DiseaseRule.symptom_links))
        .where(DiseaseRule.crop_id == planting_record.crop_id)
    ).all()

    matches: list[RecommendationMatch] = []
    highest_risk = "none"
    for rule in rules:
        required_symptom_ids = {link.symptom_id for link in rule.symptom_links}
        if not required_symptom_ids:
            continue
        matched_ids = required_symptom_ids.intersection(observed_symptom_ids)
        if not matched_ids:
            continue

        if risk_rank[rule.risk_level] > risk_rank[highest_risk]:
            highest_risk = rule.risk_level

        matches.append(
            RecommendationMatch(
                disease_rule_id=rule.id,
                disease_name=rule.disease_name,
                risk_level=rule.risk_level,
                recommendation=rule.recommendation,
                matched_symptoms=[observed_symptom_names[symptom_id] for symptom_id in matched_ids],
            )
        )

        if rule.risk_level == "high":
            create_high_risk_alert(db, planting_record, rule)

    if highest_risk in {"medium", "high"} and planting_record.status != "harvested":
        planting_record.status = "risk" if highest_risk == "high" else "watch"

    db.commit()
    return RecommendationResult(
        planting_record_id=planting_record.id,
        highest_risk_level=highest_risk,
        matches=matches,
    )


def create_high_risk_alert(db: Session, planting_record: PlantingRecord, rule: DiseaseRule) -> None:
    message = f"High risk detected for {rule.disease_name}: {rule.recommendation}"
    existing_alert = db.scalar(
        select(Alert).where(
            Alert.user_id == planting_record.user_id,
            Alert.planting_record_id == planting_record.id,
            Alert.risk_level == "high",
            Alert.message == message,
        )
    )
    if existing_alert is not None:
        return

    db.add(
        Alert(
            user_id=planting_record.user_id,
            planting_record_id=planting_record.id,
            risk_level="high",
            message=message,
            is_read=False,
        )
    )


def list_user_alerts(db: Session, user_id: int) -> list[Alert]:
    return list(
        db.scalars(
            select(Alert)
            .where(Alert.user_id == user_id)
            .order_by(Alert.created_at.desc())
        ).all()
    )