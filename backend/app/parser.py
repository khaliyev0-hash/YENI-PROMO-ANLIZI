import re
import pandas as pd
import numpy as np
from datetime import datetime
from typing import Tuple, Dict, List, Optional
from app.config import COLUMN_ALIASES
from app.schemas import ColumnMapping, ServiceLevelColumnMapping, DataQualityWarning, DataQualityReport
def normalize_header(col: str) -> str:
    s = re.sub(r'[\_\-\s]+', ' ', str(col)).strip().upper()
    trans = str.maketrans({
        'Ə': 'E', 'I': 'I', 'İ': 'I', 'Ö': 'O', 'Ü': 'U', 'Ş': 'S', 'Ç': 'C', 'Ğ': 'G'
    })
    return s.translate(trans)

def detect_columns(df_cols: List[str]) -> Tuple[ColumnMapping, float]:
    """
    Intelligently match DataFrame columns for TEMPLATE 1 (General FC / Distribution).
    Returns (ColumnMapping, confidence_score 0.0-1.0)
    """
    norm_cols = {col: normalize_header(col) for col in df_cols}
    
    mapping = {
        "code_col": None,
        "name_col": None,
        "insert_name_col": None,
        "start_date_col": None,
        "end_date_col": None,
        "fc_col": None,
        "fc_mebleg_col": None,
        "distribution_col": None,
        "store_col": None,
        "sale_col": None,
        "stock_col": None,
        "service_level_col": None,
        "ref_col": None,
        "promo_type_col": None,
        "category_col": None,
        "sub_category_col": None,
        "family_col": None,
        "area_col": None,
        "sub_area_col": None,
        "daily_stock_cols": []
    }
    
    matched_counts = 0
    
    # 1. Match Standard Fields
    for field, aliases in COLUMN_ALIASES.items():
        norm_aliases = [normalize_header(a) for a in aliases]
        for orig_col, norm in norm_cols.items():
            if norm in norm_aliases:
                if field == "CODE" and not mapping["code_col"]:
                    mapping["code_col"] = orig_col
                    matched_counts += 1
                elif field == "NAME" and not mapping["name_col"]:
                    mapping["name_col"] = orig_col
                    matched_counts += 1
                elif field == "INSERT_NAME" and not mapping["insert_name_col"]:
                    mapping["insert_name_col"] = orig_col
                elif field == "FC" and not mapping["fc_col"]:
                    mapping["fc_col"] = orig_col
                    matched_counts += 1
                elif field == "FC_MEBLEG" and not mapping["fc_mebleg_col"]:
                    mapping["fc_mebleg_col"] = orig_col
                elif field == "START_DATE" and not mapping["start_date_col"]:
                    mapping["start_date_col"] = orig_col
                elif field == "END_DATE" and not mapping["end_date_col"]:
                    mapping["end_date_col"] = orig_col
                elif field == "DISTRIBUTION" and not mapping["distribution_col"]:
                    mapping["distribution_col"] = orig_col
                elif field == "STORE" and not mapping["store_col"]:
                    mapping["store_col"] = orig_col
                elif field == "SALE" and not mapping["sale_col"]:
                    mapping["sale_col"] = orig_col
                elif field == "STOCK" and not mapping["stock_col"]:
                    mapping["stock_col"] = orig_col
                elif field == "SERVICE_LEVEL_PCT" and not mapping["service_level_col"]:
                    mapping["service_level_col"] = orig_col
                elif field == "REF" and not mapping["ref_col"]:
                    mapping["ref_col"] = orig_col
                elif field == "PROMO_TYPE" and not mapping["promo_type_col"]:
                    mapping["promo_type_col"] = orig_col
                elif field == "CATEGORY" and not mapping["category_col"]:
                    mapping["category_col"] = orig_col
                elif field == "SUB_CATEGORY" and not mapping["sub_category_col"]:
                    mapping["sub_category_col"] = orig_col
                elif field == "FAMILY" and not mapping["family_col"]:
                    mapping["family_col"] = orig_col
                elif field == "AREA" and not mapping["area_col"]:
                    mapping["area_col"] = orig_col
                elif field == "SUB_AREA" and not mapping["sub_area_col"]:
                    mapping["sub_area_col"] = orig_col

    # 2. Match Daily Stock Columns (Format B)
    for orig_col in df_cols:
        norm = norm_cols[orig_col]
        if re.search(r'(STOCK|STOK|QALIQ).*\d{1,2}[\.\-\/]\d{1,2}[\.\-\/]\d{2,4}', norm):
            mapping["daily_stock_cols"].append(orig_col)

    # Calculate confidence score based on core fields for Template 1 (CODE, STORE, FC or FC_MEBLEG)
    required_matched = sum([
        1 if mapping["code_col"] else 0,
        1 if mapping["store_col"] else 0,
        1 if (mapping["fc_col"] or mapping["fc_mebleg_col"]) else 0,
    ])
    confidence = required_matched / 3.0
    
    col_mapping = ColumnMapping(
        code_col=mapping["code_col"] or "",
        name_col=mapping["name_col"] or "",
        insert_name_col=mapping["insert_name_col"],
        start_date_col=mapping["start_date_col"],
        end_date_col=mapping["end_date_col"],
        fc_col=mapping["fc_col"] or mapping["fc_mebleg_col"] or "",
        fc_mebleg_col=mapping["fc_mebleg_col"],
        distribution_col=mapping["distribution_col"],
        store_col=mapping["store_col"],
        sale_col=mapping["sale_col"],
        stock_col=mapping["stock_col"],
        service_level_col=mapping["service_level_col"],
        ref_col=mapping["ref_col"],
        promo_type_col=mapping["promo_type_col"],
        category_col=mapping["category_col"],
        sub_category_col=mapping["sub_category_col"],
        family_col=mapping["family_col"],
        area_col=mapping["area_col"],
        sub_area_col=mapping["sub_area_col"],
        daily_stock_cols=mapping["daily_stock_cols"]
    )
    
    return col_mapping, confidence

