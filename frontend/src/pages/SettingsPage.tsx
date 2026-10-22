import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { 
  Settings, 
  Save, 
  RotateCw, 
  Layers, 
  Database, 
  FileSpreadsheet, 
  CheckCircle2, 
  Archive, 
  Clock, 
  AlertCircle,
  Sparkles
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { 
    settings, 
    setSettings, 
    submitAnalysis, 
    loading,
    campaigns,
    activeCampaignId,
    selectCampaign,
    sourceStatus,
    refreshSource,
    refreshCacheAndData,
    loadDemoData,
    t
  } = useData();

  const [isRefreshingCache, setIsRefreshingCache] = useState<boolean>(false);

  const handleSave = () => {
    submitAnalysis();
  };

  const handleRefreshCache = async () => {
    if (isRefreshingCache) return;
    setIsRefreshingCache(true);
    try {
      if (sourceStatus?.configured) {
        await refreshSource(true);
      } else if (refreshCacheAndData) {
        await refreshCacheAndData();
      }
    } catch (err) {
      console.error("Manual refresh error:", err);
    } finally {
      setIsRefreshingCache(false);
    }
  };

  const handleRefreshParquetSql = async () => {
    if (isRefreshingCache) return;
    setIsRefreshingCache(true);
    try {
      if (refreshCacheAndData) {
        await refreshCacheAndData();
      }
      if (sourceStatus?.configured) {
        await refreshSource(true);
      }
    } catch (err) {
      console.error("SQL Parquet refresh error:", err);
    } finally {
      setIsRefreshingCache(false);
    }
  };

  const safeCampaigns = Array.isArray(campaigns) ? campaigns : [];
  const currentCampaign = safeCampaigns.find((c) => c.id === activeCampaignId || c.is_active);

  const formatDate = (dateStr: any) => {
    if (!dateStr) return '';
    const parts = String(dateStr).split('-');
    return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : String(dateStr);
  };

  const formatShortDate = (dateStr: any) => {
    if (!dateStr) return '';
    const parts = String(dateStr).split('-');
    return parts.length === 3 ? `${parts[2]}.${parts[1]}` : String(dateStr);
  };

  let sourceDateStr = '';
  if (sourceStatus?.last_success_at) {
    const dt = new Date(sourceStatus.last_success_at);
    const day = String(dt.getDate()).padStart(2, '0');
    const month = String(dt.getMonth() + 1).padStart(2, '0');
    const hours = String(dt.getHours()).padStart(2, '0');
    const minutes = String(dt.getMinutes()).padStart(2, '0');
    sourceDateStr = `${day}.${month} ${hours}:${minutes}`;
  }

  const sourceFileName = sourceStatus?.path 
    ? sourceStatus.path.replace(/\\/g, '/').split('/').pop() 
    : 'TEST1.xlsx';

  return (
    <div className="space-y-6 pb-12 text-xs max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span>Tənzimləmələr Və Sistem İdarəetməsi</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Kampaniyaların idarə edilməsi, məlumat mənbəyi, keş yenilənməsi və analitik kritik hədlər
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={loading}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl flex items-center space-x-2 shadow-lg shadow-blue-500/25 transition-all cursor-pointer disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>Şərtləri Saxla Və Yenidən Hesabla</span>
        </button>
      </div>

      {/* Section 1: 3 Core Operational Modules (Moved from Header & Filter Bar) */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>Məlumat Mənbəyi, Kampaniyalar Və Canlı Sinxronizasiya</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* 1. Active Campaign & Archive Selector */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 relative overflow-hidden luminous-border-blue">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">Aktiv Kampaniya</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Analiz olunan promo dövrü</p>
                </div>
              </div>
              {currentCampaign && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  currentCampaign.is_latest
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                }`}>
                  {currentCampaign.is_latest ? '🔄 Ən Son Aktiv' : '📦 Arxiv'}
                </span>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                Kampaniyanı Dəyişdirin:
              </label>
              <select
                value={activeCampaignId || (currentCampaign?.id || '')}
                onChange={(e) => selectCampaign(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:border-blue-500 cursor-pointer transition-all dark:[&>option]:bg-slate-900 dark:[&>option]:text-slate-100"
              >
                {safeCampaigns.map((c) => {
                  const dateRangeStr = c.beg_date && c.end_date ? `${formatShortDate(c.beg_date)}–${formatDate(c.end_date)}` : '';
                  const displayName = (!c.insert_name || c.insert_name.toLowerCase() === 'test1') ? '15-28 Promo' : c.insert_name;
                  return (
                    <option key={c.id} value={c.id}>
                      {displayName} {dateRangeStr ? `(${dateRangeStr})` : ''} {c.is_latest ? '• Ən son yüklənən' : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            {currentCampaign && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Kampaniya ID:</span>
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-200 truncate max-w-[170px]" title={currentCampaign.id}>
                    {currentCampaign.id}
                  </span>
                </div>
                {currentCampaign.item_count ? (
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Element sayı:</span>
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                      {currentCampaign.item_count.toLocaleString()} qeyd
                    </span>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Tarix Aralığı:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-200">
                    {formatShortDate(currentCampaign.beg_date)} – {formatDate(currentCampaign.end_date)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 2. Data Source Status */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 relative overflow-hidden luminous-border-emerald">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">Məlumat Mənbəyi</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Cari bağlı olan Excel/Fayl</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Aktiv</span>
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Fayl:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                  {sourceFileName}
                </span>
              </div>
              {sourceStatus?.rows ? (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">İşlənmiş Sətir:</span>
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                    {sourceStatus.rows.toLocaleString()} sətir
                  </span>
                </div>
              ) : null}
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Son Sinxronizasiya:</span>
                <span className="font-mono text-slate-700 dark:text-slate-200 text-[11px]">
                  {sourceDateStr || 'Bu gün'}
                </span>
              </div>
              {sourceStatus?.path && (
                <div className="pt-1 text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate border-t border-slate-200 dark:border-slate-700/50" title={sourceStatus.path}>
                  {sourceStatus.path}
                </div>
              )}
            </div>

            <button
              onClick={() => refreshSource(true)}
              disabled={isRefreshingCache}
              className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl border border-slate-200 dark:border-slate-700 transition-all cursor-pointer text-xs"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isRefreshingCache ? 'animate-spin text-emerald-500' : ''}`} />
              <span>Mənbə Faylını Yenidən Oxu</span>
            </button>
          </div>

          {/* 3. Data Refresh & Cache Operations */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 relative overflow-hidden luminous-border-amber">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                  <RotateCw className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">Datanı Yenilə Və Keş</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Canlı SQL və analitika yeniləməsi</p>
                </div>
              </div>
            </div>

            <div className="space-y-2.5 pt-1">
              <button
                onClick={handleRefreshCache}
                disabled={isRefreshingCache}
                className={`w-full flex items-center justify-center space-x-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer ${
                  isRefreshingCache
                    ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 active:scale-98'
                }`}
              >
                <RotateCw className={`w-4 h-4 stroke-[2.5] ${isRefreshingCache ? 'animate-spin' : ''}`} />
                <span>{isRefreshingCache ? 'Yenilənir...' : 'Datanı Yenilə (Canlı Keş)'}</span>
              </button>

              <button
                onClick={handleRefreshParquetSql}
                disabled={isRefreshingCache}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl border border-slate-200 dark:border-slate-700 transition-all cursor-pointer text-xs"
              >
                <Database className="w-3.5 h-3.5 text-emerald-500" />
                <span>SQL Datasını Yenilə (Parquet cltmdb03)</span>
              </button>

              <button
                onClick={() => loadDemoData("B")}
                disabled={isRefreshingCache}
                className="w-full flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-blue-50/70 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-medium rounded-xl border border-blue-200 dark:border-blue-800/80 transition-all cursor-pointer text-[11px]"
              >
                <Database className="w-3 h-3 text-blue-500" />
                <span>Sınaq Demo Data Yüklə</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Business Thresholds Settings (Existing Configuration) */}
      <div className="space-y-3 pt-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
          <Settings className="w-4 h-4 text-blue-500" />
          <span>Analitik Kritik Hədlər Və Risk Qaydaları</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Achievement Thresholds */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Reallaşma Hədəf Hədləri (Achievement Thresholds)</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-slate-500 dark:text-slate-400 mb-1">Kritik Reallaşma Həddi (&lt; %)</label>
                <input
                  type="number"
                  value={settings.achievement_critical}
                  onChange={(e) => setSettings({ ...settings, achievement_critical: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-slate-500 dark:text-slate-400 mb-1">Hədəf Reallaşma (&ge; %)</label>
                <input
                  type="number"
                  value={settings.achievement_target}
                  onChange={(e) => setSettings({ ...settings, achievement_target: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-slate-500 dark:text-slate-400 mb-1">Yüksək Performans (&ge; %)</label>
                <input
                  type="number"
                  value={settings.achievement_over}
                  onChange={(e) => setSettings({ ...settings, achievement_over: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Stock Thresholds */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Stok Və Risk Hədləri (Stock Thresholds)</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-slate-500 dark:text-slate-400 mb-1">Artıq Stok Riski Həddi (Unit &gt;)</label>
                <input
                  type="number"
                  value={settings.high_stock_threshold}
                  onChange={(e) => setSettings({ ...settings, high_stock_threshold: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-slate-500 dark:text-slate-400 mb-1">Aşağı Stok / Stokout Riski (&le; Unit)</label>
                <input
                  type="number"
                  value={settings.low_stock_threshold}
                  onChange={(e) => setSettings({ ...settings, low_stock_threshold: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
