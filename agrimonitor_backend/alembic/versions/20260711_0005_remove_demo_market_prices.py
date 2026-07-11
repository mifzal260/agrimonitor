"""remove demo market prices

Revision ID: 20260711_0005
Revises: 20260709_0004
Create Date: 2026-07-11
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260711_0005"
down_revision: str | None = "20260709_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

DEMO_COMMODITIES = ("Chili", "Cucumber", "Timun", "Tomato")


def upgrade() -> None:
    market_prices = sa.table("market_prices", sa.column("commodity_name", sa.String()))
    op.execute(sa.delete(market_prices).where(market_prices.c.commodity_name.in_(DEMO_COMMODITIES)))


def downgrade() -> None:
    # Deleted demo rows are intentionally not recreated.
    pass
