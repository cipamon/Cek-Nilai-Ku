import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
} from 'lucide-react';
import { SchoolConfig, StudentRecord } from '../../types';
import {
  buildStudentsCsv,
  buildSubjectDetailCsv,
  downloadTextFile,
  getSubjectKkm,
  parseStudentsCsvText,
} from '../../utils/helpers';
import { StudentPhoto } from '../StudentPhoto';

interface CsvImportExportProps {
  students: StudentRecord[];
  subjects: string[];
  components: string[];
  config: SchoolConfig;
  onImport: (
    students: StudentRecord[],
    subjectsFromCsv: string[],
    mode: 'upsert' | 'skip',
    componentsFromCsv: string[]
  ) => Promise<void>;
  onToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const CsvImportExport: React.FC<CsvImportExportProps> = ({
  students,
  subjects,
  components,
  config,
  onImport,
  onToast,
}) => {
  const [selectedSubject, setSelectedSubject] = useState<string>(subjects[0] || '');
  const [parsedStudents, setParsedStudents] = useState<StudentRecord[]>([]);
  const [subjectsFromCsv, setSubjectsFromCsv] = useState<string[]>([]);
  const [componentsFromCsv, setComponentsFromCsv] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mode, setMode] = useState<'upsert' | 'skip'>('upsert');
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExportAllCsv = () => {
    const csv = buildStudentsCsv(students, subjects, true, config);
    const dateTag = new Date().toISOString().slice(0, 10);
    downloadTextFile(csv, `leger_nilai_siswa_${dateTag}.csv`);
    onToast('success', `Berhasil mengekspor ${students.length} data siswa ke CSV.`);
  };

  const handleExportSubjectDetailCsv = () => {
    const subj = selectedSubject || subjects[0];
    if (!subj) {
      onToast('error', 'Pilih mata pelajaran terlebih dahulu.');
      return;
    }
    const csv = buildSubjectDetailCsv(
      students,
      subj,
      components,
      getSubjectKkm(config, subj)
    );
    const slug = subj.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    downloadTextFile(csv, `nilai_${slug}_komponen.csv`);
    onToast('success', `Ekspor rincian komponen ${subj} berhasil.`);
  };

  const handleDownloadSimpleTemplate = () => {
    const headers = [
      'NIS',
      'NISN',
      'Nama',
      'Jenis Kelamin',
      'NoAbsen',
      'Kelas',
      'TTL',
      'Email',
      'Status',
      'Foto',
      ...subjects,
    ];
    const row1 = [
      '002401',
      '0081112233',
      'Budi Santoso',
      'L',
      '01',
      'XII IPA 1',
      'Jakarta, 12 Mei 2008',
      'budi.santoso@sekolah.sch.id',
      'LULUS',
      '',
      ...subjects.map(() => '85'),
    ];
    const row2 = [
      '002402',
      '0081112244',
      'Siti Aminah',
      'P',
      '02',
      'XII IPA 1',
      'Bandung, 20 Juni 2008',
      'siti.aminah@sekolah.sch.id',
      'LULUS',
      '',
      ...subjects.map(() => '90'),
    ];
    downloadTextFile(
      '\uFEFF' + [headers.join(','), row1.join(','), row2.join(',')].join('\r\n'),
      'template_siswa_ringkas.csv'
    );
  };

  const handleDownloadMultiTemplate = () => {
    const compList = components.length > 0 ? components : ['Tugas', 'UH', 'PTS', 'PAS'];
    const compCols: string[] = [];
    subjects.forEach((subj) => compList.forEach((c) => compCols.push(`${subj} [${c}]`)));

    const headers = [
      'NIS',
      'NISN',
      'Nama',
      'Jenis Kelamin',
      'NoAbsen',
      'Kelas',
      'TTL',
      'Email',
      'Status',
      'Foto',
      ...compCols,
    ];
    const row1 = [
      '002401',
      '0081112233',
      'Budi Santoso',
      'L',
      '01',
      'XII IPA 1',
      'Jakarta, 12 Mei 2008',
      'budi.santoso@sekolah.sch.id',
      'LULUS',
      '',
      ...compCols.map(() => '86'),
    ];
    const row2 = [
      '002402',
      '0081112244',
      'Siti Aminah',
      'P',
      '02',
      'XII IPA 1',
      'Bandung, 20 Juni 2008',
      'siti.aminah@sekolah.sch.id',
      'LULUS',
      '',
      ...compCols.map(() => '90'),
    ];
    downloadTextFile(
      '\uFEFF' + [headers.join(','), row1.join(','), row2.join(',')].join('\r\n'),
      'template_siswa_multi_nilai.csv'
    );
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setErrorMsg(null);
    try {
      const text = await file.text();
      const res = parseStudentsCsvText(text);
      if (!res.ok) {
        setErrorMsg(res.error);
        setParsedStudents([]);
        return;
      }
      setParsedStudents(res.students);
      setSubjectsFromCsv(res.subjectsFromCsv);
      setComponentsFromCsv(res.componentsFromCsv);
    } catch {
      setErrorMsg('Gagal membaca file CSV.');
      setParsedStudents([]);
    } finally {
      e.target.value = '';
    }
  };

