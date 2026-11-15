import React, { useState } from 'react';
import { Loader2, X } from 'lucide-react';

interface UserBulkEditModalProps {
  open: boolean;
  selectedCount: number;
  hasGuruSelected: boolean;
  subjects: string[];
  classes: string[];
  onClose: () => void;
  onApply: (changes: {
    active?: boolean;
    assignedSubjects?: string[];
    assignedClasses?: string[];
  }) => Promise<void>;
}

export const UserBulkEditModal: React.FC<UserBulkEditModalProps> = ({
  open,
  selectedCount,
  hasGuruSelected,
  subjects,
  classes,
  onClose,
  onApply,
}) => {
  const [updateActive, setUpdateActive] = useState(false);
  const [active, setActive] = useState(true);
  const [updateSubjects, setUpdateSubjects] = useState(false);
  const [assignedSubjects, setAssignedSubjects] = useState<string[]>([]);
  const [updateClasses, setUpdateClasses] = useState(false);
  const [assignedClasses, setAssignedClasses] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const toggleItem = (list: string[], setList: (v: string[]) => void, item: string) => {
    if (list.includes(item)) setList(list.filter((x) => x !== item));
    else setList([...list, item]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: {
      active?: boolean;
      assignedSubjects?: string[];
      assignedClasses?: string[];
    } = {};

    if (updateActive) payload.active = active;
    if (hasGuruSelected && updateSubjects) payload.assignedSubjects = assignedSubjects;
    if (hasGuruSelected && updateClasses) payload.assignedClasses = assignedClasses;

    if (
      payload.active === undefined &&
      payload.assignedSubjects === undefined &&
      payload.assignedClasses === undefined
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
      <div className="w-full max-w-xl max-h-[90vh] bg-white rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Edit Masal Akun Pengguna</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Mengubah {selectedCount} akun pengguna terpilih sekaligus.
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

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2.5">
            <label className="flex items-center gap-2.5 text-sm font-semibold text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={updateActive}
                onChange={(e) => setUpdateActive(e.target.checked)}
                className="rounded border-slate-300 text-theme-primary"
              />
              <span>Ubah Status Akun (Aktif / Nonaktif)</span>
            </label>
            {updateActive && (
              <select
                value={active ? 'true' : 'false'}
                onChange={(e) => setActive(e.target.value === 'true')}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl"
              >
                <option value="true">Aktif (Boleh Login)</option>
                <option value="false">Nonaktif (Ditangguhkan)</option>
              </select>
            )}
          </div>

          {hasGuruSelected && (
            <>
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2.5 text-sm font-semibold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={updateSubjects}
                      onChange={(e) => setUpdateSubjects(e.target.checked)}
                      className="rounded border-slate-300 text-theme-primary"
                    />
                    <span>Ubah Mapel Diampu (Khusus Guru)</span>
                  </label>
                  {updateSubjects && subjects.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setAssignedSubjects(
                          assignedSubjects.length === subjects.length ? [] : [...subjects]
                        )
                      }
                      className="text-xs font-semibold text-theme-heading hover:underline"
                    >
                      {assignedSubjects.length === subjects.length ? 'Kosongkan' : 'Pilih Semua'}
                    </button>
                  )}
                </div>
                {updateSubjects && (
                  <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2.5 bg-white rounded-xl border border-slate-200">
                    {subjects.map((subj) => (
                      <label key={subj} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={assignedSubjects.includes(subj)}
                          onChange={() => toggleItem(assignedSubjects, setAssignedSubjects, subj)}
                          className="rounded border-slate-300 text-theme-primary"
                        />
                        <span className="truncate text-slate-800">{subj}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2.5 text-sm font-semibold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={updateClasses}
                      onChange={(e) => setUpdateClasses(e.target.checked)}
                      className="rounded border-slate-300 text-theme-primary"
                    />
                    <span>Ubah Kelas Diampu (Khusus Guru)</span>
                  </label>
                  {updateClasses && classes.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setAssignedClasses(
                          assignedClasses.length === classes.length ? [] : [...classes]
                        )
                      }
                      className="text-xs font-semibold text-theme-heading hover:underline"
                    >
                      {assignedClasses.length === classes.length ? 'Kosongkan' : 'Pilih Semua'}
                    </button>
                  )}
                </div>
                {updateClasses && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-32 overflow-y-auto p-2.5 bg-white rounded-xl border border-slate-200">
                    {classes.length === 0 ? (
                      <p className="text-xs text-slate-500 col-span-2">Belum ada data kelas.</p>
                    ) : (
                      classes.map((cls) => (
                        <label key={cls} className="flex items-center gap-2 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={assignedClasses.includes(cls)}
                            onChange={() => toggleItem(assignedClasses, setAssignedClasses, cls)}
                            className="rounded border-slate-300 text-theme-primary"
                          />
                          <span className="truncate text-slate-800">{cls}</span>
                        </label>
                      ))
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving || (!updateActive && !updateSubjects && !updateClasses)}
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
