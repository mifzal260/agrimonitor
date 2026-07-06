from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base
from app.models.mixins import TimestampMixin


class Symptom(TimestampMixin, Base):
    __tablename__ = "symptoms"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    disease_rule_links = relationship("DiseaseRuleSymptom", back_populates="symptom")
    symptom_records = relationship("SymptomRecord", back_populates="symptom")