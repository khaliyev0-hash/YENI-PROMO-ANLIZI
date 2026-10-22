import logging
import pandas as pd
import numpy as np
from datetime import datetime
from typing import Tuple, List, Dict, Optional, Any
from app.schemas import ColumnMapping, ServiceLevelColumnMapping, FactRecord, TimelineRecord
from app.parser import parse_date_string
from app.db import normalize_store_code, normalize_item_code

logger = logging.getLogger(__name__)

def merge_excel_with_db(
    excel_df: pd.DataFrame, 
    mapping: ColumnMapping, 
    db_df: pd.DataFrame
) -> pd.DataFrame:
    """
    TASK 3: Merges uploaded Excel DataFrame (Template 1) with DB sales & stock records.
    Directly joins each (STORE, CODE) row in Excel with (store_code, item_code) in DB using vectorized pd.merge.
    """
    store_col = mapping.store_col if (mapping.store_col and mapping.store_col in excel_df.columns) else None
    code_col = mapping.code_col if (mapping.code_col and mapping.code_col in excel_df.columns) else None
    name_col = mapping.name_col if (mapping.name_col and mapping.name_col in excel_df.columns) else None
    fc_col = mapping.fc_col if (mapping.fc_col and mapping.fc_col in excel_df.columns) else None
    fc_mebleg_col = mapping.fc_mebleg_col if (mapping.fc_mebleg_col and mapping.fc_mebleg_col in excel_df.columns) else None
    dist_col = mapping.distribution_col if (mapping.distribution_col and mapping.distribution_col in excel_df.columns) else None
    ref_col = mapping.ref_col if (mapping.ref_col and mapping.ref_col in excel_df.columns) else None
    category_col = mapping.category_col if (mapping.category_col and mapping.category_col in excel_df.columns) else None
    sub_category_col = mapping.sub_category_col if (mapping.sub_category_col and mapping.sub_category_col in excel_df.columns) else None
    family_col = mapping.family_col if (mapping.family_col and mapping.family_col in excel_df.columns) else None
    area_col = mapping.area_col if (mapping.area_col and mapping.area_col in excel_df.columns) else None
    sub_area_col = mapping.sub_area_col if (mapping.sub_area_col and mapping.sub_area_col in excel_df.columns) else None

    raw_code = excel_df[code_col].astype(str).str.strip() if code_col else pd.Series([""] * len(excel_df))
    norm_code = raw_code.map(lambda c: normalize_item_code(c) or c)
    
    raw_store = excel_df[store_col].astype(str).str.strip() if store_col else pd.Series([f"MAG_{i+1}" for i in range(len(excel_df))])
    norm_store = raw_store.map(lambda s: normalize_store_code(s) or s)

    excel_temp = excel_df.copy()
    excel_temp['_norm_store'] = norm_store
    excel_temp['_norm_code'] = norm_code
    excel_temp['_raw_store'] = raw_store
    excel_temp['_raw_code'] = raw_code

    if db_df is not None and not db_df.empty:
        db_df_sorted = db_df.sort_values('sale_date') if 'sale_date' in db_df.columns else db_df
        db_agg_dict = {'sales_qty': 'sum', 'current_stock': 'last'}
        if 'supplier_name' in db_df.columns:
            db_agg_dict['supplier_name'] = 'first'
        
        db_agg = db_df_sorted.groupby(['store_code', 'item_code'], as_index=False).agg(db_agg_dict)
        db_agg['_norm_store'] = db_agg['store_code'].astype(str).map(lambda s: normalize_store_code(s) or s)
        db_agg['_norm_code'] = db_agg['item_code'].astype(str).map(lambda c: normalize_item_code(c) or c)
        db_agg = db_agg.drop_duplicates(subset=['_norm_store', '_norm_code'])
    else:
        db_agg = pd.DataFrame(columns=['_norm_store', '_norm_code', 'sales_qty', 'current_stock', 'supplier_name'])

    merged = pd.merge(excel_temp, db_agg, on=['_norm_store', '_norm_code'], how='left')

    name_series = merged[name_col].astype(str).str.strip() if name_col else merged['_raw_code']
    fc_series = pd.to_numeric(merged[fc_col], errors='coerce').fillna(0.0).clip(lower=0.0) if fc_col else pd.Series(0.0, index=merged.index)
    fc_mebleg_series = pd.to_numeric(merged[fc_mebleg_col], errors='coerce').fillna(0.0).clip(lower=0.0) if fc_mebleg_col else pd.Series(0.0, index=merged.index)
    
    sale_series = merged['sales_qty'].fillna(0.0) if 'sales_qty' in merged.columns else pd.Series(0.0, index=merged.index)
    stock_series = merged['current_stock'].fillna(0.0) if 'current_stock' in merged.columns else pd.Series(0.0, index=merged.index)
    supplier_series = merged['supplier_name'] if 'supplier_name' in merged.columns else pd.Series(None, index=merged.index)
    ref_series = pd.to_numeric(merged[ref_col], errors='coerce') if (ref_col and ref_col in merged.columns) else pd.Series(None, index=merged.index)

    if dist_col and dist_col in merged.columns:
        dist_series = pd.to_numeric(merged[dist_col], errors='coerce')
        dist_series = dist_series.fillna(sale_series + stock_series)
    else:
        dist_series = sale_series + stock_series

    promo_type_col = mapping.promo_type_col
    if promo_type_col and promo_type_col in merged.columns:
        raw_pt = merged[promo_type_col].astype(str).str.strip().str.lower()
        promo_type_series = raw_pt.apply(lambda v: "tesir" if any(k in v for k in ["tesir", "teshir", "təsir", "teşhir"]) else ("adi" if "adi" in v else v))
    elif 'Tesir/adi' in merged.columns:
        raw_pt = merged['Tesir/adi'].astype(str).str.strip().str.lower()
        promo_type_series = raw_pt.apply(lambda v: "tesir" if any(k in v for k in ["tesir", "teshir", "təsir", "teşhir"]) else ("adi" if "adi" in v else v))
    else:
        promo_type_series = pd.Series("adi", index=merged.index)

    category_series = merged[category_col].astype(str).str.strip() if category_col else pd.Series([None] * len(merged), index=merged.index)
    category_series = category_series.replace({"": None, "nan": None, "None": None, "null": None})

    sub_category_series = merged[sub_category_col].astype(str).str.strip() if sub_category_col else pd.Series([None] * len(merged), index=merged.index)
    sub_category_series = sub_category_series.replace({"": None, "nan": None, "None": None, "null": None})

    family_series = merged[family_col].astype(str).str.strip() if family_col else pd.Series([None] * len(merged), index=merged.index)
    family_series = family_series.replace({"": None, "nan": None, "None": None, "null": None})

    area_series = merged[area_col].astype(str).str.strip() if area_col else pd.Series([None] * len(merged), index=merged.index)
    area_series = area_series.replace({"": None, "nan": None, "None": None, "null": None})

    sub_area_series = merged[sub_area_col].astype(str).str.strip() if sub_area_col else pd.Series([None] * len(merged), index=merged.index)
    sub_area_series = sub_area_series.replace({"": None, "nan": None, "None": None, "null": None})

    final_df = pd.DataFrame({
        'STORE': merged['_raw_store'],
        'CODE': merged['_raw_code'],
        'NAME': name_series,
        'FC': fc_series,
        'FC_MEBLEG': fc_mebleg_series,
        'SALE': sale_series,
        'FINAL_STOCK': stock_series,
        'DISTRIBUTION_QTY': dist_series,
        'SUPPLIER': supplier_series,
        'REF': ref_series,
        'PROMO_TYPE': promo_type_series,
        'CATEGORY': category_series,
        'SUB_CATEGORY': sub_category_series,
        'FAMILY': family_series,
        'AREA': area_series,
        'SUB_AREA': sub_area_series
    })

    final_df = final_df[final_df['CODE'] != ""].reset_index(drop=True)
    return final_df

