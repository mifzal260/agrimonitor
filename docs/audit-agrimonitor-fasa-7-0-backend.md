# Audit AgriMonitor Fasa 7.0 - Backend

Tarikh audit: 16 Julai 2026
Skop: FastAPI backend sahaja. Frontend, schema database dan migrasi Alembic tidak diubah.

## 1. Ringkasan Eksekutif

Audit backend telah menilai route FastAPI, autentikasi JWT, ownership data, transaksi database, kewangan, import CSV, konfigurasi produksi dan infrastruktur ujian. Pembaikan yang dibuat dalam fasa ini terhad kepada infrastruktur ujian backend minimum dan dependency dev yang diperlukan untuk menjalankan `fastapi.testclient.TestClient`.

Status utama:

- Backend compile: lulus.
- Backend pytest sebelum audit: tiada suite ujian sebenar dan pytest belum tersedia dalam `.venv`.
- Backend pytest selepas audit: 11 ujian lulus.
- Schema database: tidak diubah.
- Migrasi Alembic: tidak ditambah.
- Frontend: tidak diubah.
- `tmp-market-data/`: tidak disentuh.

## 2. Status Awal Git

Status awal sebelum Fasa 7.0:

```text
?? tmp-market-data/
```

`git diff` dan `git diff --cached` kosong.

Commit terkini sebelum audit:

```text
3e62855 chore(deploy): update Render static site configuration
cb13dce docs: record phase 6.1 closure and backend audit plan
79640d4 feat(frontend): harden app workflows and audit coverage
```

## 3. Seni Bina Backend

Struktur backend utama:

```text
agrimonitor_backend/
├── alembic/
├── app/
│   ├── api/routes/
│   ├── core/
│   ├── db/
│   ├── models/
│   ├── schemas/
│   ├── services/
│   └── main.py
└── pyproject.toml
```

Route module:

- `auth.py`
- `health.py`
- `monitoring.py`
- `recommendations.py`
- `market_prices.py`
- `dashboard.py`
- `finance.py`

Service layer:

- `auth_service.py`
- `monitoring_service.py`
- `recommendation_service.py`
- `market_price_service.py`
- `dashboard_service.py`
- `finance_service.py`

## 4. Matriks Endpoint dan Akses

