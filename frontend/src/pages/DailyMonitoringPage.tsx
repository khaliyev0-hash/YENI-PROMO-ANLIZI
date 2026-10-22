import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Calendar, TrendingDown, AlertCircle, Activity } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { SortableHeader } from '../components/common/SortableHeader';

export const DailyMonitoringPage: React.FC = () => {
  const { data } = useData();
  const [sortField, setSortField] = useState<string>('date');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  const daily_summaries = data?.daily_summaries || [];
  const has_daily_time_series = data?.has_daily_time_series || false;

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      const isStringField = field === 'date';
      setSortAsc(isStringField);
    }
  };

  const sortedSummaries = useMemo(() => {
    if (!daily_summaries.length) return [];
    return [...daily_summaries].sort((a: any, b: any) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
    });
  }, [daily_summaries, sortField, sortAsc]);

  const chartData = useMemo(() => {
    return daily_summaries.map((d) => ({
      date: d.date,
      Opening: d.opening_stock,
      Closing: d.closing_stock,
      Depletion: d.depletion,
      Stockouts: d.stockout_count
    }));
  }, [daily_summaries]);

  if (!data) return null;

  if (!has_daily_time_series || daily_summaries.length <= 1) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
        <AlertCircle className="w-8 h-8 text-amber-600 dark:text-amber-400 mx-auto" />
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Bu analiz üçün kifayət qədər tarix/taymlayn məlumatı yoxdur.</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          Günlük stok monitorinqi üçün uploaded Excel faylında <code className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-blue-600 dark:text-blue-400">STOCK DD.MM.YYYY</code> formatlı çoxlu stok sütunları olmalıdır (Format B).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 text-xs">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Günlük Promosiya Və Stok Monitorinqi (Daily Promo Monitoring)</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Promosiya günləri üzrə stok əriməsi, açılış/bağlanış və stokout dinamikası</p>
        </div>
      </div>

      {/* Daily Depletion & Stockouts Chart */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Günlük Stok Əriməsi (Depletion) Və Stokout Mağaza Trendi</h3>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
              <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc', borderRadius: '8px', fontSize: '11px' }} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Bar dataKey="Depletion" fill="#3b82f6" name="Günlük Ərimə (Depletion)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Stockouts" fill="#f43f5e" name="Stokout Sayı" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Daily Summary Table */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Günlük Monitorinq Hesabat Cədvəli</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left select-none">
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[10px] uppercase border-b border-slate-200 dark:border-slate-700 font-bold">
              <tr>
                <SortableHeader label="Tarix" field="date" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="left" />
                <SortableHeader label="Açılış Stoku" field="opening_stock" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="right" />
                <SortableHeader label="Bağlanış Stoku" field="closing_stock" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="right" />
                <SortableHeader label="Günlük Ərimə (Depletion)" field="depletion" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="right" />
                <SortableHeader label="Aktiv Məhsullar" field="active_products" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="center" />
                <SortableHeader label="Stokout Sayı" field="stockout_count" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="center" />
                <SortableHeader label="Riskdə Olan Məhsullar" field="at_risk_products" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="center" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sortedSummaries.map((d) => (
                <tr key={d.date} className="hover:bg-blue-500/5 dark:hover:bg-slate-800/60 transition-all">
                  <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400 flex items-center space-x-2">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{d.date}</span>
                  </td>
                  <td className="p-3 text-right font-mono text-slate-700 dark:text-slate-300">{d.opening_stock.toLocaleString()}</td>
                  <td className="p-3 text-right font-mono text-slate-700 dark:text-slate-300">{d.closing_stock.toLocaleString()}</td>
                  <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">-{d.depletion.toLocaleString()}</td>
                  <td className="p-3 text-center font-mono text-slate-700 dark:text-slate-300">{d.active_products}</td>
                  <td className="p-3 text-center font-mono font-bold text-rose-600 dark:text-rose-400">{d.stockout_count}</td>
                  <td className="p-3 text-center font-mono text-amber-600 font-bold">{d.at_risk_products}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
