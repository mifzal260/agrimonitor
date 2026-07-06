export type Cost = {
  id: number;
  user_id: number;
  planting_record_id: number;
  cost_type: string;
  amount: string;
  cost_date: string;
  notes: string | null;
};

export type Harvest = {
  id: number;
  user_id: number;
  planting_record_id: number;
  harvest_date: string;
  quantity: string;
  unit: string;
  selling_price_per_unit: string;
  revenue: string;
  notes: string | null;
};

export type ProfitLossSummary = {
  total_cost: string;
  total_revenue: string;
  profit_loss: string;
};