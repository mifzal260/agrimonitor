# Skop Projek AgriMonitor

Dokumen ini menetapkan skop MVP supaya pembangunan tidak tersasar.

## Dalam Skop

### Authentication

- Register.
- Login.
- Password hashing.
- JWT token.
- Role `admin` dan `user`.
- Protected routes.

### Admin Master Data

Admin boleh mengurus:

- Crops.
- Symptoms.
- Disease rules.
- Market prices.

### User Crop Monitoring

User boleh mengurus:

- Planting records.
- Farm activities.
- Symptom records.
- Costs.
- Harvests.

Sistem perlu:

- Kira umur tanaman.
- Papar status tanaman.
- Pastikan user hanya akses rekod sendiri.

### Rule-Based Recommendation

Sistem boleh:

- Match symptoms dengan disease rules.
- Papar risk level.
- Papar recommendation awal.
- Cipta alert untuk high-risk symptoms.

### Market Price

Sistem boleh:

- CRUD market prices.
- Import CSV selepas CRUD asas stabil.
- Papar latest price.
- Filter data.
- Papar graph harga menggunakan Recharts.

### Dashboard

Dashboard memaparkan:

- Crop status summary.
- Risk summary.
- Latest market prices.
- Price graph.
- Cost summary.
- Revenue summary.
- Profit/loss summary.

## Luar Skop

Perkara ini tidak dibuat dalam MVP:

- AI diagnosis.
- IoT/hardware.
- External APIs.
- Paid services.
- Complex notification system.
- Offline-first PWA penuh.
- Payment system.
- Advanced analytics.

## Role Permission

Public:

- Register.
- Login.

User:

- Urus rekod ladang sendiri.
- Lihat dashboard sendiri.
- Tidak boleh urus master data.
- Tidak boleh akses data user lain.

Admin:

- Urus master data.
- Urus market prices.
- Lihat summary yang diperlukan.

## Kriteria Siap MVP

MVP dianggap siap apabila:

- App boleh run secara lokal.
- Auth berfungsi.
- Role permission berfungsi.
- CRUD utama berfungsi.
- Rule-based recommendation berfungsi.
- Market price dan graph berfungsi.
- Dashboard berfungsi.
- README lengkap untuk setup dan deployment notes.

