import React, { useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { ShieldCheck, AlertTriangle, CheckCircle, X, ArrowRight, Table } from 'lucide-react';

export const DataQualityModal: React.FC = () => {
  const {
    qualityReport,
    showQualityModal,
    setShowQualityModal,
    submitAnalysis,
    setShowColumnMapperModal,
    columnMapping,
    loading
  } = useData();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowQualityModal(false);
      }
    };
    if (showQualityModal) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [showQualityModal, setShowQualityModal]);

  if (!showQualityModal || !qualityReport) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) setShowQualityModal(false);
      }}
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] cursor-default"
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Data Quality Engine Review</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Yüklənmiş Excel faylının struktur və məlumat dürüstlüyü</p>
            </div>
          </div>
          <button
            onClick={() => setShowQualityModal(false)}
            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg cursor-pointer hover:bg-blue-500/5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Summary Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold">Cəmi Sətirlər</span>
              <p className="text-lg font-bold text-slate-900 dark:text-white mt-1">{qualityReport.total_rows.toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold">Mağaza Sayı</span>
              <p className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-1">{qualityReport.total_stores}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold">Məhsul Sayı</span>
              <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mt-1">{qualityReport.total_products}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold">STORE + CODE</span>
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1">{qualityReport.unique_store_code_count}</p>
            </div>
          </div>

          {/* Detected Mapping Summary */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Table className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <div>
                <span className="text-xs font-semibold text-slate-900 dark:text-white">Detected Column Mapping</span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  STORE: <span className="text-blue-600 dark:text-blue-400 font-mono">{columnMapping?.store_col}</span> | 
                  CODE: <span className="text-blue-600 dark:text-blue-400 font-mono">{columnMapping?.code_col}</span> | 
                  FC: <span className="text-blue-600 dark:text-blue-400 font-mono">{columnMapping?.fc_col}</span> | 
                  SALE: <span className="text-blue-600 dark:text-blue-400 font-mono">{columnMapping?.sale_col}</span>
                  {columnMapping?.daily_stock_cols?.length ? ` | Daily Stock: ${columnMapping.daily_stock_cols.length} dates` : ''}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setShowQualityModal(false);
                setShowColumnMapperModal(true);
              }}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
            >
              Sütunları Dəyişdir
            </button>
          </div>

          {/* Warnings List */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Aşkar Edilmiş Qeydlər Və Xəbərdarlıqlar</h4>
            {qualityReport.warnings.length === 0 ? (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center space-x-3 text-xs">
                <CheckCircle className="w-5 h-5 shrink-0" />
                <span>Bütün məlumat dürüstlük yoxlamalarından uğurla keçdi! Heç bir mənfi və ya xətalı dəyər tapılmadı.</span>
              </div>
            ) : (
              qualityReport.warnings.map((w, i) => (
                <div key={i} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-start space-x-3">
                  <AlertTriangle className={`w-5 h-5 shrink-0 mt-0.5 ${
                    w.severity === 'HIGH' ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'
                  }`} />
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">{w.type}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                        w.severity === 'HIGH' ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400' : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                      }`}>{w.severity}</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{w.description}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-end space-x-3">
          <button
            onClick={() => setShowQualityModal(false)}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition-all cursor-pointer"
          >
            Ləğv Et
          </button>
          <button
            onClick={() => submitAnalysis()}
            disabled={loading}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-500/20 flex items-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <span>Analitik Platformaya Keç</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
