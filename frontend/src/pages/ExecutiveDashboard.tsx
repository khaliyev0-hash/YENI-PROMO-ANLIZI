import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { KPICard } from '../components/common/KPICard';
import {
  TrendingUp, Activity, Target, Layers, Store, Package, Rocket, AlertTriangle, Sparkles, CheckCircle2, ShieldAlert, ArrowUpRight, Zap, CalendarX
} from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Area, LineChart, BarChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ReferenceLine
} from 'recharts';

import { Skeleton, SkeletonCard, SkeletonTable } from '../components/common/Skeleton';
import { AnimatedCounter } from '../components/common/AnimatedCounter';
import { SpotlightCard } from '../components/common/SpotlightCard';
import { useTheme } from '../context/ThemeContext';
import { isPromoTypeMatch } from '../utils/filterUtils';
import type { DailySalesRecord } from '../types';

const SparkleStar: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className = "w-4 h-4 text-amber-500", style }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={style}>
    <path d="M12 0C12 6.627 6.627 12 0 12C6.627 12 12 17.373 12 24C12 17.373 17.373 12 24 12C17.373 12 12 6.627 12 0Z" />
  </svg>
);

export const ExecutiveDashboard: React.FC = () => {
  const { data, t, setSelectedProductDetail, filters, campaigns, activeCampaignId } = useData();
  const { isDark } = useTheme();
  const [viewMode, setViewMode] = useState<'PCS' | 'AZN'>('PCS');

  if (!data || !data.kpi_cards) {
    return (
      <div className="space-y-6 pb-12 text-xs">
        <div className="flex items-center justify-between p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-md">
          <Skeleton className="w-48 h-6 rounded-lg" />
          <Skeleton className="w-32 h-8 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, idx) => (
            <SkeletonCard key={idx} />
          ))}
        </div>
        <SkeletonTable rows={6} />
      </div>
    );
  }

  const kpi_cards = data.kpi_cards || {};
  const product_performances = data.product_performances || [];
  const category_performances = data.category_performances || [];
  const daily_summaries = data.daily_summaries || [];
  const store_performances = data.store_performances || [];

  // Real or proxy unit price multiplier for Tutar (₼) calculation
  const PRICE_MULTIPLIER = (kpi_cards.total_forecast && kpi_cards.total_forecast_azn && kpi_cards.total_forecast > 0)
    ? (kpi_cards.total_forecast_azn / kpi_cards.total_forecast)
    : 2.5;

  const hasPromoFilter = Boolean(
    (filters?.promoType && filters.promoType !== 'ALL') ||
    (filters?.selectedCategory && filters.selectedCategory !== 'ALL') ||
    (filters?.selectedFamily && filters.selectedFamily !== 'ALL') ||
    (filters?.selectedProduct && filters.selectedProduct !== '')
  );
  const promoFilteredProducts = hasPromoFilter
    ? product_performances.filter((p) => {
        if (filters?.selectedProduct && p.code !== filters.selectedProduct) return false;
        if (filters?.selectedCategory && filters.selectedCategory !== 'ALL' && p.category !== filters.selectedCategory) return false;
        if (filters?.selectedFamily && filters.selectedFamily !== 'ALL' && p.family !== filters.selectedFamily) return false;
        if (filters?.promoType && filters.promoType !== 'ALL' && !isPromoTypeMatch(p, filters.promoType)) return false;
        return true;
      })
    : product_performances;

  const promoFc = promoFilteredProducts.reduce((sum, p) => sum + (p.total_fc || 0), 0);
  const promoSale = promoFilteredProducts.reduce((sum, p) => sum + (p.total_sale || 0), 0);
  const promoAchievement = promoFc > 0 ? (promoSale / promoFc) * 100 : 0;
  const promoStock = promoFilteredProducts.reduce((sum, p) => sum + (p.total_stock || 0), 0);
  const promoStockoutCount = promoFilteredProducts.reduce((sum, p) => sum + (p.stockout_store_count > 0 ? 1 : 0), 0);
  const promoTotalCombos = promoFilteredProducts.reduce((sum, p) => sum + (p.store_count || 0), 0);
  const promoTotalStockouts = promoFilteredProducts.reduce((sum, p) => sum + (p.stockout_store_count || 0), 0);
  const promoAvailability = promoTotalCombos > 0
    ? Math.round((100 - (promoTotalStockouts / promoTotalCombos) * 100) * 10) / 10
    : 100;

  const hasStoreFilter = Boolean(
    (filters?.selectedArea && filters.selectedArea !== 'ALL') ||
    (filters?.selectedSubArea && filters.selectedSubArea !== 'ALL') ||
    (filters?.selectedStore && filters.selectedStore !== '')
  );

  const filteredStoreList = hasStoreFilter
    ? store_performances.filter((s) => {
        if (filters?.selectedStore && s.store !== filters.selectedStore) return false;
        if (filters?.selectedArea && filters.selectedArea !== 'ALL' && s.area !== filters.selectedArea) return false;
        if (filters?.selectedSubArea && filters.selectedSubArea !== 'ALL' && s.sub_area !== filters.selectedSubArea) return false;
        return true;
      })
    : store_performances;

  const storeFc = filteredStoreList.reduce((sum, s) => sum + (s.total_fc || 0), 0);
  const storeSale = filteredStoreList.reduce((sum, s) => sum + (s.total_sale || 0), 0);
  const storeAchievement = storeFc > 0 ? (storeSale / storeFc) * 100 : 0;
  const storeStock = filteredStoreList.reduce((sum, s) => sum + (s.total_stock || 0), 0);
  const storeStockoutCount = filteredStoreList.reduce((sum, s) => sum + (s.stockout_count > 0 ? 1 : 0), 0);
  const storeTotalCombos = filteredStoreList.reduce((sum, s) => sum + (s.product_count || 0), 0);
  const storeTotalStockouts = filteredStoreList.reduce((sum, s) => sum + (s.stockout_count || 0), 0);
  const storeAvailability = storeTotalCombos > 0
    ? Math.round((100 - (storeTotalStockouts / storeTotalCombos) * 100) * 10) / 10
    : 100;

  const totalFc = hasPromoFilter
    ? (viewMode === 'PCS' ? promoFc : promoFc * PRICE_MULTIPLIER)
    : hasStoreFilter
    ? (viewMode === 'PCS' ? storeFc : storeFc * PRICE_MULTIPLIER)
    : (viewMode === 'PCS' 
        ? (kpi_cards.total_forecast || 0) 
        : ((kpi_cards.total_forecast_azn && kpi_cards.total_forecast_azn > 0) ? kpi_cards.total_forecast_azn : (kpi_cards.total_forecast || 0) * PRICE_MULTIPLIER));

  const totalSale = hasPromoFilter
    ? (viewMode === 'PCS' ? promoSale : promoSale * PRICE_MULTIPLIER)
    : hasStoreFilter
    ? (viewMode === 'PCS' ? storeSale : storeSale * PRICE_MULTIPLIER)
    : (viewMode === 'PCS' ? (kpi_cards.total_sales || 0) : (kpi_cards.total_sales || 0) * PRICE_MULTIPLIER);

  const achievementRate = hasPromoFilter
    ? Math.round(promoAchievement * 10) / 10
    : hasStoreFilter
    ? Math.round(storeAchievement * 10) / 10
    : (kpi_cards.achievement_pct || 0);

  const effectiveStock = hasPromoFilter ? promoStock : (hasStoreFilter ? storeStock : (kpi_cards.total_stock || 0));
  const effectiveStockoutCount = hasPromoFilter ? promoStockoutCount : (hasStoreFilter ? storeStockoutCount : (kpi_cards.stockout_stores_count || 0));

  const baseAvailability = Number(kpi_cards.availability_pct ?? (100 - (kpi_cards.stockout_rate_pct || 0)));
  const effectiveAvailability = hasPromoFilter
    ? promoAvailability
    : hasStoreFilter
    ? storeAvailability
    : baseAvailability;

  const stockoutSubtext = hasPromoFilter
    ? (filters?.selectedProduct
        ? `Stokout: ${promoFilteredProducts[0]?.stockout_store_count || 0} mğ.`
        : `Stokout: ${effectiveStockoutCount} məhsul`)
    : hasStoreFilter
    ? `Stokout: ${effectiveStockoutCount} mğ.`
    : `Stokout: ${kpi_cards.stockout_stores_count || 0} mğ.`;

  const availabilitySubtext = hasPromoFilter
    ? `OSA (${promoFilteredProducts.length} məhsul üzrə)`
    : hasStoreFilter
    ? `OSA (${filteredStoreList.length} mağaza üzrə)`
    : "Total Mağaza Mövcudluğu (OSA)";

  // Pro-rata & Projection calculation using actual campaign dates when available
  const activeCampaign = campaigns?.find((c) => c.is_active) || campaigns?.find((c) => c.id === activeCampaignId) || campaigns?.[0];
  let calculatedDuration = 14;
  let calculatedElapsed = 1;
  if (activeCampaign?.beg_date && activeCampaign?.end_date) {
    const b = new Date(activeCampaign.beg_date);
    const e = new Date(activeCampaign.end_date);
    if (!isNaN(b.getTime()) && !isNaN(e.getTime())) {
      calculatedDuration = Math.max(1, Math.round((e.getTime() - b.getTime()) / (1000 * 3600 * 24)) + 1);
      const today = new Date();
      if (today < b) {
        calculatedElapsed = 1;
      } else if (today > e) {
        calculatedElapsed = calculatedDuration;
      } else {
        calculatedElapsed = Math.max(1, Math.round((today.getTime() - b.getTime()) / (1000 * 3600 * 24)) + 1);
      }
    }
  } else if ((daily_summaries || []).length > 0) {
    calculatedDuration = daily_summaries.length;
    calculatedElapsed = daily_summaries.length;
  }

  const totalDays = calculatedDuration;
  const daysPassed = calculatedElapsed;
  const dailyRunRate = totalSale / Math.max(daysPassed, 1);
  const projectedFinalSales = dailyRunRate * totalDays;
  const projectedAchievement = totalFc > 0 ? (projectedFinalSales / totalFc * 100) : 0;

  // Build Daily Cumulative Trend Data using real per-day sales breakdown
  const rawDailySales = (data as any)?.daily_sales as DailySalesRecord[] | null | undefined;
  const hasDailySales = Boolean(rawDailySales && Array.isArray(rawDailySales) && rawDailySales.length > 0);

  const dailyTrendData = hasDailySales
    ? rawDailySales!.map((d, idx) => {
        const isNullDay = d.daily_sale === null || d.daily_sale === undefined;
        const daySales = isNullDay
          ? null
          : (viewMode === 'PCS' ? d.daily_sale : d.daily_amount);
        const cumPct = isNullDay
          ? null
          : (viewMode === 'PCS' ? d.cumulative_pct : d.cumulative_amount_pct);
        const dailySinglePct = isNullDay
          ? null
          : (viewMode === 'PCS' ? d.daily_pct : d.daily_amount_pct);

        return {
          date: d.date || `Gün ${idx + 1}`,
          dayIndex: d.day || idx + 1,
          dailySales: daySales !== null ? Math.round(daySales! * 10) / 10 : null,
          cumPct: cumPct !== null ? Math.round(cumPct! * 10) / 10 : null,
          dailySinglePct: dailySinglePct !== null ? Math.round(dailySinglePct! * 10) / 10 : null,
          idealProRataPct: d.ideal_pct !== null ? Math.round(d.ideal_pct! * 10) / 10 : null,
          partial: Boolean(d.partial),
          isFuture: Boolean(d.is_future)
        };
      })
    : [];

  const realCumValues = dailyTrendData
    .filter(d => d.cumPct !== null && d.cumPct !== undefined)
    .map(d => d.cumPct as number);
  const maxCumVal = realCumValues.length > 0 ? Math.max(...realCumValues) : 0;
  const lastRealIndex = dailyTrendData.map(d => d.cumPct !== null).lastIndexOf(true);

  const sparklineSalesSeries = dailyTrendData
    .filter(d => d.dailySales !== null && d.dailySales !== undefined)
    .map(d => Number(d.dailySales) || 0);

  const sparklineCumSeries = dailyTrendData
    .filter(d => d.cumPct !== null && d.cumPct !== undefined)
    .map(d => Number(d.cumPct) || 0);

  return (
    <div className="space-y-6 pb-12 text-xs">
      {/* Top Header & View Mode Toggle with Dynamic Animated Satış Reallaşması Widget */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-md shadow-slate-200/50 dark:shadow-none">
        <div className="shrink-0">
          <div className="flex items-center space-x-2">
            <span className="p-1.5 bg-blue-600 text-white rounded-lg font-bold text-sm shadow-sm shadow-blue-500/20">📈</span>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
              Satışlar & Trendlər
              {achievementRate >= 70 && (
                <Sparkles className="w-4 h-4 text-amber-400 fill-amber-300 animate-pulse" />
              )}
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('section_daily_progress_sub')}</p>
        </div>

        {/* Executive Dynamic Yellow-to-Blue Progress Stream */}
        <div className="hidden lg:flex items-center flex-1 mx-3 lg:mx-6 h-10 px-3 rounded-full bg-gradient-to-r from-amber-50/80 via-cyan-50/50 to-blue-50/80 dark:from-amber-950/30 dark:via-cyan-950/30 dark:to-blue-950/30 border border-slate-200/90 dark:border-slate-700 shadow-xs shadow-blue-500/5 relative overflow-hidden group transition-all duration-300 hover:border-blue-300 dark:hover:border-blue-500">
          {/* Background Ambient Pulsing Glow */}
          <div className="absolute inset-0 bg-gradient-to-r from-amber-400/15 via-cyan-400/15 to-blue-600/15 animate-pulse pointer-events-none z-0" />

          {/* Background Sine Wave Track SVG */}
          <div className="absolute inset-0 flex items-center px-4 pointer-events-none opacity-85 z-0">
            <svg className="w-full h-6 overflow-visible" preserveAspectRatio="none" viewBox="0 0 400 24">
              <path
                className="animate-wave-flow"
                d="M0,12 C40,4 60,20 100,12 C140,4 160,20 200,12 C240,4 260,20 300,12 C340,4 360,20 400,12"
                fill="none"
                stroke="#3b82f6"
                strokeDasharray="4 4"
                strokeWidth="1.5"
                strokeOpacity="0.65"
              />
            </svg>
          </div>

          {/* Sparkle Stars Scattered Along Track (Yellow to Blue Spectrum) */}
          <div className="absolute inset-0 flex items-center justify-between px-6 pointer-events-none z-10">
            <SparkleStar className="w-3.5 h-3.5 text-amber-400 fill-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.8)] animate-float-twinkle" />
            <SparkleStar className="w-4 h-4 text-amber-500 fill-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.8)] animate-float-twinkle" style={{ animationDelay: '0.4s' }} />
            <SparkleStar className="w-3 h-3 text-cyan-400 fill-cyan-300 drop-shadow-[0_0_5px_rgba(34,211,238,0.7)] animate-float-twinkle" style={{ animationDelay: '0.8s' }} />
            <SparkleStar className="w-4.5 h-4.5 text-cyan-400 fill-cyan-300 drop-shadow-[0_0_10px_rgba(34,211,238,0.9)] animate-float-twinkle" style={{ animationDelay: '1.2s' }} />
            <SparkleStar className="w-3 h-3 text-blue-400 fill-blue-300 drop-shadow-[0_0_5px_rgba(96,165,250,0.7)] animate-float-twinkle" style={{ animationDelay: '1.6s' }} />
            <SparkleStar className="w-4.5 h-4.5 text-blue-500 fill-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.9)] animate-bounce" style={{ animationDuration: '2.4s' }} />
          </div>

          {/* Dynamic Yellow-to-Blue Gradient Progress Stream */}
          <div
            className="h-7 rounded-full bg-gradient-to-r from-amber-400 via-yellow-400 via-cyan-400 to-blue-600 relative overflow-hidden shadow-[0_2px_10px_rgba(37,99,235,0.35)] transition-all duration-1000 ease-out z-20 flex items-center justify-end px-1.5"
            style={{ width: `${Math.min(achievementRate, 100)}%` }}
          >
            {/* Gloss Surface Top Highlight */}
            <div className="absolute top-0 inset-x-0 h-[45%] bg-gradient-to-b from-white/80 via-white/25 to-transparent rounded-t-full pointer-events-none" />
            
            {/* Shimmer Light Reflection */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/85 to-transparent w-1/2 -skew-x-12 animate-bar-shimmer-3d pointer-events-none" />

            {/* Glowing Pill Badge */}
            <div className="relative z-30 flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-200 border border-blue-200/90 dark:border-blue-800 shadow-xs font-semibold text-xs font-mono shrink-0">
              <SparkleStar className="w-3.5 h-3.5 text-blue-500 fill-blue-400 animate-pulse" />
              <AnimatedCounter value={achievementRate} decimals={1} suffix="%" />
            </div>
          </div>
        </div>

        {/* View Mode Selector Toggle: Adet (Pcs) vs Tutar (₼) */}
        <div className="flex items-center bg-slate-100/90 dark:bg-slate-800/90 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-x-1 shrink-0">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 px-2">{t('lbl_trend_view_mode')}</span>
          <button
            onClick={() => setViewMode('PCS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'PCS'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {t('lbl_pcs_unit')}
          </button>
          <button
            onClick={() => setViewMode('AZN')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'AZN'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {t('lbl_azn_unit')}
          </button>
        </div>
      </div>

      {/* Global Sales & Trend KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Neytral/məlumat xarakterli: Toplam Öngörü -> soft light blue */}
        <KPICard
          index={0}
          title={viewMode === 'PCS' ? t('kpi_total_forecast_pcs') : t('kpi_total_forecast_azn')}
          value={viewMode === 'PCS' ? `${totalFc.toLocaleString()} u` : `₼ ${totalFc.toLocaleString()}`}
          icon={TrendingUp}
          color="blue"
          variant="soft"
          subtext="Target Forecast"
        />
        {/* Reallaşan Satış -> solid emerald */}
        <KPICard
          index={1}
          title={viewMode === 'PCS' ? t('kpi_actual_sales_pcs') : t('kpi_actual_sales_azn')}
          value={viewMode === 'PCS' ? `${totalSale.toLocaleString()} u` : `₼ ${totalSale.toLocaleString()}`}
          icon={Activity}
          color="emerald"
          variant="solid"
          trend={`✨ Nailiyyət: ${achievementRate}%`}
          sparklineData={sparklineSalesSeries.length > 1 ? sparklineSalesSeries : undefined}
        />
        {/* Nailiyyət Faizi -> solid emerald if >=70% else amber */}
        <KPICard
          index={2}
          title={t('kpi_target_achievement')}
          value={`${achievementRate}%`}
          icon={Target}
          color={achievementRate >= 70 ? 'emerald' : 'amber'}
          variant="solid"
          subtext="Actual vs Target"
          sparklineData={sparklineCumSeries.length > 1 ? sparklineCumSeries : undefined}
        />
        {/* Dövr Sonu Proqnoz -> soft emerald or amber */}
        <KPICard
          index={3}
          title={t('kpi_period_forecast')}
          value={`${projectedAchievement.toFixed(1)}%`}
          icon={Rocket}
          color={projectedAchievement >= 90 && projectedAchievement <= 110 ? 'emerald' : 'amber'}
          variant="soft"
          subtext={`Günlük Satış: ${Math.round(dailyRunRate)} u/gün`}
        />
        {/* Neytral/məlumat xarakterli: Mağaza Stoku -> solid indigo */}
        <KPICard
          index={4}
          title={viewMode === 'PCS' ? t('kpi_store_stock') : `${t('kpi_store_stock')} (₼)`}
          value={viewMode === 'PCS' ? `${Math.round(effectiveStock).toLocaleString()} u` : `₼ ${Math.round(effectiveStock * PRICE_MULTIPLIER).toLocaleString()}`}
          icon={Layers}
          color="indigo"
          variant="solid"
          subtext={stockoutSubtext}
        />

        {/* Ort. Mövcudluq -> soft blue or rose */}
        <KPICard
          index={5}
          title={t('kpi_avg_availability')}
          value={`${effectiveAvailability.toFixed(1)}%`}
          icon={Store}
          color={effectiveAvailability >= 85 ? 'blue' : 'rose'}
          variant="soft"
          subtext={availabilitySubtext}
        />
      </div>

      {/* 1. Hedefe Doğru Günlük Gerçekleşme (Daily Cumulative & Daily Progress) */}
      <div className={`p-6 rounded-2xl border shadow-xl space-y-4 card-hover relative overflow-hidden transition-all duration-300 luminous-border-blue ${
        isDark
          ? 'bg-slate-900 border-slate-800 shadow-slate-950/60'
          : 'bg-gradient-to-b from-white via-white to-blue-50/20 border-blue-200/80 shadow-blue-500/10'
      }`}>
        {/* Top delicate luminous blue accent line */}
        <div className="absolute top-0 inset-x-0 h-[2px] luminous-line-blue z-20" />

        {/* Subtle Ambient Background Light Stream */}
        <div className={`absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl pointer-events-none ${
          isDark
            ? 'bg-gradient-to-br from-blue-600/10 via-indigo-500/5 to-transparent'
            : 'bg-gradient-to-br from-blue-500/10 via-emerald-400/5 to-transparent animate-pulse'
        }`} />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
          <div>
            <h3 className="text-base font-black tracking-tight bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600 dark:from-blue-400 dark:via-blue-300 dark:to-indigo-300 bg-clip-text text-transparent flex items-center gap-2 drop-shadow-[0_1px_4px_rgba(20,121,232,0.25)]">
              {t('section_daily_progress_title')}
              <span className="px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 text-[10px] font-black border border-blue-300/80 dark:border-blue-700/60 shadow-xs flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                {totalDays} Günlük Trend
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('section_daily_progress_sub')}</p>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-black text-amber-900 dark:text-amber-200 bg-amber-50/90 dark:bg-amber-950/80 px-3 py-1 rounded-xl border border-amber-400/70 dark:border-amber-500/60 shadow-xs flex items-center gap-1.5 luminous-cell-amber">
              🏆 Max: <strong className="text-amber-600 dark:text-amber-400 font-extrabold"><AnimatedCounter value={maxCumVal} suffix="%" /></strong>
            </span>
            <span className="text-xs font-black text-blue-700 dark:text-blue-300 bg-blue-50/90 dark:bg-blue-950/80 px-3 py-1 rounded-xl border border-blue-300/80 dark:border-blue-700/60 shadow-xs">
              {viewMode === 'PCS' ? t('lbl_view_pcs') : t('lbl_view_azn')}
            </span>
          </div>
        </div>

        {!hasDailySales ? (
          <div className="h-72 w-full flex flex-col items-center justify-center bg-slate-50/60 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-8 text-center relative z-10">
            <div className="p-3.5 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-400 mb-3 shadow-inner">
              <CalendarX className="w-8 h-8 text-slate-400 stroke-[2]" />
            </div>
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('lbl_daily_data_empty_title')}</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">{t('lbl_daily_data_empty_sub')}</p>
          </div>
        ) : (
          <div className="h-96 w-full relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dailyTrendData} margin={{ top: 35, right: 65, left: 10, bottom: 10 }}>
                <defs>
                  <linearGradient id="cumBlueArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1479e8" stopOpacity={0.45}/>
                    <stop offset="50%" stopColor="#3b82f6" stopOpacity={0.18}/>
                    <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.0}/>
                  </linearGradient>

                  <linearGradient id="dailyEmeraldArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.25}/>
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0.0}/>
                  </linearGradient>

                  {/* Neon Glow Filters for Lines */}
                  <filter id="neonGlowBlue" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComponentTransfer in="blur" result="glow">
                      <feFuncA type="linear" slope="0.7" />
                    </feComponentTransfer>
                    <feMerge>
                      <feMergeNode in="glow" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>

                  <filter id="neonGlowEmerald" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComponentTransfer in="blur" result="glow">
                      <feFuncA type="linear" slope="0.7" />
                    </feComponentTransfer>
                    <feMerge>
                      <feMergeNode in="glow" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#e2e8f0'} strokeOpacity={0.7} />
                <XAxis 
                  dataKey="date" 
                  stroke={isDark ? '#475569' : '#64748b'} 
                  tick={{ fontSize: 11, fontWeight: 700, fill: isDark ? '#94a3b8' : '#64748b' }}
                  tickFormatter={(val: string) => {
                    if (!val) return '';
                    const parts = String(val).split('-');
                    return parts.length === 3 ? `${parts[2]}.${parts[1]}` : val;
                  }}
                />
                <YAxis
                  stroke={isDark ? '#475569' : '#64748b'}
                  tick={{ fontSize: 11, fontWeight: 700, fill: isDark ? '#94a3b8' : '#64748b' }}
                  unit="%"
                  domain={[0, (dataMax: number) => Math.max(100, Math.ceil((dataMax || 100) * 1.05))]}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const item = payload[0]?.payload;
                    if (!item) return null;

                    return (
                      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-3.5 rounded-xl border border-blue-200 dark:border-slate-700 shadow-xl text-xs space-y-2 min-w-[210px] text-slate-800 dark:text-slate-100">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                          <span className="font-extrabold text-slate-800 dark:text-slate-100">{item.date}</span>
                          {item.partial && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 text-[10px] font-bold border border-amber-200 dark:border-amber-800">
                              ⚠️ {t('lbl_partial_day')}
                            </span>
                          )}
                          {item.isFuture && (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold">
                              ⏳ Gələcək gün
                            </span>
                          )}
                        </div>

                        <div className="space-y-1.5 pt-0.5">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">
                              {viewMode === 'PCS' ? 'Gündəlik Satış:' : 'Gündəlik Məbləğ:'}
                            </span>
                            <span className="font-bold text-slate-900 dark:text-white">
                              {item.dailySales !== null && item.dailySales !== undefined
                                ? `${item.dailySales.toLocaleString()} ${viewMode === 'PCS' ? 'ədəd' : '₼'}`
                                : '—'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              Gündəlik %:
                            </span>
                            <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                              {item.dailySinglePct !== null && item.dailySinglePct !== undefined ? `${item.dailySinglePct}%` : '—'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-blue-500" />
                              Kümülyativ %:
                            </span>
                            <span className="font-extrabold text-blue-600 dark:text-blue-400">
                              {item.cumPct !== null && item.cumPct !== undefined ? `${item.cumPct}%` : '—'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-1.5">
                            <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-slate-400" />
                              {t('legend_ideal_plan')}:
                            </span>
                            <span className="font-bold text-slate-600 dark:text-slate-300">
                              {item.idealProRataPct !== null && item.idealProRataPct !== undefined ? `${item.idealProRataPct}%` : '—'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px', fontWeight: 800 }} />

                {/* 🎯 100% Target Milestone Reference Line */}
                <ReferenceLine
                  y={100}
                  stroke={isDark ? '#10b981' : '#059669'}
                  strokeDasharray="6 6"
                  strokeWidth={2}
                  label={{
                    value: '🎯 100% Hədəf Xətti',
                    fill: isDark ? '#34d399' : '#059669',
                    fontSize: 11,
                    fontWeight: 900,
                    position: 'insideTopLeft'
                  }}
                />

                {/* 3. İdeal plan (pro-rata) series - dashed gray line over full campaign */}
                <Line
                  type="monotone"
                  dataKey="idealProRataPct"
                  stroke={isDark ? '#475569' : '#94a3b8'}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name={t('legend_ideal_plan')}
                  dot={{ r: 3, fill: isDark ? '#64748b' : '#94a3b8', stroke: isDark ? '#0f172a' : '#ffffff', strokeWidth: 1.5 }}
                  activeDot={{ r: 5, fill: isDark ? '#94a3b8' : '#64748b', stroke: isDark ? '#0f172a' : '#ffffff', strokeWidth: 2 }}
                  isAnimationActive={false}
                  connectNulls={false}
                />
                
                {/* Vibrant Illuminated Area Gradient under Cumulative Trend */}
                <Area
                  type="monotone"
                  dataKey="cumPct"
                  fill="url(#cumBlueArea)"
                  stroke="none"
                  legendType="none"
                  tooltipType="none"
                  connectNulls={false}
                />

                {/* Soft Gradient under Single Daily Progress */}
                <Area
                  type="monotone"
                  dataKey="dailySinglePct"
                  fill="url(#dailyEmeraldArea)"
                  stroke="none"
                  legendType="none"
                  tooltipType="none"
                  connectNulls={false}
                />

                {/* Cumulative Progress Line */}
                <Line
                  type="monotone"
                  dataKey="cumPct"
                  stroke="#1479e8"
                  strokeWidth={3.8}
                  strokeDasharray="12 6"
                  className="animate-line-stroke-flow"
                  filter="url(#neonGlowBlue)"
                  connectNulls={false}
                  dot={(props: any) => {
                    const { cx, cy, value, payload, index } = props;
                    if (cx === undefined || cy === undefined || value === null || value === undefined) return null;
                    const isMax = index === lastRealIndex;
                    const isPartial = payload?.partial;
                    return (
                      <g key={`dot-blue-${index}`}>
                        {isMax && (
                          <circle cx={cx} cy={cy} r={12} fill="#1479e8" opacity={0.3} className="animate-ping" />
                        )}
                        <circle
                          cx={cx}
                          cy={cy}
                          r={isMax ? 7 : 5}
                          fill={isPartial ? '#ffffff' : '#1479e8'}
                          stroke="#1479e8"
                          strokeWidth={isPartial ? 3 : 2.5}
                          filter="url(#neonGlowBlue)"
                        />
                      </g>
                    );
                  }}
                  activeDot={{ r: 9, fill: '#3b82f6', strokeWidth: 3, stroke: '#ffffff' }}
                  isAnimationActive={true}
                  animationDuration={1500}
                  animationEasing="ease-out"
                  name={t('legend_cumulative_pct')}
                  label={(props: any) => {
                    const { x, y, value, index } = props;
                    if (x === undefined || y === undefined || value === null || value === undefined) return null;
                    const isMax = index === lastRealIndex;
                    if (isMax) {
                      return (
                        <g key={index} className="animate-pulse">
                          <rect x={x - 42} y={y - 32} width="84" height="22" rx="7" fill="#1479e8" filter="url(#neonGlowBlue)" className="shadow-lg" />
                          <text x={x} y={y - 17} fill="#ffffff" fontSize={11} fontWeight="900" textAnchor="middle">
                            🏆 Max {value}%
                          </text>
                        </g>
                      );
                    }
                    return (
                      <text key={index} x={x} y={y - 12} fill={isDark ? '#60a5fa' : '#0c4ea4'} fontSize={11} fontWeight="800" textAnchor="middle">
                        {value}%
                      </text>
                    );
                  }}
                />

                {/* Günlük Tekil İlerleme % Line */}
                <Line
                  type="monotone"
                  dataKey="dailySinglePct"
                  stroke="#10b981"
                  strokeWidth={3.5}
                  strokeDasharray="10 5"
                  className="animate-line-stroke-flow"
                  filter="url(#neonGlowEmerald)"
                  connectNulls={false}
                  dot={(props: any) => {
                    const { cx, cy, value, payload, index } = props;
                    if (cx === undefined || cy === undefined || value === null || value === undefined) return null;
                    const isPartial = payload?.partial;
                    return (
                      <g key={`dot-emerald-${index}`}>
                        <circle
                          cx={cx}
                          cy={cy}
                          r={5}
                          fill={isPartial ? '#ffffff' : '#10b981'}
                          stroke="#10b981"
                          strokeWidth={isPartial ? 3 : 2.5}
                          filter="url(#neonGlowEmerald)"
                        />
                      </g>
                    );
                  }}
                  activeDot={{ r: 8, fill: '#34d399', strokeWidth: 3, stroke: '#ffffff' }}
                  isAnimationActive={true}
                  animationDuration={1500}
                  animationEasing="ease-out"
                  name={t('legend_daily_single_pct')}
                  label={(props: any) => {
                    const { x, y, value, index } = props;
                    if (x === undefined || y === undefined || value === null || value === undefined) return null;
                    return (
                      <text key={index} x={x} y={y - 12} fill={isDark ? '#34d399' : '#047857'} fontSize={11} fontWeight="800" textAnchor="middle">
                        {value}%
                      </text>
                    );
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* 2. Kampanya Mevcut Durum Göstergesi (Professional Achievement Meter) */}
      <div className={`p-6 rounded-2xl border shadow-md space-y-6 transition-all duration-300 relative overflow-hidden ${
        achievementRate >= 80 ? 'luminous-border-amber' : 'luminous-border-blue'
      } ${
        isDark ? 'bg-slate-900 border-slate-800 shadow-none' : 'bg-white border-slate-100 shadow-slate-200/50'
      }`}>
        {/* Top delicate luminous line */}
        <div className={`absolute top-0 inset-x-0 h-[2px] ${achievementRate >= 80 ? 'luminous-line-amber' : 'luminous-line-blue'} z-20`} />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              <Target className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Kampaniya Mövcud Vəziyyət Göstəricisi</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Ümumi kampaniya hədəfinə qarşı mövcud satış reallaşma göstəricisi</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className={`px-3 py-1 rounded-full text-xs font-black border uppercase tracking-wide ${
              achievementRate >= 80
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800'
                : achievementRate >= 40
                ? 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-800'
                : 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-800'
            }`}>
              {achievementRate >= 80 ? '🟢 Uğurlu Reallaşma' : achievementRate >= 40 ? '🔵 Orta Performans' : '🔴 Kritik Hədd'}
            </span>
          </div>
        </div>

        {/* Center Meter Arc & Numbers */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* Circular Gauge Arc */}
          <div className={`md:col-span-5 flex flex-col items-center justify-center p-4 rounded-2xl border shadow-inner ${
            isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-gradient-to-b from-slate-50 to-white border-slate-100'
          }`}>
            <div className="relative w-52 h-52 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" stroke={isDark ? "#1e293b" : "#e2e8f0"} strokeWidth="8" fill="transparent" />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke={achievementRate >= 80 ? '#10b981' : achievementRate >= 40 ? '#1479e8' : '#f43f5e'}
                  strokeWidth="8"
                  strokeDasharray="251.2"
                  strokeDashoffset={251.2 - (251.2 * Math.min(achievementRate, 100)) / 100}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">{achievementRate}%</span>
                <span className="text-[11px] font-extrabold text-blue-700 dark:text-blue-400 uppercase tracking-wider mt-0.5">{t('kpi_target_achievement')}</span>
              </div>
            </div>
          </div>

          {/* Key Metrics Summary Cards */}
          <div className="md:col-span-7 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <SpotlightCard spotlightColor="blue" glowBorder="blue" variant="subtle" className="p-3.5 space-y-1">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">{t('kpi_total_forecast_pcs').replace(' (Ədəd)', '')}</span>
                <p className="text-base font-black text-slate-900 dark:text-white">
                  <AnimatedCounter
                    value={totalFc}
                    prefix={viewMode === 'PCS' ? '' : '₼ '}
                    suffix={viewMode === 'PCS' ? ' u' : ''}
                  />
                </p>
              </SpotlightCard>

              <SpotlightCard spotlightColor="emerald" glowBorder="emerald" variant="subtle" className="p-3.5 space-y-1">
                <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block">{t('kpi_actual_sales_pcs').replace(' (Ədəd)', '')}</span>
                <p className="text-base font-black text-emerald-700 dark:text-emerald-400">
                  <AnimatedCounter
                    value={totalSale}
                    prefix={viewMode === 'PCS' ? '' : '₼ '}
                    suffix={viewMode === 'PCS' ? ' u' : ''}
                  />
                </p>
              </SpotlightCard>

              <SpotlightCard spotlightColor="cyan" glowBorder="cyan" variant="subtle" className="p-3.5 space-y-1">
                <span className="text-[10px] font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider block">Qalan Proqnoz Hədəfi</span>
                <p className="text-base font-black text-blue-700 dark:text-blue-400">
                  <AnimatedCounter
                    value={Math.max(totalFc - totalSale, 0)}
                    prefix={viewMode === 'PCS' ? '' : '₼ '}
                    suffix={viewMode === 'PCS' ? ' u' : ''}
                  />
                </p>
              </SpotlightCard>
            </div>

            {/* Target Progress Bar with Milestone Markers */}
            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300">
                <span>Hədəfə İrəliləmə Qrafiki:</span>
                <span className="text-slate-900 dark:text-white font-extrabold">{achievementRate}% Tamamlandı</span>
              </div>
              <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700 flex">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    achievementRate >= 80 ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' :
                    achievementRate >= 40 ? 'bg-gradient-to-r from-blue-400 to-blue-600' : 'bg-gradient-to-r from-rose-400 to-rose-600'
                  }`}
                  style={{ width: `${Math.min(achievementRate, 100)}%` }}
                />
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-[10px] pt-1">
                <div className="p-2 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 rounded-xl font-bold text-rose-700 dark:text-rose-400">0 - 40%: Kritik</div>
                <div className="p-2 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900/60 rounded-xl font-bold text-blue-800 dark:text-blue-300">40 - 80%: Orta</div>
                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900/60 rounded-xl font-bold text-emerald-800 dark:text-emerald-400">80 - 100%: Uğurlu</div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
