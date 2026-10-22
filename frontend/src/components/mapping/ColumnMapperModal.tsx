import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import type { ColumnMapping } from '../../types';
import { Sliders, X, Check } from 'lucide-react';

export const ColumnMapperModal: React.FC = () => {
  const {
    columnMapping,
    excelColumns,
    sampleRows,
    showColumnMapperModal,
    setShowColumnMapperModal,
    submitAnalysis,
    confidence
  } = useData();

  const [mapping, setMapping] = useState<ColumnMapping>({
    store_col: "",
    code_col: "",
    name_col: "",
    fc_col: "",
    sale_col: "",
    stock_col: "",
    category_col: "",
    area_col: "",
    daily_stock_cols: []
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowColumnMapperModal(false);
      }
    };
    if (showColumnMapperModal) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [showColumnMapperModal, setShowColumnMapperModal]);

  useEffect(() => {
    if (columnMapping) {
      setMapping(columnMapping);
    }
  }, [columnMapping]);

  if (!showColumnMapperModal) return null;

  const columns = excelColumns && excelColumns.length > 0 
    ? excelColumns 
    : (sampleRows.length > 0 ? Object.keys(sampleRows[0]) : []);

  const handleSave = () => {
    submitAnalysis(mapping);
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) setShowColumnMapperModal(false);
      }}
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] cursor-default"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <Sliders className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Sütun Doğrulanması (Column Mapper)</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Uyğunluq dəqiqliyi: <span className="font-bold text-blue-600 dark:text-blue-400">{Math.round(confidence * 100)}%</span>. Zəhmət olmasa sütunları yoxlayın.
              </p>
            </div>
          </div>
          <button onClick={() => setShowColumnMapperModal(false)} className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">MAĞAZA SÜTUNU (Magaza) *</label>
              <select
                value={mapping.store_col || ""}
                onChange={(e) => setMapping({ ...mapping, store_col: e.target.value })}
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Seçin...</option>
                {columns.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">MƏHSUL KODU (Mehsul_kodu) *</label>
              <select
                value={mapping.code_col}
                onChange={(e) => setMapping({ ...mapping, code_col: e.target.value })}
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Seçin...</option>
                {columns.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">MƏHSUL ADI (Mehsul_adi)</label>
              <select
                value={mapping.name_col || ""}
                onChange={(e) => setMapping({ ...mapping, name_col: e.target.value })}
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Seçin...</option>
                {columns.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">TƏSİR / ETİKET (Tesir/adi)</label>
              <select
                value={mapping.insert_name_col || ""}
                onChange={(e) => setMapping({ ...mapping, insert_name_col: e.target.value })}
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Seçin...</option>
                {columns.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">PROQNOZ (FC) Sütunu *</label>
              <select
                value={mapping.fc_col}
                onChange={(e) => setMapping({ ...mapping, fc_col: e.target.value })}
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Seçin...</option>
                {columns.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">BAŞLAMA TARİXİ (Başlama Tarixi)</label>
              <select
                value={mapping.start_date_col || ""}
                onChange={(e) => setMapping({ ...mapping, start_date_col: e.target.value })}
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Seçin...</option>
                {columns.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">BİTMƏ TARİXİ (Bitmə Tarixi)</label>
              <select
                value={mapping.end_date_col || ""}
                onChange={(e) => setMapping({ ...mapping, end_date_col: e.target.value })}
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Seçin...</option>
                {columns.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">DAĞILIM MİQDARI (Dagilim Miqdari)</label>
              <select
                value={mapping.distribution_col || ""}
                onChange={(e) => setMapping({ ...mapping, distribution_col: e.target.value })}
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Seçin...</option>
                {columns.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">REF (Ana rəf miqdarı)</label>
              <select
                value={mapping.ref_col || ""}
                onChange={(e) => setMapping({ ...mapping, ref_col: e.target.value })}
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Seçin (İxtiyari)...</option>
                {columns.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="col-span-1">
              <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">KATEQORİYA (Category)</label>
              <select
                value={mapping.category_col || ""}
                onChange={(e) => setMapping({ ...mapping, category_col: e.target.value })}
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Seçin (İxtiyari)...</option>
                {columns.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="col-span-1">
              <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">SUB KATEQORİYA (Sub Category)</label>
              <select
                value={mapping.sub_category_col || ""}
                onChange={(e) => setMapping({ ...mapping, sub_category_col: e.target.value })}
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Seçin (İxtiyari)...</option>
                {columns.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="col-span-1">
              <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">MƏHSUL AİLƏSİ / FAMILY (Family)</label>
              <select
                value={mapping.family_col || ""}
                onChange={(e) => setMapping({ ...mapping, family_col: e.target.value })}
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Seçin (İxtiyari)...</option>
                {columns.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="col-span-1">
              <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">AREA / BÖLGƏ (Area)</label>
              <select
                value={mapping.area_col || ""}
                onChange={(e) => setMapping({ ...mapping, area_col: e.target.value })}
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Seçin (İxtiyari)...</option>
                {columns.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="col-span-1">
              <label className="block text-slate-600 dark:text-slate-400 font-semibold mb-1">SUB AREA / ALT BÖLGƏ (Sub Area)</label>
              <select
                value={mapping.sub_area_col || ""}
                onChange={(e) => setMapping({ ...mapping, sub_area_col: e.target.value })}
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Seçin (İxtiyari)...</option>
                {columns.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="col-span-2 p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-xl text-blue-800 dark:text-blue-300 flex items-center space-x-2">
              <span className="font-semibold text-xs">ℹ️ MAĞAZA, REAL SATIŞ və QALIQ STOK sahələri avtomatik canlı DB-dən hesablanacaq (bütün dükanlara replikasiya olunur).</span>
            </div>
          </div>

          {mapping.daily_stock_cols && mapping.daily_stock_cols.length > 0 && (
            <div className="mt-4 p-3 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl">
              <span className="font-bold text-blue-600 dark:text-blue-400 block mb-1">Aşkar edilən Günlük Stok Sütunları ({mapping.daily_stock_cols.length}):</span>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {mapping.daily_stock_cols.map((dc) => (
                  <span key={dc} className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded text-[10px] font-mono border border-slate-300 dark:border-slate-600">
                    {dc}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-end space-x-3">
          <button
            onClick={() => setShowColumnMapperModal(false)}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl cursor-pointer transition-colors"
          >
            Ləğv Et
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold flex items-center space-x-2 shadow-lg shadow-blue-500/20 cursor-pointer transition-all"
          >
            <Check className="w-4 h-4" />
            <span>Təsdiqlə Və Təhlil Et</span>
          </button>
        </div>
      </div>
    </div>
  );
};
