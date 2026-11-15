import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from 'lucide-react';
import { StudentRecord } from '../../types';
import { downloadTextFile, parseStudentsCsvText } from '../../utils/helpers';
import { StudentPhoto } from '../StudentPhoto';

interface CsvImportModalProps {
  open: boolean;
  subjects: string[];
  components: string[];
  onClose: () => void;
  onImport: (
    students: StudentRecord[],
    subjectsFromCsv: string[],
    mode: 'upsert' | 'skip',
    componentsFromCsv: string[]
  ) => Promise<void>;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  open,
  subjects,
  components,
  onClose,
  onImport,
}) => {
  const [parsedStudents, setParsedStudents] = useState<StudentRecord[]>([]);
  const [subjectsFromCsv, setSubjectsFromCsv] = useState<string[]>([]);
  const [componentsFromCsv, setComponentsFromCsv] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [mode, setMode] = useState<'upsert' | 'skip'>('upsert');
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

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
    const csv =
      '\uFEFF' + [headers.join(','), row1.join(','), row2.join(',')].join('\r\n');
    downloadTextFile(csv, 'template_impor_nilai_ringkas.csv');
  };

  const handleDownloadMultiTemplate = () => {
    const compList = components.length > 0 ? components : ['Tugas', 'UH', 'PTS', 'PAS'];
    const compCols: string[] = [];
    subjects.forEach((subj) => {
      compList.forEach((c) => {
        compCols.push(`${subj} [${c}]`);
      });
    });

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
      ...compCols.map(() => '85'),
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
    const csv =
      '\uFEFF' + [headers.join(','), row1.join(','), row2.join(',')].join('\r\n');
    downloadTextFile(csv, 'template_impor_multi_nilai.csv');
  };

  const handleConfirmImport = async () => {
    if (!parsedStudents.length) return;
    setImporting(true);
    try {
      await onImport(parsedStudents, subjectsFromCsv, mode, componentsFromCsv);
      setParsedStudents([]);
      setFileName('');
      onClose();
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              Impor Data Siswa & Nilai via CSV
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Mendukung kolom Jenis Kelamin (L/P), Email, Foto URL, nilai langsung, dan
              multi-komponen <code>Mapel [Komponen]</code>.
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

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Templates & File Upload */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadSimpleTemplate}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Template Ringkas</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadMultiTemplate}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-theme-heading bg-theme-soft hover:opacity-90 border border-theme-soft rounded-xl"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Template Multi-Nilai</span>
              </button>
            </div>

            <div className="flex items-center gap-2.5">
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as 'upsert' | 'skip')}
                className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-700"
              >
                <option value="upsert">Jika NIS sama: Perbarui</option>
                <option value="skip">Jika NIS sama: Lewati</option>
              </select>

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
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-theme-primary rounded-xl"
              >
                <Upload className="w-3.5 h-3.5" />
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
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" />
                  File <strong>{fileName}</strong> siap diimpor ({parsedStudents.length} siswa,{' '}
                  {subjectsFromCsv.length} mapel
                  {componentsFromCsv.length > 0
                    ? `, ${componentsFromCsv.length} komponen`
                    : ''}
                  ).
                </span>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-64">
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
                    {parsedStudents.slice(0, 50).map((st, idx) => (
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
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl"
          >
            Tutup
          </button>
          <button
            type="button"
            disabled={importing || parsedStudents.length === 0}
            onClick={handleConfirmImport}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-theme-primary rounded-xl disabled:opacity-50"
          >
            {importing && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Impor {parsedStudents.length || ''} Siswa</span>
          </button>
        </div>
      </div>
    </div>
  );
};
