# Dokumentasi Projek AgriMonitor

Tarikh kemas kini: 16 Julai 2026  
Status: MVP fasa 1 hingga 10 telah dibangunkan; penambahbaikan frontend Fasa 6.1 masih berada dalam working tree dan belum dikomit.

## 1. Ringkasan Projek

AgriMonitor ialah aplikasi web penuh (*full-stack*) berkonsepkan *mobile-first* untuk membantu pengguna memantau tanaman dan prestasi ladang. Sistem menggabungkan rekod plot, aktiviti ladang, simptom, cadangan risiko berasaskan peraturan, harga pasaran, hasil tuaian, kos dan ringkasan untung rugi.

Matlamat utama projek ialah menyediakan MVP yang:

- mudah digunakan pada telefon dan desktop;
- menyimpan rekod ladang mengikut pemilik;
- memberi penilaian risiko awal berdasarkan simptom yang direkodkan;
- memaparkan harga komoditi dan trend harga;
- mengira kos, hasil jualan serta untung atau rugi;
- boleh dipasang secara lokal atau dideploy menggunakan Render dan Neon PostgreSQL.

AgriMonitor bukan sistem diagnosis AI. Cadangan penyakit menggunakan peraturan yang telah ditetapkan dalam pangkalan data.

## 2. Status Semasa

| Bahagian | Status | Catatan |
| --- | --- | --- |
| Perancangan dan seni bina | Selesai | Skop MVP, peranan dan struktur data telah ditetapkan. |
| Backend FastAPI | Selesai untuk MVP | API autentikasi, pemantauan, cadangan, harga, dashboard dan kewangan tersedia. |
| Frontend React | Selesai untuk MVP | Semua halaman utama tersedia dan dilindungi selepas login. |
| PostgreSQL dan migrasi | Selesai | Enam migrasi Alembic tersedia sehingga penggantian data tanaman demo. |
| Autentikasi dan kebenaran | Selesai | JWT, password hashing, peranan `admin` dan `user`, serta pemilikan rekod. |
| Deployment | Disediakan | Konfigurasi asas Render dan panduan Neon tersedia. |
| Ujian frontend Fasa 6.1 | Lulus | Audit merekodkan 10 fail ujian, 79 ujian, lint, TypeScript dan build lulus. |
| Ujian manual hujung-ke-hujung | Belum lengkap | Login sebenar, import CSV, tooltip carta dan operasi terhadap backend belum diautomasi. |

## 3. Teknologi Digunakan

### Frontend

- React 18
- TypeScript
- Vite
- React Router
- Tailwind CSS
- Recharts untuk carta harga
- i18next dan react-i18next untuk Bahasa Melayu dan Inggeris
- Vitest, Testing Library dan jsdom untuk ujian
- ESLint untuk semakan kod

Keperluan semasa frontend ialah Node.js `20.19.0` atau lebih baharu.

### Backend

- Python 3.11 atau lebih baharu
- FastAPI
- SQLAlchemy 2
- Alembic
- PostgreSQL melalui psycopg
- Pydantic Settings
- JWT melalui python-jose
- Passlib dan bcrypt untuk kata laluan
- Uvicorn sebagai pelayan aplikasi

### Infrastruktur

- Neon PostgreSQL sebagai pilihan pangkalan data produksi
- Render Web Service untuk backend
- Render Static Site untuk frontend

## 4. Seni Bina Ringkas

```text
Pengguna
   |
   v
React + TypeScript (frontend)
   |
   | HTTP/JSON + Bearer JWT
   v
FastAPI (backend /api/v1)
   |
   | SQLAlchemy
   v
PostgreSQL / Neon
```

Frontend mengurus paparan, borang, navigasi, bahasa dan penyimpanan sesi pengguna. Backend mengesahkan JWT, menguatkuasakan pemilikan rekod dan peranan, menjalankan logik perniagaan, kemudian membaca atau menulis data PostgreSQL.

## 5. Struktur Repositori

