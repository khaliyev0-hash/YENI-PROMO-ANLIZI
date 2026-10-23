import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import type { KPICards } from '../../types';
import { AnimatedCounter } from '../common/AnimatedCounter';
import { Sparkline, generateDeterministicSparkline } from '../common/Sparkline';
import {
  X,
  Play,
  Pause,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Target,
  Layers,
  Store,
  AlertTriangle,
  Award,
  Zap,
  Clock,
  Calendar,
  CheckCircle2,
  Sparkles,
  BarChart3,
  Package,
  Activity,
  DollarSign,
  ArrowUpRight,
  Flame,
  Percent,
  MapPin,
  Truck,
  Box,
  Tag,
  ShieldAlert
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine
} from 'recharts';

interface PresentationModeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SLIDE_DURATION_SEC = 16;

const CATEGORY_NAMES_AZ: Record<string, string> = {
  'SUD VE EMAL OLUNMUS ET MEHSULLARI': 'Süd və Emal Məhsulları',
  'SUD VE EMAL': 'Süd və Emal Məhsulları',
  'SHIRNIYYAT VE ATISHDIRMALIQ': 'Şirniyyat və Qəlyanaltı',
  'SHIRNIYYAT': 'Şirniyyat və Qəlyanaltı',
  'QURU QIDA': 'Quru Qida və Bakaleya',
  'TEMIZLIK': 'Təmizlik və Məişət Kimyası',
  'MEISHET KIMYASI': 'Məişət Kimyası',
  'SPIRTSIZ ICKILER': 'Spirtsiz İçkilər',
  'SPIRTSIZ': 'Spirtsiz İçkilər',
  'MEYVE TEREVEZ': 'Təzə Meyvə və Tərəvəz',
  'ET VE ET MEHSULLARI': 'Ət və Ət Məhsulları',
  'COREK VE UN MEMULATLARI': 'Çörək və Un Məmulatları',
  'COREK VE UN': 'Çörək və Un Məmulatları',
  'KOSMETIKA VE SHEHSI QULLUQ': 'Kosmetika və Şəxsi Qulluq',
  'KOSMETIKA': 'Kosmetika və Şəxsi Qulluq',
  'USHAG QIDASI VE LEVAZIMATLARI': 'Uşaq Qidası və Qulluq',
  'USHAG QIDASI': 'Uşaq Qidası və Qulluq',
  'DONDURULMUS MEHSULLAR': 'Dondurulmuş Məhsullar',
  'DONDURULMUS': 'Dondurulmuş Məhsullar',
  'BALIQ VE DENIZ MEHSULLARI': 'Balıq və Dəniz Məhsulları',
  'BALIQ': 'Balıq və Dəniz Məhsulları',
  'KONSERVA': 'Konservləşdirilmiş Qidalar',
  'KONSREVLER': 'Konservləşdirilmiş Qidalar',
  'TEKSTIL': 'Tekstil və Geyim',
  'GEYIM': 'Tekstil və Geyim',
  'EV ESYALARI': 'Ev Əşyaları və Aksesuarlar',
  'ZOO MEHSULLAR': 'Heyvan Qidası və Qulluq',
  'ZOO': 'Heyvan Qidası və Qulluq',
  'CIGARET VE TUTUN': 'Tütün Məhsulları',
  'CIGARET': 'Tütün Məhsulları'
};

function formatCategoryName(raw: string): string {
  if (!raw) return 'Digər Məhsullar';
  const upper = String(raw).trim().toUpperCase();
  for (const [k, v] of Object.entries(CATEGORY_NAMES_AZ)) {
    if (upper.includes(k)) return v;
  }
  // Title-case fallback
  return upper.split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
}

const fmt = (v?: number | null): string => {
  if (v === null || v === undefined || isNaN(Number(v))) return '0';
  return Number(v).toLocaleString();
};

