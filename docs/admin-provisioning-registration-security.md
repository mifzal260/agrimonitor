# Provisioning Admin dan Keselamatan Pendaftaran

Tarikh: 23 Julai 2026
Status: implementasi dan ujian lokal; belum dideploy oleh tugasan ini

## 1. Objektif

Fasa ini menghapuskan laluan first-user auto-admin dan memisahkan dua operasi:

- pendaftaran awam hanya mencipta pengguna biasa;
- penciptaan admin hanya dibuat oleh operator melalui CLI backend.

Tiada endpoint bootstrap admin, token bootstrap, field admin tersembunyi atau fungsi frontend untuk mencipta admin.

## 2. Keputusan Reka Bentuk

Kaedah dipilih:

```bash
python -m app.cli.create_admin
```

CLI dipilih berbanding one-time bootstrap endpoint kerana:

- tidak menambah endpoint privileged yang boleh dicapai dari Internet;
- tidak memerlukan bootstrap token baharu;
- password dibaca melalui prompt tersembunyi, bukan argument command line;
- role `admin` ditetapkan server-side;
- kejayaan dan kegagalan direkod sebagai security event;
- duplicate email gagal dengan jelas dan unique constraint DB menangani race.

Operator mesti menjalankan command dalam environment backend yang mempunyai `DATABASE_URL` dan `JWT_SECRET_KEY` sah. Jangan masukkan password sebagai argument, shell history, fail dokumentasi atau log.

## 3. Pendaftaran Awam

`POST /api/v1/auth/register` menerima hanya:

```json
{
  "name": "Nama pengguna",
  "email": "user@example.com",
  "password": "password pengguna"
}
```

Kawalan:

- role sentiasa `user`, termasuk ketika database kosong;
- tiada kiraan pengguna untuk menentukan role;
- extra field ditolak dengan HTTP 422;
- `role`, `is_admin`, `is_superuser`, `permissions` dan field privileged lain tidak boleh mempengaruhi akaun;
- duplicate email memberi HTTP 409 dengan mesej neutral `Pendaftaran tidak dapat diproses.`;
- password dihash melalui direct bcrypt yang sama;
- duplicate serentak diselesaikan oleh unique constraint dan transaction rollback;
- akaun sedia ada dan role sedia ada tidak diubah.

## 4. Registration Rate Limit

Pendaftaran menggunakan protection service dan store yang sama seperti login. Jika runtime memilih Redis, state dikongsi antara process/instance. Tiada limiter memory production berasingan dicipta.

Default:

```env
REGISTRATION_RATE_LIMIT_ENABLED=true
REGISTRATION_MAX_ATTEMPTS_PER_EMAIL=5
REGISTRATION_EMAIL_WINDOW_SECONDS=1800
REGISTRATION_MAX_ATTEMPTS_PER_IP=10
REGISTRATION_IP_WINDOW_SECONDS=3600
```

Tingkah laku:
- FastAPI melakukan validasi schema dahulu; payload sah direkod oleh limiter sebelum DB insert;
- payload tidak sah direkod sekali dalam validation handler sebelum response 422, termasuk percubaan field privileged;
- setiap request dikira paling banyak sekali; hasil DB tidak menambah counter kali kedua;
- duplicate dan kegagalan DB tidak mereset atau mengurangkan bucket kerana request tetap menggunakan sumber;
- kegagalan DB bukan abuse hanya menghasilkan security event tambahan, bukan increment limiter tambahan;
- Redis Lua membuat semakan threshold dan rekod attempt secara atomik;
- memory mode dilindungi `RLock` dan state tamat tempoh diprun;
- member Redis menggunakan UUID unik supaya `ZADD` tidak menimpa attempt serentak;

- maksimum 5 percubaan setiap email ternormalisasi dalam 30 minit;
- maksimum 10 percubaan setiap IP dalam 60 minit;
- percubaan IP tidak direset apabila pendaftaran berjaya;
- key Redis menyimpan hash email dan hash IP, bukan nilai mentah;
- key mempunyai TTL;
- HTTP 429 menyertakan `Retry-After` integer positif;
- store unavailable menggunakan fail-closed HTTP 503;
- memory mode kekal untuk development dan ujian satu process.

