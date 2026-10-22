import React from 'react';
import { useData } from '../context/DataContext';
import { PieChart, TrendingUp, Info } from 'lucide-react';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

export const AbcXyzAnalysisPage: React.FC = () => {
  const { data } = useData();
  if (!data) return null;

  const { abc_summary, pareto_data, has_daily_time_series } = data;

  const paretoProducts = pareto_data?.products?.slice(0, 15) || [];

  return (
    <div className="space-y-6 pb-12 text-xs">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">ABC / XYZ Və Pareto Analitikası</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Satış töhfəsinə görə məhsul seqmentasiyası və kumulyativ Pareto xətti</p>
        </div>
      </div>

      {/* ABC Classes Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-blue-500/30 dark:border-blue-900/50 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-blue-600 dark:text-blue-400 text-sm">CLASS A (Top ~80% Satış)</span>
            <span className="px-2 py-0.5 bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded text-[10px] font-bold">A Sinfi</span>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{abc_summary?.A?.count || 0} SKU</p>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5">
            <p>Toplam Satış: <span className="font-bold text-emerald-600 dark:text-emerald-400">₼ {abc_summary?.A?.sales?.toLocaleString()}</span></p>
            <p>Toplam Proqnoz: {abc_summary?.A?.fc?.toLocaleString()} u</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-amber-500/30 dark:border-amber-900/50 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-amber-600 dark:text-amber-400 text-sm">CLASS B (Növbəti ~15% Satış)</span>
            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded text-[10px] font-bold">B Sinfi</span>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{abc_summary?.B?.count || 0} SKU</p>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5">
            <p>Toplam Satış: <span className="font-bold text-emerald-600 dark:text-emerald-400">₼ {abc_summary?.B?.sales?.toLocaleString()}</span></p>
            <p>Toplam Proqnoz: {abc_summary?.B?.fc?.toLocaleString()} u</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-slate-500 dark:text-slate-400 text-sm">CLASS C (Qalıq ~5% Satış)</span>
            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded text-[10px] font-bold">C Sinfi</span>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-slate-100">{abc_summary?.C?.count || 0} SKU</p>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5">
            <p>Toplam Satış: <span className="font-bold text-emerald-600 dark:text-emerald-400">₼ {abc_summary?.C?.sales?.toLocaleString()}</span></p>
            <p>Toplam Proqnoz: {abc_summary?.C?.fc?.toLocaleString()} u</p>
          </div>
        </div>
      </div>

      {/* Pareto Chart */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Pareto Diaqramı: Məhsullar Və Kumulyativ Satış Payı (%)</h3>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={paretoProducts}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
              <XAxis dataKey="code" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" tick={{ fontSize: 11 }} unit="%" />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc', borderRadius: '8px', fontSize: '11px' }} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Bar yAxisId="left" dataKey="sales" fill="#3b82f6" name="Satış Həcmi" radius={[4, 4, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="cum_pct" stroke="#f59e0b" strokeWidth={3} name="Kumulyativ %" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* XYZ Status Guard */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400">
          <Info className="w-5 h-5" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">XYZ Tələb Volatilliyi Analizi</h3>
        </div>
        {has_daily_time_series ? (
          <p className="text-slate-700 dark:text-slate-300">
            XYZ təhlili günlük stok və ərimə dəyişkənliyi (CV) əsasında hesablanmışdır: <b>X (Sabit)</b>, <b>Y (Orta dəyişkən)</b>, <b>Z (Yüksək dəyişkən)</b>.
          </p>
        ) : (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs">
            "Bu analiz üçün kifayət qədər tarix/taymlayn məlumatı yoxdur." (XYZ təhlili üçün ən azı 3 günlük stok taymlayn sütunları lazımdır).
          </div>
        )}
      </div>
    </div>
  );
};
