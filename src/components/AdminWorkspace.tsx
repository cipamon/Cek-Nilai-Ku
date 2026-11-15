import React, { useState } from 'react';
import {
  BookOpen,
  Eye,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  Menu,
  Palette,
  RefreshCw,
  ShieldCheck,
  Table2,
  Users,
  X,
} from 'lucide-react';
import {
  addComponent,
  addSubject,
  bulkDeletePortalUsers,
  bulkDeleteStudents,
  bulkUpdatePortalUsers,
  bulkUpdateStudents,
  deleteComponent,
  deletePortalUser,
  deleteStudent,
  deleteSubject,
  fetchAdminData,
  importPortalBundle,
  importPortalUsers,
  importStudents,
  PortalBackupBundle,
  renameComponent,
  renameSubject,
  saveConfig,
  savePortalUser,
  saveStudent,
  saveSubjectKkm,
  saveVisibility,
  togglePortalUserActive,
} from '../services/api';
import {
  AdminMenuKey,
  AuthSession,
  GenderCode,
  GradeVisibilityConfig,
  PortalUser,
  SchoolConfig,
  StudentRecord,
} from '../types';
import { resolvePortalBranding } from '../utils/helpers';
import { SchoolLogo } from './SchoolLogo';
import { CsvImportExport } from './admin/CsvImportExport';
import { DashboardAnalytics } from './admin/DashboardAnalytics';
import { LegerView } from './admin/LegerView';
import { SchoolSettingsView } from './admin/SchoolSettingsView';
import { StudentCrudView } from './admin/StudentCrudView';
import { SubjectKkmSettings } from './admin/SubjectKkmSettings';
import { UserManagementView } from './admin/UserManagementView';
import { VisibilitySettingsView } from './admin/VisibilitySettingsView';

interface AdminWorkspaceProps {
  session: AuthSession;
  config: SchoolConfig;
  subjects: string[];
  components: string[];
  visibility: GradeVisibilityConfig;
  students: StudentRecord[];
  users: PortalUser[];
  onDataUpdated: (payload: {
    config?: SchoolConfig;
    subjects?: string[];
    components?: string[];
    visibility?: GradeVisibilityConfig;
    students?: StudentRecord[];
    users?: PortalUser[];
  }) => void;
  onLogout: () => void;
  onToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

const MENU_ITEMS: Array<{
  key: AdminMenuKey;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    description: 'Statistik & ringkasan akademik',
    icon: LayoutDashboard,
  },
  {
    key: 'users',
    label: 'Manajemen User',
    description: 'Akun guru, admin & siswa',
    icon: ShieldCheck,
  },
  {
    key: 'students',
    label: 'Data Siswa',
    description: 'Biodata, JK, email & foto',
    icon: Users,
  },
  {
    key: 'leger',
    label: 'Leger Nilai',
    description: 'Edit nilai & komponen mapel',
    icon: Table2,
  },
  {
    key: 'visibility',
    label: 'Atur Tampil Nilai',
    description: 'Filter mapel, kop & TTD',
    icon: Eye,
  },
  {
    key: 'subjects',
    label: 'Mapel & KKM',
    description: 'Mata pelajaran & komponen',
    icon: BookOpen,
  },
  {
    key: 'csv',
    label: 'Ekspor / Impor CSV',
    description: 'Template & transfer spreadsheet',
    icon: FileSpreadsheet,
  },
  {
    key: 'school',
    label: 'Kop, Tema & Backup',
    description: 'Tema warna, 2 logo & 6 baris kop',
    icon: Palette,
  },
];