```text
agrimonitor/
├── agrimonitor_backend/
│   ├── alembic/                 # Migrasi pangkalan data
│   ├── app/
│   │   ├── api/routes/          # Endpoint FastAPI
│   │   ├── core/                # Konfigurasi, JWT dan dependencies
│   │   ├── db/                  # Sambungan DB, startup dan seed
│   │   ├── models/              # Model SQLAlchemy
│   │   ├── schemas/             # Skema request/response Pydantic
│   │   └── services/            # Logik perniagaan
│   └── pyproject.toml
├── agrimonitor_frontend/
│   ├── src/
│   │   ├── api/                 # Client kepada backend
│   │   ├── auth/                # Penyimpanan dan pengurusan sesi
│   │   ├── components/          # Komponen umum
│   │   ├── features/            # Auth, dashboard, monitoring, harga, kewangan
│   │   ├── i18n/                # Terjemahan BM dan EN
│   │   ├── routes/              # ProtectedRoute
│   │   ├── types/               # TypeScript types
│   │   └── utils/               # Formatter dan utiliti paparan
│   └── package.json
├── docs/                        # Dokumen skop, schema, deployment dan audit
├── tmp-market-data/             # Data/skrip kerja import harga; bukan aplikasi runtime
├── render.yaml                  # Blueprint deployment Render
└── README.md
```

## 6. Modul dan Fungsi Yang Telah Dibina

### 6.1 Autentikasi

- Pendaftaran akaun.
- Login menggunakan e-mel dan kata laluan.
- Kata laluan disimpan dalam bentuk hash.
- Backend mengeluarkan JWT selepas autentikasi berjaya.
- Endpoint profil pengguna semasa.
- Laluan frontend dilindungi; pengguna tanpa sesi dihantar ke halaman login.
- Pengendalian sesi tamat atau respons `401` telah diperkemas pada API client.
- Peranan `admin` dan `user` tersedia.

### 6.2 Dashboard

- Ringkasan status plot tanaman.
- Ringkasan risiko dan simptom.
- Aktiviti terkini serta jumlah kos aktiviti.
- Harga komoditi terkini.
- Carta trend harga menggunakan Recharts.
- Ringkasan kos, hasil jualan dan untung/rugi.
- Penambahbaikan susun atur responsif, label Bahasa Melayu dan kawalan limpahan teks.

### 6.3 Pemantauan Tanaman

- Tambah, lihat, kemas kini dan padam rekod tanaman/plot.
- Kiraan umur tanaman dalam hari selepas tanam (HST).
- Rekod aktiviti ladang mengikut plot.
- Kos bahan, kos buruh dan jumlah kos aktiviti.
- Tambah, kemas kini dan padam aktiviti.
- Rekod simptom berserta tarikh pemerhatian.
- Simptom boleh ditandakan aktif atau selesai.
- Status kesihatan plot diselaraskan daripada simptom aktif.
- Mesej kejayaan dan ralat dipaparkan berhampiran tindakan berkaitan.
- Dialog pengesahan tersuai digunakan untuk operasi padam.

### 6.4 Cadangan Berasaskan Peraturan

- Simptom dipadankan dengan `disease_rules` dan hubungan `disease_rule_symptoms`.
- Sistem mengembalikan tahap risiko dan cadangan awal.
- Alert diwujudkan untuk penilaian berisiko tinggi.
- Ini ialah enjin *rule-based*, bukan diagnosis AI atau nasihat profesional muktamad.

### 6.5 Harga Pasaran

- Senarai harga mengikut komoditi.
- Penapis nama komoditi, lokasi, jenis harga dan julat tarikh.
- Jenis harga termasuk borong, runcit dan ladang.
- Rekod harga terkini dan sejarah harga.
- Paparan data dikumpulkan dalam bentuk accordion.
- Ringkasan harga harian dan trend harga.
- Import fail CSV oleh admin.
- Admin boleh menambah, mengemas kini dan memadam harga.
- Data demo telah dibuang dan tanaman/komoditi rasmi telah dimasukkan.

### 6.6 Kewangan dan Hasil Tuaian

