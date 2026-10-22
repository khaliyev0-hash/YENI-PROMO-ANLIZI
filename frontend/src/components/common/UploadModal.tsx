import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { Upload, X, FileSpreadsheet } from 'lucide-react';

export const UploadModal: React.FC = () => {
  const { showUploadModal, setShowUploadModal, uploadExcelFile, uploadServiceLevelExcelFile } = useData();
  const [dragOver, setDragOver] = useState(false);
  const [uploadTab, setUploadTab] = useState<'GENERAL' | 'SERVICE_LEVEL'>('GENERAL');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowUploadModal(false);
      }
    };
    if (showUploadModal) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [showUploadModal, setShowUploadModal]);

  if (!showUploadModal) return null;

  const handleFile = (file: File) => {
    if (file) {
      if (uploadTab === 'SERVICE_LEVEL') {
        uploadServiceLevelExcelFile(file);
      } else {
        uploadExcelFile(file);
      }
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) setShowUploadModal(false);
      }}
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden cursor-default"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Excel Faylı Yüklə</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Müvafiq promosiya şablonunu seçib sistemə daxil edin</p>
            </div>
          </div>
          <button onClick={() => setShowUploadModal(false)} className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-800/40 p-1.5 gap-1.5 text-xs font-bold">
          <button
            onClick={() => setUploadTab('GENERAL')}
            className={`flex-1 py-2 rounded-xl transition-all cursor-pointer ${
              uploadTab === 'GENERAL'
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs border border-slate-200 dark:border-slate-700'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            📋 Şablon 1: Ümumi (FC / Dağılım)
          </button>
          <button
            onClick={() => setUploadTab('SERVICE_LEVEL')}
            className={`flex-1 py-2 rounded-xl transition-all cursor-pointer ${
              uploadTab === 'SERVICE_LEVEL'
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs border border-slate-200 dark:border-slate-700'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            🚚 Şablon 2: Service Level
          </button>
        </div>

        {/* Dropzone */}
        <div className="p-6">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files.length > 0) {
                handleFile(e.dataTransfer.files[0]);
              }
            }}
            className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all flex flex-col items-center justify-center space-y-3 ${
              dragOver ? 'border-blue-500 bg-blue-500/10' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 hover:border-slate-300 dark:hover:border-slate-600'
            }`}
          >
            <div className="p-4 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800/50 text-blue-600 dark:text-blue-400">
              <FileSpreadsheet className="w-8 h-8" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                {uploadTab === 'GENERAL' ? 'Ümumi Promosiya Şablonunu' : 'Service Level Şablonunu'} bura sürükləyin və ya seçin
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Dəstəklənən formatlar: .xlsx, .xls</p>
            </div>
            <label className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl cursor-pointer shadow-lg shadow-blue-500/20 transition-all">
              <span>Fayl Seçin</span>
              <input
                type="file"
                accept=".xlsx, .xls"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFile(e.target.files[0]);
                  }
                }}
              />
            </label>
          </div>

          <div className="mt-4 p-3 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
            <span className="font-bold text-slate-700 dark:text-slate-200 block">Şablon Haqqında Məlumat:</span>
            {uploadTab === 'GENERAL' ? (
              <p>• <b>Sütunlar:</b> Mehsul_kodu | Mehsul_adi | Magaza | Tesir/adi | başlama tarixi | bitmə tarixi | fc | dagilim miqdari | ref | Kateqoriya | Sub Kateqoriya | Family | Area | Sub Area<br/>• Məhsul məlumatları avtomatik DB-dəki bütün mağazalara replikasiya olunur.</p>
            ) : (
              <p>• <b>Sütunlar:</b> Mehsul_kodu | Mehsul_adi | Magaza | Sifariş miqdarı | Qarşılanan miqdar | Təminat % | Firma<br/>• Birbaşa Service Level modulunu qidalandırır.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
