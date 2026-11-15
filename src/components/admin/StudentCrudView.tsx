import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit3,
  Plus,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { GenderCode, SchoolConfig, StudentRecord } from '../../types';
import {
  buildStudentsCsv,
  calculateStudentMetrics,
  downloadTextFile,
  formatGenderLabel,
} from '../../utils/helpers';
import { ConfirmModal } from '../ConfirmModal';
import { StudentPhoto } from '../StudentPhoto';
import { BulkEditModal } from './BulkEditModal';
import { CsvImportModal } from './CsvImportModal';
import { StudentFormModal } from './StudentFormModal';

interface StudentCrudViewProps {
  students: StudentRecord[];
  subjects: string[];
  components: string[];
  config: SchoolConfig;
  onSaveStudent: (
    mode: 'add' | 'edit',
    student: StudentRecord,
    originalNis?: string
  ) => Promise<void>;
  onDeleteStudent: (nis: string) => Promise<void>;
  onBulkUpdateStudents: (
    updates: Array<{
      nis: string;
      kelas?: string;
      status?: string;
      jenisKelamin?: GenderCode;
    }>
  ) => Promise<void>;
  onBulkDeleteStudents: (nisList: string[]) => Promise<void>;
  onImportCsv: (
    students: StudentRecord[],
    subjectsFromCsv: string[],
    mode: 'upsert' | 'skip',
    componentsFromCsv: string[]
  ) => Promise<void>;
  onToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

const PAGE_SIZE = 50;

export const StudentCrudView: React.FC<StudentCrudViewProps> = ({
  students,
  subjects,
  components,
  config,
  onSaveStudent,
  onDeleteStudent,
  onBulkUpdateStudents,
  onBulkDeleteStudents,
  onImportCsv,
  onToast,
}) => {
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('ALL');
  const [genderFilter, setGenderFilter] = useState<'ALL' | 'L' | 'P' | 'NONE'>('ALL');
  const [selectedNis, setSelectedNis] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'add' | 'edit'>('add');
  const [editingStudent, setEditingStudent] = useState<StudentRecord | null>(null);

  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<
    | { kind: 'single'; student: StudentRecord }
    | { kind: 'bulk'; nisList: string[] }
    | null
  >(null);
  const [deleting, setDeleting] = useState(false);

  const classList = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      if (s.kelas) set.add(s.kelas);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'id', { numeric: true }));
  }, [students]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((st) => {
      if (classFilter !== 'ALL' && st.kelas !== classFilter) return false;
      if (genderFilter === 'L' && st.jenisKelamin !== 'L') return false;
      if (genderFilter === 'P' && st.jenisKelamin !== 'P') return false;
      if (genderFilter === 'NONE' && st.jenisKelamin) return false;
      if (!q) return true;
      return (
        st.nama.toLowerCase().includes(q) ||
        st.nis.toLowerCase().includes(q) ||
        st.nisn.toLowerCase().includes(q) ||
        st.kelas.toLowerCase().includes(q) ||
        (st.email || '').toLowerCase().includes(q)
      );
    });
  }, [students, search, classFilter, genderFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, classFilter, genderFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pagedStudents = useMemo(
    () => filtered.slice(pageStart, pageStart + PAGE_SIZE),
    [filtered, pageStart]
  );

  const allVisibleSelected =
    filtered.length > 0 && filtered.every((st) => selectedNis.has(st.nis));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedNis((prev) => {
        const next = new Set(prev);
        filtered.forEach((st) => next.delete(st.nis));
        return next;
      });
    } else {
      setSelectedNis((prev) => {
        const next = new Set(prev);
        filtered.forEach((st) => next.add(st.nis));
        return next;
      });
    }
  };

  const toggleOne = (nis: string) => {
    setSelectedNis((prev) => {
      const next = new Set(prev);
      if (next.has(nis)) next.delete(nis);
      else next.add(nis);
      return next;
    });
  };

  const handleExportSelectedOrFiltered = () => {
    const targetList =
      selectedNis.size > 0
        ? students.filter((s) => selectedNis.has(s.nis))
        : filtered;
    const csv = buildStudentsCsv(targetList, subjects, true, config);
    const dateTag = new Date().toISOString().slice(0, 10);
    downloadTextFile(csv, `data_siswa_${dateTag}.csv`);
    onToast('success', `${targetList.length} data siswa berhasil diekspor ke CSV.`);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.kind === 'single') {
        await onDeleteStudent(deleteTarget.student.nis);
        setSelectedNis((prev) => {
          const next = new Set(prev);
          next.delete(deleteTarget.student.nis);
          return next;
        });
      } else {
        await onBulkDeleteStudents(deleteTarget.nisList);
        setSelectedNis(new Set());
      }
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleApplyBulkEdit = async (changes: {
    kelas?: string;
    status?: string;
    jenisKelamin?: GenderCode;
  }) => {
    const nisList = Array.from(selectedNis);
    await onBulkUpdateStudents(nisList.map((nis) => ({ nis, ...changes })));
    setSelectedNis(new Set());
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Kelola Data Siswa</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Tambah, ubah biodata (Jenis Kelamin, Email & Foto), pilih masal, atau ekspor/impor data
            siswa ({students.length} total).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setImportModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl"
          >
            <Upload className="w-4 h-4" />
            <span>Impor CSV</span>
          </button>

          <button
            type="button"
            onClick={handleExportSelectedOrFiltered}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl"
          >
            <Download className="w-4 h-4" />
            <span>
              {selectedNis.size > 0 ? `Ekspor Terpilih (${selectedNis.size})` : 'Ekspor CSV'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setFormMode('add');
              setEditingStudent(null);
              setFormOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-theme-primary rounded-xl shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Siswa</span>
          </button>
        </div>
      </div>

      {/* Filters & Bulk Actions Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, NIS, NISN, email, atau kelas..."
              className="w-full pl-9 pr-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-700"
          >
            <option value="ALL">Semua Kelas</option>
            {classList.map((cls) => (
              <option key={cls} value={cls}>
                Kelas {cls}
              </option>
            ))}
          </select>

          <select
            value={genderFilter}
            onChange={(e) => setGenderFilter(e.target.value as 'ALL' | 'L' | 'P' | 'NONE')}
            className="px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-700"
          >
            <option value="ALL">Semua Jenis Kelamin</option>
            <option value="L">Laki-laki (L)</option>
            <option value="P">Perempuan (P)</option>
            <option value="NONE">Belum Diisi</option>
          </select>
        </div>

        {selectedNis.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-theme-soft border border-theme-soft">
            <span className="text-xs sm:text-sm font-semibold text-theme-heading inline-flex items-center gap-2">
              <CheckSquare className="w-4 h-4" />
              {selectedNis.size} siswa dipilih
            </span>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setBulkEditOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-theme-heading bg-white border border-theme-soft hover:bg-slate-50 rounded-lg"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Kelas / JK / Status</span>
              </button>

              <button
                type="button"
                onClick={handleExportSelectedOrFiltered}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Ekspor Terpilih</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setDeleteTarget({ kind: 'bulk', nisList: Array.from(selectedNis) })
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Terpilih</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedNis(new Set())}
                className="px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Batal Pilihan
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Students Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                <th className="py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAll}
                    title="Pilih semua siswa yang sesuai filter"
                    className="rounded border-slate-300 text-theme-primary"
                  />
                </th>
                <th className="py-3 px-4">Siswa</th>
                <th className="py-3 px-4">NIS / NISN</th>
                <th className="py-3 px-4 text-center">Jenis Kelamin</th>
                <th className="py-3 px-4">Kelas / Absen</th>
                <th className="py-3 px-4 text-center">Rata-Rata</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {pagedStudents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-sm text-slate-500">
                    Tidak ada siswa yang sesuai dengan pencarian/filter.
                  </td>
                </tr>
              ) : (
                pagedStudents.map((st) => {
                  const checked = selectedNis.has(st.nis);
                  const metrics = calculateStudentMetrics(st, subjects, config);
                  const isSuspended = st.status === 'DITANGGUHKAN';
                  const isBelowKkm = !isSuspended && subjects.length > 0 && !metrics.allPassed;
                  const effectiveStatus = isSuspended
                    ? 'DITANGGUHKAN'
                    : isBelowKkm
                      ? 'BELUM LULUS'
                      : st.status || 'LULUS';
                  return (
                    <tr
                      key={st.nis}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        checked ? 'bg-theme-soft/30' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleOne(st.nis)}
                          className="rounded border-slate-300 text-theme-primary"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <StudentPhoto
                            photoUrl={st.photoUrl}
                            studentName={st.nama}
                            gender={st.jenisKelamin}
                            sizeClass="w-10 h-10"
                            roundedClass="rounded-xl"
                          />
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate max-w-[220px]">
                              {st.nama}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate max-w-[220px]">
                              {st.ttl || '-'}
                            </p>
                            {st.email && (
                              <p
                                className="text-[11px] text-theme-heading truncate max-w-[220px]"
                                title={st.email}
                              >
                                {st.email}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-700">
                        <p className="font-semibold text-slate-900">{st.nis}</p>
                        <p className="text-slate-500">{st.nisn}</p>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold ${
                            st.jenisKelamin === 'L'
                              ? 'bg-sky-100 text-sky-800'
                              : st.jenisKelamin === 'P'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {formatGenderLabel(st.jenisKelamin)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <p className="font-semibold text-slate-900">{st.kelas || '-'}</p>
                        <p className="text-slate-500">Absen: {st.noAbsen || '-'}</p>
                      </td>
                      <td className="py-3 px-4 text-center tabular-nums">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-lg text-xs font-extrabold ${
                            metrics.allPassed
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                          title={
                            metrics.allPassed
                              ? 'Semua mapel tuntas'
                              : `Remidi ${metrics.remedialSubjects.length} mapel`
                          }
                        >
                          {metrics.average.toFixed(1)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-lg text-[11px] font-bold ${
                            isSuspended
                              ? 'bg-amber-100 text-amber-800'
                              : isBelowKkm
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-emerald-100 text-emerald-800'
                          }`}
                          title={
                            isBelowKkm
                              ? `${metrics.remedialSubjects.length} mapel belum mencapai KKM`
                              : undefined
                          }
                        >
                          {effectiveStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setFormMode('edit');
                              setEditingStudent(st);
                              setFormOpen(true);
                            }}
                            className="p-2 rounded-lg text-slate-500 hover:text-theme-heading hover:bg-theme-soft transition-colors"
                            title="Edit siswa & nilai"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget({ kind: 'single', student: st })}
                            className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Hapus siswa"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
            <span>
              Menampilkan{' '}
              <strong>
                {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filtered.length)}
              </strong>{' '}
              dari <strong>{filtered.length}</strong> siswa
            </span>

            {totalPages > 1 && (
              <div className="inline-flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 font-semibold"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Sebelumnya</span>
                </button>
                <span className="px-2 font-semibold tabular-nums">
                  Hal {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 font-semibold"
                >
                  <span>Berikutnya</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <StudentFormModal
        open={formOpen}
        mode={formMode}
        initialStudent={editingStudent}
        subjects={subjects}
        components={components}
        config={config}
        onClose={() => setFormOpen(false)}
        onSave={onSaveStudent}
      />

      <BulkEditModal
        open={bulkEditOpen}
        selectedCount={selectedNis.size}
        onClose={() => setBulkEditOpen(false)}
        onApply={handleApplyBulkEdit}
      />

      <CsvImportModal
        open={importModalOpen}
        subjects={subjects}
        components={components}
        onClose={() => setImportModalOpen(false)}
        onImport={onImportCsv}
      />

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title={
          deleteTarget?.kind === 'bulk'
            ? `Hapus ${deleteTarget.nisList.length} Siswa Terpilih?`
            : 'Hapus Data Siswa?'
        }
        message={
          deleteTarget?.kind === 'bulk'
            ? 'Seluruh data biodata dan nilai siswa yang dipilih akan dihapus permanen.'
            : `Data siswa "${deleteTarget?.student.nama || ''}" (NIS ${
                deleteTarget?.student.nis || ''
              }) akan dihapus permanen.`
        }
        confirmLabel="Ya, Hapus"
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};
