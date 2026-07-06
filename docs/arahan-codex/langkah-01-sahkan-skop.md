# Langkah 01: Sahkan Skop Projek

## Arahan Untuk Codex

Sebelum menulis code besar, fahami dan sahkan skop projek AgriMonitor.

Jangan bina semua feature sekali gus. Ikut fasa pembangunan dan berhenti selepas setiap fasa untuk tunggu pengesahan pengguna.

## Tujuan Projek

AgriMonitor ialah full stack web app mobile-first untuk petani dan admin mengurus:

- Rekod tanaman.
- Aktiviti ladang.
- Simptom tanaman.
- Recommendation awal berasaskan rule.
- Harga pasaran.
- Kos dan hasil tuaian.
- Profit/loss summary.

## Tech Stack Yang Mesti Digunakan

- Frontend: React + Vite + TypeScript.
- Styling: Tailwind CSS.
- Charts: Recharts.
- Backend: FastAPI.
- Database: PostgreSQL-compatible.
- Auth: JWT.

## Folder Yang Digunakan

```text
agrimonitor/
  agrimonitor_backend/
  agrimonitor_frontend/
  docs/
    arahan-codex/
```

Jangan buat folder `agri`.

## Batasan MVP

Jangan implement:

- AI diagnosis.
- IoT/hardware.
- External API.
- Paid services.
- Feature advanced yang tidak diminta.

## Modul MVP

1. Authentication.
2. Admin master data.
3. Crop monitoring.
4. Rule-based recommendation.
5. Market prices.
6. Dashboard and charts.
7. Cost, harvest, and profit/loss.

## Peraturan Penting

- Jangan hardcode secrets.
- Jangan simpan password plain text.
- Gunakan environment variables.
- Backend mesti enforce permission.
- User hanya boleh akses rekod sendiri.
- Admin boleh manage master data.
- Gunakan seed/demo data.
- Code mesti bersih dan mudah difahami.

## Status

Skop projek disahkan sebagai MVP AgriMonitor. Langkah seterusnya hanya boleh dibuat selepas pengguna beri arahan `continue` atau `next`.

