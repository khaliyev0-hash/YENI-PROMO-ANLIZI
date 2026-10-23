import React, { useState, useEffect } from 'react';
import {
  Upload, FileSpreadsheet, Play, CheckCircle2, AlertTriangle, AlertOctagon,
  Download, RefreshCw, Calendar, Clock, Layers, Filter, Search, ArrowRight,
  Database, ShieldCheck, Check, ChevronRight, BarChart3, Package, Store, Eye,
  Building2, Hash, FileDown, Info, Lock, Unlock
} from 'lucide-react';
import {
  isForecastingUnlocked,
  lockForecasting,
  ForecastingPasswordModal
} from '../components/common/ForecastingPasswordModal';

interface ImportedRow {
  row_number: number;
  store_code: string;
  product_code: string;
  product_name: string;
  shelf_capacity: number;
}

interface RejectedRow {
  row_number: number;
  raw_store_code?: string;
  raw_product_code?: string;
  raw_product_name?: string;
  raw_shelf_capacity?: string;
  rejection_reason: string;
}

interface ImportPreviewData {
  filename: string;
  total_rows: number;
  valid_count: number;
  rejected_count: number;
  duplicate_count: number;
  distinct_stores: number;
  distinct_products: number;
  preview_rows: ImportedRow[];
  rejected_rows_sample: RejectedRow[];
}

interface PlanningRunMeta {
  id: string;
  title: string;
  status: string;
  created_at: string;
  start_date: string;
  end_date: string;
  duration_days: number;
  store_count: number;
  product_count: number;
  total_forecast_demand: number;
  total_recommended_order_units: number;
  total_recommended_cases: number;
  warning_count: number;
  exception_count: number;
  version: string;
  confirmation_status: string;
}

const API_BASE = 'http://localhost:8000/api';

