# Audit Pengukuhan Login dan Anti-Brute-Force

## Ringkasan

Pengukuhan login menambah perlindungan khusus pada `POST /api/v1/auth/login` tanpa mengubah kontrak token sedia ada. Sistem masih menggunakan access token JWT dan password bcrypt sedia ada.

## Endpoint dan Aliran Auth

- Login: `POST /api/v1/auth/login`
- Register: `POST /api/v1/auth/register`
- Current user: `GET /api/v1/auth/me`
- Admin check: `GET /api/v1/auth/admin-check`
- Password verification: `app.core.security.verify_password`
- Password hashing: `passlib` bcrypt melalui `CryptContext`
- Refresh token: belum wujud dalam MVP ini; tiada session revocation server-side untuk dilaksanakan tanpa reka bentuk baharu.

## Polisi Rate Limit dan Lockout

Default semasa:

```env
LOGIN_RATE_LIMIT_ENABLED=true
LOGIN_MAX_ATTEMPTS_PER_ACCOUNT=5
LOGIN_ACCOUNT_WINDOW_SECONDS=300
LOGIN_MAX_ATTEMPTS_PER_IP=15
LOGIN_IP_WINDOW_SECONDS=900
LOGIN_LOCKOUT_BASE_SECONDS=60
LOGIN_LOCKOUT_MAX_SECONDS=1800
TRUSTED_PROXY_IPS=
```

Polisi:

- IP: maksimum 15 percubaan login dalam 15 minit.
- Akaun/identiti: kegagalan berulang direkod mengikut email yang dinormalisasi dalam window 5 minit.
- Lockout progresif: kegagalan ke-5 dalam window mengunci 60 saat, kemudian berganda hingga maksimum 30 minit.
- Login berjaya reset counter akaun.
- State tamat tempoh diprun ketika request login seterusnya supaya bucket lama tidak terkumpul tanpa had.
- Respons lockout/rate limit: HTTP 429 dan `Retry-After`.
- Respons credential salah: HTTP 401 dengan mesej umum.

## Penyimpanan State

Implementasi menyediakan memory store thread-safe (`RLock`) untuk development dan Redis store atomik untuk production distributed. Login berjaya membersihkan state akaun tanpa membersihkan bucket IP.

Konfigurasi production:

- Gunakan Redis untuk shared distributed rate limiting.
- Simpan key berdasarkan hash username dan IP.
- Tetapkan TTL mengikut window dan lockout.
- Tambah skrip pentadbiran untuk reset lockout tertentu.

## Anti User Enumeration

Mesej gagal login diseragamkan:

```text
Nama pengguna atau kata laluan tidak sah.
```

Backend tidak membezakan kepada pengguna sama ada email tidak wujud atau password salah. Untuk mengurangkan beza masa respons, password untuk akaun tidak wujud tetap melalui dummy bcrypt verification.

## Security Logging

Logger: `agrimonitor.security`

Event yang direkod:

- `login_success`
- `login_failed`
- `login_rate_limit_hit`
- `login_account_locked`
- `login_locked_attempt`

Medan utama:

- `event`
- `username_hash`
- `source_ip`
- `user_agent`
- `request_id`
- `failure_reason`
- `attempt_count`
- `lockout_seconds`

Larangan dipatuhi:

- Password tidak direkod.
- Access token tidak direkod.
- Authorization header tidak direkod.

## Trusted Proxy

Aplikasi tidak mempercayai `X-Forwarded-For` secara automatik. Header itu hanya digunakan jika `request.client.host` berada dalam `TRUSTED_PROXY_IPS`.

Jika menggunakan reverse proxy, hanya IP proxy yang dikawal sendiri patut dimasukkan. Render tidak menjamin nilai ini mudah disahkan daripada aplikasi, jadi untuk deployment Render biasa biarkan `TRUSTED_PROXY_IPS` kosong supaya `X-Forwarded-For` tidak boleh dipalsukan melalui header.

## Nginx / Reverse Proxy

Repository ini tidak mempunyai konfigurasi Nginx. Perlindungan backend tetap aktif. Jika Nginx ditambah kemudian, gunakan rate limit tambahan pada laluan login seperti konsep berikut:

```nginx
limit_req_zone $binary_remote_addr zone=login_limit:10m rate=5r/m;

location /api/v1/auth/login {
    limit_req zone=login_limit burst=3 nodelay;
    limit_req_status 429;
    proxy_pass http://backend;
}
```

## CAPTCHA / Step-Up

Tiada vendor CAPTCHA ditambah. Extension point boleh dibina selepas beberapa kegagalan menggunakan counter yang sama, tetapi backend mesti mengesahkan challenge. Jangan bergantung kepada frontend sahaja.

## Had Implementasi

- Memory mode hilang selepas restart dan hanya sesuai untuk development/satu proses.
- Redis ialah dependency tunggal bagi login dalam Redis fail-closed mode; outage Redis akan menutup login.
- Tiada refresh token/session revocation kerana MVP hanya menggunakan access token JWT.
- Tiada CAPTCHA/MFA/WAF.

## Respons Insiden

Jika brute force dikesan:

