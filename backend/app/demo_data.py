import io
import pandas as pd
import numpy as np

def generate_demo_excel(format_type: str = "B") -> bytes:
    """
    Generates synthetic demo Excel file buffer.
    Format A: STORE, CODE, NAME, FC, STOCK, SALE
    Format B: STORE, CODE, NAME, FC, SALE, STOCK 01.09.2026, STOCK 02.09.2026 ...
    """
    stores = [f"ST-{101 + i}" for i in range(10)]
    products = [
        ("101201", "BANAN PREMIUM"),
        ("101202", "ALMA QIRMIZI Local"),
        ("101203", "KƏRƏ YAĞI ANCHOR 82% 500G"),
        ("101204", "SÜD PAL SÜD 3.2% 1L"),
        ("101205", "ŞƏKƏR TOZU 1KG"),
        ("101206", "UN DƏNƏR 5KG"),
        ("101207", "ÇAY AZƏRÇAY 250G"),
        ("101208", "QATIQ MİLLİ 1KG"),
        ("101209", "QƏHVƏ NESCAFE GOLD 100G"),
        ("101210", "ŞOKOLAD ALPEN GOLD 90G"),
        ("101211", "KOLA COCA-COLA 1.5L"),
        ("101212", "SU SIRAB 1.5L"),
        ("101213", "PEÇENYE XIRDALAN 300G"),
        ("101214", "MAKARON ANKARA 500G"),
        ("101215", "DÜYÜ BASMATI 1KG"),
        ("101216", "YUMURTA TƏZƏ 30-LUQ"),
        ("101217", "TOMAT PASTASI 800G"),
        ("101218", "XAMA MİLLİ 20% 400G"),
        ("101219", "DONDURMA MAGNUM 100G"),
        ("101220", "KAĞIZ DƏSMAL SELPAK 4-LÜ"),
        ("101221", "ŞAMPUN PANTENE 400ML"),
        ("101222", "SABUN DOVE 100G"),
        ("101223", "DİŞ MƏCUNU COLGATE 100ML"),
        ("101224", "YAŞIL ZEYTUN 500G"),
        ("101225", "QARA ZEYTUN 500G"),
        ("101226", "PENDİR İVANHOE 400G"),
        ("101227", "SOSİS HALAL 500G"),
        ("101228", "KOLBASA DƏNİZ 400G"),
        ("101229", "TOYUQ FİLESİ 1KG"),
        ("101230", "BALIQ KONSERVİ 200G"),
        ("101231", "BİSKVİT OREO 150G"),
        ("101232", "ÇİPSİ LAYS 140G"),
        ("101233", "ŞİRƏ MEYVƏLİ JUICY 1L"),
        ("101234", "ENERJİ İÇKİSİ RED BULL 250ML"),
        ("101235", "CİNS UŞAQ DƏSMALI 80-Lİ"),
        ("101236", "YUYUCU TOZ ARIEL 3KG"),
        ("101237", "QAB YUYAN MAYE FAIRY 800ML"),
        ("101238", "SİRKE ALMA 500ML"),
        ("101239", "DURUM YAĞI AZƏRSUN 1L"),
        ("101240", "ZEYTUN YAĞI BORGES 500ML"),
        ("101241", "BAL TƏBİİ 500G"),
        ("101242", "MÜRƏBBƏ QAZAX 400G"),
        ("101243", "QOZ LƏPƏSİ 200G"),
        ("101244", "FINDIQ LƏPƏSİ 200G"),
        ("101245", "KİŞMİŞ SARI 250G"),
        ("101246", "QURUDULMUŞ ƏRİK 250G"),
        ("101247", "SUXARİ ÇÖRƏK 200G"),
        ("101248", "MAYONEZ CALVE 400G"),
        ("101249", "KETÇUP HEINZ 450G"),
        ("101250", "XARDAL DƏNƏLİ 150G")
    ]

    rows = []
    np.random.seed(42)

    for st in stores:
        for code, name in products:
            fc = int(np.random.choice([30, 50, 80, 100, 150, 200]))
            
            # Scenario types: 1=Stockout (High sales, 0 stock), 2=Over-forecast (Low sales, high stock), 3=Healthy
            scenario = np.random.choice([1, 2, 3], p=[0.25, 0.25, 0.50])
            
            if scenario == 1: # Stockout scenario
                sale = int(fc * np.random.uniform(0.6, 0.9))
                final_stock = 0
            elif scenario == 2: # Excess stock scenario
                sale = int(fc * np.random.uniform(0.1, 0.4))
                final_stock = int(fc * np.random.uniform(0.5, 0.9))
            else: # Healthy / Overperforming
                sale = int(fc * np.random.uniform(0.85, 1.25))
                final_stock = int(fc * np.random.uniform(0.1, 0.3))

            if format_type.upper() == "A":
                rows.append({
                    "MAGAZA KODU": st,
                    "MEHSUL KODU": code,
                    "MEHSUL ADI": name,
                    "PROGNOZ": fc,
                    "QALIQ STOK": final_stock,
                    "SATIŞ": sale
                })
            else:
                # Format B: Daily dynamic stock columns from 01.09.2026 to 07.09.2026
                # Create a depletion path starting from opening stock down to final_stock
                opening_stock = sale + final_stock
                dates = [
                    "STOCK 01.09.2026", "STOCK 02.09.2026", "STOCK 03.09.2026",
                    "STOCK 04.09.2026", "STOCK 05.09.2026", "STOCK 06.09.2026", "STOCK 07.09.2026"
                ]
                
                stock_path = []
                curr = float(opening_stock)
                step = (opening_stock - final_stock) / 6.0
                for d_idx in range(7):
                    if d_idx == 6:
                        stock_path.append(max(final_stock, 0))
                    else:
                        val = max(int(round(curr)), 0)
                        if final_stock == 0 and d_idx >= 4:
                            val = 0 # stockout early
                        stock_path.append(val)
                        curr -= step

                row_dict = {
                    "MAGAZA KODU": st,
                    "MEHSUL KODU": code,
                    "MEHSUL ADI": name,
                    "PROGNOZ": fc,
                    "SATIŞ": sale
                }
                for d_col, d_val in zip(dates, stock_path):
                    row_dict[d_col] = d_val

                rows.append(row_dict)

    df = pd.DataFrame(rows)
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name="PROMO_DATA")
    buffer.seek(0)
    return buffer.getvalue()
