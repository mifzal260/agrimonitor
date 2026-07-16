# Audit AgriMonitor - Fasa 6.1

Tarikh semakan: 16 Julai 2026
Skop: `agrimonitor_frontend` sahaja, dengan dokumentasi audit di `docs/`.
Larangan dipatuhi: tiada commit, tiada push, tiada PR, tiada perubahan backend, tiada perubahan schema, tiada upgrade Recharts v3, dan `tmp-market-data/` tidak disentuh.

## 1. Ringkasan

| ID | Status | Fail Diubah | Bukti |
| --- | --- | --- | --- |
| AG-012 | Selesai | `src/components/common/ConfirmDialog.tsx`, `src/components/common/__tests__/ConfirmDialog.test.tsx`, penggunaan di `MonitoringPage.tsx` dan `FinancePage.tsx` | Tiada `window.confirm`, `confirm(`, `window.alert`, `alert(` dalam `src`; ujian dialog lulus |
| AG-013 | Selesai dengan risiko kecil diterima | `src/utils/localeFormat.ts`, `src/utils/__tests__/localeFormat.test.ts`, komponen dashboard/monitoring/finance/market price yang menggunakan helper | Ujian formatter lulus; tiada `toLocaleDateString`/`toLocaleString` dalam `src` |
| AG-014 | Selesai | `src/utils/listDisplay.ts`, `src/components/common/ListDisplayControls.tsx`, `src/components/common/__tests__/ListDisplayControls.test.tsx`, `MonitoringPage.tsx`, `FinancePage.tsx` | Tiada `slice(0, 8)` lama; ujian 0/1/8/9/16/17 rekod lulus |
| AG-017 | Dinilai - `skipLibCheck=true` dikekalkan | `tsconfig.json`, `tsconfig.node.json` | Typecheck biasa lulus; `skipLibCheck=false` gagal pada declaration dependency Recharts/lodash |

## 2. Perubahan Tambahan Fasa 6.1

| Fail | Sebab | Risiko | Ujian |
| --- | --- | --- | --- |
| `src/components/common/ConfirmDialog.tsx` | Tambah `aria-describedby`, focus restoration dan focus loop Tab ringkas | Rendah; hanya tingkah laku modal | `ConfirmDialog.test.tsx` |
| `src/components/common/__tests__/ConfirmDialog.test.tsx` | Tambah bukti closed state, Escape, backdrop, loading, focus restoration | Rendah; test sahaja | Vitest |
| `src/components/common/__tests__/ListDisplayControls.test.tsx` | Tambah bukti label BM/EN dan expand/collapse | Rendah; test sahaja | Vitest |
| `src/utils/__tests__/listDisplay.test.ts` | Tambah kes 0, 1, 8, 9, 16, 17 | Rendah; test sahaja | Vitest |
| `src/utils/__tests__/localeFormat.test.ts` | Tambah bukti nilai mata wang, date-only, ISO timestamp, fallback | Rendah; test sahaja | Vitest |
| `src/features/monitoring/MonitoringPage.tsx` | Reset visible count apabila plot/tab simptom berubah | Rendah; mengurangkan stale UI state | Build/test/typecheck |
| `docs/audit-agrimonitor-fasa-6-1.md` | Rekod bukti audit | Tiada runtime risk | Semakan dokumen |

## 3. ConfirmDialog

Lokasi komponen reusable: `agrimonitor_frontend/src/components/common/ConfirmDialog.tsx`.

Ciri disahkan:

- `isOpen`, tajuk, mesej, label batal, label sahkan, callback batal, callback sahkan, loading, dan variant destructive tersedia.
- Escape menutup dialog apabila tidak loading.
- Escape tidak menutup dialog semasa loading.
- Klik backdrop menutup dialog hanya apabila tidak loading.
- Klik backdrop tidak menutup dialog semasa loading.
- Butang sahkan dan batal disabled semasa loading.
- Double submit dicegah oleh disabled state ketika loading.
- Fokus awal masuk ke butang sahkan.
- Fokus dikembalikan kepada elemen pembuka apabila dialog ditutup.
- Focus loop Tab ringkas mengekalkan fokus dalam dialog.
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, dan `aria-describedby` digunakan.
- Teks BM/EN datang daripada locale key sedia ada.

Lokasi penggunaan delete:

