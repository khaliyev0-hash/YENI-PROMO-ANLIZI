export interface CampaignMetadata {
  id: string;
  insert_name: string;
  beg_date: string;
  end_date: string;
  created_at: string;
  item_count: number;
  is_active?: boolean;
  is_latest?: boolean;
}

export interface SourceStatus {
  configured: boolean;
  path: string;
  state: 'idle' | 'waiting_file_open' | 'processing' | 'ok' | 'error';
  last_success_at: string | null;
  last_error: string | null;
  rows: number;
  seconds: number;
  campaign_id: string | null;
  file_modified_at: string | null;
  progress_stage: string;
}

export interface AppSettings {
  achievement_critical: number;
  achievement_target: number;
  achievement_over: number;
  high_stock_threshold: number;
  low_stock_threshold: number;
  stockout_min_days: number;
  weight_achievement: number;
  weight_sell_through: number;
  weight_stockout: number;
  weight_bias: number;
  abc_a_percent: number;
  abc_b_percent: number;
  abc_c_percent: number;
  lost_sales_method: string;
  language: string;
}

export interface ColumnMapping {
  store_col: string;
  code_col: string;
  name_col?: string;
  insert_name_col?: string;
  start_date_col?: string;
  end_date_col?: string;
  fc_col: string;
  fc_mebleg_col?: string;
  distribution_col?: string;
  sale_col?: string;
  stock_col?: string;
  service_level_col?: string;
  ref_col?: string;
  promo_type_col?: string;
  category_col?: string;
  sub_category_col?: string;
  family_col?: string;
  area_col?: string;
  sub_area_col?: string;
  daily_stock_cols: string[];
}

export interface ServiceLevelColumnMapping {
  code_col: string;
  name_col?: string;
  store_col: string;
  order_qty_col: string;
  fulfilled_qty_col: string;
  service_level_pct_col?: string;
  supplier_col?: string;
}

export interface DataQualityWarning {
  type: string;
  severity: string;
  description: string;
  count: number;
  affected_rows?: number[];
}

export interface DataQualityReport {
  total_rows: number;
  total_stores: number;
  total_products: number;
  unique_store_code_count: number;
  missing_values_count: number;
  duplicate_rows_count: number;
  invalid_numeric_count: number;
  negative_fc_count: number;
  negative_sale_count: number;
  negative_stock_count: number;
  invalid_dates_count: number;
  duplicate_store_code_count: number;
  duplicate_stock_dates_count: number;
  warnings: DataQualityWarning[];
}

export interface KPICards {
  total_stores: number;
  total_products: number;
  total_forecast: number;
  total_forecast_azn?: number;
  total_sales: number;
  total_sales_azn?: number;
  achievement_pct?: number;
  total_stock: number;
  stockout_stores_count: number;
  stockout_products_count: number;
  stockout_rate_pct: number;
  availability_pct?: number;
  sell_through_pct?: number;
  wape_pct: number;
  mae: number;
  rmse: number;
  bias: number;
  promo_health_score: number;
  promo_health_status: string;
}

export interface ForecastAccuracyMetrics {
  wape: number;
  mae: number;
  rmse: number;
  bias: number;
  mape?: number;
  achievement_pct?: number;
  description_az: string;
  description_en: string;
}

export interface StorePerformance {
  store: string;
  area?: string;
  sub_area?: string;
  product_count: number;
  total_fc: number;
  total_fc_azn?: number;
  total_sale: number;
  achievement_pct?: number;
  total_stock: number;
  total_distribution_qty: number;
  stockout_count: number;
  stockout_pct: number;
  sell_through_pct?: number;
  under_forecast: number;
  over_forecast: number;
  health_score: number;
  health_status: string;
  rank: number;
}

export interface ProductPerformance {
  code: string;
  name: string;
  store_count: number;
  total_fc: number;
  total_fc_azn?: number;
  total_sale: number;
  achievement_pct?: number;
  total_stock: number;
  total_distribution_qty: number;
  sell_through_pct?: number;
  stockout_store_count: number;
  stockout_pct: number;
  under_forecast_stores: number;
  over_forecast_stores: number;
  estimated_lost_sales: number;
  estimated_lost_revenue: number;
  promo_type?: string;
  category?: string;
  sub_category?: string;
  family?: string;
  abc_class: string;
  xyz_class: string;
  health_score: number;
  health_status: string;
  recommendation: string;
}

