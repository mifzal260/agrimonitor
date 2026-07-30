# IoT Monitoring Simulation Mode

Modul Pemantauan IoT AgriMonitor dilaksanakan sebagai simulasi sahaja untuk MVP. Tiada integrasi perkakasan, gateway MQTT, vendor IoT, atau API luaran dibuat.

## Tujuan

- Menunjukkan bacaan sensor ladang secara hampir masa nyata.
- Membantu petani melihat status suhu, kelembapan udara, kelembapan tanah, cahaya dan bateri.
- Menyediakan asas API yang boleh ditukar kepada sumber IoT sebenar pada fasa kemudian tanpa mengubah UI utama.

## Jadual pangkalan data

- `iot_devices`: maklumat peranti sensor.
- `sensor_readings`: bacaan sensor mengikut peranti dan masa.

Migrasi Alembic:

```text
agrimonitor_backend/alembic/versions/20260730_0008_add_iot_monitoring.py
```

## Endpoint API

Semua endpoint berada di bawah `/api/v1/monitoring` dan memerlukan JWT.

```text
GET  /devices
GET  /devices/{device_id}
GET  /sensors/latest?device_id=<id>
GET  /sensors/history?device_id=<id>&from=<iso>&to=<iso>&limit=48&interval=raw
POST /simulation/generate?device_id=<id>
```

## Tetapan persekitaran

```text
IOT_DATA_MODE=simulation
IOT_ONLINE_AFTER_SECONDS=600
IOT_OFFLINE_AFTER_SECONDS=3600
IOT_TEMPERATURE_WARNING_CELSIUS=35
IOT_SOIL_MOISTURE_WARNING_PERCENT=30
IOT_BATTERY_WARNING_PERCENT=20
```

`IOT_DATA_MODE=iot` disediakan sebagai suis masa depan, tetapi provider sebenar belum dilaksanakan untuk MVP.

## Nota frontend

Halaman frontend `/iot-monitoring`:

- memaparkan badge `Mod Simulasi`;
- menjana bacaan simulasi melalui backend;
- polling setiap 10 saat;
- menghalang permintaan bertindih semasa refresh;
- mengekalkan data terakhir jika refresh gagal;
- memaparkan carta sejarah menggunakan Recharts.

## Batasan diterima

- Data bacaan ialah simulasi, bukan bacaan perkakasan sebenar.
- Tiada integrasi MQTT, webhook, firmware atau gateway.
- Tiada kawalan peranti jarak jauh.
