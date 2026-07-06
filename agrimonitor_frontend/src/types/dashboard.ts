export type StatusCount = {
  status: string;
  count: number;
};

export type PricePoint = {
  recorded_date: string;
  commodity_name: string;
  price: string;
};

export type DashboardSummary = {
  total_planting_records: number;
  crop_status: StatusCount[];
  high_risk_alerts: number;
  latest_market_prices: number;
  total_cost: string;
  total_revenue: string;
  profit_loss: string;
  price_trend: PricePoint[];
};