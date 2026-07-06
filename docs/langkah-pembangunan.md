# Langkah Pembangunan AgriMonitor

Dokumen ini menjadi panduan kerja berfasa untuk membina AgriMonitor secara profesional, kemas, dan terkawal. Projek ini mesti dibina langkah demi langkah, bukan sekali gus.

## Peraturan Kerja

1. Bina satu fasa sahaja pada satu masa.
2. Selepas satu fasa siap, berhenti dan tunggu pengesahan pengguna.
3. Jangan tambah ciri yang tidak diminta.
4. Jangan ubah tech stack tanpa arahan.
5. Jangan buat AI diagnosis, IoT, hardware integration, atau external API untuk MVP.
6. Gunakan seed/demo data untuk symptoms, disease rules, dan market prices.
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

