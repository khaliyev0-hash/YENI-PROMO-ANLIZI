from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any, Union

class AppSettings(BaseModel):
    achievement_critical: float = 70.0      # < 70% is critical
    achievement_target: float = 100.0       # >= 100% target
    achievement_over: float = 120.0         # >= 120% over-performing
    high_stock_threshold: float = 50.0     # Stock > 50 units with low sale is high stock
    low_stock_threshold: float = 5.0        # Stock < 5 units is approaching stockout
    stockout_min_days: int = 1              # Stock = 0 counts as stockout
    weight_achievement: float = 0.35        # Health score weights
    weight_sell_through: float = 0.25
    weight_stockout: float = 0.20
    weight_bias: float = 0.20
    abc_a_percent: float = 80.0
    abc_b_percent: float = 15.0
    abc_c_percent: float = 5.0
    lost_sales_method: str = "avg_daily_sales"  # "avg_daily_sales" or "depletion_rate"
    language: str = "AZ"                     # "AZ", "TR", "EN"

class ColumnMapping(BaseModel):
    code_col: str
    name_col: Optional[str] = None
    insert_name_col: Optional[str] = None
    start_date_col: Optional[str] = None
    end_date_col: Optional[str] = None
    fc_col: str
    fc_mebleg_col: Optional[str] = None
    distribution_col: Optional[str] = None
    store_col: Optional[str] = None
    sale_col: Optional[str] = None
    stock_col: Optional[str] = None
    service_level_col: Optional[str] = None
    ref_col: Optional[str] = None
    promo_type_col: Optional[str] = None
    category_col: Optional[str] = None
    sub_category_col: Optional[str] = None
    family_col: Optional[str] = None
    area_col: Optional[str] = None
    sub_area_col: Optional[str] = None
    daily_stock_cols: List[str] = []

class ServiceLevelColumnMapping(BaseModel):
    code_col: str
    name_col: Optional[str] = None
    store_col: str
    order_qty_col: str
    fulfilled_qty_col: str
    service_level_pct_col: Optional[str] = None
    supplier_col: Optional[str] = None

class DataQualityWarning(BaseModel):
    type: str                                # "MISSING", "DUPLICATE", "NEGATIVE", "INVALID_NUMERIC", "INVALID_DATE"
    severity: str                            # "HIGH", "MEDIUM", "LOW"
    description: str
    count: int
    affected_rows: List[int] = []

class DataQualityReport(BaseModel):
    total_rows: int
    total_stores: int
    total_products: int
    unique_store_code_count: int
    missing_values_count: int
    duplicate_rows_count: int
    invalid_numeric_count: int
    negative_fc_count: int
    negative_sale_count: int
    negative_stock_count: int
    invalid_dates_count: int
    duplicate_store_code_count: int
    duplicate_stock_dates_count: int
    warnings: List[DataQualityWarning] = []

class FactRecord(BaseModel):
    store: str
    code: str
    name: str
    fc: float
    fc_mebleg: float = 0.0
    sale: float
    final_stock: float
    ref: Optional[float] = None
    achievement_pct: Optional[float] = None
    error: float = 0.0
    abs_error: float = 0.0
    under_forecast: float = 0.0
    over_forecast: float = 0.0
    sell_through_pct: Optional[float] = None
    is_stockout: bool = False
    promo_type: Optional[str] = "adi"
    category: Optional[str] = None
    sub_category: Optional[str] = None
    area: Optional[str] = None
    sub_area: Optional[str] = None
    status: str = "HEALTHY"                  # UNDER_FORECAST, BELOW_TARGET, HEALTHY, OVER_PERFORMING, STOCKOUT_LIMITED

class TimelineRecord(BaseModel):
    store: str
    code: str
    stock_date: str
    stock_qty: float

class DailyStockSummary(BaseModel):
    date: str
    opening_stock: float
    closing_stock: float
    depletion: float
    stockout_count: int
    active_products: int
    at_risk_products: int

class KPICards(BaseModel):
    total_forecast: float
    total_forecast_azn: Optional[float] = 0.0
    total_sales: float
    achievement_pct: Optional[float]
    total_stock: float
    stockout_stores_count: int
    stockout_products_count: int
    stockout_rate_pct: float
    availability_pct: Optional[float] = None
    sell_through_pct: Optional[float]
    under_forecast_stores_count: int
    over_forecast_stores_count: int
    promo_health_score: float                # 0 - 100
    promo_health_status: str                # Critical, Weak, Good, Excellent

