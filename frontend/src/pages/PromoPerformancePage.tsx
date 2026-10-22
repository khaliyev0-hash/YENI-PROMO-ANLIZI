import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../context/DataContext';
import {
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Download,
  Search,
  Filter,
  Sparkles,
  BarChart2,
  Layers,
  X,
  Package,
  TrendingDown
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { isPromoTypeMatch } from '../utils/filterUtils';
import { DashboardSkeleton } from '../components/common/SkeletonLoader';
import { SortableHeader } from '../components/common/SortableHeader';
import type { ProductPerformance } from '../types';

export const PromoPerformancePage: React.FC = () => {
  const { data, setSelectedProductDetail, filters } = useData();

  // Internal Filter & Pagination States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [performanceFilter, setPerformanceFilter] = useState<'ALL' | 'OVER' | 'STABLE' | 'UNDER' | 'STOCKOUT'>('ALL');
  const [sortField, setSortField] = useState<keyof ProductPerformance | 'diff'>('total_sale');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const product_performances = data?.product_performances || [];

  // Global Context Filter sync
  const baseProducts = useMemo(() => {
    return product_performances.filter((p) => {
      if (filters.selectedProduct && p.code !== filters.selectedProduct) return false;
      if (filters.selectedCategory && filters.selectedCategory !== 'ALL' && p.category !== filters.selectedCategory) return false;
      if (filters.selectedFamily && filters.selectedFamily !== 'ALL' && p.family !== filters.selectedFamily) return false;
      if (filters.abcClass !== 'ALL' && p.abc_class !== filters.abcClass) return false;
      if (filters.promoType && filters.promoType !== 'ALL' && !isPromoTypeMatch(p, filters.promoType)) return false;
      return true;
    });
  }, [product_performances, filters]);

  // Filtered Products based on local controls (Search and Performance status filter)
  const filteredProducts = useMemo(() => {
    return baseProducts.filter((p) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const codeMatch = p.code.toLowerCase().includes(q);
        const nameMatch = p.name.toLowerCase().includes(q);
        const catMatch = (p.category || '').toLowerCase().includes(q);
        if (!codeMatch && !nameMatch && !catMatch) return false;
      }

      // Performance Filter
      const ach = p.achievement_pct ?? 0;
      if (performanceFilter === 'OVER' && ach < 100) return false;
      if (performanceFilter === 'STABLE' && (ach < 80 || ach >= 100)) return false;
      if (performanceFilter === 'UNDER' && ach >= 80) return false;
      if (performanceFilter === 'STOCKOUT' && p.total_stock > 0.0001) return false;

      return true;
    });
  }, [baseProducts, searchQuery, performanceFilter]);

  // Overall Statistics for KPI Cards
  const kpiStats = useMemo(() => {
    const total_skus = baseProducts.length;
    const total_fc = baseProducts.reduce((sum, p) => sum + (p.total_fc || 0), 0);
    const total_sale = baseProducts.reduce((sum, p) => sum + (p.total_sale || 0), 0);
    const total_stock = baseProducts.reduce((sum, p) => sum + (p.total_stock || 0), 0);

    const overall_ach = total_fc > 0 ? Number(((total_sale / total_fc) * 100).toFixed(1)) : 0;
    const overperforming = baseProducts.filter((p) => (p.achievement_pct ?? 0) >= 100).length;
    const stable = baseProducts.filter((p) => (p.achievement_pct ?? 0) >= 80 && (p.achievement_pct ?? 0) < 100).length;
    const underperforming = baseProducts.filter((p) => (p.achievement_pct ?? 0) < 80).length;
    const stockout_count = baseProducts.filter((p) => (p.total_stock || 0) <= 0.0001).length;

    return {
      total_skus,
      total_fc: Math.round(total_fc),
      total_sale: Math.round(total_sale),
      total_stock: Math.round(total_stock),
      overall_ach,
      overperforming,
      stable,
      underperforming,
      stockout_count
    };
  }, [baseProducts]);

  // Sorted Products
  const sortedProducts = useMemo(() => {
    return [...filteredProducts].sort((a: any, b: any) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === 'diff') {
        valA = (a.total_sale || 0) - (a.total_fc || 0);
        valB = (b.total_sale || 0) - (b.total_fc || 0);
      } else {
        valA = valA ?? 0;
        valB = valB ?? 0;
      }

      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? valA - valB : valB - valA;
    });
  }, [filteredProducts, sortField, sortAsc]);

  // Pagination
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, performanceFilter, filters, pageSize]);

  const paginatedProducts = useMemo(() => {
    if (pageSize >= 9999) return sortedProducts;
    const start = (currentPage - 1) * pageSize;
    return sortedProducts.slice(start, start + pageSize);
  }, [sortedProducts, currentPage, pageSize]);

  const totalPages = pageSize >= 9999 ? 1 : Math.ceil(sortedProducts.length / pageSize);

  const handleSort = (field: any) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      const isStringField = field === 'code' || field === 'name';
      setSortAsc(isStringField);
    }
  };

  // Promo Type Distribution (Təsir vs Adi)
  const promoTypeBreakdown = useMemo(() => {
    const tesirItems = filteredProducts.filter((p) => p.promo_type === 'tesir' || p.promo_type === 'teshir');
    const adiItems = filteredProducts.filter((p) => p.promo_type !== 'tesir' && p.promo_type !== 'teshir');

    const aggregate = (items: typeof filteredProducts, title: string) => {
      const fc = items.reduce((s, p) => s + (p.total_fc || 0), 0);
      const sale = items.reduce((s, p) => s + (p.total_sale || 0), 0);
      const stock = items.reduce((s, p) => s + (p.total_stock || 0), 0);
      const ach = fc > 0 ? Number(((sale / fc) * 100).toFixed(1)) : 0;
      return { title, count: items.length, fc: Math.round(fc), sale: Math.round(sale), stock: Math.round(stock), ach };
    };

    return [
      aggregate(tesirItems, 'Təsir (Təşhir) Promoları'),
      aggregate(adiItems, 'Adi Promolar')
    ];
  }, [filteredProducts]);

  // Export Table Data to Excel
  const exportToExcel = () => {
    if (!filteredProducts.length) return;

    const rows = filteredProducts.map((p) => {
      const fc = Math.round(p.total_fc || 0);
      const sale = Math.round(p.total_sale || 0);
      const diff = sale - fc;
      const ach = p.achievement_pct !== null && p.achievement_pct !== undefined ? `${p.achievement_pct}%` : '—';

      return {
        'SKU Kodu': p.code,
        'Məhsul Adı': p.name,
        'Kateqoriya': p.category || 'Təyin edilməyib',
        'Sub Kateqoriya': p.sub_category || 'Təyin edilməyib',
        'Ailə (Family)': p.family || 'Təyin edilməyib',
        'Promo Növü': p.promo_type === 'tesir' || p.promo_type === 'teshir' ? 'Təsir' : 'Adi',
        'Mağaza Sayı': p.store_count,
        'Proqnoz Hədəfi (FC)': fc,
        'Real Satış (SALE)': sale,
        'Reallaşma %': ach,
        'Fərq (Satış - FC)': diff,
        'Stokout Mağaza Sayı': p.stockout_store_count,
        'Stokout %': `${p.stockout_pct}%`,
        'ABC Sinfi': p.abc_class
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Promo Performansı');

    const fileName = `Tamstore_Promo_Performansi_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setPerformanceFilter('ALL');
  };

  const hasActiveFilters = searchQuery !== '' || performanceFilter !== 'ALL';

  const getAchievementBadge = (ach: number | null | undefined) => {
    if (ach === null || ach === undefined) {
      return <span className="text-slate-400 font-mono font-bold text-xs">—</span>;
    }
    if (ach >= 120) {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg font-black text-xs bg-purple-100 text-purple-800 border border-purple-200">
          <Sparkles className="w-3 h-3 text-purple-600 shrink-0" />
          <span>{ach}%</span>
        </span>
      );
    }
    if (ach >= 100) {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg font-black text-xs bg-emerald-100 text-emerald-800 border border-emerald-300">
          <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
          <span>{ach}%</span>
        </span>
      );
    }
    if (ach >= 80) {
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg font-black text-xs bg-blue-50 text-blue-700 border border-blue-200">
          <TrendingUp className="w-3 h-3 text-blue-600 shrink-0" />
          <span>{ach}%</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg font-black text-xs bg-rose-50 text-rose-700 border border-rose-200">
        <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
        <span>{ach}%</span>
      </span>
    );
  };

  if (!data || !data.product_performances) {
    return <DashboardSkeleton />;
  }

  const selectedStoreCode = filters.selectedStore || 'ALL';

  return (
    <div className="space-y-6 pb-12 text-xs">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-blue-600 rounded-xl text-white shadow-xs">
              <BarChart2 className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
              Promo Performansı Və Reallaşma Analizi
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Bütün aksiya məhsulları üzrə hədəf (proqnoz), faktiki satış, stok vəziyyəti və kateqoriyalar üzrə effektivlik təhlili
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2 shrink-0">
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="flex items-center space-x-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              <span>Filtrləri Sıfırla</span>
            </button>
          )}

          <button
            onClick={exportToExcel}
            className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer"
            title="Süzülmüş cədvəli Excel formatında yükləyin"
          >
            <Download className="w-4 h-4" />
            <span>Excel İxrac ({filteredProducts.length})</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Card 1: Total Promo Sales */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Cəmi Promo Satış</span>
            <div className="p-2 bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-300 rounded-xl">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
              {kpiStats.total_sale.toLocaleString()} <span className="text-xs font-normal text-slate-400">ədəd</span>
            </div>
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">
              Hədəf FC: <span className="font-mono text-slate-700 dark:text-slate-300">{kpiStats.total_fc.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Overall Achievement */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Orta Reallaşma</span>
            <div className={`p-2 rounded-xl ${
              kpiStats.overall_ach >= 100
                ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-300'
                : kpiStats.overall_ach >= 80
                ? 'bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-300'
                : 'bg-rose-50 dark:bg-rose-950/80 text-rose-600 dark:text-rose-300'
            }`}>
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className={`text-2xl font-black font-mono tracking-tight ${
              kpiStats.overall_ach >= 100
                ? 'text-emerald-600 dark:text-emerald-400'
                : kpiStats.overall_ach >= 80
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}>
              {kpiStats.overall_ach}%
            </div>
            <div className="text-[11px] font-bold text-slate-400 mt-0.5">
              Ümumi şəbəkə icrası
            </div>
          </div>
        </div>

        {/* Card 3: Overperforming */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Hədəfi Keçənlər</span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-300 rounded-xl">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
              {kpiStats.overperforming} <span className="text-xs font-normal text-slate-400">SKU</span>
            </div>
            <div className="text-[11px] font-bold text-slate-400 mt-0.5">
              &ge; 100% reallaşma göstərən
            </div>
          </div>
        </div>

        {/* Card 4: Underperforming */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Zəif Performans</span>
            <div className="p-2 bg-rose-50 dark:bg-rose-950/80 text-rose-600 dark:text-rose-300 rounded-xl">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono tracking-tight">
              {kpiStats.underperforming} <span className="text-xs font-normal text-slate-400">SKU</span>
            </div>
            <div className="text-[11px] font-bold text-slate-400 mt-0.5">
              &lt; 80% hədəfdən geri qalan
            </div>
          </div>
        </div>

        {/* Card 5: Closing Stock & Stockout */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Qalıq Stok / Stokout</span>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/80 text-amber-600 dark:text-amber-300 rounded-xl">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-800 dark:text-slate-100 font-mono tracking-tight">
              {kpiStats.total_stock.toLocaleString()} <span className="text-xs font-normal text-slate-400">ədəd</span>
            </div>
            <div className="text-[11px] font-bold text-rose-600 dark:text-rose-400 mt-0.5">
              {kpiStats.stockout_count} SKU-da ehtiyat tükənib
            </div>
          </div>
        </div>
      </div>

      {/* Promo Növü Müqayisəsi (Təsir vs Adi) */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Promo Növü Müqayisəsi</span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Təsir (Təşhir) və Adi aksiyaların icra və reallaşma göstəriciləri</p>
          </div>
          <div className="flex items-center space-x-2 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            <span>Təsir Promoları</span>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            <span>Adi Promolar</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {promoTypeBreakdown.map((pt, idx) => {
            const isTesir = idx === 0;
            return (
              <div
                key={pt.title}
                className={`p-4 rounded-xl border ${
                  isTesir ? 'bg-purple-50/40 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800/60' : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'
                } space-y-3`}
              >
                <div className="flex items-center justify-between">
                  <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                    isTesir ? 'bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                  }`}>
                    {pt.title}
                  </span>
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400 font-mono">{pt.count} SKU</span>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/80 dark:border-slate-700 shadow-xs">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Hədəf (FC)</span>
                    <p className="text-xs font-black text-slate-700 dark:text-slate-300 font-mono mt-0.5">{pt.fc.toLocaleString()}</p>
                  </div>
                  <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/80 dark:border-slate-700 shadow-xs">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Real Satış</span>
                    <p className="text-xs font-black text-slate-900 dark:text-white font-mono mt-0.5">{pt.sale.toLocaleString()}</p>
                  </div>
                  <div className={`p-2.5 rounded-lg border shadow-xs ${
                    pt.ach >= 100
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                      : pt.ach >= 80
                      ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300'
                      : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                  }`}>
                    <span className="text-[9px] font-bold uppercase">Reallaşma</span>
                    <p className="text-xs font-black font-mono mt-0.5">{pt.ach}%</p>
                  </div>
                  <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/80 dark:border-slate-700 shadow-xs">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Qalıq Stok</span>
                    <p className="text-xs font-black text-slate-700 dark:text-slate-300 font-mono mt-0.5">{pt.stock.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Advanced Filter & Search Toolbar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Performance Status Tabs */}
          <div className="flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setPerformanceFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                performanceFilter === 'ALL'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Hamısı ({baseProducts.length})
            </button>
            <button
              onClick={() => setPerformanceFilter('OVER')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                performanceFilter === 'OVER'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              🟢 Hədəfi Keçən (&ge;100%) ({kpiStats.overperforming})
            </button>
            <button
              onClick={() => setPerformanceFilter('STABLE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                performanceFilter === 'STABLE'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              🟡 Stabil (80-100%) ({kpiStats.stable})
            </button>
            <button
              onClick={() => setPerformanceFilter('UNDER')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                performanceFilter === 'UNDER'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              🔴 Zəif (&lt;80%) ({kpiStats.underperforming})
            </button>
            <button
              onClick={() => setPerformanceFilter('STOCKOUT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                performanceFilter === 'STOCKOUT'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              ⚠️ Stokout ({kpiStats.stockout_count})
            </button>
          </div>

          {/* Page size selector */}
          <div className="flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 self-end lg:self-auto">
            <span>Göstər:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="p-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 dark:[&>option]:bg-slate-900 dark:[&>option]:text-slate-100"
            >
              <option value={15}>15 sətir</option>
              <option value={25}>25 sətir</option>
              <option value={50}>50 sətir</option>
              <option value={100}>100 sətir</option>
              <option value={9999}>Bütün sətirlər</option>
            </select>
          </div>
        </div>

        {/* Search */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 max-w-md">
          {/* Search box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="SKU Kodu, Məhsul Adı axtar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Interactive Table */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span className="font-bold">
            Tapılan Məhsullar: <span className="text-slate-900 dark:text-white font-mono">{filteredProducts.length}</span> SKU
          </span>
          <span className="text-[11px]">
            Sətirə klikləyərək məhsulun gündəlik stok/satış detallarına baxa bilərsiniz
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700 select-none">
              <tr>
                <SortableHeader label="SKU Kodu" field="code" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="left" />
                <SortableHeader label="Məhsul Adı / Kateqoriya" field="name" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="left" />
                <th className="p-3 text-center font-bold">Promo Növü</th>
                <SortableHeader label="Mağaza" field="store_count" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="center" />
                <SortableHeader label="Proqnoz (FC)" field="total_fc" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="right" />
                <SortableHeader label="Real Satış" field="total_sale" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="right" />
                <SortableHeader label="Reallaşma %" field="achievement_pct" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="right" />
                <SortableHeader label="Fərq (Satış-FC)" field="diff" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="right" />
                <SortableHeader label="Stokout Mağaza" field="stockout_store_count" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="center" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
              {paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-400">
                    <div className="space-y-2">
                      <Package className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                      <p className="font-bold text-sm text-slate-600 dark:text-slate-300">Axtarışa uyğun məhsul tapılmadı</p>
                      <p className="text-xs text-slate-400">Filtirləri təmizləyərək yenidən yoxlayın</p>
                      <button
                        onClick={clearAllFilters}
                        className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded-lg font-bold text-xs transition-colors cursor-pointer"
                      >
                        Filtirləri Sıfırla
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((p) => {
                  const fc = Math.round(p.total_fc || 0);
                  const sale = Math.round(p.total_sale || 0);
                  const diff = sale - fc;
                  const stock = Math.round(p.total_stock || 0);
                  const isStockout = stock <= 0;

                  return (
                    <tr
                      key={p.code}
                      onClick={() => setSelectedProductDetail({ store: selectedStoreCode, code: p.code })}
                      className="hover:bg-blue-50/70 dark:hover:bg-slate-800/60 cursor-pointer transition-colors group"
                      title="Məhsul detallarına baxmaq üçün klikləyin"
                    >
                      {/* SKU Code */}
                      <td className="p-3 font-mono font-bold text-blue-700 dark:text-blue-400 whitespace-nowrap group-hover:underline flex items-center space-x-1">
                        <span>{p.code}</span>
                        <Eye className="w-3 h-3 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </td>

                      {/* Product Name & Category */}
                      <td className="p-3 font-medium text-slate-900 dark:text-slate-100 max-w-[280px]">
                        <div className="font-bold truncate" title={p.name}>
                          {p.name}
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5 flex items-center space-x-1.5">
                          <span>{p.category || 'Təyin edilməyib'}</span>
                          {p.sub_category && p.sub_category !== 'Təyin edilməyib' && (
                            <>
                              <span>&bull;</span>
                              <span>{p.sub_category}</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Promo Type */}
                      <td className="p-3 text-center whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                            p.promo_type === 'tesir' || p.promo_type === 'teshir'
                              ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {p.promo_type === 'tesir' || p.promo_type === 'teshir' ? 'Təsir' : 'Adi'}
                        </span>
                      </td>

                      {/* Store Count */}
                      <td className="p-3 text-center font-mono font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {p.store_count}
                      </td>

                      {/* FC */}
                      <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {fc.toLocaleString()}
                      </td>

                      {/* Sale */}
                      <td className="p-3 text-right font-mono font-black text-slate-900 dark:text-white whitespace-nowrap">
                        {sale.toLocaleString()}
                      </td>

                      {/* Achievement % */}
                      <td className="p-3 text-right whitespace-nowrap">
                        {getAchievementBadge(p.achievement_pct)}
                      </td>

                      {/* Difference */}
                      <td className={`p-3 text-right font-mono font-bold whitespace-nowrap ${
                        diff > 0 ? 'text-emerald-600 dark:text-emerald-400' : diff < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'
                      }`}>
                        {diff > 0 ? `+${diff.toLocaleString()}` : diff.toLocaleString()}
                      </td>

                      {/* Stockout Store Count */}
                      <td className="p-3 text-center font-mono whitespace-nowrap">
                        {p.stockout_store_count > 0 ? (
                          <span className="text-rose-600 dark:text-rose-400 font-bold">
                            {p.stockout_store_count} ({p.stockout_pct}%)
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">0</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Table Footer Totals Row */}
            {paginatedProducts.length > 0 && (
              <tfoot className="bg-slate-100/90 dark:bg-slate-800/90 font-bold text-slate-800 dark:text-slate-100 border-t-2 border-slate-300 dark:border-slate-700">
                <tr>
                  <td colSpan={4} className="p-3 text-right uppercase text-[10px] tracking-wider text-slate-600 dark:text-slate-400">
                    Süzülmüş Cəmi ({filteredProducts.length} SKU):
                  </td>
                  <td className="p-3 text-right font-mono text-slate-700 dark:text-slate-300">
                    {Math.round(filteredProducts.reduce((s, p) => s + (p.total_fc || 0), 0)).toLocaleString()}
                  </td>
                  <td className="p-3 text-right font-mono text-slate-900 dark:text-white font-black">
                    {Math.round(filteredProducts.reduce((s, p) => s + (p.total_sale || 0), 0)).toLocaleString()}
                  </td>
                  <td className="p-3 text-right font-mono">
                    {(() => {
                      const totalFc = filteredProducts.reduce((s, p) => s + (p.total_fc || 0), 0);
                      const totalSale = filteredProducts.reduce((s, p) => s + (p.total_sale || 0), 0);
                      const ach = totalFc > 0 ? Number(((totalSale / totalFc) * 100).toFixed(1)) : 0;
                      return getAchievementBadge(ach);
                    })()}
                  </td>
                  <td className="p-3 text-right font-mono">
                    {(() => {
                      const totalFc = filteredProducts.reduce((s, p) => s + (p.total_fc || 0), 0);
                      const totalSale = filteredProducts.reduce((s, p) => s + (p.total_sale || 0), 0);
                      const diff = Math.round(totalSale - totalFc);
                      return (
                        <span className={diff > 0 ? 'text-emerald-600 dark:text-emerald-400' : diff < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-400'}>
                          {diff > 0 ? `+${diff.toLocaleString()}` : diff.toLocaleString()}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="p-3 text-center font-mono text-rose-600 dark:text-rose-400">
                    {filteredProducts.reduce((s, p) => s + (p.stockout_store_count || 0), 0)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Səhifə <span className="font-bold text-slate-800 dark:text-slate-200">{currentPage}</span> / <span className="font-bold text-slate-800 dark:text-slate-200">{totalPages}</span> (Cəmi {sortedProducts.length} məhsul)
            </span>

            <div className="flex items-center space-x-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Əvvəlki səhifə"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center space-x-1 px-2 font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                <span>{currentPage}</span>
                <span className="text-slate-400">/</span>
                <span>{totalPages}</span>
              </div>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Növbəti səhifə"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