- Rekod hasil tuaian mengikut plot.
- Tambah, kemas kini dan padam hasil tuaian.
- Kiraan hasil jualan daripada kuantiti dan harga jualan.
- Ringkasan semua plot atau satu plot tertentu.
- Kiraan jumlah kos, hasil, pendapatan dan untung/rugi.
- UI semasa menggunakan kos aktiviti ladang sebagai sumber kos utama.
- Backend masih mempunyai endpoint CRUD `costs`; ia wujud dalam API tetapi tidak menjadi aliran utama UI semasa.

### 6.7 Pengalaman Pengguna dan Kebolehcapaian

- Antara muka *mobile-first* dengan sidebar responsif.
- Sokongan Bahasa Melayu dan Inggeris.
- Formatter mata wang dan tarikh dipusatkan untuk locale `ms-MY` dan `en-MY`.
- Senarai panjang menggunakan kawalan “Lihat lagi / Tutup semula” dalam kelompok lapan rekod.
- `ConfirmDialog` menyokong Escape, klik backdrop, loading, pemulihan fokus dan focus loop ringkas.
- `ErrorBoundary` mengelakkan keseluruhan aplikasi menjadi kosong apabila komponen gagal.
- Gaya soft-glass dan neomorphism digunakan secara terpilih.

## 7. Peranan dan Kebenaran

### Public

- Daftar akaun.
- Login.

### User

- Melihat dan mengurus rekod plot sendiri.
- Mengurus aktiviti, simptom dan hasil tuaian sendiri.
- Melihat harga pasaran.
- Melihat dashboard dan ringkasan kewangan sendiri.
- Tidak boleh membaca atau mengubah rekod milik pengguna lain.

### Admin

- Semua akses pengguna biasa.
- Menambah, mengemas kini dan memadam harga pasaran.
- Mengimport harga pasaran melalui CSV.

Catatan keadaan sebenar: jadual master `crops`, `symptoms` dan `disease_rules` tersedia dalam pangkalan data dan seed, tetapi API semasa hanya menyediakan bacaan tanaman/simptom. CRUD admin untuk tiga master data ini belum didedahkan sebagai endpoint lengkap.

## 8. Pangkalan Data

Jadual utama:

| Jadual | Tujuan |
| --- | --- |
| `users` | Akaun, kata laluan hash dan peranan. |
| `crops` | Data master tanaman/komoditi. |
| `symptoms` | Data master simptom. |
| `disease_rules` | Peraturan penyakit dan tahap risiko. |
| `disease_rule_symptoms` | Hubungan banyak-ke-banyak peraturan dengan simptom. |
| `planting_records` | Rekod plot dan tarikh tanaman pengguna. |
| `activities` | Aktiviti, kos bahan dan kos buruh. |
| `symptom_records` | Pemerhatian simptom dan status aktif/selesai. |
| `alerts` | Alert daripada penilaian risiko. |
| `market_prices` | Harga komoditi mengikut tarikh, lokasi dan jenis. |
| `costs` | Rekod kos generik yang masih disokong backend. |
| `harvests` | Kuantiti tuaian, harga jualan dan hasil. |

Migrasi yang telah dibuat:

1. Skema awal.
2. Status rekod simptom.
3. Penyelarasan status plot daripada simptom.
4. Kos buruh pada aktiviti.
5. Pembuangan harga pasaran demo.
6. Penggantian tanaman demo dengan komoditi rasmi.

Seed semasa merangkumi beberapa komoditi cili, timun dan tomato, simptom asas, contoh peraturan risiko dan data harga komoditi rasmi daripada CSV.

## 9. Kumpulan API Utama

Semua endpoint aplikasi menggunakan awalan `/api/v1` kecuali health check akar.

| Kumpulan | Endpoint penting |
| --- | --- |
| Health | `GET /health`, `GET /api/v1/health` |
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| Monitoring | `/monitoring/crops`, `/symptoms`, `/planting-records`, `/activities`, `/symptom-records` |
| Recommendations | `POST /recommendations/planting-records/{id}/evaluate`, `GET /recommendations/alerts` |
| Market prices | `GET /market-prices`, `GET /latest`, CRUD admin dan `POST /import-csv` |
| Dashboard | `GET /dashboard/summary` |
| Finance | `GET /finance/summary`, CRUD `/costs`, CRUD `/harvests` |

