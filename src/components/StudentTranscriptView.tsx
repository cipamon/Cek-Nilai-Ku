import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  BookOpen,
  CheckCircle2,
  Maximize2,
  Printer,
  RefreshCw,
  TrendingUp,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react';
import { GradeVisibilityConfig, SchoolConfig, StudentRecord } from '../types';
import {
  calculateStudentMetrics,
  formatGenderLabel,
  getPredicate,
  getSubjectKkm,
  getVisibleStudentView,
  resolveSignatureMode,
} from '../utils/helpers';
import { DocumentSignatureBlock } from './DocumentSignatureBlock';
import { OfficialLetterhead } from './OfficialLetterhead';
import { StudentPhoto } from './StudentPhoto';

interface StudentTranscriptViewProps {
  student: StudentRecord;
  subjects: string[];
  components: string[];
  config: SchoolConfig;
  visibility?: GradeVisibilityConfig;
  refreshing?: boolean;
  onRefresh: () => void;
}

export const StudentTranscriptView: React.FC<StudentTranscriptViewProps> = ({
  student,
  subjects,
  components,
  config,
  visibility,
  refreshing = false,
  onRefresh,
}) => {
  const [photoPreviewOpen, setPhotoPreviewOpen] = useState(false);

  const {
    student: visibleStudent,
    activeSubjects,
    activeComponents,
    isSubjectFiltered,
    isComponentFiltered,
  } = useMemo(
    () => getVisibleStudentView(student, subjects, components, visibility),
    [student, subjects, components, visibility]
  );

  const metrics = useMemo(
    () => calculateStudentMetrics(visibleStudent, activeSubjects, config),
    [visibleStudent, activeSubjects, config]
  );

  const topStudentSubjects = useMemo(() => {
    return activeSubjects
      .map((subj) => ({
        subject: subj,
        score: Number(visibleStudent.scores?.[subj] ?? 0),
        kkm: getSubjectKkm(config, subj),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }, [activeSubjects, visibleStudent, config]);

  const showDetails =
    (visibility?.showComponentDetails ?? true) && activeComponents.length > 0;
  const showSummary = visibility?.showAverageAndStatus ?? true;
  const showPhotoInPrint = visibility?.showStudentPhoto ?? true;
  const showPrintButton = visibility?.showPrintButton ?? true;
  const showKopSurat = config.showKopSurat ?? true;
  const signatureMode = resolveSignatureMode(config);
  const isSuspended = student.status === 'DITANGGUHKAN';
  const isNotPassed = !isSuspended && activeSubjects.length > 0 && !metrics.allPassed;
  const effectiveStatus = isSuspended
    ? 'DITANGGUHKAN'
    : isNotPassed
      ? 'TIDAK LULUS'
      : student.status || 'LULUS';

  const passRate =
    activeSubjects.length > 0
      ? Math.round((metrics.passedCount / activeSubjects.length) * 100)
      : 0;

  const getScoreBarStyle = (score: number, subjKkm: number): React.CSSProperties => {
    const pct = Math.max(0, Math.min(100, score));
    if (score >= 90) {
      return {
        width: `${pct}%`,
        backgroundImage: 'linear-gradient(90deg, #10B981 0%, #059669 60%, #047857 100%)',
      };
    }
    if (score >= subjKkm) {
      return {
        width: `${pct}%`,
        backgroundImage:
          'linear-gradient(90deg, var(--theme-grad-from) 0%, var(--theme-primary) 55%, #0EA5E9 100%)',
      };
    }
    return {
      width: `${pct}%`,
      backgroundImage: 'linear-gradient(90deg, #EF4444 0%, #F97316 100%)',
    };
  };

  const getPredicateColor = (pred: 'A' | 'B' | 'C' | 'D') => {
    if (pred === 'A') return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (pred === 'B') return 'text-sky-700 bg-sky-50 border-sky-200';
    if (pred === 'C') return 'text-amber-700 bg-amber-50 border-amber-200';
    return 'text-rose-700 bg-rose-50 border-rose-200';
  };

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Top Action Header */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            Dashboard Siswa & Transkrip Nilai
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Ringkasan capaian belajar, batas KKM per mapel, dan transkrip resmi peserta didik.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Muat Ulang</span>
          </button>

          {showPrintButton && (
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-theme-primary rounded-xl transition-colors shadow-sm"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak / PDF</span>
            </button>
          )}
        </div>
      </div>

      {/* Suspended Notice */}
      {isSuspended && (
        <div className="no-print bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-sm font-bold text-amber-900">
              Status Kelulusan / Nilai Ditangguhkan
            </h2>
            <p className="text-xs sm:text-sm text-amber-800 mt-0.5">
              Silakan menghubungi wali kelas atau bagian tata usaha sekolah untuk informasi
              administrasi lebih lanjut.
            </p>
          </div>
        </div>
      )}

      {/* Filter Indicator */}
      {(isSubjectFiltered || isComponentFiltered) && (
        <div className="no-print bg-theme-soft border border-theme-soft rounded-2xl px-4 py-3 text-xs sm:text-sm text-theme-heading font-medium">
          Menampilkan <strong>{activeSubjects.length}</strong> mata pelajaran
          {showDetails ? ` dan ${activeComponents.length} komponen penilaian` : ''} sesuai
          pengaturan sekolah.
        </div>
      )}

      {/* Optional Official Kop Surat (Standalone clean document header when enabled) */}
      {showKopSurat && (
        <section className="bg-white border border-slate-200 rounded-2xl px-5 sm:px-8 py-5 print:border-none print:rounded-none print:px-0 print:py-2">
          <OfficialLetterhead
            config={config}
            documentTitle="Transkrip Hasil Belajar Siswa"
            documentMeta={`KKM Default: ${config.kkm}`}
          />
        </section>
      )}

      {/* Standalone Student Biodata Card with Prominent Portrait Photo */}
      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden print:border-slate-300 print:rounded-lg">
        <div className="bg-theme-gradient px-6 py-4 text-white flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-white/85 font-medium">
              <span>Kelas {student.kelas || '-'}</span>
              {student.noAbsen && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Absen {student.noAbsen}</span>
                </>
              )}
              {student.jenisKelamin && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{formatGenderLabel(student.jenisKelamin)}</span>
                </>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight mt-0.5 truncate">
              {student.nama}
            </h2>
          </div>

          <div className="shrink-0">
            <span
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-sm ${
                isSuspended
                  ? 'bg-amber-400 text-slate-950'
                  : isNotPassed
                    ? 'bg-rose-500 text-white'
                    : 'bg-emerald-400 text-slate-950'
              }`}
            >
              {isSuspended ? (
                <AlertTriangle className="w-3.5 h-3.5" />
              ) : isNotPassed ? (
                <XCircle className="w-3.5 h-3.5" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              <span>Status: {effectiveStatus}</span>
            </span>
          </div>
        </div>

        <div className="p-5 sm:p-6 flex flex-col sm:flex-row items-center sm:items-stretch gap-5 sm:gap-6">
          <div
            className={`flex flex-col items-center gap-1.5 shrink-0 ${
              !showPhotoInPrint ? 'print:hidden' : ''
            }`}
          >
            <button
              type="button"
              onClick={() => setPhotoPreviewOpen(true)}
              className="group relative p-1 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500"
              title="Klik untuk memperbesar foto siswa"
            >
              <StudentPhoto
                photoUrl={student.photoUrl}
                studentName={student.nama}
                gender={student.jenisKelamin}
                sizeClass="w-24 h-32 sm:w-28 sm:h-36"
                roundedClass="rounded-xl"
                textSizeClass="text-2xl"
              />
              <span className="no-print absolute bottom-2 right-2 p-1 rounded-lg bg-slate-900/70 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                <Maximize2 className="w-3.5 h-3.5" />
              </span>
            </button>
            <span className="no-print text-[11px] font-medium text-slate-500">
              {student.photoUrl ? 'Foto Siswa' : 'Foto Profil'}
            </span>
          </div>

          <div className="flex-1 w-full grid grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-4 text-xs content-center">
            <div>
              <p className="text-slate-400 font-medium">NIS</p>
              <p className="text-sm font-bold text-slate-900 font-mono mt-0.5 tabular-nums">
                {student.nis}
              </p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">NISN</p>
              <p className="text-sm font-bold text-slate-900 font-mono mt-0.5 tabular-nums">
                {student.nisn || '-'}
              </p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Jenis Kelamin</p>
              <p className="text-sm font-bold text-slate-900 mt-0.5">
                {formatGenderLabel(student.jenisKelamin)}
              </p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Kelas / No. Absen</p>
              <p className="text-sm font-bold text-slate-900 mt-0.5">
                {student.kelas || '-'}
                {student.noAbsen ? ` (Absen ${student.noAbsen})` : ''}
              </p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Tempat, Tgl Lahir</p>
              <p className="text-sm font-bold text-slate-900 mt-0.5 truncate" title={student.ttl}>
                {student.ttl || '-'}
              </p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Email Siswa</p>
              <p
                className="text-sm font-bold text-slate-900 mt-0.5 truncate"
                title={student.email || '-'}
              >
                {student.email || '-'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Standalone 4-Column KPI Summary Strip */}
      {showSummary && (
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-theme-gradient text-white flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 font-medium">Rata-Rata Nilai</p>
              <p className="text-xl sm:text-2xl font-extrabold text-slate-900 tabular-nums">
                {metrics.average.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 font-medium">Total Nilai</p>
              <p className="text-xl sm:text-2xl font-extrabold text-slate-900 tabular-nums">
                {metrics.total.toFixed(1)}
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 font-medium">Mapel Tuntas ({passRate}%)</p>
              <p className="text-xl sm:text-2xl font-extrabold text-slate-900 tabular-nums">
                {metrics.passedCount} / {activeSubjects.length}
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex items-center gap-3.5">
            <div
              className={`w-11 h-11 rounded-xl text-white flex items-center justify-center shrink-0 ${
                metrics.allPassed ? 'bg-teal-600' : 'bg-rose-600'
              }`}
            >
              <UserCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 font-medium">Ketuntasan KKM Mapel</p>
              <p
                className={`text-base sm:text-lg font-extrabold mt-0.5 ${
                  metrics.allPassed ? 'text-teal-700' : 'text-rose-700'
                }`}
              >
                {metrics.allPassed
                  ? 'Tuntas Semua'
                  : `${metrics.remedialSubjects.length} Remidi`}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Student Dashboard: KKM Target & Top Subject Highlights (screen-only) */}
      {showSummary && activeSubjects.length > 0 && (
        <section className="no-print grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                {metrics.allPassed
                  ? 'Target KKM Tercapai Sempurna'
                  : `Perhatian: ${metrics.remedialSubjects.length} Mapel di Bawah KKM`}
              </h3>
              <span className="text-xs font-semibold text-slate-500 tabular-nums">
                {passRate}% Tuntas
              </span>
            </div>
            {metrics.allPassed ? (
              <p className="text-xs sm:text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                Selamat! Seluruh nilai mata pelajaran Anda telah memenuhi standar KKM masing-masing
                mapel.
              </p>
            ) : (
              <div className="space-y-2">
                {metrics.remedialSubjects.slice(0, 4).map((item) => (
                  <div
                    key={item.subject}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-xs"
                  >
                    <span className="font-semibold text-rose-900 truncate">{item.subject}</span>
                    <span className="font-mono font-bold text-rose-700 shrink-0 tabular-nums">
                      Nilai {item.score} / KKM {item.kkm} (Kurang{' '}
                      {Math.max(0, Number((item.kkm - item.score).toFixed(1)))})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Capaian Tertinggi Anda</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {topStudentSubjects.map((item, i) => (
                <div
                  key={item.subject}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200"
                >
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    Terbaik #{i + 1}
                  </p>
                  <p className="text-xs font-bold text-slate-900 truncate mt-0.5">
                    {item.subject}
                  </p>
                  <p className="text-lg font-extrabold text-theme-heading tabular-nums mt-1">
                    {item.score}
                  </p>
                  <p className="text-[10px] text-slate-500 tabular-nums">KKM {item.kkm}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Standalone Grades Table Card */}
      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden print:border-slate-300 print:rounded-lg">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              Daftar Nilai Mata Pelajaran
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Evaluasi ketuntasan disesuaikan dengan KKM masing-masing mata pelajaran.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-600">
            <span className="text-emerald-700 font-semibold">≥90 Sangat Baik</span>
            <span className="text-slate-300">·</span>
            <span className="text-theme-heading font-semibold">≥KKM Tuntas</span>
            <span className="text-slate-300">·</span>
            <span className="text-rose-700 font-semibold">&lt;KKM Remidi</span>
          </div>
        </div>

        {activeSubjects.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">
            Belum ada mata pelajaran yang ditampilkan.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4 w-12 text-center">No</th>
                  <th className="py-3 px-4">Mata Pelajaran</th>
                  <th className="py-3 px-4 text-center w-18">KKM</th>
                  <th className="py-3 px-4 text-center w-24">Nilai</th>
                  <th className="py-3 px-4 text-center w-20">Predikat</th>
                  <th className="py-3 px-4 min-w-[200px]">Capaian terhadap KKM</th>
                  <th className="py-3 px-4 text-center w-28">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {activeSubjects.map((subj, idx) => {
                  const score = Number(visibleStudent.scores?.[subj] ?? 0);
                  const subjKkm = getSubjectKkm(config, subj);
                  const compMap = visibleStudent.scoreDetails?.[subj];
                  const pred = getPredicate(score, subjKkm);
                  const passed = score >= subjKkm;
                  const hasZero = score <= 0;

                  return (
                    <tr
                      key={subj}
                      className={`transition-colors print-break-inside-avoid ${
                        !passed ? 'bg-rose-50/35 hover:bg-rose-50/60' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="py-3.5 px-4 text-center text-xs font-semibold text-slate-400 tabular-nums align-top">
                        {idx + 1}
                      </td>

                      <td className="py-3.5 px-4 align-top">
                        <p className="font-semibold text-slate-900">{subj}</p>
                        {showDetails && (
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-slate-600 tabular-nums">
                            {activeComponents.map((comp) => {
                              const val = compMap?.[comp];
                              return (
                                <span key={comp}>
                                  <span className="text-slate-400">{comp}:</span>{' '}
                                  <strong
                                    className={
                                      val === undefined
                                        ? 'text-slate-400 font-normal'
                                        : val < subjKkm
                                          ? 'text-rose-600'
                                          : 'text-slate-800'
                                    }
                                  >
                                    {val !== undefined ? val : '-'}
                                  </strong>
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center align-top font-mono text-xs font-bold text-slate-600 tabular-nums">
                        {subjKkm}
                      </td>

                      <td className="py-3.5 px-4 text-center align-top">
                        <span
                          className={`text-base font-extrabold tabular-nums ${
                            score >= 90
                              ? 'text-emerald-700'
                              : passed
                                ? 'text-theme-heading'
                                : 'text-rose-700'
                          }`}
                        >
                          {score}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center align-top">
                        <span
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-lg border text-xs font-bold ${getPredicateColor(
                            pred
                          )}`}
                        >
                          {pred}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 align-middle">
                        <div className="flex items-center gap-2.5">
                          <div className="relative flex-1 h-3 rounded-full overflow-hidden bg-slate-200/90 border border-slate-300/60">
                            {!hasZero && (
                              <div
                                className="h-full rounded-full transition-all duration-300"
                                style={getScoreBarStyle(score, subjKkm)}
                              />
                            )}
                            <div
                              className="absolute top-0 bottom-0 w-0.5 bg-slate-800/80"
                              style={{ left: `${Math.min(100, Math.max(0, subjKkm))}%` }}
                              title={`Batas KKM ${subj}: ${subjKkm}`}
                            />
                          </div>
                          <span
                            className={`text-xs font-bold tabular-nums w-10 text-right shrink-0 ${
                              score >= 90
                                ? 'text-emerald-700'
                                : passed
                                  ? 'text-theme-heading'
                                  : 'text-rose-700'
                            }`}
                          >
                            {Math.round(score)}%
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-center align-top">
                        {passed ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Tuntas</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Remidi</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Optional Signature Block (Kepala Sekolah, Guru, Dua-duanya, atau Tidak Ditampilkan) */}
      {signatureMode !== 'none' && (
        <section className="bg-white border border-slate-200 rounded-2xl px-6 py-5 print:border-none print:rounded-none print:px-0 print:py-2 print-break-inside-avoid">
          <DocumentSignatureBlock config={config} modeOverride={signatureMode} />
        </section>
      )}

      {/* Photo Preview Modal */}
      {photoPreviewOpen && (
        <div
          className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-xs"
          onClick={() => setPhotoPreviewOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900 truncate">{student.nama}</h3>
                <p className="text-xs text-slate-500">
                  NIS {student.nis} · Kelas {student.kelas || '-'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPhotoPreviewOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 flex flex-col items-center gap-3 bg-slate-50">
              <StudentPhoto
                photoUrl={student.photoUrl}
                studentName={student.nama}
                gender={student.jenisKelamin}
                sizeClass="w-56 h-72"
                roundedClass="rounded-2xl"
                textSizeClass="text-4xl"
                className="shadow-md border-4 border-white"
              />
              <p className="text-xs text-slate-500 text-center">
                {student.photoUrl
                  ? 'Foto Resmi Peserta Didik'
                  : student.jenisKelamin
                    ? `Foto ilustrasi default (${formatGenderLabel(student.jenisKelamin)})`
                    : 'Belum ada foto yang diunggah'}
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