| Modul | Endpoint | Akses | Ownership check | Transaksi | Ujian |
|---|---|---|---|---|---|
| health | `GET /health` | Public | Tidak perlu | Tiada | Ada |
| health | `GET /api/v1/health` | Public | Tidak perlu | Tiada | Ada |
| auth | `POST /api/v1/auth/register` | Public | Tidak perlu | `commit` user | Ada |
| auth | `POST /api/v1/auth/login` | Public | Tidak perlu | Tiada write | Ada |
| auth | `GET /api/v1/auth/me` | User | Token user | Tiada | Ada |
| auth | `GET /api/v1/auth/admin-check` | Admin | Role DB | Tiada | Belum |
| monitoring | `GET /crops` | User | Master data | Tiada | Belum |
| monitoring | `GET /symptoms` | User | Master data | Tiada | Belum |
| monitoring | `POST /planting-records` | User | `crop_id` wujud, user ditetap server | `commit` | Ada |
| monitoring | `GET /planting-records` | User | `PlantingRecord.user_id` | Tiada | Belum |
| monitoring | `GET /planting-records/{id}` | User | `get_owned_planting_record` | Tiada | Ada |
| monitoring | `PATCH /planting-records/{id}` | User | `get_owned_planting_record` | `commit` | Ada |
| monitoring | `DELETE /planting-records/{id}` | User | `get_owned_planting_record` | Multi-delete + `commit` | Ada |
| monitoring | `POST /activities` | User | Parent planting record owned | `commit` | Belum |
| monitoring | `GET /activities` | User | `Activity.user_id` | Tiada | Belum |
| monitoring | `PATCH /activities/{id}` | User | `get_owned_activity` | `commit` | Belum |
| monitoring | `DELETE /activities/{id}` | User | `get_owned_activity` | `commit` | Belum |
| monitoring | `POST /symptom-records` | User | Parent planting record owned | `flush` + status sync + `commit` | Belum |
| monitoring | `GET /symptom-records` | User | `SymptomRecord.user_id` | Tiada | Belum |
| monitoring | `PATCH /symptom-records/{id}` | User | `get_owned_symptom_record` | `flush` + status sync + `commit` | Belum |
| monitoring | `DELETE /symptom-records/{id}` | User | `get_owned_symptom_record` | `flush` + status sync + `commit` | Belum |
| recommendations | `POST /planting-records/{id}/evaluate` | User | `get_owned_planting_record` | alert/status + `commit` | Belum |
| recommendations | `GET /alerts` | User | `Alert.user_id` | Tiada | Belum |
| market prices | `GET /market-prices` | User | Global market data | Tiada | Belum |
| market prices | `GET /market-prices/latest` | User | Global market data | Tiada | Belum |
| market prices | `POST /market-prices` | Admin | Admin role | `commit` | Belum |
| market prices | `PATCH /market-prices/{id}` | Admin | Admin role | `commit` | Belum |
| market prices | `DELETE /market-prices/{id}` | Admin | Admin role | `commit` | Belum |
| market prices | `POST /market-prices/import-csv` | Admin | Admin role | Bulk add + `commit` | Belum |
| dashboard | `GET /dashboard/summary` | User | User filter pada user-owned tables | Tiada write | Belum |
| finance | `GET /finance/summary` | User | User filter | Tiada write | Belum |
| finance | `POST /finance/costs` | User | Parent planting record owned | `commit` | Belum |
| finance | `GET /finance/costs` | User | `Cost.user_id` | Tiada | Belum |
| finance | `PATCH /finance/costs/{id}` | User | `get_owned_cost` | `commit` | Belum |
| finance | `DELETE /finance/costs/{id}` | User | `get_owned_cost` | `commit` | Belum |
| finance | `POST /finance/harvests` | User | Parent planting record owned | `commit` | Belum |
| finance | `GET /finance/harvests` | User | `Harvest.user_id` | Tiada | Belum |
| finance | `PATCH /finance/harvests/{id}` | User | `get_owned_harvest` | `commit` | Belum |
| finance | `DELETE /finance/harvests/{id}` | User | `get_owned_harvest` | `commit` | Belum |

## 5. Status Ujian Backend Sebelum Audit

Sebelum audit:

- Tiada folder `agrimonitor_backend/tests/`.
- Tiada `conftest.py`.
- Tiada fixture database ujian.
- Tiada dependency override `get_db`.
- `pytest` disenaraikan dalam `pyproject.toml` optional dev, tetapi belum dipasang dalam `.venv`.
- Arahan global `python -m pytest -v` gagal kerana `pytest` tiada.
- Arahan `.venv\Scripts\python -m pytest -v` juga gagal kerana `pytest` tiada.

Status tepat: Ujian backend hampir tiada atau tiada suite ujian sebenar.

## 6. Keputusan Semakan Asas

| Semakan | Keputusan |
|---|---|
| Python global | 3.10.6 |
| Python `.venv` | 3.12.2 |
| `python -m compileall app` | Lulus |
| `.venv\Scripts\python -m compileall app` | Lulus |
| Pytest sebelum install dev | Gagal: `No module named pytest` |
| Pytest selepas suite ditambah | 11 lulus |

## 7. Penemuan Autentikasi dan JWT

