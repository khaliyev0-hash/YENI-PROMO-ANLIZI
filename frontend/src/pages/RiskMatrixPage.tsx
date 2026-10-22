import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { ShieldAlert, TrendingUp, AlertTriangle, PackageX, HelpCircle } from 'lucide-react';
import { getApiBase } from '../utils/api';

export const RiskMatrixPage: React.FC = () => {
  const { setSelectedProductDetail } = useData();
  const [matrix, setMatrix] = useState<any>(null);

  useEffect(() => {
    const API_BASE = getApiBase();
    fetch(`${API_BASE}/risk-matrix`)
      .then((res) => res.json())
      .then((data) => setMatrix(data))
      .catch(() => {});
  }, []);

  if (!matrix) return <div className="p-8 text-center text-slate-500">Yüklənir...</div>;

  const q1 = matrix.Q1_HIGH_DEMAND_STOCKOUT_RISK || {};
  const q2 = matrix.Q2_STRONG_PERFORMANCE || {};
  const q3 = matrix.Q3_EXCESS_STOCK_RISK || {};
  const q4 = matrix.Q4_INVESTIGATE || {};

  return (
    <div className="space-y-6 pb-12 text-xs">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">İmkan Və Risk Matrisi (2×2 Opportunity / Risk Matrix)</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Reallaşma Faizi (X oxu) vs Qalıq Stok (Y oxu) kvadran təhlili</p>
        </div>
      </div>

      {/* 2x2 Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Q1: High Achievement + Low Stock */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-rose-500/30 dark:border-rose-900/50 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-rose-600 dark:text-rose-400 text-sm flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4" />
              <span>Q1: YÜKSƏK TƏLƏB / STOKOUT RİSKİ</span>
            </span>
            <span className="px-2 py-0.5 bg-rose-500/20 text-rose-600 dark:text-rose-400 font-extrabold rounded">
              {q1.count} Məhsul/Mağaza
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Yüksək Reallaşma (&ge;100%) + Kritik Aşağı Stok (&le;5 unit)</p>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {q1.items?.map((item: any, idx: number) => (
              <div
                key={`${item.store}_${item.code}_${idx}`}
                onClick={() => setSelectedProductDetail({ store: item.store, code: item.code })}
                className="p-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-blue-500/5 dark:hover:bg-slate-700/80 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between cursor-pointer"
              >
                <div>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{item.name}</span>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Mağaza {item.store} • {item.code}</p>
                </div>
                <div className="text-right">
                  <span className="text-rose-600 dark:text-rose-400 font-bold block">{item.achievement_pct}%</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Stok: {item.stock} u</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Q2: High Achievement + High Stock */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-500/30 dark:border-emerald-900/50 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm flex items-center space-x-2">
              <TrendingUp className="w-4 h-4" />
              <span>Q2: GÜCLÜ PERFORMANS</span>
            </span>
            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-extrabold rounded">
              {q2.count} Məhsul/Mağaza
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Yüksək Reallaşma (&ge;100%) + Kafi Qalıq Stok (&gt;5 unit)</p>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {q2.items?.map((item: any, idx: number) => (
              <div
                key={`${item.store}_${item.code}_${idx}`}
                onClick={() => setSelectedProductDetail({ store: item.store, code: item.code })}
                className="p-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-blue-500/5 dark:hover:bg-slate-700/80 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between cursor-pointer"
              >
                <div>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{item.name}</span>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Mağaza {item.store} • {item.code}</p>
                </div>
                <div className="text-right">
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold block">{item.achievement_pct}%</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Stok: {item.stock} u</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Q3: Low Achievement + High Stock */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-purple-500/30 dark:border-purple-900/50 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-purple-600 dark:text-purple-400 text-sm flex items-center space-x-2">
              <PackageX className="w-4 h-4" />
              <span>Q3: ARTIQ STOK RİSKİ (EXCESS STOCK)</span>
            </span>
            <span className="px-2 py-0.5 bg-purple-500/20 text-purple-600 dark:text-purple-400 font-extrabold rounded">
              {q3.count} Məhsul/Mağaza
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Aşağı Reallaşma (&lt;70%) + Yüksək Qalıq Stok (&gt;50 unit)</p>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {q3.items?.map((item: any, idx: number) => (
              <div
                key={`${item.store}_${item.code}_${idx}`}
                onClick={() => setSelectedProductDetail({ store: item.store, code: item.code })}
                className="p-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-blue-500/5 dark:hover:bg-slate-700/80 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between cursor-pointer"
              >
                <div>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{item.name}</span>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Mağaza {item.store} • {item.code}</p>
                </div>
                <div className="text-right">
                  <span className="text-purple-600 dark:text-purple-400 font-bold block">{item.achievement_pct}%</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Stok: {item.stock} u</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Q4: Low Achievement + Low Stock */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-amber-500/30 dark:border-amber-900/50 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-amber-600 dark:text-amber-400 text-sm flex items-center space-x-2">
              <HelpCircle className="w-4 h-4" />
              <span>Q4: ARAŞDIRILMALI (INVESTIGATE)</span>
            </span>
            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-600 dark:text-amber-400 font-extrabold rounded">
              {q4.count} Məhsul/Mağaza
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Aşağı Reallaşma (&lt;70%) + Aşağı Qalıq Stok (&le;5 unit)</p>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {q4.items?.map((item: any, idx: number) => (
              <div
                key={`${item.store}_${item.code}_${idx}`}
                onClick={() => setSelectedProductDetail({ store: item.store, code: item.code })}
                className="p-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-blue-500/5 dark:hover:bg-slate-700/80 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between cursor-pointer"
              >
                <div>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{item.name}</span>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Mağaza {item.store} • {item.code}</p>
                </div>
                <div className="text-right">
                  <span className="text-amber-600 dark:text-amber-400 font-bold block">{item.achievement_pct}%</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Stok: {item.stock} u</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
