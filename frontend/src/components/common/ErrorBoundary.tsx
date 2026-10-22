import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';
import { useToast, type ToastType } from './ToastProvider';

interface Props {
  children: ReactNode;
  showToast?: (toast: { type: ToastType; message: string }) => void;
  resetKey?: any;
  title?: string;
  isModal?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundaryClass extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });

    if (this.props.showToast) {
      try {
        this.props.showToast({
          type: 'error',
          message: `Xəta baş verdi: ${error.message || 'Gözlənilməz xəta'}`,
        });
      } catch (e) {
        // Fallback if toast fails
      }
    }
  }

  public componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.handleReset();
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || 'Naməlum xəta baş verdi.';
      const componentStack = this.state.errorInfo?.componentStack || '';

      if (this.props.isModal) {
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-rose-200 dark:border-rose-900/50 max-w-lg w-full p-6 text-slate-800 dark:text-slate-200">
              <div className="flex items-start space-x-3">
                <div className="p-3 bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-xl shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {this.props.title || 'Modulda bir xəta baş verdi'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Bu pəncərədə gözlənilməz problem yarandı. Yenidən cəhd edə və ya bağlaya bilərsiniz.
                  </p>
                </div>
              </div>

              <details className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs text-slate-700 dark:text-slate-300">
                <summary className="font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                  Xəta detalları
                </summary>
                <div className="mt-2 text-rose-700 dark:text-rose-400 font-mono text-[11px] break-words whitespace-pre-wrap">
                  {errorMessage}
                </div>
                {componentStack && (
                  <pre className="mt-2 max-h-36 overflow-auto text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-950/80 p-2 rounded">
                    {componentStack}
                  </pre>
                )}
              </details>

              <div className="mt-5 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={this.handleReset}
                  className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Yenidən cəhd et</span>
                </button>
                <button
                  type="button"
                  onClick={this.handleReload}
                  className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Səhifəni yenilə</span>
                </button>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className="p-8 max-w-2xl mx-auto my-8 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-rose-200 dark:border-rose-900/50 text-slate-800 dark:text-slate-200">
          <div className="flex items-start space-x-4">
            <div className="p-3.5 bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-2xl shrink-0">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                {this.props.title || 'Bir xəta baş verdi'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Səhifə məzmunu yüklənərkən problem yarandı. Digər səhifələrə keçə və ya aşağıdakı seçimlərdən istifadə edə bilərsiniz.
              </p>
            </div>
          </div>

          <details className="mt-5 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs text-slate-700 dark:text-slate-300 group">
            <summary className="font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
              Xəta detalları
            </summary>
            <div className="mt-2 text-rose-700 dark:text-rose-400 font-mono text-xs break-words whitespace-pre-wrap">
              {errorMessage}
            </div>
            {componentStack && (
              <pre className="mt-2.5 max-h-48 overflow-auto text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-950/80 p-2.5 rounded-lg">
                {componentStack}
              </pre>
            )}
          </details>

          <div className="mt-6 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={this.handleReset}
              className="flex items-center space-x-2 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer shadow-xs"
            >
              <RotateCcw className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              <span>Yenidən cəhd et</span>
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="flex items-center space-x-2 px-4 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors cursor-pointer shadow-sm"
            >
              <RefreshCw className="w-4 h-4 text-white" />
              <span>Səhifəni yenilə</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export const ErrorBoundary: React.FC<Omit<Props, 'showToast'>> = (props) => {
  const { showToast } = useToast();
  return <ErrorBoundaryClass {...props} showToast={showToast} />;
};
