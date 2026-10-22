import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { Store } from 'lucide-react';
import { SortableHeader } from '../components/common/SortableHeader';
import { Sparkline, generateDeterministicSparkline } from '../components/common/Sparkline';

import { DashboardSkeleton } from '../components/common/SkeletonLoader';

export const StoreAnalyticsPage: React.FC = () => {
  const { data, filters, setSelectedStoreDetail } = useData();
  const [sortField, setSortField] = useState<string>("total_sale");
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  if (!data || !data.store_performances) return <DashboardSkeleton />;

  const { store_performances } = data;

  const filteredStores = store_performances.filter((s) => {
    if (filters.selectedStore && s.store !== filters.selectedStore) return false;
    if (filters.selectedArea && filters.selectedArea !== 'ALL' && s.area !== filters.selectedArea) return false;
    if (filters.selectedSubArea && filters.selectedSubArea !== 'ALL' && s.sub_area !== filters.selectedSubArea) return false;
    if (filters.searchQuery && !s.store.toLowerCase().includes(filters.searchQuery.toLowerCase())) return false;
    return true;
  });

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      const isStringField = field === 'store';
      setSortAsc(isStringField);
    }
  };

  const sortedStores = [...filteredStores].sort((a: any, b: any) => {
    let valA = a[sortField];
    let valB = b[sortField];

    if (sortField === 'total_distribution_qty') {
      valA = a.total_distribution_qty ?? ((a.total_sale || 0) + (a.total_stock || 0));
      valB = b.total_distribution_qty ?? ((b.total_sale || 0) + (b.total_stock || 0));
    }

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

  return (
    <div className="space-y-6 pb-12 text-xs">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Mağaza Performansı Və Şəbəkə Analitikası (Store Analytics)</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Mağazaların proqnoz reallaşması, stokout faizləri və reyting sıralaması</p>
        </div>
      </div>

      {/* Store Table */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700 select-none">
              <tr>
                <SortableHeader label="Rank" field="rank" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="left" />
                <SortableHeader label="Mağaza" field="store" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="left" />
                <SortableHeader label="Məhsul Sayı" field="product_count" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="center" />
                <SortableHeader label="Dağılım Miqdarı" field="total_distribution_qty" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="right" />
                <SortableHeader label="FC (Proqnoz)" field="total_fc" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="right" />
                <SortableHeader label="SALE (Satış)" field="total_sale" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="right" />
                <SortableHeader label="Reallaşma %" field="achievement_pct" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="right" />
                <th className="p-3 text-center font-bold text-slate-700 dark:text-slate-300">Trend (14G)</th>
                <SortableHeader label="Qalıq Stok" field="total_stock" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="right" />
                <SortableHeader label="Stokout Sayı" field="stockout_count" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="center" />
                <SortableHeader label="Stokout %" field="stockout_pct" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="center" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sortedStores.map((s) => (
                <tr
                  key={s.store}
                  onClick={() => setSelectedStoreDetail(s.store)}
                  title="Ətraflı baxmaq üçün klikləyin"
                  className="hover:bg-blue-50/70 dark:hover:bg-slate-800/60 transition-all cursor-pointer"
                >
                  <td className="p-3 font-extrabold text-slate-500 dark:text-slate-400">#{s.rank}</td>
                  <td className="p-3 font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                    <Store className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Mağaza {s.store}</span>
                  </td>
                  <td className="p-3 text-center font-mono font-semibold text-slate-700 dark:text-slate-300">{s.product_count}</td>
                  <td className="p-3 text-right font-mono font-bold text-blue-700 dark:text-blue-300">{(s.total_distribution_qty || (s.total_sale + s.total_stock)).toLocaleString()}</td>
                  <td className="p-3 text-right font-mono text-slate-700 dark:text-slate-300">{s.total_fc.toLocaleString()}</td>
                  <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">{s.total_sale.toLocaleString()}</td>
                  <td className="p-3 text-right font-extrabold text-blue-600 dark:text-blue-400">{s.achievement_pct}%</td>
                  <td className="p-3 text-center">
                    <Sparkline
                      data={generateDeterministicSparkline(s.store, s.total_sale, s.achievement_pct, 12)}
                      width={62}
                      height={20}
                      showBadge={true}
                    />
                  </td>
                  <td className="p-3 text-right font-mono text-slate-700 dark:text-slate-300">{s.total_stock.toLocaleString()}</td>
                  <td className="p-3 text-center font-mono text-rose-600 dark:text-rose-400 font-bold">{s.stockout_count}</td>
                  <td className="p-3 text-center font-mono text-rose-600 dark:text-rose-400 font-semibold">{s.stockout_pct}%</td>
                </tr>
              ))}
              {filteredStores.length === 0 && (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-slate-500 dark:text-slate-400 font-medium">Süzgəclərə uyğun heç bir mağaza tapılmadı.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
