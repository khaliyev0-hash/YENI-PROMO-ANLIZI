import React from 'react';
import { useData } from '../context/DataContext';
import { AlertTriangle, PackageX } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export const StockIntelligencePage: React.FC = () => {
  const { data, setSelectedProductDetail } = useData();
  const daily_summaries = data?.daily_summaries || [];
  const product_performances = data?.product_performances || [];
  const kpi_cards = data?.kpi_cards || ({} as any);

  const approachingStockout = product_performances.filter((p) => p.total_stock > 0 && p.total_stock <= 5);
  const excessStock = product_performances.filter((p) => p.total_stock >= 50 && (p.achievement_pct || 0) < 70);

  const chartData = daily_summaries.map((d) => ({
    date: d.date,
    Stock: d.closing_stock,
    Depletion: d.depletion,
    Stockouts: d.stockout_count
  }));

  return (
    <div className="space-y-6 pb-12 text-xs">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Stok İntellekti Və Stokout Analitikası (Stock Intelligence)</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Şəbəkə üzrə stok balansı, günlük ərimə dinamikası və artıq stok riski</p>
        </div>
      </div>

      {/* Stock Curve Chart */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Ümumi Şəbəkə Stok Balansı Və Ərimə Xətti (Stock Depletion Curve)</h3>
          <span className="text-xs text-blue-600 dark:text-blue-400 font-bold font-mono">Cəmi Stok: {kpi_cards.total_stock?.toLocaleString() || 0} unit</span>
        </div>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="stockBlue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1479e8" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#1479e8" stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc', borderRadius: '12px', fontSize: '11px' }} />
              <Area type="monotone" dataKey="Stock" stroke="#1479e8" strokeWidth={2.5} fillOpacity={1} fill="url(#stockBlue)" name="Stok Qalığı" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Products Approaching Stockout */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Stokout Riskində Olan Məhsullar (&lt; 5 unit)</h3>
          </div>
          <div className="space-y-2">
            {approachingStockout.length === 0 ? (
              <p className="text-slate-500 dark:text-slate-400 py-4 text-center">Təhlükəli dərəcədə kritik stoklu məhsul tapılmadı.</p>
            ) : (
              approachingStockout.map((p) => (
                <div
                  key={p.code}
                  onClick={() => setSelectedProductDetail({ store: "ST-101", code: p.code })}
                  className="p-3 bg-slate-50 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between cursor-pointer"
                >
                  <div>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{p.name}</span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">Kod: {p.code}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-extrabold text-amber-700 dark:text-amber-400">{p.total_stock} unit qalıb</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Excess Stock Risk */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 text-purple-700 dark:text-purple-400">
            <PackageX className="w-5 h-5 stroke-[2.5]" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Artıq Stok Riski Və Zəif Satış (&gt; 50 unit & Reallaşma &lt; 70%)</h3>
          </div>
          <div className="space-y-2">
            {excessStock.length === 0 ? (
              <p className="text-slate-500 dark:text-slate-400 py-4 text-center">Artıq stok riski olan məhsul tapılmadı.</p>
            ) : (
              excessStock.map((p) => (
                <div
                  key={p.code}
                  onClick={() => setSelectedProductDetail({ store: "ST-101", code: p.code })}
                  className="p-3 bg-slate-50 dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between cursor-pointer"
                >
                  <div>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{p.name}</span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">Reallaşma: {p.achievement_pct}%</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-extrabold text-purple-700 dark:text-purple-400">{p.total_stock} unit stok var</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
