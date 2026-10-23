import React, { useState, useEffect, useRef } from 'react';
import { Lock, Eye, EyeOff, ShieldAlert, KeyRound, X, ArrowRight } from 'lucide-react';

interface ForecastingPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const FORECASTING_STORAGE_KEY = 'tamstore_forecasting_unlocked';
export const FORECASTING_PASSWORD = 'xako95';

export const isForecastingUnlocked = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(FORECASTING_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

export const lockForecasting = (): void => {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(FORECASTING_STORAGE_KEY);
  } catch {
    // ignore
  }
};

export const ForecastingPasswordModal: React.FC<ForecastingPasswordModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setError(false);
      setErrorMessage('');
      setShowPassword(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!password.trim()) {
      setError(true);
      setErrorMessage('Zəhmət olmasa şifrəni daxil edin');
      return;
    }

    if (password === FORECASTING_PASSWORD) {
      try {
        sessionStorage.setItem(FORECASTING_STORAGE_KEY, 'true');
      } catch {
        // ignore
      }
      setError(false);
      onSuccess();
      onClose();
    } else {
      setError(true);
      setErrorMessage('Daxil edilən şifrə yalnışdır!');
      inputRef.current?.select();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 relative overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient Top Glow */}
        <div className="absolute -top-10 -right-10 w-28 h-28 bg-amber-500/15 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-28 h-28 bg-blue-500/15 rounded-full blur-2xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Bağla"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Lock Header */}
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-amber-400/10 border border-amber-500/30 text-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/10 mb-3.5">
            <Lock className="w-6 h-6 stroke-[2.2]" />
          </div>
          <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
            Təhlükəsizlik Girişi
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
            Bu modula giriş məhdudlaşdırılıb. Zəhmət olmasa təhlükəsizlik şifrəsini daxil edin.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
          <div>
            <div className={`relative flex items-center rounded-xl border transition-all duration-200 ${
              error
                ? 'border-rose-500/80 bg-rose-50/50 dark:bg-rose-950/20 ring-2 ring-rose-500/20'
                : 'border-slate-300 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950/80 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20'
            }`}>
              <div className="pl-3 text-slate-400 dark:text-slate-500">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                ref={inputRef}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) {
                    setError(false);
                    setErrorMessage('');
                  }
                }}
                placeholder="Şifrəni daxil edin..."
                className="w-full px-3 py-2.5 bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors focus:outline-none"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && (
              <div className="flex items-center space-x-1.5 text-xs text-rose-500 font-medium mt-1.5 animate-in fade-in duration-150">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Ləğv et
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-md shadow-blue-500/25 flex items-center justify-center space-x-1.5 transition-all"
            >
              <span>Daxil ol</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
