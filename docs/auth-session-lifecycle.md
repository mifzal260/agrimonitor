# Auth Session Lifecycle

Tarikh reka bentuk: 23 Julai 2026
Status: implemented dan diuji secara lokal; belum di-commit, push atau deploy.

## Seni bina

AgriMonitor menggunakan dua credential:

- access token ialah JWT HS256 selama 15 minit. Claim minimum ialah `sub`, `iat`, `exp`, `jti` unik dan `session_id`; role dan email tidak dimasukkan. Authorization tetap mengambil pengguna dan role semasa daripada DB;
- refresh token ialah opaque URL-safe CSPRNG 48 byte (384 bit). Nilai raw hanya dipulangkan kepada client dan SHA-256 sahaja disimpan untuk lookup. Bcrypt tidak digunakan kerana token sudah mempunyai entropy tinggi.

Setiap login atau pendaftaran menghasilkan satu `auth_sessions` per peranti dan satu rekod awal `auth_refresh_tokens`. Jadual token menyimpan sejarah rotation supaya replay token lama boleh dikenal pasti. `family_id`, ID sesi dan ID token ialah UUID rawak.

### Jadual dan index

`auth_sessions` menyimpan `user_id`, `family_id`, waktu cipta/tamat/terakhir guna/revoke/reuse, sebab revoke, hash user-agent, hash IP dan sumber login. Index disediakan untuk `user_id`, `family_id` dan `expires_at`; `family_id` juga unik.

`auth_refresh_tokens` menyimpan `session_id`, hash token unik, waktu cipta/tamat/guna/revoke dan `replaced_by_token_id`. Index disediakan untuk `session_id` dan `expires_at`. Foreign key menggunakan cascade yang sesuai. Migration `20260723_0007_add_auth_sessions.py` mempunyai upgrade dan downgrade tanpa mengubah rekod pengguna sedia ada.

## Lifecycle dan API

1. Credential login disahkan dan limiter login direset seperti sebelumnya.
2. User row dikunci, expired session pengguna dibersihkan secara lazy, dan had sesi dikuatkuasakan.
3. Session, hash refresh token dan access token dibina dalam satu transaksi. Pendaftaran pengguna+sesi juga satu transaksi.
4. `POST /api/v1/auth/refresh` menggunakan token tepat sekali. Token lama ditanda `used_at`, token pengganti disimpan, `last_used_at` dikemas kini dan pasangan baharu dipulangkan secara atomik.
5. Penggunaan semula token lama dianggap kemungkinan kecurian: seluruh sesi/family direvoke, `reuse_detected_at` ditetapkan, event direkod, dan respons kekal 401 generik.
6. `POST /api/v1/auth/logout` merevoke sesi semasa secara idempotent. `POST /api/v1/auth/logout-all` merevoke semua sesi pengguna.
7. `POST /api/v1/auth/change-password` menyemak password semasa, menukar hash dan merevoke semua sesi dalam transaksi yang sama.

Access token tidak diblacklist secara global. Selepas logout/revocation ia boleh kekal sah sehingga maksimum 15 minit; refresh seterusnya gagal. Model `User` semasa tiada status disabled dan tiada endpoint perubahan role admin, maka revocation untuk tindakan itu belum terpakai. Dependency authorization tetap membaca user/role semasa daripada DB.

## Rotation, concurrency dan had sesi

Refresh menggunakan row lock serta conditional update `used_at IS NULL AND revoked_at IS NULL`. Pada PostgreSQL, dua permintaan terhadap token sama tidak boleh kedua-duanya berjaya; permintaan kalah menjadi replay dan merevoke chain. Frontend pula menggunakan single-flight supaya tab yang mempunyai beberapa request 401 hanya menghantar satu refresh dan retry setiap request asal maksimum sekali.

Default `MAX_ACTIVE_SESSIONS_PER_USER=10`. Login baharu merevoke sesi aktif yang `last_used_at` paling lama apabila had dicapai. User row lock menserialkan penciptaan sesi per pengguna.

## Penyimpanan frontend

Frontend dan backend Render menggunakan origin berlainan. Fasa ini memilih `sessionStorage` sementara untuk access dan refresh token; refresh token tidak pernah masuk `localStorage`, dan salinan access-token legacy dalam `localStorage` dipindah/dibuang. Logout backend dicuba dahulu dan local token sentiasa dibersihkan dalam `finally`.

