import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import {
  LayoutDashboard, TrendingUp, Store, Package, AlertTriangle,
  Grid, FileSpreadsheet, Settings, Calendar, Truck, Clock, CalendarDays, Sparkles,
  Tags, MapPin, Zap, Boxes, Lock, Unlock
} from 'lucide-react';
import {
  ForecastingPasswordModal,
  isForecastingUnlocked
} from '../common/ForecastingPasswordModal';

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab, t, data, campaigns, activeCampaignId } = useData();
  const [timeStr, setTimeStr] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>('');
  const [tickKey, setTickKey] = useState<number>(0);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState<boolean>(false);
  const [isUnlocked, setIsUnlocked] = useState<boolean>(isForecastingUnlocked);

  const activeCampaign = campaigns?.find((c) => c.is_active) || campaigns?.find((c) => c.id === activeCampaignId) || campaigns?.[0];
  const rawInsertName = activeCampaign?.insert_name;
  const insertName = (!rawInsertName || rawInsertName.toLowerCase() === 'test1' || rawInsertName === 'Aktiv İnsert')
    ? '15-28 Promo'
    : rawInsertName;
  const begDate = activeCampaign?.beg_date || '03.09.2026';
  const endDate = activeCampaign?.end_date || '12.09.2026';
  const achPct = data?.kpi_cards?.achievement_pct !== undefined && data?.kpi_cards?.achievement_pct !== null ? data.kpi_cards.achievement_pct : null;
  const totalSales = data?.kpi_cards?.total_sales ?? 0;
  const totalFc = data?.kpi_cards?.total_forecast ?? 0;

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('az-AZ', { hour12: false }));
      setTickKey((prev) => prev + 1);
      
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      setDateStr(`${day}.${month}.${year}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { id: 'dashboard', label: t('nav_dashboard'), icon: LayoutDashboard, iconBg: 'bg-blue-100/90 text-blue-700 border-blue-200/90' },
    { id: 'promo_perf', label: t('nav_promo_perf'), icon: TrendingUp, iconBg: 'bg-indigo-100/90 text-indigo-700 border-indigo-200/90' },
    { id: 'promo_uplift', label: t('nav_promo_uplift'), icon: Zap, iconBg: 'bg-amber-100/90 text-amber-700 border-amber-200/90' },
    { id: 'category_analysis', label: t('nav_category_analysis'), icon: Tags, iconBg: 'bg-pink-100/90 text-pink-700 border-pink-200/90' },
    { id: 'area_analysis', label: t('nav_area_analysis'), icon: MapPin, iconBg: 'bg-emerald-100/90 text-emerald-700 border-emerald-200/90' },
    { id: 'store_analytics', label: t('nav_store_analytics'), icon: Store, iconBg: 'bg-emerald-100/90 text-emerald-700 border-emerald-200/90' },
    { id: 'store_daily_stock', label: t('nav_store_daily_stock'), icon: Calendar, iconBg: 'bg-teal-100/90 text-teal-700 border-teal-200/90' },
    { id: 'service_level', label: t('nav_service_level'), icon: Truck, iconBg: 'bg-amber-100/90 text-amber-700 border-amber-200/90' },
    { id: 'product_analytics', label: t('nav_product_analytics'), icon: Package, iconBg: 'bg-purple-100/90 text-purple-700 border-purple-200/90' },
    { id: 'stockout_analysis', label: t('nav_stockout_analysis'), icon: AlertTriangle, badge: data?.kpi_cards?.stockout_stores_count, iconBg: 'bg-rose-100/90 text-rose-700 border-rose-200/90' },
    { id: 'matrix', label: t('nav_matrix'), icon: Grid, iconBg: 'bg-cyan-100/90 text-cyan-700 border-cyan-200/90' },
    { id: 'reports', label: t('nav_reports'), icon: FileSpreadsheet, iconBg: 'bg-blue-100/90 text-blue-700 border-blue-200/90' },
    { id: 'settings', label: t('nav_settings'), icon: Settings, iconBg: 'bg-slate-200/90 text-slate-700 border-slate-300/90' },
    { id: 'promo_distribution', label: 'Forecasting', icon: Boxes, isLocked: true, iconBg: 'bg-emerald-100/90 text-emerald-700 border-emerald-200/90' },
  ];

  const handleNavClick = (id: string, isLocked?: boolean) => {
    if (isLocked && !isUnlocked) {
      setIsPasswordModalOpen(true);
      return;
    }
    setActiveTab(id);
  };

  const handlePasswordSuccess = () => {
    setIsUnlocked(true);
    setActiveTab('promo_distribution');
  };

  return (
    <>
      <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col h-full shrink-0 shadow-sm z-30 transition-colors duration-200">
      {/* Brand Header with Gold Sparkles Detail */}
      <div className="px-3.5 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center space-x-3 bg-gradient-to-r from-blue-50/80 via-white to-blue-50/40 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 shrink-0">
        <div className="relative w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-700 via-blue-600 to-blue-500 flex items-center justify-center text-white shadow-md shadow-blue-500/35 ring-2 ring-blue-400/30 font-black animate-logo-entrance logo-container-interactive">
          <TrendingUp className="w-4 h-4 stroke-[2.5] drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)] animate-pulse" />
          {/* Gold Sparkle Icon at Top Right of Blue Logo Box */}
          <Sparkles className="w-3.5 h-3.5 text-amber-300 fill-amber-300 absolute -top-1 -right-1 drop-shadow-md animate-pulse" />
        </div>
        <div>
          <h1 className="font-black text-xs bg-gradient-to-r from-blue-900 via-blue-800 to-slate-900 dark:from-blue-400 dark:via-blue-300 dark:to-white bg-clip-text text-transparent tracking-wide leading-tight drop-shadow-xs">TAMSTORE</h1>
          <p className="text-[9px] text-blue-600 dark:text-blue-400 font-black tracking-wider uppercase drop-shadow-[0_1px_3px_rgba(20,121,232,0.3)] animate-pulse">Promo Intelligence</p>
        </div>
      </div>

      {/* Nav Menu */}
      <div className="flex-1 overflow-y-auto min-h-0 px-2.5 py-2 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id, item.isLocked)}
              className={`w-full relative flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-all duration-200 group/nav ${
                isActive
                  ? 'bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/30 border border-blue-400/40 translate-x-1'
                  : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50/80 hover:shadow-xs hover:translate-x-0.5 border border-transparent hover:border-blue-200/60'
              }`}
            >
              {isActive && (
                <>
                  <span className="absolute left-0 top-1 bottom-1 w-1 bg-amber-400 rounded-r-full shadow-md shadow-amber-400/80 animate-pulse" />
                  <span className="absolute right-2 w-1.5 h-1.5 rounded-full bg-amber-300 animate-ping" />
                </>
              )}

              <div className="flex items-center space-x-2.5 truncate">
                {/* Prominent Vivid Icon Badge Container */}
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border transition-all duration-200 shadow-2xs ${
                  isActive
                    ? 'bg-white/20 text-white border-white/30 scale-105 shadow-xs'
                    : `${item.iconBg} group-hover/nav:bg-blue-600 group-hover/nav:text-white group-hover/nav:border-blue-500 group-hover/nav:scale-110`
                }`}>
                  <Icon
                    className={`w-4 h-4 stroke-[2.2] transition-all duration-200 ${
                      isActive
                        ? 'text-white drop-shadow-xs'
                        : 'group-hover/nav:text-white'
                    }`}
                  />
                </div>
                <span className={`truncate text-[12.5px] ${isActive ? 'font-semibold text-white' : 'font-medium text-slate-700 dark:text-slate-200'}`}>{item.label}</span>
              </div>

              <div className="flex items-center space-x-1.5 shrink-0">
                {item.isLocked && !isUnlocked && (
                  <span className="p-1 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/20" title="Şifrə tələb olunur">
                    <Lock className="w-3 h-3 stroke-[2.5]" />
                  </span>
                )}
                {item.isLocked && isUnlocked && (
                  <span className="p-1 rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" title="Aktiv / Kilidsiz">
                    <Unlock className="w-3 h-3 stroke-[2.5]" />
                  </span>
                )}
                {item.badge !== undefined && item.badge > 0 && (
                  <span className={`px-2 py-0.5 text-[9.5px] font-semibold rounded-full transition-all duration-200 ${
                    isActive
                      ? 'bg-white text-blue-700 shadow-xs border border-blue-200 animate-pulse'
                      : 'bg-rose-100 text-rose-800 border border-rose-300/80 shadow-xs animate-pulse'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Pinned Bottom Section (Anchored to the very bottom via mt-auto) */}
      <div className="mt-auto shrink-0 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/80 p-2 space-y-1.5">
        {/* Active Campaign Micro Card */}
        <div className="p-2 rounded-xl bg-gradient-to-br from-blue-50/90 via-white to-blue-50/40 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900/90 border border-blue-200/80 dark:border-slate-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5 truncate">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600 shadow-xs shadow-blue-500"></span>
              </span>
              <span className="text-[10.5px] font-extrabold text-blue-600 dark:text-blue-400 tracking-tight animate-blue-blink truncate">
                {insertName}
              </span>
            </div>
            {achPct !== null && (
              <span className="text-[8.5px] font-black px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shrink-0">
                {achPct}%
              </span>
            )}
          </div>
          {/* Micro Progress Bar */}
          <div className="w-full h-1 bg-slate-200/80 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${
                (achPct || 0) >= 100
                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                  : (achPct || 0) >= 80
                  ? 'bg-gradient-to-r from-blue-500 to-emerald-500'
                  : 'bg-gradient-to-r from-amber-500 to-blue-500'
              }`}
              style={{ width: `${Math.min(achPct || 0, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[8px] text-slate-500 dark:text-slate-400 font-semibold">
            <span>{begDate} - {endDate}</span>
            <span className="font-mono font-bold text-blue-900 dark:text-blue-300">{totalSales.toLocaleString()} u</span>
          </div>
        </div>

        {/* Live Date & Clock Bar (Single Horizontal Compact Row) */}
        <div className="flex items-center justify-between bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs text-[10px] font-mono">
          <div className="flex items-center space-x-1 text-slate-600 dark:text-slate-300">
            <CalendarDays className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0 stroke-[2.2]" />
            <span className="font-bold text-slate-800 dark:text-slate-200">{dateStr || '06.10.2026'}</span>
          </div>
          <div className="flex items-center space-x-1 text-blue-950 dark:text-blue-200 font-black">
            <Clock className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0 animate-pulse stroke-[2.2]" />
            <span key={tickKey} className="animate-clock-tick">{timeStr || '17:24:52'}</span>
          </div>
        </div>

        {/* Footer info - Powered By Khayal Aliyev */}
        <div className="text-center pt-0.5">
          <p className="text-[8.5px] text-blue-600 font-black uppercase tracking-wider animate-pulse">
            Powered By - Khayal Aliyev
          </p>
        </div>
      </div>
    </aside>

    {/* Password Modal for Forecasting Module */}
    <ForecastingPasswordModal
      isOpen={isPasswordModalOpen}
      onClose={() => setIsPasswordModalOpen(false)}
      onSuccess={handlePasswordSuccess}
    />
  </>
);
};
