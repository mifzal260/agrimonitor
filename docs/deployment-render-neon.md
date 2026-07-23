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

### Rekod Activation Deployment (23 Julai 2026)

**Status semasa: Redis login protection telah tersedia dalam kod tetapi belum diaktifkan pada deployment production.**

| Tahap | Maksud | Status |
| --- | --- | --- |
| Implemented | Kod Redis distributed login protection tersedia dan diuji dalam repository. | Selesai |
| Provisioned | Render Key Value telah diwujudkan dalam workspace dan region backend. | Belum |
| Configured | `REDIS_URL` dan environment variables deployment telah dipasang. | Belum |
| Activated | `LOGIN_PROTECTION_STORE=redis` telah ditetapkan pada production. | Belum |
| Verified | Login, readiness, restart dan distributed state telah diuji pada deployment. | Belum |

Deployment runbook telah disediakan. Ia tidak bermaksud provisioning, configuration, activation atau verification telah selesai.

Status yang boleh disahkan tanpa akses Render Dashboard:

- Service backend dalam Blueprint bernama `agrimonitor-backend`, jenis Render web service dengan runtime Python.
- Repository mempunyai `render.yaml` yang serasi dengan Render Blueprint, tetapi pautan Blueprint kepada service sebenar tidak boleh dibuktikan daripada repository atau endpoint awam.
- Region backend tidak dinyatakan dalam Blueprint dan tidak didedahkan oleh endpoint awam. Jangan provision Key Value sebelum region sebenar disahkan dalam Dashboard; region service tidak boleh ditukar selepas penciptaan.
- Commit Redis `48ba06c` belum berada pada `origin/main` ketika audit, jadi fasa deploy kod Redis dalam memory mode belum boleh dianggap selesai hanya berdasarkan keadaan Git tempatan.
- Deployment awam memberi HTTP 200 untuk `/health`, `/health/ready`, dan `/api/v1/health/ready` pada 23 Julai 2026. Respons tidak mendedahkan Redis URL atau hostname.
- Mod Redis sebenar, nilai secret, bilangan instance, dan log runtime tidak boleh diperiksa tanpa akses workspace Render. Oleh itu Redis **belum disahkan aktif** dan status selamat kekal `LOGIN_PROTECTION_STORE=memory`.
- Controlled login test, distributed-state test, restart/deploy persistence test, dan Redis failure drill tidak dijalankan terhadap production kerana tiada akaun ujian atau maintenance window yang diluluskan.

`render.yaml` menetapkan `healthCheckPath: /health` dan semua nilai operasi Redis secara eksplisit, tetapi sengaja mengekalkan memory mode sehingga migrasi berperingkat di bawah selesai.

### Provisioning Render Key Value Secara Manual

Gunakan Render Dashboard kerana region sebenar dan hubungan Blueprint tidak tersedia dalam sesi ini:

1. Buka `agrimonitor-backend` dan catat region serta workspace sebenar.
2. Cipta Render Key Value dalam workspace dan region yang sama. Render Key Value baharu menggunakan Valkey yang serasi dengan protokol Redis dan menyokong Lua.
3. Sekat semua sambungan external; gunakan internal connection URL sahaja. Jangan salin URL ke repository, log, frontend, tiket, atau laporan.
4. Pilih `noeviction`. Apabila memori penuh, write akan gagal dan login fail-closed; key perlindungan tidak akan dibuang secara rawak.
5. Untuk staging kos minimum, pelan Free boleh digunakan tetapi persistence tidak tersedia dan state hilang apabila instance restart/upgrade. Untuk production yang memerlukan durability, gunakan sekurang-kurangnya pelan berbayar dengan `Journal + Snapshot`; ia boleh kehilangan sehingga kira-kira satu saat write ketika failure.
6. Tetapkan internal connection URL sebagai secret `REDIS_URL` pada backend. Untuk service sedia ada, `sync: false` dalam kemas kini Blueprint tidak meminta nilai baharu, maka nilai mesti dimasukkan melalui Dashboard.
7. Kekalkan `LOGIN_PROTECTION_STORE=memory`, deploy commit Redis, kemudian sahkan tiga endpoint readiness dan satu login akaun ujian.
8. Selepas baseline lulus, tukar `LOGIN_PROTECTION_STORE=redis` dan redeploy. Jangan ubah nilai berikut:

