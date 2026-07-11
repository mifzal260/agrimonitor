from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import base as _models

from app.db.database import SessionLocal
from app.models.crop import Crop
from app.models.disease_rule import DiseaseRule, DiseaseRuleSymptom
from app.models.symptom import Symptom


def seed_crops(db: Session) -> dict[str, Crop]:
    master_crops = [
        Crop(name="Cili Hijau", variety="F.A.Q", description="Komoditi cili hijau.", expected_harvest_days=90),
        Crop(name="Cili Merah Kulai / Kulai Hibrid", variety="F.A.Q", description="Komoditi cili merah Kulai atau Kulai Hibrid.", expected_harvest_days=90),
        Crop(name="Cili Merah Minyak", variety="F.A.Q", description="Komoditi cili merah minyak.", expected_harvest_days=90),
        Crop(name="Timun Hijau", variety="F.A.Q", description="Komoditi timun hijau.", expected_harvest_days=55),
        Crop(name="Tomato (Tanah Tinggi)", variety="F.A.Q", description="Komoditi tomato tanah tinggi.", expected_harvest_days=75),
    ]
    existing = {crop.name: crop for crop in db.scalars(select(Crop)).all()}
    for crop in master_crops:
        if crop.name not in existing:
            db.add(crop)
    db.flush()
    return {crop.name: crop for crop in db.scalars(select(Crop)).all()}


def seed_symptoms(db: Session) -> dict[str, Symptom]:
    master_symptoms = [
        Symptom(name="Yellow leaves", description="Leaves turn pale or yellow."),
        Symptom(name="Brown spots", description="Brown or dark spots appear on leaves."),
        Symptom(name="Wilting", description="Plant looks weak or droops."),
        Symptom(name="Leaf curl", description="Leaves curl or become distorted."),
    ]
    existing = {symptom.name: symptom for symptom in db.scalars(select(Symptom)).all()}
    for symptom in master_symptoms:
        if symptom.name not in existing:
            db.add(symptom)
    db.flush()
    return {symptom.name: symptom for symptom in db.scalars(select(Symptom)).all()}


def seed_disease_rules(db: Session, crops: dict[str, Crop], symptoms: dict[str, Symptom]) -> None:
    master_rules = [
        {
            "crop": "Cili Hijau",
            "disease_name": "Possible nutrient stress",
            "risk_level": "low",
            "recommendation": "Check watering schedule and add balanced fertilizer if needed.",
            "symptoms": ["Yellow leaves"],
        },
        {
            "crop": "Tomato (Tanah Tinggi)",
            "disease_name": "Possible leaf spot",
            "risk_level": "medium",
            "recommendation": "Remove affected leaves and improve airflow around plants.",
            "symptoms": ["Brown spots", "Yellow leaves"],
        },
        {
            "crop": "Timun Hijau",
            "disease_name": "Possible severe water or root stress",
            "risk_level": "high",
            "recommendation": "Inspect soil moisture and roots immediately. Isolate affected plants if symptoms spread.",
            "symptoms": ["Wilting", "Leaf curl"],
        },
    ]
    existing_names = set(db.scalars(select(DiseaseRule.disease_name)).all())
    for rule_data in master_rules:
        if rule_data["disease_name"] in existing_names:
            continue
        rule = DiseaseRule(
            crop_id=crops[rule_data["crop"]].id,
            disease_name=rule_data["disease_name"],
            risk_level=rule_data["risk_level"],
            recommendation=rule_data["recommendation"],
        )
        db.add(rule)
        db.flush()
        for symptom_name in rule_data["symptoms"]:
            db.add(DiseaseRuleSymptom(disease_rule_id=rule.id, symptom_id=symptoms[symptom_name].id))


def run_seed() -> None:
    db = SessionLocal()
    try:
        crops = seed_crops(db)
        symptoms = seed_symptoms(db)
        seed_disease_rules(db, crops, symptoms)
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()
