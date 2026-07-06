# Langkah 05: Core Crop Monitoring

## Status

Phase 5 implements the first working crop monitoring flow.

## Added Backend

Protected endpoints under `/api/v1/monitoring`:

- `GET /crops`
- `GET /symptoms`
- `POST /planting-records`
- `GET /planting-records`
- `GET /planting-records/{record_id}`
- `PATCH /planting-records/{record_id}`
- `DELETE /planting-records/{record_id}`
- `POST /activities`
- `GET /activities`
- `PATCH /activities/{activity_id}`
- `DELETE /activities/{activity_id}`
- `POST /symptom-records`
- `GET /symptom-records`
- `PATCH /symptom-records/{symptom_record_id}`
- `DELETE /symptom-records/{symptom_record_id}`

## Added Frontend

- Monitoring workspace after login.
- Add planting record form.
- Add farm activity form.
- Add symptom record form.
- List crop plots with plant age and status badge.
- Recent activities and recent symptoms sections.

## Permission Rules

- User can access only their own planting records, activities, and symptom records.
- Crops and symptoms are readable as master data for forms.
- Backend enforces ownership checks.

## Notes

- Image upload is represented as optional `image_url` in this phase.
- Actual file upload/storage is not implemented yet to keep MVP scope controlled.

## Not Implemented Yet

- Rule-based recommendation.
- Alerts generated from disease rules.
- Market price module.
- Dashboard and charts.
- Cost/harvest profit-loss module.