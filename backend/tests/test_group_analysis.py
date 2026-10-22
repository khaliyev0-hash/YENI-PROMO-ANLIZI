import pytest
import pandas as pd
import numpy as np
from app.analytics.group_analysis import (
    normalize_grouping_key,
    compute_display_names,
    aggregate_by_group,
    get_group_detail,
    UNASSIGNED_LABEL
)
from app.parser import analyze_data_quality
from app.schemas import ColumnMapping

def test_normalize_grouping_key():
    # Null / empty / unassigned variants
    assert normalize_grouping_key(None) == UNASSIGNED_LABEL
    assert normalize_grouping_key(np.nan) == UNASSIGNED_LABEL
    assert normalize_grouping_key(float("nan")) == UNASSIGNED_LABEL
    assert normalize_grouping_key("") == UNASSIGNED_LABEL
    assert normalize_grouping_key("   ") == UNASSIGNED_LABEL
    assert normalize_grouping_key("None") == UNASSIGNED_LABEL
    assert normalize_grouping_key("nan") == UNASSIGNED_LABEL
    assert normalize_grouping_key("null") == UNASSIGNED_LABEL
    assert normalize_grouping_key("Təyin edilməyib") == UNASSIGNED_LABEL
    assert normalize_grouping_key("teyin edilmeyib") == UNASSIGNED_LABEL
    assert normalize_grouping_key("unassigned") == UNASSIGNED_LABEL

    # Whitespace trimming and collapsing
    assert normalize_grouping_key("  Yağlar   və   Souslar  ") == "yağlar və souslar"

    # Azerbaijani letter casefolding
    # İ, I, ı all map to i
    assert normalize_grouping_key("İÇKİLƏR") == "içkilər"
    assert normalize_grouping_key("IÇKILƏR") == "içkilər"
    assert normalize_grouping_key("içkilər") == "içkilər"

    # Variations of names coalesce into the exact same canonical key
    k1 = normalize_grouping_key("xayal aliyev")
    k2 = normalize_grouping_key("Xayal Aliyev ")
    k3 = normalize_grouping_key("XAYAL ALIYEV")
    k4 = normalize_grouping_key("XAYAL ALİYEV")
    assert k1 == k2 == k3 == k4 == "xayal aliyev"

    # Azerbaijani special characters: Ə, Ş, Ç, Ö, Ü, Ğ
    assert normalize_grouping_key("ƏRZAQ") == "ərzaq"
    assert normalize_grouping_key("ŞİRƏLƏR") == "şirələr"
    assert normalize_grouping_key("ÇÖRƏK") == "çörək"
    assert normalize_grouping_key("ÖRTÜK") == "örtük"
    assert normalize_grouping_key("ÜZÜM") == "üzüm"
    assert normalize_grouping_key("YAĞ") == "yağ"

def test_compute_display_names():
    series = pd.Series([
        "Şirniyyat", "Şirniyyat", "şirniyyat", "ŞİRNIYYAT",
        "İçkilər", "IÇKILƏR",
        None, "Təyin edilməyib"
    ])
    dmap = compute_display_names(series)
    assert dmap[UNASSIGNED_LABEL] == UNASSIGNED_LABEL
    # "Şirniyyat" was the most frequent spelling
    assert dmap["şirniyyat"] == "Şirniyyat"
    # "İçkilər" vs "IÇKILƏR"
    assert dmap["içkilər"] in ["İçkilər", "IÇKILƏR"]

