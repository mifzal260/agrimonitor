# Langkah 08: Dashboard and Charts

## Status

Phase 8 implements dashboard summary and a Recharts market price graph.

## Added Backend

Protected endpoint:

- `GET /api/v1/dashboard/summary`

Summary includes:

- Total planting records.
- Crop status counts.
- High-risk unread alerts.
- Latest market price group count.
- Total cost.
- Total revenue.
- Profit/loss.
- Market price trend points for charting.

## Added Frontend

- Dashboard tab.
- Summary cards.
- Crop status panel.
- Cost/revenue/profit-loss summary display.
- Recharts line chart for market price trend.

## Notes

- Cost, harvest, and profit/loss are displayed from existing `costs` and `harvests` tables.
- Full cost/harvest recording UI and endpoints are reserved for Phase 9.

## Not Implemented Yet

- Cost CRUD.
- Harvest CRUD.
- Full profit/loss workflow.
- Final cleanup and deployment notes.