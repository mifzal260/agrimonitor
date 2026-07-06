# Langkah 09: Cost, Harvest and Profit/Loss

## Status

Phase 9 implements cost records, harvest records, and profit/loss calculation.

## Added Backend

Protected endpoints under `/api/v1/finance`:

- `GET /finance/summary`
- `POST /finance/costs`
- `GET /finance/costs`
- `PATCH /finance/costs/{cost_id}`
- `DELETE /finance/costs/{cost_id}`
- `POST /finance/harvests`
- `GET /finance/harvests`
- `PATCH /finance/harvests/{harvest_id}`
- `DELETE /finance/harvests/{harvest_id}`

## Behavior

- User can access only their own costs and harvests.
- Cost must be linked to a planting record owned by the user.
- Harvest must be linked to a planting record owned by the user.
- Harvest revenue is calculated from `quantity * selling_price_per_unit`.
- Profit/loss is calculated from `total_revenue - total_cost`.

## Added Frontend

- Finance tab.
- Total cost card.
- Revenue card.
- Profit/loss card.
- Record cost form.
- Record harvest form.
- Recent costs and harvests lists.

## Not Implemented Yet

- Final cleanup.
- Runtime testing with real database.
- Render + Neon deployment notes finalization.