def detect_service_level_columns(df_cols: List[str]) -> Tuple[ServiceLevelColumnMapping, float]:
    """
    Intelligently match DataFrame columns for TEMPLATE 2 (Service Level Upload).
    Sütunlar: Mehsul_kodu | Mehsul_adi | Magaza | Sifariş miqdarı | Qarşılanan miqdar | Təminat % | Firma
    Returns (ServiceLevelColumnMapping, confidence_score)
    """
    norm_cols = {col: normalize_header(col) for col in df_cols}

    mapping = {
        "code_col": None,
        "name_col": None,
        "store_col": None,
        "order_qty_col": None,
        "fulfilled_qty_col": None,
        "service_level_pct_col": None,
        "supplier_col": None
    }

    for field, aliases in COLUMN_ALIASES.items():
        norm_aliases = [normalize_header(a) for a in aliases]
        for orig_col, norm in norm_cols.items():
            if norm in norm_aliases:
                if field == "CODE" and not mapping["code_col"]:
                    mapping["code_col"] = orig_col
                elif field == "NAME" and not mapping["name_col"]:
                    mapping["name_col"] = orig_col
                elif field == "STORE" and not mapping["store_col"]:
                    mapping["store_col"] = orig_col
                elif field == "ORDER_QTY" and not mapping["order_qty_col"]:
                    mapping["order_qty_col"] = orig_col
                elif field == "FULFILLED_QTY" and not mapping["fulfilled_qty_col"]:
                    mapping["fulfilled_qty_col"] = orig_col
                elif field == "SERVICE_LEVEL_PCT" and not mapping["service_level_pct_col"]:
                    mapping["service_level_pct_col"] = orig_col
                elif field == "SUPPLIER" and not mapping["supplier_col"]:
                    mapping["supplier_col"] = orig_col

    required_matched = sum([
        1 if mapping["code_col"] else 0,
        1 if mapping["store_col"] else 0,
        1 if mapping["order_qty_col"] else 0,
        1 if mapping["fulfilled_qty_col"] else 0,
    ])
    confidence = required_matched / 4.0

    sl_mapping = ServiceLevelColumnMapping(
        code_col=mapping["code_col"] or "",
        name_col=mapping["name_col"],
        store_col=mapping["store_col"] or "",
        order_qty_col=mapping["order_qty_col"] or "",
        fulfilled_qty_col=mapping["fulfilled_qty_col"] or "",
        service_level_pct_col=mapping["service_level_pct_col"],
        supplier_col=mapping["supplier_col"]
    )
    return sl_mapping, confidence

