# Database Schema

AgriMonitor uses a PostgreSQL-compatible schema designed for Neon.

## Tables

- `users`
- `crops`
- `symptoms`
- `disease_rules`
- `disease_rule_symptoms`
- `planting_records`
- `activities`
- `symptom_records`
- `alerts`
- `market_prices`
- `costs`
- `harvests`

## Ownership Rules

User-owned tables include `user_id`:

- `planting_records`
- `activities`
- `symptom_records`
- `alerts`
- `costs`
- `harvests`

Admin-managed master data:

- `crops`
- `symptoms`
- `disease_rules`
- `disease_rule_symptoms`
- `market_prices`

## Migration

Initial migration:

```text
agrimonitor_backend/alembic/versions/20260705_0001_initial_schema.py
```

Run migrations after setting `DATABASE_URL`:

```bash
cd agrimonitor_backend
alembic upgrade head
```

## Seed Data

Seed script:

```text
agrimonitor_backend/app/db/seed.py
```

Run seed after migration:

```bash
cd agrimonitor_backend
python -m app.db.seed
```

Seed data includes:

- Crops: Cili Hijau, Cili Merah Kulai / Kulai Hibrid, Cili Merah Minyak, Timun Hijau, Tomato (Tanah Tinggi).
- Symptoms: Yellow leaves, Brown spots, Wilting, Leaf curl.
- Disease rules: low, medium, and high risk examples.
- Market prices: data komoditi rasmi yang diimport melalui CSV.
