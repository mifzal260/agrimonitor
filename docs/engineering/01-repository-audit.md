# AgriMonitor Repository Audit — Phase 1

**Audit date:** 2026-11-15
**Repository baseline:** `c234c5f` (`feat(market-prices): remove CSV import from page`)
**Branch:** `audit/phase-1-repository-review`
**Scope:** Repository-wide, read-only audit of first-party frontend, backend, tests, configuration, migrations, deployment settings, and existing documentation.

## Executive summary

AgriMonitor is a modular-monolith MVP with a React/Vite/TypeScript frontend and a FastAPI/SQLAlchemy backend. Authentication, session revocation, per-user ownership checks, request schemas, and a meaningful unit/API test suite are present. No confirmed Critical finding was identified in this phase.

The targeted checks confirmed two additional API defects. Finance PATCH schemas accept explicit `null` for required columns, and the resulting requests return HTTP 500 instead of 422. The IoT history endpoint accepts `interval=hourly` but returns the same unaggregated rows as `interval=raw`. Expected-behavior tests are included as strict xfails until implementation is approved.

Dependency scanning reports **22 npm advisories (9 high, 13 moderate)** across the frontend lockfile. Of these, `npm audit --omit=dev` reports **9 (5 high, 4 moderate)** in the non-dev dependency graph, which includes build tools declared under `dependencies`; this is not proof those packages ship in browser code or are exploitable in this application. `pip-audit` reports 40 advisory instances across 13 distributions in the local backend virtual environment, not an installed production resolution. AG-02 also confirms the frontend clears a session on any `/auth/me` failure. Other findings include CSV size checking after full read and process-local login throttling in the Render Blueprint. Production environment state remains unverified.

## Repository and system overview

- **Frontend:** React 18, TypeScript, Vite, Tailwind, React Router, Vitest, React Testing Library.
- **Backend:** Python 3.11+, FastAPI, Pydantic Settings, SQLAlchemy 2, PostgreSQL/psycopg, Alembic, pytest.
- **Main domains:** auth and sessions; crop/planting/activity/symptom monitoring; recommendations and alerts; market prices; dashboard; costs and harvests; IoT simulation; streaming agriculture chat through Ollama.
- **Deployment:** Render Blueprint for a Python web service and static frontend; PostgreSQL-compatible Neon database.
- **Architecture:** Modular monolith, organized into frontend feature modules and backend API/schema/service/model layers.
- **Database migration:** Alembic revision chain through `20261110_0010`; startup schema preparation is disabled in `render.yaml`. Deployment documentation calls for a manual/one-off `alembic upgrade head`.

## Audit method and boundaries

- Inspected first-party source structure, feature/API boundaries, model/schema/service patterns, relevant tests, manifests, migrations, Render configuration, README, and existing audit/security/deployment documentation.
- Excluded generated/dependency directories, binary/media files, local environment values, and secret contents.
- Ran tests and quality checks against local test/build environments only.
- Did **not** connect to production databases, inspect Render environment values/logs, run a production migration, or deploy.
- A dependency advisory indicates an affected package/version, not by itself a proven exploitable application path. Runtime reachability must be assessed before assigning a vulnerability to a specific code path.
- No production SBOM or Python lockfile is present, so exact production dependency resolution cannot be established from this repository.

## Findings

### AG-01 — Frontend and Python dependency advisories

**Severity:** High
**Status:** Confirmed package/advisory matches. Exploitability and backend production resolution are not established.

- **Frontend — non-dev dependency graph:** These packages are in `npm audit --omit=dev`; several are build-time tools and this classification does not establish runtime reachability from the deployed static site.

| Package version | Severity | npm advisory IDs |
|---|---|---|
| `baseline-browser-mapping@2.10.42` | Moderate | 1193686 |
| `browserslist@4.28.4` | High | 1153171, 1153172 |
| `nanoid@3.3.15` | High | 1138811, 1139427 |
| `postcss@8.5.16` | High | 1130709, 1139510 |
| `postcss-selector-parser@6.1.4` | Moderate | 1243379 |
| `react-router@6.30.4` | Moderate | 1124268, 1124272 |
| `react-router-dom@6.30.4` | Moderate | 1193652 |
| `source-map-js@1.2.1` | High | 1241209 |
| `vite@8.1.4` | High | 1242624, 1242653, 1242660, 1242726, 1242732 |