Status production Redis yang diberikan operator ialah aktif. Tugasan ini tidak mengubah environment production. Walau bagaimanapun, `render.yaml` repository masih menetapkan `LOGIN_PROTECTION_STORE=memory`; semak override environment Render sebelum deployment supaya Blueprint tidak menurunkan distributed protection secara tidak sengaja.

## 5. Security Events

Logger: `agrimonitor.security`

Event baharu:

- `registration_success`;
- `registration_duplicate` dengan sebab dalaman `duplicate_email`;
- `registration_failed` bagi kegagalan lain seperti `creation_failed`;
- `registration_rate_limit_hit`;
- `registration_privileged_field_attempt`;
- `admin_provisioning_success`;
- `admin_provisioning_failed`.

Log menggunakan hash email dan hash operator. Ia tidak merekod password, request body, token, Authorization header atau email mentah. Kegagalan logging tidak menggagalkan pendaftaran atau provisioning DB yang berjaya.

## 6. Prosedur Provisioning Admin

Jalankan dari direktori `agrimonitor_backend` dalam shell operator yang selamat:

```bash
python -m app.cli.create_admin
```

CLI akan meminta:

1. nama admin;
2. email admin;
3. password melalui prompt tersembunyi;
4. pengesahan password melalui prompt tersembunyi.

Keputusan:

- input tidak sah: tiada akaun dicipta;
- password tidak sepadan: tiada akaun dicipta;
- email sudah wujud: command gagal tanpa mengubah role akaun tersebut;
- berjaya: akaun baharu mempunyai role `admin` dan ID sahaja dipaparkan.

CLI tidak menaik taraf pengguna biasa kepada admin. Promosi role sedia ada memerlukan workflow pentadbiran berasingan yang belum dibina.

## 7. Deployment Runbook

1. Semak diff dan pastikan tiada secret.
2. Jalankan backend serta frontend quality gate.
3. Sahkan environment registration threshold pada Render.
4. Sahkan runtime `LOGIN_PROTECTION_STORE` kekal pada nilai production yang diluluskan.
5. Deploy kod tanpa mengubah database schema.
6. Daftar satu akaun ujian awam dan sahkan role `user`.
7. Jalankan CLI dalam shell backend untuk mencipta admin ujian/operator yang diluluskan.
8. Login sebagai admin dan sahkan `/api/v1/auth/admin-check` memberi 200.
9. Login sebagai user biasa dan sahkan endpoint admin memberi 403.
10. Lakukan registration 429 test hanya dalam staging atau window terkawal.
11. Semak security events dan pastikan tiada password, token atau email mentah.

Tiada langkah deployment di atas dijalankan dalam tugasan implementasi ini.

## 8. Rollback

Database migration tidak diwujudkan, jadi tiada schema rollback.

Jika deployment bermasalah:

1. jangan padam atau turunkan role akaun sedia ada secara automatik;
2. pulihkan release aplikasi terakhir yang selamat;
3. jika release lama masih mempunyai first-user auto-admin, sekat endpoint `/api/v1/auth/register` pada edge sebelum rollback;
4. kekalkan Redis dan secret sedia ada;
5. semak `registration_duplicate`, `registration_failed` dan `registration_rate_limit_hit`;
6. selepas pemulihan, uji registration biasa, login, readiness dan authorization.

Rollback kepada first-user auto-admin tanpa menyekat registration tidak dianggap selamat.

## 9. Database

Migration tidak diperlukan:

- column `users.role` sudah `NOT NULL` dengan default DB `user`;
- model SQLAlchemy juga default `user`;
- unique constraint email sudah tersedia;
- public service kini menetapkan `user` secara eksplisit;
- provisioning service menetapkan `admin` secara eksplisit;
- data dan role akaun sedia ada tidak disentuh.

## 10. Risiko Baki

- MFA belum tersedia;
- JWT revocation/refresh rotation belum tersedia;
- email verification belum tersedia;
- WAF dan CAPTCHA belum tersedia;
- durability Redis bergantung pada plan dan konfigurasi platform;
- runtime Python production belum dipin dalam repository;
- advisori transitif `ecdsa 0.19.2` / `PYSEC-2026-1325` masih dipantau;
- CLI bergantung pada kawalan akses shell/operator platform.
