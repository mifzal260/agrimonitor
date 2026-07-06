# Pelan Pembangunan App AgriMonitor

Nota: Nama fail ini mengikut struktur rujukan pengguna. Kandungan dokumen disesuaikan untuk projek AgriMonitor.

## Ringkasan Projek

AgriMonitor ialah full stack web app responsive dan mobile-first untuk membantu petani memantau tanaman, merekod aktiviti ladang, merekod simptom, melihat cadangan awal berasaskan rule, melihat harga pasaran, serta mengira kos, hasil, dan profit/loss.

## Tech Stack

Frontend:

- React
- Vite
- TypeScript
- Tailwind CSS
- Recharts

Backend:

- FastAPI
- Pydantic
- SQLAlchemy
- Alembic
- JWT authentication
- Secure password hashing

Database:

- PostgreSQL-compatible
- Neon-ready

Deployment notes:

- Render untuk backend/frontend.
- Neon untuk PostgreSQL.

## Folder Utama Projek

```text
agrimonitor/
  agrimonitor_backend/
  agrimonitor_frontend/
  docs/
    arahan-codex/
```

## Backend Plan

Backend menggunakan struktur modular:

- `api/routes` untuk endpoint.
- `core` untuk config, security, dan dependencies.
- `db` untuk database session dan seed.
- `models` untuk SQLAlchemy models.
- `schemas` untuk Pydantic schemas.
- `services` untuk business logic.

Backend mesti:

- Validate request data.
- Hash password.
- Generate dan validate JWT.
- Enforce role permission.
- Pastikan user hanya akses data sendiri.
- Return JSON response yang konsisten.

## Frontend Plan

Frontend menggunakan React mobile-first:

- `api` untuk API client.
- `components` untuk reusable UI.
- `features` untuk modul app.
- `routes` untuk routing dan protected routes.
- `types` untuk TypeScript types.
- `utils` untuk helper.

UI mesti:

- Simple dan sesuai untuk petani.
- Responsive.
- Guna Tailwind CSS.
- Guna Recharts untuk graph harga.
- Ada loading state dan error message.
- Ada badges untuk status, risk level, dan trend harga.

## MVP Modules

1. Authentication
2. Admin master data
3. Crop monitoring
4. Rule-based recommendation
5. Market price
6. Dashboard
7. Cost, harvest, and profit/loss

## Deliverable Akhir

- Local full stack MVP boleh run.
- PostgreSQL schema dan seed data.
- Login/register dengan JWT.
- Admin/user role permission.
- CRUD untuk modul utama.
- Dashboard summary.
- Recharts price graph.
- README setup lokal.
- README notes untuk Render + Neon deployment.