def test_aggregate_by_group_reconciliation():
    # Build sample fact_df
    data = [
        {"STORE": "101", "CODE": "SKU1", "NAME": "Cola 1L", "CATEGORY": "İçkilər", "AREA": "Bakı Mərkəz", "FC": 100, "SALE": 80, "FINAL_STOCK": 20, "DISTRIBUTION_QTY": 100},
        {"STORE": "102", "CODE": "SKU1", "NAME": "Cola 1L", "CATEGORY": "içkilər", "AREA": "Bakı Qərb", "FC": 150, "SALE": 150, "FINAL_STOCK": 0, "DISTRIBUTION_QTY": 150},
        {"STORE": "101", "CODE": "SKU2", "NAME": "Çörək", "CATEGORY": "Un Məmulatları", "AREA": "Bakı Mərkəz", "FC": 50, "SALE": 60, "FINAL_STOCK": 10, "DISTRIBUTION_QTY": 70},
        {"STORE": "102", "CODE": "SKU2", "NAME": "Çörək", "CATEGORY": "Un Məmulatları", "AREA": "Bakı Qərb", "FC": 80, "SALE": 40, "FINAL_STOCK": 0, "DISTRIBUTION_QTY": 40},
        {"STORE": "103", "CODE": "SKU3", "NAME": "Duru Yağ", "CATEGORY": None, "AREA": None, "FC": 20, "SALE": 10, "FINAL_STOCK": 5, "DISTRIBUTION_QTY": 15},
    ]
    df = pd.DataFrame(data)

    # 1. Aggregate by category
    res_cat = aggregate_by_group(df, dimension="category")
    totals = res_cat["totals"]
    groups = res_cat["groups"]

    assert totals["pairs"] == 5
    assert totals["stores"] == 3
    assert totals["skus"] == 3
    assert totals["fc"] == 400.0
    assert totals["sale"] == 340.0
    assert totals["stock"] == 35.0
    assert totals["stockout_pairs"] == 2  # rows with FINAL_STOCK == 0
    assert totals["stockout_pct"] == 40.0
    assert totals["osa_pct"] == 60.0
    assert totals["achievement_pct"] == 85.0  # 340 / 400 * 100

    # Reconcile sum of groups with totals
    sum_fc = sum(g["fc"] for g in groups)
    sum_sale = sum(g["sale"] for g in groups)
    sum_stock = sum(g["stock"] for g in groups)
    sum_stout = sum(g["stockout_pairs"] for g in groups)
    sum_pairs = sum(g["pairs"] for g in groups)

    assert round(sum_fc, 1) == totals["fc"]
    assert round(sum_sale, 1) == totals["sale"]
    assert round(sum_stock, 1) == totals["stock"]
    assert sum_stout == totals["stockout_pairs"]
    assert sum_pairs == totals["pairs"]

    # Share of total sale sums to ~100%
    sum_share = sum(g["share_of_total_sale_pct"] for g in groups)
    assert pytest.approx(sum_share, abs=0.2) == 100.0

    # Unassigned group present
    unassigned_cat = [g for g in groups if g["name"] == UNASSIGNED_LABEL]
    assert len(unassigned_cat) == 1
    assert unassigned_cat[0]["pairs"] == 1
    assert res_cat["unassigned"]["pairs"] == 1

    # 2. Aggregate by area
    res_area = aggregate_by_group(df, dimension="area")
    assert res_area["totals"]["sale"] == 340.0
    area_names = [g["name"] for g in res_area["groups"]]
    assert UNASSIGNED_LABEL in area_names

def test_cross_filter():
    data = [
        {"STORE": "101", "CODE": "SKU1", "NAME": "Cola 1L", "CATEGORY": "İçkilər", "AREA": "Bakı", "FC": 100, "SALE": 80, "FINAL_STOCK": 20, "DISTRIBUTION_QTY": 100},
        {"STORE": "102", "CODE": "SKU1", "NAME": "Cola 1L", "CATEGORY": "İçkilər", "AREA": "Gəncə", "FC": 150, "SALE": 150, "FINAL_STOCK": 0, "DISTRIBUTION_QTY": 150},
        {"STORE": "101", "CODE": "SKU2", "NAME": "Çörək", "CATEGORY": "Un", "AREA": "Bakı", "FC": 50, "SALE": 60, "FINAL_STOCK": 10, "DISTRIBUTION_QTY": 70},
    ]
    df = pd.DataFrame(data)

    # Filter category by Area = "Bakı"
    res = aggregate_by_group(df, dimension="category", area="Bakı")
    assert res["totals"]["pairs"] == 2
    assert res["totals"]["sale"] == 140.0
    assert len(res["groups"]) == 2

    # Filter area by Category = "İçkilər"
    res2 = aggregate_by_group(df, dimension="area", category="İçkilər")
    assert res2["totals"]["pairs"] == 2
    assert res2["totals"]["sale"] == 230.0

def test_get_group_detail():
    data = [
        {"STORE": "101", "CODE": "SKU1", "NAME": "Cola 1L", "CATEGORY": "İçkilər", "AREA": "Bakı", "FC": 100, "SALE": 80, "FINAL_STOCK": 20, "DISTRIBUTION_QTY": 100},
        {"STORE": "102", "CODE": "SKU1", "NAME": "Cola 1L", "CATEGORY": "İçkilər", "AREA": "Bakı", "FC": 150, "SALE": 150, "FINAL_STOCK": 0, "DISTRIBUTION_QTY": 150},
        {"STORE": "101", "CODE": "SKU2", "NAME": "Fanta 1L", "CATEGORY": "İçkilər", "AREA": "Bakı", "FC": 50, "SALE": 30, "FINAL_STOCK": 10, "DISTRIBUTION_QTY": 40},
    ]
    df = pd.DataFrame(data)

    # Category drill-down
    detail_cat = get_group_detail(df, dimension="category", name="İçkilər")
    assert len(detail_cat["items"]) == 2
    sku1 = next(item for item in detail_cat["items"] if item["code"] == "SKU1")
    assert sku1["sale"] == 230.0
    assert sku1["fc"] == 250.0
    assert sku1["stockout_store_count"] == 1
    assert sku1["store_count"] == 2

    # Area drill-down
    detail_area = get_group_detail(df, dimension="area", name="Bakı")
    assert len(detail_area["items"]) == 2
    st101 = next(item for item in detail_area["items"] if item["store"] == "101")
    assert st101["sale"] == 110.0
    assert st101["sku_count"] == 2

    # Unknown group returns empty
    empty_detail = get_group_detail(df, dimension="category", name="NonExistent")
    assert len(empty_detail["items"]) == 0