def extract_and_validate_campaign_dates(df: pd.DataFrame, mapping: ColumnMapping) -> Tuple[str, str]:
    """
    Extracts and validates campaign start and end dates from Excel.
    Ensures all rows belong to the same campaign date range.
    Returns (beg_date_str, end_date_str) in 'YYYY-MM-DD' format.
    Raises ValueError if inconsistent dates exist across rows.
    """
    default_start = "2026-09-03"
    default_end = "2026-09-07"
    
    start_col = mapping.start_date_col if (mapping.start_date_col and mapping.start_date_col in df.columns) else None
    end_col = mapping.end_date_col if (mapping.end_date_col and mapping.end_date_col in df.columns) else None

    if not start_col or not end_col:
        return default_start, default_end

    date_pairs = set()
    unique_pairs = df[[start_col, end_col]].dropna().drop_duplicates()
    for _, row in unique_pairs.iterrows():
        s_val = row[start_col]
        e_val = row[end_col]
        
        s_dt = parse_date_string(s_val)
        e_dt = parse_date_string(e_val)

        if not s_dt or not e_dt:
            continue

        s_str = s_dt.strftime("%Y-%m-%d")
        e_str = e_dt.strftime("%Y-%m-%d")

        date_pairs.add((s_str, e_str))

    if len(date_pairs) > 1:
        raise ValueError("Excel daxilində fərqli kampaniya tarixləri aşkarlandı, fayl bir kampaniyaya aid olmalıdır")

    if len(date_pairs) == 1:
        return list(date_pairs)[0]

    return default_start, default_end

def parse_date_string(val: Any) -> Optional[datetime]:
    """Tries parsing various date types and formats into a Python datetime object."""
    if val is None or pd.isnull(val):
        return None

    if isinstance(val, (datetime, pd.Timestamp)):
        return val.to_pydatetime() if isinstance(val, pd.Timestamp) else val

    date_str = str(val).strip()
    if not date_str or date_str.lower() in ["none", "nan", "nat"]:
        return None

    if " " in date_str:
        date_str = date_str.split(" ")[0].strip()

    formats = [
        "%Y-%m-%d", "%d.%m.%Y", "%d/%m/%Y", "%d-%m-%Y",
        "%d.%m.%y", "%m/%d/%Y", "%Y.%m.%d"
    ]
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            pass
    return None