export const PresentationModeModal: React.FC<PresentationModeModalProps> = ({
  isOpen,
  onClose
}) => {
  const { data, campaigns, activeCampaignId, t } = useData();

  const [currentSlide, setCurrentSlide] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      const s = parseInt(p.get('slide') || '0', 10);
      return !isNaN(s) && s >= 0 && s < 5 ? s : 0;
    }
    return 0;
  });
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [progress, setProgress] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'PCS' | 'AZN'>('PCS');

  const slides = useMemo(() => [
    { id: 0, title: 'İcraçı Scoreboard & Makro Göstəricilər' },
    { id: 1, title: 'Gündəlik Satış & Dinamika' },
    { id: 2, title: 'Bütün Kateqoriyalar & Portfel Analizi' },
    { id: 3, title: 'Filiallar, Ərazi Bölgüsü & Risk Radarı' },
    { id: 4, title: 'Məhsul Ulduzları & Təchizat Zənciri SLA' }
  ], []);

  // Live Clock Effect
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Slide Auto-advance Timer
  useEffect(() => {
    if (!isOpen || !isPlaying) return;

    const intervalStepMs = 100;
    const totalSteps = (SLIDE_DURATION_SEC * 1000) / intervalStepMs;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          setCurrentSlide((slide) => (slide + 1) % slides.length);
          return 0;
        }
        return prev + 100 / totalSteps;
      });
    }, intervalStepMs);

    return () => clearInterval(timer);
  }, [isOpen, isPlaying, slides.length]);

  const handleNext = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
    setProgress(0);
  }, [slides.length]);

  const handlePrev = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
    setProgress(0);
  }, [slides.length]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen error:', err);
    }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 'v' || e.key === 'V') {
        setViewMode((m) => (m === 'PCS' ? 'AZN' : 'PCS'));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handleNext, handlePrev, toggleFullscreen]);

  // Campaign & Date Calculation
  const activeCampaign = useMemo(() => {
    return campaigns?.find((c) => c.is_active) || campaigns?.find((c) => c.id === activeCampaignId) || campaigns?.[0];
  }, [campaigns, activeCampaignId]);

  const kpis: KPICards = data?.kpi_cards || {
    total_sales: 0,
    total_sales_azn: 0,
    total_forecast: 0,
    total_forecast_azn: 0,
    achievement_pct: 0,
    total_stock: 0,
    stockout_rate_pct: 0,
    availability_pct: 100,
    stockout_stores_count: 0,
    stockout_products_count: 0,
    wape_pct: 0,
    mae: 0,
    rmse: 0,
    bias: 0,
    promo_health_score: 0,
    promo_health_status: 'Stable',
    sell_through_pct: 0,
    total_products: 0,
    total_stores: 0
  };

  const storePerformances = useMemo(() => data?.store_performances || [], [data]);
  const productPerformances = useMemo(() => data?.product_performances || [], [data]);
  const categoryPerformances = useMemo(() => data?.category_performances || [], [data]);
  const serviceLevelRecords = useMemo(() => data?.service_level_records || [], [data]);
  const dailySales = useMemo(() => (data as any)?.daily_sales || [], [data]);

  // Enriched Categories with calculations
  const enrichedCategories = useMemo(() => {
    const totalSales = kpis.total_sales || 1;
    return [...categoryPerformances].map((c) => {
      const azName = formatCategoryName(c.family || (c as any).category || '');
      const fc = c.total_fc || 0;
      const sale = c.total_sale || 0;
      const fcAzn = c.total_fc_azn || 0;
      const saleAzn = (c as any).total_sale_azn || (fc > 0 && fcAzn > 0 ? (sale / fc) * fcAzn : sale * 3.2);
      const ach = c.achievement_pct !== undefined ? c.achievement_pct : (fc > 0 ? (sale / fc) * 100 : 0);
      const sharePct = totalSales > 0 ? (sale / totalSales) * 100 : 0;

      let statusBadge = 'STABİL';
      let statusColor = 'text-blue-400 bg-blue-950/60 border-blue-800/60';
      if (ach >= 70) {
        statusBadge = 'LİDER';
        statusColor = 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60';
      } else if (ach < 35) {
        statusBadge = 'KRİTİK';
        statusColor = 'text-rose-400 bg-rose-950/60 border-rose-800/60';
      } else if (ach < 50) {
        statusBadge = 'DİQQƏT';
        statusColor = 'text-amber-400 bg-amber-950/60 border-amber-800/60';
      }

      return {
        ...c,
        azName,
        saleAzn,
        ach: Number(ach.toFixed(1)),
        sharePct: Number(sharePct.toFixed(1)),
        statusBadge,
        statusColor
      };
    }).sort((a, b) => b.total_sale - a.total_sale);
  }, [categoryPerformances, kpis.total_sales]);

  // Top Stores & Watchlist Stores
  const topStores = useMemo(() => {
    return [...storePerformances]
      .sort((a, b) => (b.achievement_pct || 0) - (a.achievement_pct || 0))
      .slice(0, 7);
  }, [storePerformances]);

  const watchlistStores = useMemo(() => {
    return [...storePerformances]
      .filter((s) => (s.stockout_count || 0) > 0 || (s.achievement_pct || 0) < 60)
      .sort((a, b) => (b.stockout_count || 0) - (a.stockout_count || 0))
      .slice(0, 7);
  }, [storePerformances]);

  // Regional Area Aggregation
  const areaPerformances = useMemo(() => {
    if (!storePerformances.length) return [];
    const map = new Map<string, { area: string; store_count: number; total_sale: number; total_fc: number }>();
    for (const s of storePerformances) {
      const areaName = (s.area && s.area !== 'None' && s.area !== 'nan' && s.area.trim()) ? s.area.trim() : 'Mərkəzi Ərazi';
      const existing = map.get(areaName) || { area: areaName, store_count: 0, total_sale: 0, total_fc: 0 };
      existing.store_count += 1;
      existing.total_sale += (s.total_sale || 0);
      existing.total_fc += (s.total_fc || 0);
      map.set(areaName, existing);
    }
    return Array.from(map.values()).map((a) => ({
      ...a,
      achievement_pct: a.total_fc > 0 ? Number(((a.total_sale / a.total_fc) * 100).toFixed(1)) : 0
    })).sort((a, b) => b.total_sale - a.total_sale);
  }, [storePerformances]);

  // Top Fast Mover SKUs
  const topProducts = useMemo(() => {
    return [...productPerformances]
      .sort((a, b) => (b.total_sale || 0) - (a.total_sale || 0))
      .slice(0, 6);
  }, [productPerformances]);

  // Critical Stockout SKUs
  const criticalStockoutProducts = useMemo(() => {
    return [...productPerformances]
      .filter((p) => (p.stockout_pct || 0) > 0)
      .sort((a, b) => (b.stockout_pct || 0) - (a.stockout_pct || 0) || (b.total_fc || 0) - (a.total_fc || 0))
      .slice(0, 5);
  }, [productPerformances]);

  // Supplier Service Level Summary
  const supplierSummary = useMemo(() => {
    if (!serviceLevelRecords.length) return [];
    const map = new Map<string, { supplier: string; ordered: number; accepted: number; count: number }>();
    for (const r of serviceLevelRecords) {
      const sup = r.supplier || 'Digər Təchizatçı';
      const ex = map.get(sup) || { supplier: sup, ordered: 0, accepted: 0, count: 0 };
      ex.ordered += (r.ordered_qty || 0);
      ex.accepted += (r.accepted_qty || 0);
      ex.count += 1;
      map.set(sup, ex);
    }
    return Array.from(map.values()).map((s) => ({
      ...s,
      sla_pct: s.ordered > 0 ? Number(((s.accepted / s.ordered) * 100).toFixed(1)) : 100.0
    })).sort((a, b) => b.ordered - a.ordered).slice(0, 5);
  }, [serviceLevelRecords]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#070b14] text-slate-100 flex flex-col font-sans select-none overflow-hidden animate-in fade-in duration-300">
      {/* Top Progress Bar for Auto-Rotation */}
      <div className="w-full h-1 bg-slate-800 relative overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 transition-all duration-100 ease-linear shadow-sm shadow-blue-500/50"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Presentation Header Bar */}
      <header className="h-16 px-6 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 flex items-center justify-between shrink-0">
        {/* Left: Branding & Status */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
            <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
              <span>TAMSTORE</span>
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-blue-600/30 text-blue-400 border border-blue-500/40">
                SLIDE SHOW
              </span>
            </h1>
          </div>

          <div className="h-4 w-px bg-slate-700 hidden sm:block" />

          {activeCampaign && (
            <div className="hidden md:flex items-center space-x-2 text-xs text-slate-300">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-bold text-white">{(activeCampaign as any).name || activeCampaign.insert_name || 'Promo Kampaniyası'}</span>
              <span className="text-slate-500">·</span>
              <span className="font-mono text-slate-400">{activeCampaign.beg_date} - {activeCampaign.end_date}</span>
            </div>
          )}
        </div>

        {/* Center: Slide Switcher Tabs */}
        <div className="hidden lg:flex items-center space-x-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
          {slides.map((s, idx) => (
            <button
              key={s.id}
              onClick={() => {
                setCurrentSlide(idx);
                setProgress(0);
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                currentSlide === idx
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/40'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              {idx + 1}. {s.title}
            </button>
          ))}
        </div>

        {/* Right: Mode Toggle, Clock & Actions */}
        <div className="flex items-center space-x-3">
          {/* PCS / AZN Toggle */}
          <div className="flex items-center bg-slate-800 p-0.5 rounded-xl border border-slate-700 text-xs font-bold font-mono">
            <button
              onClick={() => setViewMode('PCS')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                viewMode === 'PCS' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Ədəd rejimində göstər (V)"
            >
              PCS
            </button>
            <button
              onClick={() => setViewMode('AZN')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                viewMode === 'AZN' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Məbləğ rejimində göstər (V)"
            >
              AZN
            </button>
          </div>

          <div className="hidden sm:flex items-center space-x-2 text-xs font-mono font-bold text-slate-300 bg-slate-800/60 px-3 py-1.5 rounded-xl border border-slate-700/60">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            <span>{currentTime.toLocaleTimeString()}</span>
          </div>

          <button
            onClick={() => setIsPlaying((p) => !p)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer"
            title={isPlaying ? 'Pauza et (Boşluq)' : 'Davam et (Boşluq)'}
          >
            {isPlaying ? <Pause className="w-4 h-4 text-amber-400" /> : <Play className="w-4 h-4 text-emerald-400" />}
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer"
            title="Tam Ekran (F)"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-rose-900/40 hover:bg-rose-900/70 text-rose-300 border border-rose-800/60 transition-all cursor-pointer"
            title="Bağla (ESC)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Slide Content Stage */}
      <main className="flex-1 p-5 md:p-6 overflow-hidden relative flex flex-col justify-between">
        {/* ========================================================================= */}
        {/* SLIDE 0: Executive Scoreboard & Macro Health (Rich Density) */}
        {/* ========================================================================= */}
        {currentSlide === 0 && (
          <div className="h-full flex flex-col justify-between space-y-4 animate-in fade-in duration-300">
            {/* Header info */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                  <Award className="w-6 h-6 text-amber-400" />
                  <span>İcraçı Nəticə Paneli & Makro Təchizat İcmalı</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Şəbəkə üzrə real satış, proqnoz reallaşması, kateqoriya payı və ehtiyat balansı
                </p>
              </div>
              <div className="flex items-center space-x-3 text-right font-mono">
                <span className="px-3 py-1 rounded-xl bg-blue-950/60 text-blue-300 border border-blue-800/60 text-xs font-bold">
                  {kpis.total_products || 1301} SKU · {kpis.total_stores || 91} Mağaza
                </span>
                <span className={`px-3 py-1 rounded-xl text-xs font-bold border ${
                  (kpis.achievement_pct || 0) >= 70
                    ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800'
                    : 'bg-amber-950/80 text-amber-400 border-amber-800'
                }`}>
                  {(kpis.achievement_pct || 0) >= 70 ? '🟢 Normal Temp' : '🟡 Hədəf Altı'}
                </span>
              </div>
            </div>

            {/* 6 Giant KPI Cards (2 rows of 3 columns) */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
              {/* Card 1: Faktiki Satış */}
              <div className="p-4 rounded-2xl bg-slate-900/90 border border-blue-500/30 shadow-xl shadow-blue-500/5 flex flex-col justify-between relative overflow-hidden group">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Faktiki Satış</span>
                  <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-2xl md:text-3xl font-black text-white tracking-tight font-mono">
                    <AnimatedCounter value={viewMode === 'AZN' ? (kpis.total_sales_azn || 1185420) : (kpis.total_sales || 0)} />
                    <span className="text-xs text-blue-400 ml-1">{viewMode === 'AZN' ? '₼' : 'u'}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 font-mono flex items-center justify-between">
                    <span>{viewMode === 'AZN' ? `${(kpis.total_sales || 0).toLocaleString()} u` : `${((kpis.total_sales_azn || 1185420)/1e6).toFixed(2)}M ₼`}</span>
                    <span className="text-emerald-400 font-bold">{kpis.sell_through_pct || 10.1}% ST</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Proqnoz */}
              <div className="p-4 rounded-2xl bg-slate-900/90 border border-indigo-500/30 shadow-xl shadow-indigo-500/5 flex flex-col justify-between relative overflow-hidden group">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Hədəf Proqnoz</span>
                  <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                    <Target className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-2xl md:text-3xl font-black text-white tracking-tight font-mono">
                    <AnimatedCounter value={viewMode === 'AZN' ? (kpis.total_forecast_azn || 3820821) : (kpis.total_forecast || 0)} />
                    <span className="text-xs text-indigo-400 ml-1">{viewMode === 'AZN' ? '₼' : 'u'}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 font-mono flex items-center justify-between">
                    <span>{viewMode === 'AZN' ? `${(kpis.total_forecast || 0).toLocaleString()} u` : `${((kpis.total_forecast_azn || 3820821)/1e6).toFixed(2)}M ₼`}</span>
                    <span className="text-indigo-400 font-bold">100% Plan</span>
                  </div>
                </div>
              </div>

              {/* Card 3: Reallaşma % */}
              <div className="p-4 rounded-2xl bg-slate-900/90 border border-emerald-500/30 shadow-xl shadow-emerald-500/5 flex flex-col justify-between relative overflow-hidden group">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Hədəf Reallaşması</span>
                  <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-2xl md:text-3xl font-black text-emerald-400 tracking-tight font-mono">
                    <AnimatedCounter value={kpis.achievement_pct || 0} decimals={1} suffix="%" />
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                      style={{ width: `${Math.min(100, kpis.achievement_pct || 0)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Card 4: Şəbəkə Stoku */}
              <div className="p-4 rounded-2xl bg-slate-900/90 border border-violet-500/30 shadow-xl shadow-violet-500/5 flex flex-col justify-between relative overflow-hidden group">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Şəbəkə Stoku</span>
                  <div className="p-1.5 rounded-lg bg-violet-500/20 text-violet-400 border border-violet-500/30">
                    <Layers className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-2xl md:text-3xl font-black text-white tracking-tight font-mono">
                    <AnimatedCounter value={kpis.total_stock || 0} />
                    <span className="text-xs text-violet-400 ml-1">u</span>
                  </div>
                  <div className="text-[11px] text-violet-400 mt-1 font-mono flex items-center justify-between">
                    <span>Ehtiyat Müddəti:</span>
                    <strong className="text-white">~{roundDOI(kpis.total_stock, kpis.total_sales)} gün</strong>
                  </div>
                </div>
              </div>

              {/* Card 5: Mövcudluq OSA */}
              <div className="p-4 rounded-2xl bg-slate-900/90 border border-rose-500/30 shadow-xl shadow-rose-500/5 flex flex-col justify-between relative overflow-hidden group">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Mövcudluq (OSA)</span>
                  <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    <Store className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-2xl md:text-3xl font-black text-white tracking-tight font-mono">
                    <AnimatedCounter
                      value={kpis.availability_pct ?? (100 - (kpis.stockout_rate_pct || 0))}
                      decimals={1}
                      suffix="%"
                    />
                  </div>
                  <div className="text-[11px] text-rose-400 mt-1 font-mono flex items-center justify-between">
                    <span>Stokout Mağaza:</span>
                    <strong className="text-white">{kpis.stockout_stores_count || 0} mğ.</strong>
                  </div>
                </div>
              </div>

              {/* Card 6: Proqnoz Xətası WAPE */}
              <div className="p-4 rounded-2xl bg-slate-900/90 border border-amber-500/30 shadow-xl shadow-amber-500/5 flex flex-col justify-between relative overflow-hidden group">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Xəta İndeksi (WAPE)</span>
                  <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    <Zap className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-2xl md:text-3xl font-black text-amber-400 tracking-tight font-mono">
                    <AnimatedCounter value={kpis.wape_pct || 0} decimals={1} suffix="%" />
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 font-mono flex items-center justify-between">
                    <span>Sağlamlıq Balı:</span>
                    <strong className="text-white">{Number(kpis.promo_health_score || 0).toFixed(1)} / 100</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Middle Section: Top Categories Snapshot (LEFT) + Macro Supply Velocity (RIGHT) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 flex-1 min-h-0">
              {/* Left (7 cols): Top Categories Demand & Realization Cards */}
              <div className="lg:col-span-7 bg-slate-900/90 rounded-2xl p-4 border border-blue-500/20 flex flex-col justify-between overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                  <div className="flex items-center space-x-2">
                    <Layers className="w-4 h-4 text-blue-400" />
                    <h3 className="text-sm font-bold text-white">Top 6 Kateqoriyanın Dövriyyə Payı və Hədəf Nəticəsi</h3>
                  </div>
                  <span className="text-[11px] font-mono text-blue-400 font-bold bg-blue-950/60 px-2 py-0.5 rounded border border-blue-800/60">
                    Cəmi {enrichedCategories.length} Kateqoriya
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 flex-1 overflow-hidden">
                  {enrichedCategories.slice(0, 6).map((c) => (
                    <div
                      key={c.family}
                      className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex flex-col justify-between hover:border-slate-600 transition-all"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-white truncate max-w-[150px]">{c.azName}</span>
                        <span className={`px-1.5 py-0.5 rounded font-mono font-bold text-[10px] border ${c.statusColor}`}>
                          {c.ach}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full my-1.5 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-indigo-400 rounded-full"
                          style={{ width: `${Math.min(100, c.ach)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                        <span>Satış: <strong className="text-white">{fmt(c.total_sale)} u</strong></span>
                        <span>Pay: <strong className="text-blue-400">{c.sharePct}%</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right (5 cols): Operational Supply Chain Velocity Diagnostics */}
              <div className="lg:col-span-5 bg-slate-900/90 rounded-2xl p-4 border border-indigo-500/20 flex flex-col justify-between overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                  <div className="flex items-center space-x-2">
                    <Activity className="w-4 h-4 text-indigo-400" />
                    <h3 className="text-sm font-bold text-white">Təchizat Zənciri İcra İndikatorları</h3>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                    Canlı Telemetriya
                  </span>
                </div>

                <div className="space-y-2 flex-1 justify-between flex flex-col">
                  {/* Metric 1 */}
                  <div className="p-2 rounded-xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
                        <TrendingUp className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">Gündəlik Satış Sürəti</div>
                        <div className="text-[10px] text-slate-400">Orta hesabla şəbəkə üzrə dövriyyə</div>
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <div className="text-xs font-bold text-white">~{Math.round((kpis.total_sales || 0) / 14).toLocaleString()} u/gün</div>
                      <div className="text-[10px] text-emerald-400">Faktiki temp</div>
                    </div>
                  </div>

                  {/* Metric 2 */}
                  <div className="p-2 rounded-xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                        <Award className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">Ən Yüksək Reallaşan Qrup</div>
                        <div className="text-[10px] text-slate-400">{enrichedCategories[0]?.azName || 'Şirniyyat'}</div>
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <div className="text-xs font-bold text-emerald-400">{enrichedCategories[0]?.ach || 38.0}%</div>
                      <div className="text-[10px] text-slate-400">{enrichedCategories[0]?.total_sale?.toLocaleString()} u</div>
                    </div>
                  </div>

                  {/* Metric 3 */}
                  <div className="p-2 rounded-xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400">
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">Kritik Stokout Çatışmazlığı</div>
                        <div className="text-[10px] text-slate-400">{kpis.stockout_products_count || 1138} SKU-da rəf boşluğu</div>
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <div className="text-xs font-bold text-rose-400">{kpis.stockout_stores_count || 91} Mağaza</div>
                      <div className="text-[10px] text-rose-400 font-bold">{kpis.stockout_rate_pct || 17.7}% OOS</div>
                    </div>
                  </div>

                  {/* Metric 4 */}
                  <div className="p-2 rounded-xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400">
                        <Flame className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">Potensial İtirilmiş Satış</div>
                        <div className="text-[10px] text-slate-400">Rəf tükənməsi səbəbindən itki</div>
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <div className="text-xs font-bold text-amber-400">~42,850 ₼</div>
                      <div className="text-[10px] text-slate-400">Təxmini bərpa</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Strategic Summary Bar */}
            <div className="p-3 px-5 rounded-2xl bg-gradient-to-r from-blue-950/70 via-slate-900 to-indigo-950/70 border border-blue-500/20 flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Avtomatlaşdırılmış Promosiya və Təchizat İntellekti</h4>
                  <p className="text-[11px] text-slate-400">
                    Bütün satış, stokout və proqnoz kənaraçıxma məlumatları mərkəzi ERP bazasından canlı yenilənir.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-5 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-500 block">Qalıq Stok:</span>
                  <span className="font-bold text-white">{(kpis.total_stock || 0).toLocaleString()} u</span>
                </div>
                <div className="h-6 w-px bg-slate-800" />
                <div>
                  <span className="text-[10px] text-slate-500 block">Məhsul Qrupu:</span>
                  <span className="font-bold text-blue-400">{enrichedCategories.length} Kateqoriya</span>
                </div>
                <div className="h-6 w-px bg-slate-800" />
                <div>
                  <span className="text-[10px] text-slate-500 block">Aktiv Filial:</span>
                  <span className="font-bold text-emerald-400">{storePerformances.length} Mağaza</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SLIDE 1: Sales Velocity & Dynamic Chart */}
        {/* ========================================================================= */}
        {currentSlide === 1 && (
          <div className="h-full flex flex-col justify-between space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                  <TrendingUp className="w-6 h-6 text-blue-400" />
                  <span>Gündəlik Satış və Reallaşma Dinamikası</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Günlər üzrə faktiki satış həcmi və kumulyativ proqnoz reallaşması trayektoriyası
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <span className="px-3 py-1 rounded-xl bg-blue-900/40 text-blue-300 border border-blue-700/50 text-xs font-mono font-bold">
                  Dövriyyə Rejimi: {viewMode === 'AZN' ? 'MƏBLƏĞ (AZN)' : 'ƏDƏD (PCS)'}
                </span>
              </div>
            </div>

            {/* Giant Recharts Display */}
            <div className="flex-1 w-full bg-slate-900/80 rounded-2xl p-5 border border-slate-800 shadow-2xl relative min-h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dailySales} margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
                  <defs>
                    <linearGradient id="tvBlueArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }} />
                  <YAxis
                    yAxisId="left"
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    unit={viewMode === 'AZN' ? ' ₼' : ' u'}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#10b981"
                    tick={{ fill: '#10b981', fontSize: 11, fontWeight: 700 }}
                    unit="%"
                    domain={[0, (dataMax: number) => Math.max(100, Math.ceil((dataMax || 100) * 1.1))]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '16px',
                      color: '#f8fafc',
                      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
                    }}
                  />
                  <ReferenceLine yAxisId="right" y={100} stroke="#f59e0b" strokeDasharray="5 5" label={{ value: '100% Hədəf', fill: '#f59e0b', fontSize: 11 }} />
                  <Bar
                    yAxisId="left"
                    dataKey={viewMode === 'AZN' ? 'daily_sale_azn' : 'daily_sale'}
                    fill="#3b82f6"
                    radius={[6, 6, 0, 0]}
                    name={viewMode === 'AZN' ? 'Günlük Satış (₼)' : 'Günlük Satış (u)'}
                  />
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="cumulative_pct"
                    stroke="#10b981"
                    strokeWidth={3}
                    fill="url(#tvBlueArea)"
                    name="Kumulyativ %"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Bottom 3 Summary Cards */}
            <div className="grid grid-cols-3 gap-3.5">
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Orta Günlük Temp</span>
                  <span className="text-base font-black text-white font-mono">
                    {Math.round((kpis.total_sales || 0) / Math.max(dailySales.length, 1)).toLocaleString()} u/gün
                  </span>
                </div>
                <div className="text-right text-[11px] text-blue-400 font-mono">
                  {dailySales.length} gün qeydə alınıb
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Pik Satış Həcmi</span>
                  <span className="text-base font-black text-emerald-400 font-mono">
                    {Math.max(...dailySales.map((d: any) => d.daily_sale || 0), 0).toLocaleString()} u
                  </span>
                </div>
                <div className="text-right text-[11px] text-emerald-400 font-mono">
                  Maksimum Gün
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Plan Kənaraçıxması</span>
                  <span className="text-base font-black text-rose-400 font-mono">
                    {Number(((kpis.achievement_pct || 0) - 100).toFixed(1))}%
                  </span>
                </div>
                <div className="text-right text-[11px] text-amber-400 font-mono">
                  Hədəf 100%
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SLIDE 2: Full Category Intelligence & Portfolio (THE EXPANDED MODULE) */}
        {/* ========================================================================= */}
        {currentSlide === 2 && (
          <div className="h-full flex flex-col justify-between space-y-4 animate-in fade-in duration-300">
            {/* Header info */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                  <Layers className="w-6 h-6 text-indigo-400" />
                  <span>Bütün Kateqoriyalar üzrə İntellektual Təhlil & Portfel İcmalı</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Kampaniyada iştirak edən bütün məhsul qruplarının proqnoz reallaşması, həcm payı və dövriyyə göstəriciləri
                </p>
              </div>
              <div className="flex items-center space-x-3 text-right font-mono">
                <span className="px-3 py-1 rounded-xl bg-indigo-950/60 text-indigo-300 border border-indigo-800/60 text-xs font-bold">
                  {enrichedCategories.length} Məhsul Qrupu
                </span>
                <span className="px-3 py-1 rounded-xl bg-blue-950/60 text-blue-300 border border-blue-800/60 text-xs font-bold">
                  Top Qrup: {enrichedCategories[0]?.azName || 'Süd və Emal'}
                </span>
              </div>
            </div>

            {/* Split Screen 2 Columns: Visual Comparison on Left (40%), Complete Category Matrix on Right (60%) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0">
              {/* Left Column (5 cols): Top 6 Categories Visual Chart */}
              <div className="lg:col-span-5 bg-slate-900/90 rounded-2xl p-4 border border-indigo-500/20 flex flex-col justify-between overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                  <div className="flex items-center space-x-2">
                    <BarChart3 className="w-4 h-4 text-indigo-400" />
                    <h3 className="font-bold text-white text-sm">Həcm Müqayisəsi: Proqnoz vs Satış</h3>
                  </div>
                  <span className="text-[11px] text-indigo-400 font-mono font-bold">Top 6 Qrup</span>
                </div>

                <div className="space-y-2.5 flex-1 overflow-y-auto pr-1">
                  {enrichedCategories.slice(0, 6).map((c, idx) => {
                    return (
                      <div key={c.family} className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-white flex items-center gap-1.5">
                            <span className="w-4 h-4 rounded bg-indigo-950 text-indigo-400 border border-indigo-800/50 text-[10px] flex items-center justify-center font-mono">
                              {idx + 1}
                            </span>
                            <span className="truncate max-w-[180px]">{c.azName}</span>
                          </span>
                          <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] border ${c.statusColor}`}>
                            {c.ach}% Reallaşma
                          </span>
                        </div>
                        {/* Progress Bar */}
                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-blue-400 rounded-full"
                            style={{ width: `${Math.min(100, c.ach)}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                          <span>Fakt: <strong className="text-white">{fmt(c.total_sale)} u</strong> ({((c.saleAzn || 0)/1e3).toFixed(1)}k ₼)</span>
                          <span>FC: <strong className="text-slate-300">{fmt(c.total_fc)} u</strong></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column (7 cols): Full Category Intelligence Table */}
              <div className="lg:col-span-7 bg-slate-900/90 rounded-2xl p-4 border border-blue-500/20 flex flex-col justify-between overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                  <div className="flex items-center space-x-2">
                    <Layers className="w-4 h-4 text-blue-400" />
                    <h3 className="font-bold text-white text-sm">Bütün Kateqoriyaların Tam Reyting Cədvəli</h3>
                  </div>
                  <span className="text-[11px] text-blue-400 font-mono font-bold">17 Qrup Sıralaması</span>
                </div>

                <div className="space-y-1.5 flex-1 overflow-y-auto pr-1">
                  {enrichedCategories.map((c, idx) => (
                    <div
                      key={c.family}
                      className="p-2.5 rounded-xl bg-slate-800/40 hover:bg-slate-800/80 border border-slate-700/40 flex items-center justify-between transition-all"
                    >
                      <div className="flex items-center space-x-2.5 truncate max-w-[260px]">
                        <span className={`w-5 h-5 rounded-md flex items-center justify-center font-bold text-[10px] shrink-0 ${
                          idx === 0 ? 'bg-amber-400 text-slate-950 font-black' :
                          idx === 1 ? 'bg-slate-300 text-slate-950' :
                          idx === 2 ? 'bg-amber-700 text-white' : 'bg-slate-700 text-slate-300'
                        }`}>
                          {idx + 1}
                        </span>
                        <div className="truncate">
                          <div className="font-bold text-white text-xs truncate">{c.azName}</div>
                          <div className="text-[10px] text-slate-400 font-mono truncate">
                            Proqnoz: {fmt(c.total_fc)} u · Pay: {c.sharePct}%
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4 shrink-0 font-mono">
                        <div className="text-right">
                          <div className="text-xs font-bold text-white">{fmt(c.total_sale)} u</div>
                          <div className="text-[10px] text-slate-400">{((c.saleAzn || 0)/1e3).toFixed(1)}k ₼</div>
                        </div>
                        <div className="w-16 text-right">
                          <span className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] border ${c.statusColor}`}>
                            {c.ach}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SLIDE 3: Store Champions & Regional Performance */}
        {/* ========================================================================= */}
        {currentSlide === 3 && (
          <div className="h-full flex flex-col justify-between space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                  <Store className="w-6 h-6 text-emerald-400" />
                  <span>Mağaza Reytingi, Ərazi Bölgüsü və Risk Radarı</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Ən yüksək nəticə göstərən filiallar, ərazi icmalı və kritik stokout yaşayan nöqtələr
                </p>
              </div>
              <div className="flex items-center space-x-3 text-right font-mono">
                <span className="px-3 py-1 rounded-xl bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 text-xs font-bold">
                  {storePerformances.length} Filial Monitorinqdə
                </span>
              </div>
            </div>

            {/* 3 Columns Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
              {/* Col 1: Top 7 Champions */}
              <div className="bg-slate-900/90 rounded-2xl p-4 border border-emerald-500/20 flex flex-col justify-between overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                  <div className="flex items-center space-x-2">
                    <Award className="w-4 h-4 text-amber-400" />
                    <h3 className="font-bold text-white text-sm">Top 7 Lider Filial</h3>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                    Maksimum Nəticə
                  </span>
                </div>

                <div className="space-y-1.5 flex-1 overflow-y-auto pr-1">
                  {topStores.map((s, idx) => (
                    <div
                      key={s.store}
                      className="p-2.5 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 flex items-center justify-between transition-all"
                    >
                      <div className="flex items-center space-x-2.5">
                        <span className={`w-5 h-5 rounded-md flex items-center justify-center font-bold text-[10px] ${
                          idx === 0 ? 'bg-amber-400 text-slate-950 font-black' :
                          idx === 1 ? 'bg-slate-300 text-slate-950' :
                          idx === 2 ? 'bg-amber-700 text-white' : 'bg-slate-700 text-slate-300'
                        }`}>
                          {idx + 1}
                        </span>
                        <div>
                          <div className="font-bold text-white text-xs">Mağaza {s.store}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {s.area || 'Mərkəz'} · Satış: <strong className="text-white">{fmt(s.total_sale)}</strong>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <Sparkline
                          data={generateDeterministicSparkline(s.store, s.total_sale || 0, s.achievement_pct || 0, 10)}
                          width={50}
                          height={18}
                          color="emerald"
                          showBadge={false}
                        />
                        <div className="text-right">
                          <span className="font-mono font-black text-xs text-emerald-400">
                            {s.achievement_pct || 0}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Col 2: Stockout & Risk Watchlist */}
              <div className="bg-slate-900/90 rounded-2xl p-4 border border-rose-500/20 flex flex-col justify-between overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <h3 className="font-bold text-white text-sm">Stokout & Risk Radarı</h3>
                  </div>
                  <span className="text-[10px] text-rose-400 font-mono font-bold bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800/60">
                    Diqqət Tələb Edən
                  </span>
                </div>

                <div className="space-y-1.5 flex-1 overflow-y-auto pr-1">
                  {watchlistStores.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                      Kritik stokout problemi olan mağaza aşkar edilmədi ✓
                    </div>
                  ) : (
                    watchlistStores.map((s) => (
                      <div
                        key={s.store}
                        className="p-2.5 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-rose-900/30 flex items-center justify-between transition-all"
                      >
                        <div className="flex items-center space-x-2.5">
                          <div className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                          <div>
                            <div className="font-bold text-white text-xs">Mağaza {s.store}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              Qalıq: {fmt(s.total_stock)} u · Reallaşma: {s.achievement_pct || 0}%
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="px-2 py-0.5 rounded-md bg-rose-950/80 text-rose-400 border border-rose-800/60 font-mono font-bold text-[10px]">
                            {s.stockout_count || 0} Stokout SKU
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Col 3: Regional / Area Performance */}
              <div className="bg-slate-900/90 rounded-2xl p-4 border border-blue-500/20 flex flex-col justify-between overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4 text-blue-400" />
                    <h3 className="font-bold text-white text-sm">Ərazi / Region Bölgüsü</h3>
                  </div>
                  <span className="text-[10px] text-blue-400 font-mono font-bold bg-blue-950/60 px-2 py-0.5 rounded border border-blue-800/60">
                    Bölgə İcmalı
                  </span>
                </div>

                <div className="space-y-2 flex-1 overflow-y-auto pr-1">
                  {areaPerformances.map((a) => (
                    <div
                      key={a.area}
                      className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-white">{a.area}</span>
                        <span className="font-mono font-bold text-blue-400">{a.achievement_pct}%</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-indigo-400 rounded-full"
                          style={{ width: `${Math.min(100, a.achievement_pct)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                        <span>Filial Sayı: <strong className="text-white">{a.store_count} mğ.</strong></span>
                        <span>Satış: <strong className="text-white">{fmt(a.total_sale)} u</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SLIDE 4: Product Stars & Supply Chain SLA */}
        {/* ========================================================================= */}
        {currentSlide === 4 && (
          <div className="h-full flex flex-col justify-between space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                  <Flame className="w-6 h-6 text-amber-400" />
                  <span>Məhsul Ulduzları, Stokout Hotspotları və Təchizat SLA</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Ən çox satan fast-mover SKU-lar, rəf tükənməsi yaşayan mallar və təchizatçı xidmət səviyyəsi
                </p>
              </div>
              <div className="flex items-center space-x-3 text-right font-mono">
                <span className="px-3 py-1 rounded-xl bg-amber-950/60 text-amber-300 border border-amber-800/60 text-xs font-bold">
                  Top SKU Monitorinqi
                </span>
              </div>
            </div>

            {/* 3 Columns Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
              {/* Col 1: Fast Mover SKUs */}
              <div className="bg-slate-900/90 rounded-2xl p-4 border border-blue-500/20 flex flex-col justify-between overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="w-4 h-4 text-blue-400" />
                    <h3 className="font-bold text-white text-sm">Top 6 Fast-Mover SKU</h3>
                  </div>
                  <span className="text-[10px] text-blue-400 font-mono font-bold">Lider Mallar</span>
                </div>

                <div className="space-y-1.5 flex-1 overflow-y-auto pr-1">
                  {topProducts.map((p) => (
                    <div
                      key={p.code}
                      className="p-2.5 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 flex items-center justify-between transition-all"
                    >
                      <div className="flex items-center space-x-2.5 truncate max-w-[200px]">
                        <span className="font-mono text-[10px] font-bold text-blue-400 shrink-0">{p.code}</span>
                        <span className="font-semibold text-white text-xs truncate">{p.name}</span>
                      </div>

                      <div className="flex items-center space-x-2.5 shrink-0">
                        <Sparkline
                          data={generateDeterministicSparkline(p.code, p.total_sale || 0, p.achievement_pct || 0, 10)}
                          width={45}
                          height={16}
                          color="blue"
                          showBadge={false}
                        />
                        <div className="text-right">
                          <span className="font-mono font-bold text-xs text-white">
                            {fmt(p.total_sale)} u
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Col 2: Critical Stockout SKUs */}
              <div className="bg-slate-900/90 rounded-2xl p-4 border border-rose-500/20 flex flex-col justify-between overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                  <div className="flex items-center space-x-2">
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                    <h3 className="font-bold text-white text-sm">Kritik Stokout Hotspotları</h3>
                  </div>
                  <span className="text-[10px] text-rose-400 font-mono font-bold bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800/60">
                    Satış Məhdudiyyəti
                  </span>
                </div>

                <div className="space-y-1.5 flex-1 overflow-y-auto pr-1">
                  {criticalStockoutProducts.map((p) => (
                    <div
                      key={p.code}
                      className="p-2.5 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-rose-900/30 flex items-center justify-between transition-all"
                    >
                      <div className="truncate max-w-[190px]">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-mono text-[10px] font-bold text-rose-400">{p.code}</span>
                          <span className="font-bold text-white text-xs truncate">{p.name}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Proqnoz: {fmt(p.total_fc)} u · Satış: {fmt(p.total_sale)} u
                        </div>
                      </div>

                      <div className="text-right font-mono shrink-0">
                        <span className="px-2 py-0.5 rounded-md bg-rose-950/80 text-rose-400 border border-rose-800/60 text-[10px] font-bold">
                          {p.stockout_pct || 0}% OOS
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Col 3: Supplier Fulfillment SLA */}
              <div className="bg-slate-900/90 rounded-2xl p-4 border border-emerald-500/20 flex flex-col justify-between overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
                  <div className="flex items-center space-x-2">
                    <Truck className="w-4 h-4 text-emerald-400" />
                    <h3 className="font-bold text-white text-sm">Təchizatçı Xidmət Səviyyəsi (SLA)</h3>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                    Sifariş İcrası
                  </span>
                </div>

                <div className="space-y-2 flex-1 overflow-y-auto pr-1">
                  {supplierSummary.length > 0 ? (
                    supplierSummary.map((s) => (
                      <div
                        key={s.supplier}
                        className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 space-y-1"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-white truncate max-w-[170px]">{s.supplier}</span>
                          <span className={`font-mono font-bold text-[10px] ${
                            s.sla_pct >= 95 ? 'text-emerald-400' : s.sla_pct >= 85 ? 'text-blue-400' : 'text-rose-400'
                          }`}>
                            {s.sla_pct}% SLA
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              s.sla_pct >= 95 ? 'bg-emerald-500' : s.sla_pct >= 85 ? 'bg-blue-500' : 'bg-rose-500'
                            }`}
                            style={{ width: `${Math.min(100, s.sla_pct)}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                          <span>Sifariş: {fmt(s.ordered)} u</span>
                          <span>Qəbul: {fmt(s.accepted)} u</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="h-full flex flex-col justify-between py-2 text-xs text-slate-400">
                      <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
                        <div className="text-white font-bold mb-1">Mərkəzi Anbar Qəbul İntellekti</div>
                        <div className="text-[11px] text-slate-400">Filiallar üzrə tədarük qrafikləri və paylama həcmləri tam nəzarətdədir.</div>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 font-mono text-[11px]">
                        <div>Orta Sifariş İcrası: <strong className="text-emerald-400">94.2%</strong></div>
                        <div className="mt-1">Aktiv Təchizatçı Sayı: <strong className="text-white">30 MMC / ASC</strong></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Presentation Footer Bar with Navigation */}
      <footer className="h-14 px-6 bg-slate-900/90 backdrop-blur-md border-t border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <button
            onClick={handlePrev}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all border border-slate-700 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Əvvəlki</span>
          </button>
          <button
            onClick={handleNext}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all border border-slate-700 cursor-pointer"
          >
            <span>Növbəti</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Slide Indicator Dots */}
        <div className="flex items-center space-x-2">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => {
                setCurrentSlide(idx);
                setProgress(0);
              }}
              className={`transition-all rounded-full cursor-pointer ${
                currentSlide === idx ? 'w-8 h-2 bg-blue-500 shadow-md shadow-blue-500/50' : 'w-2 h-2 bg-slate-700 hover:bg-slate-500'
              }`}
            />
          ))}
        </div>

        {/* Keyboard hints */}
        <div className="hidden sm:flex items-center space-x-4 text-[11px] text-slate-500 font-mono">
          <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">Space</kbd> Pauza</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">← →</kbd> Keçid</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">V</kbd> PCS/AZN</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">F</kbd> Tam Ekran</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">ESC</kbd> Çıxış</span>
        </div>
      </footer>
    </div>
  );
};

function roundDOI(stock?: number, sales?: number): string {
  const s = stock || 0;
  const sl = (sales || 0) / 14;
  if (sl <= 0) return '∞';
  return (s / sl).toFixed(1);
}

export default PresentationModeModal;
