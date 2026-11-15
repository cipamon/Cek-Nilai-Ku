import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, LogOut } from 'lucide-react';
import {
  fetchAdminData,
  fetchSchoolConfig,
  fetchStudentTranscript,
  fetchTeacherData,
  getCachedPublicSettings,
  getSavedSession,
  loginAccount,
  saveSession,
} from './services/api';
import {
  AuthSession,
  GradeVisibilityConfig,
  PortalUser,
  SchoolConfig,
  StudentRecord,
  ToastItem,
} from './types';
import {
  DEFAULT_ASSESSMENT_COMPONENTS,
  DEFAULT_GRADE_VISIBILITY,
  DEFAULT_SCHOOL_CONFIG,
  resolvePortalBranding,
} from './utils/helpers';
import { applyThemeToDocument } from './utils/themes';
import { AdminWorkspace } from './components/AdminWorkspace';
import { LoginPortal } from './components/LoginPortal';
import { SchoolLogo } from './components/SchoolLogo';
import { StudentPhoto } from './components/StudentPhoto';
import { StudentTranscriptView } from './components/StudentTranscriptView';
import { TeacherWorkspace } from './components/TeacherWorkspace';
import { ToastContainer } from './components/ToastContainer';

export function App() {
  const cachedPublic = getCachedPublicSettings();

  const [config, setConfig] = useState<SchoolConfig>(
    () => cachedPublic?.config || DEFAULT_SCHOOL_CONFIG
  );
  const [subjects, setSubjects] = useState<string[]>(() => cachedPublic?.subjects || []);
  const [components, setComponents] = useState<string[]>(
    () => cachedPublic?.components || DEFAULT_ASSESSMENT_COMPONENTS
  );
  const [visibility, setVisibility] = useState<GradeVisibilityConfig>(
    () => cachedPublic?.visibility || DEFAULT_GRADE_VISIBILITY
  );

  const [session, setSession] = useState<AuthSession | null>(() => getSavedSession());
  const [studentData, setStudentData] = useState<StudentRecord | null>(null);
  const [adminStudents, setAdminStudents] = useState<StudentRecord[]>([]);
  const [users, setUsers] = useState<PortalUser[]>([]);

  const [bootLoading, setBootLoading] = useState<boolean>(Boolean(getSavedSession()));
  const [studentRefreshing, setStudentRefreshing] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    applyThemeToDocument(config.theme);
  }, [config.theme]);

  const portalBrand = resolvePortalBranding(config);

  const addToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      const saved = getSavedSession();
      if (!saved) {
        try {
          const res = await fetchSchoolConfig();
          if (!active) return;
          if (res.config) setConfig(res.config);
          if (res.subjects) setSubjects(res.subjects);
          if (res.components) setComponents(res.components);
          if (res.visibility) setVisibility(res.visibility);
        } catch {
          // Use cached/default config when offline
        } finally {
          if (active) setBootLoading(false);
        }
        return;
      }

      try {
        if (saved.role === 'admin') {
          const res = await fetchAdminData(saved, true);
          if (!active) return;
          if (res.config) setConfig(res.config);
          if (res.subjects) setSubjects(res.subjects);
          if (res.components) setComponents(res.components);
          if (res.visibility) setVisibility(res.visibility);
          if (res.students) setAdminStudents(res.students);
          if (res.users) setUsers(res.users);
          setSession(saved);
        } else if (saved.role === 'guru') {
          const res = await fetchTeacherData(saved, true);
          if (!active) return;
          if (res.config) setConfig(res.config);
          if (res.subjects) setSubjects(res.subjects);
          if (res.components) setComponents(res.components);
          if (res.visibility) setVisibility(res.visibility);
          if (res.students) setAdminStudents(res.students);
          const nextSess = res.session || saved;
          setSession(nextSess);
          saveSession(nextSess);
        } else {
          const res = await fetchStudentTranscript(saved.username, saved.password);
          if (!active) return;
          if (res.config) setConfig(res.config);
          if (res.subjects) setSubjects(res.subjects);
          if (res.components) setComponents(res.components);
          if (res.visibility) setVisibility(res.visibility);
          if (res.student) setStudentData(res.student);
          setSession(saved);
        }
      } catch {
        saveSession(null);
        if (active) {
          setSession(null);
          setStudentData(null);
          setAdminStudents([]);
          setUsers([]);
        }
      } finally {
        if (active) setBootLoading(false);
      }
    };

    void bootstrap();
    return () => {
      active = false;
    };
  }, []);

  const handleLogin = async (username: string, password: string) => {
    const res = await loginAccount(username, password);
    if (res.config) setConfig(res.config);
    if (res.subjects) setSubjects(res.subjects);
    if (res.components) setComponents(res.components);
    if (res.visibility) setVisibility(res.visibility);

    if (res.role === 'admin') {
      const nextSession: AuthSession = res.session || { role: 'admin', username, password };
      setAdminStudents(res.students || []);
      setUsers(res.users || []);
      setStudentData(null);
      setSession(nextSession);
      saveSession(nextSession);
      addToast('success', `Selamat datang, ${nextSession.displayName || 'Administrator'}.`);
    } else if (res.role === 'guru') {
      const nextSession: AuthSession = res.session || { role: 'guru', username, password };
      setAdminStudents(res.students || []);
      setUsers([]);
      setStudentData(null);
      setSession(nextSession);
      saveSession(nextSession);
      addToast('success', `Selamat datang, ${nextSession.displayName || username}.`);
    } else if (res.role === 'student' && res.student) {
      const nextSession: AuthSession = { role: 'student', username, password };
      setStudentData(res.student);
      setAdminStudents([]);
      setUsers([]);
      setSession(nextSession);
      saveSession(nextSession);
      addToast('success', `Selamat datang, ${res.student.nama}.`);
    }
  };

  const handleLogout = () => {
    saveSession(null);
    setSession(null);
    setStudentData(null);
    setAdminStudents([]);
    setUsers([]);
  };

  const handleRefreshStudent = async () => {
    if (!session || session.role !== 'student') return;
    setStudentRefreshing(true);
    try {
      const res = await fetchStudentTranscript(session.username, session.password);
      if (res.config) setConfig(res.config);
      if (res.subjects) setSubjects(res.subjects);
      if (res.components) setComponents(res.components);
      if (res.visibility) setVisibility(res.visibility);
      if (res.student) setStudentData(res.student);
      addToast('success', 'Data nilai berhasil dimuat ulang.');
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Gagal memuat ulang nilai.');
    } finally {
      setStudentRefreshing(false);
    }
  };

  const handleAdminDataUpdated = useCallback(
    (payload: {
      session?: AuthSession;
      config?: SchoolConfig;
      subjects?: string[];
      components?: string[];
      visibility?: GradeVisibilityConfig;
      students?: StudentRecord[];
      users?: PortalUser[];
    }) => {
      if (payload.session) {
        setSession(payload.session);
        saveSession(payload.session);
      }
      if (payload.config) setConfig(payload.config);
      if (payload.subjects) setSubjects(payload.subjects);
      if (payload.components) setComponents(payload.components);
      if (payload.visibility) setVisibility(payload.visibility);
      if (payload.students) setAdminStudents(payload.students);
      if (payload.users) setUsers(payload.users);
    },
    []
  );

  if (bootLoading) {
    return (
      <div className="min-h-screen bg-theme-page flex flex-col items-center justify-center gap-3 text-theme-heading">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="text-sm font-medium text-slate-600">Memuat Portal Nilai...</p>
      </div>
    );
  }

  return (
    <>
      {!session ? (
        <LoginPortal config={config} onLogin={handleLogin} />
      ) : session.role === 'admin' ? (
        <AdminWorkspace
          session={session}
          config={config}
          subjects={subjects}
          components={components}
          visibility={visibility}
          students={adminStudents}
          users={users}
          onDataUpdated={handleAdminDataUpdated}
          onLogout={handleLogout}
          onToast={addToast}
        />
      ) : session.role === 'guru' ? (
        <TeacherWorkspace
          session={session}
          config={config}
          subjects={subjects}
          components={components}
          students={adminStudents}
          onDataUpdated={handleAdminDataUpdated}
          onLogout={handleLogout}
          onToast={addToast}
        />
      ) : studentData ? (
        <div className="min-h-screen bg-theme-page">
          <header className="no-print sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-sm border-b border-theme-soft px-4 sm:px-6 lg:px-8">
            <div className="max-w-5xl mx-auto h-full flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <SchoolLogo
                  logoUrl={portalBrand.logoUrl}
                  schoolName={portalBrand.title}
                  sizeClass="w-10 h-10"
                />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-theme-heading truncate">
                    {portalBrand.title}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{portalBrand.subtitle}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="hidden sm:flex items-center gap-2.5 pl-1.5 pr-3 py-1 rounded-xl bg-slate-50 border border-slate-200">
                  <StudentPhoto
                    photoUrl={studentData.photoUrl}
                    studentName={studentData.nama}
                    gender={studentData.jenisKelamin}
                    sizeClass="w-8 h-8"
                    roundedClass="rounded-lg"
                    textSizeClass="text-xs"
                  />
                  <div className="min-w-0 max-w-[160px]">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {studentData.nama}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate">
                      {studentData.kelas || `NIS ${studentData.nis}`}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors whitespace-nowrap shrink-0"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Keluar</span>
                </button>
              </div>
            </div>
          </header>

          <StudentTranscriptView
            student={studentData}
            subjects={subjects}
            components={components}
            config={config}
            visibility={visibility}
            refreshing={studentRefreshing}
            onRefresh={handleRefreshStudent}
          />
        </div>
      ) : null}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}

export default App;
