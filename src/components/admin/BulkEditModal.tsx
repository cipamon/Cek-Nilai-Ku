import React, { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { GenderCode } from '../../types';

interface BulkEditModalProps {
  open: boolean;
  selectedCount: number;
  onClose: () => void;
  onApply: (changes: {
    kelas?: string;
    status?: string;
    jenisKelamin?: GenderCode;
  }) => Promise<void>;
}

export const BulkEditModal: React.FC<BulkEditModalProps> = ({
  open,
  selectedCount,
  onClose,
  onApply,
}) => {
  const [updateKelas, setUpdateKelas] = useState(false);
  const [kelas, setKelas] = useState('');
  const [updateStatus, setUpdateStatus] = useState(false);
  const [status, setStatus] = useState('LULUS');
  const [updateGender, setUpdateGender] = useState(false);
  const [jenisKelamin, setJenisKelamin] = useState<GenderCode>('L');
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: { kelas?: string; status?: string; jenisKelamin?: GenderCode } = {};
    if (updateKelas) payload.kelas = kelas.trim();
    if (updateStatus) payload.status = status;
    if (updateGender) payload.jenisKelamin = jenisKelamin;

    if (
      payload.kelas === undefined &&
      payload.status === undefined &&
      payload.jenisKelamin === undefined
    ) {
      return;
    }

    setSaving(true);
    try {
      await onApply(payload);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Edit Masal Data Siswa</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Mengubah {selectedCount} siswa terpilih sekaligus.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2.5">
            <label className="flex items-center gap-2.5 text-sm font-semibold text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={updateKelas}
                onChange={(e) => setUpdateKelas(e.target.checked)}
                className="rounded border-slate-300 text-theme-primary"
              />
              <span>Ubah Kelas</span>
            </label>
            {updateKelas && (
              <input
                type="text"
                value={kelas}
                onChange={(e) => setKelas(e.target.value)}
                placeholder="Contoh: XII IPA 1"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            )}
          </div>

          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2.5">
            <label className="flex items-center gap-2.5 text-sm font-semibold text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={updateGender}
                onChange={(e) => setUpdateGender(e.target.checked)}
                className="rounded border-slate-300 text-theme-primary"
              />
              <span>Ubah Jenis Kelamin</span>
            </label>
            {updateGender && (
              <select
                value={jenisKelamin}
                onChange={(e) => setJenisKelamin(e.target.value as GenderCode)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="L">Laki-laki (L)</option>
                <option value="P">Perempuan (P)</option>
                <option value="">Kosongkan</option>
              </select>
            )}
          </div>

          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2.5">
            <label className="flex items-center gap-2.5 text-sm font-semibold text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={updateStatus}
                onChange={(e) => setUpdateStatus(e.target.checked)}
                className="rounded border-slate-300 text-theme-primary"
              />
              <span>Ubah Status Kelulusan</span>
            </label>
            {updateStatus && (
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="LULUS">LULUS</option>
                <option value="DITANGGUHKAN">DITANGGUHKAN</option>
              </select>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving || (!updateKelas && !updateStatus && !updateGender)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-theme-primary rounded-xl disabled:opacity-50"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Terapkan</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
