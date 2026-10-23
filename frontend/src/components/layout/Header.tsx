import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useData } from '../../context/DataContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../common/ToastProvider';
import { Upload, FileSpreadsheet, FileText, Database, Globe, RotateCw, Search, Clock, CheckCircle2, Sun, Moon, Tv } from 'lucide-react';
import { HeaderAnimatedLines } from '../common/HeaderAnimatedLines';

export const Header: React.FC = () => {
  const {
    t,
    lang,
    setLang,
    setShowUploadModal,
    setShowCommandPalette,
    setShowPresentationMode,
    loadDemoData,
    refreshCacheAndData,
    refreshSource,
    sourceStatus,
    exportExcel,
    exportPdf
  } = useData();

  const { isDark, toggleTheme } = useTheme();
  const { showToast } = useToast();
  const [isRefreshingCache, setIsRefreshingCache] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean | null>(true);
  const prevConnectedRef = useRef<boolean | null>(true);

  const checkConnection = useCallback(async () => {
    try {
      const getHostName = () => (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname : 'localhost';
      const API_BASE = import.meta.env.VITE_API_BASE_URL || `http://${getHostName()}:8000/api`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${API_BASE}/campaigns`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        if (prevConnectedRef.current === false) {
          showToast({ type: 'success', message: 'Backend bağlantısı bərpa olundu ✓' });
        }
        setIsConnected(true);
        prevConnectedRef.current = true;
      } else {
        if (prevConnectedRef.current !== false) {
          showToast({ type: 'error', message: 'Backend bağlantısı kəsildi!' });
        }
        setIsConnected(false);
        prevConnectedRef.current = false;
      }
    } catch (_) {
      if (prevConnectedRef.current !== false) {
        showToast({ type: 'error', message: 'Backend bağlantısı kəsildi!' });
      }
      setIsConnected(false);
      prevConnectedRef.current = false;
    }
  }, [showToast]);

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, [checkConnection]);

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

  const renderSourceChip = () => {
    if (!sourceStatus || !sourceStatus.configured) {
      return (
        <span className="inline-flex items-center gap-1 text-[9.5px] font-medium text-slate-400 dark:text-slate-500 px-1.5 py-0.5 rounded bg-slate-100/60 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
          <span>Mənbə yoxdur</span>
        </span>
      );
    }

    const fname = sourceStatus.path ? sourceStatus.path.replace(/\\/g, '/').split('/').pop() : 'TEST1.xlsx';

    if (sourceStatus.state === 'processing') {
      return (
        <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-md bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/60 animate-pulse">
          <RotateCw className="w-2.5 h-2.5 animate-spin text-blue-500 dark:text-blue-400" />
          <span>Emal edilir…</span>
        </span>
      );
    }

    if (sourceStatus.state === 'waiting_file_open') {
      return (
        <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-md bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/60" title={sourceStatus.last_error || ''}>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
          <span>Fayl açıqdır</span>
        </span>
      );
    }

    if (sourceStatus.state === 'error') {
      return (
        <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded-md bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-800/60 cursor-help" title={sourceStatus.last_error || 'Xəta'}>
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          <span>Mənbə xətası</span>
        </span>
      );
    }

    let dateStr = '';
    if (sourceStatus.last_success_at) {
      const dt = new Date(sourceStatus.last_success_at);
      const day = String(dt.getDate()).padStart(2, '0');
      const month = String(dt.getMonth() + 1).padStart(2, '0');
      const hours = String(dt.getHours()).padStart(2, '0');
      const minutes = String(dt.getMinutes()).padStart(2, '0');
      dateStr = `${day}.${month} ${hours}:${minutes}`;
    }

    return (
      <div className="relative group inline-flex items-center">
        <button
          onClick={() => refreshSource(true)}
          disabled={isRefreshingCache}
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100/70 hover:bg-slate-200/60 dark:bg-slate-800/70 dark:hover:bg-slate-700/60 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 border border-slate-200/60 dark:border-slate-700/60 transition-all text-[10px] font-medium cursor-pointer"
          title={`Mənbə: ${sourceStatus.path || fname}. Yeniləmək üçün vurun.`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          <span className="font-mono text-slate-600 dark:text-slate-300 font-semibold">{fname}</span>
          {dateStr && <span className="text-slate-400 dark:text-slate-500 font-mono text-[9.5px]">· {dateStr}</span>}
          <RotateCw
            className={`w-2.5 h-2.5 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-all group-hover:rotate-180 shrink-0 ${
              isRefreshingCache ? 'animate-spin text-blue-500' : ''
            }`}
          />
        </button>

        {/* Minimal Tooltip/Popover */}
        <div className="absolute left-0 top-full mt-1 w-64 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 p-2.5 hidden group-hover:block z-50 animate-in fade-in duration-100 pointer-events-none group-hover:pointer-events-auto">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-1.5 mb-1.5">
            <span className="text-[11px] font-bold text-slate-800 dark:text-white font-mono truncate">{fname}</span>
            <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.2 rounded">Aktiv</span>
          </div>
          <div className="space-y-1 text-[10px] text-slate-500 dark:text-slate-400">
            {sourceStatus.rows ? (
              <div className="flex justify-between">
                <span>Sətir sayı:</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{sourceStatus.rows.toLocaleString()}</span>
              </div>
            ) : null}
            <div className="flex justify-between">
              <span>Son sinxronizasiya:</span>
              <span className="font-mono text-slate-700 dark:text-slate-200">{dateStr || '—'}</span>
            </div>
            {sourceStatus.path && (
              <div className="pt-1 text-[9px] text-slate-400 dark:text-slate-500 truncate" title={sourceStatus.path}>
                {sourceStatus.path}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <header className="h-16 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs transition-colors duration-200">
      {/* Title Block with Refined Typography and Subtle Source Pill */}
      <div className="shrink-0 group cursor-default space-y-0.5">
        <h2 className="text-base font-black tracking-tight bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600 dark:from-blue-400 dark:via-blue-300 dark:to-indigo-300 bg-clip-text text-transparent flex items-center gap-1.5 drop-shadow-[0_2px_8px_rgba(20,121,232,0.4)] transition-all duration-300 group-hover:scale-102">
          <span>{t('app_title')}</span>
          <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-ping" />
        </h2>
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {t('sub_title')}
          </p>
        </div>
      </div>

      {/* Dynamic Animated Blue & Yellow Lines (Center Section) */}
      <HeaderAnimatedLines />

      {/* Header Actions */}
      <div className="flex items-center space-x-3 shrink-0">
        {/* Language Selector */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 rounded-xl p-0.5 border border-slate-200 dark:border-slate-700">
          <Globe className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 ml-2 mr-1" />
          {(['AZ', 'TR', 'EN'] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                lang === l
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Command Palette Trigger (Ctrl+K) */}
        <button
          onClick={() => setShowCommandPalette(true)}
          className="hidden sm:flex items-center space-x-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 transition-all text-xs font-bold cursor-pointer"
          title="Axtarış pəncərəsi (Ctrl + K)"
        >
          <Search className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
          <span>Axtar...</span>
          <kbd className="px-1.5 py-0.2 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-700 rounded font-mono text-[9.5px]">Ctrl K</kbd>
        </button>

        {/* TV / Presentation Mode Trigger */}
        <button
          onClick={() => setShowPresentationMode(true)}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer"
          title="Slide / Təqdimat Rejimi (Kiosk Fullscreen)"
        >
          <Tv className="w-3.5 h-3.5 stroke-[2.5]" />
          <span className="hidden md:inline">Slide</span>
        </button>

        {/* Midnight Executive Dark Mode Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-amber-400 rounded-xl border border-slate-200 dark:border-slate-700 transition-all cursor-pointer active:scale-95"
          title={isDark ? "İşıqlı rejimə keç (Light Mode)" : "Qaranlıq rejimə keç (Dark Mode)"}
        >
          {isDark ? (
            <Sun className="w-4 h-4 text-amber-400 stroke-[2.5] animate-[spin_10s_linear_infinite]" />
          ) : (
            <Moon className="w-4 h-4 text-slate-700 stroke-[2.5]" />
          )}
        </button>

        {/* Upload Excel Button */}
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>{t('btn_upload_excel')}</span>
        </button>

        {/* Export Buttons */}
        <button
          onClick={exportExcel}
          className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-emerald-700 dark:text-emerald-400 rounded-xl border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
          title={t('btn_export_excel')}
        >
          <FileSpreadsheet className="w-4 h-4" />
        </button>
        <button
          onClick={exportPdf}
          className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-rose-700 dark:text-rose-400 rounded-xl border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
          title={t('btn_export_pdf')}
        >
          <FileText className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};

