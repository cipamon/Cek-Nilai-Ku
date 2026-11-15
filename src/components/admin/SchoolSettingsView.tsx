import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Download,
  Eye,
  EyeOff,
  FileJson,
  Image as ImageIcon,
  Loader2,
  LogIn,
  Palette,
  Printer,
  RotateCcw,
  Save,
  Stamp,
  Upload,
} from 'lucide-react';
import { PortalBackupBundle } from '../../services/api';
import {
  GradeVisibilityConfig,
  PortalUser,
  SchoolConfig,
  SignatureDisplayMode,
  StudentRecord,
  ThemePresetId,
} from '../../types';
import {
  DEFAULT_KOP_LINES,
  downloadTextFile,
  normalizeKopLines,
  resolveSignatureMode,
} from '../../utils/helpers';
import { applyThemeToDocument, THEME_LIST } from '../../utils/themes';
import { DocumentSignatureBlock } from '../DocumentSignatureBlock';
import { OfficialLetterhead } from '../OfficialLetterhead';
import { SchoolLogo } from '../SchoolLogo';

interface SchoolSettingsViewProps {
  config: SchoolConfig;
  subjects: string[];
  components: string[];
  visibility: GradeVisibilityConfig;
  students: StudentRecord[];
  users?: PortalUser[];
  onSaveConfig: (partial: Partial<SchoolConfig>) => Promise<void>;
  onImportPortalBundle: (
    bundle: PortalBackupBundle,
    mode: 'upsert' | 'skip'
  ) => Promise<void>;
  onToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const SchoolSettingsView: React.FC<SchoolSettingsViewProps> = ({
  config,
  subjects,
  components,
  visibility,
  students,
  users = [],
  onSaveConfig,
  onImportPortalBundle,
  onToast,
}) => {
  const [name, setName] = useState(config.name);
  const [subtitle, setSubtitle] = useState(config.subtitle);
  const [address, setAddress] = useState(config.address);
  const [logoUrl, setLogoUrl] = useState(config.logoUrl);
  const [logoRightUrl, setLogoRightUrl] = useState(config.logoRightUrl || '');
  const [kopLines, setKopLines] = useState<string[]>(() =>
    normalizeKopLines(config.kopLines, config)
  );
  const [headmasterName, setHeadmasterName] = useState(config.headmasterName || '');
  const [headmasterNip, setHeadmasterNip] = useState(config.headmasterNip || '');
  const [cityName, setCityName] = useState(config.cityName || '');
  const [showKopSurat, setShowKopSurat] = useState<boolean>(config.showKopSurat ?? true);
  const [signatureMode, setSignatureMode] = useState<SignatureDisplayMode>(() =>
    resolveSignatureMode(config)
  );
  const [teacherSignTitle, setTeacherSignTitle] = useState(
    config.teacherSignTitle || 'Guru / Wali Kelas'
  );
  const [teacherSignName, setTeacherSignName] = useState(config.teacherSignName || '');
  const [teacherSignNip, setTeacherSignNip] = useState(config.teacherSignNip || '');
  const [theme, setTheme] = useState<ThemePresetId>(config.theme || 'royal-violet');
  const [loginLogoUrl, setLoginLogoUrl] = useState(config.loginLogoUrl || '');
  const [loginTitle, setLoginTitle] = useState(config.loginTitle || '');
  const [loginSubtitle, setLoginSubtitle] = useState(config.loginSubtitle || '');
  const [loginDescription, setLoginDescription] = useState(config.loginDescription || '');
  const [loginFooterText, setLoginFooterText] = useState(config.loginFooterText || '');
  const [loginFormTitle, setLoginFormTitle] = useState(config.loginFormTitle || '');
  const [loginFormSubtitle, setLoginFormSubtitle] = useState(config.loginFormSubtitle || '');
  const [showLoginKkm, setShowLoginKkm] = useState<boolean>(config.showLoginKkm ?? true);
  const [saving, setSaving] = useState(false);

  const [bundleImporting, setBundleImporting] = useState(false);
  const [bundleMode, setBundleMode] = useState<'upsert' | 'skip'>('upsert');
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const guruUsers = users.filter((u) => u.role === 'guru' && u.active);

  useEffect(() => {
    setName(config.name);
    setSubtitle(config.subtitle);
    setAddress(config.address);
    setLogoUrl(config.logoUrl);
    setLogoRightUrl(config.logoRightUrl || '');
    setKopLines(normalizeKopLines(config.kopLines, config));
    setHeadmasterName(config.headmasterName || '');
    setHeadmasterNip(config.headmasterNip || '');
    setCityName(config.cityName || '');
    setShowKopSurat(config.showKopSurat ?? true);
    setSignatureMode(resolveSignatureMode(config));
    setTeacherSignTitle(config.teacherSignTitle || 'Guru / Wali Kelas');
    setTeacherSignName(config.teacherSignName || '');
    setTeacherSignNip(config.teacherSignNip || '');
    setTheme(config.theme || 'royal-violet');
    setLoginLogoUrl(config.loginLogoUrl || '');
    setLoginTitle(config.loginTitle || '');
    setLoginSubtitle(config.loginSubtitle || '');
    setLoginDescription(config.loginDescription || '');
    setLoginFooterText(config.loginFooterText || '');
    setLoginFormTitle(config.loginFormTitle || '');
    setLoginFormSubtitle(config.loginFormSubtitle || '');
    setShowLoginKkm(config.showLoginKkm ?? true);
  }, [config]);

  const handleSelectTheme = (presetId: ThemePresetId) => {
    setTheme(presetId);
    applyThemeToDocument(presetId);
  };

  const handleKopLineChange = (index: number, value: string) => {
    setKopLines((prev) => prev.map((line, i) => (i === index ? value : line)));
  };

  const handleResetKopDefault = () => {
    setKopLines([
      DEFAULT_KOP_LINES[0],
      DEFAULT_KOP_LINES[1],
      (name || 'SMA NEGERI NUSANTARA').toUpperCase(),
      address || DEFAULT_KOP_LINES[3],
      DEFAULT_KOP_LINES[4],
      DEFAULT_KOP_LINES[5],
    ]);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSaveConfig({
        name: name.trim(),
        subtitle: subtitle.trim(),
        address: address.trim(),
        logoUrl: logoUrl.trim(),
        logoRightUrl: logoRightUrl.trim(),
        kopLines: kopLines.map((l) => l.trim()),
        headmasterName: headmasterName.trim(),
        headmasterNip: headmasterNip.trim(),
        cityName: cityName.trim(),
        showKopSurat,
        showHeadmasterSign: signatureMode === 'headmaster' || signatureMode === 'both',
        signatureMode,
        teacherSignTitle: teacherSignTitle.trim() || 'Guru / Wali Kelas',
        teacherSignName: teacherSignName.trim(),
        teacherSignNip: teacherSignNip.trim(),
        theme,
        loginLogoUrl: loginLogoUrl.trim(),
        loginTitle: loginTitle.trim(),
        loginSubtitle: loginSubtitle.trim(),
        loginDescription: loginDescription.trim(),
        loginFooterText: loginFooterText.trim(),
        loginFormTitle: loginFormTitle.trim(),
        loginFormSubtitle: loginFormSubtitle.trim(),
        showLoginKkm,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleExportBundle = () => {
    const bundle: PortalBackupBundle = {
      version: 1,
      exportedAt: new Date().toISOString(),
      config: {
        ...config,
        name: name.trim(),
        subtitle: subtitle.trim(),
        address: address.trim(),
        logoUrl: logoUrl.trim(),
        logoRightUrl: logoRightUrl.trim(),
        kopLines,
        headmasterName: headmasterName.trim(),
        headmasterNip: headmasterNip.trim(),
        cityName: cityName.trim(),
        showKopSurat,
        showHeadmasterSign: signatureMode === 'headmaster' || signatureMode === 'both',
        signatureMode,
        teacherSignTitle: teacherSignTitle.trim() || 'Guru / Wali Kelas',
        teacherSignName: teacherSignName.trim(),
        teacherSignNip: teacherSignNip.trim(),
        theme,
        loginLogoUrl: loginLogoUrl.trim(),
        loginTitle: loginTitle.trim(),
        loginSubtitle: loginSubtitle.trim(),
        loginDescription: loginDescription.trim(),
        loginFooterText: loginFooterText.trim(),
        loginFormTitle: loginFormTitle.trim(),
        loginFormSubtitle: loginFormSubtitle.trim(),
        showLoginKkm,
      },
      subjects,
      components,
      visibility,
      students,
    };
    const dateTag = new Date().toISOString().slice(0, 10);
    downloadTextFile(
      JSON.stringify(bundle, null, 2),
      `backup_portal_lengkap_${dateTag}.json`,
      'application/json;charset=utf-8;'
    );
    onToast('success', 'Backup lengkap pengaturan sekolah, tema, kop & siswa diunduh.');
  };

  const handleBundleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBundleImporting(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as PortalBackupBundle;
      if (!parsed || typeof parsed !== 'object' || (!parsed.config && !parsed.students)) {
        throw new Error('Format file JSON backup tidak dikenali.');
      }
      await onImportPortalBundle(parsed, bundleMode);
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Gagal membaca file backup JSON.');
    } finally {
      setBundleImporting(false);
      e.target.value = '';
    }
  };

  const previewConfig: SchoolConfig = {
    ...config,
    name,
    subtitle,
    address,
    logoUrl,
    logoRightUrl,
    kopLines,
    headmasterName,
    headmasterNip,
    cityName,
    showKopSurat,
    showHeadmasterSign: signatureMode === 'headmaster' || signatureMode === 'both',
    signatureMode,
    teacherSignTitle,
    teacherSignName,
    teacherSignNip,
    theme,
    loginLogoUrl,
    loginTitle,
    loginSubtitle,
    loginDescription,
    loginFooterText,
    loginFormTitle,
    loginFormSubtitle,
    showLoginKkm,
  };

  const effectiveLoginLogo =
    loginLogoUrl.trim() || logoUrl.trim() || logoRightUrl.trim();
  const effectiveLoginTitle = loginTitle.trim() || name.trim() || config.name;
  const effectiveLoginSubtitle = loginSubtitle.trim() || subtitle.trim();
  const effectiveLoginDescription = loginDescription.trim() || address.trim();
  const effectiveLoginFooter =
    loginFooterText.trim() || 'Portal Terpadu Siswa & Admin';

  const kopLineHints = [
    'Baris 1: Pemerintah Daerah / Yayasan',
    'Baris 2: Dinas Pendidikan / Instansi Induk',
    'Baris 3: Nama Sekolah (Tebal & Besar)',
    'Baris 4: Alamat Lengkap Sekolah',
    'Baris 5: Nomor Telepon & Website',
    'Baris 6: Email Resmi & NPSN / Akreditasi',
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            Pengaturan Sekolah, Kop Surat & Tema
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Atur palet warna portal, 2 logo kop surat (kiri & kanan), 6 baris kop resmi, serta
            opsi tampil/sembunyikan Kop Surat dan TTD Kepala Sekolah.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Theme Picker */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-theme-soft text-theme-heading flex items-center justify-center">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Tema Warna Portal & Login
              </h2>
              <p className="text-xs text-slate-500">
                Pilih skema warna portal (langsung terlihat pada preview dan disimpan permanen).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {THEME_LIST.map((preset) => {
              const active = theme === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectTheme(preset.id)}
                  className={`text-left p-3.5 rounded-2xl border transition-all flex items-start gap-3 ${
                    active
                      ? 'bg-theme-soft border-theme-soft ring-2 ring-indigo-500/20'
                      : 'bg-slate-50/70 border-slate-200 hover:bg-white'
                  }`}
                >
                  <div
                    className="w-10 h-10 rounded-xl shrink-0 shadow-sm flex items-center justify-center text-white"
                    style={{ backgroundImage: preset.swatchGradient }}
                  >
                    {active && <Check className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900">{preset.name}</p>
                    <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                      {preset.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Identity & 2 Logos */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Identitas Sekolah & Logo Kiri / Kanan
              </h2>
              <p className="text-xs text-slate-500">
                Mendukung tautan URL gambar langsung maupun Google Drive (otomatis dikonversi).
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Nama Sekolah
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Subjudul / Slogan Portal
              </label>
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Alamat Ringkas Sekolah
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3">
              <SchoolLogo logoUrl={logoUrl} schoolName={name} sizeClass="w-12 h-12" />
              <div className="flex-1 min-w-0">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  URL Logo Kiri (Utama / Pemda)
                </label>
                <input
                  type="url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3">
              <SchoolLogo
                logoUrl={logoRightUrl}
                schoolName={`Logo Kanan ${name}`}
                sizeClass="w-12 h-12"
              />
              <div className="flex-1 min-w-0">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  URL Logo Kanan (Khusus Kop Surat)
                </label>
                <input
                  type="url"
                  value={logoRightUrl}
                  onChange={(e) => setLogoRightUrl(e.target.value)}
                  placeholder="https://... (kosongkan jika hanya 1 logo)"
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Dedicated Login Page Settings (Single Logo & Custom Copy) */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-theme-soft text-theme-heading flex items-center justify-center">
                <LogIn className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  Pengaturan Halaman Login (1 Logo &amp; Teks Khusus)
                </h2>
                <p className="text-xs text-slate-500">
                  Menampilkan 1 logo saja untuk Halaman Login, sidebar Admin, dan header Siswa.
                  Kosongkan kolom bila ingin mengikuti identitas sekolah utama.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-7 space-y-4">
              {/* Single Login Logo Picker */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center gap-3">
                  <SchoolLogo
                    logoUrl={effectiveLoginLogo}
                    schoolName={effectiveLoginTitle}
                    sizeClass="w-14 h-14"
                  />
                  <div className="flex-1 min-w-0">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      URL Logo Halaman Login (Hanya 1 Logo)
                    </label>
                    <input
                      type="url"
                      value={loginLogoUrl}
                      onChange={(e) => setLoginLogoUrl(e.target.value)}
                      placeholder="Kosongkan untuk otomatis memakai Logo Kiri sekolah"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {logoUrl.trim() && (
                    <button
                      type="button"
                      onClick={() => setLoginLogoUrl(logoUrl.trim())}
                      className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      Gunakan Logo Kiri
                    </button>
                  )}
                  {logoRightUrl.trim() && (
                    <button
                      type="button"
                      onClick={() => setLoginLogoUrl(logoRightUrl.trim())}
                      className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      Gunakan Logo Kanan
                    </button>
                  )}
                  {loginLogoUrl.trim() && (
                    <button
                      type="button"
                      onClick={() => setLoginLogoUrl('')}
                      className="px-2.5 py-1 text-[11px] font-semibold text-slate-500 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      Ikut Default
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Judul Panel Kiri Login
                  </label>
                  <input
                    type="text"
                    value={loginTitle}
                    onChange={(e) => setLoginTitle(e.target.value)}
                    placeholder={name || 'Ikut Nama Sekolah'}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Subjudul Panel Kiri Login
                  </label>
                  <input
                    type="text"
                    value={loginSubtitle}
                    onChange={(e) => setLoginSubtitle(e.target.value)}
                    placeholder={subtitle || 'Ikut Subjudul Sekolah'}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Alamat / Keterangan Panel Kiri
                  </label>
                  <input
                    type="text"
                    value={loginDescription}
                    onChange={(e) => setLoginDescription(e.target.value)}
                    placeholder={address || 'Ikut Alamat Sekolah'}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Teks Bawah Panel Kiri
                  </label>
                  <input
                    type="text"
                    value={loginFooterText}
                    onChange={(e) => setLoginFooterText(e.target.value)}
                    placeholder="Portal Terpadu Siswa & Admin"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Judul Form Masuk (Sisi Kanan)
                  </label>
                  <input
                    type="text"
                    value={loginFormTitle}
                    onChange={(e) => setLoginFormTitle(e.target.value)}
                    placeholder="Portal Nilai Sekolah"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Keterangan Form Masuk (Sisi Kanan)
                  </label>
                  <input
                    type="text"
                    value={loginFormSubtitle}
                    onChange={(e) => setLoginFormSubtitle(e.target.value)}
                    placeholder="Masuk satu pintu untuk Siswa (menggunakan NIS & NISN) maupun Administrator."
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <label
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                  showLoginKkm
                    ? 'bg-emerald-50/70 border-emerald-200'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <input
                  type="checkbox"
                  checked={showLoginKkm}
                  onChange={(e) => setShowLoginKkm(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-emerald-600"
                />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    {showLoginKkm ? (
                      <Eye className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-slate-400" />
                    )}
                    <span>Tampilkan Info KKM di Halaman Login</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Menampilkan baris <span className="font-mono">KKM Sekolah: {config.kkm}</span> di
                    bagian bawah panel login.
                  </p>
                </div>
              </label>
            </div>

            {/* Live Compact Single-Logo Login Card Preview */}
            <div className="lg:col-span-5">
              <div className="bg-theme-gradient text-white rounded-2xl p-6 flex flex-col justify-between gap-6 shadow-md min-h-[270px]">
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <SchoolLogo
                      logoUrl={effectiveLoginLogo}
                      schoolName={effectiveLoginTitle}
                      sizeClass="w-12 h-12"
                      className="bg-white border-white/40 shadow-sm"
                    />
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-md bg-white/15 text-white/95">
                      Pratinjau 1 Logo
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold leading-tight text-white">
                      {effectiveLoginTitle}
                    </h3>
                    {effectiveLoginSubtitle && (
                      <p className="mt-1 text-xs text-white/90 leading-relaxed">
                        {effectiveLoginSubtitle}
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-white/20 space-y-2 text-xs text-white/90">
                  {effectiveLoginDescription && (
                    <p className="leading-relaxed">{effectiveLoginDescription}</p>
                  )}
                  {(showLoginKkm || effectiveLoginFooter) && (
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-white/80 font-mono tabular-nums">
                      {showLoginKkm && <span>KKM Sekolah: {config.kkm}</span>}
                      {showLoginKkm && effectiveLoginFooter && <span>·</span>}
                      {effectiveLoginFooter && <span>{effectiveLoginFooter}</span>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Kop Surat 6 Baris + TTD Kepsek + Show/Hide Controls */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Stamp className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  Kop Surat (6 Baris) & TTD Kepala Sekolah
                </h2>
                <p className="text-xs text-slate-500">
                  Atur tampilan kop surat resmi dan blok tanda tangan pada halaman nilai & cetak.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleResetKopDefault}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Isi Template Default</span>
            </button>
          </div>

          {/* Kop Surat & 4-Mode Signature Selector */}
          <div className="space-y-4">
            <label
              className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                showKopSurat
                  ? 'bg-emerald-50/70 border-emerald-200'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <input
                type="checkbox"
                checked={showKopSurat}
                onChange={(e) => setShowKopSurat(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-emerald-600"
              />
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  {showKopSurat ? (
                    <Eye className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-slate-400" />
                  )}
                  <span>Tampilkan Kop Surat</span>
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {showKopSurat
                    ? 'Kop surat 2 logo & 6 baris ditampilkan di transkrip siswa dan cetak leger.'
                    : 'Kop surat disembunyikan dari tampilan siswa dan hasil cetak.'}
                </p>
              </div>
            </label>

            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-800">
                Pengaturan Tampilan Tanda Tangan Dokumen
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {[
                  {
                    id: 'both' as SignatureDisplayMode,
                    title: 'Dua-duanya (Kepsek & Guru)',
                    desc: 'Tanda tangan Kepala Sekolah & Guru berdampingan.',
                  },
                  {
                    id: 'headmaster' as SignatureDisplayMode,
                    title: 'Hanya Kepala Sekolah',
                    desc: 'Hanya blok tanda tangan Kepala Sekolah.',
                  },
                  {
                    id: 'teacher' as SignatureDisplayMode,
                    title: 'Hanya Guru / Wali Kelas',
                    desc: 'Hanya blok tanda tangan Guru sendiri.',
                  },
                  {
                    id: 'none' as SignatureDisplayMode,
                    title: 'Tidak Ditampilkan',
                    desc: 'Sembunyikan seluruh blok tanda tangan.',
                  },
                ].map((opt) => {
                  const active = signatureMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSignatureMode(opt.id)}
                      className={`text-left p-3 rounded-xl border transition-all ${
                        active
                          ? 'bg-theme-soft border-theme-soft ring-2 ring-indigo-500/20'
                          : 'bg-slate-50 border-slate-200 hover:bg-white'
                      }`}
                    >
                      <p className="text-xs font-bold text-slate-900">{opt.title}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{opt.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 6 Lines Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {kopLines.map((lineVal, idx) => (
              <div key={idx}>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  {kopLineHints[idx] || `Baris ${idx + 1}`}
                </label>
                <input
                  type="text"
                  value={lineVal}
                  onChange={(e) => handleKopLineChange(idx, e.target.value)}
                  placeholder={`Teks Kop Baris ${idx + 1}`}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            ))}
          </div>

          {/* Headmaster Info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Kota / Kabupaten (untuk tanggal cetak)
              </label>
              <input
                type="text"
                value={cityName}
                onChange={(e) => setCityName(e.target.value)}
                placeholder="Contoh: Yogyakarta"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nama Kepala Sekolah
              </label>
              <input
                type="text"
                value={headmasterName}
                onChange={(e) => setHeadmasterName(e.target.value)}
                placeholder="Nama lengkap & gelar"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                NIP Kepala Sekolah
              </label>
              <input
                type="text"
                value={headmasterNip}
                onChange={(e) => setHeadmasterNip(e.target.value)}
                placeholder="Contoh: 19700101 199512 1 001"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Teacher Signature Info */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold text-slate-800">
                Data Tanda Tangan Guru / Wali Kelas
              </p>
              {guruUsers.length > 0 && (
                <select
                  defaultValue=""
                  onChange={(e) => {
                    const chosen = guruUsers.find((u) => u.id === e.target.value);
                    if (chosen) {
                      setTeacherSignName(chosen.nama);
                      setTeacherSignNip(chosen.nip || '');
                    }
                  }}
                  className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-700"
                >
                  <option value="">Isi cepat dari daftar Guru...</option>
                  {guruUsers.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nama} {g.nip ? `(${g.nip})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Jabatan TTD Guru
                </label>
                <input
                  type="text"
                  value={teacherSignTitle}
                  onChange={(e) => setTeacherSignTitle(e.target.value)}
                  placeholder="Guru / Wali Kelas"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Guru Penanda Tangan
                </label>
                <input
                  type="text"
                  value={teacherSignName}
                  onChange={(e) => setTeacherSignName(e.target.value)}
                  placeholder="Nama lengkap & gelar guru"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  NIP / NUPTK Guru
                </label>
                <input
                  type="text"
                  value={teacherSignNip}
                  onChange={(e) => setTeacherSignNip(e.target.value)}
                  placeholder="Opsional"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Live Preview */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                <Printer className="w-3.5 h-3.5" />
                Pratinjau Dokumen Cetak
              </span>
              <span className="text-[11px] text-slate-500">
                Kop: <strong>{showKopSurat ? 'Ditampilkan' : 'Disembunyikan'}</strong> · TTD:{' '}
                <strong>
                  {signatureMode === 'both'
                    ? 'Kepala Sekolah & Guru'
                    : signatureMode === 'headmaster'
                      ? 'Hanya Kepala Sekolah'
                      : signatureMode === 'teacher'
                        ? 'Hanya Guru'
                        : 'Tidak Ditampilkan'}
                </strong>
              </span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-5">
              {showKopSurat ? (
                <OfficialLetterhead
                  config={previewConfig}
                  documentTitle="Transkrip Hasil Belajar Siswa"
                  compact
                />
              ) : (
                <div className="py-3 px-4 rounded-xl bg-slate-100 text-xs text-slate-500 text-center">
                  Kop Surat sedang dinonaktifkan (tidak ditampilkan).
                </div>
              )}

              {signatureMode !== 'none' ? (
                <div className="pt-3 border-t border-slate-100">
                  <DocumentSignatureBlock
                    config={previewConfig}
                    modeOverride={signatureMode}
                    compact
                    dateLabel="Tanggal Cetak"
                  />
                </div>
              ) : (
                <div className="py-2 px-4 rounded-xl bg-slate-100 text-xs text-slate-500 text-center">
                  Blok Tanda Tangan sedang dinonaktifkan (tidak ditampilkan).
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-theme-primary rounded-xl shadow-sm disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Simpan Semua Pengaturan</span>
            </button>
          </div>
        </section>
      </form>

      {/* JSON Backup & Restore Bundle */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <FileJson className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Ekspor & Impor Backup Lengkap (JSON)
            </h2>
            <p className="text-xs text-slate-500">
              Mencakup tema, logo, 6 baris kop surat, opsi TTD, daftar mapel, foto siswa, jenis
              kelamin, email, dan seluruh nilai ({students.length} siswa).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExportBundle}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-theme-primary rounded-xl"
          >
            <Download className="w-4 h-4" />
            <span>Ekspor Paket JSON</span>
          </button>

          <select
            value={bundleMode}
            onChange={(e) => setBundleMode(e.target.value as 'upsert' | 'skip')}
            className="px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-700"
          >
            <option value="upsert">Jika NIS sama: Perbarui (Upsert)</option>
            <option value="skip">Jika NIS sama: Lewati (Skip)</option>
          </select>

          <input
            ref={jsonInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleBundleFileChange}
            className="hidden"
          />
          <button
            type="button"
            disabled={bundleImporting}
            onClick={() => jsonInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl disabled:opacity-50"
          >
            {bundleImporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            <span>Impor Paket JSON</span>
          </button>
        </div>
      </section>
    </div>
  );
};
