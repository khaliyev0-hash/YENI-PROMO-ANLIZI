import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import { X, Package, TrendingUp, AlertTriangle, Store } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { getApiBase } from '../../utils/api';
import { SortableHeader } from '../common/SortableHeader';

export const ProductDetailModal: React.FC = () => {
  const { selectedProductDetail, setSelectedProductDetail } = useData();
  const [detailData, setDetailData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [sortField, setSortField] = useState<string>('date');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedProductDetail(null);
      }
    };
    if (selectedProductDetail) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [selectedProductDetail, setSelectedProductDetail]);

  useEffect(() => {
    if (selectedProductDetail) {
      setLoading(true);
      const API_BASE = getApiBase();
      fetch(`${API_BASE}/item-detail?store=${encodeURIComponent(selectedProductDetail.store)}&code=${encodeURIComponent(selectedProductDetail.code)}`)
        .then((res) => res.json())
        .then((data) => {
          setDetailData(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [selectedProductDetail]);

  const movement = detailData?.movement || {};
  const chartData = useMemo(() => {
    if (!movement.dates) return [];
    return movement.dates.map((d: string, idx: number) => ({
      date: d,
      stock: movement.stocks?.[idx] ?? 0,
      depletion: movement.depletions?.[idx] ?? 0
    }));
  }, [movement]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      const isStringField = field === 'date' || field === 'status';
      setSortAsc(isStringField);
    }
  };

  const movementRows = useMemo(() => {
    const dates: string[] = movement.dates || [];
    const stocks: number[] = movement.stocks || [];
    const depletions: number[] = movement.depletions || [];

    const list = dates.map((d, idx) => ({
      date: d,
      stock: stocks[idx] ?? 0,
      depletion: depletions[idx] ?? 0,
      status: (stocks[idx] ?? 0) <= 0 ? 'STOKOUT' : 'Aktiv'
    }));

    return list.sort((a: any, b: any) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
    });
  }, [movement, sortField, sortAsc]);

  if (!selectedProductDetail) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) setSelectedProductDetail(null);
      }}
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] cursor-default"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/80">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">{detailData?.name || selectedProductDetail.code}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Məhsul Kodu: <span className="font-mono text-blue-600 dark:text-blue-400">{selectedProductDetail.code}</span> | Mağaza: <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedProductDetail.store}</span>
              </p>
            </div>
          </div>
          <button onClick={() => setSelectedProductDetail(null)} className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {loading ? (
            <div className="py-12 text-center text-slate-500 dark:text-slate-400">Yüklənir...</div>
          ) : (
            <>
              {/* Summary KPI grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-3 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl">
                  <span className="text-slate-500 dark:text-slate-400">Proqnoz (FC)</span>
                  <p className="text-base font-bold text-slate-900 dark:text-white mt-1">{detailData?.fc?.toLocaleString()} unit</p>
                </div>
                <div className="p-3 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl">
                  <span className="text-slate-500 dark:text-slate-400">Real Satış (SALE)</span>
                  <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-1">{detailData?.sale?.toLocaleString()} unit</p>
                </div>
                <div className="p-3 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl">
                  <span className="text-slate-500 dark:text-slate-400">Reallaşma %</span>
                  <p className="text-base font-bold text-blue-600 dark:text-blue-400 mt-1">
                    {detailData?.fc > 0 ? Math.round((detailData.sale / detailData.fc) * 100) : 0}%
                  </p>
                </div>
                <div className="p-3 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl">
                  <span className="text-slate-500 dark:text-slate-400">Son Qalıq Stok</span>
                  <p className="text-base font-bold text-blue-600 dark:text-blue-400 mt-1">{detailData?.final_stock?.toLocaleString()} unit</p>
                </div>
                <div className="p-3 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl">
                  <span className="text-slate-500 dark:text-slate-400">Stokout Günləri</span>
                  <p className="text-base font-bold text-rose-600 dark:text-rose-400 mt-1">{movement.stockout_days || 0} gün</p>
                </div>
              </div>

              {/* Dynamic Daily Stock Depletion Chart */}
              {chartData.length > 0 && (
                <div className="p-4 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 dark:text-slate-200">Günlük Stok Dinamikası Və Ərimə Qrafiki (Stock Depletion Timeline)</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">İlkin: {movement.opening} | Son: {movement.closing}</span>
                  </div>
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="stockGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                        <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 11 }} />
                        <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px', color: '#f8fafc' }}
                        />
                        <Area type="monotone" dataKey="stock" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#stockGradient)" name="Stok Qalığı" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Movement table */}
              {movement.dates?.length > 0 && (
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  <table className="w-full text-left select-none text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[11px] border-b border-slate-200 dark:border-slate-700 font-bold">
                      <tr>
                        <SortableHeader label="Tarix" field="date" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="left" />
                        <SortableHeader label="Stok Qalığı" field="stock" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="right" />
                        <SortableHeader label="Günlük Ərimə (Depletion)" field="depletion" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="right" />
                        <SortableHeader label="Status" field="status" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="center" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {movementRows.map((r, idx) => {
                        const isStout = r.stock <= 0;
                        return (
                          <tr key={idx} className="hover:bg-blue-500/5 dark:hover:bg-slate-800/50">
                            <td className="p-2.5 font-mono text-slate-700 dark:text-slate-300">{r.date}</td>
                            <td className="p-2.5 font-bold text-slate-900 dark:text-slate-100 text-right">{r.stock}</td>
                            <td className="p-2.5 text-blue-600 dark:text-blue-400 text-right font-mono">-{r.depletion}</td>
                            <td className="p-2.5 text-center">
                              {isStout ? (
                                <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold text-[10px]">STOKOUT</span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px]">Aktiv</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
