import React, { useMemo, useState } from 'react';
import { Award, CheckCircle2, ShieldCheck, TrendingUp, Users } from 'lucide-react';
import { PortalUser, SchoolConfig, StudentRecord } from '../../types';
import { calculateStudentMetrics, formatGenderLabel, getSubjectKkm } from '../../utils/helpers';
import { StudentPhoto } from '../StudentPhoto';

interface DashboardAnalyticsProps {
  students: StudentRecord[];
  subjects: string[];
  config: SchoolConfig;
  users?: PortalUser[];
}

export const DashboardAnalytics: React.FC<DashboardAnalyticsProps> = ({
  students,
  subjects,
  config,
  users = [],
}) => {
  const [selectedClass, setSelectedClass] = useState<string>('ALL');

  const classList = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      if (s.kelas) set.add(s.kelas);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'id', { numeric: true }));
  }, [students]);

  const filteredStudents = useMemo(() => {
    if (selectedClass === 'ALL') return students;
    return students.filter((s) => s.kelas === selectedClass);
  }, [students, selectedClass]);

  const userCounts = useMemo(() => {
    const guru = users.filter((u) => u.role === 'guru' && u.active).length;
    const admin = users.filter((u) => u.role === 'admin' && u.active).length + 1;
    return { guru, admin };
  }, [users]);

  const customKkmCount = useMemo(
    () =>
      subjects.filter(
        (s) => config.subjectKkm?.[s] !== undefined && config.subjectKkm[s] !== config.kkm
      ).length,
    [subjects, config]
  );

  const summary = useMemo(() => {
    if (filteredStudents.length === 0) {
      return {
        totalStudents: 0,
        maleCount: 0,
        femaleCount: 0,
        schoolAvg: 0,
        allPassedCount: 0,
        passRate: 0,
        subjectAverages: subjects.map((s) => ({
          subject: s,
          avg: 0,
          passCount: 0,
          kkm: getSubjectKkm(config, s),
        })),
        topStudents: [] as Array<{
          student: StudentRecord;
          avg: number;
          passedCount: number;
        }>,
      };
    }

    let sumAvg = 0;
    let allPassedCount = 0;
    let maleCount = 0;
    let femaleCount = 0;

    const subjTotals: Record<string, number> = {};
    const subjPass: Record<string, number> = {};
    subjects.forEach((s) => {
      subjTotals[s] = 0;
      subjPass[s] = 0;
    });

    const ranked: Array<{ student: StudentRecord; avg: number; passedCount: number }> = [];

    for (const st of filteredStudents) {
      if (st.jenisKelamin === 'L') maleCount++;
      else if (st.jenisKelamin === 'P') femaleCount++;

      const metrics = calculateStudentMetrics(st, subjects, config);
      sumAvg += metrics.average;
      if (metrics.allPassed) allPassedCount++;

      ranked.push({
        student: st,
        avg: metrics.average,
        passedCount: metrics.passedCount,
      });

      for (const s of subjects) {
        const val = Number(st.scores?.[s] ?? 0);
        const subjKkm = getSubjectKkm(config, s);
        subjTotals[s] += val;
        if (val >= subjKkm) subjPass[s]++;
      }
    }

    ranked.sort((a, b) => b.avg - a.avg);

    const subjectAverages = subjects.map((s) => ({
      subject: s,
      avg: subjTotals[s] / filteredStudents.length,
      passCount: subjPass[s],
      kkm: getSubjectKkm(config, s),
    }));

    return {
      totalStudents: filteredStudents.length,
      maleCount,
      femaleCount,
      schoolAvg: sumAvg / filteredStudents.length,
      allPassedCount,
      passRate: Math.round((allPassedCount / filteredStudents.length) * 100),
      subjectAverages,
      topStudents: ranked.slice(0, 5),
    };
  }, [filteredStudents, subjects, config]);

  const getRankBadge = (idx: number) => {
    if (idx === 0) return 'bg-amber-400 text-amber-950 border-amber-500';
    if (idx === 1) return 'bg-slate-200 text-slate-800 border-slate-300';
    if (idx === 2) return 'bg-orange-200 text-orange-900 border-orange-300';
    return 'bg-theme-soft text-theme-heading border-theme-soft';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            Dashboard Admin · Ringkasan Akademik
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Pantau siswa, pengguna aktif, ketuntasan KKM per mapel (default {config.kkm}), dan
            rata-rata capaian sekolah.
          </p>
        </div>

        <select
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          className="px-3.5 py-2 text-sm font-semibold bg-white border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="ALL">Semua Kelas ({students.length})</option>
          {classList.map((cls) => (
            <option key={cls} value={cls}>
              Kelas {cls}
            </option>
          ))}
        </select>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-theme-gradient text-white flex items-center justify-center shrink-0 shadow-sm">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Total Siswa
            </p>
            <p className="text-2xl font-extrabold text-slate-900 tabular-nums">
              {summary.totalStudents}
            </p>
            {(summary.maleCount > 0 || summary.femaleCount > 0) && (
              <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                {summary.maleCount} L · {summary.femaleCount} P · {classList.length} Rombel
              </p>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Rata-Rata Nilai
            </p>
            <p className="text-2xl font-extrabold text-slate-900 tabular-nums">
              {summary.schoolAvg.toFixed(2)}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Dari {subjects.length} mapel ({customKkmCount} KKM khusus)
            </p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Tuntas Semua Mapel
            </p>
            <p className="text-2xl font-extrabold text-emerald-700 tabular-nums">
              {summary.allPassedCount}
            </p>
            <p className="text-[11px] text-emerald-600 font-semibold mt-0.5 tabular-nums">
              {summary.passRate}% Ketuntasan
            </p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Pengguna Aktif
            </p>
            <p className="text-2xl font-extrabold text-slate-900 tabular-nums">
              {userCounts.guru + userCounts.admin}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
              {userCounts.guru} Guru · {userCounts.admin} Admin
            </p>
          </div>
        </div>
      </div>

      {/* Main Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Subject Bars */}
        <section className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Rata-Rata Capaian per Mata Pelajaran
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Garis vertikal menunjukkan batas KKM masing-masing mata pelajaran.
            </p>
          </div>

          {summary.subjectAverages.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">Belum ada mata pelajaran.</p>
          ) : (
            <div className="space-y-3.5">
              {summary.subjectAverages.map((item) => {
                const passed = item.avg >= item.kkm;
                const pct = Math.max(0, Math.min(100, item.avg));
                return (
                  <div key={item.subject} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <span className="font-semibold text-slate-800 truncate">
                          {item.subject}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400 shrink-0 tabular-nums">
                          (KKM {item.kkm})
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 tabular-nums">
                        <span className="text-xs text-slate-500">
                          {item.passCount}/{summary.totalStudents} tuntas
                        </span>
                        <span
                          className={`font-extrabold ${
                            item.avg >= 90
                              ? 'text-emerald-700'
                              : passed
                                ? 'text-theme-heading'
                                : 'text-rose-600'
                          }`}
                        >
                          {item.avg.toFixed(1)}
                        </span>
                      </div>
                    </div>
                    <div className="relative h-3 rounded-full bg-slate-100 border border-slate-200/70 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${pct}%`,
                          backgroundImage:
                            item.avg >= 90
                              ? 'linear-gradient(90deg, #10B981, #059669, #0D9488)'
                              : passed
                                ? 'linear-gradient(90deg, var(--theme-grad-from), var(--theme-primary), #0EA5E9)'
                                : 'linear-gradient(90deg, #F59E0B, #F97316, #EF4444)',
                        }}
                      />
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-slate-800/75"
                        style={{ left: `${Math.min(100, Math.max(0, item.kkm))}%` }}
                        title={`KKM ${item.subject}: ${item.kkm}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Top Performers */}
        <section className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            <div>
              <h2 className="text-base font-bold text-slate-900">Peringkat Tertinggi</h2>
              <p className="text-xs text-slate-500">5 siswa dengan rata-rata nilai terbaik.</p>
            </div>
          </div>

          {summary.topStudents.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">Belum ada data siswa.</p>
          ) : (
            <div className="space-y-2.5">
              {summary.topStudents.map((item, idx) => (
                <div
                  key={item.student.nis}
                  className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-6 h-6 rounded-lg border text-xs font-extrabold flex items-center justify-center shrink-0 tabular-nums ${getRankBadge(
                        idx
                      )}`}
                    >
                      {idx + 1}
                    </span>
                    <StudentPhoto
                      photoUrl={item.student.photoUrl}
                      studentName={item.student.nama}
                      gender={item.student.jenisKelamin}
                      sizeClass="w-9 h-9"
                      roundedClass="rounded-lg"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">
                        {item.student.nama}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {item.student.kelas || '-'}
                        {item.student.jenisKelamin
                          ? ` · ${formatGenderLabel(item.student.jenisKelamin)}`
                          : ''}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-sm font-extrabold text-theme-heading tabular-nums">
                      {item.avg.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-slate-500 tabular-nums">
                      {item.passedCount}/{subjects.length} tuntas
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
