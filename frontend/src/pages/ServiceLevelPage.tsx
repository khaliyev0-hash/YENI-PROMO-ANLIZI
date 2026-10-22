import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Truck, Store, Building2, Search, CheckCircle2, AlertTriangle } from 'lucide-react';
import { isPromoTypeMatch } from '../utils/filterUtils';
import { SortableHeader } from '../components/common/SortableHeader';
import { SpotlightCard } from '../components/common/SpotlightCard';
import { AnimatedCounter } from '../components/common/AnimatedCounter';

export const ServiceLevelPage: React.FC = () => {
  const { data, filters } = useData();
  const [selectedSupplier, setSelectedSupplier] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<string>('service_level_pct');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  const fallbackDemoRecords = [
    { store: "ST-101", supplier: "Azərsun Qida MMC", code: "101201", name: "BANAN PREMIUM", ordered_qty: 250, accepted_qty: 245, service_level_pct: 98.0, status: "EXCELLENT" },
    { store: "ST-101", supplier: "Agro-Trade MMC", code: "101202", name: "ALMA QIRMIZI Local", ordered_qty: 180, accepted_qty: 165, service_level_pct: 91.7, status: "GOOD" },
    { store: "ST-101", supplier: "Anchor Azerbaijan", code: "101203", name: "KƏRƏ YAĞI ANCHOR 82% 500G", ordered_qty: 120, accepted_qty: 98, service_level_pct: 81.7, status: "WEAK" },
    { store: "ST-101", supplier: "Pal Süt Qrup", code: "101204", name: "SÜD PAL SÜD 3.2% 1L", ordered_qty: 150, accepted_qty: 95, service_level_pct: 63.3, status: "CRITICAL" },
    { store: "ST-102", supplier: "Milli Şəkər MMC", code: "101205", name: "ŞƏKƏR TOZU 1KG", ordered_qty: 300, accepted_qty: 290, service_level_pct: 96.7, status: "EXCELLENT" },
    { store: "ST-102", supplier: "Dənər Un Sanayi", code: "101206", name: "UN DƏNƏR 5KG", ordered_qty: 200, accepted_qty: 184, service_level_pct: 92.0, status: "GOOD" },
    { store: "ST-102", supplier: "Azərçay ASC", code: "101207", name: "ÇAY AZƏRÇAY 250G", ordered_qty: 140, accepted_qty: 105, service_level_pct: 75.0, status: "WEAK" },
    { store: "ST-102", supplier: "Milli Süd MMC", code: "101208", name: "QATIQ MİLLİ 1KG", ordered_qty: 160, accepted_qty: 92, service_level_pct: 57.5, status: "CRITICAL" },
    { store: "ST-103", supplier: "Nestle Azerbaijan", code: "101209", name: "QƏHVƏ NESCAFE GOLD 100G", ordered_qty: 100, accepted_qty: 97, service_level_pct: 97.0, status: "EXCELLENT" },
    { store: "ST-103", supplier: "Mondelez Azerbaijan", code: "101210", name: "ŞOKOLAD ALPEN GOLD 90G", ordered_qty: 220, accepted_qty: 198, service_level_pct: 90.0, status: "GOOD" },
    { store: "ST-103", supplier: "Coca-Cola Bottlers", code: "101211", name: "KOLA COCA-COLA 1.5L", ordered_qty: 400, accepted_qty: 320, service_level_pct: 80.0, status: "WEAK" },
    { store: "ST-103", supplier: "Sirab ASC", code: "101212", name: "SU SIRAB 1.5L", ordered_qty: 350, accepted_qty: 210, service_level_pct: 60.0, status: "CRITICAL" },
    { store: "ST-104", supplier: "Xırdalan Şirniyyat", code: "101213", name: "PEÇENYE XIRDALAN 300G", ordered_qty: 130, accepted_qty: 126, service_level_pct: 96.9, status: "EXCELLENT" },
    { store: "ST-104", supplier: "Ankara Qida", code: "101214", name: "MAKARON ANKARA 500G", ordered_qty: 210, accepted_qty: 195, service_level_pct: 92.9, status: "GOOD" },
    { store: "ST-105", supplier: "Basmati Impex", code: "101215", name: "DÜYÜ BASMATI 1KG", ordered_qty: 190, accepted_qty: 145, service_level_pct: 76.3, status: "WEAK" },
    { store: "ST-105", supplier: "Milli Yumurta MMC", code: "101216", name: "YUMURTA TƏZƏ 30-LUQ", ordered_qty: 280, accepted_qty: 182, service_level_pct: 65.0, status: "CRITICAL" }
  ];

  const records = (data?.service_level_records && data.service_level_records.length > 0)
    ? data.service_level_records
    : fallbackDemoRecords;

  const suppliers = useMemo(() => Array.from(new Set(records.map((r) => r.supplier))).sort(), [records]);

  const storeMetaMap = useMemo(() => {
    const map = new Map<string, { area?: string; sub_area?: string }>();
    data?.store_performances?.forEach((s) => {
      map.set(s.store, { area: s.area, sub_area: s.sub_area });
    });
    return map;
  }, [data?.store_performances]);

  const productMetaMap = useMemo(() => {
    const map = new Map<string, { category?: string; family?: string }>();
    data?.product_performances?.forEach((p) => {
      map.set(p.code, { category: p.category, family: p.family });
    });
    return map;
  }, [data?.product_performances]);

  const productPromoMap = useMemo(() => {
    const map: Record<string, string> = {};
    (data?.product_performances || []).forEach((p) => {
      if (p.code && p.promo_type) {
        map[p.code] = p.promo_type;
      }
    });
    return map;
  }, [data?.product_performances]);

  const filteredRecords = records.filter((r) => {
    // Global Store filter
    if (filters.selectedStore && r.store !== filters.selectedStore) return false;

    // Global Area & Sub Area filters
    const storeMeta = storeMetaMap.get(r.store);
    if (filters.selectedArea && filters.selectedArea !== 'ALL') {
      if (!storeMeta || storeMeta.area !== filters.selectedArea) return false;
    }
    if (filters.selectedSubArea && filters.selectedSubArea !== 'ALL') {
      if (!storeMeta || storeMeta.sub_area !== filters.selectedSubArea) return false;
    }

    // Global Product filter
    if (filters.selectedProduct && r.code !== filters.selectedProduct) return false;

    // Global Category & Family filters
    const prodMeta = productMetaMap.get(r.code);
    if (filters.selectedCategory && filters.selectedCategory !== 'ALL') {
      if (!prodMeta || prodMeta.category !== filters.selectedCategory) return false;
    }
    if (filters.selectedFamily && filters.selectedFamily !== 'ALL') {
      if (!prodMeta || prodMeta.family !== filters.selectedFamily) return false;
    }

    // Global Promo Type filter
    if (filters.promoType && filters.promoType !== 'ALL' && !isPromoTypeMatch(r.code, filters.promoType, productPromoMap)) return false;

    // Supplier filter (local to ServiceLevelPage)
    if (selectedSupplier !== 'ALL' && r.supplier !== selectedSupplier) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!r.name.toLowerCase().includes(q) && !r.code.toLowerCase().includes(q) && !r.supplier.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      const isStringField = field === 'store' || field === 'supplier' || field === 'code' || field === 'name' || field === 'status';
      setSortAsc(isStringField);
    }
  };

  const sortedRecords = useMemo(() => {
    return [...filteredRecords].sort((a: any, b: any) => {
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
  }, [filteredRecords, sortField, sortAsc]);

  const totalOrdered = filteredRecords.reduce((sum, r) => sum + r.ordered_qty, 0);
  const totalAccepted = filteredRecords.reduce((sum, r) => sum + r.accepted_qty, 0);
  const avgServiceLevel = totalOrdered > 0 ? Math.min(Math.round((totalAccepted / totalOrdered) * 1000) / 10, 100) : 0;
  const criticalCount = filteredRecords.filter((r) => r.service_level_pct < 75).length;

  if (!data) return <div className="p-8 text-center text-slate-400">Məlumat yüklənir...</div>;

  return (
    <div className="space-y-6 pb-12 text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 bg-blue-600 text-white rounded-lg font-black text-sm">
              <Truck className="w-5 h-5 stroke-[2.5]" />
            </span>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Service Level (Təminat Və Karşılama Səviyyəsi)</h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Mağaza və tedarikçi firma üzrə sifariş verilən və qəbul olunan miqdarların təminat faizləri
          </p>
        </div>
      </div>

      {/* KPI Summary Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SpotlightCard spotlightColor="blue" glowBorder="blue" className="p-4 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block">Ortalama Service Level</span>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-0.5">
            <AnimatedCounter value={avgServiceLevel} suffix="%" />
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">Ümumi şəbəkə təminat ortalaması</p>
        </SpotlightCard>

        <SpotlightCard spotlightColor="cyan" glowBorder="cyan" className="p-4 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block">Sifariş Verilən Miqdar</span>
          <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-0.5">
            <AnimatedCounter value={totalOrdered} suffix=" u" />
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">Mağazalara verilən ümumi sifariş</p>
        </SpotlightCard>

        <SpotlightCard spotlightColor="emerald" glowBorder="emerald" className="p-4 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block">Qəbul Olunan Miqdar</span>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
            <AnimatedCounter value={totalAccepted} suffix=" u" />
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">Depodan/Tedarikçidən gələn stok</p>
        </SpotlightCard>

        <SpotlightCard spotlightColor="rose" glowBorder="rose" className="p-4 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block">Kritik Təminatlı Məhsullar</span>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-0.5">
            <AnimatedCounter value={criticalCount} suffix=" SKU" />
          </p>
          <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold">Service Level &lt; 75% olan hallar</p>
        </SpotlightCard>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">

          {/* Supplier Filter */}
          <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <Building2 className="w-4 h-4 text-blue-600" />
            <span className="font-bold text-slate-700 dark:text-slate-300 text-xs">Firma:</span>
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-900 dark:text-slate-100 font-bold text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="ALL">Bütün Firmalar</option>
              {suppliers.map((sup) => (
                <option key={sup} value={sup}>{sup}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Məhsul adı, kodu və ya firma..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Service Level Table */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Mağaza Və Məhsul Bazında Service Level Detalları</h3>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{filteredRecords.length} qeyd</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse select-none">
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700 font-bold">
              <tr>
                <SortableHeader label="Mağaza" field="store" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="left" />
                <SortableHeader label="Firma / Tedarikçi" field="supplier" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="left" />
                <SortableHeader label="Məhsul Kodu" field="code" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="left" />
                <SortableHeader label="Məhsul Adı" field="name" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="left" />
                <SortableHeader label="Sifariş Verilən Miqdar" field="ordered_qty" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="right" />
                <SortableHeader label="Qəbul Olunan Miqdar" field="accepted_qty" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="right" />
                <SortableHeader label="Təminat Faizi (%)" field="service_level_pct" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="right" />
                <SortableHeader label="Status" field="status" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="center" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sortedRecords.map((r, idx) => (
                <tr key={`${r.store}-${r.code}-${idx}`} className="hover:bg-blue-50/70 dark:hover:bg-slate-800/60 transition-all">
                  <td className="p-3 font-bold text-slate-900 dark:text-slate-100">Mağaza {r.store}</td>
                  <td className="p-3 font-semibold text-slate-700 dark:text-slate-300">{r.supplier}</td>
                  <td className="p-3 font-mono font-bold text-blue-700 dark:text-blue-400">{r.code}</td>
                  <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{r.name}</td>
                  <td className="p-3 text-right font-mono font-bold text-slate-700 dark:text-slate-300">{r.ordered_qty.toLocaleString()} u</td>
                  <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">{r.accepted_qty.toLocaleString()} u</td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <div className="w-16 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700">
                        <div
                          className={`h-full rounded-full ${
                            r.service_level_pct >= 95 ? 'bg-emerald-500' :
                            r.service_level_pct >= 90 ? 'bg-blue-500' :
                            r.service_level_pct >= 75 ? 'bg-amber-500' : 'bg-rose-500'
                          }`}
                          style={{ width: `${r.service_level_pct}%` }}
                        />
                      </div>
                      <span className={`font-mono font-extrabold ${
                        r.service_level_pct >= 95 ? 'text-emerald-700 dark:text-emerald-400' :
                        r.service_level_pct >= 90 ? 'text-blue-700 dark:text-blue-400' :
                        r.service_level_pct >= 75 ? 'text-amber-700 dark:text-amber-400' : 'text-rose-700 dark:text-rose-400'
                      }`}>
                        {r.service_level_pct}%
                      </span>
                    </div>
                  </td>
                  <td className="p-3 text-center">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                      r.status === 'EXCELLENT' ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800' :
                      r.status === 'GOOD' ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800' :
                      r.status === 'WEAK' ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-800' : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                    }`}>
                      {r.status === 'EXCELLENT' ? '🟢 Əla' : r.status === 'GOOD' ? '🔵 Yaxşı' : r.status === 'WEAK' ? '🟠 Zəif' : '🔴 Kritik'}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredRecords.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500 dark:text-slate-400">Məlumat tapılmadı.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
