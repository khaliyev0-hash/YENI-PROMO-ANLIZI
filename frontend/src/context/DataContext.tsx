import React, { createContext, useContext, useState, useEffect } from 'react';
import type { AnalyticsResponse, AppSettings, CampaignMetadata, ColumnMapping, DataQualityReport, GlobalFilterState, SourceStatus } from '../types';
import { translations } from '../i18n/translations';
import { useToast } from '../components/common/ToastProvider';

interface DataContextType {
  data: AnalyticsResponse | null;
  loading: boolean;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  lang: 'AZ' | 'TR' | 'EN';
  setLang: (l: 'AZ' | 'TR' | 'EN') => void;
  t: (key: string) => string;
  filters: GlobalFilterState;
  setFilters: React.Dispatch<React.SetStateAction<GlobalFilterState>>;
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  qualityReport: DataQualityReport | null;
  columnMapping: ColumnMapping | null;
  confidence: number;
  sampleRows: any[];
  excelColumns: string[];
  campaigns: CampaignMetadata[];
  activeCampaignId: string | null;
  sourceStatus: SourceStatus | null;
  fetchCampaigns: () => Promise<void>;
  selectCampaign: (campaignId: string) => Promise<void>;
  showUploadModal: boolean;
  setShowUploadModal: (val: boolean) => void;
  showQualityModal: boolean;
  setShowQualityModal: (val: boolean) => void;
  showColumnMapperModal: boolean;
  setShowColumnMapperModal: (val: boolean) => void;
  showCommandPalette: boolean;
  setShowCommandPalette: (val: boolean) => void;
  showPresentationMode: boolean;
  setShowPresentationMode: (val: boolean) => void;
  selectedProductDetail: { store: string; code: string } | null;
  setSelectedProductDetail: (val: { store: string; code: string } | null) => void;
  selectedStoreDetail: string | null;
  setSelectedStoreDetail: (val: string | null) => void;
  loadDemoData: (format?: string) => Promise<void>;
  uploadExcelFile: (file: File) => Promise<void>;
  uploadServiceLevelExcelFile: (file: File) => Promise<void>;
  submitAnalysis: (customMapping?: ColumnMapping) => Promise<void>;
  refreshCacheAndData: () => Promise<void>;
  refreshSource: (force?: boolean) => Promise<void>;
  refreshActiveCampaign: () => Promise<void>;
  exportExcel: () => void;
  exportPdf: () => void;
}


const defaultSettings: AppSettings = {
  achievement_critical: 70.0,
  achievement_target: 100.0,
  achievement_over: 120.0,
  high_stock_threshold: 50.0,
  low_stock_threshold: 5.0,
  stockout_min_days: 1,
  weight_achievement: 0.35,
  weight_sell_through: 0.25,
  weight_stockout: 0.20,
  weight_bias: 0.20,
  abc_a_percent: 80.0,
  abc_b_percent: 15.0,
  abc_c_percent: 5.0,
  lost_sales_method: "avg_daily_sales",
  language: "AZ"
};

const defaultFilters: GlobalFilterState = {
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
};

