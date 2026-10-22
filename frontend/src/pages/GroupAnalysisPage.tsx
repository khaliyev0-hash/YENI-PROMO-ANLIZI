import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useData } from '../context/DataContext';
import {
  Layers, MapPin, Tags, ArrowUpDown, Search, Download, ChevronRight, ChevronDown,
  TrendingUp, AlertTriangle, ShieldCheck, HelpCircle, BarChart3, X, RefreshCw,
  FolderTree, CornerDownRight, Check, ChevronsUpDown, FolderPlus, FolderMinus,
  LineChart as LineChartIcon, BarChart2, AreaChart as AreaChartIcon, SlidersHorizontal, Activity,
  Filter, Calendar
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend, ReferenceLine
} from 'recharts';
import * as XLSX from 'xlsx';
import { SortableHeader } from '../components/common/SortableHeader';
import { SpotlightCard } from '../components/common/SpotlightCard';
import { AnimatedCounter } from '../components/common/AnimatedCounter';

export interface TreeNode {
  key: string;
  name: string;
  path?: string[];
  parent_name?: string;
  parent_key?: string;
  sub_key?: string;
  group_key?: string;
  level: number;
  children_count: number;
  stores: number;
  skus: number;
  pairs: number;
  fc: number;
  sale: number;
  achievement_pct: number | null;
  stock: number;
  stockout_pairs: number;
  stockout_pct: number;
  osa_pct: number;
  distribution_qty: number;
  share_of_total_sale_pct: number;
  children?: TreeNode[];
}

export interface GroupTotals {
  stores: number;
  skus: number;
  pairs: number;
  fc: number;
  sale: number;
  achievement_pct: number | null;
  stock: number;
  stockout_pairs: number;
  stockout_pct: number;
  osa_pct: number;
  distribution_qty: number;
  share_of_total_sale_pct: number;
}

export interface GroupTimelineDay {
  date: string;
  display_date: string;
  day: number;
  ideal_pct: number;
  is_future: boolean;
  partial: boolean;
  groups: Record<string, {
    daily_sale: number | null;
    cumulative_sale: number | null;
    achievement_pct: number | null;
    fc: number;
    stock?: number | null;
  }>;
}

export interface GroupApiResponse {
  dimension: string;
  nodes?: TreeNode[];
  groups?: TreeNode[];
  totals: GroupTotals;
  unassigned: {
    pairs: number;
    share_pct: number;
  };
  filter_options: {
    categories: string[];
    areas: string[];
  };
  daily_timeline?: GroupTimelineDay[];
}

export interface DrillDownItem {
  code?: string;
  name?: string;
  store?: string;
  fc: number;
  sale: number;
  achievement: number | null;
  stock: number;
  stockout_store_count?: number;
  stockout_sku_count?: number;
  store_count?: number;
  sku_count?: number;
}

interface Props {
  dimension: 'category' | 'area';
}

export const GROUP_COLORS = [
  '#2563eb', // blue
  '#059669', // emerald
  '#7c3aed', // purple
  '#d97706', // amber
  '#db2777', // pink
  '#0891b2', // cyan
  '#ea580c', // orange
  '#4f46e5', // indigo
  '#0d9488', // teal
  '#65a30d', // lime
  '#e11d48', // rose
];

// Dynamic Custom Chart Tooltip for Day-by-Day (Gün-gün) timeline
const CustomDailyTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const dataItem = payload[0]?.payload;
  const isPartial = dataItem?.partial;
  const isFuture = dataItem?.is_future;

  return (
    <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xl text-xs space-y-2 min-w-[220px]">
      <div className="font-bold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-1.5 flex items-center justify-between">
        <span>Tarix: {dataItem?.date || label} {dataItem?.day ? `(Gün ${dataItem.day})` : ''}</span>
        {isPartial && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-700 border border-amber-300">
            Gün tamamlanmayıb
          </span>
        )}
        {isFuture && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
            Gələcək gün
          </span>
        )}
      </div>
      <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
        {payload.map((entry: any, index: number) => {
          if (entry.value === null || entry.value === undefined) return null;
          const isPct = String(entry.dataKey).includes('pct') || String(entry.name).includes('%');
          return (
            <div key={`item-${index}`} className="flex items-center justify-between space-x-3">
              <div className="flex items-center space-x-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-slate-600 dark:text-slate-300 font-medium truncate max-w-[140px]">{entry.name}:</span>
              </div>
              <span className="font-bold text-slate-900 dark:text-white font-mono">
                {isPct ? `${entry.value}%` : `${Number(entry.value || 0).toLocaleString()} unit`}
              </span>
            </div>
          );
        })}
      </div>
      {dataItem?.ideal_pct != null && (
        <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 dark:text-slate-500 flex items-center justify-between">
          <span>İdeal Plan (Pro-rata):</span>
          <span className="font-bold text-slate-600 dark:text-slate-300 font-mono">{dataItem.ideal_pct}%</span>
        </div>
      )}
    </div>
  );
};