| Fail | Rekod | State | Loading/Error |
| --- | --- | --- | --- |
| `src/features/monitoring/MonitoringPage.tsx` | rekod tanaman | `deleteRequest` | loading delete dikawal state; error dipaparkan melalui banner parent |
| `src/features/monitoring/MonitoringPage.tsx` | aktiviti | `deleteRequest` | dialog ditutup selepas berjaya; gagal kekal dengan error parent |
| `src/features/monitoring/MonitoringPage.tsx` | simptom | `deleteRequest` | dialog reusable sama |
| `src/features/finance/FinancePage.tsx` | hasil tuaian | `deleteHarvestId` | loading delete; dialog ditutup selepas berjaya |

Nota: Tiada transaksi kewangan berasingan selepas keputusan design terdahulu; kos diambil daripada aktiviti crop monitoring.

## 4. Formatter

Helper pusat:

- Mata wang: `formatCurrency`, `formatPricePerUnit`, `formatPricePerKg` dalam `src/utils/localeFormat.ts`.
- Tarikh: `formatDateShort`, `formatDateLong` dalam `src/utils/localeFormat.ts`.
- Locale BM: `ms-MY`.
- Locale EN: `en-MY`.
- Date-only: `YYYY-MM-DD` dibina sebagai tarikh lokal (`new Date(year, month - 1, day)`) supaya tidak berubah sehari kerana UTC.
- Timestamp ISO dengan timezone: diparse sebagai timestamp sebenar dan diformat mengikut locale semasa.
- Nilai rosak/null/undefined/string kosong: fallback `-` secara UI ialah `—`.

Hasil diuji:

| Input | BM | EN |
| --- | --- | --- |
| `formatCurrency(0)` | `RM 0.00` | `RM 0.00` |
| `formatCurrency(10.5)` | `RM 10.50` | `RM 10.50` |
| `formatCurrency(1000)` | `RM 1,000.00` | `RM 1,000.00` |
| `formatCurrency(-20)` | `-RM 20.00` | `-RM 20.00` |
| `formatCurrency(null)` | `—` | `—` |
| `formatDateShort("2026-07-15")` | `15 Jul` | `15 Jul` |
| `formatDateLong("2026-01-01")` | `1 Januari 2026` | `1 January 2026` |
| `formatDateShort("2026-07-15T08:30:00Z")` | `15 Jul` | `15 Jul` |
| `formatDateLong("invalid-date")` | `—` | `—` |

Komponen Fasa 6 yang menggunakan helper: `MonitoringPage.tsx`, `FinancePage.tsx`, `DashboardPage.tsx`, `CommodityPriceTrend.tsx`, `MarketPricePage.tsx`, `CommodityPriceAccordion.tsx`, dan util berkaitan market/dashboard.

Risiko kecil diterima: helper menggunakan `Intl.NumberFormat` untuk nombor dan prefix `RM` terkawal supaya format UI kekal `RM 1,000.00`; ia tidak menggunakan `style: "currency"` kerana output `Intl` boleh menghasilkan spacing simbol berbeza mengikut runtime. Semua penggunaan wang tetap dipusatkan di helper.

## 5. Senarai

Mekanisme sebenar: `Lihat lagi / Tutup semula`, tambah paparan secara kelompok 8 rekod sehingga semua boleh dicapai.

| Senarai | Fail | Awal | Sorting | Sumber data | Reset |
| --- | --- | ---: | --- | --- | --- |
| Aktiviti plot | `MonitoringPage.tsx` | 8 | Sorting data sedia ada sebelum limit | Senarai penuh daripada API frontend state | Reset bila tukar plot |
| Simptom plot | `MonitoringPage.tsx` | 8 | Sorting data sedia ada sebelum limit | Senarai penuh daripada API frontend state | Reset bila tukar plot/status aktif-selesai |
| Kos aktiviti | `FinancePage.tsx` | 8 | Sorting data sedia ada sebelum limit | Senarai penuh daripada API frontend state | Reset bila tukar plot |
| Hasil tuaian | `FinancePage.tsx` | 8 | Sorting data sedia ada sebelum limit | Senarai penuh daripada API frontend state | Reset bila tukar plot |

Kes ujian `listDisplay`:

| Rekod | Awal dipaparkan | Butang | Selepas klik |
| ---: | ---: | --- | ---: |
| 0 | 0 | Tidak | Tidak berkaitan |
| 1 | 1 | Tidak | Tidak berkaitan |
| 8 | 8 | Tidak | Tidak berkaitan |
| 9 | 8 | Ya | 9 |
| 16 | 8 | Ya | 16 |
| 17 | 8 | Ya | 16, kemudian 17 |