export const PromoDistributionPage: React.FC = () => {
  const [isUnlocked, setIsUnlocked] = useState<boolean>(isForecastingUnlocked);
  const [showPasswordModal, setShowPasswordModal] = useState<boolean>(false);
  const [activeSubTab, setActiveSubTab] = useState<'new_planning' | 'results' | 'history'>('new_planning');

  // Source DB Status
  const [dbStatus, setDbStatus] = useState<{ status: string; server?: string; database?: string } | null>(null);

  // File Upload & Preview State
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [previewData, setPreviewData] = useState<ImportPreviewData | null>(null);

  // Planning Configuration
  const [campaignTitle, setCampaignTitle] = useState<string>('Promo Planlaşdırma');
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [durationDays, setDurationDays] = useState<number>(7);
  const [targetEndingStock, setTargetEndingStock] = useState<number>(0);
  const [promoUpliftPct, setPromoUpliftPct] = useState<number>(30); // Default +30% recommendation
  const [stockoutCorrection, setStockoutCorrection] = useState<boolean>(false); // Deactivated by default: SQL lacks daily historical stock
  const [includeYoYHistory, setIncludeYoYHistory] = useState<boolean>(true); // Past years from fnc_TS_SALES_REPORT_FOR_PLANNING_UNION
  const [yoyWeight, setYoyWeight] = useState<number>(0.30); // 30% weight to YoY historical demand
  const [yoyYearsBack, setYoyYearsBack] = useState<number>(1); // 1 year back (2025)

  // Execution State
  const [calculating, setCalculating] = useState<boolean>(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  // Results State
  const [resultsData, setResultsData] = useState<any | null>(null);
  const [resultsTab, setResultsTab] = useState<'orders' | 'stores' | 'skus' | 'exceptions'>('orders');
  const [filterStore, setFilterStore] = useState<string>('');
  const [filterWarning, setFilterWarning] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);

  // History State
  const [historyRuns, setHistoryRuns] = useState<PlanningRunMeta[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);

  // Calculated End Date
  const calculateEndDate = (start: string, duration: number) => {
    try {
      const dt = new Date(start);
      dt.setDate(dt.getDate() + duration - 1);
      return dt.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };
  const endDate = calculateEndDate(startDate, durationDays);

  // Check DB status on mount
  useEffect(() => {
    fetch(`${API_BASE}/source/status`)
      .then((res) => res.json())
      .then((data) => setDbStatus(data))
      .catch(() => setDbStatus({ status: 'offline' }));

    loadHistoryRuns();
  }, []);

  const loadHistoryRuns = () => {
    setHistoryLoading(true);
    fetch(`${API_BASE}/planning-runs`)
      .then((res) => res.json())
      .then((data) => {
        setHistoryRuns(data.runs || []);
        setHistoryLoading(false);
      })
      .catch(() => setHistoryLoading(false));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadFile(file);
    setPreviewLoading(true);
    setPreviewData(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_BASE}/import/preview`, {
        method: 'POST',
        body: formData
      });
      if (!res.ok) {
        const err = await res.json();
        alert(`Xəta: ${err.detail || 'Fayl emal edilə bilmədi'}`);
        setPreviewLoading(false);
        return;
      }
      const data: ImportPreviewData = await res.json();
      setPreviewData(data);
    } catch (err: any) {
      alert(`Xəta baş verdi: ${err.message}`);
    } finally {
      setPreviewLoading(false);
    }
  };

  const downloadRejectedExcel = async () => {
    if (!uploadFile) return;
    const formData = new FormData();
    formData.append('file', uploadFile);

    try {
      const res = await fetch(`${API_BASE}/import/download-rejected`, {
        method: 'POST',
        body: formData
      });
      if (!res.ok) {
        alert('Rədd edilmiş sətrlər tapılmadı');
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'rejected_rows.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err: any) {
      alert(`Endirmə xətası: ${err.message}`);
    }
  };

  const startCalculation = async () => {
    if (!previewData || previewData.preview_rows.length === 0) {
      alert('Planlaşdırma üçün etibarlı məlumat tapılmadı.');
      return;
    }

    setCalculating(true);
    const payload = {
      title: campaignTitle,
      start_date: startDate,
      duration_days: durationDays,
      target_ending_stock: targetEndingStock,
      include_incoming_stock: false,
      history_days: 30,
      stockout_correction: stockoutCorrection,
      promo_uplift_pct: promoUpliftPct,
      include_yoy_history: includeYoYHistory,
      yoy_weight: yoyWeight,
      yoy_years_back: yoyYearsBack,
      rows: previewData.preview_rows
    };

    try {
      const res = await fetch(`${API_BASE}/planning-runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        alert(`Hesablama xətası: ${err.detail || 'Naməlum xəta'}`);
        setCalculating(false);
        return;
      }

      const runResp = await res.json();
      setActiveRunId(runResp.run_id);
      await loadRunResults(runResp.run_id);
      setActiveSubTab('results');
      loadHistoryRuns();
    } catch (err: any) {
      alert(`Sorğu zamanı xəta: ${err.message}`);
    } finally {
      setCalculating(false);
    }
  };

  const loadRunResults = async (runId: string, page = 1) => {
    setCurrentPage(page);
    let url = `${API_BASE}/planning-runs/${runId}/results?page=${page}&page_size=50`;
    if (filterStore) url += `&store=${encodeURIComponent(filterStore)}`;
    if (filterWarning && filterWarning !== 'ALL') url += `&warning_status=${encodeURIComponent(filterWarning)}`;
    if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Nəticələri yükləmək mümkün olmadı');
      const data = await res.json();
      setResultsData(data);
      setActiveRunId(runId);
    } catch (err: any) {
      alert(`Nəticə xətası: ${err.message}`);
    }
  };

  const exportExcelReport = (runId: string) => {
    window.open(`${API_BASE}/planning-runs/${runId}/export`, '_blank');
  };

  if (!isUnlocked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[65vh] p-6 text-center animate-in fade-in duration-300">
        <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center shadow-xl shadow-amber-500/10 mb-4 animate-pulse">
          <Lock className="w-8 h-8 stroke-[2.2]" />
        </div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white">Modul Kilidlidir</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
          Bu modula giriş məhdudlaşdırılıb. Davam etmək üçün təhlükəsizlik şifrəsini daxil edin.
        </p>
        <button
          onClick={() => setShowPasswordModal(true)}
          className="mt-5 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-blue-500/25 transition-all flex items-center space-x-2"
        >
          <Lock className="w-4 h-4" />
          <span>Şifrə ilə Giriş Et</span>
        </button>

        <ForecastingPasswordModal
          isOpen={showPasswordModal}
          onClose={() => setShowPasswordModal(false)}
          onSuccess={() => setIsUnlocked(true)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header & DB Connection Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              Retail Optimization Core
            </span>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">
              Forecasting & Promo Paylama Sistemi
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Excel şablonundan rəf tutumunu götürən, SQL Server-dən faktiki stok və satışı oxuyan, blokaj qaydalarını və qablaşdırma vahidlərini optimizasiya edən sistem.
          </p>
        </div>

        {/* Database Status & Lock Indicator */}
        <div className="flex items-center space-x-3 shrink-0">
          <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
            dbStatus?.status === 'connected'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
          }`}>
            <Database className="w-4 h-4" />
            <span>
              {dbStatus?.status === 'connected' ? `SQL Server: ${dbStatus.server} (${dbStatus.database})` : 'SQL Server Əlaqəsi Yoxdur'}
            </span>
            {dbStatus?.status === 'connected' && <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />}
          </div>

          <button
            onClick={() => {
              lockForecasting();
              setIsUnlocked(false);
            }}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold transition-colors cursor-pointer"
            title="Modulu təkrar kilidlə"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Kilidlə</span>
          </button>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex space-x-2 border-b border-slate-200 dark:border-slate-800 pb-1">
        <button
          onClick={() => setActiveSubTab('new_planning')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === 'new_planning'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>Yeni Planlaşdırma (Wizard)</span>
        </button>

        <button
          onClick={() => {
            if (activeRunId) {
              setActiveSubTab('results');
            } else if (historyRuns.length > 0) {
              loadRunResults(historyRuns[0].id);
              setActiveSubTab('results');
            } else {
              alert('Əvvəlcə planlaşdırma icra edin və ya tarixçədən seçin.');
            }
          }}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === 'results'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Nəticələr və Paylama {activeRunId ? `(#${activeRunId.slice(-6)})` : ''}</span>
        </button>

        <button
          onClick={() => {
            loadHistoryRuns();
            setActiveSubTab('history');
          }}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === 'history'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Planlaşdırma Tarixçəsi ({historyRuns.length})</span>
        </button>
      </div>

      {/* -------------------------------------------------------------------------------- */}
      {/* SUBTAB 1: NEW PLANNING WIZARD */}
      {/* -------------------------------------------------------------------------------- */}
      {activeSubTab === 'new_planning' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Excel Upload & Rules */}
          <div className="lg:col-span-1 space-y-6">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                <span>1. Excel Şablonunu Yükləyin</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Faylda yalnız 4 biznes sütunu olmalıdır: <span className="font-semibold text-slate-700 dark:text-slate-300">StoreCode, ProductCode, ProductName, ShelfCapacity</span>.
              </p>

              {/* Upload Dropzone */}
              <div className="mt-4 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 rounded-xl p-6 text-center cursor-pointer transition-all bg-slate-50/50 dark:bg-slate-950/40">
                <input
                  type="file"
                  id="excel_upload_input"
                  accept=".xlsx, .xls"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label htmlFor="excel_upload_input" className="cursor-pointer flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 flex items-center justify-center mb-3">
                    <Upload className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {uploadFile ? uploadFile.name : 'Excel faylını seçin və ya buraya sürükləyin'}
                  </span>
                  <span className="text-[11px] text-slate-400 mt-1">.xlsx və ya .xls formatı (Maks. 25 MB)</span>
                </label>
              </div>

              {previewLoading && (
                <div className="mt-3 flex items-center justify-center space-x-2 text-xs text-blue-600 font-semibold py-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Şablon yoxlanılır və emal edilir...</span>
                </div>
              )}

              {/* Validation Summary Card */}
              {previewData && (
                <div className="mt-4 p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                  <div className="flex justify-between items-center font-bold">
                    <span>Yoxlama Nəticəsi:</span>
                    <span className="text-emerald-600 dark:text-emerald-400">{previewData.valid_count} Düzgün Sətr</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-400 pt-1">
                    <div>Ümumi Sətr: <strong className="text-slate-900 dark:text-white">{previewData.total_rows}</strong></div>
                    <div>Mağaza Sayı: <strong className="text-slate-900 dark:text-white">{previewData.distinct_stores}</strong></div>
                    <div>Məhsul Sayı: <strong className="text-slate-900 dark:text-white">{previewData.distinct_products}</strong></div>
                    <div>Təkrarlar: <strong className="text-amber-600">{previewData.duplicate_count}</strong></div>
                  </div>

                  {previewData.rejected_count > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                      <span className="text-rose-600 font-bold">{previewData.rejected_count} Rədd Edilmiş Sətr</span>
                      <button
                        onClick={downloadRejectedExcel}
                        className="px-2 py-1 rounded-md text-[10px] font-bold bg-rose-100 text-rose-700 hover:bg-rose-200 flex items-center space-x-1"
                      >
                        <Download className="w-3 h-3" />
                        <span>Səhvləri Endir</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Business Rules Summary Card */}
            <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40 text-xs text-amber-900 dark:text-amber-200 space-y-2">
              <div className="flex items-center space-x-2 font-bold">
                <Info className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Mütləq Tətbiq Edilən Biznes Qaydaları:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-800 dark:text-amber-300">
                <li><strong>Təchizatçı Blokajı:</strong> Yalnız <code className="bg-amber-100 dark:bg-amber-900/60 px-1 py-0.5 rounded">Tip 41 + BELI</code> olanlar çıxarılır. Digər tiplər (40, 42, 44) və 41 + XEYR nəzərə alınır.</li>
                <li><strong>Stok Deduplikasiyası:</strong> Eyni mağaza-məhsulun stoku təchizatçılar üzrə təkrarlanır, toplanmır (SUM edilmir).</li>
                <li><strong>Satış Hesablaması:</strong> <code className="bg-amber-100 dark:bg-amber-900/60 px-1 py-0.5 rounded">MIQDARI</code> xalis satışdır, avtomatik toplanaraq double-counting edilmir.</li>
                <li><strong>Qablaşdırma:</strong> Qutu və Blok miqdarlarına görə dəqiq yuvarlaqlaşdırma aparılır.</li>
              </ul>
            </div>
          </div>

          {/* Right Column: Parameters & Preview Table */}
          <div className="lg:col-span-2 space-y-6">
            {/* Parameters Card */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                <span>2. Kampaniya Parametrləri və Müddət</span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Kampaniya Adı</label>
                  <input
                    type="text"
                    value={campaignTitle}
                    onChange={(e) => setCampaignTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Başlanğıc Tarixi</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Promo Müddəti (Gün)</label>
                  <div className="flex space-x-1.5">
                    {[7, 10, 14, 21].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDurationDays(d)}
                        className={`flex-1 py-1.5 rounded-lg font-bold transition-all ${
                          durationDays === d
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                        }`}
                      >
                        {d} gün
                      </button>
                    ))}
                    <input
                      type="number"
                      min={1}
                      max={90}
                      value={durationDays}
                      onChange={(e) => setDurationDays(parseInt(e.target.value) || 1)}
                      className="w-16 px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-center font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Hesablanan Bitiş Tarixi</label>
                  <div className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 font-bold text-slate-800 dark:text-slate-200">
                    {endDate} <span className="text-[11px] font-normal text-slate-500">({durationDays} tam gün daxil olmaqla)</span>
                  </div>
                </div>
              </div>

              {/* Advanced Optimization Parameters */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3.5 text-xs">
                {/* 1. Promo Uplift Section */}
                <div className="p-3.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40">
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                      <span>🚀 Promo Uplift (Gözlənilən Tələb Artımı):</span>
                      <span className="text-blue-600 dark:text-blue-400 font-extrabold text-sm">+{promoUpliftPct}%</span>
                    </label>
                    <span className="text-[11px] text-slate-500">Endirim/Kataloq təsiri</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                    Kampaniya dövründə endirim və reklam nəticəsində normal günlərin satışına nisbətən gözlənilən tələbat artımı.
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[0, 15, 30, 50, 100].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setPromoUpliftPct(pct)}
                        className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                          promoUpliftPct === pct
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:border-blue-400'
                        }`}
                      >
                        {pct === 0 ? '0% (Yoxdur)' : pct === 30 ? '+30% (Tövsiyə)' : `+${pct}%`}
                      </button>
                    ))}
                    <div className="flex items-center space-x-1 pl-1">
                      <input
                        type="number"
                        min={0}
                        max={500}
                        value={promoUpliftPct}
                        onChange={(e) => setPromoUpliftPct(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-16 px-2 py-1 text-center font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                      />
                      <span className="font-bold text-slate-500">%</span>
                    </div>
                  </div>
                </div>

                {/* 2. Stockout Correction & Target Ending Stock Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                    <div className="flex items-start space-x-2.5">
                      <input
                        type="checkbox"
                        id="stockout_corr_chk"
                        checked={stockoutCorrection}
                        onChange={(e) => setStockoutCorrection(e.target.checked)}
                        className="w-4 h-4 mt-0.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <div>
                        <label htmlFor="stockout_corr_chk" className="text-slate-800 dark:text-slate-200 font-bold cursor-pointer block">
                          🛡️ Tarixi Stoksuzluq Düzəlişi (Deaktiv - Təhlükəsiz Rejim)
                        </label>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          SQL Server-də yalnız hazırkı anbar qalığı mövcuddur (30 günlük stok tarixçəsi yoxdur). Süni şişirtmənin qarşısını almaq üçün tələbat bütün 30 təqvim gününə bölünür (ADS30).
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                      Hədəf Bitiş Stoku (Target Ending Stock)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={targetEndingStock}
                      onChange={(e) => setTargetEndingStock(parseFloat(e.target.value) || 0)}
                      placeholder="0 (Konfiqurasiya edilməyibsə 0 qalır)"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    />
                    <span className="text-[10px] text-slate-400">Kampaniya bitəndə rəfdə qalması arzulanan ehtiyat.</span>
                  </div>
                </div>

                {/* 3. YoY Historical Seasonality from fnc_TS_SALES_REPORT_FOR_PLANNING_UNION */}
                <div className="p-3.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="yoy_history_chk"
                        checked={includeYoYHistory}
                        onChange={(e) => setIncludeYoYHistory(e.target.checked)}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <label htmlFor="yoy_history_chk" className="font-bold text-slate-800 dark:text-slate-200 cursor-pointer flex items-center space-x-1.5">
                        <span>📅 Keçən İlin Eyni Həftəsi ilə Müqayisə (YoY Mövsümilik):</span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-extrabold text-sm">{Math.round(yoyWeight * 100)}% çəki</span>
                      </label>
                    </div>
                    <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/40 px-2 py-0.5 rounded-md self-start sm:self-auto">
                      fnc_TS_SALES_REPORT_FOR_PLANNING_UNION
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2 sm:pl-6">
                    {yoyYearsBack} il əvvəlki eyni təqvim həftəsinin (52 həftə əvvəl, bazar-şənbə) real və promo satışlarını oxuyur və cari trendlə balanslaşdırır.
                  </p>
                  {includeYoYHistory && (
                    <div className="sm:pl-6 flex flex-wrap items-center gap-2 pt-1">
                      <span className="text-slate-600 dark:text-slate-400 font-semibold text-[11px]">Tarixi Çəki:</span>
                      {[
                        { label: '10% Yüngül', val: 0.10 },
                        { label: '30% Balanslı (Tövsiyə)', val: 0.30 },
                        { label: '50% Bərabər Pay', val: 0.50 }
                      ].map((item) => (
                        <button
                          key={item.val}
                          type="button"
                          onClick={() => setYoyWeight(item.val)}
                          className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                            yoyWeight === item.val
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:border-indigo-400'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}

                      <div className="flex items-center space-x-1.5 pl-3 border-l border-indigo-200 dark:border-indigo-800">
                        <span className="text-slate-500 text-[11px]">Müqayisə ili:</span>
                        <select
                          value={yoyYearsBack}
                          onChange={(e) => setYoyYearsBack(parseInt(e.target.value) || 1)}
                          className="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold text-xs"
                        >
                          <option value={1}>1 İl Əvvəl (2025)</option>
                          <option value={2}>2 İl Əvvəl (2024)</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Start Calculation Button */}
              <div className="pt-3">
                <button
                  onClick={startCalculation}
                  disabled={calculating || !previewData || previewData.valid_count === 0}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm shadow-md shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 transition-all cursor-pointer"
                >
                  {calculating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>SQL Server Sorğulanır və Sifarişlər Hesablanır...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-white" />
                      <span>Hesablamanı Başlat və Nəticələri Gör</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Preview Table Card */}
            {previewData && (
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    İdxal Önbaxışı (İlk 50 sətr göstərilir)
                  </h3>
                  <span className="text-[11px] text-slate-500">Ümumi: {previewData.valid_count} sətr</span>
                </div>

                <div className="overflow-x-auto max-h-72 border border-slate-200 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 sticky top-0">
                      <tr>
                        <th className="py-2 px-3 font-bold">#</th>
                        <th className="py-2 px-3 font-bold">StoreCode</th>
                        <th className="py-2 px-3 font-bold">ProductCode</th>
                        <th className="py-2 px-3 font-bold">ProductName</th>
                        <th className="py-2 px-3 font-bold text-right">ShelfCapacity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {previewData.preview_rows.map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="py-1.5 px-3 text-slate-400">{r.row_number}</td>
                          <td className="py-1.5 px-3 font-mono font-bold text-blue-600">{r.store_code}</td>
                          <td className="py-1.5 px-3 font-mono">{r.product_code}</td>
                          <td className="py-1.5 px-3 truncate max-w-xs">{r.product_name}</td>
                          <td className="py-1.5 px-3 text-right font-bold">{r.shelf_capacity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------------------- */}
      {/* SUBTAB 2: RESULTS EXPLORER & EXPORT */}
      {/* -------------------------------------------------------------------------------- */}
      {activeSubTab === 'results' && resultsData && (
        <div className="space-y-6">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-slate-400">Mağaza Sayı</span>
              <p className="text-xl font-black text-slate-900 dark:text-white mt-1">{resultsData.summary?.store_count}</p>
            </div>
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-slate-400">Məhsul Sayı</span>
              <p className="text-xl font-black text-slate-900 dark:text-white mt-1">{resultsData.summary?.product_count}</p>
            </div>
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-slate-400">Ümumi Proqnoz</span>
              <p className="text-xl font-black text-blue-600 dark:text-blue-400 mt-1">{resultsData.summary?.total_forecast_demand}</p>
            </div>
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-slate-400">Tövsiyə Sifariş (Ədəd)</span>
              <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{resultsData.summary?.total_recommended_order_units}</p>
            </div>
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-slate-400">Tövsiyə Qutu</span>
              <p className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{resultsData.summary?.total_recommended_cases}</p>
            </div>
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
              <span className="text-[10px] font-bold uppercase text-slate-400">Xəbərdarlıqlar</span>
              <p className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1">{resultsData.summary?.warning_count}</p>
            </div>
          </div>

          {/* Results Action Bar & Excel Export */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            {/* Inner Subtabs (Orders, Stores, SKUs, Exceptions) */}
            <div className="flex space-x-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
              <button
                onClick={() => setResultsTab('orders')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  resultsTab === 'orders' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Store_SKU_Orders ({resultsData.total_items})
              </button>
              <button
                onClick={() => setResultsTab('stores')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  resultsTab === 'stores' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Store_Summary ({resultsData.store_summary?.length})
              </button>
              <button
                onClick={() => setResultsTab('skus')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  resultsTab === 'skus' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                SKU_Summary ({resultsData.sku_summary?.length})
              </button>
            </div>

            {/* Active Parameters Indicators & 6-Sheet Excel Export Button */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-bold text-xs flex items-center space-x-1">
                <span>🚀 Uplift:</span>
                <span className="font-extrabold">+{resultsData.summary?.promo_uplift_pct ?? 0}%</span>
              </span>
              <span className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center space-x-1">
                <span>🛡️ Stoksuzluq:</span>
                <span className="font-extrabold text-slate-500">Deaktiv (ADS30)</span>
              </span>
              <span className="px-2.5 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center space-x-1">
                <span>📅 YoY (UNION):</span>
                <span className="font-extrabold">{resultsData.summary?.include_yoy_history ? `${Math.round((resultsData.summary?.yoy_weight || 0.3) * 100)}% Keçən İl` : 'Deaktiv'}</span>
              </span>
              {resultsData.summary?.confidence_summary && (
                <div className="flex items-center space-x-1 text-xs">
                  <span className="px-2 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold text-[11px]" title="Etibarlı Tarixçə (Cari Trend və/və ya YoY)">
                    NORMAL: {resultsData.summary.confidence_summary.NORMAL ?? 0}
                  </span>
                  <span className="px-2 py-1 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold text-[11px]" title="Tək Mənbə və ya Fallback Siyasəti">
                    LIMITED: {resultsData.summary.confidence_summary.LIMITED ?? 0}
                  </span>
                  <span className="px-2 py-1 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 font-bold text-[11px]" title="Tarixçə Yoxdur / Blokaj / Əllə Yoxlama">
                    REVIEW: {resultsData.summary.confidence_summary.MANUAL_REVIEW ?? 0}
                  </span>
                </div>
              )}

              <button
                onClick={() => exportExcelReport(resultsData.run_id)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/30 flex items-center space-x-2 transition-all cursor-pointer shrink-0"
              >
                <FileDown className="w-4 h-4" />
                <span>6-Sheet Excel Hesabatını Endir</span>
              </button>
            </div>
          </div>

          {/* Filters for Store_SKU_Orders */}
          {resultsTab === 'orders' && (
            <div className="flex flex-col md:flex-row gap-3 p-3.5 rounded-xl bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Mağaza, Məhsul kodu və ya adı ilə axtar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadRunResults(resultsData.run_id, 1)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-medium"
                />
              </div>

              <div className="w-56">
                <select
                  value={filterWarning}
                  onChange={(e) => {
                    setFilterWarning(e.target.value);
                    setTimeout(() => loadRunResults(resultsData.run_id, 1), 50);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold text-xs"
                >
                  <option value="ALL">Bütün Statuslar</option>
                  <option value="OK">Yalnız OK</option>
                  <option value="ZERO_CURRENT_SALES_YOY_FALLBACK">Cari 0 Satış (YoY Fallback)</option>
                  <option value="FALLBACK_NETWORK_AVG">Şəbəkə Ortası Proqnoz</option>
                  <option value="DOUBLE_PROMO_RISK">İkiqat Promo Riski</option>
                  <option value="EXCEEDS_SHELF_CAPACITY">Rəf Tutumunu Aşanlar</option>
                  <option value="ROUNDING_EXCESS_HIGH">Artıq Qutu Yarananlar</option>
                  <option value="SUPPLIER_BLOCKED">Təchizatçı Bloklu (0 Sifariş)</option>
                </select>
              </div>

              <button
                onClick={() => loadRunResults(resultsData.run_id, 1)}
                className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700"
              >
                Filtrlə
              </button>
            </div>
          )}

          {/* TAB CONTENT: 1. Store_SKU_Orders Table */}
          {resultsTab === 'orders' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto max-h-[600px]">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 sticky top-0 z-10 shadow-xs font-bold">
                    <tr>
                      <th className="py-2.5 px-3">Mağaza</th>
                      <th className="py-2.5 px-3">Məhsul Kodu</th>
                      <th className="py-2.5 px-3">Məhsul Adı</th>
                      <th className="py-2.5 px-3 text-right">Cari Trend (30g)</th>
                      <th className="py-2.5 px-3 text-right text-indigo-600 dark:text-indigo-400">Keçən İl (YoY)</th>
                      <th className="py-2.5 px-3 text-right font-black text-blue-600 dark:text-blue-400">Proqnoz Tələb</th>
                      <th className="py-2.5 px-3 text-center">Metod</th>
                      <th className="py-2.5 px-3 text-center">Dərəcə</th>
                      <th className="py-2.5 px-3 text-right">Cari Stok</th>
                      <th className="py-2.5 px-3 text-right">Rəf Tutumu</th>
                      <th className="py-2.5 px-3 text-right">Xalis Ehtiyac</th>
                      <th className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400">Tövsiyə Sifariş</th>
                      <th className="py-2.5 px-3 text-right">Qutu İçi</th>
                      <th className="py-2.5 px-3 text-right font-black">Tövsiyə Qutu</th>
                      <th className="py-2.5 px-3 text-right">Artıq Qalıq</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {resultsData.items?.map((item: any, idx: number) => {
                      const isWarn = item.warning_status !== 'OK';
                      return (
                        <tr key={idx} className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 ${isWarn ? 'bg-amber-50/20' : ''}`}>
                          <td className="py-2 px-3 font-mono font-bold text-blue-600">{item.store_code}</td>
                          <td className="py-2 px-3 font-mono">{item.product_code}</td>
                          <td className="py-2 px-3 truncate max-w-xs" title={item.product_name}>{item.product_name}</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-500">
                            {item.recent_trend_demand !== null && item.recent_trend_demand !== undefined ? item.recent_trend_demand : '-'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono">
                            {item.yoy_historical_sales !== null && item.yoy_historical_sales !== undefined ? (
                              <div className="text-indigo-600 dark:text-indigo-400 font-bold" title={item.yoy_promo_sales > 0 ? `Keçən il promo satışı: ${item.yoy_promo_sales}` : 'Normal satış'}>
                                {item.yoy_historical_sales}
                                {item.yoy_promo_sales > 0 && (
                                  <span className="ml-1 px-1 py-0.5 bg-purple-100 text-purple-700 text-[9px] rounded font-semibold">prm</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-600">-</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-blue-600 dark:text-blue-400">
                            <div>{item.forecast_demand}</div>
                            {item.warning_status === 'FALLBACK_NETWORK_AVG' && (
                              <span className="text-[10px] text-blue-500 font-normal">şəbəkə ort.</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300" title={item.forecast_method}>
                              {item.forecast_method === 'BLENDED_TREND_YOY' ? 'TREND+YoY' :
                               item.forecast_method === 'CURRENT_TREND_ONLY' ? 'TREND' :
                               item.forecast_method === 'YOY_FALLBACK' ? 'YoY FALLBACK' :
                               item.forecast_method === 'NETWORK_AVERAGE_FALLBACK' ? 'ŞƏBƏKƏ ORT.' :
                               item.forecast_method === 'INITIAL_SHELF_FILL' ? 'RƏF DOLDURMA' :
                               item.forecast_method}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              item.forecast_confidence === 'NORMAL'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                                : item.forecast_confidence === 'LIMITED'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                            }`}>
                              {item.forecast_confidence}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right">
                            {item.current_stock === 0 ? (
                              <span className="text-amber-600 dark:text-amber-400 font-bold">0</span>
                            ) : (
                              <span className="text-slate-600 dark:text-slate-300 font-semibold">{item.current_stock}</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-500">{item.shelf_capacity}</td>
                          <td className="py-2 px-3 text-right font-bold text-slate-800 dark:text-slate-200">{item.net_requirement}</td>
                          <td className="py-2 px-3 text-right font-black text-emerald-600 text-sm">{item.recommended_order_units}</td>
                          <td className="py-2 px-3 text-right text-slate-500">{item.case_quantity}</td>
                          <td className="py-2 px-3 text-right font-bold text-indigo-600">{item.recommended_cases}</td>
                          <td className="py-2 px-3 text-right text-slate-400">{item.excess_units_from_rounding}</td>
                          <td className="py-2 px-3 text-center">
                            <span 
                              title={item.warning_reason || item.warning_message || item.warning_status}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-block cursor-help ${
                                item.warning_status === 'OK'
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                  : item.warning_status === 'FALLBACK_NETWORK_AVG'
                                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                                  : item.warning_status === 'ZERO_CURRENT_SALES_YOY_FALLBACK'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                  : item.warning_status === 'DOUBLE_PROMO_RISK'
                                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                                  : item.warning_status === 'SUPPLIER_BLOCKED'
                                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              }`}
                            >
                              {item.warning_status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer */}
              <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs">
                <span className="text-slate-500">
                  Göstərilir: {resultsData.items?.length} / {resultsData.total_items} sətr (Səhifə {resultsData.page} / {resultsData.total_pages})
                </span>
                <div className="flex space-x-1">
                  <button
                    disabled={resultsData.page <= 1}
                    onClick={() => loadRunResults(resultsData.run_id, resultsData.page - 1)}
                    className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 disabled:opacity-40"
                  >
                    Əvvəlki
                  </button>
                  <button
                    disabled={resultsData.page >= resultsData.total_pages}
                    onClick={() => loadRunResults(resultsData.run_id, resultsData.page + 1)}
                    className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 disabled:opacity-40"
                  >
                    Növbəti
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB CONTENT: 2. Store_Summary */}
          {resultsTab === 'stores' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                  <tr>
                    <th className="py-2.5 px-4">Mağaza Kodu</th>
                    <th className="py-2.5 px-4">Mağaza Adı</th>
                    <th className="py-2.5 px-4 text-right">Məhsul Sayı</th>
                    <th className="py-2.5 px-4 text-right">Ümumi Proqnoz Tələb</th>
                    <th className="py-2.5 px-4 text-right">Cari Stok</th>
                    <th className="py-2.5 px-4 text-right text-emerald-600 font-black">Tövsiyə Sifariş</th>
                    <th className="py-2.5 px-4 text-center">Xəbərdarlıq Sayı</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {resultsData.store_summary?.map((st: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2 px-4 font-mono font-bold text-blue-600">{st.store_code}</td>
                      <td className="py-2 px-4">{st.store_name}</td>
                      <td className="py-2 px-4 text-right font-semibold">{st.product_count}</td>
                      <td className="py-2 px-4 text-right font-bold text-blue-600">{st.total_forecast_demand}</td>
                      <td className="py-2 px-4 text-right text-slate-600">{st.total_current_stock}</td>
                      <td className="py-2 px-4 text-right font-black text-emerald-600">{st.total_recommended_order}</td>
                      <td className="py-2 px-4 text-center font-bold text-amber-600">{st.warning_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB CONTENT: 3. SKU_Summary */}
          {resultsTab === 'skus' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                  <tr>
                    <th className="py-2.5 px-4">Məhsul Kodu</th>
                    <th className="py-2.5 px-4">Məhsul Adı</th>
                    <th className="py-2.5 px-4 text-right">Mağaza Sayı</th>
                    <th className="py-2.5 px-4 text-right">Ümumi Proqnoz Tələb</th>
                    <th className="py-2.5 px-4 text-right">Cari Stok</th>
                    <th className="py-2.5 px-4 text-right text-emerald-600 font-black">Tövsiyə Sifariş</th>
                    <th className="py-2.5 px-4 text-center">Xəbərdarlıq Sayı</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {resultsData.sku_summary?.map((sku: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2 px-4 font-mono font-bold text-blue-600">{sku.product_code}</td>
                      <td className="py-2 px-4">{sku.product_name}</td>
                      <td className="py-2 px-4 text-right font-semibold">{sku.store_count}</td>
                      <td className="py-2 px-4 text-right font-bold text-blue-600">{sku.total_forecast_demand}</td>
                      <td className="py-2 px-4 text-right text-slate-600">{sku.total_current_stock}</td>
                      <td className="py-2 px-4 text-right font-black text-emerald-600">{sku.total_recommended_order}</td>
                      <td className="py-2 px-4 text-center font-bold text-amber-600">{sku.warning_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* -------------------------------------------------------------------------------- */}
      {/* SUBTAB 3: PLANNING HISTORY */}
      {/* -------------------------------------------------------------------------------- */}
      {activeSubTab === 'history' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Planlaşdırma Tarixçəsi</h3>
            <button
              onClick={loadHistoryRuns}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 flex items-center space-x-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Yenilə</span>
            </button>
          </div>

          {historyRuns.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">Hələ heç bir planlaşdırma saxlanılmayıb.</div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                <tr>
                  <th className="py-2.5 px-4">Yaradılma Vaxtı</th>
                  <th className="py-2.5 px-4">Kampaniya Adı</th>
                  <th className="py-2.5 px-4">Tarixlər</th>
                  <th className="py-2.5 px-4 text-right">Müddət</th>
                  <th className="py-2.5 px-4 text-right">Mağaza</th>
                  <th className="py-2.5 px-4 text-right">Məhsul</th>
                  <th className="py-2.5 px-4 text-right">Tövsiyə Sifariş</th>
                  <th className="py-2.5 px-4 text-center">Status</th>
                  <th className="py-2.5 px-4 text-right">Əməliyyatlar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {historyRuns.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">{r.created_at}</td>
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{r.title}</td>
                    <td className="py-3 px-4 text-slate-600">{r.start_date} → {r.end_date}</td>
                    <td className="py-3 px-4 text-right font-semibold">{r.duration_days} gün</td>
                    <td className="py-3 px-4 text-right">{r.store_count}</td>
                    <td className="py-3 px-4 text-right">{r.product_count}</td>
                    <td className="py-3 px-4 text-right font-black text-emerald-600">{r.total_recommended_order_units}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                        {r.confirmation_status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => {
                          loadRunResults(r.id);
                          setActiveSubTab('results');
                        }}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white inline-flex items-center space-x-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Bax</span>
                      </button>
                      <button
                        onClick={() => exportExcelReport(r.id)}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center space-x-1"
                      >
                        <FileDown className="w-3.5 h-3.5" />
                        <span>Excel</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};
