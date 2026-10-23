import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../context/DataContext';
import type { PromoUpliftResponse, PromoUpliftItem } from '../types';
import {
  Zap, Search, ArrowUpDown, ArrowUp, ArrowDown, Download,
  RefreshCw, TrendingUp, TrendingDown, Calendar, ShoppingBag,
  Sparkles, CheckCircle2, AlertCircle, Clock, Filter, Eye
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { SortableHeader } from '../components/common/SortableHeader';
import { SpotlightCard } from '../components/common/SpotlightCard';
import { AnimatedCounter } from '../components/common/AnimatedCounter';
import { isPromoTypeMatch } from '../utils/filterUtils';

export const PromoUpliftPage: React.FC = () => {
  const { setSelectedProductDetail, activeCampaignId, filters, t } = useData();

  const [apiData, setApiData] = useState<PromoUpliftResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Sorting
  const [sortField, setSortField] = useState<keyof PromoUpliftItem>('uplift_pct');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Pagination
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const getHostName = () => (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname : 'localhost';
  const API_BASE = import.meta.env.VITE_API_BASE_URL || `http://${getHostName()}:8000/api`;

  const fetchUpliftData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (activeCampaignId) params.append('campaign_id', activeCampaignId);
      if (filters?.selectedStore && filters.selectedStore !== 'ALL') {
        params.append('store', filters.selectedStore);
      }
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`${API_BASE}/promo-uplift${qs}`);
      if (!res.ok) {
        throw new Error(`Server xətası: ${res.status}`);
      }
      const data: PromoUpliftResponse = await res.json();
      setApiData(data);
    } catch (err: any) {
      console.error("Failed to load promo uplift data", err);
      setError(err?.message || "Məlumat yüklənmədi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUpliftData();
  }, [activeCampaignId, filters?.selectedStore]);

  // Client-side filtering
  const filteredItems = useMemo(() => {
    if (!apiData?.items) return [];

    let list = apiData.items;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(item =>
        item.code.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        (item.family && item.family.toLowerCase().includes(q))
      );
    }

    // Product
    if (filters?.selectedProduct) {
      list = list.filter(item => item.code === filters.selectedProduct);
    }

    // Category
    if (filters?.selectedCategory && filters.selectedCategory !== 'ALL') {
      list = list.filter(item => item.category === filters.selectedCategory);
    }

    // Family
    if (filters?.selectedFamily && filters.selectedFamily !== 'ALL') {
      list = list.filter(item => item.family === filters.selectedFamily);
    }

    // Promo Type
    if (filters?.promoType && filters.promoType !== 'ALL') {
      list = list.filter(item => isPromoTypeMatch(item, filters.promoType));
    }

    // Status
    if (selectedStatus !== 'ALL') {
      if (selectedStatus === 'POSITIVE') {
        list = list.filter(item => item.uplift_qty > 0);
      } else {
        list = list.filter(item => item.status === selectedStatus);
      }
    }

    // Sorting
    return [...list].sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (valA === null || valA === undefined) valA = -999999999;
      if (valB === null || valB === undefined) valB = -999999999;

      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? valA - valB : valB - valA;
    });
  }, [apiData, searchQuery, filters, selectedStatus, sortField, sortAsc]);

  // Dynamic summary based on filtered items
  const dynamicSummary = useMemo(() => {
    if (!filteredItems.length) {
      return {
        total_skus: 0,
        total_normal_14d: 0,
        total_baseline: 0,
        total_promo_sale: 0,
        total_last_day_sale: 0,
        total_uplift_qty: 0,
        overall_uplift_pct: 0,
        overall_uplift_ratio: null,
        positive_count: 0,
        negative_count: 0
      };
    }

    const total_skus = filteredItems.length;
    const total_normal_14d = filteredItems.reduce((acc, r) => acc + (r.normal_14d_sale || 0), 0);
    const total_baseline = filteredItems.reduce((acc, r) => acc + (r.baseline_sale || 0), 0);
    const total_promo_sale = filteredItems.reduce((acc, r) => acc + (r.promo_sale || 0), 0);
    const total_last_day_sale = filteredItems.reduce((acc, r) => acc + (r.last_day_sale || 0), 0);
    const total_uplift_qty = total_promo_sale - total_baseline;

    let overall_uplift_pct = 0;
    let overall_uplift_ratio: number | null = null;
    if (total_baseline > 0) {
      overall_uplift_pct = Number(((total_promo_sale - total_baseline) / total_baseline * 100).toFixed(1));
      overall_uplift_ratio = Number((total_promo_sale / total_baseline).toFixed(2));
    } else if (total_promo_sale > 0) {
      overall_uplift_pct = 100.0;
    }

    const positive_count = filteredItems.filter(r => r.uplift_qty > 0).length;
    const negative_count = filteredItems.filter(r => r.uplift_qty < 0).length;

    return {
      total_skus,
      total_normal_14d: Math.round(total_normal_14d),
      total_baseline: Math.round(total_baseline),
      total_promo_sale: Math.round(total_promo_sale),
      total_last_day_sale: Math.round(total_last_day_sale),
      total_uplift_qty: Math.round(total_uplift_qty),
      overall_uplift_pct,
      overall_uplift_ratio,
      positive_count,
      negative_count
    };
  }, [filteredItems]);

  const statusCounts = useMemo(() => {
    const items = apiData?.items || [];
    return {
      all: items.length,
      high: items.filter(r => r.status === 'HIGH').length,
      positive: items.filter(r => r.uplift_qty > 0).length,
      moderate: items.filter(r => r.status === 'MODERATE').length,
      negative: items.filter(r => r.uplift_qty < 0).length,
      new: items.filter(r => r.status === 'NEW').length,
    };
  }, [apiData?.items]);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filters, selectedStatus, pageSize]);

  // Paginated items
  const paginatedItems = useMemo(() => {
    if (pageSize >= 9999) return filteredItems;
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  const totalPages = pageSize >= 9999 ? 1 : Math.ceil(filteredItems.length / pageSize);

  const handleSort = (field: any) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      const isStringField = field === 'code' || field === 'name' || field === 'category';
      setSortAsc(isStringField);
    }
  };

  const exportToExcel = () => {
    if (!filteredItems.length) return;

    const rows = filteredItems.map(item => ({
      'SKU Kodu': item.code,
      'Məhsul Adı': item.name,
      'Kateqoriya': item.category,
      'Sub Kateqoriya': item.sub_category,
      'Family': item.family,
      'Promo Növü': item.promo_type === 'tesir' || item.promo_type === 'teshir' ? 'Təsir' : 'Adi',
      'Mağaza Sayı': item.store_count,
      '14 Günlük Normal Baza Satış': item.normal_14d_sale,
      'Dövrə Uyğun Normal Baza': item.baseline_sale,
      'Real Promo Satış': item.promo_sale,
      'Son Gün Satışı': item.last_day_sale,
      'Əlavə Satış (Uplift Ədəd)': item.uplift_qty,
      'Uplift %': item.uplift_pct !== null ? `${item.uplift_pct}%` : '',
      'Qalıq Stok': item.stock,
      'Status': item.status
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Promo Uplift');

    const fileName = `Tamstore_Promo_Uplift_${apiData?.beg_date || ''}_${apiData?.end_date || ''}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const getStatusBadge = (status: string, upliftPct: number) => {
    switch (status) {
      case 'HIGH':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <Sparkles className="w-3 h-3 text-emerald-600" />
            <span>Yüksək (≥100%)</span>
          </span>
        );
      case 'MODERATE':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-200">
            <TrendingUp className="w-3 h-3 text-teal-600" />
            <span>Mülayim ({upliftPct}%)</span>
          </span>
        );
      case 'LOW':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
            <span>Aşağı ({upliftPct}%)</span>
          </span>
        );
      case 'NEGATIVE':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
            <TrendingDown className="w-3 h-3 text-rose-600" />
            <span>Mənfi ({upliftPct}%)</span>
          </span>
        );
      case 'NEW':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <span>Yeni / Bazasız</span>
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12 text-xs">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 shadow-xs">
              <Zap className="w-5 h-5 fill-amber-500 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Promo Uplift Analizi</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                14 günlük normal satış bazasına görə kampaniyanın gətirdiyi artım (uplift) və son gün təhlili
              </p>
            </div>
          </div>
        </div>

        {/* Date badges and action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {apiData && (
            <>
              <div className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 text-blue-800 dark:text-blue-300 shadow-xs">
                <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span className="font-bold text-[11px]">Promo:</span>
                <span className="font-mono font-black text-[11px]">{apiData.beg_date} &rarr; {apiData.end_date}</span>
                <span className="text-[10px] bg-blue-200/80 dark:bg-blue-800/60 text-blue-900 dark:text-blue-200 font-bold px-1.5 py-0.2 rounded">
                  {apiData.promo_days} gün
                </span>
              </div>

              <div className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 shadow-xs">
                <Clock className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span className="font-bold text-[11px]">14G Normal Baza:</span>
                <span className="font-mono font-semibold text-[11px]">{apiData.pre_beg_date} &rarr; {apiData.pre_end_date}</span>
              </div>

              {apiData.is_ongoing && (
                <div className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                  <span className="font-bold text-[11px]">Davam edir:</span>
                  <span className="font-mono font-black text-[11px]">{apiData.elapsed_days} / {apiData.promo_days} gün ({apiData.latest_sales_date}-dək)</span>
                </div>
              )}

              {filters?.selectedStore && filters.selectedStore !== 'ALL' && (
                <div className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-purple-50/90 dark:bg-purple-950/40 border border-purple-300 dark:border-purple-700 text-purple-800 dark:text-purple-300 shadow-xs">
                  <span className="font-bold text-[11px]">Mağaza:</span>
                  <span className="font-mono font-black text-[11px]">{filters.selectedStore}</span>
                </div>
              )}
            </>
          )}

          <button
            onClick={fetchUpliftData}
            disabled={loading}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:text-blue-600 text-slate-700 dark:text-slate-200 font-bold rounded-xl transition-all shadow-xs active:scale-95 disabled:opacity-50"
            title="Yenilə"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            <span>Yenilə</span>
          </button>

          <button
            onClick={exportToExcel}
            disabled={loading || !filteredItems.length}
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-xs active:scale-95 disabled:opacity-50"
            title="Excel formatında yüklə"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Excel İxrac</span>
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            <span className="font-bold">{error}</span>
          </div>
          <button
            onClick={fetchUpliftData}
            className="px-3 py-1 bg-rose-600 text-white rounded-lg font-bold hover:bg-rose-700"
          >
            Təkrar Yoxla
          </button>
        </div>
      )}

      {/* Summary KPI Cards Grid (6 cards) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* 1. Ümumi Promo Satış */}
        <SpotlightCard spotlightColor="blue" glowBorder="blue" className="p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Promo Satış</span>
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight font-mono">
              <AnimatedCounter value={dynamicSummary.total_promo_sale} />
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              İnsert dövrü satış
            </div>
          </div>
        </SpotlightCard>

        {/* 2. Gözlənilən Baza Satış */}
        <SpotlightCard spotlightColor="cyan" glowBorder="cyan" className="p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Gözlənilən Baza</span>
            <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-black text-slate-700 dark:text-slate-200 tracking-tight font-mono">
              <AnimatedCounter value={dynamicSummary.total_baseline} />
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              {apiData?.is_ongoing ? `${apiData.elapsed_days} günlük normal baza` : `${apiData?.promo_days || 14} günlük normal baza`}
            </div>
          </div>
        </SpotlightCard>

        {/* 3. Əlavə Satış (Uplift Qty) */}
        <SpotlightCard
          spotlightColor={dynamicSummary.total_uplift_qty >= 0 ? 'emerald' : 'rose'}
          glowBorder={dynamicSummary.total_uplift_qty >= 0 ? 'emerald' : 'rose'}
          className="p-3.5 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Əlavə Satış</span>
            <div className={`p-1.5 rounded-lg ${dynamicSummary.total_uplift_qty >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'}`}>
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className={`text-xl font-black tracking-tight font-mono ${dynamicSummary.total_uplift_qty >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              <AnimatedCounter
                value={dynamicSummary.total_uplift_qty}
                prefix={dynamicSummary.total_uplift_qty >= 0 ? '+' : ''}
              />
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Uplift ədəd (fərq)
            </div>
          </div>
        </SpotlightCard>

        {/* 4. Ümumi Uplift % */}
        <SpotlightCard
          spotlightColor={dynamicSummary.overall_uplift_pct >= 0 ? 'emerald' : 'rose'}
          glowBorder={dynamicSummary.overall_uplift_pct >= 0 ? 'emerald' : 'rose'}
          className="p-3.5 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Ümumi Uplift %</span>
            <div className={`p-1.5 rounded-lg ${dynamicSummary.overall_uplift_pct >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'}`}>
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className={`text-xl font-black tracking-tight font-mono flex items-center gap-1.5 ${dynamicSummary.overall_uplift_pct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              <AnimatedCounter
                value={dynamicSummary.overall_uplift_pct}
                prefix={dynamicSummary.overall_uplift_pct >= 0 ? '+' : ''}
                suffix="%"
              />
              {dynamicSummary.overall_uplift_pct >= 0 && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
              )}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Artım dərəcəsi
            </div>
          </div>
        </SpotlightCard>

        {/* 5. Son Gün Satışı */}
        <SpotlightCard spotlightColor="purple" glowBorder="cyan" className="p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Son Satış Günü</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-black text-indigo-700 dark:text-indigo-300 tracking-tight font-mono">
              <AnimatedCounter value={dynamicSummary.total_last_day_sale} />
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Son gün ({apiData?.latest_sales_date || apiData?.end_date || 'Son'})
            </div>
          </div>
        </SpotlightCard>

        {/* 6. Artım Əmsalı (Multiplier) */}
        <SpotlightCard spotlightColor="amber" glowBorder="amber" className="p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Artım Əmsalı</span>
            <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-black text-amber-600 dark:text-amber-400 tracking-tight font-mono">
              {dynamicSummary.overall_uplift_ratio ? `${dynamicSummary.overall_uplift_ratio}x` : '—'}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Baza ilə nisbət (Multiplier)
            </div>
          </div>
        </SpotlightCard>
      </div>

      {/* Main Table Card with Filters */}
      <div className="p-5 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 relative overflow-hidden luminous-border-blue">
        {/* Top delicate luminous blue line */}
        <div className="absolute top-0 inset-x-0 h-[2px] luminous-line-blue z-20" />
        {/* Filters and Controls Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="SKU kodu, məhsul adı, kateqoriya ilə axtar..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-850 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xs font-bold"
              >
                &times;
              </button>
            )}
          </div>

          {/* Controls: Page Size */}
          <div className="flex flex-wrap items-center gap-2">

            {/* Page Size Dropdown */}
            <div className="flex items-center space-x-1.5">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Səhifə:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value={25}>25 SKU</option>
                <option value={50}>50 SKU</option>
                <option value={100}>100 SKU</option>
                <option value={99999}>Bütün SKU-lar</option>
              </select>
            </div>
          </div>
        </div>

        {/* Status Pills Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-400 mr-1">Status:</span>

            <button
              onClick={() => setSelectedStatus('ALL')}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                selectedStatus === 'ALL'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              Hamısı ({statusCounts.all})
            </button>

            <button
              onClick={() => setSelectedStatus('HIGH')}
              className={`inline-flex items-center space-x-1 px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                selectedStatus === 'HIGH'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>Yüksək (≥100%) ({statusCounts.high})</span>
            </button>

            <button
              onClick={() => setSelectedStatus('POSITIVE')}
              className={`inline-flex items-center space-x-1 px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                selectedStatus === 'POSITIVE'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/60 text-teal-700 dark:text-teal-300'
              }`}
            >
              <TrendingUp className="w-3 h-3" />
              <span>Bütün Artanlar (&gt;0) ({statusCounts.positive})</span>
            </button>

            <button
              onClick={() => setSelectedStatus('MODERATE')}
              className={`inline-flex items-center space-x-1 px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                selectedStatus === 'MODERATE'
                  ? 'bg-cyan-600 text-white shadow-xs'
                  : 'bg-cyan-50 dark:bg-cyan-950/60 hover:bg-cyan-100 dark:hover:bg-cyan-900/60 text-cyan-700 dark:text-cyan-300'
              }`}
            >
              <span>Mülayim (20-100%) ({statusCounts.moderate})</span>
            </button>

            <button
              onClick={() => setSelectedStatus('NEGATIVE')}
              className={`inline-flex items-center space-x-1 px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                selectedStatus === 'NEGATIVE'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300'
              }`}
            >
              <TrendingDown className="w-3 h-3" />
              <span>Mənfi / Zəif (&lt;0) ({statusCounts.negative})</span>
            </button>

            <button
              onClick={() => setSelectedStatus('NEW')}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                selectedStatus === 'NEW'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300'
              }`}
            >
              Yeni / Bazasız ({statusCounts.new})
            </button>
          </div>

          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
            Göstərilir: <span className="text-slate-900 dark:text-slate-100 font-black">{filteredItems.length}</span> SKU
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700 select-none">
              <tr>
                <SortableHeader label="SKU Kodu" field="code" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="left" />
                <SortableHeader label="Məhsul Adı" field="name" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="left" className="min-w-[200px]" />
                <SortableHeader label="Kateqoriya" field="category" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="left" />
                <th className="p-3 text-center font-bold">Növ</th>
                <SortableHeader label="Mağaza" field="store_count" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="center" />
                <SortableHeader label="14G Normal Baza" field="normal_14d_sale" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="right" />
                <SortableHeader label={apiData?.is_ongoing ? `Baza (${apiData.elapsed_days}G)` : "Gözlənilən Baza"} field="baseline_sale" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="right" />
                <SortableHeader label="Promo Satış" field="promo_sale" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="right" />
                <SortableHeader label="Son Gün" field="last_day_sale" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="right" />
                <SortableHeader label="Əlavə Satış" field="uplift_qty" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="right" />
                <SortableHeader label="Uplift %" field="uplift_pct" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="right" />
                <th className="p-3 text-center font-bold">Status</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
              {loading ? (
                <tr>
                  <td colSpan={12} className="p-12 text-center text-slate-500 dark:text-slate-400">
                    <div className="inline-flex items-center space-x-3">
                      <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="font-bold text-sm">Promo uplift məlumatları hesablanır...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-12 text-center text-slate-400">
                    <div className="space-y-1">
                      <p className="font-bold text-sm">Axtarışa uyğun məhsul tapılmadı</p>
                      <p className="text-xs">Filtirləri təmizləyərək yenidən yoxlayın</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item) => {
                  const upliftQty = item.uplift_qty ?? 0;
                  const upliftPct = item.uplift_pct ?? 0;
                  const isPositive = upliftQty > 0;
                  const isHigh = upliftPct >= 100.0;
                  const isNegative = upliftQty < 0;

                  return (
                    <tr
                      key={item.code}
                      onClick={() => setSelectedProductDetail({ store: 'ALL', code: item.code })}
                      className="hover:bg-blue-50/80 dark:hover:bg-slate-800/60 cursor-pointer transition-colors group"
                      title="Məhsul detallarına baxmaq üçün klikləyin"
                    >
                      {/* Code */}
                      <td className="p-3 font-mono font-bold text-blue-700 dark:text-blue-400 whitespace-nowrap group-hover:underline flex items-center space-x-1">
                        <span>{item.code}</span>
                        <Eye className="w-3 h-3 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </td>

                      {/* Name */}
                      <td className="p-3 font-bold text-slate-900 dark:text-slate-100 max-w-[280px]">
                        <div className="truncate" title={item.name}>
                          {item.name}
                        </div>
                        {item.family && item.family !== 'Təyin edilməyib' && (
                          <div className="text-[10px] text-slate-400 font-normal truncate">
                            {item.family}
                          </div>
                        )}
                      </td>

                      {/* Category */}
                      <td className="p-3 text-slate-600 dark:text-slate-400 font-medium whitespace-nowrap">
                        <span className="truncate max-w-[150px] inline-block" title={item.category}>
                          {item.category}
                        </span>
                      </td>

                      {/* Promo Type */}
                      <td className="p-3 text-center whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                            item.promo_type === 'tesir' || item.promo_type === 'teshir'
                              ? 'bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {item.promo_type === 'tesir' || item.promo_type === 'teshir' ? 'Təsir' : 'Adi'}
                        </span>
                      </td>

                      {/* Store Count */}
                      <td className="p-3 text-center font-mono font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {item.store_count ?? 0}
                      </td>

                      {/* 14d Normal Baseline */}
                      <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {(item.normal_14d_sale ?? 0).toLocaleString()}
                      </td>

                      {/* Campaign Baseline */}
                      <td className="p-3 text-right font-mono font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {(item.baseline_sale ?? 0).toLocaleString()}
                      </td>

                      {/* Promo Sale */}
                      <td className="p-3 text-right font-mono font-black text-slate-900 dark:text-white whitespace-nowrap">
                        {(item.promo_sale ?? 0).toLocaleString()}
                      </td>

                      {/* Son Gün Satışı */}
                      <td className="p-3 text-right font-mono font-bold text-indigo-700 dark:text-indigo-400 whitespace-nowrap">
                        {(item.last_day_sale ?? 0).toLocaleString()}
                      </td>

                      {/* Uplift Qty */}
                      <td className={`p-3 text-right font-mono font-black whitespace-nowrap ${
                        isPositive ? 'text-emerald-600 dark:text-emerald-400' : isNegative ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'
                      }`}>
                        {upliftQty > 0 ? `+${upliftQty.toLocaleString()}` : upliftQty.toLocaleString()}
                      </td>

                      {/* Uplift % */}
                      <td className="p-3 text-right font-mono font-black whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 rounded font-black text-[11px] ${
                          isHigh
                            ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                            : isPositive
                            ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800'
                            : isNegative
                            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                        }`}>
                          {upliftPct > 0 ? `+${upliftPct}%` : `${upliftPct}%`}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="p-3 text-center whitespace-nowrap">
                        {getStatusBadge(item.status, item.uplift_pct)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Cəmi <span className="font-bold text-slate-800 dark:text-slate-200">{filteredItems.length}</span> məhsuldan{' '}
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredItems.length)}
              </span>{' '}
              arası göstərilir
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer"
              >
                Əvvəlki
              </button>

              <div className="flex items-center space-x-1 text-xs font-bold text-slate-700 dark:text-slate-300">
                <span>Səhifə</span>
                <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded font-black">
                  {currentPage}
                </span>
                <span>/ {totalPages}</span>
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer"
              >
                Növbəti
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