Dokumentasi interaktif FastAPI boleh dicapai melalui `/docs` apabila backend sedang berjalan.

## 10. Halaman Frontend

| Laluan | Fungsi |
| --- | --- |
| `/login` | Login dan pendaftaran. |
| `/dashboard` | Ringkasan keseluruhan ladang. |
| `/monitoring` | Plot, aktiviti dan simptom. |
| `/market-prices` | Harga dan sejarah komoditi. |
| `/finance` | Kos aktiviti, hasil tuaian dan untung/rugi. |

Laluan `/` dan laluan tidak dikenali akan diarahkan kepada halaman yang sesuai berdasarkan status autentikasi.

## 11. Cara Menjalankan Secara Lokal

### 11.1 Backend

```powershell
cd agrimonitor_backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -e .
Copy-Item .env.example .env
```

Tetapkan sekurang-kurangnya nilai berikut dalam `.env`:

```env
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/agrimonitor
JWT_SECRET_KEY=rahsia-lokal-yang-kuat
CORS_ORIGINS=http://localhost:5173
```

Jalankan migrasi, seed dan pelayan:

```powershell
alembic upgrade head
python -m app.db.seed
uvicorn app.main:app --reload
```

Backend akan tersedia di `http://localhost:8000`.

### 11.2 Frontend

```powershell
cd agrimonitor_frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Nilai frontend lokal:

```env
VITE_API_URL=http://localhost:8000/api/v1
```

Frontend akan tersedia di `http://localhost:5173`. Kod semasa turut menerima nama pemboleh ubah lama `VITE_API_BASE_URL` untuk keserasian deployment.

## 12. Ujian dan Semakan Kualiti

Arahan frontend:

```powershell
cd agrimonitor_frontend
npm run test
npm run lint
npx tsc --noEmit
npm run build
```

Keputusan audit Fasa 6.1 pada 16 Julai 2026:

- 10 fail ujian dan 79 ujian lulus;
- ESLint lulus tanpa ralat;
- semakan TypeScript lulus;
- build produksi lulus;
- `npm audit` melaporkan 0 kerentanan;
- pola lama seperti `window.confirm`, `window.alert` dan formatter tarikh berselerak telah dibersihkan.

Ujian backend automatik masih sangat minimum. Projek juga belum mempunyai suite E2E seperti Playwright untuk menguji aliran sebenar antara browser, API dan pangkalan data.

## 13. Deployment Ringkas

### Backend Render

- Root directory: `agrimonitor_backend`
- Build: `pip install -e .`
- Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Environment penting: `DATABASE_URL`, `JWT_SECRET_KEY`, `CORS_ORIGINS`

### Frontend Render

- Root directory: `agrimonitor_frontend`
- Build: `npm install && npm run build`
- Publish directory: `dist`
- Environment: `VITE_API_BASE_URL=<URL backend>/api/v1` atau `VITE_API_URL=<URL backend>/api/v1`

Selepas menyediakan Neon, jalankan `alembic upgrade head` dan `python -m app.db.seed`. Rahsia dan URL pangkalan data tidak boleh dimasukkan ke dalam kod atau dikomit ke Git.

## 14. Ringkasan Kerja Yang Telah Dilakukan

Urutan pembangunan utama berdasarkan sejarah projek:

1. MVP awal dibina dengan FastAPI, React, PostgreSQL, autentikasi, monitoring, cadangan, harga, dashboard dan kewangan.
2. Konfigurasi produksi dibaiki untuk Neon URL, CORS Render, build TypeScript dan fallback URL API.
3. Pangkalan data disediakan secara lebih selamat semasa startup backend.
4. Borang dan mesej maklum balas bagi plot, aktiviti, kewangan dan harga diperkemas.
5. Layout aplikasi dijadikan responsif dengan sidebar dan dashboard yang lebih teratur.
6. CRUD plot, aktiviti dan hasil tuaian dilengkapkan, termasuk tindakan edit/padam.
7. Kos bahan dan buruh aktiviti dimasukkan ke dalam pengiraan kewangan.
8. Tarikh pemerhatian dan status aktif/selesai simptom ditambah; status kesihatan plot diselaraskan secara automatik.
9. Paparan kewangan semua plot dan aliran hasil tuaian diperbaiki.
10. Modul harga menerima penapis lebih baik, jenis harga ladang, accordion, sejarah dan ringkasan harian.
11. Data demo dibuang dan diganti dengan komoditi serta data harga rasmi.
12. Dashboard dan carta harga dibaiki dari segi trend, parsing tarikh, jumlah kos, unit dan overflow.
13. Sokongan dwibahasa BM/EN ditambah.
14. Gaya soft-glass dan neomorphism terpilih ditambah pada UI.
15. Fasa audit frontend 6.1 menambah dialog pengesahan boleh akses, formatter pusat, kawalan senarai panjang, ErrorBoundary dan liputan ujian.