class ForecastAccuracyMetrics(BaseModel):
    wape: float
    mae: float
    rmse: float
    bias: float
    mape: Optional[float]
    achievement_pct: Optional[float]
    description_az: str
    description_en: str

class StorePerformance(BaseModel):
    store: str
    area: Optional[str] = None
    sub_area: Optional[str] = None
    product_count: int
    total_fc: float
    total_fc_azn: Optional[float] = 0.0
    total_sale: float
    achievement_pct: Optional[float]
    total_stock: float
    total_distribution_qty: float = 0.0
    stockout_count: int
    stockout_pct: float
    sell_through_pct: Optional[float]
    under_forecast: float
    over_forecast: float
    health_score: float
    health_status: str
    rank: int

class ProductPerformance(BaseModel):
    code: str
    name: str
    store_count: int
    total_fc: float
    total_fc_azn: Optional[float] = 0.0
    total_sale: float
    achievement_pct: Optional[float]
    total_stock: float
    total_distribution_qty: float = 0.0
    sell_through_pct: Optional[float]
    stockout_store_count: int
    stockout_pct: float
    under_forecast_stores: int
    over_forecast_stores: int
    estimated_lost_sales: float
    estimated_lost_revenue: float
    promo_type: Optional[str] = "adi"
    category: Optional[str] = None
    sub_category: Optional[str] = None
    family: Optional[str] = None
    abc_class: str                           # "A", "B", "C"
    xyz_class: str                           # "X", "Y", "Z", "N/A"
    health_score: float
    health_status: str
    recommendation: str

class AlertItem(BaseModel):
    id: str
    severity: str                            # "CRITICAL", "HIGH", "MEDIUM", "INFO"
    category: str                            # "STOCKOUT", "HIGH_STOCK", "LOW_ACHIEVEMENT", "OVER_FORECAST", "HIGH_ERROR"
    badge_color: str                         # "RED", "ORANGE", "YELLOW", "BLUE", "PURPLE"
    store: str
    product_code: str
    product_name: str
    metric: str
    metric_value: str
    reason: str
    recommended_action: str

class RecommendationItem(BaseModel):
    id: str
    action_type: str                         # "INCREASE_FORECAST", "DECREASE_FORECAST", "INVESTIGATE_STOCKOUT", "INVESTIGATE_EXCESS", "MAINTAIN"
    store: str
    product_code: str
    product_name: str
    current_fc: float
    current_sale: float
    current_stock: float
    suggested_fc_adj_pct: float
    reason: str

class MatrixCell(BaseModel):
    store: str
    code: str
    value: float
    status: str

class ProductStoreMatrix(BaseModel):
    stores: List[str]
    products: List[Dict[str, str]]           # [{"code": "...", "name": "..."}]
    metric: str                              # "forecast", "sales", "achievement", "stock", "stockout"
    cells: List[Dict[str, Any]]

class RiskMatrixQuadrant(BaseModel):
    quadrant_name: str
    label_az: str
    description: str
    count: int
    items: List[Dict[str, Any]]

class CategoryPerformance(BaseModel):
    family: str
    total_fc: float
    total_sale: float
    achievement_pct: Optional[float] = None

class ServiceLevelRecord(BaseModel):
    store: str
    supplier: str
    code: str
    name: str
    ordered_qty: float
    accepted_qty: float
    service_level_pct: float
    status: str                              # "EXCELLENT", "GOOD", "WEAK", "CRITICAL"

class DailySalesRecord(BaseModel):
    day: int
    date: str
    daily_sale: Optional[float] = None
    daily_amount: Optional[float] = None
    daily_pct: Optional[float] = None
    daily_amount_pct: Optional[float] = None
    cumulative_pct: Optional[float] = None
    cumulative_amount_pct: Optional[float] = None
    ideal_pct: Optional[float] = None
    partial: bool = False
    is_future: bool = False

class AnalyticsResponse(BaseModel):
    kpi_cards: KPICards
    accuracy_metrics: ForecastAccuracyMetrics
    insights: List[str]
    store_performances: List[StorePerformance]
    product_performances: List[ProductPerformance]
    category_performances: List[CategoryPerformance] = []
    service_level_records: List[ServiceLevelRecord] = []
    daily_summaries: List[DailyStockSummary]
    daily_sales: Optional[List[DailySalesRecord]] = None
    alerts: List[AlertItem]
    recommendations: List[RecommendationItem]
    abc_summary: Dict[str, Any]
    pareto_data: Dict[str, Any]
    bias_summary: Dict[str, Any]
    has_daily_time_series: bool
    stock_dates: List[str]
    categories: List[str] = []
    areas: List[str] = []