Ini masih terdedah kepada XSS kerana JavaScript boleh membaca `sessionStorage`. CSP dan pengukuhan XSS ialah fasa wajib seterusnya. HttpOnly cookie tidak digunakan sekarang kerana cross-site cookie memerlukan `Secure`, `SameSite=None`, `credentials`, polisi CORS tepat, mitigasi CSRF dan pertimbangan sekatan third-party cookie. Jika berpindah kepada cookie, audit reka bentuk itu dahulu; cookie bukan perubahan drop-in.

## Konfigurasi

```env
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=14
REFRESH_TOKEN_ROTATION_ENABLED=true
REFRESH_TOKEN_REUSE_DETECTION_ENABLED=true
MAX_ACTIVE_SESSIONS_PER_USER=10
SESSION_CLEANUP_BATCH_SIZE=500
ALLOW_LEGACY_ACCESS_TOKENS=true
```

Production menolak access expiry melebihi 15 minit; semua environment menolak rotation/reuse detection yang dimatikan. Refresh mesti hidup lebih lama daripada access token. `ALLOW_LEGACY_ACCESS_TOKENS=true` ialah flag rollout sementara untuk JWT lama tanpa `session_id`; tetapkan `false` hanya selepas tempoh token lama berlalu dan frontend baharu stabil.

## Cleanup

Jalankan daripada root backend melalui operator/cron sedia ada:

```bash
python -m app.cli.cleanup_auth_sessions
```

Command memadam expired sessions secara batch, idempotent, mencetak jumlah sahaja dan tidak mencetak token/hash. Lazy cleanup turut berlaku semasa penciptaan sesi. Scheduler baharu tidak ditambah.

## Security logging

Event termasuk `session_created`, `refresh_success`, `refresh_failed`, `refresh_token_reuse_detected`, `session_revoked`, `logout_success`, `logout_all`, `sessions_revoked_password_change`, `max_session_limit_enforced` dan `session_cleanup`. Identiti user/session/IP dihash; logger tidak menerima access token, refresh token, token hash, password, Authorization header atau request body.

## Deployment order

1. Backup DB dan rekod release semasa.
2. Jalankan `alembic upgrade head` pada database sasaran sebelum backend baharu menerima trafik.
3. Deploy backend dengan endpoint baharu dan `ALLOW_LEGACY_ACCESS_TOKENS=true`.
4. Smoke-test login, refresh dua kali (rotation), `/auth/me`, logout dan readiness.
5. Deploy frontend yang menyokong single-flight refresh.
6. Pantau 401/503/replay event dan session growth sekurang-kurangnya satu refresh lifetime operasi yang dipersetujui.
7. Selepas maksimum lifetime access token lama dan rollout stabil, tetapkan `ALLOW_LEGACY_ACCESS_TOKENS=false` dalam release berasingan.
8. Jadualkan cleanup command menggunakan mekanisme operator/cron yang tersedia.

Jangan deploy frontend refresh sebelum migration dan backend tersedia. Perubahan ini tidak menukar `LOGIN_PROTECTION_STORE`, `REDIS_URL`, atau Redis production.

## Rollback

Rollback aplikasi sahaja kepada backend lama masih membiarkan jadual tambahan yang tidak merosakkan data lama. Kekalkan `ALLOW_LEGACY_ACCESS_TOKENS=true` semasa rollback. Jika benar-benar perlu mengundur schema, hentikan backend baharu, pastikan tiada sesi baharu diperlukan, kemudian jalankan `alembic downgrade -1`; tindakan ini memadam semua rekod sesi/refresh dan memaksa login semula. Jangan downgrade schema ketika backend baharu masih menerima trafik.

## Respons insiden token theft

1. Gunakan logout-all atau service dalaman revoke-all bagi pengguna terjejas.
2. Minta pengguna menukar password; ini merevoke semua refresh sessions.
3. Cari `refresh_token_reuse_detected` menggunakan request/user/session hash tanpa menyalin token.
4. Audit XSS, extension/browser compromise, log redaction dan akses DB.
5. Putar `JWT_SECRET_KEY` hanya untuk insiden luas kerana ia membatalkan semua access token; rotation secret bukan pengganti revocation sesi.
6. Jangan masukkan credential sebenar dalam tiket atau dokumen.

## Risiko baki

- access token yang sudah dikeluarkan hidup sehingga maksimum 15 minit;
- sessionStorage masih mempunyai risiko XSS dan CSP belum ditambah;
- MFA, email verification, WAF dan CAPTCHA belum dilaksanakan;
- tiada UI pengurusan peranti/sesi;
- revocation disabled-user/role-change perlu disambungkan apabila lifecycle admin tersebut wujud;
- durability Redis login protection bergantung pada plan production dan bukan sebahagian store sesi DB ini.