## 15. Kerja Yang Masih Belum Selesai / Risiko

- Perubahan frontend Fasa 6.1 dan beberapa fail sokongan masih belum dikomit pada tarikh dokumen ini.
- Regression manual penuh antara browser, backend dan pangkalan data belum dijalankan secara automatik.
- Ujian backend perlu ditambah untuk auth, pemilikan rekod, cadangan, import CSV dan pengiraan kewangan.
- Recharts 2.15.4 telah deprecated; migrasi ke Recharts 3 memerlukan fasa berasingan.
- `skipLibCheck=true` masih digunakan kerana declaration Recharts/lodash; kod projek sendiri masih diperiksa dalam mod TypeScript strict.
- CRUD admin lengkap untuk master tanaman, simptom dan peraturan penyakit belum tersedia melalui API/UI.
- Endpoint backend `costs` dan strategi UI “kos daripada aktiviti” perlu diselaraskan atau didokumentasikan sebagai keputusan produk kekal.
- Belum ada fungsi reset kata laluan, pengesahan e-mel, notifikasi kompleks atau PWA offline penuh.

## 16. Di Luar Skop MVP

- Diagnosis menggunakan AI.
- Integrasi IoT atau perkakasan ladang.
- Integrasi terus dengan API pasaran luar.
- Sistem pembayaran.
- Analitik lanjutan.
- Notifikasi kompleks.
- Aplikasi offline-first penuh.

## 17. Dokumen Berkaitan

- `README.md` — panduan ringkas projek.
- `docs/skop-projek.md` — sempadan skop MVP.
- `docs/langkah-pembangunan.md` — pelan fasa 1 hingga 10.
- `docs/database-schema.md` — ringkasan pangkalan data.
- `docs/deployment-render-neon.md` — panduan deployment.
- `docs/audit-agrimonitor-fasa-6-1.md` — bukti audit dan quality gate frontend terkini.

---

Dokumen ini menerangkan keadaan sebenar kod dan working tree pada 16 Julai 2026. Kemas kini bahagian status, ujian, migrasi dan risiko setiap kali perubahan besar disiapkan atau dideploy.

---

## Addendum Audit - 16 Julai 2026

Audit Frontend Fasa 6.1 telah disahkan semula melalui quality gate semasa:

- `npm ci`: lulus, 0 vulnerabilities, warning deprecated `recharts@2.15.4`.
- `npm run test`: lulus, 10 fail ujian, 79 ujian.
- `npm run lint`: lulus.
- `npx tsc --noEmit`: lulus.
- `npm run build`: lulus, Vite 8.1.4 built in 5.64s, chunk terbesar `DashboardPage` 388.03 kB, tiada chunk warning.
- `npm audit`: lulus, 0 vulnerabilities.

Manual regression browser/backend/database penuh belum dilakukan. Playwright/E2E belum tersedia.

`skipLibCheck=true` masih dikekalkan kerana `skipLibCheck=false` gagal pada declaration Recharts/lodash (`TS7016`). `recharts@2.15.4` deprecated dan migrasi ke Recharts v3 perlu fasa berasingan.

Fasa seterusnya ialah **Fasa 7.0 - Audit dan Pengukuhan Backend**. Fasa ini berasingan daripada Fasa 7 MVP asal. Ujian backend pada masa ini hampir tiada, dan strategi `/finance/costs` masih belum dimuktamadkan.