- **Frontend — development/build-only dependency graph:** The following findings are excluded by `npm audit --omit=dev`. This includes test and lint tooling as well as transitives.

| Package version(s) | Severity | npm advisory IDs |
|---|---|---|
| `typescript-eslint@8.62.1` and `@typescript-eslint/*@8.62.1` | Moderate | 1244623 via the `minimatch` dependency |
| `@vitest/mocker@4.1.10` | Moderate | 1193684, 1242767 |
| `brace-expansion@1.1.16`, `5.0.7` | High | 1130588, 1130591, 1130734, 1130737, 1240100, 1240103, 1240104, 1240107, 1240108, 1240111 |
| `js-yaml@4.3.0` | High | 1138115, 1193727 |
| `minimatch@10.2.5` | Moderate | 1244623 |
| `undici@7.28.0` | High | 1130715, 1130718, 1130726, 1130729, 1130731, 1239933, 1240036, 1240038, 1240041, 1240044, 1240046, 1240048, 1240050, 1240052, 1240055, 1243078, 1243081, 1243113, 1243473, 1243475, 1243478, 1243481, 1243484 |
| `vitest@4.1.10` | Moderate | 1193683 (also depends on `@vitest/mocker`) |
| `zod@4.4.3` | High | 1243066 |

- **Python — local virtual environment only:** `agrimonitor_backend/pyproject.toml` has no lockfile. `pip-audit` scans the local virtual environment; the first two rows below are declared direct runtime dependencies, and `cryptography` is requested through the `python-jose[cryptography]` extra. Other rows are installed distributions whose production inclusion is unverified.

| Installed package version | Environment relationship | Advisory identifiers |
|---|---|---|
| `anyio==4.14.1` | Installed; runtime/transitive status not locked | CVE-2026-63374 / GHSA-82r6-8w77-94w6; CVE-2026-63349 / GHSA-3w57-8xmc-8v26; CVE-2026-64847 / GHSA-5p39-cfhj-2xmp |
| `certifi==2026.6.17` | Installed; production inclusion unverified | GHSA-6q48-6c7w-9gw2 |
| `cryptography==49.0.0` | Requested by declared `python-jose[cryptography]` extra | CVE-2026-69247 / GHSA-g6cj-pr64-35w5 |
| `dnspython==2.8.0` | Installed; production inclusion unverified | CVE-2026-114605 / GHSA-45c3-73f7-pv4m; CVE-2026-128089 / GHSA-vvf4-9x63-8xvv |
| `ecdsa==0.19.2` | Installed; production inclusion unverified | CVE-2024-23342 / GHSA-wj6h-64fc-37mp |
| `filelock==3.32.0` | Installed; production inclusion unverified | CVE-2026-112940 / GHSA-v4x8-3wr5-3wq8; CVE-2026-112913 / GHSA-9vhv-jxww-xfm5; CVE-2026-112907 / GHSA-567q-5qvw-pf92; CVE-2026-112938 / GHSA-m462-7rxw-wvpg; CVE-2026-112936 / GHSA-j8f7-rjxc-mr56; CVE-2026-112910 / GHSA-8mx5-7m5m-r77g; CVE-2026-112909 / GHSA-69hj-f68j-2879; CVE-2026-112911 / GHSA-9c4x-gm8v-wgc4; CVE-2026-112939 / GHSA-rfpc-qcw5-3pc4; CVE-2026-112915 / GHSA-cwqr-hh33-gh44; CVE-2026-112935 / GHSA-fq56-3cx3-fjxp; CVE-2026-112908 / GHSA-6627-m3xw-93mp |
| `httpcore2==2.7.0` | Installed; production inclusion unverified | CVE-2026-84381 / GHSA-7mj9-2mp8-4m2p |
| `httpx2==2.7.0` | Installed; production inclusion unverified | CVE-2026-84380 / GHSA-pf96-p4fj-6566; CVE-2026-84378 / GHSA-f2fp-rgf2-35cp; CVE-2026-84381 / GHSA-7mj9-2mp8-4m2p; CVE-2026-84379 / GHSA-h4x7-gw46-3wm6; CVE-2026-84382 / GHSA-8xx6-hgc6-gc2m |
| `msgpack==1.2.1` | Installed; production inclusion unverified | CVE-2026-114613 / GHSA-j586-36cw-2gc2 |
| `pip==26.1.2` | Local packaging tool, not an application dependency | CVE-2026-13346 / GHSA-qwm4-qh6w-59xr |
| `pyasn1==0.6.4` | Declared direct runtime dependency | CVE-2026-119196 / GHSA-2qm8-x737-gmw5; CVE-2026-119194 / GHSA-fm9c-5rcf-2q5p; CVE-2026-119197 / GHSA-mm57-4v3p-rchx; CVE-2026-119195 / GHSA-9m75-vc3g-4x39 |
| `python-jose==3.5.0` | Declared direct runtime dependency | CVE-2026-85394 / GHSA-3qf3-8w2g-rqmx |
| `urllib3==2.7.0` | Installed; production inclusion unverified | CVE-2026-97689 / GHSA-vxq7-64xx-v4gw; CVE-2026-97688 / GHSA-gh4c-6fx4-qh6g; CVE-2026-97687 / GHSA-8988-9cw3-xx77 |

