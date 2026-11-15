import React, { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { GenderCode, SchoolConfig, StudentRecord } from '../../types';
import {
  computeSubjectFinalScore,
  convertGDriveUrl,
  getSubjectKkm,
  normalizeGender,
} from '../../utils/helpers';
import { StudentPhoto } from '../StudentPhoto';

interface StudentFormModalProps {
  open: boolean;
  mode: 'add' | 'edit';
  initialStudent: StudentRecord | null;
  subjects: string[];
  components: string[];
  config: SchoolConfig;
  onClose: () => void;
  onSave: (
    mode: 'add' | 'edit',
    student: StudentRecord,
    originalNis?: string
  ) => Promise<void>;
}

export const StudentFormModal: React.FC<StudentFormModalProps> = ({
  open,
  mode,
  initialStudent,
  subjects,
  components,
  config,
  onClose,
  onSave,
}) => {
  const [nis, setNis] = useState('');
  const [nisn, setNisn] = useState('');
  const [nama, setNama] = useState('');
  const [jenisKelamin, setJenisKelamin] = useState<GenderCode>('');
  const [noAbsen, setNoAbsen] = useState('');
  const [kelas, setKelas] = useState('');
  const [ttl, setTtl] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('LULUS');
  const [photoUrl, setPhotoUrl] = useState('');
  const [scores, setScores] = useState<Record<string, number>>({});
  const [scoreDetails, setScoreDetails] = useState<Record<string, Record<string, number>>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && initialStudent) {
      setNis(initialStudent.nis);
      setNisn(initialStudent.nisn);
      setNama(initialStudent.nama);
      setJenisKelamin(normalizeGender(initialStudent.jenisKelamin));
      setNoAbsen(initialStudent.noAbsen || '');
      setKelas(initialStudent.kelas || '');
      setTtl(initialStudent.ttl || '');
      setEmail(initialStudent.email || '');
      setStatus(initialStudent.status || 'LULUS');
      setPhotoUrl(initialStudent.photoUrl || '');

      const nextScores: Record<string, number> = {};
      const nextDetails: Record<string, Record<string, number>> = {};
      subjects.forEach((s) => {
        nextScores[s] = initialStudent.scores?.[s] ?? 0;
        if (initialStudent.scoreDetails?.[s]) {
          nextDetails[s] = { ...initialStudent.scoreDetails[s] };
        }
      });
      setScores(nextScores);
      setScoreDetails(nextDetails);
    } else {
      setNis('');
      setNisn('');
      setNama('');
      setJenisKelamin('');
      setNoAbsen('');
      setKelas('');
      setTtl('');
      setEmail('');
      setStatus('LULUS');
      setPhotoUrl('');
      const emptyScores: Record<string, number> = {};
      subjects.forEach((s) => {
        emptyScores[s] = 0;
      });
      setScores(emptyScores);
      setScoreDetails({});
    }
  }, [open, mode, initialStudent, subjects]);

  if (!open) return null;

  const handleComponentChange = (subj: string, comp: string, rawVal: string) => {
    setScoreDetails((prev) => {
      const nextSubj = { ...(prev[subj] || {}) };
      if (rawVal.trim() === '') {
        delete nextSubj[comp];
      } else {
        const parsed = Number(rawVal);
        if (!isNaN(parsed)) {
          nextSubj[comp] = Math.max(0, Math.min(100, parsed));
        }
      }

      const updatedDetails = { ...prev };
      if (Object.keys(nextSubj).length > 0) {
        updatedDetails[subj] = nextSubj;
        setScores((sPrev) => ({
          ...sPrev,
          [subj]: computeSubjectFinalScore(nextSubj, 0),
        }));
      } else {
        delete updatedDetails[subj];
      }
      return updatedDetails;
    });
  };

  const handleDirectScoreChange = (subj: string, rawVal: string) => {
    const num = rawVal.trim() === '' ? 0 : Number(rawVal);
    if (isNaN(num)) return;
    setScores((prev) => ({
      ...prev,
      [subj]: Math.max(0, Math.min(100, num)),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const cleanedPhoto = photoUrl.trim() ? convertGDriveUrl(photoUrl).converted : '';
      await onSave(
        mode,
        {
          nis: nis.trim(),
          nisn: nisn.trim(),
          nama: nama.trim(),
          jenisKelamin,
          noAbsen: noAbsen.trim(),
          kelas: kelas.trim(),
          ttl: ttl.trim(),
          email: email.trim(),
          status,
          photoUrl: cleanedPhoto,
          scores,
          scoreDetails,
        },
        initialStudent?.nis
      );
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="w-full max-w-3xl max-h-[92vh] bg-white rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              {mode === 'add' ? 'Tambah Siswa Baru' : `Edit Data Siswa: ${initialStudent?.nama || ''}`}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              NIS digunakan sebagai username dan NISN sebagai password login siswa.
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

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Photo Preview + Gender + Core Biodata */}
          <div className="flex flex-col sm:flex-row gap-4 items-start bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <div className="flex flex-col items-center gap-2 shrink-0">
              <StudentPhoto
                photoUrl={photoUrl}
                studentName={nama || 'Siswa'}
                gender={jenisKelamin}
                sizeClass="w-20 h-20"
                roundedClass="rounded-2xl"
              />
              <span className="text-[11px] text-slate-500 text-center max-w-[100px]">
                {photoUrl.trim()
                  ? 'Foto URL'
                  : jenisKelamin
                    ? 'Foto dummy JK'
                    : 'Inisial'}
              </span>
            </div>

            <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  NIS (Wajib)
                </label>
                <input
                  type="text"
                  required
                  value={nis}
                  onChange={(e) => setNis(e.target.value)}
                  placeholder="002401"
                  className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  NISN / Password (Wajib)
                </label>
                <input
                  type="text"
                  required
                  value={nisn}
                  onChange={(e) => setNisn(e.target.value)}
                  placeholder="0081234567"
                  className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Lengkap Siswa (Wajib)
                </label>
                <input
                  type="text"
                  required
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  placeholder="Nama lengkap siswa"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Secondary Biodata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Jenis Kelamin
              </label>
              <select
                value={jenisKelamin}
                onChange={(e) => setJenisKelamin(e.target.value as GenderCode)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">- Pilih -</option>
                <option value="L">Laki-laki (L)</option>
                <option value="P">Perempuan (P)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Kelas</label>
              <input
                type="text"
                value={kelas}
                onChange={(e) => setKelas(e.target.value)}
                placeholder="XII IPA 1"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">No. Absen</label>
              <input
                type="text"
                value={noAbsen}
                onChange={(e) => setNoAbsen(e.target.value)}
                placeholder="01"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="LULUS">LULUS</option>
                <option value="DITANGGUHKAN">DITANGGUHKAN</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tempat, Tanggal Lahir
              </label>
              <input
                type="text"
                value={ttl}
                onChange={(e) => setTtl(e.target.value)}
                placeholder="Jakarta, 14 Mei 2008"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Siswa (Opsional)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama.siswa@sekolah.sch.id"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                URL Foto Siswa (Opsional, dukung Google Drive)
              </label>
              <input
                type="url"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                placeholder="Kosongkan untuk pakai foto dummy sesuai JK"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Subject Scores & Multi-Components */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900">
                Nilai Mata Pelajaran (KKM Default: {config.kkm})
              </h4>
              <span className="text-[11px] text-slate-500">
                Isi komponen nilai untuk rata-rata otomatis, atau isi Nilai Akhir langsung.
              </span>
            </div>

            <div className="space-y-2.5">
              {subjects.map((subj) => {
                const detailMap = scoreDetails[subj] || {};
                const hasDetails = Object.keys(detailMap).length > 0;
                const finalVal = scores[subj] ?? 0;
                const subjKkm = getSubjectKkm(config, subj);

                return (
                  <div
                    key={subj}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{subj}</span>
                        <span className="text-[11px] font-mono text-slate-500">
                          (KKM {subjKkm})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">Nilai Akhir:</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step="0.01"
                          disabled={hasDetails}
                          value={finalVal}
                          onChange={(e) => handleDirectScoreChange(subj, e.target.value)}
                          className={`w-20 px-2.5 py-1 text-sm font-extrabold text-center rounded-lg border tabular-nums ${
                            hasDetails
                              ? 'bg-theme-soft border-theme-soft text-theme-heading cursor-not-allowed'
                              : finalVal < subjKkm
                                ? 'bg-rose-50 border-rose-300 text-rose-700'
                                : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        />
                      </div>
                    </div>

                    {components.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {components.map((comp) => (
                          <div key={comp}>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              {comp}
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step="0.01"
                              value={detailMap[comp] ?? ''}
                              onChange={(e) => handleComponentChange(subj, comp, e.target.value)}
                              placeholder="-"
                              className="w-full px-2 py-1 text-xs font-semibold text-center bg-white border border-slate-200 rounded-lg tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-theme-primary rounded-xl disabled:opacity-50"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{mode === 'add' ? 'Tambah Siswa' : 'Simpan Perubahan'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
