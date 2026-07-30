"""add iot monitoring simulation tables

Revision ID: 20260730_0008
Revises: 20260723_0007
Create Date: 2026-07-30
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260730_0008"
down_revision: str | None = "20260723_0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "iot_devices",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("device_code", sa.String(length=80), nullable=False),
        sa.Column("device_name", sa.String(length=120), nullable=False),
        sa.Column("location", sa.String(length=120), nullable=False),
        sa.Column("data_source", sa.String(length=30), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("device_code", name="uq_iot_devices_device_code"),
    )
    op.create_index("ix_iot_devices_id", "iot_devices", ["id"])
    op.create_index("ix_iot_devices_device_code", "iot_devices", ["device_code"])

    op.create_table(
        "sensor_readings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("device_id", sa.Integer(), nullable=False),
        sa.Column("temperature", sa.Numeric(5, 2), nullable=False),
        sa.Column("humidity", sa.Numeric(5, 2), nullable=False),
        sa.Column("soil_moisture", sa.Numeric(5, 2), nullable=False),
        sa.Column("light_intensity", sa.Numeric(7, 2), nullable=False),
        sa.Column("battery_level", sa.Numeric(5, 2), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["device_id"], ["iot_devices.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_sensor_readings_id", "sensor_readings", ["id"])
    op.create_index("ix_sensor_readings_device_id", "sensor_readings", ["device_id"])
    op.create_index("ix_sensor_readings_recorded_at", "sensor_readings", ["recorded_at"])


def downgrade() -> None:
    op.drop_index("ix_sensor_readings_recorded_at", table_name="sensor_readings")
    op.drop_index("ix_sensor_readings_device_id", table_name="sensor_readings")
    op.drop_index("ix_sensor_readings_id", table_name="sensor_readings")
    op.drop_table("sensor_readings")
    op.drop_index("ix_iot_devices_device_code", table_name="iot_devices")
    op.drop_index("ix_iot_devices_id", table_name="iot_devices")
    op.drop_table("iot_devices")
