import React from 'react';
import { useData } from '../../context/DataContext';
import { RotateCcw, Layers, Archive } from 'lucide-react';

export const GlobalFilterBar: React.FC = () => {
  const { filters, setFilters, data, t, campaigns, activeCampaignId, selectCampaign } = useData();

  // Extract unique categories (from data.categories or derived from product_performances)
  const categoryOptions = React.useMemo(() => {
    if (data?.categories && data.categories.length > 0) {
      return data.categories;
    }
    const set = new Set<string>();
    data?.product_performances?.forEach((p) => {
      const cat = String(p.category || '').trim();
      if (cat && cat !== 'None' && cat !== 'nan') {
        set.add(cat);
      }
    });
    return Array.from(set).sort();
  }, [data?.categories, data?.product_performances]);

  // Extract unique areas (from data.areas or derived from store_performances)
  const areaOptions = React.useMemo(() => {
    if (data?.areas && data.areas.length > 0) {
      return data.areas;
    }
    const set = new Set<string>();
    data?.store_performances?.forEach((s) => {
      const ar = String(s.area || '').trim();
      if (ar && ar !== 'None' && ar !== 'nan') {
        set.add(ar);
      }
    });
    return Array.from(set).sort();
  }, [data?.areas, data?.store_performances]);

  // Extract unique sub areas (from data.sub_areas or derived from store_performances, filtered by selected area)
  const subAreaOptions = React.useMemo(() => {
    let stores = data?.store_performances || [];
    if (filters?.selectedArea && filters.selectedArea !== 'ALL') {
      stores = stores.filter((s) => s.area === filters.selectedArea);
    }
    const set = new Set<string>();
    stores.forEach((s) => {
      const sa = String(s.sub_area || '').trim();
      if (sa && sa !== 'None' && sa !== 'nan') {
        set.add(sa);
      }
    });
    if (set.size === 0 && (!filters?.selectedArea || filters.selectedArea === 'ALL') && data?.sub_areas && data.sub_areas.length > 0) {
      data.sub_areas.forEach((sa) => {
        const str = String(sa || '').trim();
        if (str) set.add(str);
      });
    }
    return Array.from(set).sort();
  }, [data?.sub_areas, data?.store_performances, filters?.selectedArea]);

  // Extract unique families (from data.families or derived from product_performances, filtered by selected category)
  const familyOptions = React.useMemo(() => {
    let prods = data?.product_performances || [];
    if (filters?.selectedCategory && filters.selectedCategory !== 'ALL') {
      prods = prods.filter((p) => p.category === filters.selectedCategory);
    }
    const set = new Set<string>();
    prods.forEach((p) => {
      const fam = String(p.family || '').trim();
      if (fam && fam !== 'None' && fam !== 'nan') {
        set.add(fam);
      }
    });
    if (set.size === 0 && (!filters?.selectedCategory || filters.selectedCategory === 'ALL') && data?.families && data.families.length > 0) {
      data.families.forEach((f) => {
        const str = String(f || '').trim();
        if (str) set.add(str);
      });
    }
    return Array.from(set).sort();
  }, [data?.families, data?.product_performances, filters?.selectedCategory]);

  // Stores filtered by selected area and sub_area
  const filteredStoreOptions = React.useMemo(() => {
    let stores = data?.store_performances || [];
    if (filters?.selectedArea && filters.selectedArea !== 'ALL') {
      stores = stores.filter((s) => s.area === filters.selectedArea);
    }
    if (filters?.selectedSubArea && filters.selectedSubArea !== 'ALL') {
      stores = stores.filter((s) => s.sub_area === filters.selectedSubArea);
    }
    return stores.map((s) => s.store);
  }, [data?.store_performances, filters?.selectedArea, filters?.selectedSubArea]);

  // Products filtered by selected category and family
  const filteredProductOptions = React.useMemo(() => {
    let prods = data?.product_performances || [];
    if (filters?.selectedCategory && filters.selectedCategory !== 'ALL') {
      prods = prods.filter((p) => p.category === filters.selectedCategory);
    }
    if (filters?.selectedFamily && filters.selectedFamily !== 'ALL') {
      prods = prods.filter((p) => p.family === filters.selectedFamily);
    }
    return prods.map((p) => ({ code: p.code, name: p.name }));
  }, [data?.product_performances, filters?.selectedCategory, filters?.selectedFamily]);

  const productPerformances = data?.product_performances || [];
  const tesirCount = React.useMemo(
    () =>
      productPerformances.filter((p) => {
        const pt = (p.promo_type || '').toLowerCase();
        return pt === 'tesir' || pt === 'teshir';
      }).length,
    [productPerformances]
  );
  const adiCount = React.useMemo(
    () =>
      productPerformances.filter((p) => {
        const pt = (p.promo_type || '').toLowerCase();
        return pt === 'adi' || (!pt && productPerformances.length > 0);
      }).length,
    [productPerformances]
  );
  const currentPromoType = filters?.promoType === 'TESHIR' ? 'TESIR' : (filters?.promoType || 'ALL');

  const handleReset = () => {
    setFilters({
      searchQuery: "",
      selectedStore: "",
      selectedProduct: "",
      selectedCategory: "ALL",
      selectedArea: "ALL",
      selectedFamily: "ALL",
      selectedSubArea: "ALL",
      achievementStatus: "ALL",
      stockStatus: "ALL",
      abcClass: "ALL",
      dateRange: "ALL",
      promoType: "ALL"
    });
  };

  const safeCampaigns = Array.isArray(campaigns) ? campaigns : [];
  const currentCampaign = safeCampaigns.find((c) => c.id === activeCampaignId || c.is_active);

  const formatDate = (dateStr: any) => {
    if (!dateStr) return '';
    const parts = String(dateStr).split('-');
    return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : String(dateStr);
  };

  const formatShortDate = (dateStr: any) => {
    if (!dateStr) return '';
    const parts = String(dateStr).split('-');
    return parts.length === 3 ? `${parts[2]}.${parts[1]}` : String(dateStr);
  };

  const hasActiveFilters = Boolean(
    (filters?.selectedStore && filters.selectedStore !== "") ||
    (filters?.selectedProduct && filters.selectedProduct !== "") ||
    (filters?.selectedCategory && filters.selectedCategory !== "ALL") ||
    (filters?.selectedArea && filters.selectedArea !== "ALL") ||
    (filters?.selectedFamily && filters.selectedFamily !== "ALL") ||
    (filters?.selectedSubArea && filters.selectedSubArea !== "ALL") ||
    (filters?.promoType && filters.promoType !== "ALL")
  );

  const isFamilyActive = Boolean(filters?.selectedFamily && filters.selectedFamily !== 'ALL');
  const isSubAreaActive = Boolean(filters?.selectedSubArea && filters.selectedSubArea !== 'ALL');
  const isAreaActive = Boolean(filters?.selectedArea && filters.selectedArea !== 'ALL');
  const isStoreActive = Boolean(filters?.selectedStore && filters.selectedStore !== '');
  const isCategoryActive = Boolean(filters?.selectedCategory && filters.selectedCategory !== 'ALL');
  const isProductActive = Boolean(filters?.selectedProduct && filters.selectedProduct !== '');
  const isPromoTypeActive = Boolean(currentPromoType && currentPromoType !== 'ALL');

  return (
    <div className="relative bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-2.5 text-xs shadow-2xs transition-colors duration-200 shrink-0 z-20">
      {/* Delicate bottom luminous neon accent line */}
      <div className="absolute bottom-0 inset-x-0 h-[1.5px] luminous-line-blue opacity-70 pointer-events-none" />
      {/* Subtle top micro-accent */}
      <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-blue-400/25 dark:via-blue-500/20 to-transparent pointer-events-none" />

      {/* Main Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* 1. Family Dropdown */}
          <div className="relative flex items-center">
            <select
              value={filters?.selectedFamily || 'ALL'}
              onChange={(e) => {
                const val = e.target.value;
                setFilters((prev) => ({ ...prev, selectedFamily: val, selectedProduct: "" }));
              }}
              className={`bg-slate-50 dark:bg-slate-800 hover:bg-slate-100/80 dark:hover:bg-slate-700/60 rounded-xl px-3 py-1.5 text-slate-700 dark:text-slate-200 font-medium focus:outline-none cursor-pointer transition-all max-w-[190px] truncate dark:[&>option]:bg-slate-900 dark:[&>option]:text-slate-100 ${
                isFamilyActive ? 'filter-pill-active font-semibold' : 'filter-pill-glow'
              }`}
              title="Məhsul Ailəsi (Family) üzrə süzün"
            >
              <option value="ALL">Bütün Family {familyOptions.length > 0 ? `(${familyOptions.length})` : ''}</option>
              {familyOptions.map((fam) => (
                <option key={fam} value={fam}>
                  {fam}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Sub Area Dropdown */}
          <div className="relative flex items-center">
            <select
              value={filters?.selectedSubArea || 'ALL'}
              onChange={(e) => {
                const val = e.target.value;
                setFilters((prev) => ({ ...prev, selectedSubArea: val, selectedStore: "" }));
              }}
              className={`bg-slate-50 dark:bg-slate-800 hover:bg-slate-100/80 dark:hover:bg-slate-700/60 rounded-xl px-3 py-1.5 text-slate-700 dark:text-slate-200 font-medium focus:outline-none cursor-pointer transition-all max-w-[180px] truncate dark:[&>option]:bg-slate-900 dark:[&>option]:text-slate-100 ${
                isSubAreaActive ? 'filter-pill-active font-semibold' : 'filter-pill-glow'
              }`}
              title="Sub Ərazi (Sub Area) üzrə süzün"
            >
              <option value="ALL">Bütün Sub Area {subAreaOptions.length > 0 ? `(${subAreaOptions.length})` : ''}</option>
              {subAreaOptions.map((sa) => (
                <option key={sa} value={sa}>
                  {sa}
                </option>
              ))}
            </select>
          </div>

          {/* Area (Bölgə/Ərazi) Dropdown */}
          <div className="relative flex items-center">
            <select
              value={filters?.selectedArea || 'ALL'}
              onChange={(e) => {
                const val = e.target.value;
                setFilters((prev) => ({ ...prev, selectedArea: val, selectedSubArea: "ALL", selectedStore: "" }));
              }}
              className={`bg-slate-50 dark:bg-slate-800 hover:bg-slate-100/80 dark:hover:bg-slate-700/60 rounded-xl px-3 py-1.5 text-slate-700 dark:text-slate-200 font-medium focus:outline-none cursor-pointer transition-all max-w-[180px] dark:[&>option]:bg-slate-900 dark:[&>option]:text-slate-100 ${
                isAreaActive ? 'filter-pill-active font-semibold' : 'filter-pill-glow'
              }`}
              title="Ərazi / Bölgə üzrə süzün"
            >
              <option value="ALL">Bütün Ərazilər {areaOptions.length > 0 ? `(${areaOptions.length})` : ''}</option>
              {areaOptions.map((ar) => (
                <option key={ar} value={ar}>
                  {ar}
                </option>
              ))}
            </select>
          </div>

          {/* Store Dropdown */}
          <select
            value={filters?.selectedStore || ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, selectedStore: e.target.value }))}
            className={`bg-slate-50 dark:bg-slate-800 hover:bg-slate-100/80 dark:hover:bg-slate-700/60 rounded-xl px-3 py-1.5 text-slate-700 dark:text-slate-200 font-medium focus:outline-none cursor-pointer transition-all dark:[&>option]:bg-slate-900 dark:[&>option]:text-slate-100 ${
              isStoreActive ? 'filter-pill-active font-semibold' : 'filter-pill-glow'
            }`}
          >
            <option value="">{t('lbl_all_stores')} {filteredStoreOptions.length > 0 ? `(${filteredStoreOptions.length})` : ''}</option>
            {filteredStoreOptions.map((st) => (
              <option key={st} value={st}>Mağaza {st}</option>
            ))}
          </select>

          {/* Category Dropdown */}
          <div className="relative flex items-center">
            <select
              value={filters?.selectedCategory || 'ALL'}
              onChange={(e) => {
                const val = e.target.value;
                setFilters((prev) => ({ ...prev, selectedCategory: val, selectedFamily: "ALL", selectedProduct: "" }));
              }}
              className={`bg-slate-50 dark:bg-slate-800 hover:bg-slate-100/80 dark:hover:bg-slate-700/60 rounded-xl px-3 py-1.5 text-slate-700 dark:text-slate-200 font-medium focus:outline-none cursor-pointer transition-all max-w-[190px] dark:[&>option]:bg-slate-900 dark:[&>option]:text-slate-100 ${
                isCategoryActive ? 'filter-pill-active font-semibold' : 'filter-pill-glow'
              }`}
              title="Kateqoriya üzrə süzün"
            >
              <option value="ALL">Bütün Kateqoriyalar {categoryOptions.length > 0 ? `(${categoryOptions.length})` : ''}</option>
              {categoryOptions.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Product Dropdown */}
          <select
            value={filters?.selectedProduct || ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, selectedProduct: e.target.value }))}
            className={`bg-slate-50 dark:bg-slate-800 hover:bg-slate-100/80 dark:hover:bg-slate-700/60 rounded-xl px-3 py-1.5 text-slate-700 dark:text-slate-200 font-medium focus:outline-none max-w-[200px] cursor-pointer transition-all dark:[&>option]:bg-slate-900 dark:[&>option]:text-slate-100 ${
              isProductActive ? 'filter-pill-active font-semibold' : 'filter-pill-glow'
            }`}
          >
            <option value="">{t('lbl_all_products')} {filteredProductOptions.length > 0 ? `(${filteredProductOptions.length})` : ''}</option>
            {filteredProductOptions.map((p) => (
              <option key={p.code} value={p.code}>{p.name} ({p.code})</option>
            ))}
          </select>

          {/* Promo Növü Dropdown (Təsir / Adi) */}
          <select
            value={currentPromoType}
            onChange={(e) => setFilters((prev) => ({ ...prev, promoType: e.target.value }))}
            className={`bg-slate-50 dark:bg-slate-800 hover:bg-slate-100/80 dark:hover:bg-slate-700/60 rounded-xl px-3 py-1.5 text-slate-700 dark:text-slate-200 font-medium focus:outline-none cursor-pointer transition-all dark:[&>option]:bg-slate-900 dark:[&>option]:text-slate-100 ${
              isPromoTypeActive ? 'filter-pill-active font-semibold' : 'filter-pill-glow'
            }`}
          >
            <option value="ALL">
              {t('lbl_all_types')} {productPerformances.length > 0 ? `(${productPerformances.length})` : ''}
            </option>
            <option value="TESIR">
              🎪 Təsir Promosu {tesirCount > 0 ? `(${tesirCount})` : ''}
            </option>
            <option value="ADI">
              🏷️ Adi Promo {adiCount > 0 ? `(${adiCount})` : ''}
            </option>
          </select>
        </div>

        {/* Reset Filter Button */}
        {hasActiveFilters && (
          <button
            onClick={handleReset}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 font-medium rounded-xl border border-rose-300/80 dark:border-rose-700/80 shadow-[0_0_10px_rgba(244,63,94,0.2)] hover:shadow-[0_0_16px_rgba(244,63,94,0.4)] transition-all shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t('btn_reset')}</span>
          </button>
        )}
      </div>
    </div>
  );
};
