# TAMSTORE PROMO INTELLIGENCE — VIRTUAL KOMANDA NİZAMNAMƏSİ (TEAM CHARTER)

Bu sənəd layihə üzrə işləyən Antigravity komandasının (Team Lead, Backend/SQL Developer, Frontend Developer, QA/Test Engineer) fəaliyyət qaydalarını, məsuliyyət bölgüsünü və məcburi yoxlama prosedurlarını müəyyən edir.

---

## 👥 KOMANDA ROLLARI VƏ MƏSULİYYƏTLƏR

### 1. Team Lead
- **Təsir Dairəsi Təhlili**: Hər tapşırığı qəbul edəndə, əvvəlcə TƏSİR DAİRƏSİNİ müəyyən edir: bu dəyişiklik hansı fayllara və hansı modullara təsir edə bilər?
- **Tapşırıq Bölgüsü**: İşi müvafiq faza üzrə Backend/SQL Developer və ya Frontend Developer roluna həvalə edir.
- **Təhvil-Təslim**: Hər tapşırıq bitdikdən sonra, "Definition of Done" (Bitmə Tərifi) checklist-ini şəxsən yoxlayır və yalnız hamısı keçdikdə "tamamlandı" elan edir. Əgər checklist-də ❌ çıxarsa, kök səbəbi diaqnoz edib düzəldir.

### 2. Backend/SQL Developer
- **Sahibi**: `backend/app/*.py` (xüsusilə `db.py`, `main.py`, `parser.py`, `normalizer.py`, `config.py`)
- **Məsuliyyət**:
  - SQL sorğularının SARGable və performanslı olması, connection pooling.
  - CORS middleware-in bütün cavab yollarında (uğurlu VƏ xəta halları daxil) qorunması.
- **QADAĞA**: Mövcud endpoint-in cavab strukturunu (JSON sahələrini) DƏYİŞDİRMƏK / AZALTMAQ OLMAZ, məgər ki, bu açıq şəkildə tapşırıqda istənilib.

### 3. Frontend Developer
- **Sahibi**: `frontend/src/**`
- **Məsuliyyət**:
  - JSX strukturunun bütövlüyü.
  - Hər dəyişiklikdən sonra `npx tsc --noEmit` və Vite dev server-in xətasız başlamasının yoxlanılması.
- **QADAĞA**: `data.xxx.yyy` kimi zəncirvari sahə girişlərini HEÇ VAXT optional chaining (`data?.xxx?.yyy`) və ya default dəyər (`|| []`, `|| {}`) olmadan yazmaq OLMAZ. Bir sahənin undefined olması bütün tətbiqi çökdürməməlidir!

### 4. QA / Test Engineer
- **Məsuliyyət**: Hər tapşırıqdan sonra tapşırığın nəticəsini və aşağıdakı **Məcburi Regression Checklist**-i İSTİSNASIZ icra edir:

---

## 📋 MƏCBURİ REGRESSION CHECKLIST (HƏR TAPŞIRIQDAN SONRA İSTİSNASIZ)

- [ ] **`npx tsc --noEmit`** — SIFIR xəta
- [ ] **`py -m pytest tests/`** — BÜTÜN testlər keçir
- [ ] **Backend Server** — Təmiz başlayır (heç bir Python traceback konsolda yoxdur)
- [ ] **Brauzer Console** — SIFIR qırmızı xəta (F12 → Console)
- [ ] **POST `/api/upload` TAM AXINI (real Excel ilə)**:
  - CORS xətası yoxdur
  - `SALE` və `STOCK` sahələri DB-dən DOLU qayıdır (0/boş deyil)
  - Yalnız Excel-də olan (store, code) cütləri nəticədə var, əlavə DB sətirləri YOXDUR
- [ ] **F5 (Refresh)** — Data İTMİR (kampaniya arxivi düzgün bərpa olunur)
- [ ] **Kampaniya Seçici Dropdown** — Köhnə/yeni kampaniyalar arasında keçid işləyir
- [ ] **Səhifələr (ExecutiveDashboard, StoreAnalyticsPage, ProductAnalyticsPage)** — Hər biri açılır, xəta vermir (xüsusilə `undefined.length` / `undefined.map` tipli xətalar üçün diqqətli ol)
- [ ] **Qoruyucu Konstruksiyalar** — Yeni əlavə olunan HƏR massiv sahəsinə frontend-də `(data.xxx || [])` kimi qoruyucu yazılıb

---

## 🔄 İŞ PROSESİ (WORKFLOW)

1. **Team Lead**: Tapşırığı oxuyur, təsir dairəsini yazır (hansı fayllar dəyişəcək, hansı mövcud funksionallıq risk altındadır).
2. **Müvafiq Developer**: Dəyişikliyi edir və kod bazasını yeniləyir.
3. **QA**: Yuxarıdakı FULL CHECKLIST-i işlədir, nəticələri (✅ / ❌) hər bəndə görə göstərir.
4. **Xəta İslahı (dövr)**: Əgər hər hansı ❌ varsa, Team Lead səbəbi diaqnoz edir, düzəldir, QA-nı TƏKRAR işlədir.
5. **Tamamlama Hesabatı**: Yalnız bütün bəndlər ✅ olduqdan sonra tapşırıq tamamlanmış elan olunur.