  const handleConfirmImport = async () => {
    if (!parsedStudents.length) return;
    setImporting(true);
    try {
      await onImport(parsedStudents, subjectsFromCsv, mode, componentsFromCsv);
      setParsedStudents([]);
      setFileName('');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
          Ekspor & Impor Data Siswa (CSV)
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Unduh data siswa beserta kolom Jenis Kelamin (L/P), Email, Foto URL, dan nilai, atau impor
          file CSV dari Excel/Spreadsheet.
        </p>
      </div>

      {/* Export Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-theme-soft text-theme-heading flex items-center justify-center shrink-0">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Ekspor Leger & Biodata Lengkap
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Mencakup NIS, NISN, Nama, Jenis Kelamin, Email, Kelas, Status, URL Foto, dan seluruh
                nilai akhir mapel ({students.length} siswa).
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleExportAllCsv}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-theme-primary rounded-xl"
          >
            <Download className="w-4 h-4" />
            <span>Ekspor Semua Data (CSV)</span>
          </button>
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Ekspor Multi-Komponen per Mapel
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Unduh rincian Tugas, UH, PTS, PAS beserta Jenis Kelamin & Foto untuk 1 mata
                pelajaran.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="flex-1 min-w-[160px] px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl"
            >
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleExportSubjectDetailCsv}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-sky-800 bg-sky-100 hover:bg-sky-200 rounded-xl"
            >
              <Download className="w-4 h-4" />
              <span>Ekspor Mapel</span>
            </button>
          </div>
        </section>
      </div>

      {/* Import Card */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Impor Data CSV ke Portal</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Unduh template resmi agar format kolom NIS, NISN, Nama, Jenis Kelamin (L/P), dan
              nilai terbaca otomatis.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadSimpleTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Template Ringkas</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadMultiTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-theme-heading bg-theme-soft rounded-xl"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Template Multi-Nilai</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 border border-dashed border-slate-300">
          <div className="flex items-center gap-3">
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as 'upsert' | 'skip')}
              className="px-3 py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-xl"
            >
              <option value="upsert">Jika NIS sudah ada: Perbarui Data</option>
              <option value="skip">Jika NIS sudah ada: Lewati</option>
            </select>
          </div>

          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-theme-primary rounded-xl"
            >
              <Upload className="w-4 h-4" />
              <span>Pilih File CSV</span>
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs sm:text-sm text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {parsedStudents.length > 0 && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-emerald-700">
                <CheckCircle2 className="w-4 h-4" />
                Pratinjau <strong>{fileName}</strong>: {parsedStudents.length} siswa siap diimpor.
              </span>

              <button
                type="button"
                disabled={importing}
                onClick={handleConfirmImport}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl disabled:opacity-50"
              >
                {importing && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Mulai Impor ({parsedStudents.length} Siswa)</span>
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-72">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">Siswa</th>
                    <th className="py-2.5 px-3">NIS / NISN</th>
                    <th className="py-2.5 px-3 text-center">JK</th>
                    <th className="py-2.5 px-3">Email</th>
                    <th className="py-2.5 px-3">Kelas</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedStudents.slice(0, 60).map((st, idx) => (
                    <tr key={`${st.nis}-${idx}`} className="hover:bg-slate-50">
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <StudentPhoto
                            photoUrl={st.photoUrl}
                            studentName={st.nama}
                            gender={st.jenisKelamin}
                            sizeClass="w-7 h-7"
                            roundedClass="rounded-lg"
                          />
                          <span className="font-semibold text-slate-900">{st.nama}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-600">
                        {st.nis} / {st.nisn}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span
                          className={`inline-flex px-1.5 py-0.5 rounded font-bold ${
                            st.jenisKelamin === 'L'
                              ? 'bg-sky-100 text-sky-800'
                              : st.jenisKelamin === 'P'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {st.jenisKelamin || '-'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-600">{st.email || '-'}</td>
                      <td className="py-2 px-3 text-slate-700">{st.kelas || '-'}</td>
                      <td className="py-2 px-3 text-slate-700">{st.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
