import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Store, Search, Calendar, Download, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { getApiBase } from '../utils/api';
import { SortableHeader } from '../components/common/SortableHeader';
import { isPromoTypeMatch } from '../utils/filterUtils';

interface ProductDailyRow {
  code: string;
  name: string;
  distributionQty: number;
  inflowTotal: number;
  fc: number;
  sale: number;
  finalStock: number;
  ref: number | null;
  regular30d: number | null;
  overStock: number | null;
  overStockBase: number | null;
  dates: string[];
  stocks: (number | null)[];
  inflows: (number | null)[];
}

const formatDate = (isoDate: string): string => {
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const [y, m, d] = parts;
  return `${d}.${m}.${y}`;
};

export const StoreDailyStockPage: React.FC = () => {
  const { data, filters, setFilters } = useData();
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [rows, setRows] = useState<ProductDailyRow[]>([]);
  const [windowDates, setWindowDates] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const [sortField, setSortField] = useState<string>('sale');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<{ done: number; total: number } | null>(null);

  const availableStores = useMemo(() => {
    let list = data?.store_performances || [];
    if (filters?.selectedArea && filters.selectedArea !== 'ALL') {
      list = list.filter((s) => s.area === filters.selectedArea);
    }
    if (filters?.selectedSubArea && filters.selectedSubArea !== 'ALL') {
      list = list.filter((s) => s.sub_area === filters.selectedSubArea);
    }
    return list.map((s) => s.store);
  }, [data?.store_performances, filters?.selectedArea, filters?.selectedSubArea]);

  useEffect(() => {
    if (filters?.selectedStore && availableStores.includes(filters.selectedStore)) {
      setSelectedStore(filters.selectedStore);
    } else if (availableStores.length > 0 && (!selectedStore || !availableStores.includes(selectedStore))) {
      setSelectedStore(availableStores[0]);
    }
  }, [filters?.selectedStore, availableStores]);

  const productMetaMap = useMemo(() => {
    const map = new Map<string, any>();
    data?.product_performances?.forEach((p) => {
      map.set(p.code, p);
    });
    return map;
  }, [data?.product_performances]);

  const handleExportAll = async () => {
    if (!availableStores.length) return;
    setExporting(true);
    setExportProgress({ done: 0, total: availableStores.length });

    const allRows: any[] = [];
    let referenceDates: string[] = [];

    const API_BASE = getApiBase();

    let done = 0;
    for (const storeCode of availableStores) {
      try {
        const r = await fetch(`${API_BASE}/store-daily-stock?store=${storeCode}`);
        const d = await r.json();
        if (referenceDates.length === 0 && d.dates && d.dates.length > 0) {
          referenceDates = d.dates;
        }
        (d.products || []).forEach((p: any) => {
          allRows.push({
            store: storeCode,
            code: p.code,
            name: p.name,
            distributionQty: p.distribution_qty ?? (p.sale + p.final_stock),
            inflowTotal: p.inflow_total ?? 0,
            fc: p.fc,
            sale: p.sale,
            finalStock: p.final_stock,
            ref: p.ref !== undefined ? p.ref : null,
            regular30d: p.regular_30d !== undefined ? p.regular_30d : 0,
            overStock: p.over_stock !== undefined ? p.over_stock : null,
            stocks: p.stocks || [],
          });
        });
      } catch (err) {
        console.error(`Export fetch failed for store ${storeCode}:`, err);
      }
      done += 1;
      setExportProgress({ done, total: availableStores.length });
    }

    if (referenceDates.length === 0 && data?.stock_dates && data.stock_dates.length > 0) {
      referenceDates = data.stock_dates;
    }

    const header = [
      'Mağaza',
      'Kod',
      'Məhsul Adı',
      'Dağılım Miqdarı',
      'Məhsul Girişləri',
      'FC',
      'SALE',
      'Son Stok',
      'Ref',
      'Adi satış (30 gün)',
      'Over Stock',
      ...referenceDates.map(formatDate),
    ];
    const sheetData: any[][] = [header];

    allRows.forEach((r) => {
      sheetData.push([
        `Mağaza ${r.store}`,
        r.code,
        r.name,
        r.distributionQty,
        r.inflowTotal,
        r.fc,
        r.sale,
        r.finalStock,
        r.ref !== null && r.ref !== undefined ? r.ref : '',
        r.regular30d !== null && r.regular30d !== undefined ? r.regular30d : 0,
        r.overStock !== null && r.overStock !== undefined ? r.overStock : '',
        ...referenceDates.map((_, idx) => (r.stocks[idx] !== undefined && r.stocks[idx] !== null ? r.stocks[idx] : '')),
      ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

    worksheet['!cols'] = [
      { wch: 12 }, // Mağaza
      { wch: 10 }, // Kod
      { wch: 28 }, // Məhsul Adı
      { wch: 14 }, // Dağılım Miqdarı
      { wch: 14 }, // Məhsul Girişləri
      { wch: 8 },  // FC
      { wch: 8 },  // SALE
      { wch: 10 }, // Son Stok
      { wch: 8 },  // Ref
      { wch: 18 }, // Adi satış (30 gün)
      { wch: 12 }, // Over Stock
      ...referenceDates.map(() => ({ wch: 12 })),
    ];
    worksheet['!freeze'] = { xSplit: 5, ySplit: 1 };

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Gunluk Stok');

    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `tamstore_magaza_gunluk_stok_${today}.xlsx`);

    setExporting(false);
    setExportProgress(null);
  };

  useEffect(() => {
    if (!selectedStore) {
      setRows([]);
      setWindowDates([]);
      return;
    }

    setLoading(true);

    const API_BASE = getApiBase();
    fetch(`${API_BASE}/store-daily-stock?store=${selectedStore}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.dates && d.dates.length > 0) {
          setWindowDates(d.dates);
        }
        const mappedRows: ProductDailyRow[] = (d.products || []).map((p: any) => ({
          code: p.code,
          name: p.name,
          distributionQty: p.distribution_qty ?? (p.sale + p.final_stock),
          inflowTotal: p.inflow_total ?? 0,
          fc: p.fc ?? 0,
          sale: p.sale ?? 0,
          finalStock: p.final_stock ?? 0,
          ref: p.ref !== undefined ? p.ref : null,
          regular30d: p.regular_30d !== undefined ? p.regular_30d : 0,
          overStock: p.over_stock !== undefined ? p.over_stock : null,
          overStockBase: p.over_stock_base !== undefined ? p.over_stock_base : null,
          dates: p.dates || d.dates || [],
          stocks: p.stocks || [],
          inflows: p.inflows || [],
        }));
        setRows(mappedRows);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching store daily stock:', err);
        setRows([]);
        setLoading(false);
      });
  }, [selectedStore]);

  const dateColumns = useMemo(() => {
    if (windowDates.length > 0) {
      return windowDates;
    }
    if (data?.stock_dates && data.stock_dates.length > 0) {
      return data.stock_dates;
    }
    const allDatesSet = new Set<string>();
    rows.forEach((r) => {
      r.dates.forEach((d) => allDatesSet.add(d));
    });
    if (allDatesSet.size > 0) {
      return Array.from(allDatesSet).sort();
    }
    return rows.find((r) => r.dates.length > 0)?.dates || [];
  }, [windowDates, data?.stock_dates, rows]);

  const filteredRows = rows.filter((r) => {
    if (filters?.selectedProduct && r.code !== filters.selectedProduct) return false;
    const meta = productMetaMap.get(r.code);
    if (filters?.selectedCategory && filters.selectedCategory !== 'ALL') {
      if (!meta || meta.category !== filters.selectedCategory) return false;
    }
    if (filters?.selectedFamily && filters.selectedFamily !== 'ALL') {
      if (!meta || meta.family !== filters.selectedFamily) return false;
    }
    if (filters?.promoType && filters.promoType !== 'ALL') {
      if (!isPromoTypeMatch(meta || r.code, filters.promoType)) return false;
    }
    if (!search) return true;
    const q = search.toLowerCase();
    return r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q);
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

  const sortedRows = useMemo(() => {
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

  return (
    <div className="space-y-6 pb-12 text-xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Mağaza Üzrə Günlük Stok Baxışı (Store Daily Stock)</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Bir mağaza seçin — o mağazadakı bütün məhsulların FC, SALE, stok, məhsul girişləri, Over Stock və gün-gün stok qalığını görün</p>
        </div>
        <button
          onClick={handleExportAll}
          disabled={exporting}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold px-4 py-2 rounded-xl shadow-xs transition-all"
        >
          {exporting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>İxrac edilir... {exportProgress ? `${exportProgress.done}/${exportProgress.total}` : ''}</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              <span>Excel-ə İxrac Et (Bütün Mağazalar)</span>
            </>
          )}
        </button>
      </div>

      {/* Store selector */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center gap-4">
        <div className="flex items-center space-x-2">
          <Store className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="font-bold text-slate-700 dark:text-slate-200">Mağaza Seçin:</span>
        </div>
        <select
          value={selectedStore}
          onChange={(e) => {
            setSelectedStore(e.target.value);
            setFilters({ ...filters, selectedStore: e.target.value });
          }}
          className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-slate-800 dark:text-slate-100 font-semibold focus:outline-none focus:border-blue-500 dark:[&>option]:bg-slate-900 dark:[&>option]:text-slate-100"
        >
          <option value="">— Mağaza seçin —</option>
          {availableStores.map((s) => (
            <option key={s} value={s}>Mağaza {s}</option>
          ))}
        </select>

        {selectedStore && (
          <div className="relative ml-auto w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Məhsul axtar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>
        )}
      </div>

      {!selectedStore && (
        <div className="p-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs text-center text-slate-500 dark:text-slate-400">
          <Calendar className="w-8 h-8 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
          Davam etmək üçün yuxarıdan bir mağaza seçin.
        </div>
      )}

      {selectedStore && loading && (
        <div className="p-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs text-center text-slate-500 dark:text-slate-400 flex items-center justify-center space-x-2">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600 dark:text-blue-400" />
          <span>Stok məlumatları yüklənir...</span>
        </div>
      )}

      {selectedStore && !loading && rows.length === 0 && (
        <div className="p-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs text-center text-slate-500 dark:text-slate-400">
          <Store className="w-8 h-8 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
          Mağaza {selectedStore} üçün heç bir məhsul məlumatı tapılmadı. Zəhmət olmasa yuxarıdan yeni Excel faylını yükləyin.
        </div>
      )}

      {selectedStore && !loading && rows.length > 0 && (
        <div className="p-5 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 relative overflow-hidden">
          {/* Top delicate luminous blue line */}
          <div className="absolute top-0 inset-x-0 h-[2px] luminous-line-blue z-20" />

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Mağaza {selectedStore} — Məhsul Üzrə Günlük Stok Cədvəli</h3>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{filteredRows.length} məhsul</span>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
            <table className="w-full text-left border-collapse select-none">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700 font-bold">
                <tr>
                  <SortableHeader label="Kod" field="code" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="left" className="sticky left-0 bg-slate-100 dark:bg-slate-800 z-10 min-w-[100px]" />
                  <SortableHeader label="Məhsul Adı" field="name" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="left" className="sticky left-[100px] bg-slate-100 dark:bg-slate-800 z-10 min-w-[220px] border-r border-slate-200 dark:border-slate-700" />
                  <SortableHeader label="DAĞILIM MİQDARI" field="distributionQty" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="right" className="text-blue-800 dark:text-blue-300" />
                  <SortableHeader label="MƏHSUL GİRİŞLƏRİ" field="inflowTotal" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="right" className="text-emerald-800 dark:text-emerald-300" />
                  <SortableHeader label="FC" field="fc" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="right" />
                  <SortableHeader label="SALE" field="sale" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="right" />
                  <SortableHeader label="Son Stok" field="finalStock" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="right" />
                  <SortableHeader label="REF" field="ref" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="right" className="text-slate-700 dark:text-slate-300" />
                  <SortableHeader label="OVER STOCK" field="overStock" currentSortField={sortField} sortAsc={sortAsc} onSort={handleSort} align="right" className="text-amber-800 dark:text-amber-300 border-r border-slate-200 dark:border-slate-700 min-w-[110px]" />
                  {dateColumns.map((d) => (
                    <th key={d} className="p-3 text-right font-bold whitespace-nowrap">{formatDate(d)}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sortedRows.map((r) => {
                  const unsold = Math.max(0, r.inflowTotal - r.sale);
                  const regVal = r.regular30d ?? 0;
                  const overStockTooltip = r.ref !== null && r.ref !== undefined
                    ? `Giriş ${r.inflowTotal} − Satış ${r.sale} = ${unsold} satılmayan; Ref ${r.ref}; Adi satış (30 gün) ${regVal} → Over Stock ${r.overStock ?? 0}`
                    : undefined;

                  return (
                    <tr key={r.code} className="hover:bg-blue-50/70 dark:hover:bg-slate-800/60 transition-all">
                      <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400 sticky left-0 bg-white dark:bg-slate-900 z-10">{r.code}</td>
                      <td className="p-3 font-semibold text-slate-900 dark:text-slate-100 sticky left-[100px] bg-white dark:bg-slate-900 z-10 border-r border-slate-200 dark:border-slate-800 whitespace-nowrap">{r.name}</td>
                      <td className="p-3 text-right font-mono font-bold text-blue-700 dark:text-blue-300">{r.distributionQty.toLocaleString()}</td>
                      <td className={`p-3 text-right font-mono font-bold ${r.inflowTotal > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                        {r.inflowTotal > 0 ? `+${r.inflowTotal.toLocaleString()}` : '0'}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-700 dark:text-slate-300">{r.fc.toLocaleString()}</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">{r.sale.toLocaleString()}</td>
                      <td className={`p-3 text-right font-mono font-bold ${r.finalStock <= 0 ? 'text-rose-600 dark:text-rose-400' : 'text-blue-600 dark:text-blue-400'}`}>
                        {r.finalStock.toLocaleString()}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-700 dark:text-slate-300">
                        {r.ref !== null && r.ref !== undefined ? r.ref.toLocaleString() : '–'}
                      </td>
                      <td className="p-3 text-right font-mono border-r border-slate-200 dark:border-slate-800">
                        {r.overStock === null ? (
                          <span className="text-slate-400 dark:text-slate-500 font-mono" title="Ref daxil edilməyib">–</span>
                        ) : r.overStock > 0 ? (
                          <span
                            className="px-2 py-0.5 text-amber-800 dark:text-amber-200 font-bold rounded-md inline-block luminous-cell-amber"
                            title={overStockTooltip}
                          >
                            {r.overStock.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 font-mono">–</span>
                        )}
                      </td>
                      {dateColumns.map((d, idx) => {
                        const stockVal = r.stocks[idx];
                        const inflowVal = r.inflows[idx];
                        const isNullDay = stockVal === null || stockVal === undefined;
                        const isStockout = !isNullDay && stockVal <= 0;
                        const hasInflow = !isNullDay && inflowVal !== null && inflowVal !== undefined && inflowVal > 0;

                        let prevStockText = '';
                        if (hasInflow && idx > 0) {
                          let pIdx = idx - 1;
                          while (pIdx >= 0 && (r.stocks[pIdx] === null || r.stocks[pIdx] === undefined)) {
                            pIdx--;
                          }
                          if (pIdx >= 0 && r.stocks[pIdx] !== null) {
                            prevStockText = ` (əvvəlki gün ${r.stocks[pIdx]} -> ${stockVal})`;
                          }
                        }

                        let cellClass = 'p-3 text-right font-mono text-slate-700 dark:text-slate-300';
                        if (isNullDay) {
                          cellClass = 'p-3 text-right font-mono text-slate-400 dark:text-slate-600';
                        } else if (hasInflow) {
                          cellClass = 'p-3 text-right font-mono text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-sm';
                        } else if (isStockout) {
                          cellClass = 'p-3 text-right font-mono text-rose-600 dark:text-rose-400 font-bold bg-rose-500/5 dark:bg-rose-950/30';
                        }

                        return (
                          <td
                            key={d}
                            className={cellClass}
                            title={hasInflow ? `Məhsul girişi: +${inflowVal}${prevStockText}` : undefined}
                          >
                            {isNullDay ? (
                              '—'
                            ) : (
                              <div className="inline-flex items-center justify-end space-x-1">
                                <span>{stockVal.toLocaleString()}</span>
                                {hasInflow && (
                                  <span className="text-[9px] bg-emerald-600 text-white font-extrabold px-1 rounded-full">
                                    +{inflowVal}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={10 + dateColumns.length} className="p-6 text-center text-slate-500 dark:text-slate-400">Nəticə tapılmadı</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