export const AdminWorkspace: React.FC<AdminWorkspaceProps> = ({
  session,
  config,
  subjects,
  components,
  visibility,
  students,
  users,
  onDataUpdated,
  onLogout,
  onToast,
}) => {
  const [activeMenu, setActiveMenu] = useState<AdminMenuKey>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const portalBrand = resolvePortalBranding(config);
  const currentMenuMeta = MENU_ITEMS.find((m) => m.key === activeMenu) || MENU_ITEMS[0];

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetchAdminData(session, true);
      onDataUpdated({
        config: res.config,
        subjects: res.subjects,
        components: res.components,
        visibility: res.visibility,
        students: res.students,
        users: res.users,
      });
      onToast('success', 'Data portal berhasil disinkronkan dari Firestore.');
    } catch (err) {
      onToast('error', err instanceof Error ? err.message : 'Gagal menyinkronkan data.');
    } finally {
      setRefreshing(false);
    }
  };

  const wrapAction = async (
    fn: () => Promise<{
      message?: string;
      config?: SchoolConfig;
      subjects?: string[];
      components?: string[];
      visibility?: GradeVisibilityConfig;
      students?: StudentRecord[];
      users?: PortalUser[];
    }>
  ) => {
    try {
      const res = await fn();
      onDataUpdated({
        config: res.config,
        subjects: res.subjects,
        components: res.components,
        visibility: res.visibility,
        students: res.students,
        users: res.users,
      });
      if (res.message) onToast('success', res.message);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan operasi.';
      onToast('error', msg);
      throw err;
    }
  };

  const renderSidebarNav = (isMobile = false) => (
    <div className="flex flex-col h-full bg-theme-gradient text-white">
      {/* Brand Area */}
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
              {session.displayName || 'Panel Admin'} · {students.length} Siswa
            </p>
          </div>
        </div>

        {isMobile && (
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/15"
            aria-label="Tutup menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-3.5 space-y-1 overflow-y-auto">
        {MENU_ITEMS.map((item) => {
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
              <Icon
                className={`w-4 h-4 shrink-0 ${
                  active ? 'text-theme-heading' : 'text-white/80'
                }`}
              />
              <div className="min-w-0">
                <p className="text-sm leading-tight truncate">{item.label}</p>
                <p
                  className={`text-[10px] mt-0.5 truncate ${
                    active ? 'text-slate-500 font-normal' : 'text-white/65'
                  }`}
                >
                  {item.description}
                </p>
              </div>
            </button>
          );
        })}
      </nav>

      {/* Sidebar Footer */}
      <div className="p-3.5 border-t border-white/15">
        <button
          type="button"
          onClick={onLogout}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-white/15 hover:bg-white/25 text-white border border-white/20 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Keluar dari Admin</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-theme-page flex">
      {/* Desktop Left Sidebar */}
      <aside className="no-print hidden lg:block w-68 shrink-0 sticky top-0 h-screen shadow-lg">
        {renderSidebarNav(false)}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="no-print fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 w-72 max-w-[85vw] h-full shadow-2xl">
            {renderSidebarNav(true)}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Clean Single-Row Top Bar */}
        <header className="no-print sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-sm border-b border-theme-soft px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto h-full flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                aria-label="Buka menu navigasi"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs sm:text-sm">
                  <span className="text-slate-400 font-medium hidden sm:inline">
                    Panel Admin
                  </span>
                  <span className="text-slate-300 hidden sm:inline">/</span>
                  <span className="font-bold text-theme-heading truncate">
                    {currentMenuMeta.label}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl disabled:opacity-50 whitespace-nowrap"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Sinkronkan</span>
              </button>

              <button
                type="button"
                onClick={onLogout}
                className="lg:hidden inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl whitespace-nowrap"
              >
                <LogOut className="w-4 h-4" />
                <span>Keluar</span>
              </button>
            </div>
          </div>
        </header>

        {/* Workspace Viewport */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {activeMenu === 'dashboard' && (
            <DashboardAnalytics
              students={students}
              subjects={subjects}
              config={config}
              users={users}
            />
          )}

          {activeMenu === 'users' && (
            <UserManagementView
              users={users}
              students={students}
              subjects={subjects}
              components={components}
              config={config}
              onSaveUser={(mode, input) => wrapAction(() => savePortalUser(session, mode, input))}
              onToggleUserActive={(userId, active) =>
                wrapAction(() => togglePortalUserActive(session, userId, active))
              }
              onDeleteUser={(userId) => wrapAction(() => deletePortalUser(session, userId))}
              onBulkUpdateUsers={(ids, changes) =>
                wrapAction(() => bulkUpdatePortalUsers(session, ids, changes))
              }
              onBulkDeleteUsers={(ids) => wrapAction(() => bulkDeletePortalUsers(session, ids))}
              onImportUsersCsv={(list, mode) =>
                wrapAction(() => importPortalUsers(session, list, mode))
              }
              onSaveStudent={(mode, student, originalNis) =>
                wrapAction(() => saveStudent(session, mode, student, originalNis))
              }
              onDeleteStudent={(nis) => wrapAction(() => deleteStudent(session, nis))}
              onBulkUpdateStudents={(updates) =>
                wrapAction(() => bulkUpdateStudents(session, updates))
              }
              onBulkDeleteStudents={(nisList) =>
                wrapAction(() => bulkDeleteStudents(session, nisList))
              }
              onImportStudentsCsv={(list, subjs, mode, comps) =>
                wrapAction(() => importStudents(session, list, subjs, mode, comps))
              }
              onToast={onToast}
            />
          )}

          {activeMenu === 'students' && (
            <StudentCrudView
              students={students}
              subjects={subjects}
              components={components}
              config={config}
              onSaveStudent={(mode, student, originalNis) =>
                wrapAction(() => saveStudent(session, mode, student, originalNis))
              }
              onDeleteStudent={(nis) => wrapAction(() => deleteStudent(session, nis))}
              onBulkUpdateStudents={(
                updates: Array<{
                  nis: string;
                  kelas?: string;
                  status?: string;
                  jenisKelamin?: GenderCode;
                }>
              ) => wrapAction(() => bulkUpdateStudents(session, updates))}
              onBulkDeleteStudents={(nisList) =>
                wrapAction(() => bulkDeleteStudents(session, nisList))
              }
              onImportCsv={(list, subjs, mode, comps) =>
                wrapAction(() => importStudents(session, list, subjs, mode, comps))
              }
              onToast={onToast}
            />
          )}

          {activeMenu === 'leger' && (
            <LegerView
              students={students}
              subjects={subjects}
              components={components}
              config={config}
              visibility={visibility}
              onBulkUpdateScores={(updates) =>
                wrapAction(() => bulkUpdateStudents(session, updates))
              }
              onImportCsv={(list, subjs, mode, comps) =>
                wrapAction(() => importStudents(session, list, subjs, mode, comps))
              }
              onToast={onToast}
            />
          )}

          {activeMenu === 'visibility' && (
            <VisibilitySettingsView
              subjects={subjects}
              components={components}
              visibility={visibility}
              config={config}
              onSaveVisibility={(nextVis) => wrapAction(() => saveVisibility(session, nextVis))}
              onSavePrintFlags={(flags) => wrapAction(() => saveConfig(session, flags))}
            />
          )}

          {activeMenu === 'subjects' && (
            <SubjectKkmSettings
              subjects={subjects}
              components={components}
              config={config}
              onAddSubject={(name) => wrapAction(() => addSubject(session, name))}
              onRenameSubject={(oldN, newN) =>
                wrapAction(() => renameSubject(session, oldN, newN))
              }
              onDeleteSubject={(name) => wrapAction(() => deleteSubject(session, name))}
              onAddComponent={(name) => wrapAction(() => addComponent(session, name))}
              onRenameComponent={(oldN, newN) =>
                wrapAction(() => renameComponent(session, oldN, newN))
              }
              onDeleteComponent={(name) => wrapAction(() => deleteComponent(session, name))}
              onUpdateKkm={(kkm) => wrapAction(() => saveConfig(session, { kkm }))}
              onUpdateSubjectKkm={(subjectKkm) =>
                wrapAction(() => saveSubjectKkm(session, subjectKkm))
              }
            />
          )}

          {activeMenu === 'csv' && (
            <CsvImportExport
              students={students}
              subjects={subjects}
              components={components}
              config={config}
              onImport={(list, subjs, mode, comps) =>
                wrapAction(() => importStudents(session, list, subjs, mode, comps))
              }
              onToast={onToast}
            />
          )}

          {activeMenu === 'school' && (
            <SchoolSettingsView
              config={config}
              subjects={subjects}
              components={components}
              visibility={visibility}
              students={students}
              users={users}
              onSaveConfig={(partial) => wrapAction(() => saveConfig(session, partial))}
              onImportPortalBundle={(bundle: PortalBackupBundle, mode) =>
                wrapAction(() => importPortalBundle(session, bundle, mode))
              }
              onToast={onToast}
            />
          )}
        </main>
      </div>
    </div>
  );
};
