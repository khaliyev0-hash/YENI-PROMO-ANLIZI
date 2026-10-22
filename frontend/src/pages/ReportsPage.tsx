import React from 'react';
import { useData } from '../context/DataContext';
import { FileSpreadsheet, FileText, Download, CheckCircle } from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const { exportExcel, exportPdf } = useData();

  const excelSheets = [
    'SUMMARY', 'STORE_ANALYSIS', 'PRODUCT_ANALYSIS', 'STOCKOUT_ANALYSIS',
    'STOCK_ANALYSIS', 'FORECAST_ACCURACY', 'DAILY_STOCK', 'ALERTS',
    'RECOMMENDATIONS', 'RAW_DATA'
  ];

  const pdfSections = [
    '1. Executive Supply Chain & Promo Scorecard',
    '2. Category Demand vs Sales Realization (Vector Chart)',
    '3. Strategic Diagnostics & Velocity Narrative',
    '4. Store Network Performance Matrix & Leaders',
    '5. Critical SKU Stockout Hotspots & Suppressed Sales',
    '6. Prioritized Supply Chain Action Plan & Remediation',
    '7. Audit Governance & Enterprise Compliance Block'
  ];

  return (
    <div className="space-y-6 pb-12 text-xs">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Hesabatlar Və İxrac Hub-ı (Reports & Exports)</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Korporativ multi-sheet Excel və İcraçı PDF analitik hesabatlar</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Multi-Sheet Excel Export Card */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <div className="p-3 rounded-xl bg-emerald-500/10 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 dark:border-emerald-800">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Multi-Sheet Excel Workbook</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">10 Ədəd Tam Strukturlaşdırılmış Cədvəl Və Analizlər</p>
              </div>
            </div>
            <p className="text-slate-700 dark:text-slate-300">
              Uğurla hesablanmış bütün analitik göstəricilər, stokoutlar, dəqiqlik xətaları və tövsiyələr ayrılmış iş varəqlərinə doldurulur.
            </p>
            <div className="grid grid-cols-2 gap-1.5 pt-2">
              {excelSheets.map((s) => (
                <div key={s} className="flex items-center space-x-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-mono">{s}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={exportExcel}
            className="w-full mt-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Multi-Sheet Excel Yüklə (.xlsx)</span>
          </button>
        </div>

        {/* Corporate PDF Report Card */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <div className="p-3 rounded-xl bg-rose-500/10 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-500/20 dark:border-rose-800">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Executive PDF Supply Chain Report (EN)</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">English Executive & Supply Chain Analytics PDF Report (2-Page Executive Brief)</p>
              </div>
            </div>
            <p className="text-slate-700 dark:text-slate-300">
              Formatlanmış korporativ ingilis dilində kampaniya xülasəsi, makro KPI-lar, mağaza sıralamaları, stokout hotspotları və supply chain fəaliyyət planı.
            </p>
            <div className="space-y-1 pt-2">
              {pdfSections.map((s) => (
                <div key={s} className="flex items-center space-x-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  <CheckCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={exportPdf}
            className="w-full mt-4 py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-rose-500/20 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download Executive PDF Report (.pdf)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