export const GroupAnalysisPage: React.FC<Props> = ({ dimension }) => {
  const { data, activeCampaignId, setSelectedProductDetail, setSelectedStoreDetail, filters, t } = useData();
  const [apiData, setApiData] = useState<GroupApiResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<keyof TreeNode>('sale');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Hierarchy expand state
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const previousExpandedKeysRef = useRef<Set<string> | null>(null);

  // Drill-down panel state (supports full path for N-level drilldown)
  const [selectedNode, setSelectedNode] = useState<{ name: string; path?: string[]; parentName?: string; isSub?: boolean } | null>(null);
  const [detailItems, setDetailItems] = useState<DrillDownItem[]>([]);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [detailSearch, setDetailSearch] = useState<string>('');
  const [detailSortField, setDetailSortField] = useState<string>('sale');
  const [detailSortAsc, setDetailSortAsc] = useState<boolean>(false);

  const [chartParentKey, setChartParentKey] = useState<string>('ALL');
  const [chartType, setChartType] = useState<'line' | 'bar' | 'area'>('line');
  const [chartMetric, setChartMetric] = useState<'fc_sale' | 'achievement' | 'stock_sale' | 'osa_stockout'>('fc_sale');

  const isCategory = dimension === 'category';
  const title = isCategory ? 'Category Analiz' : 'Area Analiz';
  const subtitle = isCategory
    ? 'Kateqoriya, Sub-kateqoriya və Family üzrə proqnoz, satış, qalıq stok və mövcudluq təhlili'
    : 'Bölgələr və Sub-ərazilər üzrə mağaza performansı, reallaşma və stokout təhlili';

  const getHostName = () => (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname : 'localhost';
  const API_BASE = import.meta.env.VITE_API_BASE_URL || `http://${getHostName()}:8000/api`;

  const fetchGroupData = async () => {
    setLoading(true);
    try {
      let url = `${API_BASE}/group-analysis?dimension=${dimension}`;
      if (filters.selectedArea && filters.selectedArea !== 'ALL') {
        url += `&area=${encodeURIComponent(filters.selectedArea)}`;
      }
      if (filters.selectedSubArea && filters.selectedSubArea !== 'ALL') {
        url += `&sub_area=${encodeURIComponent(filters.selectedSubArea)}`;
      }
      if (filters.selectedStore) {
        url += `&store=${encodeURIComponent(filters.selectedStore)}`;
      }
      if (filters.selectedCategory && filters.selectedCategory !== 'ALL') {
        url += `&category=${encodeURIComponent(filters.selectedCategory)}`;
      }
      if (filters.selectedFamily && filters.selectedFamily !== 'ALL') {
        url += `&family=${encodeURIComponent(filters.selectedFamily)}`;
      }
      if (filters.selectedProduct) {
        url += `&product=${encodeURIComponent(filters.selectedProduct)}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const json: GroupApiResponse = await res.json();
        setApiData(json);
      }
    } catch (err) {
      console.error("Failed to load group analysis data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroupData();
  }, [
    dimension,
    activeCampaignId,
    filters.selectedArea,
    filters.selectedSubArea,
    filters.selectedStore,
    filters.selectedCategory,
    filters.selectedFamily,
    filters.selectedProduct
  ]);

  // Fetch drill-down details when a node is selected (supports path of 1 to 3 segments)
  useEffect(() => {
    if (!selectedNode) {
      setDetailItems([]);
      return;
    }
    const fetchDetail = async () => {
      setDetailLoading(true);
      try {
        let url = `${API_BASE}/group-analysis/detail?dimension=${dimension}`;
        if (selectedNode.path && selectedNode.path.length > 0) {
          selectedNode.path.forEach(seg => {
            url += `&path=${encodeURIComponent(seg)}`;
          });
        } else if (selectedNode.isSub && selectedNode.parentName) {
          url += `&parent=${encodeURIComponent(selectedNode.parentName)}&sub=${encodeURIComponent(selectedNode.name)}`;
        } else {
          url += `&name=${encodeURIComponent(selectedNode.name)}`;
        }
        if (filters.selectedArea && filters.selectedArea !== 'ALL') url += `&area=${encodeURIComponent(filters.selectedArea)}`;
        if (filters.selectedSubArea && filters.selectedSubArea !== 'ALL') url += `&sub_area=${encodeURIComponent(filters.selectedSubArea)}`;
        if (filters.selectedStore) url += `&store=${encodeURIComponent(filters.selectedStore)}`;
        if (filters.selectedCategory && filters.selectedCategory !== 'ALL') url += `&category=${encodeURIComponent(filters.selectedCategory)}`;
        if (filters.selectedFamily && filters.selectedFamily !== 'ALL') url += `&family=${encodeURIComponent(filters.selectedFamily)}`;
        if (filters.selectedProduct) url += `&product=${encodeURIComponent(filters.selectedProduct)}`;
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          setDetailItems(json.items || []);
        }
      } catch (err) {
        console.error("Failed to load group detail", err);
      } finally {
        setDetailLoading(false);
      }
    };
    fetchDetail();
  }, [
    selectedNode,
    dimension,
    filters.selectedArea,
    filters.selectedSubArea,
    filters.selectedStore,
    filters.selectedCategory,
    filters.selectedFamily,
    filters.selectedProduct
  ]);

  const rawNodes = apiData?.nodes || apiData?.groups || [];
  const totals = apiData?.totals;
  const unassigned = apiData?.unassigned || { pairs: 0, share_pct: 0 };
  const filterOptions = isCategory
    ? (apiData?.filter_options?.areas || [])
    : (apiData?.filter_options?.categories || []);

  // Check if sub hierarchy is present in dataset
  const hasSubHierarchy = useMemo(() => {
    return rawNodes.some(n => (n.children_count || 0) > 0 || (n.children && n.children.length > 0));
  }, [rawNodes]);

  // Max depth of current tree (0: parent only, 1: sub, 2: family)
  const maxTreeDepth = useMemo(() => {
    let maxD = 0;
    const walk = (nodes: TreeNode[]) => {
      nodes.forEach(n => {
        if (n.level > maxD) maxD = n.level;
        if (n.children && n.children.length > 0) walk(n.children);
      });
    };
    walk(rawNodes);
    return maxD;
  }, [rawNodes]);

  // Auto-expand on search across all recursive ancestor levels, restore previous state on clear
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      if (previousExpandedKeysRef.current === null) {
        previousExpandedKeysRef.current = new Set(expandedKeys);
      }
      const matchingKeysToExpand = new Set<string>();

      const checkNode = (node: TreeNode): boolean => {
        const selfMatches = node.name.toLowerCase().includes(q);
        let childMatched = false;
        if (node.children && node.children.length > 0) {
          for (const c of node.children) {
            if (checkNode(c)) {
              childMatched = true;
            }
          }
        }
        if (childMatched) {
          matchingKeysToExpand.add(node.key);
        }
        return selfMatches || childMatched;
      };

      rawNodes.forEach(root => checkNode(root));

      setExpandedKeys(prev => {
        const merged = new Set(prev);
        matchingKeysToExpand.forEach(k => merged.add(k));
        return merged;
      });
    } else {
      if (previousExpandedKeysRef.current !== null) {
        setExpandedKeys(previousExpandedKeysRef.current);
        previousExpandedKeysRef.current = null;
      }
    }
  }, [searchQuery, rawNodes]);

  // Toggle single node
  const toggleExpand = (key: string) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Expand all / Collapse all across any depth
  const handleExpandAll = () => {
    const allKeys = new Set<string>();
    const walk = (nodes: TreeNode[]) => {
      nodes.forEach(n => {
        if (n.children && n.children.length > 0) {
          allKeys.add(n.key);
          walk(n.children);
        }
      });
    };
    walk(rawNodes);
    setExpandedKeys(allKeys);
  };

  const handleCollapseAll = () => {
    setExpandedKeys(new Set());
  };

  // Expand to specific level (1-ci səviyyə: level 0 only; 2-ci: level 0+1; 3-cü: level 0+1+2)
  const handleExpandToLevel = (targetLevel: number) => {
    const keys = new Set<string>();
    const walk = (nodes: TreeNode[]) => {
      nodes.forEach(n => {
        if (n.level < targetLevel && n.children && n.children.length > 0) {
          keys.add(n.key);
          walk(n.children);
        }
      });
    };
    walk(rawNodes);
    setExpandedKeys(keys);
  };

  // Sorting comparator within each level
  const sortNodes = (items: TreeNode[], field: keyof TreeNode, asc: boolean): TreeNode[] => {
    return [...items].sort((a, b) => {
      let valA: any = a[field];
      let valB: any = b[field];
      if (valA === null || valA === undefined) valA = asc ? Infinity : -Infinity;
      if (valB === null || valB === undefined) valB = asc ? Infinity : -Infinity;
      if (typeof valA === 'string' && typeof valB === 'string') {
        return asc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return asc ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
    });
  };

  // Filter & hierarchical sorting across arbitrary N levels
  const processedNodes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const processRecursive = (node: TreeNode): TreeNode | null => {
      const selfMatches = !q || node.name.toLowerCase().includes(q);
      let processedChildren: TreeNode[] = [];
      if (node.children && node.children.length > 0) {
        for (const child of node.children) {
          const res = processRecursive(child);
          if (res) processedChildren.push(res);
        }
      }

      if (q && !selfMatches && processedChildren.length === 0) {
        return null;
      }

      if (q && selfMatches && processedChildren.length === 0 && node.children && node.children.length > 0) {
        processedChildren = node.children.map(c => processRecursive(c) || c);
      }

      const sortedChildren = sortNodes(processedChildren, sortField, sortAsc);
      return {
        ...node,
        children: sortedChildren,
      };
    };

    const result: TreeNode[] = [];
    rawNodes.forEach(root => {
      const processed = processRecursive(root);
      if (processed) result.push(processed);
    });

    return sortNodes(result, sortField, sortAsc);
  }, [rawNodes, searchQuery, sortField, sortAsc]);

  // KPI card metrics: Category (parents), Sub-category (level 1), Family (level 2)
  const kpiStats = useMemo(() => {
    const parentsCount = rawNodes.length;
    let subsCount = 0;
    let familiesCount = 0;

    rawNodes.forEach(p => {
      if (p.children && p.children.length > 0) {
        subsCount += p.children.length;
        p.children.forEach(c => {
          if (c.children && c.children.length > 0) {
            familiesCount += c.children.length;
          }
        });
      }
    });

    // Top parent by sale
    const topParent = [...rawNodes].sort((a, b) => b.sale - a.sale)[0];

    // Lowest achievement parent (with fc > 0)
    const validAch = rawNodes.filter(n => n.fc > 0 && n.achievement_pct !== null);
    const lowestAch = [...validAch].sort((a, b) => (a.achievement_pct ?? 0) - (b.achievement_pct ?? 0))[0];

    // Highest stockout % parent
    const highestStout = [...rawNodes].sort((a, b) => b.stockout_pct - a.stockout_pct)[0];

    return {
      parentsCount,
      subsCount,
      familiesCount,
      topParentName: topParent ? topParent.name : '-',
      topParentSale: topParent ? topParent.sale : 0,
      lowestAchName: lowestAch ? lowestAch.name : '-',
      lowestAchPct: lowestAch ? lowestAch.achievement_pct : null,
      highestStoutName: highestStout ? highestStout.name : '-',
      highestStoutPct: highestStout ? highestStout.stockout_pct : 0,
      unassignedShare: unassigned.share_pct,
      unassignedPairs: unassigned.pairs
    };
  }, [rawNodes, unassigned]);

  const dailyTimeline = apiData?.daily_timeline || [];
  const hasDailyTimeline = dailyTimeline.length > 0;

  // Chart data: Day-by-Day (Gün-gün bazında) timeline series
  const chartData = useMemo(() => {
    if (!hasDailyTimeline) {
      // Fallback if older archive without daily timeline
      let sourceNodes: TreeNode[] = [];
      if (chartParentKey !== 'ALL') {
        const parent = rawNodes.find(p => p.key === chartParentKey);
        if (parent && parent.children && parent.children.length > 0) {
          sourceNodes = parent.children;
        }
      } else {
        sourceNodes = rawNodes;
      }

      return sourceNodes.slice(0, 15).map(g => ({
        name: g.name,
        FC: g.fc,
        SALE: g.sale,
        ach: g.achievement_pct !== null && g.achievement_pct !== undefined ? Number(g.achievement_pct.toFixed(1)) : 0,
        stock: g.stock,
        stockout_pct: Number((g.stockout_pct || 0).toFixed(1)),
        osa_pct: Number((g.osa_pct || 0).toFixed(1)),
      }));
    }

    const totalDays = dailyTimeline.length;
    const isSingleGroup = rawNodes.length === 1;

    return dailyTimeline.map((d) => {
      const row: any = {
        name: d.display_date || d.date,
        date: d.date,
        day: d.day,
        ideal_pct: d.ideal_pct,
        partial: d.partial,
        is_future: d.is_future,
      };

      if (!isSingleGroup) {
        // Multi-line comparison of all root groups
        rawNodes.forEach((g) => {
          const gData = d.groups?.[g.name];
          if (d.is_future || !gData) {
            row[g.name] = null;
          } else {
            if (chartMetric === 'achievement') {
              row[g.name] = gData.achievement_pct;
            } else if (chartMetric === 'stock_sale') {
              row[g.name] = gData.cumulative_sale ?? gData.daily_sale;
            } else {
              row[g.name] = gData.daily_sale;
            }
          }
        });
      } else {
        // Single group selected via global filter
        const targetNode = rawNodes[0];
        const targetKey = targetNode ? targetNode.name : '';
        const gData = d.groups?.[targetKey];
        const gFc = gData?.fc || (targetNode ? targetNode.fc : totals?.fc) || 0;
        const dailyFcPlan = totalDays > 0 ? Number((gFc / totalDays).toFixed(1)) : 0;

        if (d.is_future || !gData) {
          row['Real Satış (SALE)'] = null;
          row['Reallaşma %'] = null;
          row['Kumulyativ Satış'] = null;
          row['Qalıq Stok'] = null;
        } else {
          row['Real Satış (SALE)'] = gData.daily_sale;
          row['Reallaşma %'] = gData.achievement_pct;
          row['Kumulyativ Satış'] = gData.cumulative_sale;
          row['Qalıq Stok'] = gData.stock ?? null;
        }
        row['Hədəf Plan (Günlük)'] = dailyFcPlan;
        row['İdeal Plan (pro-rata)'] = d.ideal_pct;
      }

      return row;
    });
  }, [dailyTimeline, hasDailyTimeline, chartMetric, chartParentKey, rawNodes, totals]);

  // Text highlighting helper
  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <>
        {parts.map((part, idx) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={idx} className="bg-amber-200 text-amber-950 rounded px-0.5 font-bold">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  };

  // Excel Export: Flattened tree with columns Level, Kateqoriya / Sub / Family, plus all metrics
  const exportTreeToExcel = () => {
    const rows: any[] = [];

    const walk = (node: TreeNode, currentPath: string[]) => {
      const pathNames = [...currentPath, node.name];
      const levelLabel = node.level === 0
        ? (isCategory ? 'Kateqoriya' : 'Bölgə')
        : node.level === 1
        ? (isCategory ? 'Sub Kateqoriya' : 'Sub Ərazi')
        : 'Məhsul Ailəsi (Family)';

      const rowObj: any = {
        'Səviyyə': levelLabel,
      };

      if (isCategory) {
        rowObj['Kateqoriya'] = pathNames[0] || '-';
        rowObj['Sub Kateqoriya'] = pathNames[1] || '-';
        rowObj['Family'] = pathNames[2] || '-';
      } else {
        rowObj['Area'] = pathNames[0] || '-';
        rowObj['Sub Area'] = pathNames[1] || '-';
      }

      rowObj['Mağaza Sayı'] = node.stores;
      rowObj['SKU Sayı'] = node.skus;
      rowObj['Cütlük Sayı'] = node.pairs;
      rowObj['Proqnoz (FC)'] = node.fc;
      rowObj['Real Satış (SALE)'] = node.sale;
      rowObj['Reallaşma %'] = node.achievement_pct !== null ? `${node.achievement_pct}%` : '-';
      rowObj['Qalıq Stok'] = node.stock;
      rowObj['Stokout Cütlük'] = node.stockout_pairs;
      rowObj['Mövcudluq (OSA) %'] = `${node.osa_pct}%`;
      rowObj['Dağılım Miqdarı'] = node.distribution_qty;

      rows.push(rowObj);

      if (node.children && node.children.length > 0) {
        node.children.forEach(child => walk(child, pathNames));
      }
    };

    rawNodes.forEach(root => walk(root, []));

    if (totals) {
      const totalRow: any = {
        'Səviyyə': 'CƏMİ',
      };
      if (isCategory) {
        totalRow['Kateqoriya'] = 'ÜMUMİ CƏMİ';
        totalRow['Sub Kateqoriya'] = '-';
        totalRow['Family'] = '-';
      } else {
        totalRow['Area'] = 'ÜMUMİ CƏMİ';
        totalRow['Sub Area'] = '-';
      }
      totalRow['Mağaza Sayı'] = totals.stores;
      totalRow['SKU Sayı'] = totals.skus;
      totalRow['Cütlük Sayı'] = totals.pairs;
      totalRow['Proqnoz (FC)'] = totals.fc;
      totalRow['Real Satış (SALE)'] = totals.sale;
      totalRow['Reallaşma %'] = totals.achievement_pct !== null ? `${totals.achievement_pct}%` : '-';
      totalRow['Qalıq Stok'] = totals.stock;
      totalRow['Stokout Cütlük'] = totals.stockout_pairs;
      totalRow['Mövcudluq (OSA) %'] = `${totals.osa_pct}%`;
      totalRow['Dağılım Miqdarı'] = totals.distribution_qty;

      rows.push(totalRow);
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, title);
    XLSX.writeFile(wb, `${title}_Hierarchy_Export.xlsx`);
  };

  // Filter drilldown items
  const filteredDetailItems = useMemo(() => {
    if (!detailSearch.trim()) return detailItems;
    const q = detailSearch.toLowerCase();
    return detailItems.filter(item => {
      const matchCode = item.code && item.code.toLowerCase().includes(q);
      const matchName = item.name && item.name.toLowerCase().includes(q);
      const matchStore = item.store && item.store.toLowerCase().includes(q);
      return matchCode || matchName || matchStore;
    });
  }, [detailItems, detailSearch]);

  const handleDetailSort = (field: string) => {
    if (detailSortField === field) {
      setDetailSortAsc(!detailSortAsc);
    } else {
      setDetailSortField(field);
      // For string fields default ascending (A-Z), for metric/numerical default descending (largest to smallest)
      const isStringField = field === 'code' || field === 'name' || field === 'store';
      setDetailSortAsc(isStringField);
    }
  };

  const sortedDetailItems = useMemo(() => {
    return [...filteredDetailItems].sort((a: any, b: any) => {
      let valA = a[detailSortField];
      let valB = b[detailSortField];

      if (detailSortField === 'stockout') {
        valA = isCategory ? (a.stockout_store_count ?? 0) : (a.stockout_sku_count ?? 0);
        valB = isCategory ? (b.stockout_store_count ?? 0) : (b.stockout_sku_count ?? 0);
      }

      if (valA === null || valA === undefined) valA = detailSortAsc ? Infinity : -Infinity;
      if (valB === null || valB === undefined) valB = detailSortAsc ? Infinity : -Infinity;

      if (typeof valA === 'string' && typeof valB === 'string') {
        return detailSortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      const numA = Number(valA);
      const numB = Number(valB);
      if (!isNaN(numA) && !isNaN(numB)) {
        return detailSortAsc ? numA - numB : numB - numA;
      }

      if (valA < valB) return detailSortAsc ? -1 : 1;
      if (valA > valB) return detailSortAsc ? 1 : -1;
      return 0;
    });
  }, [filteredDetailItems, detailSortField, detailSortAsc, isCategory]);

  const handleSort = (field: keyof TreeNode) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field === 'name');
    }
  };

  // Recursive tree row renderer for arbitrary depth (Level 0: Category/Area -> Level 1: Sub -> Level 2: Family)
  const renderTreeRow = (node: TreeNode): React.ReactNode => {
    const isExpanded = expandedKeys.has(node.key);
    const hasChildren = (node.children && node.children.length > 0) || (node.children_count || 0) > 0;
    const ach = node.achievement_pct;
    const achColor = ach === null ? 'text-slate-400' : ach >= 100 ? 'text-emerald-600 font-bold' : ach >= 70 ? 'text-amber-600 font-bold' : 'text-rose-600 font-bold';

    const rowBg = node.level === 0
      ? 'bg-slate-50/70 hover:bg-blue-50/50 dark:bg-slate-800/60 dark:hover:bg-slate-700/60'
      : node.level === 1
      ? 'bg-white hover:bg-blue-50/60 dark:bg-slate-900 dark:hover:bg-slate-800/70'
      : 'bg-slate-50/30 hover:bg-blue-50/70 text-slate-700 dark:bg-slate-900/40 dark:hover:bg-slate-800/50 dark:text-slate-300';

    const leftBorder = node.level === 0
      ? 'border-l-4 border-l-blue-500 font-bold'
      : node.level === 1
      ? 'border-l-2 border-l-indigo-400 font-semibold'
      : 'border-l border-l-slate-300 dark:border-l-slate-600 font-normal';

    const padLeft = 14 + node.level * 22;

    return (
      <React.Fragment key={node.key}>
        <tr
          onDoubleClick={() => {
            setSelectedNode({ name: node.name, path: node.path });
          }}
          className={`${rowBg} transition-colors group cursor-default`}
        >
          {/* Sticky First Column with Dynamic Indentation */}
          <td
            style={{ paddingLeft: `${padLeft}px` }}
            className={`p-2.5 sticky left-0 z-10 ${leftBorder} border-r border-slate-200/50 dark:border-slate-800 transition-colors ${
              node.level === 0 ? 'bg-slate-50 group-hover:bg-blue-50/80 dark:bg-slate-800 dark:group-hover:bg-slate-700' : node.level === 1 ? 'bg-white group-hover:bg-blue-50/80 dark:bg-slate-900 dark:group-hover:bg-slate-800' : 'bg-slate-50/40 group-hover:bg-blue-50/80 dark:bg-slate-900 dark:group-hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center space-x-1.5">
              {/* Connector for child nodes */}
              {node.level > 0 && (
                <span className="text-slate-300 dark:text-slate-600 font-mono text-xs select-none">↳</span>
              )}

              {/* Expand / Collapse Toggle Button */}
              {hasChildren ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpand(node.key);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleExpand(node.key);
                    }
                  }}
                  aria-expanded={isExpanded}
                  className="w-5 h-5 rounded-md flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-400 dark:hover:border-blue-500 transition-all shadow-2xs"
                  title={isExpanded ? 'Bağla' : 'Alt səviyyəni göstər'}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-blue-600" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                </button>
              ) : (
                <div className="w-5 h-5 flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                </div>
              )}

              {/* Node Name */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (hasChildren) {
                    toggleExpand(node.key);
                  } else {
                    setSelectedNode({ name: node.name, path: node.path });
                  }
                }}
                className={`text-left transition-colors flex items-center space-x-1.5 truncate max-w-[240px] ${
                  node.level === 0 ? 'font-bold text-slate-800 hover:text-blue-600' : node.level === 1 ? 'font-semibold text-slate-800 hover:text-blue-600' : 'text-slate-700 hover:text-blue-600'
                }`}
                title={node.path?.join(' → ') || node.name}
              >
                <span>{highlightMatch(node.name, searchQuery)}</span>
                {hasChildren && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-slate-200/80 text-slate-600">
                    {node.children?.length ?? node.children_count}
                  </span>
                )}
              </button>

              {/* Direct Drill-down Icon */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedNode({ name: node.name, path: node.path });
                }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-blue-100 text-blue-600 rounded transition-opacity"
                title="Detallı analiz aç"
              >
                <Search className="w-3 h-3" />
              </button>
            </div>
          </td>

          <td className="p-2.5 text-right font-medium text-slate-700 dark:text-slate-200">{node.stores.toLocaleString()}</td>
          <td className="p-2.5 text-right font-medium text-slate-700 dark:text-slate-200">{node.skus.toLocaleString()}</td>
          <td className="p-2.5 text-right font-semibold text-slate-800 dark:text-slate-100">{node.fc.toLocaleString()}</td>
          <td className="p-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">{node.sale.toLocaleString()}</td>
          <td className={`p-2.5 text-right ${achColor}`}>
            {ach !== null ? `${ach}%` : '-'}
          </td>
          <td className="p-2.5 text-right font-medium text-slate-700 dark:text-slate-200">{node.stock.toLocaleString()}</td>
          <td className="p-2.5 text-right text-emerald-700 dark:text-emerald-400 font-semibold">{node.osa_pct}%</td>
          <td className="p-2.5 text-right font-medium text-slate-700 dark:text-slate-200 pr-4">{node.distribution_qty.toLocaleString()}</td>
        </tr>

        {/* Recursive Children Rows if expanded */}
        {isExpanded && node.children && node.children.map(child => renderTreeRow(child))}
      </React.Fragment>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs">
        <div className="flex items-center space-x-3.5">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-md ${
            isCategory ? 'bg-gradient-to-tr from-pink-600 to-rose-500 shadow-pink-500/25' : 'bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-emerald-500/25'
          }`}>
            {isCategory ? <Tags className="w-6 h-6 stroke-[2.2]" /> : <MapPin className="w-6 h-6 stroke-[2.2]" />}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">{title}</h1>
              {hasSubHierarchy && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  Tree Matris (Category → Sub)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
          </div>
        </div>

        {/* Global Action Bar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Refresh Button */}
          <button
            onClick={fetchGroupData}
            disabled={loading}
            className="p-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 transition-all hover:shadow-xs active:scale-95"
            title="Məlumatları Yenilə"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          {/* Export to Excel */}
          <button
            onClick={exportTreeToExcel}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-sm transition-all hover:shadow-emerald-500/20 active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Excel İxrac</span>
          </button>
        </div>
      </div>

      {/* KPI Cards (7 cards on Category, 6 on Area) */}
      <div className={`grid ${isCategory ? 'grid-cols-2 md:grid-cols-4 lg:grid-cols-7' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6'} gap-3.5`}>
        {/* 1. Parent Count */}
        <SpotlightCard spotlightColor="blue" glowBorder="blue" className="p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[11px] font-semibold">{t('tree_parent_count')}</span>
            <div className="p-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-500">
              <FolderTree className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-xl font-black text-slate-800 dark:text-slate-100">
              <AnimatedCounter value={kpiStats.parentsCount} />
            </p>
            <span className="text-[10px] text-slate-400 font-medium">{isCategory ? 'Kateqoriyalar' : 'Bölgələr'}</span>
          </div>
        </SpotlightCard>

        {/* 2. Sub Count */}
        <SpotlightCard spotlightColor="cyan" glowBorder="cyan" className="p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[11px] font-semibold">{t('tree_sub_count')}</span>
            <div className="p-1 rounded-lg bg-cyan-50 dark:bg-cyan-950/60 text-cyan-500">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-xl font-black text-slate-800 dark:text-slate-100">
              <AnimatedCounter value={kpiStats.subsCount} />
            </p>
            <span className="text-[10px] text-slate-400 font-medium">{isCategory ? 'Sub-kateqoriyalar' : 'Sub-ərazilər'}</span>
          </div>
        </SpotlightCard>

        {/* 3. Family Count (Category only) */}
        {isCategory && (
          <SpotlightCard spotlightColor="purple" glowBorder="cyan" className="p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
              <span className="text-[11px] font-semibold">{t('tree_family_count')}</span>
              <div className="p-1 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-pink-500">
                <Tags className="w-4 h-4" />
              </div>
            </div>
            <div>
              <p className="text-xl font-black text-slate-800 dark:text-slate-100">
                <AnimatedCounter value={kpiStats.familiesCount} />
              </p>
              <span className="text-[10px] text-slate-400 font-medium">Məhsul Ailəsi</span>
            </div>
          </SpotlightCard>
        )}

        {/* 4. Top Parent by Sale */}
        <SpotlightCard spotlightColor="emerald" glowBorder="emerald" className="p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[11px] font-semibold">{t('tree_top_parent')}</span>
            <div className="p-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-500">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-sm font-black text-slate-800 dark:text-slate-100 truncate" title={kpiStats.topParentName}>
              {kpiStats.topParentName}
            </p>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
              <AnimatedCounter value={kpiStats.topParentSale} suffix=" unit" />
            </span>
          </div>
        </SpotlightCard>

        {/* 5. Lowest Achievement */}
        <SpotlightCard spotlightColor="amber" glowBorder="amber" className="p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[11px] font-semibold">{t('tree_lowest_achievement')}</span>
            <div className="p-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-500">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-sm font-black text-slate-800 dark:text-slate-100 truncate" title={kpiStats.lowestAchName}>
              {kpiStats.lowestAchName}
            </p>
            <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">
              {kpiStats.lowestAchPct !== null ? <AnimatedCounter value={kpiStats.lowestAchPct} suffix="%" /> : '-'}
            </span>
          </div>
        </SpotlightCard>

        {/* 6. Highest Stockout % */}
        <SpotlightCard spotlightColor="rose" glowBorder="rose" className="p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[11px] font-semibold">{t('tree_highest_stockout')}</span>
            <div className="p-1 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-500">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-sm font-black text-slate-800 dark:text-slate-100 truncate" title={kpiStats.highestStoutName}>
              {kpiStats.highestStoutName}
            </p>
            <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">
              <AnimatedCounter value={kpiStats.highestStoutPct} suffix="% stokout" />
            </span>
          </div>
        </SpotlightCard>

        {/* 7. Unassigned Share */}
        <SpotlightCard spotlightColor="cyan" className="p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[11px] font-semibold">{t('tree_unassigned_share')}</span>
            <div className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400">
              <HelpCircle className="w-4 h-4" />
            </div>
          </div>
          <div>
            <p className="text-xl font-black text-slate-700 dark:text-slate-200">
              <AnimatedCounter value={kpiStats.unassignedShare} suffix="%" />
            </p>
            <span className="text-[10px] text-slate-400 font-medium">
              <AnimatedCounter value={kpiStats.unassignedPairs} suffix=" cütlük" />
            </span>
          </div>
        </SpotlightCard>
      </div>

      {/* Informative Guidance Banner if 100% or high Unassigned */}
      {unassigned.share_pct >= 90 && (
        <div className="p-4 bg-amber-50/90 border border-amber-200 rounded-2xl flex items-start space-x-3 text-amber-900 shadow-2xs">
          <HelpCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-bold">Məlumatların böyük hissəsi &quot;Təyin edilməyib&quot; statusundadır</p>
            <p className="text-amber-800">
              Yüklənən Excel şablonunda (Şablon 1) <b>{isCategory ? 'Category / Sub Category' : 'Area / Sub Area'}</b> sütunları aşkar olunmadıqda və ya boş olduqda bütün sətirlər avtomatik &quot;Təyin edilməyib&quot; qrupuna aid edilir.
            </p>
            <p className="text-[11px] text-amber-700">
              Tanınan sütun başlıqları: {isCategory ? 'category, kateqoriya, kategoriya, sub_category, sub kateqoriya' : 'area, bolge, region, erazi, sub_area, sub bolge'}.
            </p>
          </div>
        </div>
      )}

      {/* Day-by-Day (Gün-gün bazında) Dynamic Chart with Group/Name Filter and Metric Switcher */}
      {chartData.length > 0 && (
        <div className="bg-white/85 dark:bg-slate-900/85 backdrop-blur-md p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800/90 shadow-md shadow-slate-200/40 dark:shadow-none space-y-4 relative overflow-hidden luminous-border-blue">
          {/* Top delicate luminous blue accent line */}
          <div className="absolute top-0 inset-x-0 h-[2px] luminous-line-blue z-20" />
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3.5">
            {/* Title and Subtitle */}
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800 shadow-2xs">
                {chartType === 'line' ? (
                  <LineChartIcon className="w-4 h-4" />
                ) : chartType === 'area' ? (
                  <AreaChartIcon className="w-4 h-4" />
                ) : (
                  <BarChart3 className="w-4 h-4" />
                )}
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <span>{isCategory ? 'Kateqoriya' : 'Bölgə'} Günlük Dinamik Təhlil Qrafiki</span>
                  <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-full border border-blue-100 dark:border-blue-800">
                    {chartMetric === 'fc_sale'
                      ? 'Günlük Satış vs Plan'
                      : chartMetric === 'achievement'
                      ? 'Reallaşma % Dinamikası'
                      : 'Satış & Kumulyativ'}
                  </span>
                </h2>
                <p className="text-[11px] text-slate-400 font-medium">
                  {rawNodes.length === 1
                    ? `"${rawNodes[0]?.name}" Üzrə Gün-Gün Dinamika`
                    : (isCategory ? `Bütün ${rawNodes.length} Kateqoriyanın Gün-Gün Satış Müqayisəsi` : `Bütün ${rawNodes.length} Bölgənin Gün-Gün Satış Müqayisəsi`)}
                </p>
              </div>
            </div>

            {/* Controls: Metric Switcher, Chart Type Switcher */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Metric Selector Pills */}
              <div className="flex items-center bg-slate-100/80 dark:bg-slate-800/80 p-0.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                <button
                  type="button"
                  onClick={() => setChartMetric('fc_sale')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                    chartMetric === 'fc_sale'
                      ? 'bg-white dark:bg-slate-700 text-blue-700 dark:text-blue-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  Günlük Satış
                </button>
                <button
                  type="button"
                  onClick={() => setChartMetric('achievement')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                    chartMetric === 'achievement'
                      ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  Reallaşma %
                </button>
                <button
                  type="button"
                  onClick={() => setChartMetric('stock_sale')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                    chartMetric === 'stock_sale'
                      ? 'bg-white dark:bg-slate-700 text-amber-700 dark:text-amber-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  Satış & Kumulyativ
                </button>
              </div>

              {/* Chart Type Toggle Buttons: Line | Area | Bar */}
              <div className="flex items-center bg-slate-100/80 dark:bg-slate-800/80 p-0.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                <button
                  type="button"
                  title="Xətti Qrafik (LineChart)"
                  onClick={() => setChartType('line')}
                  className={`p-1.5 rounded-lg transition-all ${
                    chartType === 'line'
                      ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                      : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  <LineChartIcon className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  title="Sahə Qrafiki (AreaChart)"
                  onClick={() => setChartType('area')}
                  className={`p-1.5 rounded-lg transition-all ${
                    chartType === 'area'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  <AreaChartIcon className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  title="Sütunlu Qrafik (BarChart)"
                  onClick={() => setChartType('bar')}
                  className={`p-1.5 rounded-lg transition-all ${
                    chartType === 'bar'
                      ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                      : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Chart Display Canvas */}
          <div className="h-72 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'line' ? (
                <LineChart data={chartData} margin={{ top: 15, right: 30, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    interval={0}
                    height={30}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickFormatter={(v) => {
                      if (chartMetric === 'achievement') return `${v}%`;
                      if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
                      if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
                      return String(v);
                    }}
                    domain={chartMetric === 'achievement' ? [0, (max: number) => Math.max(100, Math.ceil((max || 10) * 1.1))] : undefined}
                  />
                  <Tooltip content={<CustomDailyTooltip />} />
                  <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: '11px', paddingBottom: '12px' }} />

                  {rawNodes.length !== 1 ? (
                    <>
                      {rawNodes.map((g, idx) => (
                        <Line
                          key={g.name}
                          type="monotone"
                          dataKey={g.name}
                          name={g.name}
                          stroke={GROUP_COLORS[idx % GROUP_COLORS.length]}
                          strokeWidth={2.5}
                          dot={{ r: 4 }}
                          activeDot={{ r: 7 }}
                          connectNulls={false}
                        />
                      ))}
                      {chartMetric === 'achievement' && (
                        <>
                          <Line
                            type="monotone"
                            dataKey="ideal_pct"
                            name="İdeal plan (pro-rata)"
                            stroke="#94a3b8"
                            strokeDasharray="5 5"
                            strokeWidth={2}
                            dot={false}
                          />
                          <ReferenceLine
                            y={100}
                            stroke="#f59e0b"
                            strokeDasharray="4 4"
                            label={{ value: '100% Hədəf', fill: '#d97706', fontSize: 11, position: 'right' }}
                          />
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      {chartMetric === 'fc_sale' && (
                        <>
                          <Line
                            type="monotone"
                            dataKey="Real Satış (SALE)"
                            name="Real Satış (SALE)"
                            stroke="#10b981"
                            strokeWidth={3}
                            dot={{ r: 5, fill: '#10b981', strokeWidth: 2, stroke: '#ffffff' }}
                            activeDot={{ r: 8 }}
                            connectNulls={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="Hədəf Plan (Günlük)"
                            name="Hədəf Plan (Günlük)"
                            stroke="#3b82f6"
                            strokeDasharray="5 5"
                            strokeWidth={2}
                            dot={false}
                          />
                        </>
                      )}
                      {chartMetric === 'achievement' && (
                        <>
                          <ReferenceLine
                            y={100}
                            stroke="#f59e0b"
                            strokeDasharray="4 4"
                            label={{ value: 'Hədəf (100%)', fill: '#d97706', fontSize: 11, position: 'right' }}
                          />
                          <Line
                            type="monotone"
                            dataKey="Reallaşma %"
                            name="Reallaşma %"
                            stroke="#8b5cf6"
                            strokeWidth={3}
                            dot={{ r: 6, fill: '#8b5cf6', strokeWidth: 2, stroke: '#ffffff' }}
                            activeDot={{ r: 8 }}
                            connectNulls={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="İdeal Plan (pro-rata)"
                            name="İdeal Plan (pro-rata)"
                            stroke="#94a3b8"
                            strokeDasharray="5 5"
                            strokeWidth={2}
                            dot={false}
                          />
                        </>
                      )}
                      {chartMetric === 'stock_sale' && (
                        <>
                          <Line
                            type="monotone"
                            dataKey="Real Satış (SALE)"
                            name="Real Satış"
                            stroke="#10b981"
                            strokeWidth={3}
                            dot={{ r: 5, fill: '#10b981', strokeWidth: 2, stroke: '#ffffff' }}
                            activeDot={{ r: 8 }}
                            connectNulls={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="Kumulyativ Satış"
                            name="Kumulyativ Satış"
                            stroke="#3b82f6"
                            strokeWidth={2.5}
                            dot={{ r: 4, fill: '#3b82f6', strokeWidth: 1.5, stroke: '#ffffff' }}
                            activeDot={{ r: 7 }}
                            connectNulls={false}
                          />
                        </>
                      )}
                    </>
                  )}
                </LineChart>
              ) : chartType === 'area' ? (
                <AreaChart data={chartData} margin={{ top: 15, right: 30, left: 10, bottom: 20 }}>
                  <defs>
                    <linearGradient id="groupEmeraldGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="groupBlueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="groupPurpleGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    interval={0}
                    height={30}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickFormatter={(v) => {
                      if (chartMetric === 'achievement') return `${v}%`;
                      if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
                      if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
                      return String(v);
                    }}
                    domain={chartMetric === 'achievement' ? [0, (max: number) => Math.max(100, Math.ceil((max || 10) * 1.1))] : undefined}
                  />
                  <Tooltip content={<CustomDailyTooltip />} />
                  <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: '11px', paddingBottom: '12px' }} />

                  {rawNodes.length !== 1 ? (
                    <>
                      {rawNodes.map((g, idx) => (
                        <Area
                          key={g.name}
                          type="monotone"
                          dataKey={g.name}
                          name={g.name}
                          stroke={GROUP_COLORS[idx % GROUP_COLORS.length]}
                          fillOpacity={0.15}
                          fill={GROUP_COLORS[idx % GROUP_COLORS.length]}
                          connectNulls={false}
                        />
                      ))}
                      {chartMetric === 'achievement' && (
                        <>
                          <Line
                            type="monotone"
                            dataKey="ideal_pct"
                            name="İdeal plan (pro-rata)"
                            stroke="#94a3b8"
                            strokeDasharray="5 5"
                            strokeWidth={2}
                            dot={false}
                          />
                          <ReferenceLine
                            y={100}
                            stroke="#f59e0b"
                            strokeDasharray="4 4"
                            label={{ value: '100% Hədəf', fill: '#d97706', fontSize: 11, position: 'right' }}
                          />
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      {chartMetric === 'fc_sale' && (
                        <>
                          <Area
                            type="monotone"
                            dataKey="Real Satış (SALE)"
                            name="Real Satış (SALE)"
                            stroke="#10b981"
                            strokeWidth={2.5}
                            fillOpacity={1}
                            fill="url(#groupEmeraldGrad)"
                            dot={{ r: 4 }}
                            connectNulls={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="Hədəf Plan (Günlük)"
                            name="Hədəf Plan (Günlük)"
                            stroke="#3b82f6"
                            strokeDasharray="5 5"
                            strokeWidth={2}
                            dot={false}
                          />
                        </>
                      )}
                      {chartMetric === 'achievement' && (
                        <>
                          <ReferenceLine
                            y={100}
                            stroke="#f59e0b"
                            strokeDasharray="4 4"
                            label={{ value: 'Hədəf (100%)', fill: '#d97706', fontSize: 11, position: 'right' }}
                          />
                          <Area
                            type="monotone"
                            dataKey="Reallaşma %"
                            name="Reallaşma %"
                            stroke="#8b5cf6"
                            strokeWidth={2.5}
                            fillOpacity={1}
                            fill="url(#groupPurpleGrad)"
                            dot={{ r: 5 }}
                            connectNulls={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="İdeal Plan (pro-rata)"
                            name="İdeal Plan (pro-rata)"
                            stroke="#94a3b8"
                            strokeDasharray="5 5"
                            strokeWidth={2}
                            dot={false}
                          />
                        </>
                      )}
                      {chartMetric === 'stock_sale' && (
                        <>
                          <Area
                            type="monotone"
                            dataKey="Real Satış (SALE)"
                            name="Real Satış"
                            stroke="#10b981"
                            strokeWidth={2.5}
                            fillOpacity={1}
                            fill="url(#groupEmeraldGrad)"
                            connectNulls={false}
                          />
                          <Area
                            type="monotone"
                            dataKey="Kumulyativ Satış"
                            name="Kumulyativ Satış"
                            stroke="#3b82f6"
                            strokeWidth={2.5}
                            fillOpacity={1}
                            fill="url(#groupBlueGrad)"
                            connectNulls={false}
                          />
                        </>
                      )}
                    </>
                  )}
                </AreaChart>
              ) : (
                <BarChart data={chartData} margin={{ top: 15, right: 30, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    interval={0}
                    height={30}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickFormatter={(v) => {
                      if (chartMetric === 'achievement') return `${v}%`;
                      if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
                      if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
                      return String(v);
                    }}
                    domain={chartMetric === 'achievement' ? [0, (max: number) => Math.max(100, Math.ceil((max || 10) * 1.1))] : undefined}
                  />
                  <Tooltip content={<CustomDailyTooltip />} />
                  <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: '11px', paddingBottom: '12px' }} />

                  {rawNodes.length !== 1 ? (
                    <>
                      {rawNodes.map((g, idx) => (
                        <Bar
                          key={g.name}
                          dataKey={g.name}
                          name={g.name}
                          fill={GROUP_COLORS[idx % GROUP_COLORS.length]}
                          radius={[6, 6, 0, 0]}
                          maxBarSize={28}
                        />
                      ))}
                      {chartMetric === 'achievement' && (
                        <ReferenceLine
                          y={100}
                          stroke="#f59e0b"
                          strokeDasharray="4 4"
                          label={{ value: '100% Hədəf', fill: '#d97706', fontSize: 11, position: 'right' }}
                        />
                      )}
                    </>
                  ) : (
                    <>
                      {chartMetric === 'fc_sale' && (
                        <>
                          <Bar dataKey="Real Satış (SALE)" name="Real Satış (SALE)" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={32} />
                          <Bar dataKey="Hədəf Plan (Günlük)" name="Hədəf Plan (Günlük)" fill="#94a3b8" radius={[6, 6, 0, 0]} maxBarSize={32} />
                        </>
                      )}
                      {chartMetric === 'achievement' && (
                        <>
                          <ReferenceLine
                            y={100}
                            stroke="#f59e0b"
                            strokeDasharray="4 4"
                            label={{ value: 'Hədəf (100%)', fill: '#d97706', fontSize: 11, position: 'right' }}
                          />
                          <Bar dataKey="Reallaşma %" name="Reallaşma %" fill="#8b5cf6" radius={[6, 6, 0, 0]} maxBarSize={32} />
                        </>
                      )}
                      {chartMetric === 'stock_sale' && (
                        <>
                          <Bar dataKey="Real Satış (SALE)" name="Real Satış" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={32} />
                          <Bar dataKey="Kumulyativ Satış" name="Kumulyativ Satış" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={32} />
                        </>
                      )}
                    </>
                  )}
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* TreeTable Section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center space-x-2">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              {isCategory ? 'Kateqoriya, Sub-kateqoriya və Family Ağacı' : 'Bölgə və Sub-ərazi Ağacı'}
            </h2>
            <span className="text-xs text-slate-400 font-semibold">({processedNodes.length} qrup)</span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Level Controls & Expand All / Collapse All Buttons */}
            {hasSubHierarchy && (
              <div className="flex items-center space-x-1.5 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-750 shadow-2xs">
                <button
                  type="button"
                  onClick={() => handleExpandToLevel(1)}
                  className="px-2 py-1 text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 text-[11px] font-semibold rounded-lg transition-all"
                  title="Yalnız 1-ci səviyyəni göstər"
                >
                  {t('tree_level_1')}
                </button>
                <div className="w-px h-3 bg-slate-200 dark:bg-slate-700" />
                <button
                  type="button"
                  onClick={() => handleExpandToLevel(2)}
                  className="px-2 py-1 text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 text-[11px] font-semibold rounded-lg transition-all"
                  title="2-ci səviyyəyə qədər aç"
                >
                  {t('tree_level_2')}
                </button>
                {maxTreeDepth >= 2 && (
                  <>
                    <div className="w-px h-3 bg-slate-200 dark:bg-slate-700" />
                    <button
                      type="button"
                      onClick={() => handleExpandToLevel(3)}
                      className="px-2 py-1 text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 text-[11px] font-semibold rounded-lg transition-all"
                      title="3-cü səviyyəyə (Family) qədər aç"
                    >
                      {t('tree_level_3')}
                    </button>
                  </>
                )}
                <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-0.5" />
                <button
                  type="button"
                  onClick={handleExpandAll}
                  className="flex items-center space-x-1 px-2 py-1 text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 text-[11px] font-semibold rounded-lg transition-all"
                  title="Bütün alt qrupları aç"
                >
                  <FolderPlus className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                  <span>{t('tree_expand_all')}</span>
                </button>
                <div className="w-px h-3 bg-slate-200 dark:bg-slate-700" />
                <button
                  type="button"
                  onClick={handleCollapseAll}
                  className="flex items-center space-x-1 px-2 py-1 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 text-[11px] font-semibold rounded-lg transition-all"
                  title="Bütün alt qrupları bağla"
                >
                  <FolderMinus className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                  <span>{t('tree_collapse_all')}</span>
                </button>
              </div>
            )}

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Qrup və ya alt qrup axtar..."
                className="pl-8 pr-7 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 w-56 shadow-2xs transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tree Table Container */}
        <div className="overflow-x-auto max-h-[580px] overflow-y-auto relative scrollbar-thin">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-slate-100/95 dark:bg-slate-800/95 backdrop-blur-xs text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700 z-20 shadow-2xs select-none">
              <tr>
                <SortableHeader label="Qrup / Alt Qrup Adı" field="name" currentSortField={sortField} sortAsc={sortAsc} onSort={(f) => handleSort(f as keyof TreeNode)} align="left" className="pl-4 sticky left-0 z-30 min-w-[240px]" />
                <SortableHeader label="Mağaza" field="stores" currentSortField={sortField} sortAsc={sortAsc} onSort={(f) => handleSort(f as keyof TreeNode)} align="right" />
                <SortableHeader label="SKU" field="skus" currentSortField={sortField} sortAsc={sortAsc} onSort={(f) => handleSort(f as keyof TreeNode)} align="right" />
                <SortableHeader label="Proqnoz (FC)" field="fc" currentSortField={sortField} sortAsc={sortAsc} onSort={(f) => handleSort(f as keyof TreeNode)} align="right" />
                <SortableHeader label="Real Satış" field="sale" currentSortField={sortField} sortAsc={sortAsc} onSort={(f) => handleSort(f as keyof TreeNode)} align="right" />
                <SortableHeader label="Reallaşma %" field="achievement_pct" currentSortField={sortField} sortAsc={sortAsc} onSort={(f) => handleSort(f as keyof TreeNode)} align="right" />
                <SortableHeader label="Qalıq Stok" field="stock" currentSortField={sortField} sortAsc={sortAsc} onSort={(f) => handleSort(f as keyof TreeNode)} align="right" />
                <SortableHeader label="OSA %" field="osa_pct" currentSortField={sortField} sortAsc={sortAsc} onSort={(f) => handleSort(f as keyof TreeNode)} align="right" />
                <SortableHeader label="Dağılım" field="distribution_qty" currentSortField={sortField} sortAsc={sortAsc} onSort={(f) => handleSort(f as keyof TreeNode)} align="right" className="pr-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {processedNodes.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 dark:text-slate-500">
                    Məlumat tapılmadı
                  </td>
                </tr>
              ) : (
                processedNodes.map((node) => renderTreeRow(node))
              )}
            </tbody>

            {/* Sticky "Cəmi" Footer Row */}
            {totals && (
              <tfoot className="sticky bottom-0 bg-slate-100 dark:bg-slate-850 font-bold border-t-2 border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 z-20 shadow-md">
                <tr>
                  <td className="p-3 pl-4 sticky left-0 bg-slate-100 dark:bg-slate-850 font-black text-slate-900 dark:text-white border-r border-slate-200 dark:border-slate-700 z-30">
                    CƏMİ
                  </td>
                  <td className="p-3 text-right">{totals.stores.toLocaleString()}</td>
                  <td className="p-3 text-right">{totals.skus.toLocaleString()}</td>
                  <td className="p-3 text-right text-slate-900 dark:text-slate-100">{totals.fc.toLocaleString()}</td>
                  <td className="p-3 text-right text-emerald-600 dark:text-emerald-400 font-black">{totals.sale.toLocaleString()}</td>
                  <td className="p-3 text-right text-blue-700 dark:text-blue-400 font-black">
                    {totals.achievement_pct !== null ? `${totals.achievement_pct}%` : '-'}
                  </td>
                  <td className="p-3 text-right">{totals.stock.toLocaleString()}</td>
                  <td className="p-3 text-right text-emerald-700 dark:text-emerald-400 font-black">{totals.osa_pct}%</td>
                  <td className="p-3 text-right pr-4">{totals.distribution_qty.toLocaleString()}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Drill-down Detail Modal */}
      {selectedNode && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Search className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                      {selectedNode.path && selectedNode.path.length > 0
                        ? selectedNode.path.join(' → ')
                        : selectedNode.isSub && selectedNode.parentName
                        ? `${selectedNode.parentName} → ${selectedNode.name}`
                        : selectedNode.name}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                      {isCategory ? 'Məhsullar' : 'Mağazalar'} ({detailItems.length})
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Sətirə <b>cüt klik (double-click)</b> edərək ətraflı kartı aça bilərsiniz
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Search Toolbar */}
            <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-white dark:bg-slate-900">
              <div className="relative flex-1 max-w-xs">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={detailSearch}
                  onChange={(e) => setDetailSearch(e.target.value)}
                  placeholder="Kod, ad və ya mağaza axtar..."
                  className="pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 w-full"
                />
              </div>
              <button
                onClick={() => {
                  const ws = XLSX.utils.json_to_sheet(detailItems);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, "Detallar");
                  XLSX.writeFile(wb, `${selectedNode.name}_Detallari.xlsx`);
                }}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Detalları İxrac Et</span>
              </button>
            </div>

            {/* Modal Table Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {detailLoading ? (
                <div className="flex items-center justify-center py-16 space-x-3 text-sm text-blue-600 font-semibold">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span>Detallar Yüklənir...</span>
                </div>
              ) : filteredDetailItems.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  Məlumat tapılmadı
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10 select-none shadow-xs">
                    <tr>
                      {isCategory ? (
                        <>
                          <SortableHeader label="Məhsul Kodu" field="code" currentSortField={detailSortField} sortAsc={detailSortAsc} onSort={handleDetailSort} align="left" />
                          <SortableHeader label="Məhsul Adı" field="name" currentSortField={detailSortField} sortAsc={detailSortAsc} onSort={handleDetailSort} align="left" />
                          <SortableHeader label="Mağaza Sayı" field="store_count" currentSortField={detailSortField} sortAsc={detailSortAsc} onSort={handleDetailSort} align="right" />
                        </>
                      ) : (
                        <>
                          <SortableHeader label="Mağaza Kodu" field="store" currentSortField={detailSortField} sortAsc={detailSortAsc} onSort={handleDetailSort} align="left" />
                          <SortableHeader label="SKU Sayı" field="sku_count" currentSortField={detailSortField} sortAsc={detailSortAsc} onSort={handleDetailSort} align="right" />
                        </>
                      )}
                      <SortableHeader label="Proqnoz (FC)" field="fc" currentSortField={detailSortField} sortAsc={detailSortAsc} onSort={handleDetailSort} align="right" />
                      <SortableHeader label="Real Satış" field="sale" currentSortField={detailSortField} sortAsc={detailSortAsc} onSort={handleDetailSort} align="right" />
                      <SortableHeader label="Reallaşma %" field="achievement" currentSortField={detailSortField} sortAsc={detailSortAsc} onSort={handleDetailSort} align="right" />
                      <SortableHeader label="Qalıq Stok" field="stock" currentSortField={detailSortField} sortAsc={detailSortAsc} onSort={handleDetailSort} align="right" />
                      <SortableHeader label="Stokout" field="stockout" currentSortField={detailSortField} sortAsc={detailSortAsc} onSort={handleDetailSort} align="center" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {sortedDetailItems.map((item, idx) => {
                      const achColor = item.achievement === null ? 'text-slate-400' : item.achievement >= 100 ? 'text-emerald-600 font-bold' : item.achievement >= 70 ? 'text-amber-600 font-bold' : 'text-rose-600 font-bold';

                      return (
                        <tr
                          key={idx}
                          onDoubleClick={() => {
                            if (isCategory && item.code) {
                              setSelectedProductDetail({ store: 'ALL', code: item.code });
                            } else if (!isCategory && item.store) {
                              setSelectedStoreDetail(item.store);
                            }
                          }}
                          className="hover:bg-blue-50/50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                          title="Ətraflı baxmaq üçün iki dəfə klikləyin"
                        >
                          {isCategory ? (
                            <>
                              <td className="p-2.5 font-mono font-semibold text-blue-600 dark:text-blue-400">{item.code}</td>
                              <td className="p-2.5 font-medium text-slate-800 dark:text-slate-200 max-w-xs truncate" title={item.name}>
                                {item.name}
                              </td>
                              <td className="p-2.5 text-right text-slate-600 dark:text-slate-400">{item.store_count}</td>
                            </>
                          ) : (
                            <>
                              <td className="p-2.5 font-mono font-bold text-slate-800 dark:text-slate-200">{item.store}</td>
                              <td className="p-2.5 text-right text-slate-600 dark:text-slate-400">{item.sku_count}</td>
                            </>
                          )}
                          <td className="p-2.5 text-right text-slate-700 dark:text-slate-300">{item.fc.toLocaleString()}</td>
                          <td className="p-2.5 text-right text-emerald-600 dark:text-emerald-400 font-bold">{item.sale.toLocaleString()}</td>
                          <td className={`p-2.5 text-right ${achColor}`}>
                            {item.achievement !== null ? `${item.achievement}%` : '-'}
                          </td>
                          <td className="p-2.5 text-right text-slate-700 dark:text-slate-300">{item.stock.toLocaleString()}</td>
                          <td className="p-2.5 text-center">
                            {isCategory ? (
                              item.stockout_store_count && item.stockout_store_count > 0 ? (
                                <span className="text-rose-600 font-bold">{item.stockout_store_count} mağaza</span>
                              ) : (
                                <span className="text-slate-400">0</span>
                              )
                            ) : (
                              item.stockout_sku_count && item.stockout_sku_count > 0 ? (
                                <span className="text-rose-600 font-bold">{item.stockout_sku_count} SKU</span>
                              ) : (
                                <span className="text-slate-400">0</span>
                              )
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
