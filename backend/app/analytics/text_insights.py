import pandas as pd
from typing import List, Dict, Any
from app.schemas import AppSettings

def generate_automatic_text_insights(fact_df: pd.DataFrame, accuracy_metrics: Any, settings: AppSettings, lang: str = "az") -> List[str]:
    """Generates natural language business text insights in Azerbaijani or English based strictly on real calculations."""
    insights: List[str] = []
    if fact_df.empty:
        return ["No sufficient data available for analysis."] if lang == "en" else ["Təhlil üçün kifayət qədər məlumat yoxdur."]

    total_fc = float(fact_df['FC'].sum())
    total_sale = float(fact_df['SALE'].sum())
    total_stock = float(fact_df['FINAL_STOCK'].sum())
    total_combos = len(fact_df)
    
    # 1. Overall Campaign Performance Insight
    overall_ach = round((total_sale / total_fc) * 100.0, 1) if total_fc > 0 else 0.0
    if lang == "en":
        insights.append(f"Overall promotional campaign forecast achievement rate is {overall_ach}% (Total Forecast: {int(total_fc):,} units, Actual Sales: {int(total_sale):,} units).")
    else:
        insights.append(f"Ümumi aksiya üzrə proqnoz reallaşması {overall_ach}% təşkil etmişdir (Toplam Proqnoz: {int(total_fc)} unit, Real Satış: {int(total_sale)} unit).")

    # 2. Low Achievement Products Count
    prod_fc = fact_df.groupby('CODE')['FC'].sum()
    prod_sale = fact_df.groupby('CODE')['SALE'].sum()
    valid_prod_fc = prod_fc > 0
    if valid_prod_fc.any():
        prod_ach = (prod_sale[valid_prod_fc] / prod_fc[valid_prod_fc]) * 100.0
        low_ach_prods = int((prod_ach < settings.achievement_critical).sum())
    else:
        low_ach_prods = 0
    if low_ach_prods > 0:
        if lang == "en":
            insights.append(f"{low_ach_prods} products (SKUs) performed below the critical forecast achievement target of {int(settings.achievement_critical)}%.")
        else:
            insights.append(f"{low_ach_prods} məhsul üzrə proqnoz reallaşması hədəf {int(settings.achievement_critical)}%-dən aşağı olmuşdur.")

    # 3. Stockout Stores and Top Stockout Product
    stockout_mask = fact_df['FINAL_STOCK'] <= 0.0001
    stockout_df = fact_df[stockout_mask]
    
    if not stockout_df.empty:
        stockout_store_cnt = stockout_df['STORE'].nunique()
        top_stockout_prod = stockout_df.groupby(['CODE', 'NAME'])['STORE'].nunique().sort_values(ascending=False).head(1)
        if not top_stockout_prod.empty:
            p_code = top_stockout_prod.index[0][0]
            p_name = top_stockout_prod.index[0][1]
            p_cnt = top_stockout_prod.iloc[0]
            if lang == "en":
                insights.append(f"{p_name} ({p_code}) incurred stockouts across {p_cnt} stores, constraining overall sales velocity.")
            else:
                insights.append(f"{p_name} ({p_code}) məhsulu {p_cnt} mağazada stokout olmuş və satışı stoka görə məhdudlaşmışdır.")
        
        if lang == "en":
            insights.append(f"A total of {stockout_store_cnt} stores experienced at least one stockout event during the promotional campaign.")
        else:
            insights.append(f"Ümumilikdə {stockout_store_cnt} mağazada aksiya ərzində azı bir məhsul üzrə stokout halı yaşanmışdır.")

    # 4. Best Performing Store
    store_perf = fact_df.groupby('STORE').agg({'FC': 'sum', 'SALE': 'sum'})
    valid_stores = store_perf[store_perf['FC'] > 0].copy()
    if not valid_stores.empty:
        valid_stores['ach'] = (valid_stores['SALE'] / valid_stores['FC']) * 100.0
        best_store = valid_stores.sort_values('ach', ascending=False).head(1)
        if not best_store.empty:
            b_st = best_store.index[0]
            b_ach = round(float(best_store['ach'].iloc[0]), 1)
            if lang == "en":
                insights.append(f"Store {b_st} achieved the highest forecast achievement rate at {b_ach}%.")
            else:
                insights.append(f"Mağaza {b_st} ən yüksək proqnoz reallaşması göstəricisinə ({b_ach}%) nail olmuşdur.")

    # 5. Systematic Over-forecast
    over_fc_prods = (fact_df.groupby('CODE')['FC'].sum() > fact_df.groupby('CODE')['SALE'].sum() * 1.3).sum()
    if over_fc_prods > 0:
        if lang == "en":
            insights.append(f"{over_fc_prods} products were systematically over-forecasted (>30% above actual customer demand).")
        else:
            insights.append(f"{over_fc_prods} məhsul üzrə proqnoz sistematik olaraq aşırı (real tələbdən >30% çox) verilmişdir.")

    # 6. WAPE Quality Insight
    if hasattr(accuracy_metrics, 'wape'):
        wape = accuracy_metrics.wape
        if wape < 15.0:
            if lang == "en":
                insights.append(f"Forecast accuracy (WAPE: {wape}%) is at an excellent level.")
            else:
                insights.append(f"Proqnoz dəqiqliyi (WAPE: {wape}%) yüksək səviyyədədir.")
        elif wape < 30.0:
            if lang == "en":
                insights.append(f"Forecast accuracy (WAPE: {wape}%) is moderate; baseline optimization is recommended.")
            else:
                insights.append(f"Proqnoz dəqiqliyi (WAPE: {wape}%) orta səviyyədədir, optimallaşdırma ehtiyacı var.")
        else:
            if lang == "en":
                insights.append(f"Forecast accuracy (WAPE: {wape}%) is critically low. A review of baseline forecasting parameters is recommended.")
            else:
                insights.append(f"Proqnoz dəqiqliyi (WAPE: {wape}%) kritik zəifdir. Proqnozlaşdırma modelinin nəzərdən keçirilməsi tövsiyə edilir.")

    return insights