Label BM/EN diuji melalui `ListDisplayControls.test.tsx`.

## 6. skipLibCheck

Konfigurasi semasa:

- `tsconfig.json`: `skipLibCheck: true`.
- `tsconfig.node.json`: `skipLibCheck: true`.

Keputusan:

- `npx tsc --noEmit`: lulus.
- `npx tsc --noEmit -p tsconfig.strict-libcheck.tmp.json` dengan `skipLibCheck=false`: gagal.

Error utama:

```text
node_modules/recharts/types/chart/generateCategoricalChart.d.ts(2,36): error TS7016:
Could not find a declaration file for module 'lodash'.
'D:/agrimonitor/agrimonitor_frontend/node_modules/lodash/lodash.js' implicitly has an 'any' type.
Try `npm i --save-dev @types/lodash` if it exists or add a new declaration (.d.ts) file containing `declare module 'lodash';`
```

Klasifikasi:

- Package punca: `recharts@2.15.4` declaration mengimport `lodash`.
- Error berasal daripada dependency, bukan kod projek.
- Kod error: `TS7016`.
- `@types/lodash` tiada.
- Memasang type dependency mungkin sah sebagai mitigasi, tetapi bukan dilakukan dalam Fasa 6.1 kerana arahan melarang pembaikan paksa tanpa sebab jelas.
- Keputusan: `Dinilai - skipLibCheck=true dikekalkan`.

Risiko diterima:

- Type declaration dependency tidak diperiksa sepenuhnya.
- Kod projek sendiri masih diperiksa oleh TypeScript strict mode.
- Risiko declaration pihak ketiga tidak konsisten masih wujud.
- Cadangan jangka panjang: fasa migrasi Recharts v3 atau kajian khusus type dependency Recharts/lodash.

## 7. Masa Build

Environment:

- Node: `v20.19.5`.
- npm: `11.6.3`.
- Vite: `8.1.4`.

| Run | Masa Vite | Wall-clock |
| --- | ---: | ---: |
| 1 | 13.08s | 25.63s |
| 2 | 2.45s | 14.63s |
| 3 | 2.56s | 13.91s |
| Purata | 6.03s | 18.06s |

Chunk terbesar: `DashboardPage` 388.03 kB.
Warning chunk besar: tiada.
Kesimpulan: Tiada regresi konsisten. Run pertama lebih perlahan, munasabah kerana cold cache/Windows filesystem/antivirus.

## 8. Recharts

- Versi terpasang: `recharts@2.15.4`.
- Dependency root: `recharts@"^2.12.0"`.
- Mesej deprecation: `1.x and 2.x branches are no longer active. Bump to Recharts v3 to receive latest features and bugfixes. See https://github.com/recharts/recharts/wiki/3.0-migration-guide`.
- Versi terkini npm: `3.9.2`.
- Peer dependency 2.15.4: `react` dan `react-dom` `^16.0.0 || ^17.0.0 || ^18.0.0 || ^19.0.0`.
- Peer dependency 3.9.2: `react`, `react-dom`, dan tambahan `react-is`.
- Security audit: `found 0 vulnerabilities`.
- Fail penggunaan Recharts: `src/features/dashboard/CommodityPriceTrend.tsx`.
- Klasifikasi: Perlu fasa migrasi berasingan.

## 9. Regression Manual

Manual browser/backend regression tidak dijalankan dalam Fasa 6.1 ini kerana tiada sesi browser automation dan tiada backend test environment terkawal dimulakan. Semakan yang disahkan ialah automated/unit/static/build.

