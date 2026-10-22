import React from 'react';
import { useData } from '../context/DataContext';
import { Bell, AlertTriangle, AlertCircle, Info, ShieldAlert, ArrowRight } from 'lucide-react';

export const AlertsPage: React.FC = () => {
  const { data, setSelectedProductDetail } = useData();
  if (!data) return null;

  const { alerts } = data;

  const getBadge = (color: string) => {
    switch (color) {
      case 'RED':
        return 'bg-rose-500/20 text-rose-600 border-rose-500/30';
      case 'ORANGE':
        return 'bg-amber-500/20 text-amber-600 border-amber-500/30';
      case 'YELLOW':
        return 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30';
      case 'BLUE':
        return 'bg-blue-500/20 text-blue-600 border-blue-500/30';
      default:
        return 'bg-purple-500/20 text-purple-600 border-purple-500/30';
    }
  };

  return (
    <div className="space-y-6 pb-12 text-xs">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Xəbərdarlıqlar Və İstisnalar (Alerts & Exceptions Center)</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Şəbəkə üzrə stokout, artıq stok, aşağı reallaşma və aşırı proqnoz xəbərdarlıqları</p>
        </div>
        <span className="px-3 py-1 bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 rounded-full font-bold">
          {alerts.length} Aktiv Xəbərdarlıq
        </span>
      </div>

      <div className="space-y-3">
        {alerts.map((a) => (
          <div
            key={a.id}
            onClick={() => setSelectedProductDetail({ store: a.store, code: a.product_code })}
            className="p-4 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer"
          >
            <div className="flex items-start space-x-3.5">
              <div className={`p-2.5 rounded-xl border shrink-0 ${getBadge(a.badge_color)}`}>
                <Bell className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded font-extrabold border ${getBadge(a.badge_color)}`}>
                    {a.category}
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white text-xs">
                    Mağaza {a.store} • {a.product_name} ({a.product_code})
                  </span>
                </div>
                <p className="text-slate-700 dark:text-slate-300">{a.reason}</p>
                <div className="flex items-center space-x-2 text-[11px] text-slate-500 dark:text-slate-400">
                  <span>Metrika: <b className="text-blue-600 dark:text-blue-400">{a.metric}</b></span>
                  <span>•</span>
                  <span>Dəyər: <b className="text-amber-600 dark:text-amber-400">{a.metric_value}</b></span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/80 md:w-72 shrink-0 space-y-1">
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">Tövsiyə Olunan Fəaliyyət:</span>
              <p className="text-[11px] text-slate-700 dark:text-slate-200 flex items-center justify-between">
                <span>{a.recommended_action}</span>
                <ArrowRight className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 ml-1" />
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
