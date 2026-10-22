import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { useTheme } from '../../context/ThemeContext';
import { Search, LayoutDashboard, TrendingUp, Store, Package, Grid, FileSpreadsheet, Settings, X, ArrowRight, CornerDownLeft, Zap, Tags, MapPin, Calendar, Truck, AlertTriangle, Tv, Sun, Moon } from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const { setActiveTab, data, setSelectedProductDetail, setSelectedStoreDetail, setShowPresentationMode } = useData();
  const { toggleTheme, isDark } = useTheme();
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const pages = [
    { id: 'dashboard', label: 'İcraçı Dashboard & KPI İcmalı (Dashboard)', icon: LayoutDashboard, category: 'Səhifə' },
    { id: 'promo_perf', label: 'Promosiya Satış Performansı (Promo Sales)', icon: TrendingUp, category: 'Səhifə' },
    { id: 'promo_uplift', label: 'Promo Uplift Analizi (Baseline vs Uplift)', icon: Zap, category: 'Səhifə' },
    { id: 'category_analysis', label: 'Category Analiz (Tree Table)', icon: Tags, category: 'Səhifə' },
    { id: 'area_analysis', label: 'Area Analiz (Tree Table)', icon: MapPin, category: 'Səhifə' },
    { id: 'store_analytics', label: 'Mağaza Analitikası Və Sıralama (Store Analytics)', icon: Store, category: 'Səhifə' },
    { id: 'store_daily_stock', label: 'Mağaza Günlük Stok Və Hərəkət (Daily Stock)', icon: Calendar, category: 'Səhifə' },
    { id: 'service_level', label: 'Service Level & Təchizatçı Təhlili (Fulfillment)', icon: Truck, category: 'Səhifə' },
    { id: 'product_analytics', label: 'Məhsul (SKU) Təhlili (Product Analytics)', icon: Package, category: 'Səhifə' },
    { id: 'stockout_analysis', label: 'Stokout Analizi (Stockout Analysis)', icon: AlertTriangle, category: 'Səhifə' },
    { id: 'matrix', label: 'Məhsul × Mağaza Matrisi (Heatmap Matrix)', icon: Grid, category: 'Səhifə' },
    { id: 'reports', label: 'Hesabatlar Və İxrac Hub-ı (Excel & PDF Reports)', icon: FileSpreadsheet, category: 'Səhifə' },
    { id: 'settings', label: 'Tənzimləmələr Və Biznes Qaydaları (Settings)', icon: Settings, category: 'Səhifə' },
  ];

  // Match stores & products
  const storeMatches = (data?.store_performances || [])
    .filter((s) => s.store.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 5)
    .map((s) => ({
      id: `store-${s.store}`,
      label: `Mağaza: ${s.store} (${s.product_count} SKU, Reallaşma: ${s.achievement_pct ?? 0}%)`,
      icon: Store,
      category: 'Mağaza',
      action: () => {
        setSelectedStoreDetail(s.store);
        setActiveTab('store_analytics');
        onClose();
      }
    }));

  const productMatches = (data?.product_performances || [])
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 5)
    .map((p) => ({
      id: `product-${p.code}`,
      label: `Məhsul: ${p.name} (${p.code}) — Satış: ${p.total_sale}`,
      icon: Package,
      category: 'Məhsul SKU',
      action: () => {
        setSelectedProductDetail({ store: 'ALL', code: p.code });
        setActiveTab('product_analytics');
        onClose();
      }
    }));

  const pageMatches = pages
    .filter((p) => p.label.toLowerCase().includes(search.toLowerCase()))
    .map((p) => ({
      ...p,
      action: () => {
        setActiveTab(p.id);
        onClose();
      }
    }));

  const quickActions = [
    {
      id: 'action-tv-mode',
      label: 'TV / Təqdimat Rejimi (Kiosk Fullscreen)',
      icon: Tv,
      category: 'Əməliyyat',
      action: () => {
        setShowPresentationMode(true);
        onClose();
      }
    },
    {
      id: 'action-theme-toggle',
      label: isDark ? 'İşıqlı Temaya Keç (Light Mode)' : 'Qaranlıq Temaya Keç (Midnight Dark Mode)',
      icon: isDark ? Sun : Moon,
      category: 'Əməliyyat',
      action: () => {
        toggleTheme();
        onClose();
      }
    }
  ].filter((a) => a.label.toLowerCase().includes(search.toLowerCase()));

  const results = [...quickActions, ...pageMatches, ...storeMatches, ...productMatches];

  const handleSelect = (item: typeof results[0]) => {
    if (item && item.action) {
      item.action();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          setSearch('');
          setSelectedIndex(0);
        }
      } else if (isOpen) {
        if (e.key === 'Escape') {
          onClose();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex((prev) => (results.length > 0 ? (prev + 1) % results.length : 0));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex((prev) => (results.length > 0 ? (prev - 1 + results.length) % results.length : 0));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (results[selectedIndex]) {
            handleSelect(results[selectedIndex]);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, results, selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-slate-950/60 backdrop-blur-xs animate-fadeIn cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl mx-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col transition-all cursor-default"
      >
        {/* Search Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center space-x-3 bg-slate-50/50 dark:bg-slate-800/80">
          <Search className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="İstənilən menyu, mağaza və ya SKU kodunu axtarın (Ctrl+K)..."
            className="w-full bg-transparent text-sm font-extrabold text-slate-900 dark:text-white focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 font-sans"
            autoFocus
          />
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-200/80 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-1">
          {results.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs font-bold">
              Uyğun nəticə tapılmadı. Zəhmət olmasa başqa açar söz sınayın.
            </div>
          ) : (
            results.map((item, idx) => {
              const IconComp = item.icon;
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`p-3 rounded-xl flex items-center justify-between cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <div className="flex items-center space-x-3 truncate">
                    <IconComp className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-blue-600 dark:text-blue-400'}`} />
                    <span className="text-xs font-bold truncate">{item.label}</span>
                  </div>
                  <div className="flex items-center space-x-2 shrink-0">
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase border ${
                      isSelected ? 'bg-white/20 text-white border-white/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                    }`}>
                      {item.category}
                    </span>
                    <CornerDownLeft className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'opacity-0'}`} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 font-bold">
          <div className="flex items-center space-x-3">
            <span><kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded font-mono text-[9px]">↑↓</kbd> Naviqasiya</span>
            <span><kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded font-mono text-[9px]">Enter</kbd> Keçid et</span>
            <span><kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded font-mono text-[9px]">Esc</kbd> Bağla</span>
          </div>
          <span className="text-blue-600 dark:text-blue-400 font-extrabold">TamStore Command Engine</span>
        </div>
      </div>
    </div>
  );
};