| ID | Tahap | Komponen | Penemuan | Bukti | Cadangan | Status |
|---|---|---|---|---|---|---|
| AG-BE-001 | RENDAH | Auth | Login menggunakan mesej generik untuk email/password salah. Ini baik untuk elak account enumeration. | `auth_service.authenticate_user` | Kekalkan. | ACCEPTED |
| AG-BE-002 | RENDAH | Auth | `UserRead` tidak mendedahkan `password_hash`. | `schemas/auth.py`, test auth | Kekalkan dan tambah test regresi. | FIXED |
| AG-BE-003 | SEDERHANA | Auth/register | Race condition boleh berlaku untuk pendaftaran email serentak; `IntegrityError` tidak ditangani dengan rollback/409. | `register_user` semak existing kemudian `commit`; unique DB wujud. | Tambah try/except `IntegrityError`, rollback dan respons 409 dalam fasa kecil berasingan. | OPEN |
| AG-BE-004 | RENDAH | JWT | Token mempunyai `exp`, `sub`, `role`; authorization role sebenar masih dibaca dari DB. | `security.py`, `dependencies.py` | Kekalkan. | ACCEPTED |

## 8. Penemuan Ownership dan Pengasingan Data

| ID | Tahap | Komponen | Penemuan | Bukti | Cadangan | Status |
|---|---|---|---|---|---|---|
| AG-BE-005 | RENDAH | Planting records | Read/update/delete planting record menapis `id` + `user_id`; ID enumeration tidak mendedahkan rekod user lain. | `get_owned_planting_record`; `test_ownership.py` | Kekalkan dan tambah coverage untuk child records. | FIXED |
| AG-BE-006 | RENDAH | Activities | Create activity mengesahkan parent planting record milik user; update/delete guna `get_owned_activity`. | `monitoring_service.py` | Tambah ujian ownership activity dalam fasa berikutnya. | OPEN |
| AG-BE-007 | RENDAH | Symptom records | Create mengesahkan parent planting record milik user; update/delete guna `get_owned_symptom_record`. | `monitoring_service.py` | Tambah ujian ownership symptom record. | OPEN |
| AG-BE-008 | RENDAH | Finance | Costs/harvests menapis `user_id` dan create mengesahkan parent planting record milik user. | `finance_service.py` | Tambah ujian ownership finance. | OPEN |

## 9. Penemuan Kewangan

| Nilai | Formula semasa | Sumber data | Risiko |
|---|---|---|---|
| Kos bahan aktiviti | `Activity.cost_amount` | `activities` | Kos ini tidak masuk `/finance/summary`. |
| Kos buruh aktiviti | `Activity.labor_cost_amount` | `activities` | Kos ini tidak masuk `/finance/summary`. |
| Jumlah kos aktiviti dashboard | `sum(coalesce(cost_amount,0)+coalesce(labor_cost_amount,0))` | `dashboard_service.py` | Selaras dengan UI semasa, tetapi berbeza daripada `/finance/summary`. |
| Kos generik finance | `sum(Cost.amount)` | `finance_service.py` | Boleh menyebabkan double counting jika frontend guna kedua-dua aktiviti dan `/finance/costs`. |
| Revenue harvest | `quantity * selling_price_per_unit` | `finance_service.calculate_revenue` | Guna Decimal; baik. |
| Profit/loss dashboard | `Harvest.revenue - Activity costs` | `dashboard_service.py` | Berbeza daripada finance summary. |
| Profit/loss finance summary | `Harvest.revenue - Cost.amount` | `finance_service.py` | Tidak mengambil kos aktiviti. |

| ID | Tahap | Komponen | Penemuan | Bukti | Cadangan | Status |
|---|---|---|---|---|---|---|
| AG-BE-009 | TINGGI | Kewangan | Dashboard dan `/finance/summary` menggunakan sumber kos berbeza. Dashboard guna kos aktiviti, finance summary guna jadual `costs`. | `dashboard_service.py`, `finance_service.py` | Tentukan strategi produk: aktiviti sebagai kos utama atau gabungan jelas. Jangan ubah formula tanpa keputusan produk. | OPEN |
| AG-BE-010 | SEDERHANA | Kewangan | Tiada validasi tarikh tuaian tidak boleh sebelum tarikh tanam. | `schemas/finance.py` | Tambah validation service dengan semak parent planting date. | OPEN |
| AG-BE-011 | RENDAH | Kewangan | Decimal digunakan untuk harga/kos/hasil. | model dan schema finance | Kekalkan. | ACCEPTED |

