import React, { useEffect, useState } from 'react';
import {
  Award,
  BookOpen,
  Check,
  Edit3,
  Layers,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { SchoolConfig } from '../../types';
import { getSubjectKkm } from '../../utils/helpers';
import { ConfirmModal } from '../ConfirmModal';

interface SubjectKkmSettingsProps {
  subjects: string[];
  components: string[];
  config: SchoolConfig;
  onAddSubject: (name: string) => Promise<void>;
  onRenameSubject: (oldName: string, newName: string) => Promise<void>;
  onDeleteSubject: (name: string) => Promise<void>;
  onAddComponent: (name: string) => Promise<void>;
  onRenameComponent: (oldName: string, newName: string) => Promise<void>;
  onDeleteComponent: (name: string) => Promise<void>;
  onUpdateKkm: (kkm: number) => Promise<void>;
  onUpdateSubjectKkm: (subjectKkm: Record<string, number>) => Promise<void>;
}

export const SubjectKkmSettings: React.FC<SubjectKkmSettingsProps> = ({
  subjects,
  components,
  config,
  onAddSubject,
  onRenameSubject,
  onDeleteSubject,
  onAddComponent,
  onRenameComponent,
  onDeleteComponent,
  onUpdateKkm,
  onUpdateSubjectKkm,
}) => {
  const [newSubject, setNewSubject] = useState('');
  const [newComponent, setNewComponent] = useState('');
  const [kkmValue, setKkmValue] = useState(String(config.kkm));
  const [subjectKkmDraft, setSubjectKkmDraft] = useState<Record<string, string>>({});

  const [editingSubj, setEditingSubj] = useState<string | null>(null);
  const [editingSubjVal, setEditingSubjVal] = useState('');

  const [editingComp, setEditingComp] = useState<string | null>(null);
  const [editingCompVal, setEditingCompVal] = useState('');

  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    kind: 'subject' | 'component';
    name: string;
  } | null>(null);

  useEffect(() => {
    setKkmValue(String(config.kkm));
  }, [config.kkm]);

  useEffect(() => {
    const next: Record<string, string> = {};
    subjects.forEach((subj) => {
      next[subj] = String(getSubjectKkm(config, subj));
    });
    setSubjectKkmDraft(next);
  }, [subjects, config]);

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.trim()) return;
    setBusyAction('add-subj');
    try {
      await onAddSubject(newSubject.trim());
      setNewSubject('');
    } finally {
      setBusyAction(null);
    }
  };

  const handleSaveRenameSubject = async (oldName: string) => {
    if (!editingSubjVal.trim() || editingSubjVal.trim() === oldName) {
      setEditingSubj(null);
      return;
    }
    setBusyAction(`ren-subj-${oldName}`);
    try {
      await onRenameSubject(oldName, editingSubjVal.trim());
      setEditingSubj(null);
    } finally {
      setBusyAction(null);
    }
  };

  const handleAddComponent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComponent.trim()) return;
    setBusyAction('add-comp');
    try {
      await onAddComponent(newComponent.trim());
      setNewComponent('');
    } finally {
      setBusyAction(null);
    }
  };

  const handleSaveRenameComponent = async (oldName: string) => {
    if (!editingCompVal.trim() || editingCompVal.trim() === oldName) {
      setEditingComp(null);
      return;
    }
    setBusyAction(`ren-comp-${oldName}`);
    try {
      await onRenameComponent(oldName, editingCompVal.trim());
      setEditingComp(null);
    } finally {
      setBusyAction(null);
    }
  };

  const handleSaveKkm = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(kkmValue);
    if (isNaN(num) || num < 0 || num > 100) return;
    setBusyAction('kkm');
    try {
      await onUpdateKkm(num);
    } finally {
      setBusyAction(null);
    }
  };

  const handleSaveSubjectKkmAll = async () => {
    const nextMap: Record<string, number> = {};
    subjects.forEach((subj) => {
      const raw = subjectKkmDraft[subj];
      const num = Number(raw);
      if (raw !== undefined && raw.trim() !== '' && !isNaN(num) && num >= 0 && num <= 100) {
        if (num !== config.kkm) {
          nextMap[subj] = Math.round(num * 100) / 100;
        }
      }
    });
    setBusyAction('save-subj-kkm');
    try {
      await onUpdateSubjectKkm(nextMap);
    } finally {
      setBusyAction(null);
    }
  };

  const handleResetSubjectKkm = async () => {
    setBusyAction('reset-subj-kkm');
    try {
      await onUpdateSubjectKkm({});
      const resetDraft: Record<string, string> = {};
      subjects.forEach((s) => {
        resetDraft[s] = String(config.kkm);
      });
      setSubjectKkmDraft(resetDraft);
    } finally {
      setBusyAction(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setBusyAction(`del-${deleteTarget.kind}-${deleteTarget.name}`);
    try {
      if (deleteTarget.kind === 'subject') {
        await onDeleteSubject(deleteTarget.name);
      } else {
        await onDeleteComponent(deleteTarget.name);
      }
      setDeleteTarget(null);
    } finally {
      setBusyAction(null);
    }
  };

  const customKkmCount = subjects.filter(
    (s) =>
      config.subjectKkm &&
      config.subjectKkm[s] !== undefined &&
      config.subjectKkm[s] !== config.kkm
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
          Mata Pelajaran, Komponen & KKM
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Atur daftar mata pelajaran beserta KKM khusus per mapel, dan komponen penilaian.
        </p>
      </div>

      {/* Default KKM Card */}
      <form
        onSubmit={handleSaveKkm}
        className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              KKM Default Sekolah ({customKkmCount} mapel pakai KKM khusus)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Berlaku otomatis untuk mapel yang belum memiliki KKM khusus. Anda dapat mengatur KKM
              berbeda untuk tiap mapel di daftar di bawah.
            </p>
            <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
              {[70, 75, 78, 80].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setKkmValue(String(preset))}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                    Number(kkmValue) === preset
                      ? 'bg-theme-soft text-theme-heading border-theme-soft'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  KKM {preset}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <input
            type="number"
            min={0}
            max={100}
            value={kkmValue}
            onChange={(e) => setKkmValue(e.target.value)}
            className="w-24 px-3 py-2 text-sm font-bold text-center bg-slate-50 border border-slate-300 rounded-xl tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={busyAction === 'kkm'}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-theme-primary rounded-xl disabled:opacity-50"
          >
            {busyAction === 'kkm' && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Simpan Default</span>
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subjects & Per-Subject KKM Management */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-theme-soft text-theme-heading flex items-center justify-center">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  Daftar Mapel & KKM ({subjects.length})
                </h2>
                <p className="text-xs text-slate-500">
                  Ubah angka KKM di sisi kanan tiap mapel lalu klik Simpan KKM Mapel.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleAddSubject} className="flex gap-2">
            <input
              type="text"
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              placeholder="Tambah mata pelajaran baru..."
              className="flex-1 px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={busyAction === 'add-subj' || !newSubject.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-theme-primary rounded-xl disabled:opacity-50 shrink-0"
            >
              {busyAction === 'add-subj' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              <span>Tambah</span>
            </button>
          </form>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {subjects.length === 0 ? (
              <p className="p-4 text-xs text-slate-500 text-center">Belum ada mata pelajaran.</p>
            ) : (
              subjects.map((subj, idx) => {
                const draftVal = subjectKkmDraft[subj] ?? String(getSubjectKkm(config, subj));
                const isCustom = Number(draftVal) !== config.kkm;
                return (
                  <div
                    key={subj}
                    className="px-3.5 py-2.5 flex items-center justify-between gap-2 hover:bg-slate-50"
                  >
                    {editingSubj === subj ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={editingSubjVal}
                          onChange={(e) => setEditingSubjVal(e.target.value)}
                          className="flex-1 px-2.5 py-1 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => void handleSaveRenameSubject(subj)}
                          disabled={busyAction === `ren-subj-${subj}`}
                          className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingSubj(null)}
                          className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span className="text-xs font-bold text-slate-400 w-5 tabular-nums shrink-0">
                            {idx + 1}.
                          </span>
                          <span className="text-sm font-medium text-slate-800 truncate">
                            {subj}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                            <span>KKM</span>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step="0.5"
                              value={draftVal}
                              onChange={(e) =>
                                setSubjectKkmDraft((prev) => ({
                                  ...prev,
                                  [subj]: e.target.value,
                                }))
                              }
                              className={`w-15 px-1.5 py-1 text-xs font-bold text-center rounded-lg border tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                                isCustom
                                  ? 'bg-amber-50 border-amber-300 text-amber-800'
                                  : 'bg-white border-slate-300 text-slate-800'
                              }`}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingSubj(subj);
                              setEditingSubjVal(subj);
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-theme-heading hover:bg-theme-soft transition-colors"
                            title="Ubah nama mapel"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget({ kind: 'subject', name: subj })}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Hapus mapel"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {subjects.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={handleResetSubjectKkm}
                disabled={busyAction === 'reset-subj-kkm'}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl disabled:opacity-50"
              >
                {busyAction === 'reset-subj-kkm' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5" />
                )}
                <span>Samakan ke Default ({config.kkm})</span>
              </button>

              <button
                type="button"
                onClick={handleSaveSubjectKkmAll}
                disabled={busyAction === 'save-subj-kkm'}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl disabled:opacity-50"
              >
                {busyAction === 'save-subj-kkm' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>Simpan KKM Mapel</span>
              </button>
            </div>
          )}
        </section>

        {/* Components Management */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  Komponen Nilai per Mapel ({components.length})
                </h2>
                <p className="text-xs text-slate-500">
                  Contoh: Tugas, UH, PTS, PAS. Nilai akhir otomatis dirata-rata.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleAddComponent} className="flex gap-2">
            <input
              type="text"
              value={newComponent}
              onChange={(e) => setNewComponent(e.target.value)}
              placeholder="Tambah komponen nilai (misal: Praktik)..."
              className="flex-1 px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={busyAction === 'add-comp' || !newComponent.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-theme-primary rounded-xl disabled:opacity-50 shrink-0"
            >
              {busyAction === 'add-comp' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              <span>Tambah</span>
            </button>
          </form>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {components.length === 0 ? (
              <p className="p-4 text-xs text-slate-500 text-center">Belum ada komponen nilai.</p>
            ) : (
              components.map((comp, idx) => (
                <div
                  key={comp}
                  className="px-3.5 py-2.5 flex items-center justify-between gap-2 hover:bg-slate-50"
                >
                  {editingComp === comp ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="text"
                        value={editingCompVal}
                        onChange={(e) => setEditingCompVal(e.target.value)}
                        className="flex-1 px-2.5 py-1 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => void handleSaveRenameComponent(comp)}
                        disabled={busyAction === `ren-comp-${comp}`}
                        className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingComp(null)}
                        className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-xs font-bold text-slate-400 w-5 tabular-nums">
                          {idx + 1}.
                        </span>
                        <span className="text-sm font-medium text-slate-800 truncate">{comp}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingComp(comp);
                            setEditingCompVal(comp);
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-theme-heading hover:bg-theme-soft transition-colors"
                          title="Ubah nama komponen"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget({ kind: 'component', name: comp })}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Hapus komponen"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title={
          deleteTarget?.kind === 'subject'
            ? 'Hapus Mata Pelajaran?'
            : 'Hapus Komponen Penilaian?'
        }
        message={
          deleteTarget?.kind === 'subject'
            ? `Mata pelajaran "${deleteTarget.name}" dan nilainya pada seluruh siswa akan dihapus permanen.`
            : `Komponen "${deleteTarget?.name || ''}" pada semua mata pelajaran akan dihapus dan nilai akhir dihitung ulang.`
        }
        confirmLabel="Ya, Hapus"
        loading={Boolean(busyAction?.startsWith('del-'))}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};
