# Keselamatan AgriMonitor Semasa

Tarikh semakan: 23 Julai 2026
Skop: repository, konfigurasi deployment dalam Git, dan verifikasi awam terkawal
Commit deployment: `9c6f7c6 fix(auth): secure registration and admin provisioning`

## 1. Ringkasan Eksekutif

AgriMonitor mempunyai kawalan asas yang baik untuk sebuah MVP: password dihash dengan bcrypt, autentikasi menggunakan JWT bertempoh, endpoint data memerlukan pengguna sah, pemilikan rekod dikuatkuasakan pada backend, peranan admin diperiksa pada server, konfigurasi production mempunyai guard keselamatan, dan login mempunyai rate limit serta lockout progresif.

Tahap semasa belum boleh dianggap sebagai keselamatan production matang. Risiko paling penting ialah:

1. pengukuhan registration/admin telah dideploy dan disahkan melalui API awam, tetapi Render log, DB dan Render Shell belum diaudit;
2. runtime Redis dilaporkan aktif oleh operator tetapi `render.yaml` masih menggunakan memory mode;
3. JWT tidak mempunyai refresh-token rotation atau server-side revocation;
4. token frontend boleh dicapai JavaScript kerana disimpan dalam `sessionStorage`;
5. MFA, CAPTCHA, WAF dan security-header policy khusus belum tersedia;
6. dependency transitif `ecdsa 0.19.2` mempunyai advisori `PYSEC-2026-1325`;
7. log dan environment Render tidak dapat diaudit daripada repository.

Dokumen ini membezakan **implemented**, **configured in Git**, **verified locally**, dan **verified in production**. Kewujudan kod tidak dengan sendirinya membuktikan sesuatu kawalan aktif di production.

## 2. Status Kawalan

| Kawalan | Status semasa | Bukti atau batasan |
| --- | --- | --- |
| Direct bcrypt password hashing | Implemented dan diuji | `bcrypt 5.x`, `$2b$`, cost 12 |
| Polisi password | Implemented | Minimum 8 aksara; maksimum 72 byte UTF-8 |
| Keserasian hash lama | Diuji secara lokal | Fixture `$2a$`, `$2b$` dan cost 10 lulus |
| JWT access token | Implemented | HS256, `sub`, `role`, `exp`; default 1440 minit |
| Server-side authorization | Implemented | Pengguna dan peranan semasa dibaca daripada DB |
| Data ownership | Implemented dan diuji | Query rekod ditapis menggunakan `user_id` semasa |
| Public registration role | Verified in production | Registration 201 menghasilkan `user`; privileged payload ditolak 422 |
| Operator admin provisioning | Implemented; sebahagian verified | Modul CLI/getpass tersedia dan tiada endpoint bootstrap; Render Shell belum diuji |
| Generic login failure | Implemented dan API production diuji | 401 tidak mendedahkan sama ada akaun wujud |
| Anti user-enumeration timing | Implemented dan diuji | Akaun tidak wujud tetap menjalankan dummy bcrypt |
| Login rate limit dan lockout | Implemented | 5 kegagalan akaun/5 minit; 15 percubaan IP/15 minit |
| Distributed Redis protection | Dilaporkan aktif oleh operator | `render.yaml` masih memory; environment Render perlu disahkan |
| Production Redis verification | Sebahagian | Readiness lulus; persistence dan multi-instance belum dibuktikan |
| Production config validation | Implemented | Menolak secret lemah, CORS `*`, DB localhost dan DB preparation ketika startup |
| Readiness | Implemented dan endpoint awam diuji | Menyemak DB dan login protection store yang dipilih |
| Security logging | Implemented | Event login tanpa password/token; log production belum diaudit |
| Frontend token storage | Risiko diterima | `sessionStorage`; masih boleh dicapai jika berlaku XSS |
| MFA/CAPTCHA/WAF | Belum | Memerlukan fasa keselamatan berasingan |
| Session revocation | Belum | JWT sah sehingga `exp` kecuali secret diputar |

## 3. Autentikasi dan Password

Backend menggunakan library rasmi `bcrypt` secara terus tanpa Passlib:

- dependency `bcrypt>=5.0.0,<6.0.0`;
- hash baharu menggunakan prefix `$2b$`;
- work factor 12 rounds;
- salt rawak dijana bagi setiap password;
- hash password tidak dipulangkan melalui respons API.