def test_backward_compatibility_empty_or_null_columns():
    # Legacy archive without CATEGORY or AREA columns
    df = pd.DataFrame([
        {"STORE": "101", "CODE": "SKU1", "NAME": "Item 1", "FC": 100, "SALE": 50, "FINAL_STOCK": 10},
        {"STORE": "102", "CODE": "SKU2", "NAME": "Item 2", "FC": 200, "SALE": 180, "FINAL_STOCK": 0},
    ])
    res = aggregate_by_group(df, dimension="category")
    assert len(res["groups"]) == 1
    assert res["groups"][0]["name"] == UNASSIGNED_LABEL
    assert res["unassigned"]["pairs"] == 2
    assert res["totals"]["sale"] == 230.0

def test_data_quality_warnings_category_area():
    # Construct DataFrame with quality issues:
    # 1. Row missing category and area
    # 2. Product SKU1 appearing under 2 different categories
    # 3. Store 101 appearing under 2 different areas
    # 4. Merged category spellings: 'Şirniyyat' vs 'şirniyyat'
    df = pd.DataFrame([
        {"STORE": "101", "CODE": "SKU1", "NAME": "P1", "CATEGORY": "Şirniyyat", "AREA": "Bakı", "FC": 10, "SALE": 5, "FINAL_STOCK": 5},
        {"STORE": "102", "CODE": "SKU1", "NAME": "P1", "CATEGORY": "Qənnadı", "AREA": "Gəncə", "FC": 10, "SALE": 5, "FINAL_STOCK": 5},
        {"STORE": "101", "CODE": "SKU2", "NAME": "P2", "CATEGORY": "şirniyyat", "AREA": "Sumqayıt", "FC": 10, "SALE": 5, "FINAL_STOCK": 5},
        {"STORE": "103", "CODE": "SKU3", "NAME": "P3", "CATEGORY": None, "AREA": None, "FC": 10, "SALE": 5, "FINAL_STOCK": 5},
    ])
    mapping = ColumnMapping(
        store_col="STORE",
        code_col="CODE",
        name_col="NAME",
        fc_col="FC",
        sale_col="SALE",
        stock_col="FINAL_STOCK",
        category_col="CATEGORY",
        area_col="AREA",
        daily_stock_cols=[]
    )
    report = analyze_data_quality(df, mapping)
    warning_types = [w.type for w in report.warnings]

    assert "MISSING_CATEGORY" in warning_types
    assert "MISSING_AREA" in warning_types
    assert "MULTI_CATEGORY_PRODUCT" in warning_types
    assert "MULTI_AREA_STORE" in warning_types
    assert "MERGED_CATEGORY_NAMES" in warning_types

def test_same_sub_name_under_two_parents_stays_separate():
    data = [
        {"STORE": "101", "CODE": "SKU1", "NAME": "Kola", "CATEGORY": "İçkilər", "SUB_CATEGORY": "Digər", "FC": 100, "SALE": 80, "FINAL_STOCK": 20},
        {"STORE": "101", "CODE": "SKU2", "NAME": "Keks", "CATEGORY": "Qənnadı", "SUB_CATEGORY": "Digər", "FC": 50, "SALE": 40, "FINAL_STOCK": 10},
    ]
    df = pd.DataFrame(data)
    res = aggregate_by_group(df, dimension="category")
    nodes = res["nodes"]

    assert len(nodes) == 2
    cat_ickiler = next(n for n in nodes if n["name"] == "İçkilər")
    cat_qennadi = next(n for n in nodes if n["name"] == "Qənnadı")

    assert len(cat_ickiler["children"]) == 1
    assert len(cat_qennadi["children"]) == 1

    child_ickiler = cat_ickiler["children"][0]
    child_qennadi = cat_qennadi["children"][0]

    assert child_ickiler["name"] == "Digər"
    assert child_qennadi["name"] == "Digər"
    # Node keys are distinct PATHS!
    assert child_ickiler["key"] != child_qennadi["key"]
    assert child_ickiler["key"] == "içkilər||digər"
    assert child_qennadi["key"] == "qənnadi||digər"
    assert child_ickiler["sale"] == 80.0
    assert child_qennadi["sale"] == 40.0