- **Root cause:** Dependency ranges are not constrained to a reviewed, reproducible backend resolution; the installed backend environment may include packages not declared by the project. Frontend advisories exist in the committed resolved graph.
- **Impact:** Affected installed versions can expose their consumers to advisory-specific denial of service, redirect, file disclosure, or other behaviors. No exploitability or production reachability was tested. Frontend `--omit=dev` includes dependencies used only during static build; backend production versions cannot be asserted without a lock/SBOM.
- **Reproduction:** From `agrimonitor_frontend`, run `npm audit` and `npm audit --omit=dev`; from `agrimonitor_backend`, run `.venv\Scripts\python.exe -m pip_audit --format=json`.
- **Expected:** Deployed dependency versions have no unaccepted advisories, with a reproducible manifest and documented exceptions.
- **Actual:** npm audit reports 22 advisories (9 high, 13 moderate); `--omit=dev` reports 9 (5 high, 4 moderate). The local Python environment reports 40 advisory instances across 13 distributions; some duplicate advisory records are reported by pip-audit. `pip check` passes but does not check security.
- **Recommended fix:** After approval, resolve the exact production Python graph and introduce a reviewed lock/SBOM strategy, then update dependencies in controlled batches. Do not run `npm audit fix --force`; no automated dependency fix was run during this audit. Review semver and runtime/build impacts before any upgrade.
- **Required tests:** Existing frontend/backend suites, build/lint, dependency audit, and contract/regression tests for changed libraries.
- **Regression risk:** Medium; router, Vite, PostCSS, cryptography and HTTP-stack updates may alter routing, build output, or runtime behavior.

### AG-02 — Session restoration clears credentials for transient failures

**Severity:** Medium
**Status:** Confirmed at the Phase 1 audit baseline; fixed on the Phase 2 feature branch, not deployed.

- **Evidence:** `agrimonitor_frontend/src/App.tsx:75-81` clears stored tokens in a catch-all handler for `getMe()`. The existing test in `src/__tests__/App.routing.test.tsx:182-194` mocks a generic error and expects logout behavior rather than distinguishing authentication failures from network/server failures.
- **Root cause:** Session restoration treats all request failures as invalid credentials.
- **Impact:** A temporary network error, HTTP 5xx, or service outage can unnecessarily clear a still-valid session and redirect the user to login.
- **Reproduction:** Keep valid tokens, make `/auth/me` fail with a network error or 5xx, then reload a protected route; the catch handler clears the tokens.
- **Expected session behavior:** (1) A final HTTP 401 after the API client's refresh/retry means the credentials are invalid or expired: clear access and refresh tokens and route to login. If refresh succeeds, keep the renewed session. (2) HTTP 403 means authenticated but forbidden: retain tokens and show an authorization error. (3) HTTP 5xx, network failure, or timeout is transient: retain tokens and show a recoverable error/retry state; do not redirect to login.
- **Actual:** The API client clears the session for failed 401 handling and otherwise preserves it, but the broad `App.tsx` catch then clears credentials for any rejected `getMe()` request, including 403, 5xx, network errors, and timeouts.
- **Recommended fix:** Classify API errors by status and transport failure; only clear on authentication rejection.
- **Required tests:** Final 401 clears both tokens and redirects; successful refresh retains the session; 403 preserves tokens and displays forbidden; 5xx/network/timeout preserve tokens and provide retry.
- **Regression risk:** Low to medium; ensure invalid/expired sessions still reach the login flow.

