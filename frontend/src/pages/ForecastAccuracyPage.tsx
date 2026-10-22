import React from 'react';
import { useData } from '../context/DataContext';
import { Target, Info, CheckCircle2 } from 'lucide-react';

export const ForecastAccuracyPage: React.FC = () => {
  const { data } = useData();
  if (!data) return null;

  const { accuracy_metrics } = data;

  return (
    <div className="space-y-6 pb-12 text-xs">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Proqnoz Dəqiqliyi Analitikası (Forecast Accuracy)</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">WAPE, MAE, RMSE, Bias və MAPE göstəriciləri ilə supply chain proqnozlaşdırma keyfiyyəti</p>
        </div>
      </div>

      {/* Main Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
          <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase text-[10px]">WAPE</span>
          <p className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">{accuracy_metrics.wape}%</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Weighted Abs Error %</p>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
          <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase text-[10px]">MAE</span>
          <p className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">{accuracy_metrics.mae}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Mean Absolute Error</p>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
          <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase text-[10px]">RMSE</span>
          <p className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">{accuracy_metrics.rmse}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Root Mean Sq Error</p>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
          <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase text-[10px]">BIAS</span>
          <p className={`text-2xl font-extrabold ${accuracy_metrics.bias >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {accuracy_metrics.bias} u
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Forecast Bias (SALE - FC)</p>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
          <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase text-[10px]">MAPE</span>
          <p className="text-2xl font-extrabold text-purple-600 dark:text-purple-400">{accuracy_metrics.mape !== null ? `${accuracy_metrics.mape}%` : 'N/A'}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Mean Abs Pct Error</p>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
          <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase text-[10px]">REALLAŞMA</span>
          <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{accuracy_metrics.achievement_pct}%</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Total SALE / Total FC</p>
        </div>
      </div>

      {/* Azerbaijani Methodological Tooltips & Explanations */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400">
          <Info className="w-5 h-5" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Retail Supply Chain Metrikalarının İzahı Və Düsturları</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">
            <span className="font-bold text-blue-600 dark:text-blue-400 text-xs">WAPE (Weighted Absolute Percentage Error)</span>
            <p className="text-slate-700 dark:text-slate-300">
              Düstur: <code className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded text-blue-700 dark:text-blue-300 font-mono border border-slate-200 dark:border-slate-700">SUM(|SALE - FC|) / SUM(FC) * 100</code>
            </p>
            <p className="text-slate-500 dark:text-slate-400 text-[11px]">
              <i>"WAPE aşağı olduqca proqnozlaşdırma daha dəqiqdir və supply chain planlaşdırması daha etibarlıdır."</i>
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2">
            <span className="font-bold text-blue-600 dark:text-blue-400 text-xs">Forecast Bias (Proqnoz Meylliliyi)</span>
            <p className="text-slate-700 dark:text-slate-300">
              Düstur: <code className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded text-blue-700 dark:text-blue-300 font-mono border border-slate-200 dark:border-slate-700">SUM(SALE - FC)</code>
            </p>
            <p className="text-slate-500 dark:text-slate-400 text-[11px]">
              <i>"Bias müsbət olduqda real tələb proqnozu üstələmişdir. Mənfi olduqda isə aşırı proqnoz (über-forecast) verildiyini bildirir."</i>
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200">
          <strong>Nəticə Şərhi:</strong> {accuracy_metrics.description_az}
        </div>
      </div>
    </div>
  );
};
