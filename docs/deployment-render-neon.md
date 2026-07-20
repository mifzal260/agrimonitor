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
PREPARE_DATABASE_ON_STARTUP=false
LOGIN_RATE_LIMIT_ENABLED=true
LOGIN_MAX_ATTEMPTS_PER_ACCOUNT=5
LOGIN_ACCOUNT_WINDOW_SECONDS=300
LOGIN_MAX_ATTEMPTS_PER_IP=15
LOGIN_IP_WINDOW_SECONDS=900
LOGIN_LOCKOUT_BASE_SECONDS=60
LOGIN_LOCKOUT_MAX_SECONDS=1800
TRUSTED_PROXY_IPS=<comma-separated trusted proxy IPs, leave empty if none>
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
- Keep login rate limiting enabled in production.
- Leave `TRUSTED_PROXY_IPS` empty on ordinary Render deployments unless you have a stable trusted proxy IP you control; otherwise `X-Forwarded-For` is ignored by design.
- Run Alembic migration before using the app.
- Run seed data for required master data.
- Do not expose Neon password in frontend code.
- Do not commit `.env` files.

## 5. Notes

The MVP does not use AI diagnosis, IoT, hardware integration, or external market APIs.