### AG-03 — CSV byte limit is checked after full upload read

**Severity:** Medium
**Status:** Confirmed code-path issue; resource impact not load-tested.

- **Evidence:** `agrimonitor_backend/app/services/market_price_service.py:98-100` calls `await file.read()` and then validates the content size at lines 88-95. The configured limit is 1 MiB (`app/core/config.py:20`); the route remains available to authenticated admins at `app/api/routes/market_prices.py:54-56`, even though the frontend import UI was removed.
- **Root cause:** Size validation operates on the fully materialized request body.
- **Impact:** Oversized admin uploads can consume memory before returning HTTP 413; concurrent requests can multiply that memory use.
- **Reproduction:** Upload a CSV larger than `CSV_MAX_UPLOAD_BYTES`; it is read fully before the 413 check.
- **Expected:** Reject once the configured cap is exceeded while streaming/reading bounded chunks.
- **Actual:** The complete file is read before the cap is applied.
- **Recommended fix:** Enforce the byte limit during bounded reads and preserve the existing extension/content/row validation. Confirm whether the backend CSV endpoint should remain supported after removal of its UI; do not remove it without product approval.
- **Required tests:** Over-limit stream stops at the limit; exact-limit upload succeeds; over-limit upload returns 413; valid imports and row limit behavior remain unchanged.
- **Regression risk:** Medium; streaming changes can affect encoding, multipart handling, and partial-import semantics.

### AG-04 — Login throttling defaults to process-local memory

**Severity:** Medium
**Status:** Confirmed repository configuration; active production override not verified.

- **Evidence:** `agrimonitor_backend/app/core/config.py:40` defaults to `memory`; `render.yaml:46-47` explicitly sets `LOGIN_PROTECTION_STORE=memory`. The memory implementation stores attempt state in the current process. Redis support exists, but repository configuration does not activate it.
- **Root cause:** Throttle state is local to each backend process when memory mode is selected.
- **Impact:** With multiple workers/instances, a caller may distribute attempts across independent counters; a restart clears the in-memory counters. Actual production worker count/configuration was not inspected.
- **Reproduction:** Run multiple backend processes with memory mode and distribute login attempts among them; each process maintains separate state.
- **Expected:** Production throttling uses a shared, available store, or the deployment explicitly accepts and documents the single-process limitation.
- **Actual:** The committed Render Blueprint selects memory mode.
- **Recommended fix:** Confirm the actual Render environment and cost/availability trade-offs, then approve a shared Redis-compatible store rollout and failure drills. No production change is made by this audit.
- **Required tests:** Multi-worker shared-counter test, restart persistence test, and fail-closed Redis outage test.
- **Regression risk:** Medium; misconfigured shared storage can make login/registration unavailable under fail-closed behavior.

### AG-05 — Legacy access tokens do not participate in server-side session revocation

**Severity:** Medium
**Status:** Confirmed compatibility path; production token population/configuration not verified.

- **Evidence:** `agrimonitor_backend/app/core/config.py:39` defaults `allow_legacy_access_tokens=True`; `render.yaml:34-35` also sets `ALLOW_LEGACY_ACCESS_TOKENS=true`. In `app/core/dependencies.py:34-41`, a token without `session_id` is accepted (with a warning); the active-session query is applied only when a session claim exists (`:58-61`).
- **Root cause:** Legacy-token compatibility deliberately bypasses the session lookup because those tokens cannot identify a session.
- **Impact:** A valid legacy access token is not revoked by logout/session revocation and can remain usable until its JWT expiry. Default access-token lifetime is 15 minutes. Actual legacy token use in production is unknown.
- **Reproduction:** Issue a valid token without `session_id` while legacy support is enabled, revoke the user’s sessions, then use the token before expiry.
- **Expected:** Session-bound tokens are checked against active, unexpired, non-revoked session state; legacy compatibility is disabled once its migration window is complete.
- **Actual:** Session-bound tokens are checked; a token without the claim follows the logged compatibility path.
- **Recommended fix:** Inventory/monitor legacy-token acceptance and disable compatibility only after an approved rollout window and token lifetime drain.
- **Required tests:** Existing session revocation tests plus a deployment-policy test that legacy tokens are rejected after the compatibility window.
- **Regression risk:** Medium; disabling compatibility too early invalidates remaining clients.

