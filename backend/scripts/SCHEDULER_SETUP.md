# Windows Task Scheduler (Gecə ETL Avtomatlaşdırılması) Təlimatı

Bu sənəddə `export_to_parquet.py` ETL skriptini hər gecə saat **02:00-da** avtomatik işə salmaq üçün Windows Task Scheduler tənzimləmələri verilmişdir.

---

## 🛠️ Üsul 1: Komanda Sətri (CLI) Vasitəsilə Qurulum (Tövsiyə Olunan)

Administrator hüquqları ilə Command Prompt (cmd) və ya PowerShell açın və aşağıdakı əmri icra edin:

```cmd
schtasks /create /tn "TamstoreParquetETL" /tr "py C:\Users\Khayal.Aliyev\.gemini\antigravity\scratch\tamstore-promo-intelligence\backend\scripts\export_to_parquet.py" /sc daily /st 02:00 /f
```

### Əmrin Sinovdən Keçirilməsi (Dərhal İcra):
Düzgün işlədiyini dərhal yoxlamaq üçün:
```cmd
schtasks /run /tn "TamstoreParquetETL"
```

---

## 🖥️ Üsul 2: Qrafik İnterfeys (GUI) Vasitəsilə Qurulum

1. Klaviaturada `Win + R` sıxın, `taskschd.msc` yazın və **Enter** düyməsinə basın.
2. Sağ tərəfdəki menudan **Create Basic Task...** (Əsas tapşırıq yarat) seçin.
3. **Name (Ad):** `TamstoreParquetETL` daxil edin.
4. **Trigger (Tətikləyici):** **Daily (Hər gün)** seçin və Başlama vaxtını **`02:00:00`** təyin edin.
5. **Action (Əməliyyat):** **Start a program (Proqramı işə sal)** seçin.
6. **Program/script:** `py` daxil edin.
7. **Add arguments (Arqumentlər):** `C:\Users\Khayal.Aliyev\.gemini\antigravity\scratch\tamstore-promo-intelligence\backend\scripts\export_to_parquet.py`
8. **Start in (İcra qovluğu):** `C:\Users\Khayal.Aliyev\.gemini\antigravity\scratch\tamstore-promo-intelligence\backend`
9. **Finish** düyməsini sıxaraq tamamlayın.

---

## 🌐 Üsul 3: Web API Vasitəsilə Əl ilə Yeniləmə (Manual Trigger)

Tətbiq işlək vəziyyətdə olarkən keşi istənilən vaxt API vasitəsilə yeniləmək mümkündür:

```bash
curl -X POST http://localhost:8000/api/admin/refresh-parquet-cache
```

Keş statusunu yoxlamaq üçün:
```bash
curl http://localhost:8000/api/admin/cache-status
```
