"""add labor cost to activities

Revision ID: 20260709_0004
Revises: 20260708_0003
Create Date: 2026-07-09
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260709_0004"
down_revision: str | None = "20260708_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("activities", sa.Column("labor_cost_amount", sa.Numeric(12, 2), nullable=True))


def downgrade() -> None:
    op.drop_column("activities", "labor_cost_amount")
