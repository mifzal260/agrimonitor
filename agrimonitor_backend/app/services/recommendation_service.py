from sqlalchemy import exists, select
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
        .where(SymptomRecord.planting_record_id == planting_record.id, SymptomRecord.user_id == user_id, SymptomRecord.status != "resolved")
    ).all()
    catalog_symptom_records = [record for record in symptom_records if record.symptom_id is not None]
    observed_symptom_ids = {record.symptom_id for record in catalog_symptom_records}
    observed_symptom_names = {
        record.symptom_id: record.symptom.name
        for record in catalog_symptom_records
        if record.symptom is not None
    }
    observed_symptom_severities = {
        symptom_id: max(
            (record.severity for record in symptom_records if record.symptom_id == symptom_id),
            key=risk_rank.__getitem__,
        )
        for symptom_id in observed_symptom_ids
    }

    rules = (
        db.scalars(
            select(DiseaseRule)
            .options(selectinload(DiseaseRule.symptom_links))
            .where(DiseaseRule.crop_id == planting_record.crop_id)
        ).all()
        if planting_record.crop_id is not None
        else []
    )

    matches: list[RecommendationMatch] = []
    highest_risk = "none"
    active_alert_messages: set[str] = set()
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

        alert_severity = max(
            (observed_symptom_severities[symptom_id] for symptom_id in matched_ids),
            key=risk_rank.__getitem__,
        )
        alert_message = (
            f"{alert_severity.capitalize()} risk detected for "
            f"{rule.disease_name}: {rule.recommendation}"
        )
        active_alert_messages.add(alert_message)
        create_risk_alert(db, planting_record, alert_severity, alert_message)

    existing_alerts = db.scalars(
        select(Alert).where(
            Alert.user_id == user_id,
            Alert.planting_record_id == planting_record.id,
        )
    ).all()
    for alert in existing_alerts:
        if alert.message not in active_alert_messages:
            db.delete(alert)

    if highest_risk in {"medium", "high"} and planting_record.status != "harvested":
        planting_record.status = "risk" if highest_risk == "high" else "watch"

    db.commit()
    return RecommendationResult(
        planting_record_id=planting_record.id,
        highest_risk_level=highest_risk,
        matches=matches,
    )


def create_risk_alert(
    db: Session,
    planting_record: PlantingRecord,
    risk_level: str,
    message: str,
) -> None:
    existing_alert = db.scalar(
        select(Alert).where(
            Alert.user_id == planting_record.user_id,
            Alert.planting_record_id == planting_record.id,
            Alert.risk_level == risk_level,
            Alert.message == message,
        )
    )
    if existing_alert is not None:
        return

    db.add(
        Alert(
            user_id=planting_record.user_id,
            planting_record_id=planting_record.id,
            risk_level=risk_level,
            message=message,
            is_read=False,
        )
    )


def list_user_alerts(db: Session, user_id: int) -> list[Alert]:
    alerted_planting_record_ids = db.scalars(
        select(Alert.planting_record_id)
        .where(Alert.user_id == user_id)
        .distinct()
    ).all()
    for planting_record_id in alerted_planting_record_ids:
        evaluate_planting_record(db, planting_record_id, user_id)

    return list(
        db.scalars(
            select(Alert)
            .where(
                Alert.user_id == user_id,
                exists(
                    select(SymptomRecord.id).where(
                        SymptomRecord.planting_record_id == Alert.planting_record_id,
                        SymptomRecord.user_id == user_id,
                        SymptomRecord.status != "resolved",
                    )
                ),
            )
            .order_by(Alert.created_at.desc())
        ).all()
    )