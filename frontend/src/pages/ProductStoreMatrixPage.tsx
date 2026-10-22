import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../context/DataContext';
import {
  Calendar, Search, Filter, Download, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight,
  TrendingUp, ShoppingBag, Box, AlertTriangle, CheckCircle2, Sparkles, RefreshCw, Layers
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { isPromoTypeMatch } from '../utils/filterUtils';

export const ProductStoreMatrixPage: React.FC = () => {
  const { data, setSelectedProductDetail, filters } = useData();
  const [metric, setMetric] = useState<string>("achievement");
  const [selectedDate, setSelectedDate] = useState<string>("ALL");
  const [matrixData, setMatrixData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Pagination for high performance rendering
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const availableDates: string[] = data?.stock_dates || data?.daily_summaries?.map((d) => d.date) || [];

  const formatDate = (isoDate: string): string => {
    const parts = isoDate.split('-');
    if (parts.length !== 3) return isoDate;
    const [y, m, d] = parts;
    return `${d}.${m}.${y}`;
  };

  const getHostName = () =>
    typeof window !== 'undefined' && window.location && window.location.hostname
      ? window.location.hostname
      : 'localhost';

  const fetchMatrix = () => {
    setLoading(true);
    const dateParam = selectedDate !== "ALL" ? `&date=${selectedDate}` : "";
    const API_BASE = import.meta.env.VITE_API_BASE_URL || `http://${getHostName()}:8000/api`;
    fetch(`${API_BASE}/matrix?metric=${metric}${dateParam}`)
      .then((res) => res.json())
      .then((resData) => {
        setMatrixData(resData);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Matrix load error:", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchMatrix();
  }, [metric, selectedDate]);

  // Memoized fast lookup map: store___code -> cell
  const cellMap = useMemo(() => {
    const map = new Map<string, any>();
    if (matrixData?.cells) {
      const cells = matrixData.cells;
      for (let i = 0; i < cells.length; i++) {
        const c = cells[i];
        map.set(`${c.store}___${c.code}`, c);
      }
    }
    return map;
  }, [matrixData]);

  const productMetaMap = useMemo(() => {
    const map = new Map<string, any>();
    data?.product_performances?.forEach((p) => {
      map.set(p.code, p);
    });
    return map;
  }, [data?.product_performances]);

  // Stores filtered by global Area, Sub Area, and Store filters
  const filteredStores: string[] = useMemo(() => {
    let list: string[] = matrixData?.stores || [];
    if (filters?.selectedStore) {
      list = list.filter((s) => s === filters.selectedStore);
    }
    if (filters?.selectedArea && filters.selectedArea !== 'ALL') {
      const areaStores = new Set(
        (data?.store_performances || [])
          .filter((s) => s.area === filters.selectedArea)
          .map((s) => s.store)
      );
      list = list.filter((s) => areaStores.has(s));
    }
    if (filters?.selectedSubArea && filters.selectedSubArea !== 'ALL') {
      const subAreaStores = new Set(
        (data?.store_performances || [])
          .filter((s) => s.sub_area === filters.selectedSubArea)
          .map((s) => s.store)
      );
      list = list.filter((s) => subAreaStores.has(s));
    }
    return list;
  }, [matrixData?.stores, filters?.selectedStore, filters?.selectedArea, filters?.selectedSubArea, data?.store_performances]);

  // Client-side search and global filtering (Category, Family, Product, Promo Type)
  const filteredProducts = useMemo(() => {
    if (!matrixData?.products) return [];
    let list = matrixData.products;

    if (filters?.selectedProduct) {
      list = list.filter((p: any) => p.code === filters.selectedProduct);
    }

    if (filters?.selectedCategory && filters.selectedCategory !== 'ALL') {
      list = list.filter((p: any) => p.category === filters.selectedCategory);
    }

    if (filters?.selectedFamily && filters.selectedFamily !== 'ALL') {
      list = list.filter((p: any) => {
        const meta = productMetaMap.get(p.code);
        return (p.family === filters.selectedFamily) || (meta && meta.family === filters.selectedFamily);
      });
    }

    if (filters?.promoType && filters.promoType !== 'ALL') {
      list = list.filter((p: any) => {
        const meta = productMetaMap.get(p.code);
        return isPromoTypeMatch(meta || p, filters.promoType);
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((p: any) =>
        p.code.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.category && p.category.toLowerCase().includes(q))
      );
    }

    return [...list].sort((a: any, b: any) => {
      const nameA = a.name || '';
      const nameB = b.name || '';
      return sortAsc ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });
  }, [matrixData, searchQuery, filters, productMetaMap, sortAsc]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filters, pageSize]);

  // Paginated product slice
  const paginatedProducts = useMemo(() => {
    if (pageSize >= 9999) return filteredProducts;
    const start = (currentPage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, currentPage, pageSize]);

  const totalPages = pageSize >= 9999 ? 1 : Math.ceil(filteredProducts.length / pageSize);

  const getCellColor = (val: number, status: string) => {
    if (metric === "achievement") {
      if (status === "STOCKOUT_LIMITED") return "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 font-bold border-rose-300 dark:border-rose-900";
      if (val < 70) return "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 font-semibold border-amber-300 dark:border-amber-900";
      if (val >= 120) return "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold border-blue-300 dark:border-blue-800";
      if (val >= 100) return "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold border-emerald-300 dark:border-emerald-800";
      return "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700";
    }
    if (metric === "stock" || metric === "stockout") {
      if (val <= 0.0001) return "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 font-bold border-rose-300 dark:border-rose-900";
      return "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
    }
    if (metric === "sales") {
      if (val > 0) return "bg-blue-50/70 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 font-bold border-blue-200 dark:border-blue-800";
      return "bg-slate-50 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700";
    }
    if (metric === "forecast") {
      if (val > 0) return "bg-indigo-50/70 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 font-semibold border-indigo-200 dark:border-indigo-800";
      return "bg-slate-50 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700";
    }
    return "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700";
  };

  // Full 2D Excel export of the entire matrix
  const exportFullMatrixToExcel = () => {
    if (!matrixData || !matrixData.stores || !filteredProducts.length) return;

    const stores: string[] = filteredStores;
    // Header row: SKU Kodu, Məhsul Adı, Kateqoriya, then Mağaza 1, Mağaza 2...
    const header = ['SKU Kodu', 'Məhsul Adı', 'Kateqoriya', ...stores.map(s => `Mağaza ${s}`)];
    const rows = [header];

    filteredProducts.forEach((p: any) => {
      const rowData = [p.code, p.name, p.category || ''];
      stores.forEach(st => {
        const cell = cellMap.get(`${st}___${p.code}`);
        const val = cell?.value ?? 0;
        rowData.push(val);
      });
      rows.push(rowData);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Product_Store_Matrix');

    const fileName = `Tamstore_Product_Store_Matrix_${metric}_${selectedDate}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const stores: string[] = filteredStores;

  return (
    <div className="space-y-6 pb-12 text-xs">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-cyan-100 dark:bg-cyan-950/40 border border-cyan-300 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300 shadow-xs">
              <Layers className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                Məhsul × Mağaza Matrisi (Product × Store Heatmap)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Bütün mağazalar və SKU-lar üzrə şəbəkə matris təhlili, reallaşma və stokout heatmap
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date Selector Dropdown */}
          <div className="flex items-center space-x-1.5 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span className="font-bold text-slate-700 dark:text-slate-300 text-xs">Tarix:</span>
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-900 dark:text-slate-100 font-bold text-xs focus:outline-hidden focus:border-blue-500 cursor-pointer"
            >
              <option value="ALL">Bütün Tarixlər (Yekun)</option>
              {availableDates.map((d) => (
                <option key={d} value={d}>
                  {formatDate(d)}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchMatrix}
            disabled={loading}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:text-blue-600 text-slate-700 dark:text-slate-200 font-bold rounded-xl transition-all shadow-xs active:scale-95 disabled:opacity-50"
            title="Yenilə"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            <span>Yenilə</span>
          </button>

          <button
            onClick={exportFullMatrixToExcel}
            disabled={loading || !filteredProducts.length}
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-xs active:scale-95 disabled:opacity-50"
            title="Bütün matrisi Excel formatında endir"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Excel İxrac</span>
          </button>
        </div>
      </div>

      {/* Metric Selector Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 px-2">Göstərici:</span>
        {[
          { id: 'achievement', label: 'Reallaşma % (Nailiyyət)', icon: TrendingUp },
          { id: 'sales', label: 'Satış (SALE)', icon: ShoppingBag },
          { id: 'forecast', label: 'Proqnoz (FC)', icon: Box },
          { id: 'stock', label: 'Stok Qalığı', icon: Box },
          { id: 'stockout', label: 'Stokout Halı', icon: AlertTriangle }
        ].map((m) => {
          const Icon = m.icon;
          const isActive = metric === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setMetric(m.id)}
              className={`inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-500/20'
                  : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{m.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Heatmap Container */}
      <div className="p-5 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 relative overflow-hidden luminous-border-blue">
        {/* Top delicate luminous blue line */}
        <div className="absolute top-0 inset-x-0 h-[2px] luminous-line-blue z-20" />
        {/* Filters and Controls Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          {/* Search Bar */}
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="SKU kodu, məhsul adı və ya kateqoriya ilə axtar..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-850 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xs font-bold"
              >
                &times;
              </button>
            )}
          </div>

          {/* Right Controls: Page Size */}
          <div className="flex flex-wrap items-center gap-3">

            {/* Page Size Selector */}
            <div className="flex items-center space-x-1.5">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Görünüş:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              >
                <option value={25}>25 SKU (Sürətli)</option>
                <option value={50}>50 SKU</option>
                <option value={100}>100 SKU</option>
                <option value={99999}>Bütün SKU-lar (Tam)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Legend Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] bg-slate-50/70 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-slate-500 dark:text-slate-400">Qeyd:</span>
            {metric === 'achievement' ? (
              <>
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-bold">
                  <span>&ge; 120% Əla</span>
                </span>
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-bold">
                  <span>100-119% Hədəf</span>
                </span>
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 font-bold">
                  <span>&lt; 70% Kritik Zəif</span>
                </span>
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-bold">
                  <span>Stokout Məhdudiyyətli</span>
                </span>
              </>
            ) : metric === 'stock' || metric === 'stockout' ? (
              <>
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-bold">
                  <span>Stok Var</span>
                </span>
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-bold">
                  <span>Stokout (0 Qalıq)</span>
                </span>
              </>
            ) : (
              <span className="text-slate-500 dark:text-slate-400">Məhsul və mağazalar üzrə miqdar paylanması</span>
            )}
          </div>

          <div className="font-bold text-slate-600 dark:text-slate-400">
            Cəmi: <span className="font-black text-slate-900 dark:text-slate-100">{stores.length}</span> Mağaza &times;{' '}
            <span className="font-black text-slate-900 dark:text-slate-100">{filteredProducts.length}</span> SKU
          </div>
        </div>

        {/* Matrix Table with sticky header & left product column */}
        <div className="overflow-x-auto max-h-[72vh] rounded-xl border border-slate-200 dark:border-slate-800 shadow-inner">
          <table className="w-full text-left border-collapse select-none">
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700 sticky top-0 z-30 font-bold">
              <tr>
                <th
                  onClick={() => setSortAsc(!sortAsc)}
                  className="p-3 sticky left-0 z-40 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/80 dark:hover:bg-slate-700 cursor-pointer border-r border-slate-300 dark:border-slate-700 min-w-[240px] max-w-[280px] shadow-sm select-none transition-colors"
                  title={`Məhsul adına görə ${sortAsc ? 'Z-A (Azalan)' : 'A-Z (Artan)'} sırala`}
                >
                  <div className="flex items-center justify-between">
                    <span>Məhsul Adı &amp; Kodu</span>
                    <span className="text-blue-600 dark:text-blue-400 ml-1">
                      {sortAsc ? (
                        <ArrowUp className="w-3.5 h-3.5" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5" />
                      )}
                    </span>
                  </div>
                </th>
                {stores.map((st) => (
                  <th key={st} className="p-2.5 text-center min-w-[76px] whitespace-nowrap border-r border-slate-200 dark:border-slate-700 last:border-r-0">
                    M {st}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={stores.length + 1} className="p-16 text-center text-slate-500 dark:text-slate-400">
                    <div className="inline-flex items-center space-x-3">
                      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="font-bold text-sm">Matris məlumatları hazırlanır...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan={stores.length + 1} className="p-16 text-center text-slate-400">
                    <div className="space-y-1">
                      <p className="font-bold text-sm">Axtarışa uyğun məhsul tapılmadı</p>
                      <p className="text-xs">Filtirləri təmizləyərək yenidən yoxlayın</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((p: any) => (
                  <tr key={p.code} className="hover:bg-blue-50/70 dark:hover:bg-slate-800/60 transition-colors group">
                    {/* Fixed Left Column: Product Info */}
                    <td
                      onClick={() => setSelectedProductDetail({ store: 'ALL', code: p.code })}
                      className="p-2.5 font-semibold text-slate-900 dark:text-slate-100 sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-blue-50/90 dark:group-hover:bg-slate-800 z-20 border-r border-slate-300 dark:border-slate-700 min-w-[240px] max-w-[280px] shadow-sm cursor-pointer"
                      title="Məhsul detallarına baxmaq üçün klikləyin"
                    >
                      <div className="truncate font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors" title={p.name}>
                        {p.name}
                      </div>
                      <div className="flex items-center space-x-2 mt-0.5">
                        <span className="text-[10px] text-blue-700 dark:text-blue-400 font-mono font-bold">{p.code}</span>
                        {p.category && (
                          <span className="text-[10px] text-slate-400 font-normal truncate max-w-[140px]">
                            {p.category}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Store Cells */}
                    {stores.map((st) => {
                      const cell = cellMap.get(`${st}___${p.code}`);
                      const val = cell?.value ?? 0;
                      const status = cell?.status ?? "NEUTRAL";
                      const displayVal = metric === 'achievement'
                        ? `${val}%`
                        : Number(val).toLocaleString();

                      return (
                        <td
                          key={st}
                          onClick={() => setSelectedProductDetail({ store: st, code: p.code })}
                          className="p-1 text-center border-r border-slate-100 dark:border-slate-800 last:border-r-0 cursor-pointer"
                          title={`Mağaza ${st} | ${p.name} (${p.code})\n${metric}: ${displayVal}`}
                        >
                          <div className={`py-1 px-1.5 rounded-md border text-[11px] font-mono font-bold transition-transform hover:scale-105 ${getCellColor(val, status)}`}>
                            {displayVal}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Cəmi <span className="font-bold text-slate-800 dark:text-slate-200">{filteredProducts.length}</span> məhsuldan{' '}
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredProducts.length)}
              </span>{' '}
              arası göstərilir
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Əvvəlki</span>
              </button>

              <div className="flex items-center space-x-1 text-xs font-bold text-slate-700 dark:text-slate-300">
                <span>Səhifə</span>
                <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded font-black">
                  {currentPage}
                </span>
                <span>/ {totalPages}</span>
              </div>

              <button
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer"
              >
                <span>Növbəti</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