```text
LOGIN_PROTECTION_FAIL_MODE=closed
REDIS_KEY_PREFIX=agrimonitor:login-protection
REDIS_SOCKET_TIMEOUT_SECONDS=2
REDIS_CONNECT_TIMEOUT_SECONDS=2
REDIS_HEALTH_CHECK_INTERVAL_SECONDS=30
REDIS_MAX_CONNECTIONS=20
```

### Verification Selepas Activation

Rekod keputusan sebenar, bukan keputusan jangkaan:

| Pemeriksaan | Keputusan minimum |
| --- | --- |
| `/health` | 200 walaupun Redis gagal |
| `/health/ready` | 200 ketika Redis tersedia; 503 ketika Redis gagal |
| `/api/v1/health/ready` | 200 ketika Redis tersedia; 503 ketika Redis gagal |
| Login normal | Berfungsi menggunakan akaun ujian |
| Lima password salah | Lockout 60 saat, mesej generik, `Retry-After` integer |
| IP limiter | Percubaan ke-16 ditolak; uji di staging jika NAT dikongsi |
| Login selepas lockout | Counter akaun direset, bucket IP kekal |
| Dua instance/worker | Instance kedua melihat state yang ditulis instance pertama |
| Restart/deploy | Lockout kekal hanya jika Key Value persistence berfungsi |
| Failure drill | Readiness dan login 503, `/health` 200, pulih selepas Redis dipulihkan |

Jika hanya satu instance tersedia, nyatakan bahawa shared Redis aktif tetapi sifat multi-instance belum dibuktikan. Jalankan failure drill hanya di staging atau maintenance window. Semak log untuk `login_success`, `login_failed`, `login_rate_limit_hit`, `login_account_locked`, `login_locked_attempt`, dan `login_protection_store_unavailable`; log tidak boleh mengandungi password, token, Authorization header, Redis URL, atau email mentah.

### Operasi dan Rollback

Pantau connected clients, memory, latency, rejected connections, evictions, expiry, pool exhaustion, dan error count menggunakan metrics sedia ada Render. Aplikasi menggunakan satu pool bagi setiap process, maksimum 20 connection, timeout dua saat, Lua atomik, dan tidak menggunakan `KEYS` atau scan pada laluan login.

Jika activation gagal, tukar `LOGIN_PROTECTION_STORE=memory` dan redeploy. Jangan padam Key Value atau `REDIS_URL` ketika rollback awal. Memory mode menghilangkan perlindungan distributed dan tidak menggunakan lockout Redis yang masih aktif; ia hanya rollback kecemasan sementara punca kegagalan disiasat.

## 7. Deployment Pengukuhan Pendaftaran dan Admin

Environment backend:

```env
REGISTRATION_RATE_LIMIT_ENABLED=true
REGISTRATION_MAX_ATTEMPTS_PER_EMAIL=5
REGISTRATION_EMAIL_WINDOW_SECONDS=1800
REGISTRATION_MAX_ATTEMPTS_PER_IP=10
REGISTRATION_IP_WINDOW_SECONDS=3600
```

Limiter menggunakan protection store yang sama dengan login. Sebelum deploy, sahkan nilai runtime `LOGIN_PROTECTION_STORE` di dashboard; `render.yaml` masih mempunyai baseline memory dan tidak boleh digunakan untuk menyimpulkan override production.

Runbook:

1. Deploy kod selepas quality gate lulus.
2. Daftar akaun ujian awam dan sahkan role `user`.
3. Buka shell backend yang hanya boleh dicapai operator.
4. Jalankan `python -m app.cli.create_admin`.
5. Masukkan password melalui prompt tersembunyi, bukan argument CLI.
6. Login sebagai admin dan sahkan `/api/v1/auth/admin-check` memberi 200.
7. Sahkan pengguna biasa mendapat 403 pada endpoint admin.
8. Semak event registration/admin dan pastikan tiada password, token atau email mentah.

Tiada migration diperlukan dan role akaun sedia ada tidak berubah.

Rollback:

- kekalkan Redis, secret dan role pengguna sedia ada;
- pulihkan release terakhir yang selamat;
- jika release rollback mempunyai first-user auto-admin, sekat `/api/v1/auth/register` pada edge sebelum rollback;
- jangan rollback kepada first-user auto-admin dengan registration awam terbuka;
- uji readiness, registration user, login dan authorization selepas pemulihan.

Butiran lengkap: `docs/admin-provisioning-registration-security.md`.
