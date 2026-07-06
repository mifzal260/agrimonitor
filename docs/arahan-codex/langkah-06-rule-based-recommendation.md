# Langkah 06: Rule-Based Recommendation

## Status

Phase 6 implements rule-based recommendation using seeded disease rules. This is not AI diagnosis.

## Added Backend

Protected endpoints under `/api/v1/recommendations`:

- `POST /planting-records/{planting_record_id}/evaluate`
- `GET /alerts`

## Behavior

- Reads symptom records for a user's planting record.
- Matches observed symptoms against `disease_rules` and `disease_rule_symptoms`.
- Returns matched disease/risk rules and early recommendations.
- Updates planting status to `watch` for medium risk and `risk` for high risk.
- Creates high-risk alerts without duplicating the same alert message.

## Added Frontend

- Evaluate risk button on each planting record card.
- Recommendation result panel.
- Risk badge for highest risk.
- High-risk alerts panel.

## Not Implemented Yet

- Market price module.
- CSV import.
- Dashboard and charts.
- Cost/harvest profit-loss module.