def test_blank_sub_and_blank_parent_placement():
    data = [
        # Filled parent, blank sub -> child 'Təyin edilməyib' under 'İçkilər'
        {"STORE": "101", "CODE": "SKU1", "NAME": "P1", "CATEGORY": "İçkilər", "SUB_CATEGORY": None, "FC": 100, "SALE": 70, "FINAL_STOCK": 10},
        # Filled parent, filled sub -> child 'Qazlı' under 'İçkilər'
        {"STORE": "101", "CODE": "SKU2", "NAME": "P2", "CATEGORY": "İçkilər", "SUB_CATEGORY": "Qazlı", "FC": 100, "SALE": 80, "FINAL_STOCK": 0},
        # Blank parent, filled sub -> parent 'Təyin edilməyib' with child 'Meyvə'
        {"STORE": "102", "CODE": "SKU3", "NAME": "P3", "CATEGORY": None, "SUB_CATEGORY": "Meyvə", "FC": 50, "SALE": 30, "FINAL_STOCK": 5},
    ]
    df = pd.DataFrame(data)
    res = aggregate_by_group(df, dimension="category")
    nodes = res["nodes"]

    ickiler = next(n for n in nodes if n["name"] == "İçkilər")
    unassigned_parent = next(n for n in nodes if n["name"] == UNASSIGNED_LABEL)

    # Under 'İçkilər': 2 children ('Qazlı' and 'Təyin edilməyib')
    sub_names_ickiler = [c["name"] for c in ickiler["children"]]
    assert "Qazlı" in sub_names_ickiler
    assert UNASSIGNED_LABEL in sub_names_ickiler

    # Under 'Təyin edilməyib': child 'Meyvə'
    sub_names_unassigned = [c["name"] for c in unassigned_parent["children"]]
    assert "Meyvə" in sub_names_unassigned

def test_tree_reconciliation_parent_equals_sum_of_children_and_totals():
    data = [
        {"STORE": "101", "CODE": "S1", "NAME": "A", "CATEGORY": "C1", "SUB_CATEGORY": "SC1", "FC": 100, "SALE": 80, "FINAL_STOCK": 0, "DISTRIBUTION_QTY": 80},
        {"STORE": "102", "CODE": "S1", "NAME": "A", "CATEGORY": "C1", "SUB_CATEGORY": "SC1", "FC": 120, "SALE": 100, "FINAL_STOCK": 20, "DISTRIBUTION_QTY": 120},
        {"STORE": "101", "CODE": "S2", "NAME": "B", "CATEGORY": "C1", "SUB_CATEGORY": "SC2", "FC": 80, "SALE": 60, "FINAL_STOCK": 10, "DISTRIBUTION_QTY": 70},
        {"STORE": "103", "CODE": "S3", "NAME": "C", "CATEGORY": "C2", "SUB_CATEGORY": "SC3", "FC": 200, "SALE": 150, "FINAL_STOCK": 0, "DISTRIBUTION_QTY": 150},
        {"STORE": "104", "CODE": "S4", "NAME": "D", "CATEGORY": "C2", "SUB_CATEGORY": None, "FC": 50, "SALE": 40, "FINAL_STOCK": 10, "DISTRIBUTION_QTY": 50},
    ]
    df = pd.DataFrame(data)
    res = aggregate_by_group(df, dimension="category")
    nodes = res["nodes"]
    totals = res["totals"]

    # 1. Total == Dashboard totals
    assert totals["fc"] == 550.0
    assert totals["sale"] == 430.0
    assert totals["stock"] == 40.0
    assert totals["stockout_pairs"] == 2
    assert totals["pairs"] == 5

    # Sum of all parents equals totals
    sum_p_fc = sum(p["fc"] for p in nodes)
    sum_p_sale = sum(p["sale"] for p in nodes)
    sum_p_stock = sum(p["stock"] for p in nodes)
    sum_p_stout = sum(p["stockout_pairs"] for p in nodes)
    sum_p_dist = sum(p["distribution_qty"] for p in nodes)
    sum_p_pairs = sum(p["pairs"] for p in nodes)

    assert round(sum_p_fc, 1) == totals["fc"]
    assert round(sum_p_sale, 1) == totals["sale"]
    assert round(sum_p_stock, 1) == totals["stock"]
    assert sum_p_stout == totals["stockout_pairs"]
    assert round(sum_p_dist, 1) == totals["distribution_qty"]
    assert sum_p_pairs == totals["pairs"]

    # 2. For every parent, sum of its children equals parent for additive metrics
    for p in nodes:
        children = p["children"]
        if children:
            assert round(sum(c["fc"] for c in children), 1) == p["fc"]
            assert round(sum(c["sale"] for c in children), 1) == p["sale"]
            assert round(sum(c["stock"] for c in children), 1) == p["stock"]
            assert sum(c["stockout_pairs"] for c in children) == p["stockout_pairs"]
            assert round(sum(c["distribution_qty"] for c in children), 1) == p["distribution_qty"]
            assert sum(c["pairs"] for c in children) == p["pairs"]

def test_drill_down_parent_and_sub():
    data = [
        {"STORE": "101", "CODE": "SKU1", "NAME": "Cola 1L", "CATEGORY": "İçkilər", "SUB_CATEGORY": "Qazlı", "FC": 100, "SALE": 80, "FINAL_STOCK": 20},
        {"STORE": "102", "CODE": "SKU2", "NAME": "Fanta 1L", "CATEGORY": "İçkilər", "SUB_CATEGORY": "Qazlı", "FC": 60, "SALE": 50, "FINAL_STOCK": 0},
        {"STORE": "101", "CODE": "SKU3", "NAME": "Meyvə Şirəsi", "CATEGORY": "İçkilər", "SUB_CATEGORY": "Şirə", "FC": 40, "SALE": 30, "FINAL_STOCK": 10},
    ]
    df = pd.DataFrame(data)

    # 1. Drill-down parent "İçkilər" (all subs)
    res_parent = get_group_detail(df, dimension="category", name="İçkilər")
    assert len(res_parent["items"]) == 3
    assert res_parent["items"][0]["code"] == "SKU1"

    # 2. Drill-down specific sub "Qazlı" under "İçkilər"
    res_sub = get_group_detail(df, dimension="category", name="İçkilər", sub="Qazlı")
    assert len(res_sub["items"]) == 2
    codes = [item["code"] for item in res_sub["items"]]
    assert "SKU1" in codes
    assert "SKU2" in codes
    assert "SKU3" not in codes

