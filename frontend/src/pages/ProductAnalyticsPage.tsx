import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { isPromoTypeMatch } from '../utils/filterUtils';
import { SortableHeader } from '../components/common/SortableHeader';
import { Sparkline, generateDeterministicSparkline } from '../components/common/Sparkline';

import { DashboardSkeleton } from '../components/common/SkeletonLoader';

export const ProductAnalyticsPage: React.FC = () => {
  const { data, setSelectedProductDetail, filters } = useData();
  const [sortField, setSortField] = useState<string>("total_sale");
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  if (!data || !data.product_performances) return <DashboardSkeleton />;

  const { product_performances } = data;

  const filteredProducts = product_performances.filter((p) => {
    if (filters.selectedProduct && p.code !== filters.selectedProduct) return false;
    if (filters.selectedCategory && filters.selectedCategory !== 'ALL' && p.category !== filters.selectedCategory) return false;
    if (filters.selectedFamily && filters.selectedFamily !== 'ALL' && p.family !== filters.selectedFamily) return false;
    if (filters.abcClass !== 'ALL' && p.abc_class !== filters.abcClass) return false;
    if (filters.promoType && filters.promoType !== 'ALL' && !isPromoTypeMatch(p, filters.promoType)) return false;
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !p.code.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const sortedProducts = [...filteredProducts].sort((a: any, b: any) => {
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

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      const isStringField = field === 'code' || field === 'name';
      setSortAsc(isStringField);
    }
  };

  const selectedStoreCode = filters.selectedStore || 'ALL';

  return (
    <div className="space-y-6 pb-12 text-xs">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Məhsul Analitikası (Product Analytics)</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Promosiyada olan bütün məhsulların reallaşma və stokout göstəriciləri</p>
        </div>
      </div>

      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700 select-none">
              <tr>
                <SortableHeader label="Kod" field="code" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="left" />
                <SortableHeader label="Məhsul Adı" field="name" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="left" />
                <SortableHeader label="Mağaza Sayı" field="store_count" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="center" />
                <SortableHeader label="Dağılım Miqdarı" field="total_distribution_qty" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="right" />
                <SortableHeader label="FC (Proqnoz)" field="total_fc" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="right" />
                <SortableHeader label="SALE (Satış)" field="total_sale" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="right" />
                <SortableHeader label="Reallaşma %" field="achievement_pct" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="right" />
                <SortableHeader label="Qalıq Stok" field="total_stock" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="right" />
                <SortableHeader label="Stokout Mağaza" field="stockout_store_count" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="center" />
                <th className="p-3 text-center font-bold">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sortedProducts.map((p) => {
                return (
                  <tr
                    key={p.code}
                    onClick={() => setSelectedProductDetail({ store: selectedStoreCode, code: p.code })}
                    className="hover:bg-blue-50/70 dark:hover:bg-slate-800/60 cursor-pointer transition-all"
                  >
                    <td className="p-3 font-mono font-bold text-blue-700 dark:text-blue-400">{p.code}</td>
                    <td className="p-3 font-bold text-slate-900 dark:text-slate-100">
                      <div className="flex items-center space-x-2">
                        <span>{p.name}</span>
                        {p.promo_type && (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                              p.promo_type.toLowerCase() === 'tesir' || p.promo_type.toLowerCase() === 'teshir'
                                ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {p.promo_type.toLowerCase() === 'tesir' || p.promo_type.toLowerCase() === 'teshir'
                              ? 'Təsir'
                              : 'Adi'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-center font-mono font-semibold text-slate-700 dark:text-slate-300">{p.store_count}</td>
                    <td className="p-3 text-right font-mono font-bold text-blue-700 dark:text-blue-300">{(p.total_distribution_qty ?? (p.total_sale + p.total_stock)).toLocaleString()}</td>
                    <td className="p-3 text-right font-mono text-slate-700 dark:text-slate-300">{p.total_fc.toLocaleString()}</td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">{p.total_sale.toLocaleString()}</td>
                    <td className="p-3 text-right font-extrabold text-blue-600 dark:text-blue-400">{p.achievement_pct}%</td>
                    <td className="p-3 text-right font-mono text-slate-700 dark:text-slate-300">{p.total_stock.toLocaleString()}</td>
                    <td className="p-3 text-center font-mono">
                      {p.stockout_store_count > 0 ? (
                        <span className="text-rose-600 dark:text-rose-400 font-bold">{p.stockout_store_count} mağaza</span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-600">0</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <Sparkline
                        data={generateDeterministicSparkline(p.code, p.total_sale, p.achievement_pct, 12)}
                        width={62}
                        height={20}
                        showBadge={true}
                      />
                    </td>
                  </tr>
                );
              })}
              {sortedProducts.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-500 dark:text-slate-400 font-medium">Süzgəclərə uyğun heç bir məhsul tapılmadı.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
