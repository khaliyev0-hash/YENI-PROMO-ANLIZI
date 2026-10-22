import os
from typing import Optional, Tuple, List

def _load_env_file():
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    env_paths = [
        os.path.join(project_root, ".env"),
        os.path.join(os.getcwd(), ".env")
    ]
    for env_path in env_paths:
        if os.path.exists(env_path):
            try:
                with open(env_path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            k, v = line.split("=", 1)
                            os.environ[k.strip()] = v.strip().strip("'\"")
            except Exception:
                pass

_load_env_file()
EXCEL_SOURCE_PATH = os.getenv("EXCEL_SOURCE_PATH", "TEST1.xlsx")
STORE_STATUS_INCLUDE_DEFAULT = "AKTIV"
STORE_TYPE_EXCLUDE_DEFAULT = "BLANK,MINI,REGION MINI"

def normalize_rule_token(val: Optional[str]) -> str:
    if val is None:
        return ""
    s = str(val).strip().upper()
    trans = str.maketrans({'İ': 'I', 'I': 'I', 'Ə': 'E', 'Ö': 'O', 'Ü': 'U', 'Ş': 'S', 'Ç': 'C', 'Ğ': 'G'})
    return s.translate(trans)

def get_store_filter_config(reload_env: bool = True) -> Tuple[List[str], List[str]]:
    if reload_env and os.getenv("DISABLE_ENV_FILE_OVERRIDE") != "1":
        _load_env_file()
    status_raw = os.getenv("STORE_STATUS_INCLUDE", STORE_STATUS_INCLUDE_DEFAULT)
    type_raw = os.getenv("STORE_TYPE_EXCLUDE", STORE_TYPE_EXCLUDE_DEFAULT)
    status_inc = [normalize_rule_token(x) for x in status_raw.split(",") if x.strip()]
    type_exc = [normalize_rule_token(x) for x in type_raw.split(",") if x.strip()]
    return status_inc, type_exc

from app.schemas import AppSettings

DEFAULT_SETTINGS = AppSettings()

# Dynamic Column Aliases Dictionary
COLUMN_ALIASES = {
    "STORE": [
        "STORE", "STORE ID", "STORE_ID", "MAGAZA", "MAGAZA KODU", "MAGAZA NO", 
        "STORE CODE", "MAGAZA_ID", "MAĞAZA", "MAĞAZA KODU", "MAĞAZA NO"
    ],
    "CODE": [
        "CODE", "SKU", "SKU CODE", "PRODUCT CODE", "PRODUCT_ID", "URUN KODU", 
        "MEHSUL KODU", "PRODUCT ID", "BARCODE", "KOD", "MƏHSUL KODU", "MEHSUL_KODU"
    ],
    "NAME": [
        "NAME", "PRODUCT NAME", "SKU NAME", "URUN ADI", "MEHSUL ADI", 
        "PRODUCT", "MEHSUL", "MƏHSUL ADI", "AD", "MEHSUL_ADI"
    ],
    "INSERT_NAME": [
        "INSERT_NAME", "INSERT NAME", "INSERT", "PROMO NAME", "KAMPANİYA ADI", "KAMPANIYA ADI"
    ],
    "PROMO_TYPE": [
        "TESIR/ADI", "TƏSİR/ADI", "TESIR ADI", "TƏSİR ADI", "TESIR_ADI", "TƏSİR_ADI",
        "PROMO_TYPE", "PROMO TYPE", "PROMO NÖVÜ", "PROMO NOVU", "TƏSİR", "TESIR",
        "TESHIR", "TEŞHİR", "PROMO_NOVU", "TIP", "TİP"
    ],
    "FC": [
        "FC", "FORECAST", "FORECAST QTY", "FORECAST QUANTITY", "PROMO FORECAST", 
        "PROGNOZ", "PROGNOZ QTY", "PROQNOZ", "PROQNOZ MIQDARI"
    ],
    "FC_MEBLEG": [
        "FC MEBLEG", "FC MƏBLƏĞ", "FC_MEBLEG", "FC_MƏBLƏĞ", "FC MEBLƏĞİ", "FC MEBLEGI",
        "FORECAST MEBLEG", "FORECAST MƏBLƏĞ", "FORECAST AMOUNT", "PROQNOZ MEBLEG", "PROQNOZ MƏBLƏĞİ",
        "FC AZN", "FORECAST AZN", "FC VAL", "PROQNOZ MEBLEGI", "FC AMOUNT"
    ],
    "START_DATE": [
        "START_DATE", "START DATE", "BAŞLAMA TARİXİ", "BAŞLAMA TARIXI", "BASLAMA TARIXI", "PROMO START",
        "START", "BAŞLANGIC TARİXİ", "BASLANGIC TARIXI", "BEG_DATE"
    ],
    "END_DATE": [
        "END_DATE", "END DATE", "BİTMƏ TARİXİ", "BITME TARIXI", "BİTMƏ TARIXI", "BITMƏ TARIXI", "PROMO END",
        "END", "BİTİŞ TARİXİ", "BITIS TARIXI", "END_DATE"
    ],
    "SALE": [
        "SALE", "SALES", "ACTUAL SALES", "ACTUAL", "SALES QTY", "SATIS", 
        "SATIŞ", "SATIS MIQDARI", "REAL SATIŞ"
    ],
    "STOCK": [
        "STOCK", "BALANCE", "REMAINING STOCK", "QALIQ STOK", "QALIQ", 
        "STOK", "SON STOK", "CURRENT STOCK"
    ],
    "DISTRIBUTION": [
        "DAĞILIM MİQDARI", "DAGILIM MIQDARI", "DAGILIM", "DAĞILIM", "DISTRIBUTION",
        "DISTRIBUTED QTY", "PUSH MIQDARI", "PUSH MİQDARI", "PAYLANAN MIQDAR",
        "PAYLANAN MƏHSUL", "GÖNDƏRİLƏN MİQDAR", "SEVK MIQDARI", "DEPO DAĞILIM"
    ],
    "ORDER_QTY": [
        "SİFARİŞ MİQDARI", "SIFARIS MIQDARI", "ORDER_QTY", "ORDER QTY", "SIFARIS", "SİFARİŞ"
    ],
    "FULFILLED_QTY": [
        "QARŞILANAN MİQDAR", "QARSILANAN MIQDAR", "FULFILLED_QTY", "ACCEPTED_QTY",
        "ACCEPTED QTY", "QEBUL EDILEN MIQDAR", "GƏLƏN MİQDAR"
    ],
    "SERVICE_LEVEL_PCT": [
        "TƏMİNAT %", "TEMINAT %", "TƏMİNAT FAİZİ", "SERVICE_LEVEL_PCT",
        "SERVICE LEVEL %", "SERVİS SƏVİYYƏSİ", "SERVIS SEVIYYESI", "SL %"
    ],
    "SUPPLIER": [
        "FIRMA", "FİRMA", "SUPPLIER", "TƏCHİZATÇI", "TEDARIKCI", "SATICI ADI", "SUPPLIER NAME"
    ],
    "REF": [
        "REF", "Ref", "ref", "ref_miqdari", "ref_miqdarı", "rəf", "ref miqdarı", "ref miqdari",
        "ana rəf", "ana ref", "ana_rəf", "ana_ref", "RƏF", "RƏF MİQDARI", "REF MİQDARI"
    ],
    "CATEGORY": [
        "CATEGORY", "KATEQORIYA", "KATEGORIYA", "KATEQORIYA ADI", "KATEQORIYA_ADI",
        "KATEGORIYA ADI", "CATEGORY NAME", "CATEGORY_NAME", "KAT"
    ],
    "SUB_CATEGORY": [
        "SUB KATEQORIYA", "SUB CATEGORY", "SUBKATEQORIYA", "ALT KATEQORIYA",
        "SUB_CATEGORY", "SUB_KATEQORIYA", "ALT_KATEQORIYA", "SUBCATEGORY",
        "SUB KATEGORIYA", "SUBKATEGORIYA", "ALT KATEGORIYA", "ALT_KATEGORIYA",
        "SUB-CATEGORY", "SUB-KATEQORIYA"
    ],
    "AREA": [
        "AREA", "BOLGE", "BÖLGƏ", "BÖLGE", "REGION", "ERAZI", "ƏRAZİ", "ERAZİ",
        "BÖLGƏ ADI", "BOLGE ADI", "BÖLGE ADI", "AREA NAME", "AREA_NAME", "REGION NAME"
    ],
    "SUB_AREA": [
        "SUB AREA", "SUBAREA", "ALT AREA", "SUB BOLGE", "SUB BÖLGƏ", "SUB REGION",
        "SUB_AREA", "SUB_BOLGE", "SUB_BÖLGƏ", "SUB_REGION", "SUB_ERAZI", "SUB_ƏRAZİ",
        "ALT BOLGE", "ALT BÖLGƏ", "ALT REGION", "ALT ERAZI", "ALT ƏRAZİ", "SUBAREA NAME"
    ],
    "FAMILY": [
        "FAMILY", "FAMILIYA", "AİLƏ", "AILE", "AILƏ", "MEHSUL FAMILY", "MƏHSUL FAMILY",
        "PRODUCT FAMILY", "FAMILY_NAME", "FAMILY NAME", "AİLE"
    ]
}