def parse_service_level_excel(excel_df: pd.DataFrame, mapping: ServiceLevelColumnMapping) -> List[Dict[str, Any]]:
    """
    TASK 2.1: Parses TEMPLATE 2 (Service Level Upload).
    Sütunlar: Mehsul_kodu | Mehsul_adi | Magaza | Sifariş miqdarı | Qarşılanan miqdar | Təminat % | Firma
    """
    records = []
    for idx, row in excel_df.iterrows():
        code_val = str(row[mapping.code_col]).strip() if mapping.code_col in excel_df.columns else ""
        store_val = str(row[mapping.store_col]).strip() if mapping.store_col in excel_df.columns else ""
        name_val = str(row[mapping.name_col]).strip() if (mapping.name_col and mapping.name_col in excel_df.columns) else code_val

        ordered_qty = float(pd.to_numeric(row[mapping.order_qty_col], errors='coerce') or 0.0) if mapping.order_qty_col in excel_df.columns else 0.0
        accepted_qty = float(pd.to_numeric(row[mapping.fulfilled_qty_col], errors='coerce') or 0.0) if mapping.fulfilled_qty_col in excel_df.columns else 0.0

        if mapping.service_level_pct_col and mapping.service_level_pct_col in excel_df.columns and pd.notnull(row[mapping.service_level_pct_col]):
            sl_raw = float(pd.to_numeric(row[mapping.service_level_pct_col], errors='coerce') or 0.0)
            sl_pct = round(sl_raw * 100.0, 1) if sl_raw <= 1.0 else round(sl_raw, 1)
            sl_pct = min(sl_pct, 100.0)
        else:
            sl_pct = round((accepted_qty / ordered_qty) * 100.0, 1) if ordered_qty > 0 else 0.0

        supplier_val = str(row[mapping.supplier_col]).strip() if (mapping.supplier_col and mapping.supplier_col in excel_df.columns and pd.notnull(row[mapping.supplier_col])) else "Bilinməyən Firma"

        if sl_pct >= 95.0:
            status = "EXCELLENT"
        elif sl_pct >= 90.0:
            status = "GOOD"
        elif sl_pct >= 75.0:
            status = "WEAK"
        else:
            status = "CRITICAL"

        records.append({
            "store": store_val,
            "supplier": supplier_val,
            "code": code_val,
            "name": name_val,
            "ordered_qty": ordered_qty,
            "accepted_qty": accepted_qty,
            "service_level_pct": sl_pct,
            "status": status
        })
    return records

