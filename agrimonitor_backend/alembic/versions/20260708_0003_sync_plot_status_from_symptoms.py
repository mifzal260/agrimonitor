"""sync planting status from active symptoms

Revision ID: 20260708_0003
Revises: 20260708_0002
Create Date: 2026-07-08
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20260708_0003"
down_revision: str | None = "20260708_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE planting_records AS pr
        SET status = CASE
            WHEN EXISTS (
                SELECT 1 FROM symptom_records AS sr
                WHERE sr.planting_record_id = pr.id
                  AND sr.status <> 'resolved'
                  AND sr.severity = 'high'
            ) THEN 'risk'
            WHEN EXISTS (
                SELECT 1 FROM symptom_records AS sr
                WHERE sr.planting_record_id = pr.id
                  AND sr.status <> 'resolved'
            ) THEN 'watch'
            ELSE 'healthy'
        END
        WHERE pr.status <> 'harvested'
        """
    )


def downgrade() -> None:
    pass