import React from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open,
  title,
  message,
  confirmLabel = 'Konfirmasi',
  cancelLabel = 'Batal',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/55 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-3">
          <div className="flex items-center gap-3">
            {destructive && (
              <div className="w-9 h-9 rounded-xl bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
            )}
            <h3 id="confirm-modal-title" className="text-base font-bold text-slate-900">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            aria-label="Tutup dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="px-6 pb-5 text-sm text-slate-600 leading-relaxed">{message}</p>

        <div className="flex items-center justify-end gap-2.5 px-6 py-4 bg-slate-50 border-t border-slate-200">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl transition-colors disabled:opacity-60 ${
              destructive
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-theme-primary'
            }`}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{loading ? 'Memproses...' : confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