| Senario | Status | Catatan |
| --- | --- | --- |
| Login | Tidak dapat diuji | Perlu backend/browser session sebenar |
| Logout | Tidak dapat diuji | Perlu backend/browser session sebenar |
| Dashboard | Tidak dapat diuji manual | Build/typecheck lulus; chart tests/util lulus melalui suite sedia ada |
| Monitoring | Tidak dapat diuji manual | Kod compile/test lulus; delete dialog/list controls diuji automatik |
| Finance | Tidak dapat diuji manual | Kod compile/test lulus; harvest dialog/list controls diuji automatik |
| Delete tanaman | Tidak dapat diuji manual | ConfirmDialog dan state delete disemak melalui kod/test |
| Delete aktiviti | Tidak dapat diuji manual | ConfirmDialog dan state delete disemak melalui kod/test |
| Delete simptom | Tidak dapat diuji manual | ConfirmDialog dan state delete disemak melalui kod/test |
| Delete hasil tuaian | Tidak dapat diuji manual | ConfirmDialog dan state delete disemak melalui kod/test |
| Delete transaksi | Tidak berkaitan | Kos transaksi berasingan dibuang; kos aktiviti digunakan |
| Format BM | Lulus automatik | `localeFormat.test.ts` |
| Format EN | Lulus automatik | `localeFormat.test.ts` |
| Senarai >8 | Lulus automatik | `listDisplay.test.ts`, `ListDisplayControls.test.tsx` |
| Import CSV | Tidak dapat diuji manual | Tidak disentuh Fasa 6.1 |
| Carta dan tooltip | Tidak dapat diuji manual | Recharts audit dilakukan; build lulus |

## 10. Quality Gate

```text
npm ci: lulus, 363 packages, 0 vulnerabilities, warning deprecated recharts@2.15.4
npm run test: lulus, 10 fail test, 79 tests, 0 gagal
npm run lint: lulus, 0 error
npx tsc --noEmit: lulus
npm run build: lulus; tiga run diukur; tiada chunk warning
npm audit: lulus, found 0 vulnerabilities
```

Nota test: output Vitest memaparkan stack trace simulasi daripada `ErrorBoundary.test.tsx`; suite tetap lulus dan stack trace itu ialah input ujian untuk memastikan stack trace tidak masuk DOM.

## 11. Carian Pola Lama

| Pola | Keputusan | Catatan |
| --- | --- | --- |
| `window.confirm` | Tiada | Bersih |
| `confirm(` | Tiada | Bersih |
| `window.alert` | Tiada | Bersih |
| `alert(` | Tiada | Bersih |
| `slice(0, 8)` | Tiada | Bersih |
| `toLocaleDateString` | Tiada | Bersih |
| `toLocaleString` | Tiada | Bersih |
| `RM hardcoded` | Ada false positive | Locale labels `Harga (RM/kg)`, formatter pusat, dan ujian expected output |
| `new Date(` | Ada penggunaan sah | Parsing date-only/timestamp, submit symptom date, resolved timestamp, market week helper |
| `toFixed(` | Ada penggunaan sah | Formatting axis/percentage dalam chart/accordion utils |

## 12. Fail Diubah

Modified tracked files semasa:

```text
agrimonitor_frontend/.env.example
agrimonitor_frontend/package-lock.json
agrimonitor_frontend/package.json
agrimonitor_frontend/src/App.tsx
agrimonitor_frontend/src/api/auth.ts
agrimonitor_frontend/src/api/client.ts
agrimonitor_frontend/src/api/dashboard.ts
agrimonitor_frontend/src/api/finance.ts
agrimonitor_frontend/src/api/marketPrices.ts
agrimonitor_frontend/src/api/monitoring.ts
agrimonitor_frontend/src/api/recommendations.ts
agrimonitor_frontend/src/features/auth/AuthPage.tsx
agrimonitor_frontend/src/features/dashboard/CommodityPriceTrend.tsx
agrimonitor_frontend/src/features/dashboard/DashboardPage.tsx
agrimonitor_frontend/src/features/dashboard/commodityPriceChartUtils.ts
agrimonitor_frontend/src/features/finance/FinancePage.tsx
agrimonitor_frontend/src/features/market-prices/CommodityPriceAccordion.tsx
agrimonitor_frontend/src/features/market-prices/CommodityPriceAccordionList.tsx
agrimonitor_frontend/src/features/market-prices/MarketPricePage.tsx
agrimonitor_frontend/src/features/market-prices/priceTrendUtils.ts
agrimonitor_frontend/src/features/monitoring/MonitoringPage.tsx
agrimonitor_frontend/src/i18n/locales/en.json
agrimonitor_frontend/src/i18n/locales/ms.json
agrimonitor_frontend/src/main.tsx
agrimonitor_frontend/src/utils/localeFormat.ts
agrimonitor_frontend/src/vite-env.d.ts
agrimonitor_frontend/tsconfig.json
agrimonitor_frontend/vite.config.ts
render.yaml
```

Untracked files semasa:

