import React, { useState } from 'react';
import {
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  User,
} from 'lucide-react';
import { SchoolConfig } from '../types';
import { resolvePortalBranding } from '../utils/helpers';
import { SchoolLogo } from './SchoolLogo';

interface LoginPortalProps {
  config: SchoolConfig;
  onLogin: (username: string, password: string) => Promise<void>;
}

export const LoginPortal: React.FC<LoginPortalProps> = ({ config, onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    logoUrl: singleLoginLogo,
    title: loginTitle,
    subtitle: loginSubtitle,
    description: loginDescription,
    footerText: loginFooterText,
    formTitle: loginFormTitle,
    formSubtitle: loginFormSubtitle,
    showKkm: showLoginKkm,
  } = resolvePortalBranding(config);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!username.trim() || !password.trim()) {
      setErrorMsg('Masukkan NIS / Username dan Password (NISN) Anda terlebih dahulu.');
      return;
    }

    setLoading(true);
    try {
      await onLogin(username.trim(), password.trim());
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal masuk ke portal.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-theme-page flex items-center justify-center p-4 sm:p-6 lg:p-10">
      <div className="w-full max-w-5xl bg-white rounded-3xl border border-theme-soft shadow-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        {/* Left Branded Gradient Panel (Strictly Single Logo) */}
        <div className="lg:col-span-5 bg-theme-gradient text-white p-7 sm:p-9 flex flex-col justify-between gap-8">
          <div className="space-y-5">
            <div className="flex items-center">
              <SchoolLogo
                logoUrl={singleLoginLogo}
                schoolName={loginTitle}
                sizeClass="w-14 h-14"
                className="bg-white border-white/40 shadow-sm"
              />
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight text-white">
                {loginTitle}
              </h1>
              {loginSubtitle && (
                <p className="mt-2 text-sm text-white/90 leading-relaxed">{loginSubtitle}</p>
              )}
            </div>
          </div>

          <div className="space-y-4 pt-6 border-t border-white/20 text-xs sm:text-sm text-white/90">
            {loginDescription && <p className="leading-relaxed">{loginDescription}</p>}
            {(showLoginKkm || loginFooterText) && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/80 font-mono tabular-nums">
                {showLoginKkm && <span>KKM Sekolah: {config.kkm}</span>}
                {showLoginKkm && loginFooterText && <span>·</span>}
                {loginFooterText && <span>{loginFooterText}</span>}
              </div>
            )}
          </div>
        </div>

        {/* Right Unified Login Form */}
        <div className="lg:col-span-7 p-7 sm:p-10 flex flex-col justify-center">
          <div>
            <h2 className="text-2xl font-bold text-theme-heading tracking-tight">
              {loginFormTitle}
            </h2>
            <p className="mt-1.5 text-sm text-slate-600">{loginFormSubtitle}</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <div>
              <label
                htmlFor="login-username"
                className="block text-sm font-semibold text-slate-800 mb-1.5"
              >
                NIS / Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="login-username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="NIS siswa atau username guru / admin"
                  className="w-full pl-10 pr-4 py-2.5 text-sm font-mono bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-sm font-semibold text-slate-800 mb-1.5"
              >
                Password (NISN)
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="NISN siswa atau password guru / admin"
                  className="w-full pl-10 pr-11 py-2.5 text-sm font-mono bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 rounded"
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                Siswa masuk menggunakan NIS &amp; NISN. Guru dan Administrator masuk menggunakan
                username &amp; password masing-masing.
              </p>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800"
              >
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-5 text-sm font-semibold text-white bg-theme-primary rounded-xl shadow-sm transition-colors disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memeriksa Akun...</span>
                </>
              ) : (
                <>
                  <span>Masuk Portal</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
