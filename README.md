# AgriMonitor

AgriMonitor is a mobile-first full stack web app MVP for crop monitoring, rule-based crop risk recommendations, market prices, farm finance tracking, and dashboard summaries.

## MVP Status

Phases 1-10 are implemented.

Implemented:

- React + Vite + TypeScript frontend.
- FastAPI backend.
- PostgreSQL-compatible schema for Neon.
- Seed data for crops, symptoms, disease rules, and market prices.
- Register/login with JWT.
- Admin/user role permission.
- Planting records, activities, symptom records.
- Rule-based recommendation and high-risk alerts.
- Market prices with filters and CSV import.
- Dashboard summary and Recharts price graph.
- Cost, harvest, revenue, and profit/loss tracking.
- Render + Neon deployment notes.

Not included in MVP:

- AI diagnosis.
- IoT/hardware integration.
- External market APIs.
- Paid services beyond optional hosting/database choices.

## Project Structure

```text
agrimonitor/
  agrimonitor_backend/
  agrimonitor_frontend/
  docs/
```

## Backend Local Setup

```bash
cd agrimonitor_backend
python -m venv .venv
.venv\Scripts\activate
pip install -e .
copy .env.example .env
```

Edit `.env`:

```text
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/agrimonitor
JWT_SECRET_KEY=<strong local secret>
CORS_ORIGINS=http://localhost:5173
```

Run database migration and seed:

```bash
alembic upgrade head
python -m app.db.seed
```

Run backend:

```bash
uvicorn app.main:app --reload
```

Backend URLs:

```text
GET http://localhost:8000/health
GET http://localhost:8000/api/v1/health
```

## Frontend Local Setup

```bash
cd agrimonitor_frontend
npm install
copy .env.example .env
npm run dev
```

Frontend URL:

```text
http://localhost:5173
```

## Main API Groups

```text
/api/v1/auth
/api/v1/monitoring
/api/v1/recommendations
/api/v1/market-prices
/api/v1/dashboard
/api/v1/finance
```

## Render + Neon Deployment

See:

```text
docs/deployment-render-neon.md
```

A starter `render.yaml` is included at the project root.

## Security Notes

- Do not commit `.env` files.
- Do not hardcode real secrets.
- Set `JWT_SECRET_KEY` through environment variables.
- Set `DATABASE_URL` through environment variables.
- Set `CORS_ORIGINS` to the deployed frontend URL in production.