```text
agrimonitor_frontend/eslint.config.js
agrimonitor_frontend/src/__tests__/
agrimonitor_frontend/src/api/__tests__/
agrimonitor_frontend/src/auth/
agrimonitor_frontend/src/components/common/ConfirmDialog.tsx
agrimonitor_frontend/src/components/common/ErrorBoundary.tsx
agrimonitor_frontend/src/components/common/ListDisplayControls.tsx
agrimonitor_frontend/src/components/common/__tests__/
agrimonitor_frontend/src/config/
agrimonitor_frontend/src/features/dashboard/__tests__/
agrimonitor_frontend/src/features/market-prices/__tests__/
agrimonitor_frontend/src/test/
agrimonitor_frontend/src/utils/__tests__/
agrimonitor_frontend/src/utils/listDisplay.ts
agrimonitor_frontend/src/utils/marketPriceData.ts
tmp-market-data/
```

Perubahan Fasa 6.1 baharu: `ConfirmDialog.tsx`, `ConfirmDialog.test.tsx`, `ListDisplayControls.test.tsx`, `listDisplay.test.ts`, `localeFormat.test.ts`, `MonitoringPage.tsx`, dan dokumen ini.

Perubahan luar `agrimonitor_frontend`: `render.yaml` sudah modified dalam worktree sebelum penutupan ini; tidak diedit dalam Fasa 6.1. `docs/audit-agrimonitor-fasa-6-1.md` ditambah untuk bukti audit. `tmp-market-data/` kekal untracked dan tidak disentuh.

## 13. Keputusan Akhir

```text
Fasa 6.1: LULUS DENGAN RISIKO

AG-012: Selesai
AG-013: Selesai dengan risiko kecil diterima
AG-014: Selesai
AG-017: Dinilai - skipLibCheck=true dikekalkan

Build: Lulus
Test: Lulus
Lint: Lulus
TypeScript: Lulus
Audit: Lulus
Regression manual: Tidak lengkap; browser/backend manual tidak dijalankan

Risiko diterima:
- Recharts 2.15.4 deprecated.
- skipLibCheck=true masih diperlukan kerana type declaration dependency Recharts/lodash.
- Manual regression penuh memerlukan browser/backend environment terkawal.

Hutang teknikal:
- Migrasi Recharts v3 perlu fasa berasingan.
- Kajian `@types/lodash` atau migrasi dependency untuk membolehkan `skipLibCheck=false`.
- Manual E2E regression delete/import/chart perlu automasi Playwright atau setup test backend.

Item tidak dapat diuji:
- Login/logout sebenar.
- 401/session tamat sebenar.
- Delete sebenar terhadap backend.
- Import CSV sebenar.
- Tooltip chart melalui browser sebenar.
```

---

## Addendum Penutupan Semasa - 16 Julai 2026

Quality gate Fasa 6.1 telah dijalankan semula daripada `agrimonitor_frontend` dengan keputusan semasa berikut:

```text
npm ci: lulus; 363 packages; 0 vulnerabilities; warning deprecated recharts@2.15.4
npm run test: lulus; 10 fail ujian; 79 ujian lulus
npm run lint: lulus
npx tsc --noEmit: lulus
npm run build: lulus; Vite 8.1.4 built in 5.64s; chunk terbesar DashboardPage 388.03 kB; tiada chunk warning
npm audit: lulus; 0 vulnerabilities
```

Manual regression browser/backend/database penuh belum dijalankan dan tidak dianggap lulus. Playwright/E2E belum tersedia.

`recharts@2.15.4` dikekalkan buat masa ini walaupun deprecated. Migrasi ke Recharts v3 ialah hutang teknikal dan perlu fasa berasingan.

`skipLibCheck=true` dikekalkan kerana semakan sementara dengan `skipLibCheck=false` gagal pada declaration dependency pihak ketiga:

```text
node_modules/recharts/types/chart/generateCategoricalChart.d.ts(2,36): error TS7016
Could not find a declaration file for module 'lodash'.
```

Fasa seterusnya dinamakan:

```text
Fasa 7.0 - Audit dan Pengukuhan Backend
```

Fasa 7.0 ini bukan Fasa 7 dalam pelan MVP asal. Fasa 7 MVP asal merujuk kepada modul harga pasaran dan telah dilaksanakan sebelum ini.

Nota persediaan Fasa 7.0:

- Ujian backend pada masa ini hampir tiada dan perlu dibina secara sistematik.
- Strategi `/finance/costs` masih belum dimuktamadkan.
- Backend tidak boleh diubah dalam penutupan Fasa 6.1 ini.
