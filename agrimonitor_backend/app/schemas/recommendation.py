from pydantic import BaseModel


class RecommendationMatch(BaseModel):
    disease_rule_id: int
    disease_name: str
    risk_level: str
    recommendation: str
    matched_symptoms: list[str]


class RecommendationResult(BaseModel):
    planting_record_id: int
    highest_risk_level: str
    matches: list[RecommendationMatch]


class AlertRead(BaseModel):
    id: int
    planting_record_id: int
    symptom_record_id: int | None = None
    risk_level: str
    message: str
    is_read: bool

    model_config = {"from_attributes": True}