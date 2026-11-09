"""store custom symptoms on symptom records

Revision ID: 20261110_0010
Revises: 20261110_0009
Create Date: 2026-11-10
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261110_0010"
down_revision: str | None = "20261110_0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "symptom_records",
        sa.Column("custom_symptom_name", sa.String(length=120), nullable=True),
    )
    op.alter_column(
        "symptom_records",
        "symptom_id",
        existing_type=sa.Integer(),
        nullable=True,
    )
    op.create_check_constraint(
        "ck_symptom_record_symptom_source",
        "symptom_records",
        "(symptom_id IS NOT NULL AND custom_symptom_name IS NULL) OR "
        "(symptom_id IS NULL AND custom_symptom_name IS NOT NULL)",
    )


def downgrade() -> None:
    connection = op.get_bind()
    symptom_records = sa.table(
        "symptom_records",
        sa.column("id", sa.Integer()),
        sa.column("symptom_id", sa.Integer()),
        sa.column("custom_symptom_name", sa.String(length=120)),
    )
    symptoms = sa.table(
        "symptoms",
        sa.column("id", sa.Integer()),
        sa.column("name", sa.String(length=120)),
    )
    custom_rows = connection.execute(
        sa.select(symptom_records.c.id, symptom_records.c.custom_symptom_name).where(
            symptom_records.c.symptom_id.is_(None),
            symptom_records.c.custom_symptom_name.is_not(None),
        )
    ).all()
    symptom_ids_by_name: dict[str, int] = {}
    for row in custom_rows:
        symptom_name = row.custom_symptom_name
        if symptom_name not in symptom_ids_by_name:
            symptom_id = connection.execute(
                sa.select(symptoms.c.id).where(sa.func.lower(symptoms.c.name) == symptom_name.lower())
            ).scalar_one_or_none()
            if symptom_id is None:
                symptom_id = connection.execute(
                    sa.insert(symptoms).values(name=symptom_name).returning(symptoms.c.id)
                ).scalar_one()
            symptom_ids_by_name[symptom_name] = symptom_id
        connection.execute(
            sa.update(symptom_records)
            .where(symptom_records.c.id == row.id)
            .values(symptom_id=symptom_ids_by_name[symptom_name])
        )

    op.drop_constraint(
        "ck_symptom_record_symptom_source",
        "symptom_records",
        type_="check",
    )
    op.drop_column("symptom_records", "custom_symptom_name")
    op.alter_column(
        "symptom_records",
        "symptom_id",
        existing_type=sa.Integer(),
        nullable=False,
    )
