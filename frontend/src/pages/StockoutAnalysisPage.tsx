import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { AlertTriangle, TrendingDown, Package, ShieldAlert, Store, ArrowUpRight } from 'lucide-react';
import { isPromoTypeMatch } from '../utils/filterUtils';
import { SortableHeader } from '../components/common/SortableHeader';
import { SpotlightCard } from '../components/common/SpotlightCard';
import { AnimatedCounter } from '../components/common/AnimatedCounter';

export const StockoutAnalysisPage: React.FC = () => {
  const { data, setSelectedProductDetail, filters } = useData();
  const [sortField, setSortField] = useState<string>('stockout_store_count');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  const product_performances = data?.product_performances || [];
  const kpi_cards = data?.kpi_cards || ({} as any);

  const store_performances = data?.store_performances || [];

  const stockoutProducts = product_performances.filter((p) => {
    if (p.stockout_store_count <= 0) return false;
    if (filters.selectedProduct && p.code !== filters.selectedProduct) return false;
    if (filters.selectedCategory && filters.selectedCategory !== 'ALL' && p.category !== filters.selectedCategory) return false;
    if (filters.selectedFamily && filters.selectedFamily !== 'ALL' && p.family !== filters.selectedFamily) return false;
    if (filters.promoType && filters.promoType !== 'ALL' && !isPromoTypeMatch(p, filters.promoType)) return false;
    return true;
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

  const sortedProducts = [...stockoutProducts].sort((a: any, b: any) => {
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

  // Top stockout product
  const topStockoutProduct = stockoutProducts.length > 0
    ? [...stockoutProducts].sort((a, b) => b.stockout_store_count - a.stockout_store_count)[0]
    : null;

  // Real aggregations for lost revenue & lost sales volume
  const totalLostRevenue = Math.round(product_performances.reduce((acc, p) => acc + (p.estimated_lost_revenue || 0), 0));
  const totalLostSales = Math.round(product_performances.reduce((acc, p) => acc + (p.estimated_lost_sales || 0), 0));

  // Dynamic store risk distribution based on real store stockout percentages
  const monitoredStoreCount = store_performances.length || kpi_cards.total_stores || 0;
  const highRiskCount = store_performances.filter((s) => (s.stockout_pct || 0) >= 30).length;
  const mediumRiskCount = store_performances.filter((s) => (s.stockout_pct || 0) > 0 && (s.stockout_pct || 0) < 30).length;
  const highRiskPct = monitoredStoreCount > 0 ? Math.round((highRiskCount / monitoredStoreCount) * 100) : 0;
  const mediumRiskPct = monitoredStoreCount > 0 ? Math.round((mediumRiskCount / monitoredStoreCount) * 100) : 0;

  return (
    <div className="space-y-6 pb-12 text-xs">
      {/* Header Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Stokout Analizi (Stockout Analysis)</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">"Bu məhsul neçə mağazada stock out olub?" sualına cavab və şəbəkə stokout vəziyyəti</p>
        </div>
      </div>

      {/* 4 Executive KPI Cards (Filling Top Empty Space) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Stokout Olan Mağaza Sayı */}
        <SpotlightCard spotlightColor="rose" glowBorder="rose" className="p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider">Stokout Olan Mağazalar</span>
            <div className="p-2 bg-rose-50 dark:bg-rose-950/60 rounded-xl text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-4 h-4 animate-pulse" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-black text-rose-600 dark:text-rose-400">
                <AnimatedCounter value={kpi_cards.stockout_stores_count ?? 0} />
              </span>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Mağazada</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
              <span>Şəbəkə Stokout Faizi:</span>
              <span className="font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.5 rounded-md border border-rose-100 dark:border-rose-900/60 neon-pulse-rose">
                <AnimatedCounter value={kpi_cards.stockout_rate_pct ?? 0} suffix="%" />
              </span>
            </p>
          </div>
        </SpotlightCard>

        {/* Card 2: İtirilmiş Satış Həcmi */}
        <SpotlightCard spotlightColor="blue" glowBorder="blue" className="p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider">Təxmini İtirilmiş Satış</span>
            <div className="p-2 bg-blue-50 dark:bg-blue-950/60 rounded-xl text-blue-600 dark:text-blue-400">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline space-x-1">
              <span className="text-2xl font-black text-slate-900 dark:text-slate-100">
                <AnimatedCounter value={totalLostRevenue} prefix="₼ " />
              </span>
              <span className="text-[10px] text-slate-400 font-semibold">potensial</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
              <span>Təxmini İtki:</span>
              <span className="font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded-md border border-blue-100 dark:border-blue-900/60">
                ~<AnimatedCounter value={totalLostSales} suffix=" Ədəd" />
              </span>
            </p>
          </div>
        </SpotlightCard>

        {/* Card 3: Kritik Stokout Məhsul */}
        <SpotlightCard spotlightColor="purple" glowBorder="cyan" className="p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider">Ən Kritik Stokout Məhsul</span>
            <div className="p-2 bg-purple-50 dark:bg-purple-950/60 rounded-xl text-purple-600 dark:text-purple-400">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-sm font-black text-slate-900 dark:text-slate-100 truncate" title={topStockoutProduct?.name || "N/A"}>
              {topStockoutProduct?.name || "N/A"}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
              <span>Bitən Mağazalar:</span>
              <span className="font-bold text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-1.5 py-0.5 rounded-md border border-purple-100 dark:border-purple-900/60">
                {topStockoutProduct ? `${topStockoutProduct.stockout_store_count} / ${topStockoutProduct.store_count}` : '0 / 0'} Mğz
              </span>
            </p>
          </div>
        </SpotlightCard>

        {/* Card 4: Stokout Risk Səviyyəsi Dağılımı */}
        <SpotlightCard spotlightColor="amber" glowBorder="amber" className="p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider">Stokout Risk Səviyyəsi</span>
            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-700 dark:text-slate-300">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 space-y-1.5">
            <div className="flex justify-between text-[11px] font-bold">
              <span className="text-rose-600 dark:text-rose-400">Yüksək ({highRiskCount} Mğz)</span>
              <span className="text-amber-600 dark:text-amber-400">Orta ({mediumRiskCount} Mğz)</span>
            </div>
            <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
              <div className="bg-rose-500 h-full transition-all" style={{ width: `${highRiskPct}%` }} title={`Yüksək Risk (${highRiskCount})`} />
              <div className="bg-amber-400 h-full transition-all" style={{ width: `${mediumRiskPct}%` }} title={`Orta Risk (${mediumRiskCount})`} />
            </div>
            <p className="text-[10px] text-slate-400 font-medium text-right">{monitoredStoreCount}/{monitoredStoreCount} Mağaza İzlənir</p>
          </div>
        </SpotlightCard>
      </div>

      {/* Stockout List Table */}
      <div className="p-5 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 relative overflow-hidden luminous-border-blue">
        {/* Top delicate luminous blue line */}
        <div className="absolute top-0 inset-x-0 h-[2px] luminous-line-blue z-20" />
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Məhsullar Üzrə Stokout Tezliyi Və Mağaza Sayları</h3>
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
            Cəmi {stockoutProducts.length} Riskli Məhsul
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[10px] uppercase border-b border-slate-200 dark:border-slate-700 font-bold select-none">
              <tr>
                <SortableHeader label="Məhsul Kodu" field="code" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="left" />
                <SortableHeader label="Məhsul Adı" field="name" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="left" />
                <SortableHeader label="Stokout Mağazalar" field="stockout_store_count" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="center" />
                <SortableHeader label="Stokout Faizi" field="stockout_pct" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="center" />
                <SortableHeader label="FC" field="total_fc" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="right" />
                <SortableHeader label="SALE" field="total_sale" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sortedProducts.map((p) => (
                <tr
                  key={p.code}
                  onClick={() => setSelectedProductDetail({ store: filters.selectedStore || 'ALL', code: p.code })}
                  className="hover:bg-blue-50/70 dark:hover:bg-slate-800/60 cursor-pointer transition-all"
                >
                  <td className="p-3 font-mono font-bold text-blue-700 dark:text-blue-400">{p.code}</td>
                  <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{p.name}</td>
                  <td className="p-3 text-center font-bold text-rose-600 dark:text-rose-400">{p.stockout_store_count} / {p.store_count} mağaza</td>
                  <td className="p-3 text-center font-mono text-rose-600 dark:text-rose-400 font-bold">{p.stockout_pct}%</td>
                  <td className="p-3 text-right font-mono text-slate-700 dark:text-slate-300">{p.total_fc}</td>
                  <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">{p.total_sale}</td>
                </tr>
              ))}
              {stockoutProducts.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 dark:text-slate-400 font-medium">Stokout olan heç bir məhsul tapılmadı.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