## 10. Analisis `/finance/costs`

Pilihan dinilai:

- Pilihan A, kekalkan kos generik: sesuai jika kos tambahan bukan aktiviti masih perlu direkod. Risiko UI keliru dan double counting.
- Pilihan B, gabungkan kos generik dan kos aktiviti: paling lengkap tetapi perlu perubahan formula dan keputusan produk.
- Pilihan C, deprecate endpoint: sesuai dengan UI semasa yang mengambil kos dari Crop Monitoring, tetapi endpoint masih perlu dikekalkan untuk backward compatibility.

Cadangan audit: Pilihan C secara produk, tetapi jangan buang endpoint. Tandakan `/finance/costs` sebagai legacy/additional cost dalam dokumentasi API, atau pilih Pilihan B jika mahu semua kos digabungkan. Perubahan formula ditangguhkan kerana boleh mengubah laporan untung/rugi.

## 11. Penemuan Import CSV

| ID | Tahap | Komponen | Penemuan | Bukti | Cadangan | Status |
|---|---|---|---|---|---|---|
| AG-BE-012 | SEDERHANA | CSV import | Tiada semakan MIME type, extension atau saiz fail. | `import_market_prices_csv` baca seluruh fail | Tambah limit saiz dan validasi filename/type. | OPEN |
| AG-BE-013 | SEDERHANA | CSV import | Baris rosak diskip dan import diteruskan; ini partial import secara sengaja, bukan atomic validation penuh. | `skipped += 1`, `db.commit()` selepas loop | Dokumentasi mod partial import atau tambah dry-run/strict mode. | OPEN |
| AG-BE-014 | RENDAH | CSV import | Tiada dedupe; import berulang boleh gandakan rekod harga. | Tiada unique check sebelum `db.add(price)` | Tambah dedupe berdasarkan commodity/location/type/date. | OPEN |
| AG-BE-015 | RENDAH | CSV import | Encoding hanya `utf-8-sig`. | `.decode("utf-8-sig")` | Tangani `UnicodeDecodeError` dengan 400. | OPEN |

## 12. Penemuan Transaksi Database

| Operasi | Commit | Rollback | Multi-step | Risiko partial write |
|---|---|---|---|---|
| Register user | Ya | Tidak eksplisit | Tidak | Rendah, kecuali IntegrityError race. |
| Create planting record | Ya | Tidak eksplisit | Tidak | Rendah. |
| Delete planting record | Ya | Tidak eksplisit | Ya, delete children manual | Sederhana jika exception DB berlaku. |
| Create activity | Ya | Tidak eksplisit | Tidak | Rendah. |
| Create symptom record | Ya | Tidak eksplisit | Ya, `flush` + status sync | Sederhana jika exception selepas flush. |
| Update symptom record | Ya | Tidak eksplisit | Ya, `flush` + status sync | Sederhana jika exception selepas flush. |
| Evaluate recommendation | Ya | Tidak eksplisit | Ya, alert + status | Sederhana. |
| CSV import | Ya | Tidak eksplisit | Bulk rows | Sederhana. |
| Harvest | Ya | Tidak eksplisit | Revenue calculation + insert/update | Rendah. |
| Cost | Ya | Tidak eksplisit | Tidak | Rendah. |
| Seed startup | Ya | Ya | Ya | Baik, ada rollback. |

| ID | Tahap | Komponen | Penemuan | Bukti | Cadangan | Status |
|---|---|---|---|---|---|---|
| AG-BE-016 | SEDERHANA | DB session | `get_db` menutup session tetapi tidak melakukan rollback eksplisit pada exception. SQLAlchemy close biasanya rollback, tetapi eksplisit lebih jelas. | `db/database.py` | Tambah `except: db.rollback(); raise` dalam fasa kecil berasingan. | OPEN |

## 13. Penemuan Validation dan Error Handling

