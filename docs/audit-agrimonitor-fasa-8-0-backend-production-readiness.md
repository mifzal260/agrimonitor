# Audit AgriMonitor Fasa 8.0 - Backend Production Readiness

Tarikh audit: 16 Julai 2026
Skop: Backend FastAPI sahaja. Frontend, schema database, migrasi Alembic, deployment dan `tmp-market-data/` tidak disentuh.

## Status Fasa

Status: SELESAI dengan isu produk dan infrastruktur direkod sebagai tertangguh.

Fasa 7.0 dianggap baseline repository semasa. Commit Fasa 7.0 tidak diubah, tidak dipadam, tidak di-amend, tidak di-reset dan tidak di-rebase.

Baseline commit:

```text
74f125e docs(audit): record phase 7 backend audit findings
d14b609 test(backend): add auth health and ownership regression tests
6261549 chore(backend): add test client development dependency
```

Status awal Fasa 8.0:

```text
?? tmp-market-data/
```

`git diff` dan `git diff --cached` kosong sebelum perubahan Fasa 8.0. Folder `tmp-market-data/` kekal tidak disentuh.

## Semakan Dependency TestClient

`agrimonitor_backend/pyproject.toml` menggunakan dependency dev:

```text
httpx2>=0.28.0
pytest>=8.0.0
```

Semakan runtime menunjukkan `httpx2` tersedia dalam virtual environment dan `httpx` tidak tersedia. Starlette/FastAPI TestClient dalam environment ini berjalan lulus dengan dependency sedia ada, jadi dependency tidak diubah dalam Fasa 8.0.

## Ringkasan Perubahan

- Tambah guard konfigurasi production untuk CORS wildcard, localhost database URL, JWT secret lemah dan `PREPARE_DATABASE_ON_STARTUP=true`.
- Tambah tetapan `LOGGING_LEVEL`, `CSV_MAX_UPLOAD_BYTES` dan `CSV_MAX_ROWS`.
- Normalisasi `postgresql://` kepada `postgresql+psycopg://`.
- Tambah rollback eksplisit dalam dependency session database.
- Tambah exception handler generik yang memulangkan respons selamat tanpa stack trace kepada client.
- Tambah readiness endpoint root dan API yang menyemak database dengan `SELECT 1`.
- Tambah enum validation untuk status tanaman, severity symptom, status symptom, price type dan trend.
- Harden import CSV dengan semakan extension, content type, saiz fail, encoding UTF-8 dan had row.
- Tambah regression test untuk configuration, rollback, readiness, enum validation, CSV validation dan ownership child resources.

## Penemuan AG-8.1 Hingga AG-8.9

| ID | Risiko | Penemuan | Tindakan | Status |
|---|---|---|---|---|
| AG-8.1 | Sederhana | Default development berbahaya boleh terbawa ke production jika env tidak ketat. | Validator production ditambah untuk CORS `*`, localhost DB, secret lemah dan startup DB preparation. | Selesai |
| AG-8.2 | Rendah | Logging sedia ada minimum dan tiada `print`, tetapi exception tidak direkod secara konsisten. | Logger app ditambah; unhandled exception direkod tanpa token/password/DB URL; client terima mesej generik. | Selesai |
| AG-8.3 | Sederhana | `get_db` menutup session tetapi rollback eksplisit belum jelas. | `get_db` kini rollback pada exception dan test regresi ditambah. | Selesai |
| AG-8.4 | Sederhana | Health check sedia ada hanya liveness dan tidak mengesahkan database. | `/health/ready` dan `/api/v1/health/ready` ditambah; kegagalan DB memberi 503 tanpa credential/stack trace. | Selesai |
| AG-8.5 | Sederhana | CORS wildcard dengan credential berisiko di production. | Production config menolak `CORS_ORIGINS=*`; domain production masih mesti diberi melalui env. | Selesai dengan risiko konfigurasi diterima |
| AG-8.6 | Sederhana | CSV import membaca fail penuh tanpa semakan extension/type/saiz/row limit. | CSV import kini validasi `.csv`, content type, saiz, UTF-8 dan had row; partial import kekal disengajakan. | Selesai separa |
| AG-8.7 | Sederhana | Input kategori/status menggunakan string bebas. | Pydantic Literal ditambah untuk planting status, symptom severity/status, market price type/trend dan filter price type. | Selesai |
| AG-8.8 | Rendah | Ownership child resources belum ada regression coverage penuh. | Test ownership ditambah untuk activity, symptom record, cost dan harvest. | Selesai |
| AG-8.9 | Tinggi | Dashboard dan finance summary menggunakan sumber kos berbeza. | Formula diaudit dan tidak diubah kerana memerlukan keputusan produk; direkod sebagai isu tertangguh. | Tertangguh |

## Formula Kewangan Semasa

Formula semasa tidak diubah dalam Fasa 8.0.

