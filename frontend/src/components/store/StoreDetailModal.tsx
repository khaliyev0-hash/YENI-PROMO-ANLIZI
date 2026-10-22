import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import { X, Store, Search } from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';
import { getApiBase } from '../../utils/api';
import { SortableHeader } from '../common/SortableHeader';

interface StoreProductRow {
  code: string;
  name: string;
  fc: number;
  sale: number;
  stock: number;
  achievement_pct: number;
  status: string;
}

export const StoreDetailModal: React.FC = () => {
  const { selectedStoreDetail, setSelectedStoreDetail, setSelectedProductDetail } = useData();
  const [rows, setRows] = useState<StoreProductRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const [sortField, setSortField] = useState<string>('sale');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedStoreDetail(null);
      }
    };
    if (selectedStoreDetail) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [selectedStoreDetail, setSelectedStoreDetail]);

  useEffect(() => {
    if (!selectedStoreDetail) {
      setRows([]);
      setSearch('');
      return;
    }

    setLoading(true);

    const API_BASE = getApiBase();
    Promise.all([
      fetch(`${API_BASE}/matrix?metric=achievement`).then((r) => r.json()),
      fetch(`${API_BASE}/matrix?metric=forecast`).then((r) => r.json()),
      fetch(`${API_BASE}/matrix?metric=sales`).then((r) => r.json()),
      fetch(`${API_BASE}/matrix?metric=stock`).then((r) => r.json()),
    ])
      .then(([achM, fcM, saleM, stockM]) => {
        const buildMap = (m: any) => {
          const map = new Map<string, any>();
          (m?.cells || []).forEach((c: any) => {
            if (c.store === selectedStoreDetail) map.set(c.code, c);
          });
          return map;
        };

        const achMap = buildMap(achM);
        const fcMap = buildMap(fcM);
        const saleMap = buildMap(saleM);
        const stockMap = buildMap(stockM);

        const products: any[] = achM?.products || [];

        const merged: StoreProductRow[] = products.map((p) => {
          const achCell = achMap.get(p.code);
          const stockVal = stockMap.get(p.code)?.value ?? 0;
          return {
            code: p.code,
            name: p.name,
            fc: fcMap.get(p.code)?.value ?? 0,
            sale: saleMap.get(p.code)?.value ?? 0,
            stock: stockVal,
            achievement_pct: achCell?.value ?? 0,
            status: stockVal <= 0 ? 'STOCKOUT_LIMITED' : (achCell?.status || 'HEALTHY'),
          };
        });

        setRows(merged);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedStoreDetail]);

  const filteredRows = useMemo(() => {
    if (!rows.length) return [];
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) => r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q));
  }, [rows, search]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      const isStringField = field === 'code' || field === 'name' || field === 'status';
      setSortAsc(isStringField);
    }
  };

  const sortedRows = useMemo(() => {
    if (!filteredRows.length) return [];
    return [...filteredRows].sort((a: any, b: any) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (valA === null || valA === undefined) valA = sortAsc ? Infinity : -Infinity;
      if (valB === null || valB === undefined) valB = sortAsc ? Infinity : -Infinity;

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      const numA = Number(valA);
      const numB = Number(valB);
      if (!isNaN(numA) && !isNaN(numB)) {
        return sortAsc ? numA - numB : numB - numA;
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [filteredRows, sortField, sortAsc]);

  const totalFc = useMemo(() => rows.reduce((acc, r) => acc + r.fc, 0), [rows]);
  const totalSale = useMemo(() => rows.reduce((acc, r) => acc + r.sale, 0), [rows]);
  const stockoutCount = useMemo(() => rows.filter((r) => r.stock <= 0).length, [rows]);

  if (!selectedStoreDetail) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) setSelectedStoreDetail(null);
      }}
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] cursor-default"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/80">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Mağaza {selectedStoreDetail}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Bu mağazadakı bütün məhsullar üzrə proqnoz, satış, stok və mövcudluq göstəriciləri
              </p>
            </div>
          </div>
          <button onClick={() => setSelectedStoreDetail(null)} className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
          {loading ? (
            <div className="py-12 text-center text-slate-500 dark:text-slate-400">Yüklənir...</div>
          ) : (
            <>
              {/* Summary KPI grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl">
                  <span className="text-slate-500 dark:text-slate-400">Məhsul Sayı</span>
                  <p className="text-base font-bold text-slate-900 dark:text-white mt-1">{rows.length} SKU</p>
                </div>
                <div className="p-3 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl">
                  <span className="text-slate-500 dark:text-slate-400">Toplam Proqnoz (FC)</span>
                  <p className="text-base font-bold text-slate-900 dark:text-white mt-1">{totalFc.toLocaleString()} unit</p>
                </div>
                <div className="p-3 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl">
                  <span className="text-slate-500 dark:text-slate-400">Toplam Satış (SALE)</span>
                  <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-1">{totalSale.toLocaleString()} unit</p>
                </div>
                <div className="p-3 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl">
                  <span className="text-slate-500 dark:text-slate-400">Stokout Olan SKU</span>
                  <p className="text-base font-bold text-rose-600 dark:text-rose-400 mt-1">{stockoutCount}</p>
                </div>
              </div>

              {/* Search */}
              <div className="relative max-w-xs">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Məhsul axtar..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Product table */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <table className="w-full text-left select-none">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[10px] uppercase border-b border-slate-200 dark:border-slate-700 font-bold">
                    <tr>
                      <SortableHeader label="Kod" field="code" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="left" />
                      <SortableHeader label="Məhsul Adı" field="name" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="left" />
                      <SortableHeader label="FC" field="fc" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="right" />
                      <SortableHeader label="SALE" field="sale" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="right" />
                      <SortableHeader label="Reallaşma %" field="achievement_pct" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="right" />
                      <SortableHeader label="Qalıq Stok" field="stock" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="right" />
                      <SortableHeader label="Status" field="status" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="center" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {sortedRows.map((r) => (
                      <tr
                        key={r.code}
                        onClick={() => setSelectedProductDetail({ store: selectedStoreDetail, code: r.code })}
                        className="hover:bg-blue-500/5 dark:hover:bg-slate-800/50 cursor-pointer transition-all"
                      >
                        <td className="p-2.5 font-mono font-bold text-blue-600 dark:text-blue-400">{r.code}</td>
                        <td className="p-2.5 font-semibold text-slate-900 dark:text-slate-100">{r.name}</td>
                        <td className="p-2.5 text-right font-mono text-slate-700 dark:text-slate-300">{r.fc.toLocaleString()}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">{r.sale.toLocaleString()}</td>
                        <td className="p-2.5 text-right font-extrabold text-blue-600 dark:text-blue-400">{r.achievement_pct}%</td>
                        <td className={`p-2.5 text-right font-mono font-bold ${r.stock <= 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}`}>
                          {r.stock.toLocaleString()}
                        </td>
                        <td className="p-2.5 text-center">
                          <StatusBadge status={r.status} />
                        </td>
                      </tr>
                    ))}
                    {filteredRows.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-slate-500 dark:text-slate-400">Nəticə tapılmadı</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