Bcrypt mempunyai had input 72 byte. AgriMonitor mengukur password selepas encoding UTF-8. Pendaftaran menolak input yang lebih panjang tanpa pemotongan senyap. Login dengan input terlalu panjang menjalankan satu operasi dummy bcrypt dan gagal secara generik. Polisi semasa menetapkan minimum 8 aksara tetapi belum menyemak password bocor, entropy atau senarai password lazim.

Login gagal menggunakan mesej yang sama untuk akaun tidak wujud dan password salah:

```text
Nama pengguna atau kata laluan tidak sah.
```

Akaun tidak wujud tetap melalui dummy bcrypt verification. Security event menggunakan hash identiti, bukan email mentah.

## 4. JWT dan Sesi

Access token HS256 mengandungi `sub`, `role` dan `exp`. Backend mengesahkan token, membaca ID pengguna dan mendapatkan semula pengguna daripada DB. Pemeriksaan admin menggunakan peranan semasa daripada rekod DB, bukan hanya tuntutan role token.

Had semasa:

- tiada refresh token atau rotation;
- tiada logout/revocation server-side;
- tiada senarai token yang dibatalkan;
- putaran `JWT_SECRET_KEY` membatalkan semua token.

Frontend menyimpan token dalam `sessionStorage` dan membuang salinan legacy daripada `localStorage`. Persistence lebih terhad, tetapi token masih terdedah jika berlaku XSS. Aplikasi tidak menggunakan cookie autentikasi, maka risiko CSRF berasaskan cookie berkurang; ini bukan pengganti kawalan XSS.

## 5. Authorization dan Pemilikan Data

Operasi monitoring, kewangan, dashboard, cadangan dan alert menggunakan `current_user.id` pada query backend.

- rekod tanaman, aktiviti, simptom, kos dan hasil disaring mengikut `user_id`;
- child resource diperiksa terhadap pemilik sebelum dicipta atau diubah;
- operasi tulis harga pasaran dan import CSV memerlukan admin;
- authorization dibuat pada backend, bukan berdasarkan paparan frontend.

First-user auto-admin telah dibuang dan tingkah laku production disahkan pada 23 Julai 2026. Pendaftaran awam menetapkan `user`; admin baharu hanya boleh diwujudkan oleh operator melalui `python -m app.cli.create_admin`. Tiada endpoint bootstrap diterbitkan.

## 6. Perlindungan Login

Default polisi:

```env
LOGIN_RATE_LIMIT_ENABLED=true
LOGIN_MAX_ATTEMPTS_PER_ACCOUNT=5
LOGIN_ACCOUNT_WINDOW_SECONDS=300
LOGIN_MAX_ATTEMPTS_PER_IP=15
LOGIN_IP_WINDOW_SECONDS=900
LOGIN_LOCKOUT_BASE_SECONDS=60
LOGIN_LOCKOUT_MAX_SECONDS=1800
LOGIN_PROTECTION_FAIL_MODE=closed
```

Sistem menyediakan sliding window akaun/IP, lockout progresif 60 hingga 1800 saat, HTTP 429 dengan `Retry-After`, trusted-proxy validation dan security logging. Login berjaya membersihkan state akaun tetapi bukan bucket IP.

### Status Redis

Kod mempunyai memory store dan Redis store atomik berasaskan Lua. Redis mode boleh berkongsi state antara worker/instance dan menggunakan masa Redis.

Status production yang diberikan operator menyatakan Redis-backed login protection aktif dan readiness lulus. Tugasan semasa tidak mengubah environment tersebut. Namun, `render.yaml` repository masih menetapkan `LOGIN_PROTECTION_STORE=memory`; semak override Render sebelum deploy supaya Blueprint tidak menurunkan perlindungan kepada memory mode.

Readiness 200 sahaja tidak membuktikan Redis aktif kerana memory store juga boleh lulus readiness. Persistence selepas restart, multi-instance dan failure drill masih memerlukan bukti berasingan.

## 7. Konfigurasi, Secret dan CORS

Apabila `APP_ENV=production`, aplikasi menolak startup jika CORS mengandungi `*`, database menggunakan localhost, JWT secret ialah placeholder/kurang 32 aksara, atau database preparation diaktifkan ketika startup.

`render.yaml` tidak mengandungi nilai literal `DATABASE_URL`, `JWT_SECRET_KEY` atau `REDIS_URL`; nilai ditandakan sebagai secret deployment. CORS repository mengehadkan origin kepada frontend Render yang dinyatakan.

## 8. Input, Database dan Error Handling