def test_sub_quality_warnings():
    df = pd.DataFrame([
        # Sub without parent
        {"STORE": "101", "CODE": "SKU1", "NAME": "P1", "CATEGORY": None, "SUB_CATEGORY": "Sub1", "AREA": None, "SUB_AREA": "SubArea1", "FC": 10, "SALE": 5, "FINAL_STOCK": 5},
        # Product with 2 sub categories
        {"STORE": "102", "CODE": "SKU2", "NAME": "P2", "CATEGORY": "Cat1", "SUB_CATEGORY": "Sub1", "AREA": "Area1", "SUB_AREA": "SA1", "FC": 10, "SALE": 5, "FINAL_STOCK": 5},
        {"STORE": "103", "CODE": "SKU2", "NAME": "P2", "CATEGORY": "Cat1", "SUB_CATEGORY": "Sub2", "AREA": "Area1", "SUB_AREA": "SA1", "FC": 10, "SALE": 5, "FINAL_STOCK": 5},
        # Store 104 with 2 sub areas
        {"STORE": "104", "CODE": "SKU3", "NAME": "P3", "CATEGORY": "Cat1", "SUB_CATEGORY": "Sub1", "AREA": "Area1", "SUB_AREA": "SA1", "FC": 10, "SALE": 5, "FINAL_STOCK": 5},
        {"STORE": "104", "CODE": "SKU4", "NAME": "P4", "CATEGORY": "Cat1", "SUB_CATEGORY": "Sub1", "AREA": "Area1", "SUB_AREA": "SA2", "FC": 10, "SALE": 5, "FINAL_STOCK": 5},
        # Merged sub spellings
        {"STORE": "105", "CODE": "SKU5", "NAME": "P5", "CATEGORY": "Cat1", "SUB_CATEGORY": "sub1", "AREA": "Area1", "SUB_AREA": "sa1", "FC": 10, "SALE": 5, "FINAL_STOCK": 5},
    ])
    mapping = ColumnMapping(
        store_col="STORE",
        code_col="CODE",
        name_col="NAME",
        fc_col="FC",
        sale_col="SALE",
        stock_col="FINAL_STOCK",
        category_col="CATEGORY",
        sub_category_col="SUB_CATEGORY",
        area_col="AREA",
        sub_area_col="SUB_AREA",
        daily_stock_cols=[]
    )
    report = analyze_data_quality(df, mapping)
    w_types = [w.type for w in report.warnings]

    assert "SUB_WITHOUT_PARENT_CATEGORY" in w_types
    assert "SUB_WITHOUT_PARENT_AREA" in w_types
    assert "MULTI_SUBCATEGORY_PRODUCT" in w_types
    assert "MULTI_SUBAREA_STORE" in w_types
    assert "MERGED_SUBCATEGORY_NAMES" in w_types
    assert "MERGED_SUBAREA_NAMES" in w_types

def test_three_level_category_tree_structure():
    data = [
        {"STORE": "101", "CODE": "SKU1", "NAME": "Cola 1L", "CATEGORY": "İçkilər", "SUB_CATEGORY": "Qazlı", "FAMILY": "Kola", "FC": 100, "SALE": 80, "FINAL_STOCK": 20, "DISTRIBUTION_QTY": 100},
        {"STORE": "102", "CODE": "SKU2", "NAME": "Fanta 1L", "CATEGORY": "İçkilər", "SUB_CATEGORY": "Qazlı", "FAMILY": "Qazlı Meyvəli", "FC": 60, "SALE": 50, "FINAL_STOCK": 10, "DISTRIBUTION_QTY": 60},
        {"STORE": "101", "CODE": "SKU3", "NAME": "Alma Şirəsi", "CATEGORY": "İçkilər", "SUB_CATEGORY": "Şirə", "FAMILY": "Təbii Şirə", "FC": 40, "SALE": 30, "FINAL_STOCK": 5, "DISTRIBUTION_QTY": 40},
    ]
    df = pd.DataFrame(data)
    res = aggregate_by_group(df, dimension="category")
    nodes = res["nodes"]

    # 1. Level 0: 1 category "İçkilər"
    assert len(nodes) == 1
    root = nodes[0]
    assert root["name"] == "İçkilər"
    assert root["level"] == 0
    assert root["path"] == ["İçkilər"]
    assert len(root["children"]) == 2  # Qazlı, Şirə

    # 2. Level 1: Sub Category "Qazlı"
    sub_qazli = next(c for c in root["children"] if c["name"] == "Qazlı")
    assert sub_qazli["level"] == 1
    assert sub_qazli["path"] == ["İçkilər", "Qazlı"]
    assert len(sub_qazli["children"]) == 2  # Kola, Qazlı Meyvəli

    # 3. Level 2: Family "Kola"
    fam_kola = next(f for f in sub_qazli["children"] if f["name"] == "Kola")
    assert fam_kola["level"] == 2
    assert fam_kola["path"] == ["İçkilər", "Qazlı", "Kola"]
    assert fam_kola["children"] == []
    assert fam_kola["children_count"] == 0
    assert fam_kola["sale"] == 80.0