| ID | Tahap | Komponen | Penemuan | Bukti | Cadangan | Status |
|---|---|---|---|---|---|---|
| AG-BE-017 | SEDERHANA | Validation | `status`, `severity`, `price_type`, `trend` ialah string bebas, bukan enum ketat. | `schemas/monitoring.py`, `schemas/market_price.py` | Tambah Literal/Enum Pydantic selepas pastikan frontend mapping lengkap. | OPEN |
| AG-BE-018 | RENDAH | Validation | `area_size` membenarkan 0. | `Field(ge=0)` | Putuskan sama ada 0 valid; jika tidak, tukar kepada `gt=0`. | OPEN |
| AG-BE-019 | RENDAH | Validation | Tarikh masa depan belum disekat untuk planting/activity/market price/harvest. | Schema date fields | Tambah validator produk mengikut keperluan. | OPEN |

## 14. Penemuan Konfigurasi Produksi

| ID | Tahap | Komponen | Penemuan | Bukti | Cadangan | Status |
|---|---|---|---|---|---|---|
| AG-BE-020 | SEDERHANA | Startup | Default `prepare_database_on_startup=True` menjalankan Alembic upgrade dan seed semasa startup. | `config.py`, `startup.py`, `main.py` | Untuk production, set env eksplisit dan dokumentasi; pertimbang default false pada fasa konfigurasi. | OPEN |
| AG-BE-021 | RENDAH | CORS | `allow_credentials=True`; jika env CORS diberi `*`, kombinasi ini berisiko. | `main.py`, `config.py` | Tambah validator larang wildcard bersama credentials. | OPEN |
| AG-BE-022 | RENDAH | Secret | `JWT_SECRET_KEY` wajib dalam Settings; ini baik. `.env.example` masih guna placeholder. | `config.py`, `.env.example` | Kekalkan wajib; jangan guna placeholder production. | ACCEPTED |

## 15. Ujian Backend Ditambah

Fail ditambah:

```text
agrimonitor_backend/tests/conftest.py
agrimonitor_backend/tests/test_health.py
agrimonitor_backend/tests/test_auth.py
agrimonitor_backend/tests/test_ownership.py
```

Ciri ujian:

- SQLite in-memory berasingan.
- `get_db` dioverride dalam TestClient.
- Database reset setiap test.
- `PREPARE_DATABASE_ON_STARTUP=false`.
- Tidak menghubungi Neon.
- Tidak bergantung kepada seed production.
- Dua pengguna digunakan untuk ownership test.

Liputan minimum:

- Root health.
- API health.
- Register berjaya.
- Email duplicate.
- Login berjaya.
- Password salah.
- Token hilang.
- Token rosak.
- `/auth/me`.
- Password hash tidak muncul dalam response.
- User A tidak boleh baca/update/delete planting record user B.

## 16. Pembetulan Dilaksanakan

Pembetulan/penambahan dilaksanakan:

- Tambah dependency dev `httpx2>=0.28.0` kerana FastAPI/Starlette TestClient versi semasa memerlukannya.
- Tambah suite ujian backend minimum.

Tiada endpoint, schema database, migrasi atau formula kewangan diubah.

## 17. Pembetulan Ditangguhkan

Ditangguhkan kerana memerlukan keputusan produk atau skop fasa berasingan:

- Strategi akhir `/finance/costs`.
- Penyatuan formula dashboard vs finance summary.
- Enum validation untuk status/severity/price type/trend.
- CSV strict/atomic mode dan dedupe.
- Rollback eksplisit pada `get_db`.
- CORS wildcard guard.
- Tarikh tuaian sebelum tarikh tanam.

## 18. Keputusan Quality Gate Backend

Arahan dijalankan:

```text
python -m compileall app: lulus
.\.venv\Scripts\python -m compileall app: lulus
.\.venv\Scripts\python -m pytest -v: 11 passed
```