### AG-06 — Finance and dashboard totals use different cost sources

**Severity:** Medium
**Status:** Reporting discrepancy documented by the previous backend audit; whether it is a bug depends on the unapproved business rule.

- **Evidence:** `docs/audit-agrimonitor-fasa-8-0-backend-production-readiness.md:69-80` records dashboard costs from `Activity.cost_amount + Activity.labor_cost_amount`, while `/finance/summary` uses `Cost.amount`. The prior audit recorded different profit/loss totals and explicitly left the issue unresolved.
- **Root cause:** Two reporting paths use distinct persistence models/formulas.
- **Impact:** Users can see inconsistent costs and profit/loss values for the same farm period.
- **Reproduction:** Enter activity costs and compare dashboard totals with `/finance/summary`; the existing audit identified the mismatch but this phase did not run a fresh formula comparison.
- **Expected:** Product documentation defines whether Cost rows are additional, legacy, or combined with activity costs.
- **Actual:** Formula intent is undocumented/undecided in the prior audit; formulas differ.
- **Recommended fix:** Do not change any accounting formula until the owner approves a written accounting rule. Treat this finding as unresolved product behavior, not an implementation authorization.
- **Required tests:** Agreement-level fixtures covering activity costs, standalone costs, harvest revenue, and overlapping/empty periods.
- **Regression risk:** High; changes alter financial reports and user expectations.

### AG-07 — Production API URL absence silently falls back to same-origin

**Severity:** Low
**Status:** Confirmed fallback behavior; production environment value not verified.

- **Evidence:** `agrimonitor_frontend/src/config/api.ts:7-15` returns an empty API base URL on non-local hosts when both Vite variables are absent. `render.yaml:78-79` declares `VITE_API_BASE_URL` as a dashboard-supplied value but does not validate its presence at build time.
- **Root cause:** Production configuration is optional and has a silent empty-string fallback.
- **Impact:** A static build without the required variable sends API requests to the frontend origin and fails unless a same-origin API proxy exists.
- **Reproduction:** Build/serve with both variables unset on a non-local hostname and inspect `buildApiUrl`.
- **Expected:** Production build/configuration fails clearly when no valid API base URL is supplied, unless same-origin proxy mode is an explicit supported configuration.
- **Actual:** The application silently uses an empty base.
- **Recommended fix:** Define and validate the supported deployment mode; fail clearly for missing or malformed production API configuration.
- **Required tests:** Production missing/invalid URL fails; local development fallback remains; configured URL is normalized.
- **Regression risk:** Low; deployments relying on an undocumented same-origin proxy may fail fast.

### AG-08 — Raw source IP is included in security logs

**Severity:** Low
**Status:** Confirmed code behavior; production log access/retention not verified.

- **Evidence:** `agrimonitor_backend/app/services/login_protection.py:656-659, 682-685` logs both `source_ip` and `source_ip_hash`.
- **Root cause:** Log context retains the raw address in addition to its pseudonymous hash.
- **Impact:** IP addresses are personal data; access to or retention of logs increases privacy exposure.
- **Reproduction:** Trigger a login-protection event and inspect the structured log fields.
- **Expected:** Log only the minimum pseudonymous identifier required by the security workflow, or document and control raw-IP retention.
- **Actual:** Both raw IP and hash are emitted.
- **Recommended fix:** Remove/redact raw IP or document retention/access and legal basis.
- **Required tests:** Assert security log records omit raw IP while preserving the hash and request correlation.
- **Regression risk:** Low; incident investigation may lose direct IP lookup unless an approved process exists.

