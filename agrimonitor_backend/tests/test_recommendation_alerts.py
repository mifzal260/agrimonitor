from datetime import UTC, date, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.crop import Crop
from app.models.disease_rule import DiseaseRule, DiseaseRuleSymptom
from app.models.symptom import Symptom
from app.models.symptom_record import SymptomRecord


def test_high_risk_alert_disappears_when_symptom_is_resolved(
    client: TestClient,
    db_session: Session,
) -> None:
    crop = Crop(name="Alert Test Crop", expected_harvest_days=90)
    symptom = Symptom(name="Alert Test Symptom")
    db_session.add_all([crop, symptom])
    db_session.flush()
    rule = DiseaseRule(
        crop_id=crop.id,
        disease_name="Severe root stress",
        risk_level="high",
        recommendation="Inspect the roots.",
    )
    db_session.add(rule)
    db_session.flush()
    db_session.add(DiseaseRuleSymptom(disease_rule_id=rule.id, symptom_id=symptom.id))
    db_session.commit()

    registration = client.post(
        "/api/v1/auth/register",
        json={"name": "Alert Tester", "email": "alerts@example.com", "password": "password123"},
    )
    assert registration.status_code == 201
    headers = {"Authorization": f"Bearer {registration.json()['access_token']}"}

    planting = client.post(
        "/api/v1/monitoring/planting-records",
        headers=headers,
        json={
            "crop_id": crop.id,
            "field_name": "Alert Plot",
            "planting_date": date.today().isoformat(),
            "status": "healthy",
        },
    )
    assert planting.status_code == 201
    symptom_record = client.post(
        "/api/v1/monitoring/symptom-records",
        headers=headers,
        json={
            "planting_record_id": planting.json()["id"],
            "symptom_id": symptom.id,
            "severity": "high",
            "observed_at": datetime.now(UTC).isoformat(),
        },
    )
    assert symptom_record.status_code == 201

    evaluation = client.post(
        f"/api/v1/recommendations/planting-records/{planting.json()['id']}/evaluate",
        headers=headers,
    )
    assert evaluation.status_code == 200
    assert len(client.get("/api/v1/recommendations/alerts", headers=headers).json()) == 1
    assert client.get("/api/v1/dashboard/summary", headers=headers).json()["high_risk_alerts"] == 1

    resolved = client.patch(
        f"/api/v1/monitoring/symptom-records/{symptom_record.json()['id']}",
        headers=headers,
        json={"status": "resolved", "resolved_at": datetime.now(UTC).isoformat()},
    )

    assert resolved.status_code == 200
    assert client.get("/api/v1/recommendations/alerts", headers=headers).json() == []
    assert client.get("/api/v1/dashboard/summary", headers=headers).json()["high_risk_alerts"] == 0


@pytest.mark.parametrize("severity", ["low", "medium", "high"])
def test_alert_severity_matches_active_symptom_severity(
    client: TestClient,
    db_session: Session,
    severity: str,
) -> None:
    crop = Crop(name=f"Alert Severity Crop {severity}", expected_harvest_days=90)
    symptom = Symptom(name=f"Alert Severity Symptom {severity}")
    db_session.add_all([crop, symptom])
    db_session.flush()
    rule = DiseaseRule(
        crop_id=crop.id,
        disease_name="High-risk rule",
        risk_level="high",
        recommendation="Inspect the crop.",
    )
    db_session.add(rule)
    db_session.flush()
    db_session.add(DiseaseRuleSymptom(disease_rule_id=rule.id, symptom_id=symptom.id))
    db_session.commit()

    registration = client.post(
        "/api/v1/auth/register",
        json={
            "name": f"Alert Severity Tester {severity}",
            "email": f"alerts-{severity}@example.com",
            "password": "password123",
        },
    )
    assert registration.status_code == 201
    headers = {"Authorization": f"Bearer {registration.json()['access_token']}"}

    planting = client.post(
        "/api/v1/monitoring/planting-records",
        headers=headers,
        json={
            "crop_id": crop.id,
            "field_name": "Alert Severity Plot",
            "planting_date": date.today().isoformat(),
            "status": "healthy",
        },
    )
    assert planting.status_code == 201
    symptom_record = client.post(
        "/api/v1/monitoring/symptom-records",
        headers=headers,
        json={
            "planting_record_id": planting.json()["id"],
            "symptom_id": symptom.id,
            "severity": severity,
            "observed_at": datetime.now(UTC).isoformat(),
        },
    )
    assert symptom_record.status_code == 201

    evaluation = client.post(
        f"/api/v1/recommendations/planting-records/{planting.json()['id']}/evaluate",
        headers=headers,
    )
    alerts = client.get("/api/v1/recommendations/alerts", headers=headers)

    assert evaluation.status_code == 200
    assert alerts.status_code == 200
    assert len(alerts.json()) == 1
    assert alerts.json()[0]["risk_level"] == severity
    expected_high_alerts = 1 if severity == "high" else 0
    assert (
        client.get("/api/v1/dashboard/summary", headers=headers).json()["high_risk_alerts"]
        == expected_high_alerts
    )


def test_listing_alerts_refreshes_severity_of_existing_alert(
    client: TestClient,
    db_session: Session,
) -> None:
    crop = Crop(name="Legacy Alert Crop", expected_harvest_days=90)
    symptom = Symptom(name="Legacy Alert Symptom")
    db_session.add_all([crop, symptom])
    db_session.flush()
    rule = DiseaseRule(
        crop_id=crop.id,
        disease_name="High-risk rule",
        risk_level="high",
        recommendation="Inspect the crop.",
    )
    db_session.add(rule)
    db_session.flush()
    db_session.add(DiseaseRuleSymptom(disease_rule_id=rule.id, symptom_id=symptom.id))
    db_session.commit()

    registration = client.post(
        "/api/v1/auth/register",
        json={"name": "Legacy Alert Tester", "email": "legacy-alert@example.com", "password": "password123"},
    )
    assert registration.status_code == 201
    headers = {"Authorization": f"Bearer {registration.json()['access_token']}"}

    planting = client.post(
        "/api/v1/monitoring/planting-records",
        headers=headers,
        json={
            "crop_id": crop.id,
            "field_name": "Legacy Alert Plot",
            "planting_date": date.today().isoformat(),
            "status": "healthy",
        },
    )
    symptom_record = client.post(
        "/api/v1/monitoring/symptom-records",
        headers=headers,
        json={
            "planting_record_id": planting.json()["id"],
            "symptom_id": symptom.id,
            "severity": "high",
            "observed_at": datetime.now(UTC).isoformat(),
        },
    )
    assert planting.status_code == 201
    assert symptom_record.status_code == 201
    client.post(
        f"/api/v1/recommendations/planting-records/{planting.json()['id']}/evaluate",
        headers=headers,
    )

    stored_symptom = db_session.get(SymptomRecord, symptom_record.json()["id"])
    assert stored_symptom is not None
    stored_symptom.severity = "low"
    db_session.commit()

    alerts = client.get("/api/v1/recommendations/alerts", headers=headers)

    assert alerts.status_code == 200
    assert len(alerts.json()) == 1
    assert alerts.json()[0]["risk_level"] == "low"