export const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { showToast } = useToast();
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const getInitialTab = () => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam) return tabParam;
      const hash = window.location.hash.replace('#', '');
      if (hash) return hash;
    }
    return "dashboard";
  };
  const [activeTab, setActiveTab] = useState<string>(getInitialTab);
  const [lang, setLang] = useState<'AZ' | 'TR' | 'EN'>("AZ");
  const [filters, setFilters] = useState<GlobalFilterState>(defaultFilters);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  
  const [qualityReport, setQualityReport] = useState<DataQualityReport | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping | null>(null);
  const [confidence, setConfidence] = useState<number>(1.0);
  const [sampleRows, setSampleRows] = useState<any[]>([]);
  const [excelColumns, setExcelColumns] = useState<string[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignMetadata[]>([]);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [sourceStatus, setSourceStatus] = useState<SourceStatus | null>(null);
  const prevLastSuccessRef = React.useRef<string | null>(null);

  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [showQualityModal, setShowQualityModal] = useState<boolean>(false);
  const [showColumnMapperModal, setShowColumnMapperModal] = useState<boolean>(false);
  const [showCommandPalette, setShowCommandPalette] = useState<boolean>(false);
  const [showPresentationMode, setShowPresentationMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('tv') === 'true' || params.get('tv') === '1' || window.location.hash === '#tv';
    }
    return false;
  });
  const [selectedProductDetail, setSelectedProductDetail] = useState<{ store: string; code: string } | null>(null);
  const [selectedStoreDetail, setSelectedStoreDetail] = useState<string | null>(null);

  const getHostName = () => (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname : 'localhost';
  const API_BASE = import.meta.env.VITE_API_BASE_URL || `http://${getHostName()}:8000/api`;

  const t = (key: string): string => {
    const dict = translations[lang] || translations.AZ;
    return (dict as any)[key] || key;
  };

  const refreshActiveCampaign = async () => {
    try {
      const res = await fetch(`${API_BASE}/current-analysis`);
      if (res.ok) {
        const json = await res.json();
        if (json && json.analytics && json.analytics.kpi_cards) {
          setColumnMapping(json.mapping || null);
          setQualityReport(json.quality_report || null);
          setConfidence(json.confidence || 1.0);
          setSampleRows(json.sample_rows || []);
          setData(json.analytics);
          if (json.id) {
            setActiveCampaignId(json.id);
          }
          await fetchCampaigns();
        }
      }
    } catch (err) {
      console.error("Failed to refresh active campaign", err);
    }
  };

  const refreshSource = async (force: boolean = true) => {
    try {
      const res = await fetch(`${API_BASE}/source/refresh?force=${force}`, { method: "POST" });
      if (res.status === 202) {
        showToast({ type: 'info', message: "Mənbə faylının emalı başladıldı..." });
      } else if (res.status === 409) {
        showToast({ type: 'warning', message: "Fayl artıq emal edilir..." });
      }
    } catch (err) {
      console.error("Failed to trigger source refresh", err);
      showToast({ type: 'error', message: "Mənbəni yeniləmək mümkün olmadı." });
    }
  };

  const fetchCampaigns = async () => {
    try {
      const res = await fetch(`${API_BASE}/campaigns`);
      if (res.ok) {
        const list: CampaignMetadata[] = await res.json();
        setCampaigns(list);
        const active = list.find((c) => c.is_active);
        if (active) {
          setActiveCampaignId(active.id);
        }
      }
    } catch (err) {
      console.error("Failed to fetch campaigns list", err);
    }
  };

  const fetchSourceStatus = React.useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/source/status`);
      if (res.ok) {
        const status: SourceStatus = await res.json();
        setSourceStatus(status);

        if (status.last_success_at) {
          if (prevLastSuccessRef.current !== null && prevLastSuccessRef.current !== status.last_success_at) {
            await refreshActiveCampaign();
            showToast({ type: 'success', message: 'Yeni data yükləndi ✓' });
          }
          prevLastSuccessRef.current = status.last_success_at;
        }
      }
    } catch (err) {
      console.error("Failed to fetch source status", err);
    }
  }, [API_BASE, showToast]);

  useEffect(() => {
    fetchSourceStatus();
    const interval = setInterval(fetchSourceStatus, 15000);
    return () => clearInterval(interval);
  }, [fetchSourceStatus]);

  const selectCampaign = async (campaignId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/campaigns/${campaignId}/activate`, {
        method: "POST"
      });
      if (res.ok) {
        const json = await res.json();
        const camp = json.campaign;
        if (camp && camp.analytics && camp.analytics.kpi_cards) {
          setColumnMapping(camp.mapping || null);
          setQualityReport(camp.quality_report || null);
          setConfidence(camp.confidence || 1.0);
          setSampleRows(camp.sample_rows || []);
          setData(camp.analytics);
          setActiveCampaignId(campaignId);
          await fetchCampaigns();
        } else {
          setData(null);
        }
      } else {
        showToast({ type: 'error', message: "Kampaniya aktivləşdirilərkən xəta baş verdi." });
      }
    } catch (err) {
      console.error("Campaign select failed", err);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const loadDemoData = async (format: string = "B") => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/demo-data?format_type=${format}`);
      const json = await res.json();
      setColumnMapping(json.mapping);
      setQualityReport(json.quality_report);
      setConfidence(json.confidence);
      setData(json.analytics);
    } catch (err) {
      console.error("Demo data load failed", err);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/current-analysis`);
        if (res.ok) {
          const json = await res.json();
          if (json && json.analytics && json.analytics.kpi_cards) {
            setColumnMapping(json.mapping || null);
            setQualityReport(json.quality_report || null);
            setConfidence(json.confidence || 1.0);
            setSampleRows(json.sample_rows || []);
            setData(json.analytics);
            if (json.id) {
              setActiveCampaignId(json.id);
            }
            await fetchCampaigns();
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        console.error("Failed to fetch current analysis", err);
      }
      try {
        await loadDemoData("B");
      } catch (err) {
        console.error("Failed to load fallback demo data", err);
      }
      await fetchCampaigns();
      setLoading(false);
    };
    initData();
  }, []);



  const uploadExcelFile = async (file: File) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        body: formData
      });
      if (!res.ok) {
        let errorMsg = "Fayl yüklənərkən xəta baş verdi.";
        try {
          const errJson = await res.json();
          if (errJson.detail) {
            errorMsg = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
          }
        } catch (_) {
          const rawText = await res.text().catch(() => "");
          if (rawText) errorMsg = rawText;
        }
        showToast({ type: 'error', message: errorMsg });
        return;
      }
      const json = await res.json();
      if (json.db_warning) {
        console.warn("DB Warning:", json.db_warning);
      }
      setColumnMapping(json.mapping);
      setQualityReport(json.quality_report);
      setConfidence(json.confidence);
      setSampleRows(json.sample_rows || []);
      if (json.analytics) {
        setData(json.analytics);
      }
      if (json.campaign_id) {
        setActiveCampaignId(json.campaign_id);
      }
      await fetchCampaigns();
      if (json.df_columns && json.df_columns.length > 0) {
        setExcelColumns(json.df_columns);
      } else if (json.sample_rows && json.sample_rows.length > 0) {
        setExcelColumns(Object.keys(json.sample_rows[0]));
      }
      
      setShowUploadModal(false);
      showToast({ type: 'success', message: 'Excel faylı uğurla yükləndi ✓' });
      if (json.confidence < 0.8) {
        setShowColumnMapperModal(true);
      } else {
        setShowQualityModal(true);
      }
    } catch (err: any) {
      showToast({ type: 'error', message: `Serverlə əlaqə qurmaq mümkün olmadı: ${err?.message || "Şəbəkə xətası"}` });
    } finally {
      setLoading(false);
    }
  };

  const uploadServiceLevelExcelFile = async (file: File) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_BASE}/upload/service-level`, {
        method: "POST",
        body: formData
      });
      if (!res.ok) {
        let errorMsg = "Service Level faylı yüklənərkən xəta baş verdi.";
        try {
          const errJson = await res.json();
          if (errJson.detail) {
            errorMsg = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
          }
        } catch (_) {
          const rawText = await res.text().catch(() => "");
          if (rawText) errorMsg = rawText;
        }
        showToast({ type: 'error', message: errorMsg });
        return;
      }
      const json = await res.json();
      if (data) {
        setData({
          ...data,
          service_level_records: json.service_level_records
        });
      } else {
        try {
          const currentRes = await fetch(`${API_BASE}/current-analysis`);
          if (currentRes.ok) {
            const curJson = await currentRes.json();
            if (curJson?.analytics?.kpi_cards) {
              setColumnMapping(curJson.mapping || null);
              setQualityReport(curJson.quality_report || null);
              setConfidence(curJson.confidence || 1.0);
              setSampleRows(curJson.sample_rows || []);
              setData(curJson.analytics);
              if (curJson.id) setActiveCampaignId(curJson.id);
            }
          }
        } catch (_) {}
      }
      setShowUploadModal(false);
      showToast({ type: 'success', message: `Service Level şablonu uğurla yükləndi! ${json.total_records} qeyd yeniləndi.` });
    } catch (err: any) {
      showToast({ type: 'error', message: `Serverlə əlaqə qurmaq mümkün olmadı: ${err?.message || "Şəbəkə xətası"}` });
    } finally {
      setLoading(false);
    }
  };

  const submitAnalysis = async (customMapping?: ColumnMapping) => {
    setLoading(true);
    try {
      const mappingToSend = customMapping || columnMapping;
      const res = await fetch(`${API_BASE}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mapping: mappingToSend,
          settings: settings
        })
      });
      if (!res.ok) {
        let errorMsg = "Təhlil işləyərkən xəta baş verdi.";
        try {
          const errJson = await res.json();
          if (errJson.detail) {
            errorMsg = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
          }
        } catch (_) {
          const rawText = await res.text().catch(() => "");
          if (rawText) errorMsg = rawText;
        }
        showToast({ type: 'error', message: errorMsg });
        
        if (errorMsg.includes("Məlumat tapılmadı") || errorMsg.includes("Sessiya sıfırlanıb")) {
          setShowColumnMapperModal(false);
          setShowQualityModal(false);
          setShowUploadModal(true);
        }
        return;
      }
      const analyticsRes = await res.json();
      setData(analyticsRes);
      setShowQualityModal(false);
      setShowColumnMapperModal(false);
      showToast({ type: 'success', message: 'Təhlil parametrləri uğurla yeniləndi ✓' });
    } catch (err: any) {
      showToast({ type: 'error', message: `Təhlil zamanı xəta baş verdi: ${err?.message || "Şəbəkə xətası"}` });
    } finally {
      setLoading(false);
    }
  };

  const refreshCacheAndData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/refresh-parquet-cache`, { method: "POST" });
      if (!res.ok) {
        let errStr = "Keş yenilənərkən xəta baş verdi";
        try {
          const jsonErr = await res.json();
          if (jsonErr.detail) errStr = jsonErr.detail;
        } catch (_) {}
        throw new Error(errStr);
      }
      
      // Re-fetch current analysis
      const currentRes = await fetch(`${API_BASE}/current-analysis`);
      if (currentRes.ok) {
        const json = await currentRes.json();
        if (json && json.analytics && json.analytics.kpi_cards) {
          setColumnMapping(json.mapping || null);
          setQualityReport(json.quality_report || null);
          setConfidence(json.confidence || 1.0);
          setSampleRows(json.sample_rows || []);
          setData(json.analytics);
          if (json.id) {
            setActiveCampaignId(json.id);
          }
        }
      }
      await fetchCampaigns();
      showToast({ type: 'success', message: 'Məlumat keşi uğurla yeniləndi ✓' });
    } catch (err: any) {
      showToast({ type: 'error', message: `Datanı yeniləyərkən xəta baş verdi: ${err?.message || "Şəbəkə xətası"}` });
    } finally {
      setLoading(false);
    }
  };

  const exportExcel = () => {
    window.open(`${API_BASE}/export/excel`, '_blank');
  };

  const exportPdf = () => {
    window.open(`${API_BASE}/export/pdf`, '_blank');
  };

  return (
    <DataContext.Provider value={{
      data,
      loading,
      activeTab,
      setActiveTab,
      lang,
      setLang,
      t,
      filters,
      setFilters,
      settings,
      setSettings,
      qualityReport,
      columnMapping,
      confidence,
      sampleRows,
      excelColumns,
      campaigns,
      activeCampaignId,
      sourceStatus,
      fetchCampaigns,
      selectCampaign,
      showUploadModal,
      setShowUploadModal,
      showQualityModal,
      setShowQualityModal,
      showColumnMapperModal,
      setShowColumnMapperModal,
      showCommandPalette,
      setShowCommandPalette,
      showPresentationMode,
      setShowPresentationMode,
      selectedProductDetail,
      setSelectedProductDetail,
      selectedStoreDetail,
      setSelectedStoreDetail,
      loadDemoData,
      uploadExcelFile,
      uploadServiceLevelExcelFile,
      submitAnalysis,
      refreshCacheAndData,
      refreshSource,
      refreshActiveCampaign,
      exportExcel,
      exportPdf
    }}>
      {children}
    </DataContext.Provider>
  );
};


export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
};