### AG-09 — Custom crop helper text contradicts per-record storage

**Severity:** Low
**Status:** Confirmed at the Phase 1 audit baseline; corrected on the Phase 2 feature branch, not deployed.

- **Evidence:** `agrimonitor_frontend/src/i18n/locales/ms.json:149` and `en.json:149` say a custom crop is added to the shared catalog. The current create flow stores the custom name on a planting record (`MonitoringPage.tsx` and backend planting-record schema/service), not in the shared catalog.
- **Root cause:** Localization copy was not updated after custom crop storage changed.
- **Impact:** Users receive incorrect information about whether their crop name is shared.
- **Reproduction:** Select “Other/Lain-lain” in Add Planting Record and read its help text.
- **Expected:** Copy explains that the custom name belongs to that planting record and is not added to the shared selector.
- **Actual:** Copy promises shared-catalog insertion.
- **Recommended fix:** Correct both locale strings and add a lightweight localization assertion.
- **Required tests:** Assert Malay and English helper copy communicates record-only storage.
- **Regression risk:** Low.

### BUG-07 — Finance PATCH accepts null for required columns

**Severity:** Medium
**Status:** Confirmed by API tests; no production data was accessed or changed.

- **Evidence:** `CostUpdate` and `HarvestUpdate` type required database columns as optional nullable fields (`agrimonitor_backend/app/schemas/finance.py:19-23,46-51`). The corresponding SQLAlchemy columns are `nullable=False` in `app/models/cost.py` and `app/models/harvest.py`. Update services apply every explicitly supplied field (`app/services/finance_service.py:40-63`); a null then reaches the database or revenue calculation and raises an unhandled server error.
- **Root cause:** PATCH schemas conflate “field may be omitted” with “field may explicitly be null.”
- **Impact:** Clients can trigger HTTP 500 by submitting null for required finance columns instead of receiving a client validation response; the request does not complete as a valid update.
- **Reproduction:** `cd agrimonitor_backend; .\\.venv\\Scripts\\python.exe -m pytest tests\\test_finance_patch_validation.py -q -rx`.
- **Expected:** Explicit null for `cost_type`, `amount`, `cost_date`, `harvest_date`, `quantity`, `unit`, or `selling_price_per_unit` returns HTTP 422. Omitted fields remain unchanged; nullable `notes` continues to accept null.
- **Actual:** All seven explicit-null cases return HTTP 500. The corresponding expected-422 regression cases are strict xfails until implementation is approved.
- **Recommended fix:** In an approved implementation phase, reject null for required columns in the update schemas while preserving omission and legitimately nullable fields.
- **Required tests:** Retain the seven 422 regressions, add omitted-field and nullable-notes cases, and ensure the database transaction remains usable after invalid requests.
- **Regression risk:** Low to medium; existing clients that send null to mean “leave unchanged” must omit the field instead.

### BUG-08 — `interval=hourly` does not aggregate sensor history

**Severity:** Medium
**Status:** Confirmed by endpoint and service tests; desired aggregate value/timestamp semantics still need product/API approval.

- **Evidence:** `/api/v1/monitoring/sensors/history` accepts `interval` (`agrimonitor_backend/app/api/routes/monitoring.py:180-193`) but does not pass it to `list_sensor_history`. The service selects and returns raw rows (`app/services/iot_simulator.py:144-164`).
- **Root cause:** The query parameter is validated but ignored by the history endpoint.
- **Impact:** Consumers selecting hourly history still receive every raw reading, so the endpoint does not reduce rows to hourly groups and can mislead charting/reporting clients.
- **Reproduction:** `cd agrimonitor_backend; .\\.venv\\Scripts\\python.exe -m pytest tests\\test_iot_monitoring.py -q -rx`. The test seeds three readings with two in the same hour.
- **Expected:** `interval=hourly` returns at most one reading per hour, unlike `interval=raw`. The test currently asserts this grouping cardinality only; it deliberately does not choose average-vs-latest values or bucket timestamp semantics.
- **Actual:** The `interval=hourly` response contains the same three readings as `interval=raw`. The expected grouping test is a strict xfail until implementation is approved.
- **Recommended fix:** First approve aggregation semantics (averaging or latest sample, timestamp/bucket convention, timezone, empty hours, and whether `limit` counts rows or buckets). Then implement without changing the existing response schema unless separately approved.
- **Required tests:** Keep raw mode unchanged; assert hourly grouping and approved value/timestamp semantics, including boundary/timezone and limit behavior.
- **Regression risk:** Medium; clients may currently depend on the raw-shaped response despite requesting hourly data.