def test_separation_of_duplicate_family_under_different_subs():
    data = [
        {"STORE": "101", "CODE": "SKU1", "NAME": "Kola Klassik", "CATEGORY": "İçkilər", "SUB_CATEGORY": "Qazlı", "FAMILY": "Klassik", "FC": 100, "SALE": 80, "FINAL_STOCK": 20},
        {"STORE": "101", "CODE": "SKU2", "NAME": "Alma Klassik", "CATEGORY": "İçkilər", "SUB_CATEGORY": "Şirə", "FAMILY": "Klassik", "FC": 50, "SALE": 40, "FINAL_STOCK": 10},
    ]
    df = pd.DataFrame(data)
    res = aggregate_by_group(df, dimension="category")
    root = res["nodes"][0]

    qazli = next(c for c in root["children"] if c["name"] == "Qazlı")
    shire = next(c for c in root["children"] if c["name"] == "Şirə")

    fam_qazli = qazli["children"][0]
    fam_shire = shire["children"][0]

    assert fam_qazli["name"] == "Klassik"
    assert fam_shire["name"] == "Klassik"
    # Node keys must be distinct PATHS!
    assert fam_qazli["key"] == "içkilər||qazli||klassik"
    assert fam_shire["key"] == "içkilər||şirə||klassik"
    assert fam_qazli["sale"] == 80.0
    assert fam_shire["sale"] == 40.0

def test_blank_handling_at_all_three_levels():
    data = [
        # Family filled, Sub blank, Category filled -> Sub becomes "Təyin edilməyib", Family under it
        {"STORE": "101", "CODE": "SKU1", "NAME": "P1", "CATEGORY": "İçkilər", "SUB_CATEGORY": None, "FAMILY": "Qazsız", "FC": 50, "SALE": 40, "FINAL_STOCK": 10},
        # Family filled, Sub blank, Category blank -> Category & Sub become "Təyin edilməyib", Family under it
        {"STORE": "102", "CODE": "SKU2", "NAME": "P2", "CATEGORY": None, "SUB_CATEGORY": None, "FAMILY": "Biskvit", "FC": 30, "SALE": 25, "FINAL_STOCK": 5},
        # Category filled, Sub filled, Family blank -> Family becomes "Təyin edilməyib" under Sub
        {"STORE": "103", "CODE": "SKU3", "NAME": "P3", "CATEGORY": "Qənnadı", "SUB_CATEGORY": "Şirniyyat", "FAMILY": None, "FC": 40, "SALE": 35, "FINAL_STOCK": 5},
    ]
    df = pd.DataFrame(data)
    res = aggregate_by_group(df, dimension="category")
    nodes = res["nodes"]

    # Check 1: İçkilər -> Təyin edilməyib -> Qazsız
    ickiler = next(n for n in nodes if n["name"] == "İçkilər")
    sub_unassigned = next(c for c in ickiler["children"] if c["name"] == UNASSIGNED_LABEL)
    fam_qazsiz = next(f for f in sub_unassigned["children"] if f["name"] == "Qazsız")
    assert fam_qazsiz["sale"] == 40.0

    # Check 2: Təyin edilməyib -> Təyin edilməyib -> Biskvit
    unassigned_cat = next(n for n in nodes if n["name"] == UNASSIGNED_LABEL)
    sub_unassigned2 = next(c for c in unassigned_cat["children"] if c["name"] == UNASSIGNED_LABEL)
    fam_biskvit = next(f for f in sub_unassigned2["children"] if f["name"] == "Biskvit")
    assert fam_biskvit["sale"] == 25.0

    # Check 3: Qənnadı -> Şirniyyat -> Təyin edilməyib
    qennadi = next(n for n in nodes if n["name"] == "Qənnadı")
    sub_sirniyyat = next(c for c in qennadi["children"] if c["name"] == "Şirniyyat")
    fam_unassigned = next(f for f in sub_sirniyyat["children"] if f["name"] == UNASSIGNED_LABEL)
    assert fam_unassigned["sale"] == 35.0

