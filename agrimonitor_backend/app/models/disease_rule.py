from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base
from app.models.mixins import TimestampMixin


class DiseaseRule(TimestampMixin, Base):
    __tablename__ = "disease_rules"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    crop_id: Mapped[int] = mapped_column(ForeignKey("crops.id"), nullable=False)
    disease_name: Mapped[str] = mapped_column(String(160), nullable=False)
    risk_level: Mapped[str] = mapped_column(String(20), nullable=False)
    recommendation: Mapped[str] = mapped_column(Text, nullable=False)

    crop = relationship("Crop", back_populates="disease_rules")
    symptom_links = relationship(
        "DiseaseRuleSymptom",
        back_populates="disease_rule",
        cascade="all, delete-orphan",
    )


class DiseaseRuleSymptom(Base):
    __tablename__ = "disease_rule_symptoms"
    __table_args__ = (
        UniqueConstraint(
            "disease_rule_id",
            "symptom_id",
            name="uq_disease_rule_symptoms_rule_symptom",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    disease_rule_id: Mapped[int] = mapped_column(ForeignKey("disease_rules.id"), nullable=False)
    symptom_id: Mapped[int] = mapped_column(ForeignKey("symptoms.id"), nullable=False)

    disease_rule = relationship("DiseaseRule", back_populates="symptom_links")
    symptom = relationship("Symptom", back_populates="disease_rule_links")