## Finding classification

- **Confirmed functional bugs at the audit baseline:** AG-02 (session restoration on transient errors), AG-03 (unbounded read before CSV size check), AG-09 (incorrect crop-sharing copy), BUG-07, and BUG-08. AG-02, AG-09, and BUG-07 have fixes on the Phase 2 feature branch; none are deployed.
- **Confirmed technical/security debt, with production exposure not fully established:** AG-01 dependency advisories; AG-08 raw IP logging; lack of CI and PostgreSQL/E2E validation.
- **Unverified deployment/configuration risks:** AG-04 actual shared rate-limit behavior, AG-05 actual use of legacy tokens, AG-07 required API URL in the live deployment, and manual migration sequencing.
- **Business-rule-dependent discrepancy:** AG-06 financial totals. Do not modify the accounting formula until the business rule is approved.
- **Intended MVP behavior:** the shared `IOT-DEMO-001` simulator and its readings. Keep this behavior; it is not a defect and no isolation change is proposed without an approved requirement.

## Architecture and operational observations

- The IoT simulation has a fixed `IOT-DEMO-001` device and shared readings (`app/services/iot_simulator.py`). README describes one demo device; retain this intended MVP behavior. BUG-08 concerns only the ignored `interval=hourly` option, not device ownership or isolation.
- The project has no `.github/workflows` directory and no configured repository CI workflow. Frontend scripts provide test/lint/build; backend tests are available, but backend lint/type-check commands are not declared in `pyproject.toml`.
- `render.yaml` deploys the backend with `PREPARE_DATABASE_ON_STARTUP=false` and has no migration command. `docs/deployment-render-neon.md` requires an operator/one-off `alembic upgrade head` before the new backend receives traffic. This is a documented manual process, but the release still depends on an external sequencing step.
- The market-price CSV API route still exists and is admin-only although its frontend form was removed. This phase did not remove the endpoint.
- Backend tests use an isolated SQLite in-memory database; no PostgreSQL/Neon integration or end-to-end browser suite was found in the repository.
- Prior security/deployment documents are dated July 2026 and contain statements tied to earlier commits/deployments. Reconcile them against current code and verified Render state before treating them as current production evidence.

## Prioritized remediation backlog

1. **Establish production dependency facts (AG-01):** resolve the backend production graph and confirm frontend build/runtime inclusion. Then remediate confirmed high-severity direct/production-installed advisories in reviewed batches; no `npm audit fix --force`.
2. **Reject finance nulls (BUG-07):** return 422 for the seven required fields while preserving omitted-field PATCH behavior and nullable notes.
3. **Correct session restoration (AG-02):** implement the status-specific 401/403/5xx/network/timeout behavior and test it.
4. **Approve hourly semantics, then implement (BUG-08):** decide aggregation values, timestamp/time zone, empty hours, and `limit`; keep the current response shape unless the owner approves a contract change. Do not change the shared IoT demo device.
5. **Bound CSV reads (AG-03):** enforce the configured size limit before buffering the whole upload; confirm whether the backend import endpoint remains supported.
6. **Resolve configuration/privacy debt (AG-04, AG-05, AG-07, AG-08):** verify actual deployment settings, approve any auth-policy changes, and decide IP logging retention. Do not change production infrastructure in this audit.
7. **Correct crop helper copy (AG-09)** and add a locale assertion.
8. **Keep finance formula work blocked (AG-06)** pending a written business rule; add CI/PostgreSQL/migration validation only in an approved scope.

## Decisions requiring owner approval

