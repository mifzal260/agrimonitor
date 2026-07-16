# Langkah Pembangunan AgriMonitor

Dokumen ini menjadi panduan kerja berfasa untuk membina AgriMonitor secara profesional, kemas, dan terkawal. Projek ini mesti dibina langkah demi langkah, bukan sekali gus.

## Peraturan Kerja

1. Bina satu fasa sahaja pada satu masa.
2. Selepas satu fasa siap, berhenti dan tunggu pengesahan pengguna.
3. Jangan tambah ciri yang tidak diminta.
4. Jangan ubah tech stack tanpa arahan.
5. Jangan buat AI diagnosis, IoT, hardware integration, atau external API untuk MVP.
6. Gunakan data asas untuk simptom dan peraturan penyakit, serta data CSV rasmi untuk harga pasaran.
7. Utamakan sistem yang berfungsi, bersih, dan mudah difahami.

## Fasa 1: Planning and Architecture

Hasil yang perlu ada:

- Ringkasan tujuan app.
- Tech stack disahkan.
- Struktur folder dicadangkan.
- Database tables dicadangkan.
- Role dan permission dicadangkan.

Tiada full code dalam fasa ini.

## Fasa 2: Project Setup

Hasil yang perlu ada:

- `agrimonitor_frontend` untuk React + Vite + TypeScript.
- `agrimonitor_backend` untuk FastAPI.
- README asas.
- `.env.example` untuk frontend dan backend.
- Health check backend.
- Halaman frontend asas.

## Fasa 3: Database Schema and Seed Data

Hasil yang perlu ada:

- PostgreSQL-compatible schema.
- Migration setup.
- Seed data untuk crops, symptoms, disease rules, dan market prices.
- Schema sesuai untuk Neon PostgreSQL.

## Fasa 4: Authentication

Hasil yang perlu ada:

- Register.
- Login.
- Password hashing.
- JWT authentication.
- Role `admin` dan `user`.
- Protected routes.

## Fasa 5: Core Crop Monitoring

Hasil yang perlu ada:

- CRUD planting records.
- Plant age calculation.
- Plant status.
- Farm activities.
- Symptom records.
- Optional image upload jika tidak mengganggu MVP.

## Fasa 6: Rule-Based Recommendation

Hasil yang perlu ada:

- Match symptoms dengan disease rules.
- Risk level.
- Early recommendation.
- Alert untuk high-risk symptoms.

## Fasa 7: Market Price Module

Hasil yang perlu ada:

- CRUD market prices.
- Import CSV market price data.
- Latest price.
- Filter by commodity, date, price type, dan location.

## Fasa 8: Dashboard and Charts

Hasil yang perlu ada:

- Dashboard summary.
- Recharts price graph.
- Crop status summary.
- Risk summary.
- Price trend.
- Cost dan profit/loss summary.

## Fasa 9: Cost, Harvest and Profit/Loss

Hasil yang perlu ada:

- Record cost.
- Record harvest.
- Calculate total cost.
- Calculate revenue.
- Calculate profit/loss.

## Fasa 10: Final Cleanup

Hasil yang perlu ada:

- Test main flows.
- Fix bugs.
- Improve UI.
- Update README.
- Add Render + Neon deployment notes.

---

## Fasa 7.0: Audit dan Pengukuhan Backend

Fasa ini ialah fasa audit backend baharu selepas penutupan Audit Frontend Fasa 6.1. Ia bukan Fasa 7 dalam pelan MVP asal kerana Fasa 7 asal ialah Market Price Module.

Skop awal Fasa 7.0:

- Bina infrastruktur ujian backend dengan pytest, database test berasingan, fixture app, fixture session, rollback/reset data, dan dependency override FastAPI.
- Uji autentikasi, JWT, role admin/user dan endpoint `/auth/me`.
- Uji pemilikan data dengan sekurang-kurangnya dua pengguna.
- Uji kiraan kewangan: kos bahan, kos buruh, kos aktiviti, hasil jualan, untung/rugi, satu plot dan semua plot.
- Uji import CSV termasuk header hilang, tarikh rosak, harga rosak, rekod pendua, akses bukan admin dan rollback apabila gagal.
- Audit transaksi database: commit, flush, refresh, rollback, operasi berbilang langkah dan risiko partial write.
- Muktamadkan strategi `/finance/costs`: kekal, gabung dengan kos aktiviti, atau deprecate.
- Rancang E2E Playwright selepas backend stabil.

Nota: ujian backend pada masa ini hampir tiada. Playwright/E2E belum tersedia. Jangan mula implementasi Fasa 7.0 sebelum skop disahkan.

## Catatan Audit Teknikal - Fasa 7.0 Backend

Fasa 7.0 audit teknikal backend telah dimulakan selepas penutupan audit frontend Fasa 6.1. Skop fasa ini bukan modul harga pasaran MVP asal, tetapi audit dan pengukuhan backend FastAPI.

Status kerja:

- Audit route, auth, ownership, kewangan, CSV, transaksi, validation dan konfigurasi backend direkodkan dalam `docs/audit-agrimonitor-fasa-7-0-backend.md`.
- Suite ujian backend minimum ditambah untuk health, auth dan ownership planting record.
- Tiada schema database atau migrasi Alembic diubah.
- Tiada frontend diubah.
- `tmp-market-data/` tidak disentuh.
