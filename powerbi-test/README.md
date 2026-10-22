# Tamstore Promo Intelligence — Power BI Project (PBIP) Prototipi

Bu qovluqda `tamstore-promo-intelligence` platformasının **İcraçı Dashboard (Executive Dashboard)** modulunun Microsoft Power BI-ın yeni **PBIP (Power BI Project)** formatındakı sınaq prototipi yer alır.

---

## 📁 Qovluq Strukturu

- `TamstoreDashboard.pbip` — Power BI Desktop layihə giriş faylı.
- `TamstoreDashboard.Report/` — Vizual interfeys layout tənzimləmələri (`report.json` və `definition.pbir`).
- `TamstoreDashboard.SemanticModel/` — Data Model, SQL Server Power Query M bağlantıları və DAX hesablama ölçüləri (TMDL formatında).
  - `definition/expressions.tmdl` — M parametrləri (`ServerName`, `DatabaseName`, `PromoStartDate`, `PromoEndDate`).
  - `definition/tables/` — TMDL cədvəl faylları (`PromoFact`, `ItemMaster`, `StoreStock`, `_Measures`).

---

## 🚀 Layihəni Power BI Desktop-da Necə Açmalı?

1. Kompüterinizdə **Power BI Desktop** proqramını açın.
2. **File (Fayl)** → **Open (Aç)** → **Browse report (Hesabata baxın)** düyməsini sıxın.
3. `powerbi-test/TamstoreDashboard.pbip` faylını seçin.
4. İlk dəfə açıldıqda SQL Server (`cltmdb03`, `Ltamstore`) istifadəçi adı və şifrəsini daxil etməyiniz tələb oluna bilər.

---

## 📊 Uğurla Köçürülən və Köçürülməyən Hissələr

### ✅ Uğurla Köçürülən Hissələr (Executive Dashboard & Analytics):
- **SQL Server Bağlantısı:** `fnc_TS_SALES_REPORT_FOR_PLANNING` satış funksiyası və `vw_TS_ITEMS_DETAIL_FOR_PLANNING` master cədvəli ilə deduplikasiya olunmuş M skripti.
- **Dinamik DAX Ölçüləri:** `Total Forecast`, `Total Sale`, `Achievement %`, `Total Stock`, `Sell Through %`, `Stockout Count`, `Stockout Rate %`, `WAPE %`, `MAE`, `RMSE` və `Bias`.
- **Vizual Hesabat Layout-u:** 6 KPI kartı, Mağaza üzrə Satış vs Proqnoz çartı və Məhsul Performansı cədvəli.

### ❌ Power BI Təbiətinə Uyğun Olmadığı Üçün Köçürülməyən Modullar:
1. **İnteraktiv Excel Sütun Mapper və Drag-and-Drop Yükləmə:** Power BI statik data model strukturu üzərində işləyir.
2. **AI TamTam Mascot Pet Botu & ChatGPT/LLM Avtomatik Mətn Təhlili.**
3. **Sifariş Avtomatlaşdırılması & Push Qərar Generatoru.**