def analyze_data_quality(df: pd.DataFrame, mapping: ColumnMapping) -> DataQualityReport:
    """
    Analyzes DataFrame against selected mapping to produce DataQualityReport.
    Does NOT modify data; reports warnings & row indexes.
    """
    warnings: List[DataQualityWarning] = []
    total_rows = len(df)
    
    # 1. Store and Product counts
    store_col = mapping.store_col if (mapping.store_col and mapping.store_col in df.columns) else ('STORE' if 'STORE' in df.columns else None)
    code_col = mapping.code_col if (mapping.code_col and mapping.code_col in df.columns) else ('CODE' if 'CODE' in df.columns else None)

    store_val = df[store_col].astype(str) if store_col else pd.Series([], dtype=str)
    code_val = df[code_col].astype(str) if code_col else pd.Series([], dtype=str)
    
    total_stores = store_val.nunique() if len(store_val) > 0 else 0
    total_products = code_val.nunique() if len(code_val) > 0 else 0
    
    # Unique STORE + CODE
    if len(store_val) > 0 and len(code_val) > 0:
        store_code_pairs = store_val + "___" + code_val
        unique_store_code_count = store_code_pairs.nunique()
        duplicate_store_code_count = total_rows - unique_store_code_count
        
        if duplicate_store_code_count > 0:
            dup_mask = store_code_pairs.duplicated(keep=False)
            dup_rows = df.index[dup_mask].tolist()
            warnings.append(DataQualityWarning(
                type="DUPLICATE_STORE_CODE",
                severity="HIGH",
                description=f"{duplicate_store_code_count} duplicate STORE + CODE row combinations found.",
                count=duplicate_store_code_count,
                affected_rows=dup_rows[:20]
            ))
    else:
        unique_store_code_count = 0
        duplicate_store_code_count = 0
        
    # 2. Missing values
    missing_mask = df.isnull().any(axis=1)
    missing_count = int(missing_mask.sum())
    if missing_count > 0:
        warnings.append(DataQualityWarning(
            type="MISSING_VALUES",
            severity="MEDIUM",
            description=f"{missing_count} rows contain missing / null values.",
            count=missing_count,
            affected_rows=df.index[missing_mask].tolist()[:20]
        ))
        
    # 3. Duplicate whole rows
    dup_rows_count = int(df.duplicated().sum())
    if dup_rows_count > 0:
        warnings.append(DataQualityWarning(
            type="DUPLICATE_ROWS",
            severity="MEDIUM",
            description=f"{dup_rows_count} exact duplicate rows found.",
            count=dup_rows_count,
            affected_rows=df.index[df.duplicated()].tolist()[:20]
        ))
        
    # 4. Numeric Checks (FC, SALE, STOCK)
    invalid_numeric_count = 0
    negative_fc_count = 0
    negative_sale_count = 0
    negative_stock_count = 0
    
    for col_name, field_label in [
        (mapping.fc_col, "FC"),
        (mapping.sale_col, "SALE"),
        (mapping.stock_col, "STOCK")
    ]:
        if col_name and col_name in df.columns:
            # Check non-numeric values
            num_series = pd.to_numeric(df[col_name], errors='coerce')
            invalid_num_mask = num_series.isnull() & df[col_name].notnull()
            inv_cnt = int(invalid_num_mask.sum())
            if inv_cnt > 0:
                invalid_numeric_count += inv_cnt
                warnings.append(DataQualityWarning(
                    type="INVALID_NUMERIC",
                    severity="HIGH",
                    description=f"Column '{col_name}' ({field_label}) has {inv_cnt} non-numeric values.",
                    count=inv_cnt,
                    affected_rows=df.index[invalid_num_mask].tolist()[:20]
                ))
            
            # Check negative numbers
            neg_mask = num_series < 0
            neg_cnt = int(neg_mask.sum())
            if neg_cnt > 0:
                if field_label == "FC":
                    negative_fc_count = neg_cnt
                elif field_label == "SALE":
                    negative_sale_count = neg_cnt
                elif field_label == "STOCK":
                    negative_stock_count = neg_cnt
                
                warnings.append(DataQualityWarning(
                    type=f"NEGATIVE_{field_label}",
                    severity="HIGH",
                    description=f"Column '{col_name}' ({field_label}) contains {neg_cnt} negative values.",
                    count=neg_cnt,
                    affected_rows=df.index[neg_mask].tolist()[:20]
                ))

    # 5. Dynamic Stock Date Checks
    duplicate_stock_dates_count = 0
    invalid_dates_count = 0
    if mapping.daily_stock_cols:
        parsed_dates = []
        stock_date_pattern = re.compile(r'^(?:STOCK|STOK|QALIQ)\s*[\:_ \-\.]*\s*(\d{1,4}[\.\/\-]\d{1,2}[\.\/\-]\d{2,4})', re.IGNORECASE)
        for col in mapping.daily_stock_cols:
            match = stock_date_pattern.search(str(col).strip())
            if match:
                dt = parse_date_string(match.group(1))
                if dt:
                    parsed_dates.append(dt)
                else:
                    invalid_dates_count += 1
            else:
                invalid_dates_count += 1
                
        if len(parsed_dates) != len(set(parsed_dates)):
            duplicate_stock_dates_count = len(parsed_dates) - len(set(parsed_dates))
            warnings.append(DataQualityWarning(
                type="DUPLICATE_STOCK_DATES",
                severity="MEDIUM",
                description=f"{duplicate_stock_dates_count} duplicate daily stock date headers detected.",
                count=duplicate_stock_dates_count
            ))

    # 6. REF Column Checks
    ref_col = mapping.ref_col if (mapping.ref_col and mapping.ref_col in df.columns) else ('REF' if 'REF' in df.columns else None)
    if ref_col and ref_col in df.columns:
        ref_series = pd.to_numeric(df[ref_col], errors='coerce')
        missing_ref_mask = ref_series.isnull()
        missing_ref_cnt = int(missing_ref_mask.sum())
        if missing_ref_cnt > 0:
            warnings.append(DataQualityWarning(
                type="MISSING_REF",
                severity="MEDIUM",
                description=f"{missing_ref_cnt} rows have no ref -> Over Stock not calculated.",
                count=missing_ref_cnt,
                affected_rows=df.index[missing_ref_mask].tolist()[:20]
            ))
        neg_ref_mask = ref_series < 0
        neg_ref_cnt = int(neg_ref_mask.sum())
        if neg_ref_cnt > 0:
            warnings.append(DataQualityWarning(
                type="NEGATIVE_REF",
                severity="HIGH",
                description=f"Column '{ref_col}' (REF) contains {neg_ref_cnt} negative values.",
                count=neg_ref_cnt,
                affected_rows=df.index[neg_ref_mask].tolist()[:20]
            ))
    else:
        warnings.append(DataQualityWarning(
            type="MISSING_REF",
            severity="MEDIUM",
            description=f"{total_rows} rows have no ref -> Over Stock not calculated.",
            count=total_rows,
            affected_rows=[]
        ))

    # 7. Category and Area Quality Warnings
    from app.analytics.group_analysis import normalize_grouping_key, UNASSIGNED_LABEL

    # Category checks
    cat_col = mapping.category_col if (mapping.category_col and mapping.category_col in df.columns) else ('CATEGORY' if 'CATEGORY' in df.columns else None)
    if cat_col and cat_col in df.columns:
        cat_series = df[cat_col].astype(str).str.strip()
        empty_cat_mask = df[cat_col].isna() | (cat_series == "") | cat_series.str.lower().isin(["nan", "none", "null", "təyin edilməyib", "teyin edilmeyib"])
        empty_cat_cnt = int(empty_cat_mask.sum())
        if empty_cat_cnt > 0:
            pct = round((empty_cat_cnt / total_rows) * 100.0, 1) if total_rows > 0 else 0.0
            warnings.append(DataQualityWarning(
                type="MISSING_CATEGORY",
                severity="LOW",
                description=f"{empty_cat_cnt} sətir ({pct}%) kateqoriyasızdır (Təyin edilməyib).",
                count=empty_cat_cnt,
                affected_rows=df.index[empty_cat_mask].tolist()[:20]
            ))

        # Check multi-category products
        if code_col and code_col in df.columns:
            valid_cats = df[~empty_cat_mask]
            if not valid_cats.empty:
                prod_cats = valid_cats.groupby(code_col)[cat_col].nunique()
                multi_cat_prods = prod_cats[prod_cats > 1]
                if len(multi_cat_prods) > 0:
                    examples = []
                    for code in multi_cat_prods.index[:10]:
                        distinct_vals = list(valid_cats[valid_cats[code_col] == code][cat_col].unique())
                        examples.append(f"{code}: {distinct_vals}")
                    warnings.append(DataQualityWarning(
                        type="MULTI_CATEGORY_PRODUCT",
                        severity="MEDIUM",
                        description=f"{len(multi_cat_prods)} məhsulda birdən çox kateqoriya aşkarlandı: {'; '.join(examples[:5])}",
                        count=len(multi_cat_prods),
                        affected_rows=[]
                    ))

        # Check category names merged by grouping key
        norm_cat_map: Dict[str, Set[str]] = {}
        for val in cat_series[~empty_cat_mask].unique():
            k = normalize_grouping_key(val)
            norm_cat_map.setdefault(k, set()).add(val)
        merged_cats = [f"[{k}]: {list(v)}" for k, v in norm_cat_map.items() if len(v) > 1]
        if merged_cats:
            warnings.append(DataQualityWarning(
                type="MERGED_CATEGORY_NAMES",
                severity="LOW",
                description=f"Kateqoriya adları birləşdirildi: {'; '.join(merged_cats[:10])}",
                count=len(merged_cats),
                affected_rows=[]
            ))
    else:
        warnings.append(DataQualityWarning(
            type="MISSING_CATEGORY_COLUMN",
            severity="LOW",
            description=f"Kateqoriya sütunu tapılmadı. Bütün data 'Təyin edilməyib' kimi qəbul edildi.",
            count=total_rows,
            affected_rows=[]
        ))

    # Area checks
    area_col = mapping.area_col if (mapping.area_col and mapping.area_col in df.columns) else ('AREA' if 'AREA' in df.columns else None)
    if area_col and area_col in df.columns:
        area_series = df[area_col].astype(str).str.strip()
        empty_area_mask = df[area_col].isna() | (area_series == "") | area_series.str.lower().isin(["nan", "none", "null", "təyin edilməyib", "teyin edilmeyib"])
        empty_area_cnt = int(empty_area_mask.sum())
        if empty_area_cnt > 0:
            pct = round((empty_area_cnt / total_rows) * 100.0, 1) if total_rows > 0 else 0.0
            warnings.append(DataQualityWarning(
                type="MISSING_AREA",
                severity="LOW",
                description=f"{empty_area_cnt} sətir ({pct}%) ərazisizdir (Təyin edilməyib).",
                count=empty_area_cnt,
                affected_rows=df.index[empty_area_mask].tolist()[:20]
            ))

        # Check multi-area stores
        if store_col and store_col in df.columns:
            valid_areas = df[~empty_area_mask]
            if not valid_areas.empty:
                st_areas = valid_areas.groupby(store_col)[area_col].nunique()
                multi_area_sts = st_areas[st_areas > 1]
                if len(multi_area_sts) > 0:
                    examples = []
                    for st in multi_area_sts.index[:10]:
                        distinct_vals = list(valid_areas[valid_areas[store_col] == st][area_col].unique())
                        examples.append(f"{st}: {distinct_vals}")
                    warnings.append(DataQualityWarning(
                        type="MULTI_AREA_STORE",
                        severity="MEDIUM",
                        description=f"{len(multi_area_sts)} mağazada birdən çox ərazi/bölgə aşkarlandı: {'; '.join(examples[:5])}",
                        count=len(multi_area_sts),
                        affected_rows=[]
                    ))

        # Check area names merged by grouping key
        norm_area_map: Dict[str, Set[str]] = {}
        for val in area_series[~empty_area_mask].unique():
            k = normalize_grouping_key(val)
            norm_area_map.setdefault(k, set()).add(val)
        merged_areas = [f"[{k}]: {list(v)}" for k, v in norm_area_map.items() if len(v) > 1]
        if merged_areas:
            warnings.append(DataQualityWarning(
                type="MERGED_AREA_NAMES",
                severity="LOW",
                description=f"Ərazi/bölgə adları birləşdirildi: {'; '.join(merged_areas[:10])}",
                count=len(merged_areas),
                affected_rows=[]
            ))
    else:
        warnings.append(DataQualityWarning(
            type="MISSING_AREA_COLUMN",
            severity="LOW",
            description=f"Ərazi/Bölgə sütunu tapılmadı. Bütün data 'Təyin edilməyib' kimi qəbul edildi.",
            count=total_rows,
            affected_rows=[]
        ))

    # 8. Sub-Category Quality Warnings
    sub_cat_col = mapping.sub_category_col if (mapping.sub_category_col and mapping.sub_category_col in df.columns) else ('SUB_CATEGORY' if 'SUB_CATEGORY' in df.columns else None)
    if sub_cat_col and sub_cat_col in df.columns:
        sub_cat_series = df[sub_cat_col].astype(str).str.strip()
        empty_sub_cat_mask = df[sub_cat_col].isna() | (sub_cat_series == "") | sub_cat_series.str.lower().isin(["nan", "none", "null", "təyin edilməyib", "teyin edilmeyib"])
        
        # Sub filled while parent is blank
        if cat_col and cat_col in df.columns:
            orphan_sub_mask = (~empty_sub_cat_mask) & empty_cat_mask
            orphan_sub_cnt = int(orphan_sub_mask.sum())
            if orphan_sub_cnt > 0:
                warnings.append(DataQualityWarning(
                    type="SUB_WITHOUT_PARENT_CATEGORY",
                    severity="LOW",
                    description=f"{orphan_sub_cnt} sətirdə sub-kateqoriya doludur, lakin əsas kateqoriyası boşdur (Əsas kateqoriya 'Təyin edilməyib' qəbul edildi).",
                    count=orphan_sub_cnt,
                    affected_rows=df.index[orphan_sub_mask].tolist()[:20]
                ))

        # Check multi-sub-category products
        if code_col and code_col in df.columns:
            valid_sub_cats = df[~empty_sub_cat_mask]
            if not valid_sub_cats.empty:
                prod_sub_cats = valid_sub_cats.groupby(code_col)[sub_cat_col].nunique()
                multi_sub_prods = prod_sub_cats[prod_sub_cats > 1]
                if len(multi_sub_prods) > 0:
                    examples = []
                    for code in multi_sub_prods.index[:10]:
                        distinct_vals = list(valid_sub_cats[valid_sub_cats[code_col] == code][sub_cat_col].unique())
                        examples.append(f"{code}: {distinct_vals}")
                    warnings.append(DataQualityWarning(
                        type="MULTI_SUBCATEGORY_PRODUCT",
                        severity="MEDIUM",
                        description=f"{len(multi_sub_prods)} məhsulda birdən çox sub-kateqoriya aşkarlandı: {'; '.join(examples[:5])}",
                        count=len(multi_sub_prods),
                        affected_rows=[]
                    ))

        # Check sub-category names merged by grouping key
        norm_sub_cat_map: Dict[str, Set[str]] = {}
        for val in sub_cat_series[~empty_sub_cat_mask].unique():
            k = normalize_grouping_key(val)
            norm_sub_cat_map.setdefault(k, set()).add(val)
        merged_sub_cats = [f"[{k}]: {list(v)}" for k, v in norm_sub_cat_map.items() if len(v) > 1]
        if merged_sub_cats:
            warnings.append(DataQualityWarning(
                type="MERGED_SUBCATEGORY_NAMES",
                severity="LOW",
                description=f"Sub-kateqoriya adları birləşdirildi: {'; '.join(merged_sub_cats[:10])}",
                count=len(merged_sub_cats),
                affected_rows=[]
            ))

    # 9. Sub-Area Quality Warnings
    sub_area_col = mapping.sub_area_col if (mapping.sub_area_col and mapping.sub_area_col in df.columns) else ('SUB_AREA' if 'SUB_AREA' in df.columns else None)
    if sub_area_col and sub_area_col in df.columns:
        sub_area_series = df[sub_area_col].astype(str).str.strip()
        empty_sub_area_mask = df[sub_area_col].isna() | (sub_area_series == "") | sub_area_series.str.lower().isin(["nan", "none", "null", "təyin edilməyib", "teyin edilmeyib"])

        # Sub filled while parent area is blank
        if area_col and area_col in df.columns:
            orphan_sub_area_mask = (~empty_sub_area_mask) & empty_area_mask
            orphan_sub_area_cnt = int(orphan_sub_area_mask.sum())
            if orphan_sub_area_cnt > 0:
                warnings.append(DataQualityWarning(
                    type="SUB_WITHOUT_PARENT_AREA",
                    severity="LOW",
                    description=f"{orphan_sub_area_cnt} sətirdə sub-ərazi doludur, lakin əsas ərazi boşdur (Əsas ərazi 'Təyin edilməyib' qəbul edildi).",
                    count=orphan_sub_area_cnt,
                    affected_rows=df.index[orphan_sub_area_mask].tolist()[:20]
                ))

        # Check multi-sub-area stores
        if store_col and store_col in df.columns:
            valid_sub_areas = df[~empty_sub_area_mask]
            if not valid_sub_areas.empty:
                st_sub_areas = valid_sub_areas.groupby(store_col)[sub_area_col].nunique()
                multi_sub_sts = st_sub_areas[st_sub_areas > 1]
                if len(multi_sub_sts) > 0:
                    examples = []
                    for st in multi_sub_sts.index[:10]:
                        distinct_vals = list(valid_sub_areas[valid_sub_areas[store_col] == st][sub_area_col].unique())
                        examples.append(f"{st}: {distinct_vals}")
                    warnings.append(DataQualityWarning(
                        type="MULTI_SUBAREA_STORE",
                        severity="MEDIUM",
                        description=f"{len(multi_sub_sts)} mağazada birdən çox sub-ərazi aşkarlandı: {'; '.join(examples[:5])}",
                        count=len(multi_sub_sts),
                        affected_rows=[]
                    ))

        # Check sub-area names merged by grouping key
        norm_sub_area_map: Dict[str, Set[str]] = {}
        for val in sub_area_series[~empty_sub_area_mask].unique():
            k = normalize_grouping_key(val)
            norm_sub_area_map.setdefault(k, set()).add(val)
        merged_sub_areas = [f"[{k}]: {list(v)}" for k, v in norm_sub_area_map.items() if len(v) > 1]
        if merged_sub_areas:
            warnings.append(DataQualityWarning(
                type="MERGED_SUBAREA_NAMES",
                severity="LOW",
                description=f"Sub-ərazi adları birləşdirildi: {'; '.join(merged_sub_areas[:10])}",
                count=len(merged_sub_areas),
                affected_rows=[]
            ))

    # 10. Family Quality Warnings
    family_col = mapping.family_col if (mapping.family_col and mapping.family_col in df.columns) else ('FAMILY' if 'FAMILY' in df.columns else None)
    if family_col and family_col in df.columns:
        family_series = df[family_col].astype(str).str.strip()
        empty_family_mask = df[family_col].isna() | (family_series == "") | family_series.str.lower().isin(["nan", "none", "null", "təyin edilməyib", "teyin edilmeyib"])

        # Family filled while sub is blank
        if sub_cat_col and sub_cat_col in df.columns:
            orphan_fam_sub_mask = (~empty_family_mask) & empty_sub_cat_mask
            orphan_fam_sub_cnt = int(orphan_fam_sub_mask.sum())
            if orphan_fam_sub_cnt > 0:
                warnings.append(DataQualityWarning(
                    type="FAMILY_WITHOUT_SUBCATEGORY",
                    severity="LOW",
                    description=f"{orphan_fam_sub_cnt} sətirdə Family doludur, lakin sub-kateqoriyası boşdur (Sub-kateqoriya 'Təyin edilməyib' qəbul edildi).",
                    count=orphan_fam_sub_cnt,
                    affected_rows=df.index[orphan_fam_sub_mask].tolist()[:20]
                ))

        # Family filled while category is blank
        if cat_col and cat_col in df.columns:
            orphan_fam_cat_mask = (~empty_family_mask) & empty_cat_mask
            orphan_fam_cat_cnt = int(orphan_fam_cat_mask.sum())
            if orphan_fam_cat_cnt > 0:
                warnings.append(DataQualityWarning(
                    type="FAMILY_WITHOUT_CATEGORY",
                    severity="LOW",
                    description=f"{orphan_fam_cat_cnt} sətirdə Family doludur, lakin əsas kateqoriyası boşdur (Kateqoriya 'Təyin edilməyib' qəbul edildi).",
                    count=orphan_fam_cat_cnt,
                    affected_rows=df.index[orphan_fam_cat_mask].tolist()[:20]
                ))

        # Check multi-family products
        if code_col and code_col in df.columns:
            valid_fams = df[~empty_family_mask]
            if not valid_fams.empty:
                prod_fams = valid_fams.groupby(code_col)[family_col].nunique()
                multi_fam_prods = prod_fams[prod_fams > 1]
                if len(multi_fam_prods) > 0:
                    examples = []
                    for code in multi_fam_prods.index[:10]:
                        distinct_vals = list(valid_fams[valid_fams[code_col] == code][family_col].unique())
                        examples.append(f"{code}: {distinct_vals}")
                    warnings.append(DataQualityWarning(
                        type="MULTI_FAMILY_PRODUCT",
                        severity="MEDIUM",
                        description=f"{len(multi_fam_prods)} məhsulda birdən çox family aşkarlandı: {'; '.join(examples[:5])}",
                        count=len(multi_fam_prods),
                        affected_rows=[]
                    ))

        # Check family names merged by grouping key
        norm_fam_map: Dict[str, Set[str]] = {}
        for val in family_series[~empty_family_mask].unique():
            k = normalize_grouping_key(val)
            norm_fam_map.setdefault(k, set()).add(val)
        merged_fams = [f"[{k}]: {list(v)}" for k, v in norm_fam_map.items() if len(v) > 1]
        if merged_fams:
            warnings.append(DataQualityWarning(
                type="MERGED_FAMILY_NAMES",
                severity="LOW",
                description=f"Family adları birləşdirildi: {'; '.join(merged_fams[:10])}",
                count=len(merged_fams),
                affected_rows=[]
            ))

    report = DataQualityReport(
        total_rows=total_rows,
        total_stores=total_stores,
        total_products=total_products,
        unique_store_code_count=unique_store_code_count,
        missing_values_count=missing_count,
        duplicate_rows_count=dup_rows_count,
        invalid_numeric_count=invalid_numeric_count,
        negative_fc_count=negative_fc_count,
        negative_sale_count=negative_sale_count,
        negative_stock_count=negative_stock_count,
        invalid_dates_count=invalid_dates_count,
        duplicate_store_code_count=duplicate_store_code_count,
        duplicate_stock_dates_count=duplicate_stock_dates_count,
        warnings=warnings
    )
    return report