| Nilai | Formula semasa | Fail | Nota |
|---|---|---|---|
| Kos dashboard | `sum(Activity.cost_amount + Activity.labor_cost_amount)` | `app/services/dashboard_service.py` | Selaras dengan aliran UI semasa yang merekod kos melalui aktiviti ladang. |
| Hasil dashboard | `sum(Harvest.revenue)` | `app/services/dashboard_service.py` | Revenue harvest dikira semasa create/update harvest. |
| Untung/rugi dashboard | `Harvest.revenue - Activity costs` | `app/services/dashboard_service.py` | Berbeza daripada `/finance/summary`. |
| Kos finance summary | `sum(Cost.amount)` | `app/services/finance_service.py` | Endpoint legacy/additional cost masih wujud. |
| Untung/rugi finance summary | `Harvest.revenue - Cost.amount` | `app/services/finance_service.py` | Tidak mengambil kos aktiviti. |

Keputusan: blocked/tertangguh. Perlu keputusan pemilik sistem sama ada `/finance/costs` hendak kekal sebagai kos tambahan, digabungkan dengan kos aktiviti, atau dinyahaktifkan secara produk. Mengubah formula tanpa keputusan ini boleh mengubah laporan untung/rugi pengguna.

## Risiko PostgreSQL Yang Tidak Dibuktikan SQLite

Suite ujian backend menggunakan SQLite test database untuk regression cepat. Perkara berikut masih perlu ujian integrasi PostgreSQL/Neon sebenar:

- Tingkah laku transaction isolation dan rollback sebenar PostgreSQL.
- Perbezaan Decimal/Numeric precision antara SQLite dan PostgreSQL.
- Semakan Alembic migration terhadap Neon.
- Performance import CSV pada database remote.
- Constraint/foreign key behavior sebenar production.

## Ujian dan Quality Gate

| Command | Keputusan | Nota |
|---|---|---|
| `.\.venv\Scripts\python -m compileall app` | Lulus | Semua modul backend compile. |
| `.\.venv\Scripts\python -m pytest -v` | Lulus | 27 passed. |
| `.\.venv\Scripts\python -m pip check` | Lulus | No broken requirements found. |
| `.\.venv\Scripts\python -m ruff --version` | Tidak tersedia | `No module named ruff`; lint backend tidak dikonfigurasi. |
| `.\.venv\Scripts\python -m mypy --version` | Tidak tersedia | `No module named mypy`; type checking backend tidak dikonfigurasi. |
| `.\.venv\Scripts\python -m pip_audit --version` | Tidak tersedia | `No module named pip_audit`; dependency audit backend belum dikonfigurasi. |

## Fail Kod Diubah

- `agrimonitor_backend/app/core/config.py` - production safety validation, CSV limits, logging level dan database URL normalization.
- `agrimonitor_backend/app/core/enums.py` - shared Literal/allowed values untuk validation.
- `agrimonitor_backend/app/db/database.py` - rollback eksplisit dalam `get_db`.
- `agrimonitor_backend/app/main.py` - logging, exception handler dan root readiness endpoint.
- `agrimonitor_backend/app/api/routes/health.py` - API readiness endpoint.
- `agrimonitor_backend/app/api/routes/market_prices.py` - validation query `price_type`.
- `agrimonitor_backend/app/schemas/monitoring.py` - enum validation untuk monitoring payloads.
- `agrimonitor_backend/app/schemas/market_price.py` - enum validation untuk market price payloads.
- `agrimonitor_backend/app/services/market_price_service.py` - CSV upload hardening.
- `agrimonitor_backend/tests/test_config.py` - regression test configuration.
- `agrimonitor_backend/tests/test_database.py` - regression test rollback session.
- `agrimonitor_backend/tests/test_health.py` - liveness/readiness tests.
- `agrimonitor_backend/tests/test_ownership.py` - expanded ownership tests.
- `agrimonitor_backend/tests/test_validation_and_csv.py` - enum and CSV validation tests.

## Isu Tertangguh

- AG-8.9 formula kewangan memerlukan keputusan produk.
- `/finance/costs` masih perlu strategi produk rasmi: legacy/additional/gabungan.
- CSV import masih partial import dan belum ada dedupe/strict dry-run mode.
- Rate limiting untuk register/login/CSV import lebih sesuai dibuat melalui reverse proxy/WAF atau fasa backend berasingan.
- Trusted host/proxy header hardening belum dilaksanakan kerana domain production tidak ditentukan dalam skop ini.
- PostgreSQL/Neon integration test belum dijalankan.
- Lint, type checking dan dependency audit backend belum dikonfigurasi sebagai tool projek.

## Cadangan Fasa 9.0

1. Putuskan strategi formula kewangan dan `/finance/costs`.
2. Tambah integration test terhadap PostgreSQL/Neon test database berasingan.
3. Tambah rate limiting atau dokumentasi konfigurasi reverse proxy/WAF untuk auth dan CSV import.
4. Tambah lint/type/dependency audit backend secara rasmi dalam pyproject atau CI.
5. Tambah strict CSV import preview/dry-run dan dedupe berdasarkan commodity/location/type/date.
6. Audit OpenAPI exposure, trusted hosts dan proxy headers selepas domain production disahkan.

## Pemeriksaan Larangan

| Perkara | Status |
|---|---|
| Frontend diubah | Tidak |
| Schema database diubah | Tidak |
| Migration ditambah | Tidak |
| `tmp-market-data/` disentuh | Tidak |
| Commit baharu dibuat | Tidak |
| Push dibuat | Tidak |
| PR dibuka | Tidak |
| Secret ditambah | Tidak |
