import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Download,
  Edit3,
  GraduationCap,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Printer,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Table2,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { fetchTeacherData, saveTeacherScores } from '../services/api';
import {
  AuthSession,
  GradeVisibilityConfig,
  SchoolConfig,
  SignatureDisplayMode,
  StudentRecord,
} from '../types';
import {
  buildStudentsCsv,
  buildSubjectDetailCsv,
  calculateStudentMetrics,
  computeSubjectFinalScore,
  downloadTextFile,
  formatGenderLabel,
  getSubjectKkm,
  normalizeGender,
  resolvePortalBranding,
  resolveSignatureMode,
} from '../utils/helpers';
import { DocumentSignatureBlock } from './DocumentSignatureBlock';
import { OfficialLetterhead } from './OfficialLetterhead';
import { SchoolLogo } from './SchoolLogo';
import { StudentPhoto } from './StudentPhoto';

interface TeacherWorkspaceProps {
  session: AuthSession;
  config: SchoolConfig;
  subjects: string[];
  components: string[];
  students: StudentRecord[];
  onDataUpdated: (payload: {
    session?: AuthSession;
    config?: SchoolConfig;
    subjects?: string[];
    components?: string[];
    visibility?: GradeVisibilityConfig;
    students?: StudentRecord[];
  }) => void;
  onLogout: () => void;
  onToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

type TeacherMenuKey = 'dashboard' | 'grades' | 'students';

export const TeacherWorkspace: React.FC<TeacherWorkspaceProps> = ({
  session,
  config,
  subjects,
  components,
  students,
  onDataUpdated,
  onLogout,
  onToast,
}) => {
  const [activeMenu, setActiveMenu] = useState<TeacherMenuKey>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Scoped subjects & classes for this teacher
  const teacherSubjects = useMemo(() => {
    const assigned = session.assignedSubjects || [];
    if (assigned.length === 0) return subjects;
    const filtered = subjects.filter((s) => assigned.includes(s));
    return filtered.length > 0 ? filtered : subjects;
  }, [subjects, session.assignedSubjects]);

  const teacherClasses = useMemo(() => {
    const assigned = session.assignedClasses || [];
    if (assigned.length > 0) {
      return [...assigned].sort((a, b) => a.localeCompare(b, 'id', { numeric: true }));
    }
    const set = new Set<string>();
    students.forEach((s) => {
      if (s.kelas) set.add(s.kelas);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'id', { numeric: true }));
  }, [students, session.assignedClasses]);

  const scopedStudents = useMemo(() => {
    const assigned = session.assignedClasses || [];
    if (assigned.length === 0) return students;
    const clsSet = new Set(assigned);
    return students.filter((s) => clsSet.has(s.kelas));
  }, [students, session.assignedClasses]);

  // Grade editor states
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('ALL');
  const [activeSubjectTab, setActiveSubjectTab] = useState<string>('ALL');
  const [editMode, setEditMode] = useState(false);
  const [draftScores, setDraftScores] = useState<Record<string, Record<string, number>>>({});
  const [draftDetails, setDraftDetails] = useState<
    Record<string, Record<string, Record<string, number>>>
  >({});
  const [dirtyNis, setDirtyNis] = useState<Set<string>>(new Set());
  const [savingScores, setSavingScores] = useState(false);
  const [printSignMode, setPrintSignMode] = useState<'default' | SignatureDisplayMode>('default');

  const portalBrand = resolvePortalBranding(config);
  const effectiveSignMode =
    printSignMode === 'default' ? resolveSignatureMode(config) : printSignMode;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetchTeacherData(session, true);
      onDataUpdated({
        session: res.session,
        config: res.config,
        subjects: res.subjects,
        components: res.components,
        visibility: res.visibility,
        students: res.students,
      });
      onToast('success', 'Data guru & nilai siswa berhasil disegarkan.');
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Gagal memuat data guru.');
    } finally {
      setRefreshing(false);
    }
  };

  // Teacher dashboard analytics
  const analytics = useMemo(() => {
    const totalStudents = scopedStudents.length;
    if (totalStudents === 0 || teacherSubjects.length === 0) {
      return {
        avgAll: 0,
        passStudentCount: 0,
        remedialEntries: [] as Array<{
          student: StudentRecord;
          subject: string;
          score: number;
          kkm: number;
        }>,
        subjectStats: teacherSubjects.map((s) => ({
          subject: s,
          kkm: getSubjectKkm(config, s),
          avg: 0,
          passCount: 0,
        })),
      };
    }

    let sumAvg = 0;
    let passStudentCount = 0;
    const subjTotals: Record<string, number> = {};
    const subjPass: Record<string, number> = {};
    teacherSubjects.forEach((s) => {
      subjTotals[s] = 0;
      subjPass[s] = 0;
    });

    const remedialEntries: Array<{
      student: StudentRecord;
      subject: string;
      score: number;
      kkm: number;
    }> = [];

    for (const st of scopedStudents) {
      const m = calculateStudentMetrics(st, teacherSubjects, config);
      sumAvg += m.average;
      if (m.allPassed) passStudentCount++;

      for (const s of teacherSubjects) {
        const val = Number(st.scores?.[s] ?? 0);
        const kkm = getSubjectKkm(config, s);
        subjTotals[s] += val;
        if (val >= kkm) {
          subjPass[s]++;
        } else {
          remedialEntries.push({ student: st, subject: s, score: val, kkm });
        }
      }
    }

    remedialEntries.sort((a, b) => a.score - b.score);

    return {
      avgAll: sumAvg / totalStudents,
      passStudentCount,
      remedialEntries,
      subjectStats: teacherSubjects.map((s) => ({
        subject: s,
        kkm: getSubjectKkm(config, s),
        avg: subjTotals[s] / totalStudents,
        passCount: subjPass[s],
      })),
    };
  }, [scopedStudents, teacherSubjects, config]);

  const filteredTableStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scopedStudents.filter((st) => {
      if (classFilter !== 'ALL' && st.kelas !== classFilter) return false;
      if (!q) return true;
      return (
        st.nama.toLowerCase().includes(q) ||
        st.nis.toLowerCase().includes(q) ||
        st.kelas.toLowerCase().includes(q)
      );
    });
  }, [scopedStudents, search, classFilter]);

  const getEffectiveScore = (st: StudentRecord, subj: string): number => {
    if (draftScores[st.nis]?.[subj] !== undefined) return draftScores[st.nis][subj];
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

    const nextFinal = computeSubjectFinalScore(baseSubjDetails, getEffectiveScore(st, subj));

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

  const handleSaveScores = async () => {
    if (dirtyNis.size === 0) return;
    setSavingScores(true);
    try {
      const updates = Array.from(dirtyNis).map((nis) => ({
        nis,
        scores: draftScores[nis],
        scoreDetails: draftDetails[nis],
      }));
      const res = await saveTeacherScores(session, updates);
      const refreshed = await fetchTeacherData(session, true);
      onDataUpdated({ students: refreshed.students });
      handleResetEdits();
      setEditMode(false);
      onToast('success', res.message || 'Nilai siswa berhasil disimpan.');
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Gagal menyimpan nilai.');
    } finally {
      setSavingScores(false);
    }
  };

  const handleExportCsv = () => {
    const dateTag = new Date().toISOString().slice(0, 10);
    if (activeSubjectTab === 'ALL') {
      const csv = buildStudentsCsv(filteredTableStudents, teacherSubjects, true, config);
      downloadTextFile(csv, `nilai_guru_${dateTag}.csv`);
      onToast('success', 'Rekap nilai mapel diampu berhasil diekspor.');
    } else {
      const csv = buildSubjectDetailCsv(
        filteredTableStudents,
        activeSubjectTab,
        components,
        getSubjectKkm(config, activeSubjectTab)
      );
      const slug = activeSubjectTab.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      downloadTextFile(csv, `nilai_${slug}_${dateTag}.csv`);
      onToast('success', `Nilai komponen ${activeSubjectTab} berhasil diekspor.`);
    }
  };

  const navItems: Array<{
    key: TeacherMenuKey;
    label: string;
    desc: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      key: 'dashboard',
      label: 'Dashboard Guru',
      desc: 'Ringkasan mapel & siswa remidi',
      icon: LayoutDashboard,
    },
    {
      key: 'grades',
      label: 'Input & Leger Nilai',
      desc: `${teacherSubjects.length} mapel diampu`,
      icon: Table2,
    },
    {
      key: 'students',
      label: 'Siswa Diampu',
      desc: `${scopedStudents.length} peserta didik`,
      icon: Users,
    },
  ];

  const renderSidebar = (isMobile = false) => (
    <div className="flex flex-col h-full bg-theme-gradient text-white">
      <div className="p-5 border-b border-white/15 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <SchoolLogo
            logoUrl={portalBrand.logoUrl}
            schoolName={portalBrand.title}
            sizeClass="w-10 h-10"
            className="bg-white border-white/40 shadow-sm"
          />
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-white truncate">{portalBrand.title}</p>
            <p className="text-[11px] text-white/75 truncate">
              Portal Guru · {session.displayName || session.username}
            </p>
          </div>
        </div>
        {isMobile && (
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/15"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 p-3.5 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeMenu === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setActiveMenu(item.key);
                if (isMobile) setMobileMenuOpen(false);
              }}
              className={`w-full text-left flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all ${
                active
                  ? 'bg-white text-theme-heading shadow-sm font-bold'
                  : 'text-white/85 hover:text-white hover:bg-white/15 font-medium'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-theme-heading' : 'text-white/80'}`} />
              <div className="min-w-0">
                <p className="text-sm leading-tight truncate">{item.label}</p>
                <p
                  className={`text-[10px] mt-0.5 truncate ${
                    active ? 'text-slate-500 font-normal' : 'text-white/65'
                  }`}
                >
                  {item.desc}
                </p>
              </div>
            </button>
          );
        })}
      </nav>

      <div className="p-3.5 border-t border-white/15">
        <button
          type="button"
          onClick={onLogout}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-white/15 hover:bg-white/25 text-white border border-white/20 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Keluar dari Guru</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-theme-page flex">
      <aside className="no-print hidden lg:block w-68 shrink-0 sticky top-0 h-screen shadow-lg">
        {renderSidebar(false)}
      </aside>

      {mobileMenuOpen && (
        <div className="no-print fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 w-72 max-w-[85vw] h-full shadow-2xl">
            {renderSidebar(true)}
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="no-print sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-sm border-b border-theme-soft px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto h-full flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2 text-xs sm:text-sm min-w-0">
                <span className="text-slate-400 font-medium hidden sm:inline">Portal Guru</span>
                <span className="text-slate-300 hidden sm:inline">/</span>
                <span className="font-bold text-theme-heading truncate">
                  {navItems.find((n) => n.key === activeMenu)?.label}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Muat Ulang</span>
              </button>
              <button
                type="button"
                onClick={onLogout}
                className="lg:hidden inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl"
              >
                <LogOut className="w-4 h-4" />
                <span>Keluar</span>
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {activeMenu === 'dashboard' && (
            <div className="space-y-6">
              {/* Teacher Welcome Banner */}
              <section className="bg-theme-gradient text-white rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-white/80 uppercase tracking-wider">
                    Dashboard Guru Pengampu
                  </p>
                  <h1 className="text-xl sm:text-2xl font-extrabold">
                    Selamat Datang, {session.displayName || session.username}
                  </h1>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/85">
                    {session.nip && <span>NIP: {session.nip}</span>}
                    <span>Mapel: {teacherSubjects.join(', ') || '-'}</span>
                    <span>
                      Kelas:{' '}
                      {(session.assignedClasses || []).length > 0
                        ? session.assignedClasses!.join(', ')
                        : 'Semua Kelas'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveMenu('grades');
                    setEditMode(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold bg-white text-theme-heading rounded-xl shadow-sm hover:bg-slate-50 shrink-0 self-start sm:self-center"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>Input Nilai Sekarang</span>
                </button>
              </section>

              {/* 4 Teacher KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-theme-gradient text-white flex items-center justify-center shrink-0">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Siswa Diampu
                    </p>
                    <p className="text-2xl font-extrabold text-slate-900 tabular-nums">
                      {scopedStudents.length}
                    </p>
                    <p className="text-[11px] text-slate-500">{teacherClasses.length} Rombel</p>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center shrink-0">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Mapel Diampu
                    </p>
                    <p className="text-2xl font-extrabold text-slate-900 tabular-nums">
                      {teacherSubjects.length}
                    </p>
                    <p className="text-[11px] text-slate-500">KKM menyesuaikan mapel</p>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Rata-Rata Mapel
                    </p>
                    <p className="text-2xl font-extrabold text-slate-900 tabular-nums">
                      {analytics.avgAll.toFixed(2)}
                    </p>
                    <p className="text-[11px] text-emerald-700 font-semibold">
                      {analytics.passStudentCount} siswa tuntas semua
                    </p>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-2xl text-white flex items-center justify-center shrink-0 ${
                      analytics.remedialEntries.length === 0 ? 'bg-teal-600' : 'bg-rose-600'
                    }`}
                  >
                    <GraduationCap className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Perlu Remidi
                    </p>
                    <p className="text-2xl font-extrabold text-slate-900 tabular-nums">
                      {analytics.remedialEntries.length}
                    </p>
                    <p className="text-[11px] text-slate-500">Nilai di bawah KKM</p>
                  </div>
                </div>
              </div>

              {/* Per-Subject KKM Bars + Remedial Students Table */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <section className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Capaian Mapel yang Diampu
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Garis vertikal menunjukkan batas KKM per mapel.
                    </p>
                  </div>
                  <div className="space-y-3.5">
                    {analytics.subjectStats.map((item) => {
                      const passed = item.avg >= item.kkm;
                      return (
                        <div key={item.subject} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-800 truncate pr-2">
                              {item.subject}{' '}
                              <span className="font-mono text-slate-400">(KKM {item.kkm})</span>
                            </span>
                            <span
                              className={`font-extrabold tabular-nums ${
                                passed ? 'text-theme-heading' : 'text-rose-600'
                              }`}
                            >
                              {item.avg.toFixed(1)} · {item.passCount}/{scopedStudents.length} tuntas
                            </span>
                          </div>
                          <div className="relative h-3 rounded-full bg-slate-100 border border-slate-200/70 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.max(0, Math.min(100, item.avg))}%`,
                                backgroundImage: passed
                                  ? 'linear-gradient(90deg, var(--theme-grad-from), var(--theme-primary), #0EA5E9)'
                                  : 'linear-gradient(90deg, #F59E0B, #EF4444)',
                              }}
                            />
                            <div
                              className="absolute top-0 bottom-0 w-0.5 bg-slate-800/80"
                              style={{ left: `${Math.min(100, Math.max(0, item.kkm))}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col">
                  <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
                    <div>
                      <h2 className="text-base font-bold text-slate-900">
                        Daftar Siswa Perlu Remidi
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Siswa dengan nilai di bawah KKM pada mata pelajaran yang Anda ampu.
                      </p>
                    </div>
                  </div>
                  {analytics.remedialEntries.length === 0 ? (
                    <div className="p-8 text-center text-sm text-emerald-700 font-medium flex flex-col items-center gap-2">
                      <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                      <span>Seluruh siswa telah tuntas KKM pada mapel yang Anda ampu.</span>
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-80">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 sticky top-0">
                          <tr>
                            <th className="py-2.5 px-4">Siswa</th>
                            <th className="py-2.5 px-4">Kelas</th>
                            <th className="py-2.5 px-4">Mapel</th>
                            <th className="py-2.5 px-4 text-center">Nilai / KKM</th>
                            <th className="py-2.5 px-4 text-right">Tindakan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {analytics.remedialEntries.slice(0, 40).map((entry) => (
                            <tr
                              key={`${entry.student.nis}-${entry.subject}`}
                              className="hover:bg-slate-50"
                            >
                              <td className="py-2.5 px-4 font-bold text-slate-900">
                                {entry.student.nama}
                              </td>
                              <td className="py-2.5 px-4 text-slate-600">
                                {entry.student.kelas || '-'}
                              </td>
                              <td className="py-2.5 px-4 text-slate-700">{entry.subject}</td>
                              <td className="py-2.5 px-4 text-center font-mono font-bold text-rose-700 tabular-nums">
                                {entry.score} / {entry.kkm}
                              </td>
                              <td className="py-2.5 px-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveSubjectTab(entry.subject);
                                    setSearch(entry.student.nis);
                                    setEditMode(true);
                                    setActiveMenu('grades');
                                  }}
                                  className="inline-flex items-center gap-1 text-theme-heading font-semibold hover:underline"
                                >
                                  <span>Perbaiki</span>
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>
            </div>
          )}

          {activeMenu === 'grades' && (
            <div className="space-y-5">
              <div className="no-print flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                    Input & Leger Nilai Guru
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    Edit nilai akhir atau rincian komponen khusus mata pelajaran & kelas yang Anda
                    ampu.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <Download className="w-4 h-4" />
                    <span>Ekspor CSV</span>
                  </button>
                  <select
                    value={printSignMode}
                    onChange={(e) =>
                      setPrintSignMode(e.target.value as 'default' | SignatureDisplayMode)
                    }
                    className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl"
                    title="Pilihan tanda tangan saat mencetak"
                  >
                    <option value="default">TTD: Ikut Sekolah</option>
                    <option value="both">TTD: Kepsek &amp; Guru</option>
                    <option value="teacher">TTD: Guru Saja</option>
                    <option value="headmaster">TTD: Kepsek Saja</option>
                    <option value="none">Tanpa TTD</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Cetak</span>
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
                        <span>Batal</span>
                      </button>
                      <button
                        type="button"
                        disabled={savingScores || dirtyNis.size === 0}
                        onClick={handleSaveScores}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl disabled:opacity-50"
                      >
                        {savingScores ? (
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
                      <span>Edit Nilai</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="no-print bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Cari nama atau NIS siswa..."
                      className="w-full pl-9 pr-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl"
                    />
                  </div>
                  <select
                    value={classFilter}
                    onChange={(e) => setClassFilter(e.target.value)}
                    className="px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl"
                  >
                    <option value="ALL">Semua Kelas Diampu ({scopedStudents.length})</option>
                    {teacherClasses.map((cls) => (
                      <option key={cls} value={cls}>
                        Kelas {cls}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveSubjectTab('ALL')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap ${
                      activeSubjectTab === 'ALL'
                        ? 'bg-theme-primary text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Semua Mapel Diampu
                  </button>
                  {teacherSubjects.map((subj) => (
                    <button
                      key={subj}
                      type="button"
                      onClick={() => setActiveSubjectTab(subj)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap ${
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

              {config.showKopSurat && (
                <div className="hidden print:block mb-4">
                  <OfficialLetterhead
                    config={config}
                    documentTitle={
                      activeSubjectTab === 'ALL'
                        ? 'Daftar Nilai Siswa (Guru Pengampu)'
                        : `Daftar Nilai ${activeSubjectTab}`
                    }
                    documentMeta={`Guru: ${session.displayName || session.username}`}
                    compact
                  />
                </div>
              )}

              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  {activeSubjectTab === 'ALL' ? (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                          <th className="py-3 px-3 w-10 text-center">No</th>
                          <th className="py-3 px-3 min-w-[180px]">Nama Siswa</th>
                          <th className="py-3 px-3 text-center">JK</th>
                          <th className="py-3 px-3">Kelas</th>
                          {teacherSubjects.map((subj) => (
                            <th key={subj} className="py-3 px-2.5 text-center min-w-[85px]">
                              <div>{subj}</div>
                              <div className="text-[9px] font-mono font-normal text-slate-400 normal-case">
                                KKM {getSubjectKkm(config, subj)}
                              </div>
                            </th>
                          ))}
                          <th className="py-3 px-3 text-center bg-slate-100">Rata-Rata</th>
                          <th className="py-3 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredTableStudents.map((st, idx) => {
                          const previewSt: StudentRecord = draftScores[st.nis]
                            ? { ...st, scores: draftScores[st.nis] }
                            : st;
                          const metrics = calculateStudentMetrics(
                            previewSt,
                            teacherSubjects,
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
                              <td className="py-2.5 px-3 text-slate-700">{st.kelas || '-'}</td>
                              {teacherSubjects.map((subj) => {
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
                                        className="w-14 px-1.5 py-1 text-center font-bold bg-white border border-slate-300 rounded-lg"
                                      />
                                    ) : (
                                      <span
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
                          {components.map((comp) => (
                            <th key={comp} className="py-3 px-3 text-center min-w-[80px]">
                              {comp}
                            </th>
                          ))}
                          <th className="py-3 px-3 text-center bg-slate-100">
                            Nilai Akhir (KKM {getSubjectKkm(config, activeSubjectTab)})
                          </th>
                          <th className="py-3 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredTableStudents.map((st, idx) => {
                          const finalVal = getEffectiveScore(st, activeSubjectTab);
                          const subjKkm = getSubjectKkm(config, activeSubjectTab);
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
                              <td className="py-2.5 px-3 text-slate-700">{st.kelas || '-'}</td>
                              {components.map((comp) => {
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
                                        className="w-16 px-1.5 py-1 text-center font-bold bg-white border border-slate-300 rounded-lg"
                                      />
                                    ) : (
                                      <span
                                        className={
                                          cVal !== undefined && cVal < subjKkm
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
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                                    finalVal >= subjKkm
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-rose-100 text-rose-800'
                                  }`}
                                >
                                  {finalVal >= subjKkm ? (
                                    'Tuntas'
                                  ) : (
                                    <>
                                      <AlertTriangle className="w-3 h-3" />
                                      <span>Remidi</span>
                                    </>
                                  )}
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

              {effectiveSignMode !== 'none' && (
                <div className="hidden print:block mt-6">
                  <DocumentSignatureBlock
                    config={config}
                    modeOverride={effectiveSignMode}
                    teacherTitleOverride={config.teacherSignTitle || 'Guru Pengampu'}
                    teacherNameOverride={session.displayName || config.teacherSignName}
                    teacherNipOverride={session.nip || config.teacherSignNip}
                    compact
                  />
                </div>
              )}
            </div>
          )}

          {activeMenu === 'students' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                    Daftar Siswa Diampu
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    Menampilkan biodata siswa pada kelas yang Anda ampu ({scopedStudents.length}{' '}
                    siswa).
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Cari nama / NIS..."
                      className="pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-xl"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                        <th className="py-3 px-4">Siswa</th>
                        <th className="py-3 px-4">NIS / NISN</th>
                        <th className="py-3 px-4">JK</th>
                        <th className="py-3 px-4">Kelas</th>
                        <th className="py-3 px-4">Email</th>
                        <th className="py-3 px-4 text-center">Rata-Rata Mapel Anda</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {filteredTableStudents.map((st) => {
                        const m = calculateStudentMetrics(st, teacherSubjects, config);
                        return (
                          <tr key={st.nis} className="hover:bg-slate-50/80">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <StudentPhoto
                                  photoUrl={st.photoUrl}
                                  studentName={st.nama}
                                  gender={st.jenisKelamin}
                                  sizeClass="w-9 h-9"
                                  roundedClass="rounded-xl"
                                />
                                <span className="font-bold text-slate-900">{st.nama}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 font-mono text-xs text-slate-600">
                              {st.nis} / {st.nisn}
                            </td>
                            <td className="py-3 px-4 text-xs font-semibold text-slate-700">
                              {formatGenderLabel(st.jenisKelamin)}
                            </td>
                            <td className="py-3 px-4 text-xs text-slate-700">{st.kelas || '-'}</td>
                            <td className="py-3 px-4 text-xs text-slate-600">{st.email || '-'}</td>
                            <td className="py-3 px-4 text-center tabular-nums">
                              <span
                                className={`inline-flex px-2.5 py-0.5 rounded-lg text-xs font-extrabold ${
                                  m.allPassed
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-rose-50 text-rose-700'
                                }`}
                              >
                                {m.average.toFixed(1)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
