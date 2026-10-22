import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Database, Search, Download } from 'lucide-react';
import { SortableHeader } from '../components/common/SortableHeader';
import { sortData } from '../utils/sortUtils';

export const DataExplorerPage: React.FC = () => {
  const { data, sampleRows } = useData();
  const [explorerTab, setExplorerTab] = useState<'FACT' | 'TIMELINE'>('FACT');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<string>('total_sale');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const store_performances = data?.store_performances || [];
  const product_performances = data?.product_performances || [];

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      const isStringField = field === 'code' || field === 'name' || field === 'health_status';
      setSortAsc(isStringField);
    }
  };

  const filteredAndSortedProducts = useMemo(() => {
    let list = product_performances;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) =>
        p.code?.toLowerCase().includes(q) ||
        p.name?.toLowerCase().includes(q) ||
        p.health_status?.toLowerCase().includes(q)
      );
    }
    return sortData(list, sortField, sortAsc);
  }, [product_performances, search, sortField, sortAsc]);

  return (
    <div className="space-y-6 pb-12 text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Məlumat Tədqiqatçısı (Data Explorer)</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Normalizasiya edilmiş PROMO_FACT və STOCK_TIMELINE daxili struktur cədvəlləri</p>
        </div>

        {/* View Switcher */}
        <div className="flex items-center bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 space-x-1">
          <button
            onClick={() => setExplorerTab('FACT')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              explorerTab === 'FACT' ? 'bg-blue-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            PROMO_FACT Cədvəli
          </button>
          <button
            onClick={() => setExplorerTab('TIMELINE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              explorerTab === 'TIMELINE' ? 'bg-blue-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            STOCK_TIMELINE Cədvəli
          </button>
        </div>
      </div>

      {/* Explorer Content */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="relative w-72">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cədvəldə axtar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-slate-800 dark:text-slate-200"
            />
          </div>
          <span className="text-slate-500 dark:text-slate-400 text-xs">Cəmi Qeydlər: {filteredAndSortedProducts.length} SKU</span>
        </div>

        <div className="overflow-x-auto max-h-[60vh]">
          <table className="w-full text-left select-none">
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 uppercase text-[10px] border-b border-slate-200 dark:border-slate-700 sticky top-0 font-bold z-10 shadow-xs">
              <tr>
                <th className="p-3">STORE</th>
                <SortableHeader label="CODE" field="code" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="left" />
                <SortableHeader label="NAME" field="name" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="left" />
                <SortableHeader label="FC" field="total_fc" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="right" />
                <SortableHeader label="SALE" field="total_sale" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="right" />
                <SortableHeader label="FINAL_STOCK" field="total_stock" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="right" />
                <SortableHeader label="SELL_THROUGH %" field="sell_through_pct" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="right" />
                <SortableHeader label="STATUS" field="health_status" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="center" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
              {filteredAndSortedProducts.map((p) => (
                <tr key={p.code} className="hover:bg-blue-500/5 dark:hover:bg-slate-800/60 transition-colors">
                  <td className="p-3 text-slate-700 dark:text-slate-300">ST-101</td>
                  <td className="p-3 text-blue-600 dark:text-blue-400 font-bold">{p.code}</td>
                  <td className="p-3 font-sans text-slate-800 dark:text-slate-200">{p.name}</td>
                  <td className="p-3 text-right text-slate-700 dark:text-slate-300">{p.total_fc}</td>
                  <td className="p-3 text-right text-emerald-600 dark:text-emerald-400 font-bold">{p.total_sale}</td>
                  <td className="p-3 text-right text-slate-700 dark:text-slate-300">{p.total_stock}</td>
                  <td className="p-3 text-right text-indigo-600 dark:text-indigo-400">{p.sell_through_pct}%</td>
                  <td className="p-3 text-center font-sans">
                    <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[10px]">{p.health_status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
