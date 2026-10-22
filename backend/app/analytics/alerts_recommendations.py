import pandas as pd
import numpy as np
from typing import List, Tuple
from app.schemas import AlertItem, RecommendationItem, AppSettings

def generate_alerts_and_recommendations(fact_df: pd.DataFrame, settings: AppSettings) -> Tuple[List[AlertItem], List[RecommendationItem]]:
    """Generates structured alerts and forecast recommendations (optimized with early break)."""
    alerts: List[AlertItem] = []
    recommendations: List[RecommendationItem] = []

    if fact_df.empty:
        return alerts, recommendations

    alert_idx = 1
    rec_idx = 1

    # Use to_dict('records') which is ~10x faster than iterrows(), and break once 50 items reached
    records = fact_df.to_dict(orient='records')

    for row in records:
        if len(alerts) >= 50 and len(recommendations) >= 50:
            break

        st = str(row.get('STORE', ''))
        cd = str(row.get('CODE', ''))
        nm = str(row.get('NAME', ''))
        fc = float(row.get('FC', 0.0))
        sale = float(row.get('SALE', 0.0))
        stock = float(row.get('FINAL_STOCK', 0.0))
        ach = (sale / fc * 100.0) if fc > 0 else 0.0

        # 1. STOCKOUT Alert
        if stock <= 0.0001:
            if len(alerts) < 50:
                alerts.append(AlertItem(
                    id=f"ALT-{alert_idx}",
                    severity="CRITICAL",
                    category="STOCKOUT",
                    badge_color="RED",
                    store=st,
                    product_code=cd,
                    product_name=nm,
                    metric="Stok Qalığı",
                    metric_value="0 unit",
                    reason=f"Məhsul {st} mağazasında tam stokout olub.",
                    recommended_action="Təcili stok təminatı edin və ya gələcək proqnozu artırın."
                ))
                alert_idx += 1
            
            if fc > sale and len(recommendations) < 50:
                recommendations.append(RecommendationItem(
                    id=f"REC-{rec_idx}",
                    action_type="INCREASE_FORECAST",
                    store=st,
                    product_code=cd,
                    product_name=nm,
                    current_fc=fc,
                    current_sale=sale,
                    current_stock=stock,
                    suggested_fc_adj_pct=25.0,
                    reason="Stok bitdiyi üçün potensial satış itkisi baş verib. Gələcək proqnozu 25% artırmaq tövsiyə olunur."
                ))
                rec_idx += 1

        # 2. EXCESS STOCK Alert
        elif stock >= settings.high_stock_threshold and ach < settings.achievement_critical:
            if len(alerts) < 50:
                alerts.append(AlertItem(
                    id=f"ALT-{alert_idx}",
                    severity="HIGH",
                    category="HIGH_STOCK",
                    badge_color="ORANGE",
                    store=st,
                    product_code=cd,
                    product_name=nm,
                    metric="Aşağı Reallaşma & Yüksək Stok",
                    metric_value=f"Reallaşma: {round(ach,1)}%, Qalıq: {int(stock)} unit",
                    reason="Proqnoz reallaşması kritik dərəcədə aşağıdır və anbardı/mağazada böyük stok qalıb.",
                    recommended_action="Endirim və ya çarpaz aksiya ilə stoku eritmək tövsiyə edilir."
                ))
                alert_idx += 1
            
            if len(recommendations) < 50:
                recommendations.append(RecommendationItem(
                    id=f"REC-{rec_idx}",
                    action_type="DECREASE_FORECAST",
                    store=st,
                    product_code=cd,
                    product_name=nm,
                    current_fc=fc,
                    current_sale=sale,
                    current_stock=stock,
                    suggested_fc_adj_pct=-30.0,
                    reason="Tələb zəifdir və stok artıqlığı var. Gələcək proqnozu 30% azaldın."
                ))
                rec_idx += 1

        # 3. LOW ACHIEVEMENT Alert
        elif ach < settings.achievement_critical and fc > 0:
            if len(alerts) < 50:
                alerts.append(AlertItem(
                    id=f"ALT-{alert_idx}",
                    severity="MEDIUM",
                    category="LOW_ACHIEVEMENT",
                    badge_color="YELLOW",
                    store=st,
                    product_code=cd,
                    product_name=nm,
                    metric="Reallaşma Faizi",
                    metric_value=f"{round(ach,1)}%",
                    reason=f"Satış proqnozun {round(ach,1)}%-ni təşkil edib (hədəf {int(settings.achievement_critical)}%).",
                    recommended_action="Promosiya şərtlərini və vitrin düzülüşünü araşdırın."
                ))
                alert_idx += 1

        # 4. OVER PERFORMING / HIGH DEMAND Recommendation
        elif ach >= settings.achievement_over:
            if len(recommendations) < 50:
                recommendations.append(RecommendationItem(
                    id=f"REC-{rec_idx}",
                    action_type="INCREASE_FORECAST",
                    store=st,
                    product_code=cd,
                    product_name=nm,
                    current_fc=fc,
                    current_sale=sale,
                    current_stock=stock,
                    suggested_fc_adj_pct=20.0,
                    reason=f"Satış proqnozu {round(ach,1)}% üstələyib. Növbəti proqnozu 20% artırın."
                ))
                rec_idx += 1

    return alerts[:50], recommendations[:50]
