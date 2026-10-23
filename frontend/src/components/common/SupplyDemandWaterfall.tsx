import React, { useMemo } from 'react';
import { ArrowRight, Box, Layers, ShoppingBag, Store, CheckCircle2 } from 'lucide-react';

interface WaterfallStep {
  label: string;
  sublabel: string;
  value: number;
  type: 'base' | 'add' | 'subtract' | 'result';
  color: string;
  badge?: string;
  unit?: string;
}

interface SupplyDemandWaterfallProps {
  title?: string;
  subtitle?: string;
  forecastDemand: number;
  targetEndingStock: number;
  currentStock: number;
  netRequirement: number;
  recommendedOrder: number;
  recommendedCases?: number;
  unit?: string;
  className?: string;
}

export const SupplyDemandWaterfall: React.FC<SupplyDemandWaterfallProps> = ({
  title = "Sifariş və Tələbat Şəlalə Diaqramı (Supply-Demand Waterfall)",
  subtitle = "Proqnoz tələbatından yekun tövsiyə sifarişinə qədər addım-addım paylanma balansı",
  forecastDemand,
  targetEndingStock,
  currentStock,
  netRequirement,
  recommendedOrder,
  recommendedCases = 0,
  unit = "Ədəd",
  className = ""
}) => {
  const excessRounding = Math.max(0, recommendedOrder - netRequirement);

  const steps: WaterfallStep[] = useMemo(() => [
    {
      label: "1. Proqnoz Tələbat",
      sublabel: "30 günlük trend və ya YoY",
      value: forecastDemand,
      type: 'base',
      color: 'from-blue-500 to-blue-600',
      badge: 'BAZA'
    },
    {
      label: "2. Hədəf Bitiş Stoku",
      sublabel: "Kampaniya sonu ehtiyatı",
      value: targetEndingStock,
      type: 'add',
      color: 'from-indigo-500 to-indigo-600',
      badge: '+ƏLAVƏ'
    },
    {
      label: "3. Mövcud Cari Stok",
      sublabel: "Rəfdəki faktiki qalıq",
      value: currentStock,
      type: 'subtract',
      color: 'from-amber-500 to-amber-600',
      badge: '-ÇIXILIR'
    },
    {
      label: "4. Xalis Ehtiyac",
      sublabel: "Real çatışmayan miqdar",
      value: netRequirement,
      type: 'result',
      color: 'from-cyan-500 to-cyan-600',
      badge: 'EHTİYAC'
    },
    {
      label: "5. Qutu Yuvarlaqlaşdırması",
      sublabel: "Tam yeşik qablaşdırması",
      value: excessRounding,
      type: 'add',
      color: 'from-purple-500 to-purple-600',
      badge: '+QUTU FƏRQİ'
    },
    {
      label: "6. Yekun Tövsiyə Sifariş",
      sublabel: `${recommendedCases > 0 ? `${recommendedCases} qutu / ` : ''}${recommendedOrder.toLocaleString()} ${unit}`,
      value: recommendedOrder,
      type: 'result',
      color: 'from-emerald-500 to-emerald-600',
      badge: 'SİFARİŞ'
    }
  ], [forecastDemand, targetEndingStock, currentStock, netRequirement, recommendedOrder, recommendedCases, unit, excessRounding]);

  const maxVal = Math.max(1, ...steps.map(s => s.value));

  return (
    <div className={`p-4 sm:p-5 rounded-2xl glass-card relative overflow-hidden ${className}`}>
      {/* Background ambient decorative orb */}
      <div className="absolute -top-10 -right-10 w-44 h-44 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-44 h-44 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 relative z-10">
        <div>
          <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span className="p-1 rounded-md bg-emerald-600 text-white shadow-xs">
              <Layers className="w-3.5 h-3.5" />
            </span>
            {title}
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center space-x-2 text-xs font-mono font-bold">
          <span className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            TÖVSİYƏ: {recommendedOrder.toLocaleString()} {unit}
          </span>
        </div>
      </div>

      {/* Waterfall Grid Bars */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 relative z-10">
        {steps.map((step, idx) => {
          const heightPct = Math.max(15, Math.round((step.value / maxVal) * 100));
          const isNegative = step.type === 'subtract';

          return (
            <div
              key={idx}
              className="flex flex-col justify-between p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 card-lift group transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate">
                  {step.label}
                </span>
                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded font-mono ${
                  step.type === 'subtract'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                    : step.type === 'result'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                }`}>
                  {step.badge}
                </span>
              </div>

              {/* Bar Visual Gauge */}
              <div className="my-2 h-20 flex items-end justify-center bg-slate-100/60 dark:bg-slate-900/60 rounded-lg p-1.5 overflow-hidden">
                <div
                  style={{ height: `${heightPct}%` }}
                  className={`w-full rounded-md bg-gradient-to-t ${step.color} shadow-sm transition-all duration-700 group-hover:brightness-110 flex items-center justify-center`}
                >
                  <span className="text-[10.5px] font-black text-white drop-shadow-sm font-mono px-1 truncate">
                    {isNegative ? `-${step.value.toLocaleString()}` : step.value.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="mt-1">
                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                  {step.sublabel}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
