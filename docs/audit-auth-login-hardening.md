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

Implementasi semasa menggunakan in-memory state thread-safe (`RLock`). Bucket percubaan diprun mengikut window aktif, dan login berjaya membersihkan state akaun. Ini sesuai untuk satu instance Render dan development, tetapi tidak cukup untuk multi-instance atau restart-proof lockout.

Cadangan production seterusnya:

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

- State in-memory hilang selepas restart.
- State in-memory tidak dikongsi antara beberapa instance.
- Tiada refresh token/session revocation kerana MVP hanya menggunakan access token JWT.
- Tiada CAPTCHA/MFA/WAF.

## Respons Insiden

Jika brute force dikesan:

1. Semak log `agrimonitor.security` untuk `login_rate_limit_hit` dan `login_account_locked`.
2. Kenal pasti `source_ip`, `username_hash`, dan `request_id`.
3. Tambah sekatan di WAF/reverse proxy jika pola IP jelas.
4. Pertimbangkan pendekatan Redis untuk lockout yang kekal merentas restart.
5. Putar `JWT_SECRET_KEY` hanya jika token leak disyaki; ini akan membatalkan semua access token sedia ada.