def test_three_level_additive_reconciliation():
    data = [
        {"STORE": "101", "CODE": "S1", "NAME": "A", "CATEGORY": "C1", "SUB_CATEGORY": "SC1", "FAMILY": "F1", "FC": 100, "SALE": 80, "FINAL_STOCK": 0, "DISTRIBUTION_QTY": 80},
        {"STORE": "102", "CODE": "S1", "NAME": "A", "CATEGORY": "C1", "SUB_CATEGORY": "SC1", "FAMILY": "F1", "FC": 120, "SALE": 100, "FINAL_STOCK": 20, "DISTRIBUTION_QTY": 120},
        {"STORE": "101", "CODE": "S2", "NAME": "B", "CATEGORY": "C1", "SUB_CATEGORY": "SC1", "FAMILY": "F2", "FC": 80, "SALE": 60, "FINAL_STOCK": 10, "DISTRIBUTION_QTY": 70},
        {"STORE": "103", "CODE": "S3", "NAME": "C", "CATEGORY": "C1", "SUB_CATEGORY": "SC2", "FAMILY": "F3", "FC": 50, "SALE": 40, "FINAL_STOCK": 0, "DISTRIBUTION_QTY": 50},
        {"STORE": "104", "CODE": "S4", "NAME": "D", "CATEGORY": "C2", "SUB_CATEGORY": "SC3", "FAMILY": "F4", "FC": 200, "SALE": 150, "FINAL_STOCK": 10, "DISTRIBUTION_QTY": 150},
    ]
    df = pd.DataFrame(data)
    res = aggregate_by_group(df, dimension="category")
    nodes = res["nodes"]
    totals = res["totals"]

    # Total check
    assert totals["fc"] == 550.0
    assert totals["sale"] == 430.0
    assert totals["stock"] == 40.0
    assert totals["pairs"] == 5

    # Sum of level 0 equals totals
    assert round(sum(n["fc"] for n in nodes), 1) == totals["fc"]
    assert round(sum(n["sale"] for n in nodes), 1) == totals["sale"]
    assert round(sum(n["stock"] for n in nodes), 1) == totals["stock"]
    assert sum(n["pairs"] for n in nodes) == totals["pairs"]

    # Sum of level 1 equals level 0, and sum of level 2 equals level 1
    for cat in nodes:
        assert round(sum(sub["fc"] for sub in cat["children"]), 1) == cat["fc"]
        assert round(sum(sub["sale"] for sub in cat["children"]), 1) == cat["sale"]
        assert round(sum(sub["stock"] for sub in cat["children"]), 1) == cat["stock"]
        assert sum(sub["pairs"] for sub in cat["children"]) == cat["pairs"]

        for sub in cat["children"]:
            assert round(sum(fam["fc"] for fam in sub["children"]), 1) == sub["fc"]
            assert round(sum(fam["sale"] for fam in sub["children"]), 1) == sub["sale"]
            assert round(sum(fam["stock"] for fam in sub["children"]), 1) == sub["stock"]
            assert sum(fam["pairs"] for fam in sub["children"]) == sub["pairs"]

def test_group_detail_path_1_2_3_segments():
    data = [
        {"STORE": "101", "CODE": "SKU1", "NAME": "Cola 1L", "CATEGORY": "İçkilər", "SUB_CATEGORY": "Qazlı", "FAMILY": "Kola", "FC": 100, "SALE": 80, "FINAL_STOCK": 20},
        {"STORE": "102", "CODE": "SKU2", "NAME": "Fanta 1L", "CATEGORY": "İçkilər", "SUB_CATEGORY": "Qazlı", "FAMILY": "Qazlı Meyvə", "FC": 60, "SALE": 50, "FINAL_STOCK": 0},
        {"STORE": "101", "CODE": "SKU3", "NAME": "Alma Şirəsi", "CATEGORY": "İçkilər", "SUB_CATEGORY": "Şirə", "FAMILY": "Təbii Şirə", "FC": 40, "SALE": 30, "FINAL_STOCK": 10},
    ]
    df = pd.DataFrame(data)

    # 1. 1-segment path: Category only
    d1 = get_group_detail(df, dimension="category", path=["İçkilər"])
    assert len(d1["items"]) == 3

    # 2. 2-segment path: Category + Sub Category
    d2 = get_group_detail(df, dimension="category", path=["İçkilər", "Qazlı"])
    assert len(d2["items"]) == 2
    codes2 = [it["code"] for it in d2["items"]]
    assert "SKU1" in codes2 and "SKU2" in codes2

    # 3. 3-segment path: Category + Sub Category + Family
    d3 = get_group_detail(df, dimension="category", path=["İçkilər", "Qazlı", "Kola"])
    assert len(d3["items"]) == 1
    assert d3["items"][0]["code"] == "SKU1"

def test_legacy_archive_without_family_column():
    # DataFrame with NO FAMILY column at all
    df = pd.DataFrame([
        {"STORE": "101", "CODE": "SKU1", "NAME": "Item 1", "CATEGORY": "Cat1", "SUB_CATEGORY": "Sub1", "FC": 100, "SALE": 50, "FINAL_STOCK": 10},
        {"STORE": "102", "CODE": "SKU2", "NAME": "Item 2", "CATEGORY": "Cat1", "SUB_CATEGORY": "Sub2", "FC": 200, "SALE": 180, "FINAL_STOCK": 0},
    ])
    res = aggregate_by_group(df, dimension="category")
    assert res["totals"]["sale"] == 230.0
    root = res["nodes"][0]
    assert len(root["children"]) == 2
    sub1 = root["children"][0]
    # Children at level 2 is Təyin edilməyib
    assert len(sub1["children"]) == 1
    assert sub1["children"][0]["name"] == UNASSIGNED_LABEL

