"""initial schema

Revision ID: 20260705_0001
Revises:
Create Date: 2026-07-05
"""
from collections.abc import Sequence

from alembic import op

revision: str = "20260705_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE users (
            id SERIAL PRIMARY KEY,
            name VARCHAR(120) NOT NULL,
            email VARCHAR(255) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(20) NOT NULL DEFAULT 'user',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX ix_users_email ON users(email);

        CREATE TABLE crops (
            id SERIAL PRIMARY KEY,
            name VARCHAR(120) NOT NULL UNIQUE,
            variety VARCHAR(120),
            description TEXT,
            expected_harvest_days INTEGER,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE symptoms (
            id SERIAL PRIMARY KEY,
            name VARCHAR(120) NOT NULL UNIQUE,
            description TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE disease_rules (
            id SERIAL PRIMARY KEY,
            crop_id INTEGER NOT NULL REFERENCES crops(id),
            disease_name VARCHAR(160) NOT NULL,
            risk_level VARCHAR(20) NOT NULL,
            recommendation TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE disease_rule_symptoms (
            id SERIAL PRIMARY KEY,
            disease_rule_id INTEGER NOT NULL REFERENCES disease_rules(id),
            symptom_id INTEGER NOT NULL REFERENCES symptoms(id),
            CONSTRAINT uq_disease_rule_symptoms_rule_symptom UNIQUE (disease_rule_id, symptom_id)
        );

        CREATE TABLE planting_records (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            crop_id INTEGER NOT NULL REFERENCES crops(id),
            field_name VARCHAR(120) NOT NULL,
            planting_date DATE NOT NULL,
            area_size NUMERIC(10, 2),
            status VARCHAR(30) NOT NULL DEFAULT 'healthy',
            notes TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX ix_planting_records_user_id ON planting_records(user_id);

        CREATE TABLE activities (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            planting_record_id INTEGER NOT NULL REFERENCES planting_records(id),
            activity_type VARCHAR(80) NOT NULL,
            activity_date DATE NOT NULL,
            description TEXT,
            cost_amount NUMERIC(12, 2),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX ix_activities_user_id ON activities(user_id);

        CREATE TABLE symptom_records (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            planting_record_id INTEGER NOT NULL REFERENCES planting_records(id),
            symptom_id INTEGER NOT NULL REFERENCES symptoms(id),
            severity VARCHAR(20) NOT NULL,
            notes TEXT,
            image_url VARCHAR(500),
            observed_at TIMESTAMPTZ NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX ix_symptom_records_user_id ON symptom_records(user_id);

        CREATE TABLE alerts (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            planting_record_id INTEGER NOT NULL REFERENCES planting_records(id),
            symptom_record_id INTEGER REFERENCES symptom_records(id),
            risk_level VARCHAR(20) NOT NULL,
            message TEXT NOT NULL,
            is_read BOOLEAN NOT NULL DEFAULT false,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX ix_alerts_user_id ON alerts(user_id);

        CREATE TABLE market_prices (
            id SERIAL PRIMARY KEY,
            crop_id INTEGER REFERENCES crops(id),
            commodity_name VARCHAR(120) NOT NULL,
            location VARCHAR(120) NOT NULL,
            price_type VARCHAR(40) NOT NULL,
            price NUMERIC(12, 2) NOT NULL,
            unit VARCHAR(40) NOT NULL,
            recorded_date DATE NOT NULL,
            trend VARCHAR(20) NOT NULL DEFAULT 'stable',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX ix_market_prices_lookup ON market_prices(commodity_name, location, price_type, recorded_date);

        CREATE TABLE costs (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            planting_record_id INTEGER NOT NULL REFERENCES planting_records(id),
            cost_type VARCHAR(80) NOT NULL,
            amount NUMERIC(12, 2) NOT NULL,
            cost_date DATE NOT NULL,
            notes TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX ix_costs_user_id ON costs(user_id);

        CREATE TABLE harvests (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            planting_record_id INTEGER NOT NULL REFERENCES planting_records(id),
            harvest_date DATE NOT NULL,
            quantity NUMERIC(12, 2) NOT NULL,
            unit VARCHAR(40) NOT NULL,
            selling_price_per_unit NUMERIC(12, 2) NOT NULL,
            revenue NUMERIC(12, 2) NOT NULL,
            notes TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX ix_harvests_user_id ON harvests(user_id);
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DROP TABLE IF EXISTS harvests;
        DROP TABLE IF EXISTS costs;
        DROP TABLE IF EXISTS market_prices;
        DROP TABLE IF EXISTS alerts;
        DROP TABLE IF EXISTS symptom_records;
        DROP TABLE IF EXISTS activities;
        DROP TABLE IF EXISTS planting_records;
        DROP TABLE IF EXISTS disease_rule_symptoms;
        DROP TABLE IF EXISTS disease_rules;
        DROP TABLE IF EXISTS symptoms;
        DROP TABLE IF EXISTS crops;
        DROP TABLE IF EXISTS users;
        """
    )