def normalize_excel_data(
    df: pd.DataFrame, 
    mapping: ColumnMapping,
    db_df: Optional[pd.DataFrame] = None,
    beg_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Transforms uploaded or merged DataFrame into:
    1. PROMO_FACT df: columns ['STORE', 'CODE', 'NAME', 'FC', 'SALE', 'FINAL_STOCK', 'DISTRIBUTION_QTY', 'SERVICE_LEVEL', 'SUPPLIER']
    2. STOCK_TIMELINE df: columns ['STORE', 'CODE', 'STOCK_DATE', 'STOCK_QTY']
    """
    clean_df = pd.DataFrame()
    
    # 1. Store, Code, Name
    if 'STORE' in df.columns:
        clean_df['STORE'] = df['STORE'].astype(str).str.strip()
    else:
        clean_df['STORE'] = df[mapping.store_col].astype(str).str.strip()

    if 'CODE' in df.columns:
        clean_df['CODE'] = df['CODE'].astype(str).str.strip()
    else:
        clean_df['CODE'] = df[mapping.code_col].astype(str).str.strip()

    if 'NAME' in df.columns:
        clean_df['NAME'] = df['NAME'].astype(str).str.strip()
    elif mapping.name_col and mapping.name_col in df.columns:
        clean_df['NAME'] = df[mapping.name_col].astype(str).str.strip()
    else:
        clean_df['NAME'] = clean_df['CODE']

    # Family detection
    family_col = None
    for c in df.columns:
        if str(c).strip().upper() in ["FAMILY", "KATEGORI", "KATEQORİYA", "CATEGORY", "ÜRÜN GRUBU", "MEHSUL QRUPU"]:
            family_col = c
            break
    if family_col:
        clean_df['FAMILY'] = df[family_col].astype(str).str.strip()
    else:
        def infer_family(name_str):
            n = str(name_str).upper()
            if any(k in n for k in ["BANAN", "ALMA", "MEYVƏ", "ZEYTUN", "TOMAT"]):
                return "Meyvə & Tərəvə"
            elif any(k in n for k in ["SÜD", "YAĞ", "QATIQ", "XAMA", "PENDİR"]):
                return "Süd Məhsulları"
            elif any(k in n for k in ["ŞƏKƏR", "UN", "ÇAY", "QƏHVƏ", "MAKARON", "DÜYÜ", "YAĞI", "SİRKE", "MAYONEZ", "KETÇUP"]):
                return "Baqaliyya & Ərzaq"
            elif any(k in n for k in ["ŞOKOLAD", "PEÇENYE", "DONDURMA", "BİSKVİT", "ÇİPSİ", "BAL", "MÜRƏBBƏ", "QOZ", "FINDIQ"]):
                return "Şirniyyat & Çay"
            elif any(k in n for k in ["KOLA", "SU", "ŞİRƏ", "RED BULL", "ENERJİ"]):
                return "İçkilər & Şirələr"
            elif any(k in n for k in ["DƏSMAL", "ŞAMPUN", "SABUN", "DİŞ MƏCUNU", "ARIEL", "FAIRY", "TOZ"]):
                return "Qeyri-Qida & Məişət"
            else:
                return "Baqaliyya & Ərzaq"

        clean_df['FAMILY'] = clean_df['NAME'].apply(infer_family)
    
    # 2. FC, FC_MEBLEG, SALE, FINAL_STOCK, DISTRIBUTION_QTY, SERVICE_LEVEL, SUPPLIER
    if 'FC' in df.columns:
        clean_df['FC'] = pd.to_numeric(df['FC'], errors='coerce').fillna(0.0).clip(lower=0.0)
    elif mapping.fc_col and mapping.fc_col in df.columns:
        clean_df['FC'] = pd.to_numeric(df[mapping.fc_col], errors='coerce').fillna(0.0).clip(lower=0.0)
    else:
        clean_df['FC'] = 0.0

    if 'FC_MEBLEG' in df.columns:
        clean_df['FC_MEBLEG'] = pd.to_numeric(df['FC_MEBLEG'], errors='coerce').fillna(0.0).clip(lower=0.0)
    elif mapping.fc_mebleg_col and mapping.fc_mebleg_col in df.columns:
        clean_df['FC_MEBLEG'] = pd.to_numeric(df[mapping.fc_mebleg_col], errors='coerce').fillna(0.0).clip(lower=0.0)
    else:
        clean_df['FC_MEBLEG'] = 0.0

    if 'SALE' in df.columns:
        clean_df['SALE'] = pd.to_numeric(df['SALE'], errors='coerce').fillna(0.0).clip(lower=0.0)
    elif mapping.sale_col and mapping.sale_col in df.columns:
        clean_df['SALE'] = pd.to_numeric(df[mapping.sale_col], errors='coerce').fillna(0.0).clip(lower=0.0)
    else:
        clean_df['SALE'] = 0.0

    if 'FINAL_STOCK' in df.columns:
        clean_df['FINAL_STOCK'] = pd.to_numeric(df['FINAL_STOCK'], errors='coerce').fillna(0.0).clip(lower=0.0)
    elif mapping.stock_col and mapping.stock_col in df.columns:
        clean_df['FINAL_STOCK'] = pd.to_numeric(df[mapping.stock_col], errors='coerce').fillna(0.0).clip(lower=0.0)
    else:
        clean_df['FINAL_STOCK'] = 0.0

    if 'DISTRIBUTION_QTY' in df.columns:
        clean_df['DISTRIBUTION_QTY'] = pd.to_numeric(df['DISTRIBUTION_QTY'], errors='coerce').fillna(0.0).clip(lower=0.0)
    elif mapping.distribution_col and mapping.distribution_col in df.columns:
        clean_df['DISTRIBUTION_QTY'] = pd.to_numeric(df[mapping.distribution_col], errors='coerce').fillna(0.0).clip(lower=0.0)
    else:
        clean_df['DISTRIBUTION_QTY'] = clean_df['SALE'] + clean_df['FINAL_STOCK']

    if 'SERVICE_LEVEL' in df.columns:
        clean_df['SERVICE_LEVEL'] = pd.to_numeric(df['SERVICE_LEVEL'], errors='coerce')
    elif mapping.service_level_col and mapping.service_level_col in df.columns:
        clean_df['SERVICE_LEVEL'] = pd.to_numeric(df[mapping.service_level_col], errors='coerce')

    if 'SUPPLIER' in df.columns:
        clean_df['SUPPLIER'] = df['SUPPLIER']

    if 'REF' in df.columns:
        clean_df['REF'] = pd.to_numeric(df['REF'], errors='coerce')
    elif mapping.ref_col and mapping.ref_col in df.columns:
        clean_df['REF'] = pd.to_numeric(df[mapping.ref_col], errors='coerce')

    if 'PROMO_TYPE' in df.columns:
        clean_df['PROMO_TYPE'] = df['PROMO_TYPE']
    elif mapping.promo_type_col and mapping.promo_type_col in df.columns:
        raw_pt = df[mapping.promo_type_col].astype(str).str.strip().str.lower()
        clean_df['PROMO_TYPE'] = raw_pt.apply(lambda v: "tesir" if any(k in v for k in ["tesir", "teshir", "təsir", "teşhir"]) else ("adi" if "adi" in v else v))
    elif 'Tesir/adi' in df.columns:
        raw_pt = df['Tesir/adi'].astype(str).str.strip().str.lower()
        clean_df['PROMO_TYPE'] = raw_pt.apply(lambda v: "tesir" if any(k in v for k in ["tesir", "teshir", "təsir", "teşhir"]) else ("adi" if "adi" in v else v))
    else:
        clean_df['PROMO_TYPE'] = "adi"

    if 'CATEGORY' in df.columns:
        clean_df['CATEGORY'] = df['CATEGORY']
    elif mapping.category_col and mapping.category_col in df.columns:
        clean_df['CATEGORY'] = df[mapping.category_col]
    else:
        clean_df['CATEGORY'] = None

    if 'SUB_CATEGORY' in df.columns:
        clean_df['SUB_CATEGORY'] = df['SUB_CATEGORY']
    elif mapping.sub_category_col and mapping.sub_category_col in df.columns:
        clean_df['SUB_CATEGORY'] = df[mapping.sub_category_col]
    else:
        clean_df['SUB_CATEGORY'] = None

    if 'FAMILY' in df.columns:
        clean_df['FAMILY'] = df['FAMILY']
    elif mapping.family_col and mapping.family_col in df.columns:
        clean_df['FAMILY'] = df[mapping.family_col]
    else:
        clean_df['FAMILY'] = None

    if 'AREA' in df.columns:
        clean_df['AREA'] = df['AREA']
    elif mapping.area_col and mapping.area_col in df.columns:
        clean_df['AREA'] = df[mapping.area_col]
    else:
        clean_df['AREA'] = None

    if 'SUB_AREA' in df.columns:
        clean_df['SUB_AREA'] = df['SUB_AREA']
    elif mapping.sub_area_col and mapping.sub_area_col in df.columns:
        clean_df['SUB_AREA'] = df[mapping.sub_area_col]
    else:
        clean_df['SUB_AREA'] = None

    # Aggregate duplicate STORE + CODE combinations
    agg_dict = {
        'NAME': 'first',
        'FAMILY': 'first',
        'FC': 'sum',
        'FC_MEBLEG': 'sum',
        'SALE': 'sum',
        'FINAL_STOCK': 'last',
        'DISTRIBUTION_QTY': 'sum'
    }
    if 'SERVICE_LEVEL' in clean_df.columns:
        agg_dict['SERVICE_LEVEL'] = 'first'
    if 'SUPPLIER' in clean_df.columns:
        agg_dict['SUPPLIER'] = 'first'
    if 'REF' in clean_df.columns:
        agg_dict['REF'] = 'first'
    if 'PROMO_TYPE' in clean_df.columns:
        agg_dict['PROMO_TYPE'] = 'first'
    if 'CATEGORY' in clean_df.columns:
        agg_dict['CATEGORY'] = 'first'
    if 'SUB_CATEGORY' in clean_df.columns:
        agg_dict['SUB_CATEGORY'] = 'first'
    if 'AREA' in clean_df.columns:
        agg_dict['AREA'] = 'first'
    if 'SUB_AREA' in clean_df.columns:
        agg_dict['SUB_AREA'] = 'first'

    promo_fact_df = clean_df.groupby(['STORE', 'CODE'], as_index=False).agg(agg_dict)
    
    # Build STOCK_TIMELINE across campaign date range
    timeline_records = []
    
    if db_df is not None and not db_df.empty and 'sale_date' in db_df.columns:
        db_map: Dict[Tuple[str, str], Dict[str, float]] = {}
        for r in db_df.to_dict(orient='records'):
            st_raw = str(r.get('store_code', '')).strip()
            cd_raw = str(r.get('item_code', '')).strip()
            st_norm = normalize_store_code(st_raw) or st_raw
            cd_norm = normalize_item_code(cd_raw) or cd_raw
            s_date = str(r.get('sale_date', ''))[:10]
            stk_qty = float(r.get('current_stock')) if pd.notnull(r.get('current_stock')) else 0.0
            
            key = (st_norm, cd_norm)
            if key not in db_map:
                db_map[key] = {}
            db_map[key][s_date] = stk_qty

        campaign_dates = []
        if beg_date and end_date:
            try:
                campaign_dates = [d.strftime("%Y-%m-%d") for d in pd.date_range(beg_date, end_date)]
            except Exception:
                campaign_dates = []

        for row in promo_fact_df.to_dict(orient='records'):
            raw_st = str(row['STORE'])
            raw_cd = str(row['CODE'])
            norm_st = normalize_store_code(raw_st) or raw_st
            norm_cd = normalize_item_code(raw_cd) or raw_cd
            
            matched_map = db_map.get((norm_st, norm_cd), {})
            
            if campaign_dates:
                current_stk = float(row.get('FINAL_STOCK', 0.0))
                if matched_map:
                    first_matched_date = min(matched_map.keys())
                    current_stk = matched_map[first_matched_date]

                for d_str in campaign_dates:
                    if d_str in matched_map:
                        current_stk = matched_map[d_str]
                    timeline_records.append({
                        'STORE': raw_st,
                        'CODE': raw_cd,
                        'STOCK_DATE': d_str,
                        'STOCK_QTY': round(current_stk, 2)
                    })
            elif matched_map:
                for dt, qty in matched_map.items():
                    timeline_records.append({
                        'STORE': raw_st,
                        'CODE': raw_cd,
                        'STOCK_DATE': dt,
                        'STOCK_QTY': float(qty)
                    })
            else:
                d_str = datetime.now().strftime("%Y-%m-%d")
                timeline_records.append({
                    'STORE': raw_st,
                    'CODE': raw_cd,
                    'STOCK_DATE': d_str,
                    'STOCK_QTY': float(row.get('FINAL_STOCK', 0.0))
                })
        timeline_df = pd.DataFrame(timeline_records) if timeline_records else pd.DataFrame()
    elif beg_date and end_date:
        try:
            date_list = [d.strftime("%Y-%m-%d") for d in pd.date_range(beg_date, end_date)]
        except Exception:
            date_list = [datetime.now().strftime("%Y-%m-%d")]
            
        total_days = max(len(date_list), 1)
        st_series = promo_fact_df['FINAL_STOCK'].fillna(0.0)
        sale_series = promo_fact_df['SALE'].fillna(0.0)
        daily_depletion = sale_series / total_days
        base_stock = st_series + sale_series
        
        dfs = []
        for k, d_str in enumerate(date_list):
            curr_stock = (base_stock - daily_depletion * (k + 1)).clip(lower=0.0).round(2)
            sub_df = pd.DataFrame({
                'STORE': promo_fact_df['STORE'],
                'CODE': promo_fact_df['CODE'],
                'STOCK_DATE': d_str,
                'STOCK_QTY': curr_stock
            })
            dfs.append(sub_df)
        timeline_df = pd.concat(dfs, ignore_index=True) if dfs else pd.DataFrame()
    else:
        default_date = datetime.now().strftime("%Y-%m-%d")
        timeline_df = pd.DataFrame({
            'STORE': promo_fact_df['STORE'],
            'CODE': promo_fact_df['CODE'],
            'STOCK_DATE': default_date,
            'STOCK_QTY': promo_fact_df['FINAL_STOCK'].fillna(0.0)
        })
    if timeline_df is not None and not timeline_df.empty:
        timeline_df = timeline_df.groupby(['STORE', 'CODE', 'STOCK_DATE'], as_index=False).agg({'STOCK_QTY': 'last'})
    elif timeline_df is None:
        timeline_df = pd.DataFrame()

    return promo_fact_df, timeline_df
