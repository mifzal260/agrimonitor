"""replace demo crops with official commodities

Revision ID: 20260711_0006
Revises: 20260711_0005
Create Date: 2026-07-11
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260711_0006"
down_revision: str | None = "20260711_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

CROP_REPLACEMENTS = {
    "Chili": {
        "name": "Cili Hijau",
        "variety": "F.A.Q",
        "description": "Komoditi cili hijau.",
        "expected_harvest_days": 90,
    },
    "Cucumber": {
        "name": "Timun Hijau",
        "variety": "F.A.Q",
        "description": "Komoditi timun hijau.",
        "expected_harvest_days": 55,
    },
    "Tomato": {
        "name": "Tomato (Tanah Tinggi)",
        "variety": "F.A.Q",
        "description": "Komoditi tomato tanah tinggi.",
        "expected_harvest_days": 75,
    },
}

ADDITIONAL_CROPS = (
    {
        "name": "Cili Merah Kulai / Kulai Hibrid",
        "variety": "F.A.Q",
        "description": "Komoditi cili merah Kulai atau Kulai Hibrid.",
        "expected_harvest_days": 90,
    },
    {
        "name": "Cili Merah Minyak",
        "variety": "F.A.Q",
        "description": "Komoditi cili merah minyak.",
        "expected_harvest_days": 90,
    },
)


def upgrade() -> None:
    connection = op.get_bind()

    for old_name, replacement in CROP_REPLACEMENTS.items():
        old_id = connection.execute(
            sa.text("SELECT id FROM crops WHERE name = :name"),
            {"name": old_name},
        ).scalar()
        target_id = connection.execute(
            sa.text("SELECT id FROM crops WHERE name = :name"),
            {"name": replacement["name"]},
        ).scalar()

        if old_id is not None and target_id is not None:
            for table_name in ("planting_records", "disease_rules", "market_prices"):
                connection.execute(
                    sa.text(f"UPDATE {table_name} SET crop_id = :target_id WHERE crop_id = :old_id"),
                    {"target_id": target_id, "old_id": old_id},
                )
            connection.execute(sa.text("DELETE FROM crops WHERE id = :old_id"), {"old_id": old_id})
        elif old_id is not None:
            connection.execute(
                sa.text(
                    """
                    UPDATE crops
                    SET name = :name,
                        variety = :variety,
                        description = :description,
                        expected_harvest_days = :expected_harvest_days,
                        updated_at = now()
                    WHERE id = :old_id
                    """
                ),
                {**replacement, "old_id": old_id},
            )
        elif target_id is None:
            _insert_crop(connection, replacement)

    for crop in ADDITIONAL_CROPS:
        exists = connection.execute(
            sa.text("SELECT 1 FROM crops WHERE name = :name"),
            {"name": crop["name"]},
        ).scalar()
        if exists is None:
            _insert_crop(connection, crop)


def downgrade() -> None:
    # Master crop changes preserve user records and are intentionally not reversed.
    pass


def _insert_crop(connection: sa.Connection, crop: dict[str, object]) -> None:
    connection.execute(
        sa.text(
            """
            INSERT INTO crops (name, variety, description, expected_harvest_days)
            VALUES (:name, :variety, :description, :expected_harvest_days)
            """
        ),
        crop,
    )
