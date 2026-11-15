import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Loader2,
  Upload,
  X,
} from 'lucide-react';
import { SavePortalUserInput } from '../../services/api';
import { downloadTextFile, ParsedCsvPortalUser, parseUsersCsvText } from '../../utils/helpers';

interface UserCsvImportModalProps {
  open: boolean;
  existingUsernames: Set<string>;
  onClose: () => void;
  onImport: (users: SavePortalUserInput[], mode: 'upsert' | 'skip') => Promise<void>;
}

export const UserCsvImportModal: React.FC<UserCsvImportModalProps> = ({
  open,
  existingUsernames,
  onClose,
  onImport,
}) => {
  const [parsedUsers, setParsedUsers] = useState<ParsedCsvPortalUser[]>([]);
  const [fileName, setFileName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mode, setMode] = useState<'upsert' | 'skip'>('upsert');
  const [defaultPassword, setDefaultPassword] = useState('');
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleDownloadTemplate = () => {
    const headers = [
      'Username',
      'Nama',
      'Peran',
      'NIP',
      'Email',
      'Mapel Diampu',
      'Kelas Diampu',
      'Status',
      'Password',
    ];
    const row1 = [
      'budi.guru',
      'Budi Hartono, S.Pd.',
      'guru',
      '198501012010011001',
      'budi.guru@sekolah.sch.id',
      'Matematika | IPA',
      'XII IPA 1 | XII IPA 2',
      'Aktif',
      'guru1234',
    ];
    const row2 = [
      'tu.admin',
      'Siti Rahayu, S.Kom.',
      'admin',
      '199002152015032002',
      'tu.admin@sekolah.sch.id',
      '',
      '',
      'Aktif',
      'admin1234',
    ];
    const csv =
      '\uFEFF' + [headers.join(','), row1.join(','), row2.join(',')].join('\r\n');
    downloadTextFile(csv, 'template_impor_user_guru_admin.csv');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setErrorMsg(null);
    try {
      const text = await file.text();
      const res = parseUsersCsvText(text);
      if (!res.ok) {
        setErrorMsg(res.error);
        setParsedUsers([]);
        return;
      }
      setParsedUsers(res.users);
    } catch {
      setErrorMsg('Gagal membaca file CSV pengguna.');
      setParsedUsers([]);
    } finally {
      e.target.value = '';
    }
  };

  const getEffectivePassword = (u: ParsedCsvPortalUser) => {
    return (u.password || defaultPassword).trim();
  };

  const validCount = parsedUsers.filter((u) => {
    const exists = existingUsernames.has(u.username.toLowerCase());
    if (exists) {
      if (mode === 'skip') return false;
      const pass = u.password.trim();
      return !pass || pass.length >= 4;
    }
    return getEffectivePassword(u).length >= 4;
  }).length;

  const handleConfirmImport = async () => {
    if (!parsedUsers.length || validCount === 0) return;
    setImporting(true);
    try {
      const payload: SavePortalUserInput[] = parsedUsers.map((u) => {
        const exists = existingUsernames.has(u.username.toLowerCase());
        const effectivePass = exists
          ? u.password.trim() || undefined
          : getEffectivePassword(u) || undefined;
        return {
          username: u.username,
          nama: u.nama,
          role: u.role,
          nip: u.nip,
          email: u.email,
          assignedSubjects: u.assignedSubjects,
          assignedClasses: u.assignedClasses,
          active: u.active,
          password: effectivePass,
        };
      });
      await onImport(payload, mode);
      setParsedUsers([]);
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
              Impor Akun Guru &amp; Admin via CSV
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Pisahkan multi mapel atau multi kelas dengan tanda <code>|</code> atau <code>;</code>.
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

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh Template CSV User</span>
            </button>

            <div className="flex flex-wrap items-center gap-2.5">
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as 'upsert' | 'skip')}
                className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-700"
              >
                <option value="upsert">Jika Username sama: Perbarui</option>
                <option value="skip">Jika Username sama: Lewati</option>
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

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-slate-600">
              <p className="font-semibold text-slate-800">
                Password Default untuk Akun Baru (Opsional)
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Dipakai hanya jika kolom <code>Password</code> di CSV kosong pada akun baru (min. 4
                karakter). Akun lama yang diperbarui akan tetap memakai password lamanya bila
                kolom Password dikosongkan.
              </p>
            </div>
            <input
              type="text"
              value={defaultPassword}
              onChange={(e) => setDefaultPassword(e.target.value)}
              placeholder="Contoh: guru1234"
              className="sm:w-52 px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-xl"
            />
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs sm:text-sm text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {parsedUsers.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" />
                  File <strong>{fileName}</strong>: {parsedUsers.length} baris dibaca ({validCount}{' '}
                  siap diproses).
                </span>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-64">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Username</th>
                      <th className="py-2.5 px-3">Nama</th>
                      <th className="py-2.5 px-3">Peran</th>
                      <th className="py-2.5 px-3">Mapel / Kelas</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Keterangan Impor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedUsers.slice(0, 60).map((u, idx) => {
                      const exists = existingUsernames.has(u.username.toLowerCase());
                      const effectivePass = getEffectivePassword(u);
                      const statusNote = exists
                        ? mode === 'skip'
                          ? 'Dilewati (sudah ada)'
                          : 'Perbarui akun'
                        : effectivePass.length >= 4
                          ? 'Akun baru'
                          : 'Butuh password (min. 4 char)';

                      return (
                        <tr key={`${u.username}-${idx}`} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-mono font-semibold text-slate-800">
                            {u.username}
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-900">{u.nama}</td>
                          <td className="py-2 px-3 uppercase font-bold text-[11px] text-slate-700">
                            {u.role}
                          </td>
                          <td className="py-2 px-3 text-slate-600 max-w-[200px] truncate">
                            {u.role === 'admin'
                              ? 'Akses Penuh Admin'
                              : `${u.assignedSubjects.join(', ') || 'Semua Mapel'} · ${
                                  u.assignedClasses.join(', ') || 'Semua Kelas'
                                }`}
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded font-bold ${
                                u.active
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-200 text-slate-600'
                              }`}
                            >
                              {u.active ? 'Aktif' : 'Nonaktif'}
                            </span>
                          </td>
                          <td
                            className={`py-2 px-3 font-semibold ${
                              statusNote.startsWith('Butuh')
                                ? 'text-rose-600'
                                : statusNote.startsWith('Dilewati')
                                  ? 'text-slate-400'
                                  : 'text-emerald-700'
                            }`}
                          >
                            {statusNote}
                          </td>
                        </tr>
                      );
                    })}
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
            disabled={importing || validCount === 0}
            onClick={handleConfirmImport}
            className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-theme-primary rounded-xl disabled:opacity-50"
          >
            {importing && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Impor {validCount || ''} Akun</span>
          </button>
        </div>
      </div>
    </div>
  );
};