export interface DailyStockSummary {
  date: string;
  opening_stock: number;
  closing_stock: number;
  depletion: number;
  stockout_count: number;
  active_products: number;
  at_risk_products: number;
}

export interface DailySalesRecord {
  day: number;
  date: string;
  daily_sale: number | null;
  daily_amount: number | null;
  daily_pct: number | null;
  daily_amount_pct: number | null;
  cumulative_pct: number | null;
  cumulative_amount_pct: number | null;
  ideal_pct: number | null;
  partial: boolean;
  is_future: boolean;
}

export interface AlertItem {
  id: string;
  severity: string;
  category: string;
  badge_color: string;
  store: string;
  product_code: string;
  product_name: string;
  metric: string;
  metric_value: string;
  reason: string;
  recommended_action: string;
}

export interface RecommendationItem {
  id: string;
  action_type: string;
  store: string;
  product_code: string;
  product_name: string;
  current_fc: number;
  current_sale: number;
  current_stock: number;
  suggested_fc_adj_pct: number;
  reason: string;
}

export interface CategoryPerformance {
  family: string;
  total_fc: number;
  total_fc_azn?: number;
  total_sale: number;
  achievement_pct?: number;
}

export interface ServiceLevelRecord {
  store: string;
  supplier: string;
  code: string;
  name: string;
  ordered_qty: number;
  accepted_qty: number;
  service_level_pct: number;
  status: string;
}

export interface AnalyticsResponse {
  kpi_cards: KPICards;
  accuracy_metrics: ForecastAccuracyMetrics;
  insights: string[];
  store_performances: StorePerformance[];
  product_performances: ProductPerformance[];
  category_performances: CategoryPerformance[];
  service_level_records: ServiceLevelRecord[];
  daily_summaries: DailyStockSummary[];
  daily_sales?: DailySalesRecord[] | null;
  alerts: AlertItem[];
  recommendations: RecommendationItem[];
  abc_summary: Record<string, any>;
  pareto_data: Record<string, any>;
  bias_summary: Record<string, any>;
  has_daily_time_series: boolean;
  stock_dates: string[];
  categories?: string[];
  areas?: string[];
  families?: string[];
  sub_areas?: string[];
}

export interface GlobalFilterState {
  searchQuery: string;
  selectedStore: string;
  selectedProduct: string;
  selectedCategory: string;
  selectedArea: string;
  selectedFamily?: string;
  selectedSubArea?: string;
  achievementStatus: string;
  stockStatus: string;
  abcClass: string;
  dateRange: string;
  promoType: string;
}

export interface PromoUpliftItem {
  code: string;
  name: string;
  category: string;
  sub_category: string;
  family: string;
  promo_type: string;
  store_count: number;
  fc: number;
  normal_14d_sale: number;
  daily_baseline: number;
  baseline_sale: number;
  promo_sale: number;
  last_day_sale: number;
  uplift_qty: number;
  uplift_pct: number;
  uplift_ratio: number | null;
  status: 'HIGH' | 'MODERATE' | 'LOW' | 'NEGATIVE' | 'NEW' | string;
  stock: number;
}

export interface PromoUpliftSummary {
  total_skus: number;
  total_normal_14d: number;
  total_baseline: number;
  total_promo_sale: number;
  total_last_day_sale: number;
  total_uplift_qty: number;
  overall_uplift_pct: number;
  overall_uplift_ratio: number | null;
  positive_uplift_count: number;
  negative_uplift_count: number;
  positive_uplift_share_pct: number;
}

export interface PromoUpliftResponse {
  beg_date: string;
  end_date: string;
  promo_days: number;
  pre_beg_date: string;
  pre_end_date: string;
  summary: PromoUpliftSummary;
  items: PromoUpliftItem[];
  categories: string[];
  families: string[];
}