1. Semak log `agrimonitor.security` untuk `login_rate_limit_hit` dan `login_account_locked`.
2. Kenal pasti `source_ip`, `username_hash`, dan `request_id`.
3. Tambah sekatan di WAF/reverse proxy jika pola IP jelas.
4. Semak availability dan latency Redis serta readiness backend.
5. Putar `JWT_SECRET_KEY` hanya jika token leak disyaki; ini akan membatalkan semua access token sedia ada.

## Fasa Redis Distributed Login Protection

### Reka Bentuk Storage

Polisi login kini dipisahkan daripada backend penyimpanan melalui `LoginProtectionStore`. Dua implementasi disediakan:

- `InMemoryLoginProtectionStore` untuk development dan ujian asas satu proses.
- `RedisLoginProtectionStore` untuk shared state production merentas worker/instance dan restart aplikasi.

`LoginProtectionService` kekal bertanggungjawab terhadap normalisasi identiti, polisi threshold, respons HTTP, dan security logging. Route serta auth service tidak mengetahui command Redis. Backend kekal synchronous (SQLAlchemy, bcrypt, dan route login), maka client Redis synchronous digunakan dalam worker thread FastAPI dengan satu connection pool bagi setiap proses.

### Atomicity dan Key Design

Dua skrip Lua menjalankan operasi compound secara atomik:

1. prune sliding IP window, semak threshold IP, rekod attempt, prune account failure window, dan semak lockout;
2. prune account failure window, rekod failure, tentukan threshold, cipta progressive lockout, serta kemas kini TTL.

Masa production datang daripada command Redis `TIME`, bukan jam worker. Ini mengelakkan perbezaan jam antara instance. Login berjaya menggunakan satu command `DEL` atomik untuk membuang state account sahaja; bucket IP tidak direset.

Key:

```text
<REDIS_KEY_PREFIX>:account:<sha256-normalized-email>
<REDIS_KEY_PREFIX>:failures:<sha256-normalized-email>
<REDIS_KEY_PREFIX>:ip:<sha256-source-ip>
```

Semua key mempunyai TTL. Email dan IP mentah tidak berada dalam key; password dan token tidak dihantar ke store. Operasi login biasa tidak menggunakan `KEYS` atau scan Redis.

### Konfigurasi

```env
LOGIN_PROTECTION_STORE=memory
LOGIN_PROTECTION_FAIL_MODE=closed
REDIS_URL=
REDIS_KEY_PREFIX=agrimonitor:login-protection
REDIS_SOCKET_TIMEOUT_SECONDS=2
REDIS_CONNECT_TIMEOUT_SECONDS=2
REDIS_HEALTH_CHECK_INTERVAL_SECONDS=30
REDIS_MAX_CONNECTIONS=20
```

`LOGIN_PROTECTION_STORE=redis` mewajibkan `REDIS_URL`. Store tidak sah, prefix kosong, timeout bukan positif, dan fail mode selain `closed` ditolak ketika konfigurasi dimuatkan. `REDIS_URL` tidak direkod atau dipulangkan kepada client.

### Failure dan Readiness

Fail mode yang disokong ialah `closed`. Jika Redis timeout, unavailable, atau memulangkan respons malformed:

- login ditolak dengan HTTP 503 dan mesej generik;
- event `login_protection_store_unavailable` direkod tanpa credential Redis;
- tiada fallback senyap kepada memory;
- `/health` kekal menunjukkan proses hidup;
- `/health/ready` dan `/api/v1/health/ready` gagal dengan 503 apabila Redis diwajibkan tetapi tidak boleh dicapai.

Pool dibuat sekali ketika lifespan process bermula dan ditutup ketika shutdown. Startup membuat ping awal untuk logging, tetapi proses kekal hidup supaya health endpoint dan diagnosis kekal tersedia; readiness tetap gagal sehingga Redis pulih.

### Polisi Yang Dikekalkan

- 5 kegagalan akaun dalam sliding window 300 saat.
- 15 percubaan IP dalam sliding window 900 saat.
- Lockout 60 saat, berganda hingga maksimum 1800 saat.
- Unknown dan valid account melalui limiter serta bcrypt verification yang sama.
- `Retry-After` ialah baki integer saat sebenar.
- Login berjaya reset account state tetapi tidak reset IP state.

Memory mode masih hilang ketika restart dan tidak sesuai untuk deployment production multi-instance. Redis mode disyorkan untuk production.

### Keputusan Audit Client dan Dependency

Route login dan kedua-dua readiness endpoint ialah synchronous `def`, maka FastAPI menjalankannya dalam worker thread. Ping startup dan penutupan pool dari lifespan async dijalankan melalui `run_in_threadpool`; tiada panggilan Redis blocking dibuat terus pada event loop dan tiada thread dicipta bagi setiap request. Satu pool dibuat bagi setiap process dengan default maksimum 20 connection serta socket/connect timeout 2 saat.

`python-jose` membawa dependency transitif `ecdsa 0.19.2` yang mempunyai advisori tanpa versi pembaikan tersedia. Konfigurasi JWT semasa menggunakan HS256, jadi laluan ECDSA yang terjejas tidak digunakan oleh aplikasi ketika ini; dependency tersebut tetap tidak dianggap bebas risiko dan mesti terus dipantau. Pertukaran library JWT berada di luar skop fasa ini.