def test_area_remains_two_levels_invariant():
    data = [
        {"STORE": "101", "CODE": "SKU1", "NAME": "P1", "AREA": "Bakı", "SUB_AREA": "Nəsimi", "FC": 100, "SALE": 80, "FINAL_STOCK": 20},
        {"STORE": "102", "CODE": "SKU2", "NAME": "P2", "AREA": "Bakı", "SUB_AREA": "Nizami", "FC": 60, "SALE": 50, "FINAL_STOCK": 0},
    ]
    df = pd.DataFrame(data)
    res = aggregate_by_group(df, dimension="area")
    nodes = res["nodes"]

    assert len(nodes) == 1
    baku = nodes[0]
    assert baku["level"] == 0
    assert len(baku["children"]) == 2

    for sub in baku["children"]:
        assert sub["level"] == 1
        # Sub Area has NO children (children == [] and children_count == 0)
        assert sub["children"] == []
        assert sub["children_count"] == 0

def test_family_quality_warnings():
    df = pd.DataFrame([
        # Family filled without Sub
        {"STORE": "101", "CODE": "SKU1", "NAME": "P1", "CATEGORY": "Cat1", "SUB_CATEGORY": None, "FAMILY": "Fam1", "FC": 10, "SALE": 5, "FINAL_STOCK": 5},
        # Family filled without Category
        {"STORE": "101", "CODE": "SKU2", "NAME": "P2", "CATEGORY": None, "SUB_CATEGORY": "Sub1", "FAMILY": "Fam2", "FC": 10, "SALE": 5, "FINAL_STOCK": 5},
        # Product with 2 families
        {"STORE": "101", "CODE": "SKU3", "NAME": "P3", "CATEGORY": "Cat1", "SUB_CATEGORY": "Sub1", "FAMILY": "FamA", "FC": 10, "SALE": 5, "FINAL_STOCK": 5},
        {"STORE": "102", "CODE": "SKU3", "NAME": "P3", "CATEGORY": "Cat1", "SUB_CATEGORY": "Sub1", "FAMILY": "FamB", "FC": 10, "SALE": 5, "FINAL_STOCK": 5},
        # Merged family spellings: "FamA" vs "fama"
        {"STORE": "103", "CODE": "SKU4", "NAME": "P4", "CATEGORY": "Cat1", "SUB_CATEGORY": "Sub1", "FAMILY": "fama", "FC": 10, "SALE": 5, "FINAL_STOCK": 5},
    ])
    mapping = ColumnMapping(
        store_col="STORE",
        code_col="CODE",
        name_col="NAME",
        fc_col="FC",
        sale_col="SALE",
        stock_col="FINAL_STOCK",
        category_col="CATEGORY",
        sub_category_col="SUB_CATEGORY",
        family_col="FAMILY",
        daily_stock_cols=[]
    )
    report = analyze_data_quality(df, mapping)
    w_types = [w.type for w in report.warnings]

    assert "FAMILY_WITHOUT_SUBCATEGORY" in w_types
    assert "FAMILY_WITHOUT_CATEGORY" in w_types
    assert "MULTI_FAMILY_PRODUCT" in w_types
    assert "MERGED_FAMILY_NAMES" in w_types

def test_tree_performance_timing():
    import time
    n_rows = 10000
    np.random.seed(42)
    categories = [f"Category_{i}" for i in range(20)]
    sub_categories = [f"SubCategory_{i}" for i in range(50)]
    families = [f"Family_{i}" for i in range(100)]
    stores = [f"ST_{i}" for i in range(50)]
    skus = [f"SKU_{i}" for i in range(200)]

    df = pd.DataFrame({
        "STORE": np.random.choice(stores, n_rows),
        "CODE": np.random.choice(skus, n_rows),
        "NAME": "Test Product",
        "CATEGORY": np.random.choice(categories, n_rows),
        "SUB_CATEGORY": np.random.choice(sub_categories, n_rows),
        "FAMILY": np.random.choice(families, n_rows),
        "FC": np.random.uniform(10, 500, n_rows),
        "SALE": np.random.uniform(5, 450, n_rows),
        "FINAL_STOCK": np.random.uniform(0, 50, n_rows),
        "DISTRIBUTION_QTY": np.random.uniform(10, 500, n_rows),
    })

    t0 = time.time()
    res = aggregate_by_group(df, dimension="category")
    elapsed = time.time() - t0

    assert res["totals"]["pairs"] == n_rows
    assert len(res["nodes"]) == 20
    # Aggregation of 10,000 rows across 3 levels must be under 1.0s
    assert elapsed < 1.0, f"Expected < 1.0s, got {elapsed:.3f}s"