- **BUG-08 contract:** Should an hourly bucket contain the arithmetic mean or latest reading? What timestamp identifies the bucket (UTC hour start, local hour, or sample time)? How should timezone boundaries, missing hours, and `limit` be handled? The shared demo device remains unchanged.
- **AG-06 accounting:** Should `/finance/summary` include activity costs, treat `Cost` as additional, or preserve separate meanings? No formula change before this is decided.
- **AG-01 dependencies:** Approve a backend lock/SBOM strategy and dependency update policy, including compatibility/regression testing for vulnerable frontend direct and transitive packages.
- **AG-04/AG-05 auth operations:** What shared rate-limit service and availability/cost plan are acceptable? When may legacy access-token compatibility be disabled, given client rollout and outstanding token lifetime?
- **AG-03 product surface:** Should the admin-only CSV API remain supported after its frontend import form was removed?
- **Deployment assurance:** What production migration, backup, smoke-test, and rollback gates are required? Is same-origin frontend API proxying a supported deployment mode (AG-07)?

## Proposed Phase 2 scope (not approved or started)

1. Implement BUG-07 with explicit-null 422 validation for required finance columns; preserve omitted fields and nullable `notes`.
2. Implement AG-02 session behavior: final 401 clears both tokens and redirects; successful refresh retains the session; 403 retains credentials and shows forbidden; 5xx/network/timeouts retain credentials and show retryable failure.
3. Implement BUG-08 only after written approval of aggregation and timestamp/limit semantics. Keep the existing response schema and shared `IOT-DEMO-001` behavior unless separately approved.
4. If approved, address AG-03 with bounded upload reads and regression coverage.
5. Resolve AG-01 production dependency facts and make a separately reviewed dependency-remediation change with full tests and audit checks.
6. Defer AG-06 accounting changes until its rule is approved. No production deployment, database migration, or infrastructure modification is included in this proposed scope.

## Files and areas inspected

- Frontend: `src/App.tsx`, `src/routes`, `src/auth`, `src/api`, `src/config`, `src/features`, `src/types`, `src/i18n`, tests, `package.json`, and `package-lock.json`.
- Backend: `app/api/routes`, `app/core`, `app/db`, `app/models`, `app/schemas`, `app/services`, Alembic revisions, tests, and `pyproject.toml`.
- Operations/docs: `render.yaml`, `README.md`, deployment, database, auth lifecycle, current security notes, and prior Phase 8 backend audit.
- Secret values, local `.env` contents, production environment, production DB, and production logs were not inspected.

## Checks run

| Check | Result |
|---|---|
| Backend targeted `pytest tests\test_finance_patch_validation.py tests\test_iot_monitoring.py -q -rx` | Passed — 16 passed, 8 strict xfailed. Seven characterization cases confirm HTTP 500 for explicit null; seven desired-422 tests xfail. Hourly returns the exact same 3 rows as raw; expected grouping test xfails. |
| Backend full `python -m pytest -q -rx` | Passed — 189 passed, 8 strict xfailed. The expected BUG-07/BUG-08 behavior remains xfailed because implementation is not approved. |
| Backend `python -m pip check` | Passed — no broken requirements |
| Backend `python -m pip_audit --format=json` | Reported 40 advisory instances across 13 installed distributions; non-zero exit. Local environment only; not a production SBOM. |
| Frontend `npm test` | Passed — 14 files, 114 tests |
| Frontend `npm run lint` | Passed |
| Frontend `npm run build` | Passed — TypeScript check and Vite production build |
| Frontend `npm audit` | Reported 22 advisories — 9 high, 13 moderate; non-zero exit. Exact package versions and npm advisory IDs are listed under AG-01. |
| Frontend `npm audit --omit=dev` | Reported 9 advisories — 5 high, 4 moderate; non-zero exit. This includes build tooling declared as non-dev dependencies; it does not prove browser-runtime exposure. |
| PostgreSQL/Neon integration, production migration, production smoke test | Not run by design |
| CI workflow, backend lint/type checker, browser E2E | Not present/configured in this repository |

## Phase 1 conclusion (audit-time snapshot)

At Phase 1 completion, the targeted BUG-07 and BUG-08 audits and characterization tests were complete without application runtime changes. This document records findings from that audit baseline; subsequent approved fixes and current test status are recorded in [08-phase-2-implementation-report.md](./08-phase-2-implementation-report.md). No production data or services were changed.
