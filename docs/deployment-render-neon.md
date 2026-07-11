# Render + Neon Deployment Notes

This project is prepared for:

- Backend: FastAPI on Render Web Service.
- Frontend: React + Vite static site on Render.
- Database: Neon PostgreSQL.

## 1. Create Neon Database

1. Create a Neon project.
2. Create a PostgreSQL database for AgriMonitor.
3. Copy the pooled connection string.
4. Convert it to SQLAlchemy format if needed:

```text
postgresql+psycopg://USER:PASSWORD@HOST/DB?sslmode=require
```

Use this value as `DATABASE_URL` in Render backend environment variables.

## 2. Deploy Backend on Render

Create a Render Web Service using `agrimonitor_backend` as root directory.

Build command:

```bash
pip install -e .
```

Start command:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Environment variables:

```text
APP_ENV=production
API_PREFIX=/api/v1
DATABASE_URL=<Neon SQLAlchemy connection string>
JWT_SECRET_KEY=<strong random secret>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
CORS_ORIGINS=<frontend render URL>
```

After backend deployment, run database migration from Render shell or a one-off job:

```bash
alembic upgrade head
python -m app.db.seed
```

## 3. Deploy Frontend on Render

Create a Render Static Site using `agrimonitor_frontend` as root directory.

Build command:

```bash
npm install && npm run build
```

Publish directory:

```text
dist
```

Environment variable:

```text
VITE_API_BASE_URL=<backend render URL>/api/v1
```

## 4. Production Checklist

- Change `JWT_SECRET_KEY` to a strong random value.
- Set `CORS_ORIGINS` to the exact frontend URL.
- Run Alembic migration before using the app.
- Run seed data for required master data.
- Do not expose Neon password in frontend code.
- Do not commit `.env` files.

## 5. Notes

The MVP does not use AI diagnosis, IoT, hardware integration, or external market APIs.
