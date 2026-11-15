import React, { useMemo, useState } from 'react';
import {
  Download,
  Edit3,
  Loader2,
  Printer,
  RotateCcw,
  Save,
  Search,
  Upload,
} from 'lucide-react';
import { GradeVisibilityConfig, SchoolConfig, StudentRecord } from '../../types';
import {
  buildStudentsCsv,
  buildSubjectDetailCsv,
  calculateStudentMetrics,
  computeSubjectFinalScore,
  downloadTextFile,
  getSubjectKkm,
  normalizeGender,
  resolveSignatureMode,
  resolveVisibleGrades,
} from '../../utils/helpers';
import { DocumentSignatureBlock } from '../DocumentSignatureBlock';
import { OfficialLetterhead } from '../OfficialLetterhead';
import { CsvImportModal } from './CsvImportModal';

interface LegerViewProps {
  students: StudentRecord[];
  subjects: string[];
  components: string[];
  config: SchoolConfig;
  visibility: GradeVisibilityConfig;
  onBulkUpdateScores: (
    updates: Array<{
      nis: string;
      scores?: Record<string, number>;
      scoreDetails?: Record<string, Record<string, number>>;
    }>
  ) => Promise<void>;
  onImportCsv: (
    students: StudentRecord[],
    subjectsFromCsv: string[],
    mode: 'upsert' | 'skip',
    componentsFromCsv: string[]
  ) => Promise<void>;
  onToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const LegerView: React.FC<LegerViewProps> = ({
  students,
  subjects,
  components,
  config,
  visibility,
  onBulkUpdateScores,
  onImportCsv,
  onToast,
}) => {
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('ALL');
  const [activeSubjectTab, setActiveSubjectTab] = useState<string>('ALL');
  const [editMode, setEditMode] = useState(false);

  const [draftScores, setDraftScores] = useState<Record<string, Record<string, number>>>({});
  const [draftDetails, setDraftDetails] = useState<
    Record<string, Record<string, Record<string, number>>>
  >({});
  const [dirtyNis, setDirtyNis] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);

  const applyFilterToAdmin = visibility.applyToAdminViews;
  const resolved = useMemo(
    () =>
      applyFilterToAdmin
        ? resolveVisibleGrades(subjects, components, visibility)
        : { activeSubjects: subjects, activeComponents: components },
    [applyFilterToAdmin, subjects, components, visibility]
  );

  const displayedSubjects = resolved.activeSubjects;
  const displayedComponents = resolved.activeComponents;

  const showKopSurat = config.showKopSurat ?? true;
  const signatureMode = resolveSignatureMode(config);

