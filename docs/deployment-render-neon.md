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

## 6. Redis Distributed Login Protection

Redis disyorkan untuk perlindungan login production supaya attempt window dan lockout dikongsi antara worker/instance serta bertahan merentas restart backend. Provision perkhidmatan Redis yang serasi dengan client projek, kemudian tetapkan environment backend berikut:

```text
LOGIN_PROTECTION_STORE=redis
LOGIN_PROTECTION_FAIL_MODE=closed
REDIS_URL=<secret Redis connection URL>
REDIS_KEY_PREFIX=agrimonitor:login-protection
REDIS_SOCKET_TIMEOUT_SECONDS=2
REDIS_CONNECT_TIMEOUT_SECONDS=2
REDIS_HEALTH_CHECK_INTERVAL_SECONDS=30
REDIS_MAX_CONNECTIONS=20
```

Development tempatan boleh kekal menggunakan:

```text
LOGIN_PROTECTION_STORE=memory
```

`REDIS_URL` tidak diperlukan dalam memory mode. Jangan commit URL atau credential Redis. Jangan letakkan URL itu dalam frontend.

### Runtime dan Outage

- Redis client/pool dibuat sekali bagi setiap backend process dan ditutup ketika shutdown.
- Semua operasi compound menggunakan Lua atomik dan semua key state mempunyai TTL.
- Key menggunakan SHA-256 bagi email ternormalisasi dan source IP; email mentah tidak disimpan dalam key.
- Fail mode `closed` bermaksud Redis outage atau timeout menolak login dengan HTTP 503. Pengguna yang sudah mempunyai JWT sah masih boleh menggunakan endpoint lain.
- `/health` kekal hidup semasa Redis outage, tetapi `/health/ready` dan `/api/v1/health/ready` akan gagal sehingga Redis pulih.
- Tiada fallback senyap kepada memory apabila Redis dipilih.

Uji sambungan melalui readiness endpoint atau command ping yang membaca `REDIS_URL` daripada environment. Jangan print URL, connection options, atau exception yang mungkin mengandungi credential.

### Deployment Migration Order

1. Provision Redis.
2. Deploy backend baharu dengan dependency Redis tetapi kekalkan `LOGIN_PROTECTION_STORE=memory`.
3. Sahkan backend tests, `/health`, dan kedua-dua readiness endpoint.
4. Tetapkan `REDIS_URL` sebagai secret backend.
5. Tukar `LOGIN_PROTECTION_STORE=redis`.
6. Sahkan readiness lulus.
7. Jalankan controlled brute-force test pada akaun ujian dan sahkan 401, 429, serta `Retry-After`.
8. Pantau `login_protection_store_unavailable`, `login_account_locked`, dan `login_rate_limit_hit`.

### Credential Rotation

1. Cipta credential Redis baharu tanpa memadam credential lama.
2. Kemas kini `REDIS_URL` pada backend tanpa mencetak nilainya.
3. Redeploy/restart semua backend process supaya pool baharu digunakan.
4. Sahkan readiness dan controlled login test.
5. Revoke credential lama selepas semua process sihat.

### Rollback

Pilihan selamat utama ialah pulihkan Redis atau rollback backend/config kepada release terdahulu. Untuk rollback sementara ke memory, tetapkan `LOGIN_PROTECTION_STORE=memory` secara eksplisit dan redeploy; ini mengurangkan perlindungan kepada satu proses, menghapus shared lockout ketika restart, dan mesti direkod sebagai pengecualian keselamatan. Jangan bergantung pada fallback automatik.

`render.yaml` sengaja mengekalkan `LOGIN_PROTECTION_STORE=memory` untuk langkah deploy pertama. Tukar environment deployment kepada `redis` hanya selepas `REDIS_URL` tersedia dan readiness boleh disahkan.

> Status deployment repository: kod Redis sudah tersedia, tetapi `render.yaml` masih menggunakan memory mode. Deployment tidak distributed sehingga `LOGIN_PROTECTION_STORE=redis` dan secret `REDIS_URL` kedua-duanya ditetapkan.