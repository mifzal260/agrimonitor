# Langkah 07: Market Price Module

## Status

Phase 7 implements the market price module using seed/demo data and manual CSV import. No external market API is used.

## Added Backend

Protected endpoints under `/api/v1/market-prices`:

- `GET /market-prices`
- `GET /market-prices/latest`
- `POST /market-prices` admin only
- `PATCH /market-prices/{price_id}` admin only
- `DELETE /market-prices/{price_id}` admin only
- `POST /market-prices/import-csv` admin only

## Filters

- `commodity_name`
- `location`
- `price_type`
- `date_from`
- `date_to`

## CSV Import

Required columns:

- `commodity_name`
- `location`
- `price_type`
- `price`
- `unit`
- `recorded_date`

Optional column:

- `trend`

## Added Frontend

- Market Prices tab.
- Latest price cards.
- Filter form.
- Admin-only add price form.
- Admin-only CSV upload form.
- Trend badges.

## Not Implemented Yet

- Recharts price graph.
- Dashboard summary.
- Cost/harvest profit-loss module.