import React from 'react';
import { useData } from '../context/DataContext';
import { Lightbulb, TrendingUp, TrendingDown, RefreshCw, CheckCircle2 } from 'lucide-react';

export const RecommendationsPage: React.FC = () => {
  const { data, setSelectedProductDetail } = useData();
  if (!data) return null;

  const { recommendations } = data;

  const getActionBadge = (type: string) => {
    switch (type) {
      case 'INCREASE_FORECAST':
        return { label: 'PROQNOZU ARTIRIN', class: 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30', icon: TrendingUp };
      case 'DECREASE_FORECAST':
        return { label: 'PROQNOZU AZALTIN', class: 'bg-rose-500/20 text-rose-600 border-rose-500/30', icon: TrendingDown };
      default:
        return { label: 'ARAŞDIRIN / MOVQEYI SAXLAYIN', class: 'bg-blue-500/20 text-blue-600 border-blue-500/30', icon: RefreshCw };
    }
  };

  return (
    <div className="space-y-6 pb-12 text-xs">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Supply Chain Tövsiyə Mühərriki (Recommendation Engine)</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Növbəti promosiya kampaniyaları üçün avtomatik proqnoz düzəlişi və fəaliyyət planı</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {recommendations.map((r) => {
          const action = getActionBadge(r.action_type);
          const Icon = action.icon;
          return (
            <div
              key={r.id}
              onClick={() => setSelectedProductDetail({ store: r.store, code: r.product_code })}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs transition-all space-y-3 cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[10px] font-extrabold border ${action.class}`}>
                  <Icon className="w-3.5 h-3.5" />
                  <span>{action.label}</span>
                </span>
                <span className="font-extrabold text-blue-600 dark:text-blue-400 text-sm">
                  {r.suggested_fc_adj_pct > 0 ? `+${r.suggested_fc_adj_pct}%` : `${r.suggested_fc_adj_pct}%`}
                </span>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">{r.product_name}</h4>
                <p className="text-slate-500 dark:text-slate-400 text-[11px]">Mağaza: <b>{r.store}</b> | Kodu: <span className="font-mono text-blue-600 dark:text-blue-400">{r.product_code}</span></p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300">
                <p className="leading-relaxed"><b>Əsaslandırma:</b> {r.reason}</p>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                <span>Hazırkı FC: <b className="text-slate-700 dark:text-slate-200">{r.current_fc}</b></span>
                <span>Satış: <b className="text-slate-700 dark:text-slate-200">{r.current_sale}</b></span>
                <span>Stok: <b className="text-slate-700 dark:text-slate-200">{r.current_stock}</b></span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
