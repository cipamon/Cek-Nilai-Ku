import React, { useEffect, useState } from 'react';
import {
  CheckSquare,
  Eye,
  EyeOff,
  FileText,
  Layers,
  Loader2,
  Printer,
  Save,
  Stamp,
} from 'lucide-react';
import { GradeVisibilityConfig, SchoolConfig, SignatureDisplayMode } from '../../types';
import { resolveSignatureMode } from '../../utils/helpers';

interface VisibilitySettingsViewProps {
  subjects: string[];
  components: string[];
  visibility: GradeVisibilityConfig;
  config?: SchoolConfig;
  onSaveVisibility: (next: GradeVisibilityConfig) => Promise<void>;
  onSavePrintFlags?: (flags: {
    showKopSurat: boolean;
    showHeadmasterSign: boolean;
    signatureMode: SignatureDisplayMode;
  }) => Promise<void>;
}

export const VisibilitySettingsView: React.FC<VisibilitySettingsViewProps> = ({
  subjects,
  components,
  visibility,
  config,
  onSaveVisibility,
  onSavePrintFlags,
}) => {
  const [draft, setDraft] = useState<GradeVisibilityConfig>(visibility);
  const [showKopSurat, setShowKopSurat] = useState<boolean>(config?.showKopSurat ?? true);
  const [signatureMode, setSignatureMode] = useState<SignatureDisplayMode>(() =>
    config ? resolveSignatureMode(config) : 'headmaster'
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(visibility);
  }, [visibility]);

  useEffect(() => {
    if (config) {
      setShowKopSurat(config.showKopSurat ?? true);
      setSignatureMode(resolveSignatureMode(config));
    }
  }, [config]);

  const toggleSubject = (subj: string) => {
    setDraft((prev) => {
      const exists = prev.visibleSubjects.includes(subj);
      return {
        ...prev,
        visibleSubjects: exists
          ? prev.visibleSubjects.filter((s) => s !== subj)
          : [...prev.visibleSubjects, subj],
      };
    });
  };

  const toggleComponent = (comp: string) => {
    setDraft((prev) => {
      const exists = prev.visibleComponents.includes(comp);
      return {
        ...prev,
        visibleComponents: exists
          ? prev.visibleComponents.filter((c) => c !== comp)
          : [...prev.visibleComponents, comp],
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSaveVisibility(draft);
      if (
        onSavePrintFlags &&
        config &&
        (showKopSurat !== (config.showKopSurat ?? true) ||
          signatureMode !== resolveSignatureMode(config))
      ) {
        await onSavePrintFlags({
          showKopSurat,
          showHeadmasterSign: signatureMode === 'headmaster' || signatureMode === 'both',
          signatureMode,
        });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            Atur Tampilan Nilai, Kop & TTD
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Tentukan apakah siswa melihat semua nilai atau hanya mapel/komponen tertentu, serta
            atur kemunculan Kop Surat dan TTD Kepala Sekolah.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-theme-primary rounded-xl shadow-sm disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>Simpan Pengaturan Tampil</span>
        </button>
      </div>

      {/* Mode Selection */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
        <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
          <Eye className="w-4 h-4 text-theme-heading" />
          <span>Mode Tampilan Nilai Siswa</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setDraft((prev) => ({ ...prev, mode: 'all' }))}
            className={`text-left p-4 rounded-2xl border transition-all ${
              draft.mode === 'all'
                ? 'bg-theme-soft border-theme-soft ring-2 ring-indigo-500/20'
                : 'bg-slate-50 border-slate-200 hover:bg-white'
            }`}
          >
            <p className="text-sm font-bold text-slate-900">Tampilkan Semua Nilai</p>
            <p className="text-xs text-slate-500 mt-1">
              Siswa dapat melihat seluruh mata pelajaran dan semua komponen penilaian yang ada.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setDraft((prev) => ({ ...prev, mode: 'selected' }))}
            className={`text-left p-4 rounded-2xl border transition-all ${
              draft.mode === 'selected'
                ? 'bg-theme-soft border-theme-soft ring-2 ring-indigo-500/20'
                : 'bg-slate-50 border-slate-200 hover:bg-white'
            }`}
          >
            <p className="text-sm font-bold text-slate-900">Pilih Nilai / Mapel Tertentu</p>
            <p className="text-xs text-slate-500 mt-1">
              Batasi hanya mata pelajaran atau komponen tertentu (misal hanya PTS atau Matematika).
            </p>
          </button>
        </div>
      </section>

      {draft.mode === 'selected' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Subjects Checklist */}
          <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-theme-heading" />
                <span>Mapel yang Ditampilkan ({draft.visibleSubjects.length})</span>
              </h3>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setDraft((p) => ({ ...p, visibleSubjects: [...subjects] }))}
                  className="font-semibold text-theme-heading hover:underline"
                >
                  Pilih Semua
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={() => setDraft((p) => ({ ...p, visibleSubjects: [] }))}
                  className="font-semibold text-slate-500 hover:underline"
                >
                  Kosongkan
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
              {subjects.map((subj) => {
                const checked = draft.visibleSubjects.includes(subj);
                return (
                  <label
                    key={subj}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-sm cursor-pointer transition-colors ${
                      checked
                        ? 'bg-theme-soft border-theme-soft font-semibold text-theme-heading'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-white'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSubject(subj)}
                      className="rounded border-slate-300 text-theme-primary"
                    />
                    <span className="truncate">{subj}</span>
                  </label>
                );
              })}
            </div>
          </section>

          {/* Components Checklist */}
          <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-sky-600" />
                <span>Komponen yang Ditampilkan ({draft.visibleComponents.length})</span>
              </h3>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setDraft((p) => ({ ...p, visibleComponents: [...components] }))}
                  className="font-semibold text-theme-heading hover:underline"
                >
                  Pilih Semua
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={() => setDraft((p) => ({ ...p, visibleComponents: [] }))}
                  className="font-semibold text-slate-500 hover:underline"
                >
                  Kosongkan
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {components.map((comp) => {
                const checked = draft.visibleComponents.includes(comp);
                return (
                  <label
                    key={comp}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-sm cursor-pointer transition-colors ${
                      checked
                        ? 'bg-sky-50 border-sky-200 font-semibold text-sky-900'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-white'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleComponent(comp)}
                      className="rounded border-slate-300 text-sky-600"
                    />
                    <span className="truncate">{comp}</span>
                  </label>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* Additional Display & Document Print Toggles */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
        <h2 className="text-sm sm:text-base font-bold text-slate-900">
          Opsi Elemen Transkrip, Foto, Kop Surat & TTD Kepsek
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={draft.showComponentDetails}
              onChange={(e) =>
                setDraft((p) => ({ ...p, showComponentDetails: e.target.checked }))
              }
              className="mt-0.5 rounded border-slate-300 text-theme-primary"
            />
            <div>
              <p className="text-sm font-bold text-slate-900">Tampilkan Rincian Komponen Nilai</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Menampilkan lencana nilai Tugas, UH, PTS, PAS di bawah nama mata pelajaran.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={draft.showAverageAndStatus}
              onChange={(e) =>
                setDraft((p) => ({ ...p, showAverageAndStatus: e.target.checked }))
              }
              className="mt-0.5 rounded border-slate-300 text-theme-primary"
            />
            <div>
              <p className="text-sm font-bold text-slate-900">Tampilkan Rata-Rata & Jumlah</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Menampilkan kartu ringkasan total nilai, rata-rata, dan ketuntasan KKM.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={draft.showStudentPhoto ?? true}
              onChange={(e) =>
                setDraft((p) => ({ ...p, showStudentPhoto: e.target.checked }))
              }
              className="mt-0.5 rounded border-slate-300 text-theme-primary"
            />
            <div>
              <p className="text-sm font-bold text-slate-900">Sertakan Foto Siswa saat Cetak / PDF</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Foto siswa selalu tampil di layar Dashboard Siswa; nonaktifkan opsi ini jika foto
                tidak ingin ikut tercetak pada kertas PDF.
              </p>
            </div>
          </label>

          <label
            className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer ${
              (draft.showPrintButton ?? true)
                ? 'bg-emerald-50/70 border-emerald-200'
                : 'bg-slate-50 border-slate-200'
            }`}
          >
            <input
              type="checkbox"
              checked={draft.showPrintButton ?? true}
              onChange={(e) =>
                setDraft((p) => ({ ...p, showPrintButton: e.target.checked }))
              }
              className="mt-0.5 rounded border-slate-300 text-emerald-600"
            />
            <div>
              <p className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                {(draft.showPrintButton ?? true) ? (
                  <Printer className="w-4 h-4 text-emerald-600" />
                ) : (
                  <EyeOff className="w-4 h-4 text-slate-400" />
                )}
                <span>Tampilkan Tombol Cetak / PDF Siswa</span>
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Munculkan atau sembunyikan tombol <strong>Cetak / PDF</strong> pada halaman Dashboard
                Siswa.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={draft.applyToAdminViews}
              onChange={(e) =>
                setDraft((p) => ({ ...p, applyToAdminViews: e.target.checked }))
              }
              className="mt-0.5 rounded border-slate-300 text-theme-primary"
            />
            <div>
              <p className="text-sm font-bold text-slate-900">Terapkan Filter di Leger Admin</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Jika aktif, tabel Leger Nilai Admin juga mengikuti pilihan mapel/komponen di atas.
              </p>
            </div>
          </label>

          {config && onSavePrintFlags && (
            <>
              <label
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer ${
                  showKopSurat
                    ? 'bg-emerald-50/70 border-emerald-200'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <input
                  type="checkbox"
                  checked={showKopSurat}
                  onChange={(e) => setShowKopSurat(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-emerald-600"
                />
                <div>
                  <p className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    {showKopSurat ? (
                      <FileText className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-slate-400" />
                    )}
                    <span>Tampilkan Kop Surat Sekolah</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Atur apakah Kop Surat (2 logo & 6 baris) ditampilkan di transkrip & cetak leger.
                  </p>
                </div>
              </label>

              <div className="sm:col-span-2 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <p className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Stamp className="w-4 h-4 text-emerald-600" />
                  <span>Tampilan Tanda Tangan Dokumen (Kepsek / Guru)</span>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {[
                    { id: 'both' as SignatureDisplayMode, label: 'Kepsek & Guru (Dua-duanya)' },
                    { id: 'headmaster' as SignatureDisplayMode, label: 'Hanya Kepala Sekolah' },
                    { id: 'teacher' as SignatureDisplayMode, label: 'Hanya Guru / Wali Kelas' },
                    { id: 'none' as SignatureDisplayMode, label: 'Tidak Ditampilkan' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSignatureMode(opt.id)}
                      className={`px-3 py-2 rounded-xl border text-xs font-bold text-left transition-all ${
                        signatureMode === opt.id
                          ? 'bg-theme-soft border-theme-soft text-theme-heading ring-2 ring-indigo-500/20'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
};