- Request disahkan menggunakan Pydantic.
- Query dibina melalui SQLAlchemy, bukan string SQL pengguna.
- Session DB di-rollback apabila request gagal.
- Import CSV dihadkan kepada 1 MiB dan 5000 baris serta memerlukan admin.
- Exception tidak dijangka dipulangkan sebagai `Internal server error`.

Retention, akses dan redaction log deployment masih perlu ditetapkan sebagai kawalan operasi.

## 9. Health dan Bukti Verifikasi

- `/health`: liveness proses;
- `/health/ready`: database dan login protection store;
- `/api/v1/health/ready`: database dan login protection store.

Verifikasi awam pada 23 Julai 2026:

| Ujian | Keputusan |
| --- | --- |
| Tiga endpoint health/readiness selepas rollout | 200 |
| OpenAPI public registration | `additionalProperties: false`; tiada bootstrap route |
| Registration biasa | 201, token diterima, role `user` |
| Privileged payload `role=admin` | 422; identiti tidak boleh login (401) |
| Duplicate registration | 409 dengan mesej neutral |
| Authorization user biasa | Endpoint admin menolak dengan 403 |
| Admin sedia ada | Tidak diuji; tiada credential operator |
| CLI production | Modul/getpass disahkan lokal; Render Shell tidak tersedia |
| Audit DB dan log Render | Tidak dijalankan; tiada akses dashboard/log/DB |
| `/auth/me` | Tidak dijalankan; authorization disahkan melalui admin-check 403 |

Verification pertama berlaku ketika release lama masih live dan menghasilkan dua akaun ujian biasa sebelum rollout dikesan melalui OpenAPI. Identiti tidak direkod dalam dokumen; operator perlu menilai pembersihan melalui proses data yang diluluskan.

HTTP 200 tidak mengenal pasti commit, runtime Python, mode Redis atau kandungan log.

Quality gate commit direct bcrypt:

- Python 3.12.2 dan Python 3.14.6: 89 ujian lulus setiap satu;
- `compileall` dan `pip check`: lulus;
- bcrypt 5.0.0; Passlib tidak dipasang;
- warning Passlib/bcrypt tidak muncul dalam ujian.

Python 3.14 menghasilkan satu `StarletteDeprecationWarning` test-only berkaitan httpx, bukan warning bcrypt.

## 10. Risiko Baki dan Keutamaan

### Keutamaan tinggi

1. Semak dan bersihkan akaun verification sementara melalui proses operator yang diluluskan jika tidak lagi diperlukan.
2. Sahkan environment Redis production kekal aktif walaupun Blueprint Git masih memory.
3. Sahkan Render log, DB role, CLI melalui Render Shell dan akses admin sedia ada tanpa mendedahkan credential.

### Keutamaan sederhana

1. Tambah refresh-token rotation, session revocation dan MFA admin.
2. Tambah CSP, security headers dan WAF/edge rate limiting.
3. Nilai migrasi password kepada Argon2id dengan rehash semasa login.
4. Tetapkan retention dan akses security log.
5. Pin runtime Python selepas versi production dikenal pasti.

### Perlu dipantau

1. Akaun historikal dengan password melebihi 72 byte.
2. `ecdsa 0.19.2` / `PYSEC-2026-1325`; aplikasi menggunakan HS256, bukan laluan ECDSA.
3. Risiko XSS terhadap bearer token dalam `sessionStorage`.
4. Password bocor/lazim dan CAPTCHA belum diperiksa.

## 11. Checklist Operasi Production

1. Jalankan suite backend penuh dan dependency check.
2. Pastikan tiada secret atau credential production dalam diff.
3. Sahkan secret, CORS dan mode login protection melalui dashboard.
4. Sahkan build dan startup log.
5. Uji liveness dan kedua-dua readiness endpoint.
6. Lakukan satu login sah menggunakan akaun ujian dan uji `/auth/me`.
7. Lakukan satu login salah sahaja dan sahkan respons generik.
8. Pastikan log tidak mengandungi password, token, Authorization header, Redis URL atau email mentah.
9. Jalankan lockout, distributed state atau failure drill hanya di staging atau maintenance window.

## 12. Dokumen Berkaitan

- `docs/audit-auth-login-hardening.md`
- `docs/deployment-render-neon.md`
- `docs/audit-agrimonitor-fasa-8-0-backend-production-readiness.md`
- `docs/dokumentasi-projek-agrimonitor.md`
- `docs/admin-provisioning-registration-security.md`
Jika dokumen lama bercanggah dengan status deployment ini, semak `render.yaml` dan environment Render sebenar. Environment production ialah sumber kebenaran akhir bagi kawalan yang aktif.
