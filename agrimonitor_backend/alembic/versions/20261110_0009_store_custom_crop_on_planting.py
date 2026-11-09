"""store custom crop names on planting records

Revision ID: 20261110_0009
Revises: 20260730_0008
Create Date: 2026-11-10
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261110_0009"
down_revision: str | None = "20260730_0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "planting_records",
        sa.Column("custom_crop_name", sa.String(length=120), nullable=True),
    )
    op.alter_column(
        "planting_records",
        "crop_id",
        existing_type=sa.Integer(),
        nullable=True,
    )
    op.create_check_constraint(
        "ck_planting_record_crop_source",
        "planting_records",
        "(crop_id IS NOT NULL AND custom_crop_name IS NULL) OR "
        "(crop_id IS NULL AND custom_crop_name IS NOT NULL)",
    )


def downgrade() -> None:
    connection = op.get_bind()
    planting_records = sa.table(
        "planting_records",
        sa.column("id", sa.Integer()),
        sa.column("crop_id", sa.Integer()),
        sa.column("custom_crop_name", sa.String(length=120)),
    )
    crops = sa.table(
        "crops",
        sa.column("id", sa.Integer()),
        sa.column("name", sa.String(length=120)),
    )
    custom_rows = connection.execute(
        sa.select(planting_records.c.id, planting_records.c.custom_crop_name).where(
            planting_records.c.crop_id.is_(None),
            planting_records.c.custom_crop_name.is_not(None),
        )
    ).all()
    crop_ids_by_name: dict[str, int] = {}
    for row in custom_rows:
        crop_name = row.custom_crop_name
        if crop_name not in crop_ids_by_name:
            crop_id = connection.execute(
                sa.select(crops.c.id).where(sa.func.lower(crops.c.name) == crop_name.lower())
            ).scalar_one_or_none()
            if crop_id is None:
                crop_id = connection.execute(
                    sa.insert(crops).values(name=crop_name).returning(crops.c.id)
                ).scalar_one()
            crop_ids_by_name[crop_name] = crop_id
        connection.execute(
            sa.update(planting_records)
            .where(planting_records.c.id == row.id)
            .values(crop_id=crop_ids_by_name[crop_name])
        )

    op.drop_constraint(
        "ck_planting_record_crop_source",
        "planting_records",
        type_="check",
    )
    op.drop_column("planting_records", "custom_crop_name")
    op.alter_column(
        "planting_records",
        "crop_id",
        existing_type=sa.Integer(),
        nullable=False,
    )
