# AgriMonitor Phase 2 Implementation Report

**Date:** 2026-11-15
**Branch:** `feat/phase-2-session-finance-crop-fixes`
**Scope:** Approved fixes BUG-07, AG-02, and AG-09 only. No deployment, database migration, infrastructure change, or dependency update was performed.

## Summary

All three approved fixes are implemented and covered by regression tests. BUG-08 hourly aggregation remains unimplemented; its strict-xfail regression test is retained. The complete backend and frontend quality gates passed.

## Files changed

### Approved Phase 2 fixes

- `agrimonitor_backend/app/schemas/finance.py`
- `agrimonitor_backend/tests/test_finance_patch_validation.py`
- `agrimonitor_frontend/src/App.tsx`
- `agrimonitor_frontend/src/__tests__/App.routing.test.tsx`
- `agrimonitor_frontend/src/i18n/locales/en.json`
- `agrimonitor_frontend/src/i18n/locales/ms.json`
- `agrimonitor_frontend/src/i18n/__tests__/cropHelper.test.ts`

### Audit evidence retained from targeted Phase 1 work

- `agrimonitor_backend/tests/test_iot_monitoring.py` — characterization test plus strict-xfail expected hourly grouping test; BUG-08 behavior was not changed.
- `docs/engineering/01-repository-audit.md` — updated to distinguish audit-baseline findings from fixes now present on this branch.
- `docs/engineering/08-phase-2-implementation-report.md` — this report.

## BUG-07 — Finance PATCH validation

**Root cause:** `CostUpdate` and `HarvestUpdate` declared required database columns as nullable optional fields. `exclude_unset=True` correctly preserved omitted fields, but an explicitly supplied `null` passed schema validation and reached persistence or revenue calculation, resulting in HTTP 500.

**Implementation:** Added before-validation field validators for the seven required update fields. Explicit `null` now fails request validation with HTTP 422 and field-location details. Fields retain `None` defaults so omitted fields remain valid PATCH omissions. `notes` remains nullable. No database schema, service calculation, or financial formula changed.

**Before:** Explicit null for any of the seven required fields returned HTTP 500.

**After:** Explicit null returns HTTP 422. Tests then perform a valid PATCH and confirm the record remains usable and the required value was not overwritten. Separate tests verify omitted fields remain unchanged and `notes: null` succeeds for both resource types.

## AG-02 — Session restoration

**Root cause:** The `getMe()` rejection handler cleared tokens for every failure, including forbidden responses, server errors, network failures, and abort/timeout errors.

**Implementation:** Session restoration now classifies `ApiError` status:

- Final 401: clear credentials and proceed to login. The API client still owns the refresh lifecycle and only attempts one refresh/retry; its existing unauthorized-event guard prevents repeated expiry handling.
- 403: retain credentials and show an authorization error.
- 5xx, network rejection, or timeout/abort: retain credentials and show a recoverable error with a Retry action.
- Successful restoration after token refresh: retain the rotated tokens and authenticated session.

Retry is user-initiated, not automatic. Stale effect results are ignored on cleanup, avoiding state changes from an earlier request.

**Before:** Every rejected session check cleared both credentials.

**After:** Only an unrecoverable 401 clears credentials. Other failures preserve the session and follow the behaviors above.

## AG-09 — Custom crop helper text

**Root cause:** Malay and English helper text still claimed a custom crop was inserted into the shared catalog, despite per-record storage behavior.

**Implementation:** Both locales now explain that the crop name is saved only on the current planting record and is not added to the shared catalog. A localization regression test checks both messages. Application data flow was not changed.

## Test evidence

| Check | Result |
|---|---|
| Backend targeted `pytest tests\test_finance_patch_validation.py -q` | Passed — 9 tests |
| Backend full `pytest -q -rx` | Passed — 191 passed, 1 strict xfailed |
| Remaining xfail | BUG-08 hourly grouping only; implementation was explicitly deferred |
| Backend `pip check` | Passed — no broken requirements |
| Frontend targeted session/API/localization tests | Passed in focused runs; 31 tests in the three-file run, followed by 31 session/API tests after the final session cases were added |
| Frontend `npm test` | Passed — 15 files, 121 tests |
| Frontend `npm run lint` | Passed |
| Frontend `npm run build` | Passed — TypeScript check and Vite production build |
| BUG-07 transaction integrity | Verified by successful valid PATCH and preserved non-null field after each rejected null PATCH |
| Production DB, migration, deployment, Render/Neon/Redis checks | Not run; production systems were not accessed |
| `pip-audit` / `npm audit` | Not rerun; dependency changes were explicitly deferred |
| PostgreSQL integration and browser E2E | Not run; no configured checks for these were invoked |

Vitest printed the expected React error-boundary stack trace from its test fixture while the suite still passed; no test failed.

## Git and review status

Work is isolated on `feat/phase-2-session-finance-crop-fixes`, with logically grouped commits:

- `7688c01` — audit and BUG-08 hourly characterization evidence
- `7b48761` — BUG-07 finance PATCH validation fix
- `6524441` — AG-02 session restoration fix
- `d824e0d` — AG-09 localization fix

This report is included in the Phase 2 branch. No push or deployment has been performed.

## Regression risks

- Clients sending `null` to mean “leave the field unchanged” will now receive HTTP 422; they should omit that field. Nullable `notes` remains supported.
- A persistent 403 now displays an authorization message instead of silently logging out. It intentionally does not clear credentials.
- Transient session failures keep the user on the requested protected route and require a user-initiated retry. The API client still handles a single refresh attempt for a 401 and does not retry indefinitely.
- Localization changes only correct helper text; crop storage behavior is unchanged.

## Remaining unresolved findings

- **BUG-08:** `interval=hourly` is still ignored. Its strict-xfail test remains. Mean-versus-latest aggregation, bucket timestamp/time zone, missing-hour behavior, and `limit` semantics need approval before implementation.
- **AG-06:** Finance/dashboard formula discrepancy remains unresolved; no formula was changed.
- **AG-01:** Dependency advisories remain; no dependencies were upgraded.
- **AG-03:** CSV upload size is still checked after reading the upload.
- **AG-04 / AG-05 / AG-07:** Production rate-limit configuration, legacy-token use, and API URL configuration remain unverified.
- **AG-08:** Raw IP logging/retention remains unchanged.
- Phase 1 also records the documented manual migration process and lack of PostgreSQL integration, browser E2E, and CI assurance; these were not part of this approved change.

## Owner approval and handoff

No additional approval is required to review the three completed fixes. Approval is still required before implementing BUG-08 aggregation or making any deferred change listed above. In particular, BUG-08 must not be implemented until its API semantics are decided. AG-06 financial formulas remain blocked on the business rule. The shared `IOT-DEMO-001` simulator behavior is retained.

**Status:** Implementation and required local quality gates complete. Stop for code review; do not begin another phase or deploy.