Pytest global gagal sebelum ini kerana `pytest` tidak dipasang pada Python global, tetapi `.venv` sudah disediakan dengan dependency dev projek dan suite berjalan lulus.

## 19. Semakan Kontrak Frontend

Semakan kontrak frontend selepas perubahan backend:

```text
npm run test: gagal kerana Vitest fork worker timeout, 3 fail ujian sempat lulus dan 7 worker gagal bermula.
npx tsc --noEmit: lulus
npm run build: lulus
npx vitest run --pool=threads --maxWorkers 1 --no-file-parallelism: lulus, 10 fail ujian dan 79 ujian.
```

Kesimpulan: tiada regression kontrak frontend ditemui. Kegagalan `npm run test` asal ialah isu runtime worker pool/resource tempatan, bukan assertion test.

## 20. Fail Berubah

Kategori perubahan:

A. Infrastruktur ujian backend

- `agrimonitor_backend/pyproject.toml`
- `agrimonitor_backend/tests/conftest.py`

B. Ujian auth

- `agrimonitor_backend/tests/test_auth.py`

C. Ujian ownership

- `agrimonitor_backend/tests/test_ownership.py`

E. Dokumentasi audit

- `docs/audit-agrimonitor-fasa-7-0-backend.md`

F. Perubahan di luar skop

- `tmp-market-data/` kekal untracked dan tidak disentuh.

## 21. Risiko Kritikal, Tinggi, Sederhana dan Rendah

Tiada risiko KRITIKAL ditemui dalam audit statik ini.

Risiko TINGGI:

- AG-BE-009: Formula kos dashboard dan finance summary tidak konsisten.

Risiko SEDERHANA:

- AG-BE-003, AG-BE-012, AG-BE-013, AG-BE-016, AG-BE-017, AG-BE-020.

Risiko RENDAH:

- AG-BE-001, AG-BE-002, AG-BE-004, AG-BE-005, AG-BE-006, AG-BE-007, AG-BE-008, AG-BE-010, AG-BE-011, AG-BE-014, AG-BE-015, AG-BE-018, AG-BE-019, AG-BE-021, AG-BE-022.

## 22. Perkara Tidak Dapat Diuji

- Integrasi sebenar Neon/PostgreSQL production tidak diuji.
- Import CSV dengan fail besar dan encoding selain UTF-8 tidak diuji.
- Admin-only market price write endpoints belum diuji.
- Ownership untuk activities, symptoms, harvests, costs dan alerts belum diuji.
- Rollback DB pada kegagalan sebenar belum diuji.
- Coverage plugin belum tersedia; coverage tidak dilaporkan.

## 23. Cadangan Fasa Seterusnya

Cadangan kerja seterusnya:

1. Tambah ujian ownership untuk activity, symptom record, harvest, cost dan alerts.
2. Tentukan keputusan produk untuk `/finance/costs`: legacy/deprecated atau gabung dengan kos aktiviti.
3. Selaraskan formula dashboard dan finance summary selepas keputusan produk.
4. Tambah validation enum untuk status/severity/price type/trend.
5. Tambah rollback eksplisit di `get_db`.
6. Harden CSV import: saiz, MIME/extension, encoding error, dedupe dan strict mode.
7. Tambah CORS wildcard guard untuk production.

## 24. Status Git Sebelum Commit Penutupan

Status worktree selepas audit selesai dan sebelum commit penutupan Fasa 7.0:

```text
M  agrimonitor_backend/pyproject.toml
M  docs/langkah-pembangunan.md
?? agrimonitor_backend/tests/
?? docs/audit-agrimonitor-fasa-7-0-backend.md
?? tmp-market-data/
```

`tmp-market-data/` kekal untracked dan tidak disentuh untuk Fasa 7.0. Commit penutupan dibuat dalam langkah berasingan selepas dokumen audit ini disediakan.

```text
Push dibuat: TIDAK
PR dibuka: TIDAK
Schema database diubah: TIDAK
Frontend diubah: TIDAK
tmp-market-data disentuh: TIDAK
```