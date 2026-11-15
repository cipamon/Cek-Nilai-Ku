import React from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { ToastItem } from '../types';

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      className="no-print fixed bottom-5 right-5 z-[100] flex flex-col gap-2.5 max-w-sm w-full px-4 sm:px-0 pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const isSuccess = t.type === 'success';
        const isError = t.type === 'error';
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg text-sm backdrop-blur-sm ${
              isSuccess
                ? 'bg-emerald-50/95 border-emerald-200 text-emerald-950'
                : isError
                  ? 'bg-red-50/95 border-red-200 text-red-950'
                  : 'bg-white/95 border-theme-soft text-slate-900'
            }`}
          >
            {isSuccess ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : isError ? (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            ) : (
              <Info className="w-4 h-4 text-theme-primary shrink-0 mt-0.5" />
            )}
            <span className="flex-1 leading-snug">{t.message}</span>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              className="text-slate-400 hover:text-slate-700 p-0.5 rounded"
              aria-label="Tutup notifikasi"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