  const classList = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      if (s.kelas) set.add(s.kelas);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'id', { numeric: true }));
  }, [students]);

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((st) => {
      if (classFilter !== 'ALL' && st.kelas !== classFilter) return false;
      if (!q) return true;
      return (
        st.nama.toLowerCase().includes(q) ||
        st.nis.toLowerCase().includes(q) ||
        st.kelas.toLowerCase().includes(q)
      );
    });
  }, [students, search, classFilter]);

  const getEffectiveScore = (st: StudentRecord, subj: string): number => {
    if (draftScores[st.nis] && draftScores[st.nis][subj] !== undefined) {
      return draftScores[st.nis][subj];
    }
    return Number(st.scores?.[subj] ?? 0);
  };

  const getEffectiveComponent = (
    st: StudentRecord,
    subj: string,
    comp: string
  ): number | undefined => {
    if (draftDetails[st.nis]?.[subj]?.[comp] !== undefined) {
      return draftDetails[st.nis][subj][comp];
    }
    return st.scoreDetails?.[subj]?.[comp];
  };

  const handleSummaryCellChange = (st: StudentRecord, subj: string, rawVal: string) => {
    const num = rawVal.trim() === '' ? 0 : Number(rawVal);
    if (isNaN(num)) return;
    const clamped = Math.max(0, Math.min(100, num));

    setDraftScores((prev) => ({
      ...prev,
      [st.nis]: { ...(prev[st.nis] || st.scores), [subj]: clamped },
    }));
    setDirtyNis((prev) => new Set(prev).add(st.nis));
  };

  const handleComponentCellChange = (
    st: StudentRecord,
    subj: string,
    comp: string,
    rawVal: string
  ) => {
    const baseSubjDetails = {
      ...(st.scoreDetails?.[subj] || {}),
      ...(draftDetails[st.nis]?.[subj] || {}),
    };

    if (rawVal.trim() === '') {
      delete baseSubjDetails[comp];
    } else {
      const parsed = Number(rawVal);
      if (isNaN(parsed)) return;
      baseSubjDetails[comp] = Math.max(0, Math.min(100, parsed));
    }

    const nextFinal = computeSubjectFinalScore(
      baseSubjDetails,
      getEffectiveScore(st, subj)
    );

    setDraftDetails((prev) => ({
      ...prev,
      [st.nis]: {
        ...(prev[st.nis] || st.scoreDetails || {}),
        [subj]: baseSubjDetails,
      },
    }));
    setDraftScores((prev) => ({
      ...prev,
      [st.nis]: { ...(prev[st.nis] || st.scores), [subj]: nextFinal },
    }));
    setDirtyNis((prev) => new Set(prev).add(st.nis));
  };

  const handleResetEdits = () => {
    setDraftScores({});
    setDraftDetails({});
    setDirtyNis(new Set());
  };

  const handleSaveAllEdits = async () => {
    if (dirtyNis.size === 0) return;
    setSaving(true);
    try {
      const updates = Array.from(dirtyNis).map((nis) => ({
        nis,
        scores: draftScores[nis],
        scoreDetails: draftDetails[nis],
      }));
      await onBulkUpdateScores(updates);
      handleResetEdits();
      setEditMode(false);
    } finally {
      setSaving(false);
    }
  };

  const handleExportCsv = () => {
    const dateTag = new Date().toISOString().slice(0, 10);
    if (activeSubjectTab === 'ALL') {
      const csv = buildStudentsCsv(filteredStudents, displayedSubjects, true, config);
      downloadTextFile(csv, `leger_nilai_${dateTag}.csv`);
      onToast('success', 'Leger ringkas berhasil diekspor ke CSV.');
    } else {
      const csv = buildSubjectDetailCsv(
        filteredStudents,
        activeSubjectTab,
        displayedComponents,
        getSubjectKkm(config, activeSubjectTab)
      );
      const slug = activeSubjectTab.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      downloadTextFile(csv, `leger_${slug}_${dateTag}.csv`);
      onToast('success', `Leger komponen ${activeSubjectTab} berhasil diekspor.`);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header Actions */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Leger Nilai Siswa</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Lihat, edit langsung nilai mapel maupun rincian komponen per siswa, atau cetak leger.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setImportModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl"
          >
            <Upload className="w-4 h-4" />
            <span>Impor CSV</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl"
          >
            <Download className="w-4 h-4" />
            <span>Ekspor CSV</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Leger</span>
          </button>

          {editMode ? (
            <>
              <button
                type="button"
                onClick={() => {
                  handleResetEdits();
                  setEditMode(false);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Batal Edit</span>
              </button>
              <button
                type="button"
                disabled={saving || dirtyNis.size === 0}
                onClick={handleSaveAllEdits}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>Simpan ({dirtyNis.size})</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setEditMode(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-theme-primary rounded-xl shadow-sm"
            >
              <Edit3 className="w-4 h-4" />
              <span>Edit Leger</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters & Mode Tabs */}
      <div className="no-print bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama atau NIS..."
              className="w-full pl-9 pr-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-700"
          >
            <option value="ALL">Semua Kelas ({students.length})</option>
            {classList.map((cls) => (
              <option key={cls} value={cls}>
                Kelas {cls}
              </option>
            ))}
          </select>
        </div>

        {/* Subject Tabs for Multi-Nilai Detail Editing */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
          <button
            type="button"
            onClick={() => setActiveSubjectTab('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
              activeSubjectTab === 'ALL'
                ? 'bg-theme-primary text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua Mapel (Ringkas)
          </button>
          {displayedSubjects.map((subj) => (
            <button
              key={subj}
              type="button"
              onClick={() => setActiveSubjectTab(subj)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                activeSubjectTab === subj
                  ? 'bg-theme-primary text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {subj}
            </button>
          ))}
        </div>
      </div>

      {/* Printable Letterhead */}
      {showKopSurat && (
        <div className="hidden print:block mb-4">
          <OfficialLetterhead
            config={config}
            documentTitle={
              activeSubjectTab === 'ALL'
                ? 'Leger Nilai Akademik Siswa'
                : `Daftar Nilai Komponen - ${activeSubjectTab}`
            }
            documentMeta={`Kelas: ${classFilter === 'ALL' ? 'Semua' : classFilter} · KKM: ${
              activeSubjectTab === 'ALL'
                ? `${config.kkm} (per mapel)`
                : getSubjectKkm(config, activeSubjectTab)
            }`}
            compact
          />
        </div>
      )}

      {/* Leger Spreadsheet Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden print:border-slate-300 print:rounded-none">
        <div className="overflow-x-auto">
          {activeSubjectTab === 'ALL' ? (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <th className="py-3 px-3 w-10 text-center">No</th>
                  <th className="py-3 px-3 min-w-[180px]">Nama Siswa</th>
                  <th className="py-3 px-3 text-center">JK</th>
                  <th className="py-3 px-3">Kelas</th>
                  {displayedSubjects.map((subj) => (
                    <th key={subj} className="py-3 px-2.5 text-center min-w-[85px]">
                      <div>{subj}</div>
                      <div className="text-[9px] font-mono font-normal text-slate-400 normal-case">
                        KKM {getSubjectKkm(config, subj)}
                      </div>
                    </th>
                  ))}
                  <th className="py-3 px-3 text-center bg-slate-100">Jumlah</th>
                  <th className="py-3 px-3 text-center bg-slate-100">Rata-Rata</th>
                  <th className="py-3 px-3 text-center">Ketuntasan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((st, idx) => {
                  const previewStudent: StudentRecord = draftScores[st.nis]
                    ? { ...st, scores: draftScores[st.nis] }
                    : st;
                  const metrics = calculateStudentMetrics(
                    previewStudent,
                    displayedSubjects,
                    config
                  );
                  const isDirty = dirtyNis.has(st.nis);

                  return (
                    <tr
                      key={st.nis}
                      className={`hover:bg-slate-50 ${isDirty ? 'bg-amber-50/50' : ''}`}
                    >
                      <td className="py-2.5 px-3 text-center text-slate-400 tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3">
                        <p className="font-bold text-slate-900">{st.nama}</p>
                        <p className="text-[10px] font-mono text-slate-500">{st.nis}</p>
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-600">
                        {normalizeGender(st.jenisKelamin) || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                        {st.kelas || '-'}
                      </td>
                      {displayedSubjects.map((subj) => {
                        const val = getEffectiveScore(st, subj);
                        const subjKkm = getSubjectKkm(config, subj);
                        const hasComp =
                          Boolean(st.scoreDetails?.[subj]) &&
                          Object.keys(st.scoreDetails?.[subj] || {}).length > 0;
                        return (
                          <td key={subj} className="py-2 px-2 text-center tabular-nums">
                            {editMode && !hasComp ? (
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step="0.01"
                                value={val}
                                onChange={(e) =>
                                  handleSummaryCellChange(st, subj, e.target.value)
                                }
                                className="w-14 px-1.5 py-1 text-center font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                            ) : (
                              <span
                                title={
                                  editMode && hasComp
                                    ? 'Klik tab mapel di atas untuk mengedit komponen nilai'
                                    : undefined
                                }
                                className={`font-bold ${
                                  val < subjKkm ? 'text-rose-600' : 'text-slate-800'
                                }`}
                              >
                                {val}
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className="py-2.5 px-3 text-center font-bold bg-slate-50 tabular-nums">
                        {metrics.total.toFixed(1)}
                      </td>
                      <td className="py-2.5 px-3 text-center font-extrabold text-theme-heading bg-slate-50 tabular-nums">
                        {metrics.average.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold ${
                            metrics.allPassed
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {metrics.allPassed
                            ? 'Tuntas'
                            : `Remidi (${metrics.remedialSubjects.length})`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <th className="py-3 px-3 w-10 text-center">No</th>
                  <th className="py-3 px-3 min-w-[180px]">Nama Siswa</th>
                  <th className="py-3 px-3 text-center">JK</th>
                  <th className="py-3 px-3">Kelas</th>
                  {displayedComponents.map((comp) => (
                    <th key={comp} className="py-3 px-3 text-center min-w-[84px]">
                      {comp}
                    </th>
                  ))}
                  <th className="py-3 px-3 text-center bg-slate-100">Nilai Akhir</th>
                  <th className="py-3 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((st, idx) => {
                  const finalVal = getEffectiveScore(st, activeSubjectTab);
                  const activeSubjKkm = getSubjectKkm(config, activeSubjectTab);
                  const isDirty = dirtyNis.has(st.nis);

                  return (
                    <tr
                      key={st.nis}
                      className={`hover:bg-slate-50 ${isDirty ? 'bg-amber-50/50' : ''}`}
                    >
                      <td className="py-2.5 px-3 text-center text-slate-400 tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3">
                        <p className="font-bold text-slate-900">{st.nama}</p>
                        <p className="text-[10px] font-mono text-slate-500">{st.nis}</p>
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-600">
                        {normalizeGender(st.jenisKelamin) || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                        {st.kelas || '-'}
                      </td>
                      {displayedComponents.map((comp) => {
                        const cVal = getEffectiveComponent(st, activeSubjectTab, comp);
                        return (
                          <td key={comp} className="py-2 px-2 text-center tabular-nums">
                            {editMode ? (
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step="0.01"
                                value={cVal ?? ''}
                                placeholder="-"
                                onChange={(e) =>
                                  handleComponentCellChange(
                                    st,
                                    activeSubjectTab,
                                    comp,
                                    e.target.value
                                  )
                                }
                                className="w-16 px-1.5 py-1 text-center font-bold bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                            ) : (
                              <span
                                className={
                                  cVal !== undefined && cVal < activeSubjKkm
                                    ? 'font-bold text-rose-600'
                                    : 'font-semibold text-slate-800'
                                }
                              >
                                {cVal !== undefined ? cVal : '-'}
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className="py-2.5 px-3 text-center font-extrabold text-theme-heading bg-slate-50 tabular-nums">
                        {finalVal}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold ${
                            finalVal >= activeSubjKkm
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {finalVal >= activeSubjKkm ? 'Tuntas' : 'Remidi'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Printable Signature Block */}
      {signatureMode !== 'none' && (
        <div className="hidden print:block mt-6">
          <DocumentSignatureBlock config={config} modeOverride={signatureMode} compact />
        </div>
      )}

      <CsvImportModal
        open={importModalOpen}
        subjects={subjects}
        components={components}
        onClose={() => setImportModalOpen(false)}
        onImport={onImportCsv}
      />
    </div>
  );
};
