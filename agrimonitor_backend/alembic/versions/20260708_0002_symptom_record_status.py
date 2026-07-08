"""add symptom record status

Revision ID: 20260708_0002
Revises: 20260705_0001
Create Date: 2026-07-08
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260708_0002"
down_revision: str | None = "20260705_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("symptom_records", sa.Column("status", sa.String(length=20), nullable=True))
    op.add_column("symptom_records", sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True))
    op.execute("UPDATE symptom_records SET status = 'active' WHERE status IS NULL")
    op.alter_column("symptom_records", "status", nullable=False)


def downgrade() -> None:
    op.drop_column("symptom_records", "resolved_at")
    op.drop_column("symptom_records", "status")