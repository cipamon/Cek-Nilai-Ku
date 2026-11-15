import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit3,
  Eye,
  EyeOff,
  GraduationCap,
  KeyRound,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  UserCheck,
  UserX,
  Users,
  X,
} from 'lucide-react';
import { SavePortalUserInput } from '../../services/api';
import {
  GenderCode,
  PortalUser,
  PortalUserRole,
  SchoolConfig,
  StudentRecord,
} from '../../types';
import { buildStudentsCsv, buildUsersCsv, downloadTextFile } from '../../utils/helpers';
import { ConfirmModal } from '../ConfirmModal';
import { StudentPhoto } from '../StudentPhoto';
import { BulkEditModal } from './BulkEditModal';
import { CsvImportModal } from './CsvImportModal';
import { StudentFormModal } from './StudentFormModal';
import { UserBulkEditModal } from './UserBulkEditModal';
import { UserCsvImportModal } from './UserCsvImportModal';

interface UserManagementViewProps {
  users: PortalUser[];
  students: StudentRecord[];
  subjects: string[];
  components: string[];
  config: SchoolConfig;
  onSaveUser: (mode: 'add' | 'edit', input: SavePortalUserInput) => Promise<void>;
  onToggleUserActive: (userId: string, active: boolean) => Promise<void>;
  onDeleteUser: (userId: string) => Promise<void>;
  onBulkUpdateUsers: (
    userIds: string[],
    changes: {
      active?: boolean;
      assignedSubjects?: string[];
      assignedClasses?: string[];
    }
  ) => Promise<void>;
  onBulkDeleteUsers: (userIds: string[]) => Promise<void>;
  onImportUsersCsv: (users: SavePortalUserInput[], mode: 'upsert' | 'skip') => Promise<void>;
  onSaveStudent: (
    mode: 'add' | 'edit',
    student: StudentRecord,
    originalNis?: string
  ) => Promise<void>;
  onDeleteStudent: (nis: string) => Promise<void>;
  onBulkUpdateStudents: (
    updates: Array<{
      nis: string;
      kelas?: string;
      status?: string;
      jenisKelamin?: GenderCode;
    }>
  ) => Promise<void>;
  onBulkDeleteStudents: (nisList: string[]) => Promise<void>;
  onImportStudentsCsv: (
    students: StudentRecord[],
    subjectsFromCsv: string[],
    mode: 'upsert' | 'skip',
    componentsFromCsv: string[]
  ) => Promise<void>;
  onToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

type RoleTab = 'guru' | 'admin' | 'siswa';

const STUDENT_PAGE_SIZE = 50;

export const UserManagementView: React.FC<UserManagementViewProps> = ({
  users,
  students,
  subjects,
  components,
  config,
  onSaveUser,
  onToggleUserActive,
  onDeleteUser,
  onBulkUpdateUsers,
  onBulkDeleteUsers,
  onImportUsersCsv,
  onSaveStudent,
  onDeleteStudent,
  onBulkUpdateStudents,
  onBulkDeleteStudents,
  onImportStudentsCsv,
  onToast,
}) => {
  const [roleTab, setRoleTab] = useState<RoleTab>('guru');
  const [search, setSearch] = useState('');
  const [revealedStudentNis, setRevealedStudentNis] = useState<Set<string>>(new Set());
  const [studentPage, setStudentPage] = useState(1);

  // Selection states
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [selectedStudentNis, setSelectedStudentNis] = useState<Set<string>>(new Set());

  // Guru / Admin modals
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userModalMode, setUserModalMode] = useState<'add' | 'edit'>('add');
  const [editingUser, setEditingUser] = useState<PortalUser | null>(null);
  const [userBulkEditOpen, setUserBulkEditOpen] = useState(false);
  const [userCsvImportOpen, setUserCsvImportOpen] = useState(false);

  // Student quick credential modal & full form/bulk/csv modals
  const [editingStudent, setEditingStudent] = useState<StudentRecord | null>(null);
  const [studNisnDraft, setStudNisnDraft] = useState('');
  const [studEmailDraft, setStudEmailDraft] = useState('');
  const [studSaving, setStudSaving] = useState(false);

  const [studentFormOpen, setStudentFormOpen] = useState(false);
  const [studentFormMode, setStudentFormMode] = useState<'add' | 'edit'>('add');
  const [fullEditStudent, setFullEditStudent] = useState<StudentRecord | null>(null);
  const [studentBulkEditOpen, setStudentBulkEditOpen] = useState(false);
  const [studentCsvImportOpen, setStudentCsvImportOpen] = useState(false);

  // Delete / busy state
  const [deleteTarget, setDeleteTarget] = useState<
    | { kind: 'singleUser'; user: PortalUser }
    | { kind: 'bulkUsers'; userIds: string[] }
    | { kind: 'singleStudent'; student: StudentRecord }
    | { kind: 'bulkStudents'; nisList: string[] }
    | null
  >(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const classList = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      if (s.kelas) set.add(s.kelas);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'id', { numeric: true }));
  }, [students]);

  const existingUsernames = useMemo(() => {
    const set = new Set<string>(['admin']);
    users.forEach((u) => {
      if (u.username) set.add(u.username.toLowerCase());
    });
    return set;
  }, [users]);

  const guruList = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (u.role !== 'guru') return false;
      if (!q) return true;
      return (
        u.nama.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        (u.nip || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
      );
    });
  }, [users, search]);

  const adminList = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (u.role !== 'admin') return false;
      if (!q) return true;
      return (
        u.nama.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
      );
    });
  }, [users, search]);

  const studentList = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((st) => {
      if (!q) return true;
      return (
        st.nama.toLowerCase().includes(q) ||
        st.nis.toLowerCase().includes(q) ||
        st.nisn.toLowerCase().includes(q) ||
        st.kelas.toLowerCase().includes(q) ||
        (st.email || '').toLowerCase().includes(q)
      );
    });
  }, [students, search]);

  useEffect(() => {
    setStudentPage(1);
  }, [search, roleTab]);

  const totalStudentPages = Math.max(1, Math.ceil(studentList.length / STUDENT_PAGE_SIZE));
  const safeStudentPage = Math.min(studentPage, totalStudentPages);
  const studentPageStart = (safeStudentPage - 1) * STUDENT_PAGE_SIZE;
  const pagedStudents = useMemo(
    () => studentList.slice(studentPageStart, studentPageStart + STUDENT_PAGE_SIZE),
    [studentList, studentPageStart]
  );

  const totalGuru = useMemo(() => users.filter((u) => u.role === 'guru').length, [users]);
  const totalAdmin = useMemo(() => users.filter((u) => u.role === 'admin').length + 1, [users]);

  const activeUserList = roleTab === 'guru' ? guruList : roleTab === 'admin' ? adminList : [];
  const currentTabSelectedUserIds = useMemo(() => {
    if (roleTab === 'siswa') return [];
    const visibleRoleIds = new Set(
      users.filter((u) => u.role === roleTab).map((u) => u.id)
    );
    return Array.from(selectedUserIds).filter((id) => visibleRoleIds.has(id));
  }, [users, roleTab, selectedUserIds]);

  const allTabUsersSelected =
    activeUserList.length > 0 && activeUserList.every((u) => selectedUserIds.has(u.id));

  const allStudentsSelected =
    studentList.length > 0 && studentList.every((st) => selectedStudentNis.has(st.nis));

  const currentSelectionCount =
    roleTab === 'siswa' ? selectedStudentNis.size : currentTabSelectedUserIds.length;

  const toggleUserOne = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const toggleSelectAllUsersInTab = () => {
    if (allTabUsersSelected) {
      setSelectedUserIds((prev) => {
        const next = new Set(prev);
        activeUserList.forEach((u) => next.delete(u.id));
        return next;
      });
    } else {
      setSelectedUserIds((prev) => {
        const next = new Set(prev);
        activeUserList.forEach((u) => next.add(u.id));
        return next;
      });
    }
  };

  const toggleStudentOne = (nis: string) => {
    setSelectedStudentNis((prev) => {
      const next = new Set(prev);
      if (next.has(nis)) next.delete(nis);
      else next.add(nis);
      return next;
    });
  };

  const toggleSelectAllStudents = () => {
    if (allStudentsSelected) {
      setSelectedStudentNis((prev) => {
        const next = new Set(prev);
        studentList.forEach((st) => next.delete(st.nis));
        return next;
      });
    } else {
      setSelectedStudentNis((prev) => {
        const next = new Set(prev);
        studentList.forEach((st) => next.add(st.nis));
        return next;
      });
    }
  };

  const clearCurrentSelection = () => {
    if (roleTab === 'siswa') {
      setSelectedStudentNis(new Set());
    } else {
      setSelectedUserIds((prev) => {
        const next = new Set(prev);
        users.filter((u) => u.role === roleTab).forEach((u) => next.delete(u.id));
        return next;
      });
    }
  };

  const openAddModal = (defaultRole: PortalUserRole) => {
    setUserModalMode('add');
    setEditingUser({
      id: '',
      username: '',
      nama: '',
      email: '',
      nip: '',
      role: defaultRole,
      assignedSubjects: [],
      assignedClasses: [],
      active: true,
    });
    setUserModalOpen(true);
  };

  const openEditModal = (user: PortalUser) => {
    setUserModalMode('edit');
    setEditingUser(user);
    setUserModalOpen(true);
  };

  const handleToggleActive = async (user: PortalUser) => {
    setBusyId(user.id);
    try {
      await onToggleUserActive(user.id, !user.active);
    } finally {
      setBusyId(null);
    }
  };

  const handleExportCurrentTab = () => {
    const dateTag = new Date().toISOString().slice(0, 10);
    if (roleTab === 'siswa') {
      const targetList =
        selectedStudentNis.size > 0
          ? students.filter((s) => selectedStudentNis.has(s.nis))
          : studentList;
      if (targetList.length === 0) {
        onToast('info', 'Tidak ada data siswa untuk diekspor.');
        return;
      }
      const csv = buildStudentsCsv(targetList, subjects, true, config);
      downloadTextFile(csv, `user_siswa_${dateTag}.csv`);
      onToast('success', `${targetList.length} akun siswa berhasil diekspor ke CSV.`);
      return;
    }

    const targetUsers =
      currentTabSelectedUserIds.length > 0
        ? users.filter((u) => currentTabSelectedUserIds.includes(u.id))
        : activeUserList;
    if (targetUsers.length === 0) {
      onToast('info', `Tidak ada akun ${roleTab} untuk diekspor.`);
      return;
    }
    const csv = buildUsersCsv(targetUsers);
    downloadTextFile(csv, `user_${roleTab}_${dateTag}.csv`);
    onToast('success', `${targetUsers.length} akun ${roleTab} berhasil diekspor ke CSV.`);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.kind === 'singleUser') {
        setBusyId(deleteTarget.user.id);
        await onDeleteUser(deleteTarget.user.id);
        setSelectedUserIds((prev) => {
          const next = new Set(prev);
          next.delete(deleteTarget.user.id);
          return next;
        });
      } else if (deleteTarget.kind === 'bulkUsers') {
        await onBulkDeleteUsers(deleteTarget.userIds);
        setSelectedUserIds((prev) => {
          const next = new Set(prev);
          deleteTarget.userIds.forEach((id) => next.delete(id));
          return next;
        });
      } else if (deleteTarget.kind === 'singleStudent') {
        await onDeleteStudent(deleteTarget.student.nis);
        setSelectedStudentNis((prev) => {
          const next = new Set(prev);
          next.delete(deleteTarget.student.nis);
          return next;
        });
      } else if (deleteTarget.kind === 'bulkStudents') {
        await onBulkDeleteStudents(deleteTarget.nisList);
        setSelectedStudentNis(new Set());
      }
      setDeleteTarget(null);
    } finally {
      setBusyId(null);
      setDeleting(false);
    }
  };

  const toggleRevealNisn = (nis: string) => {
    setRevealedStudentNis((prev) => {
      const next = new Set(prev);
      if (next.has(nis)) next.delete(nis);
      else next.add(nis);
      return next;
    });
  };

  const handleSaveStudentCreds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent || !studNisnDraft.trim()) return;
    setStudSaving(true);
    try {
      await onSaveStudent(
        'edit',
        {
          ...editingStudent,
          nisn: studNisnDraft.trim(),
          email: studEmailDraft.trim(),
        },
        editingStudent.nis
      );
      setEditingStudent(null);
    } finally {
      setStudSaving(false);
    }
  };

  const handleApplyUserBulkEdit = async (changes: {
    active?: boolean;
    assignedSubjects?: string[];
    assignedClasses?: string[];
  }) => {
    if (!currentTabSelectedUserIds.length) return;
    await onBulkUpdateUsers(currentTabSelectedUserIds, changes);
    clearCurrentSelection();
  };

  const handleApplyStudentBulkEdit = async (changes: {
    kelas?: string;
    status?: string;
    jenisKelamin?: GenderCode;
  }) => {
    const nisList = Array.from(selectedStudentNis);
    if (!nisList.length) return;
    await onBulkUpdateStudents(nisList.map((nis) => ({ nis, ...changes })));
    setSelectedStudentNis(new Set());
  };

  const deleteModalTitle =
    deleteTarget?.kind === 'bulkUsers'
      ? `Hapus ${deleteTarget.userIds.length} Akun Terpilih?`
      : deleteTarget?.kind === 'bulkStudents'
        ? `Hapus ${deleteTarget.nisList.length} Akun Siswa Terpilih?`
        : deleteTarget?.kind === 'singleStudent'
          ? 'Hapus Data & Akun Siswa?'
          : 'Hapus Akun Pengguna?';

  const deleteModalMessage =
    deleteTarget?.kind === 'bulkUsers'
      ? `${deleteTarget.userIds.length} akun yang dipilih akan dihapus permanen dan tidak dapat login lagi.`
      : deleteTarget?.kind === 'bulkStudents'
        ? `${deleteTarget.nisList.length} siswa beserta kredensial login dan nilainya akan dihapus permanen.`
        : deleteTarget?.kind === 'singleStudent'
          ? `Siswa "${deleteTarget.student.nama}" (NIS ${deleteTarget.student.nis}) beserta nilainya akan dihapus permanen.`
          : deleteTarget?.kind === 'singleUser'
            ? `Akun "${deleteTarget.user.nama}" (${deleteTarget.user.username}) akan dihapus permanen dan tidak bisa login lagi.`
            : '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Manajemen User Portal</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Pilih, edit, hapus, serta ekspor/impor CSV akun Guru, Administrator tambahan, dan
            Siswa.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              roleTab === 'siswa' ? setStudentCsvImportOpen(true) : setUserCsvImportOpen(true)
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl"
          >
            <Upload className="w-4 h-4" />
            <span>Impor CSV</span>
          </button>

          <button
            type="button"
            onClick={handleExportCurrentTab}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl"
          >
            <Download className="w-4 h-4" />
            <span>
              {currentSelectionCount > 0
                ? `Ekspor Terpilih (${currentSelectionCount})`
                : 'Ekspor CSV'}
            </span>
          </button>

          {roleTab === 'siswa' ? (
            <button
              type="button"
              onClick={() => {
                setStudentFormMode('add');
                setFullEditStudent(null);
                setStudentFormOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-theme-primary rounded-xl shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Siswa</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => openAddModal(roleTab === 'admin' ? 'admin' : 'guru')}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-theme-primary rounded-xl shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>{roleTab === 'admin' ? 'Tambah Admin' : 'Tambah Akun Guru'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Role Summary, Tabs & Bulk Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setRoleTab('guru')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors ${
                roleTab === 'guru'
                  ? 'bg-theme-primary text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span>Guru ({totalGuru})</span>
            </button>

            <button
              type="button"
              onClick={() => setRoleTab('admin')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors ${
                roleTab === 'admin'
                  ? 'bg-theme-primary text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Admin ({totalAdmin})</span>
            </button>

            <button
              type="button"
              onClick={() => setRoleTab('siswa')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors ${
                roleTab === 'siswa'
                  ? 'bg-theme-primary text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Siswa ({students.length})</span>
            </button>
          </div>

          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                roleTab === 'siswa'
                  ? 'Cari siswa, NIS, NISN, atau email...'
                  : 'Cari nama, username, NIP, atau email...'
              }
              className="w-full pl-9 pr-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Bulk Action Bar */}
        {currentSelectionCount > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-theme-soft border border-theme-soft">
            <span className="text-xs sm:text-sm font-semibold text-theme-heading inline-flex items-center gap-2">
              <CheckSquare className="w-4 h-4" />
              {currentSelectionCount} {roleTab === 'siswa' ? 'siswa' : 'akun'} dipilih
            </span>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  roleTab === 'siswa' ? setStudentBulkEditOpen(true) : setUserBulkEditOpen(true)
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-theme-heading bg-white border border-theme-soft hover:bg-slate-50 rounded-lg"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>
                  {roleTab === 'siswa' ? 'Edit Kelas / JK / Status' : 'Edit Terpilih'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleExportCurrentTab}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Ekspor Terpilih</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setDeleteTarget(
                    roleTab === 'siswa'
                      ? { kind: 'bulkStudents', nisList: Array.from(selectedStudentNis) }
                      : { kind: 'bulkUsers', userIds: currentTabSelectedUserIds }
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Terpilih</span>
              </button>

              <button
                type="button"
                onClick={clearCurrentSelection}
                className="px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Batal Pilihan
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Role Table Content */}
      {roleTab === 'guru' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <th className="py-3 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={allTabUsersSelected}
                      onChange={toggleSelectAllUsersInTab}
                      title="Pilih semua guru"
                      className="rounded border-slate-300 text-theme-primary"
                    />
                  </th>
                  <th className="py-3 px-4">Nama Guru & Kontak</th>
                  <th className="py-3 px-4">Username</th>
                  <th className="py-3 px-4">Mapel Diampu</th>
                  <th className="py-3 px-4">Kelas Diampu</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {guruList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-sm text-slate-500">
                      Belum ada akun guru terdaftar. Klik &ldquo;Tambah Akun Guru&rdquo; atau
                      &ldquo;Impor CSV&rdquo;.
                    </td>
                  </tr>
                ) : (
                  guruList.map((u) => {
                    const checked = selectedUserIds.has(u.id);
                    return (
                      <tr
                        key={u.id}
                        className={`hover:bg-slate-50/80 ${checked ? 'bg-theme-soft/30' : ''}`}
                      >
                        <td className="py-3 px-4">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleUserOne(u.id)}
                            className="rounded border-slate-300 text-theme-primary"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-900">{u.nama}</p>
                          <p className="text-xs text-slate-500">
                            {u.nip ? `NIP. ${u.nip}` : 'Tanpa NIP'}
                            {u.email ? ` · ${u.email}` : ''}
                          </p>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-800">
                          {u.username}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-700 max-w-[220px]">
                          {u.assignedSubjects.length === 0 ? (
                            <span className="text-slate-500 italic">Semua Mapel</span>
                          ) : (
                            <span>{u.assignedSubjects.join(', ')}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-700 max-w-[180px]">
                          {u.assignedClasses.length === 0 ? (
                            <span className="text-slate-500 italic">Semua Kelas</span>
                          ) : (
                            <span>{u.assignedClasses.join(', ')}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold ${
                              u.active
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {u.active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditModal(u)}
                              className="p-2 rounded-lg text-slate-500 hover:text-theme-heading hover:bg-theme-soft"
                              title="Edit akun & penugasan"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              disabled={busyId === u.id}
                              onClick={() => void handleToggleActive(u)}
                              className="p-2 rounded-lg text-slate-500 hover:text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                              title={u.active ? 'Nonaktifkan akun' : 'Aktifkan akun'}
                            >
                              {u.active ? (
                                <UserX className="w-4 h-4" />
                              ) : (
                                <UserCheck className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              type="button"
                              disabled={busyId === u.id}
                              onClick={() => setDeleteTarget({ kind: 'singleUser', user: u })}
                              className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                              title="Hapus akun guru"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {roleTab === 'admin' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <th className="py-3 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={allTabUsersSelected}
                      disabled={adminList.length === 0}
                      onChange={toggleSelectAllUsersInTab}
                      title="Pilih semua admin tambahan"
                      className="rounded border-slate-300 text-theme-primary disabled:opacity-40"
                    />
                  </th>
                  <th className="py-3 px-4">Nama Administrator</th>
                  <th className="py-3 px-4">Username</th>
                  <th className="py-3 px-4">Email / NIP</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {/* Primary Super Admin (protected) */}
                <tr className="bg-theme-soft/25">
                  <td className="py-3 px-4 text-slate-300 text-xs">—</td>
                  <td className="py-3 px-4">
                    <p className="font-bold text-slate-900">Administrator Utama</p>
                    <p className="text-xs text-slate-500">Akun bawaan sistem (penuh)</p>
                  </td>
                  <td className="py-3 px-4 font-mono text-xs font-bold text-theme-heading">
                    admin
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-500">-</td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-emerald-100 text-emerald-800">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Utama</span>
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-xs text-slate-400">Terlindungi</td>
                </tr>

                {adminList.map((u) => {
                  const checked = selectedUserIds.has(u.id);
                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-slate-50/80 ${checked ? 'bg-theme-soft/30' : ''}`}
                    >
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleUserOne(u.id)}
                          className="rounded border-slate-300 text-theme-primary"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-900">{u.nama}</p>
                        <p className="text-xs text-slate-500">Administrator Tambahan</p>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-800">
                        {u.username}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">
                        {u.email || u.nip || '-'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-lg text-[11px] font-bold ${
                            u.active
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {u.active ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(u)}
                            className="p-2 rounded-lg text-slate-500 hover:text-theme-heading hover:bg-theme-soft"
                            title="Edit admin"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            disabled={busyId === u.id}
                            onClick={() => void handleToggleActive(u)}
                            className="p-2 rounded-lg text-slate-500 hover:text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                            title={u.active ? 'Nonaktifkan akun' : 'Aktifkan akun'}
                          >
                            {u.active ? (
                              <UserX className="w-4 h-4" />
                            ) : (
                              <UserCheck className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            type="button"
                            disabled={busyId === u.id}
                            onClick={() => setDeleteTarget({ kind: 'singleUser', user: u })}
                            className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                            title="Hapus akun admin"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {roleTab === 'siswa' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2">
            <span>
              Siswa masuk portal menggunakan <strong>NIS</strong> sebagai Username dan{' '}
              <strong>NISN</strong> sebagai Password.
            </span>
            <span className="font-semibold text-slate-700 tabular-nums">
              {studentList.length} siswa ditemukan
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <th className="py-3 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={allStudentsSelected}
                      onChange={toggleSelectAllStudents}
                      title="Pilih semua siswa yang sesuai pencarian"
                      className="rounded border-slate-300 text-theme-primary"
                    />
                  </th>
                  <th className="py-3 px-4">Siswa</th>
                  <th className="py-3 px-4">Kelas</th>
                  <th className="py-3 px-4">Username (NIS)</th>
                  <th className="py-3 px-4">Password (NISN)</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4 text-right">Aksi &amp; Kredensial</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {pagedStudents.map((st) => {
                  const revealed = revealedStudentNis.has(st.nis);
                  const checked = selectedStudentNis.has(st.nis);
                  return (
                    <tr
                      key={st.nis}
                      className={`hover:bg-slate-50/80 ${checked ? 'bg-theme-soft/30' : ''}`}
                    >
                      <td className="py-2.5 px-4">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleStudentOne(st.nis)}
                          className="rounded border-slate-300 text-theme-primary"
                        />
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <StudentPhoto
                            photoUrl={st.photoUrl}
                            studentName={st.nama}
                            gender={st.jenisKelamin}
                            sizeClass="w-8 h-8"
                            roundedClass="rounded-lg"
                          />
                          <span className="font-bold text-slate-900 truncate max-w-[200px]">
                            {st.nama}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-xs text-slate-700">{st.kelas || '-'}</td>
                      <td className="py-2.5 px-4 font-mono text-xs font-semibold text-slate-800">
                        {st.nis}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-xs text-slate-700">
                        <div className="inline-flex items-center gap-1.5">
                          <span>{revealed ? st.nisn : '••••••••••'}</span>
                          <button
                            type="button"
                            onClick={() => toggleRevealNisn(st.nis)}
                            className="p-1 rounded text-slate-400 hover:text-slate-700"
                            title={revealed ? 'Sembunyikan' : 'Lihat NISN'}
                          >
                            {revealed ? (
                              <EyeOff className="w-3.5 h-3.5" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-xs text-slate-600 truncate max-w-[180px]">
                        {st.email || '-'}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingStudent(st);
                              setStudNisnDraft(st.nisn);
                              setStudEmailDraft(st.email || '');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-theme-heading bg-theme-soft hover:opacity-90 rounded-lg"
                            title="Reset NISN & Email"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">NISN / Email</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setStudentFormMode('edit');
                              setFullEditStudent(st);
                              setStudentFormOpen(true);
                            }}
                            className="p-2 rounded-lg text-slate-500 hover:text-theme-heading hover:bg-theme-soft"
                            title="Edit lengkap biodata & nilai"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget({ kind: 'singleStudent', student: st })}
                            className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            title="Hapus akun & data siswa"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {studentList.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-sm text-slate-500">
                      Tidak ada siswa yang sesuai pencarian.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {studentList.length > 0 && (
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
              <span>
                Menampilkan{' '}
                <strong>
                  {studentPageStart + 1}–
                  {Math.min(studentPageStart + STUDENT_PAGE_SIZE, studentList.length)}
                </strong>{' '}
                dari <strong>{studentList.length}</strong> siswa
              </span>

              {totalStudentPages > 1 && (
                <div className="inline-flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={safeStudentPage <= 1}
                    onClick={() => setStudentPage((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 font-semibold"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Sebelumnya</span>
                  </button>
                  <span className="px-2 font-semibold tabular-nums">
                    Hal {safeStudentPage} / {totalStudentPages}
                  </span>
                  <button
                    type="button"
                    disabled={safeStudentPage >= totalStudentPages}
                    onClick={() => setStudentPage((p) => Math.min(totalStudentPages, p + 1))}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 font-semibold"
                  >
                    <span>Berikutnya</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal Add/Edit Guru or Admin */}
      <UserFormModal
        open={userModalOpen}
        mode={userModalMode}
        initialUser={editingUser}
        subjects={subjects}
        classes={classList}
        onClose={() => setUserModalOpen(false)}
        onSave={onSaveUser}
      />

      {/* Modal Bulk Edit Guru / Admin */}
      <UserBulkEditModal
        open={userBulkEditOpen}
        selectedCount={currentTabSelectedUserIds.length}
        hasGuruSelected={roleTab === 'guru'}
        subjects={subjects}
        classes={classList}
        onClose={() => setUserBulkEditOpen(false)}
        onApply={handleApplyUserBulkEdit}
      />

      {/* Modal Import CSV Guru / Admin */}
      <UserCsvImportModal
        open={userCsvImportOpen}
        existingUsernames={existingUsernames}
        onClose={() => setUserCsvImportOpen(false)}
        onImport={onImportUsersCsv}
      />

      {/* Modal Add/Edit Full Student */}
      <StudentFormModal
        open={studentFormOpen}
        mode={studentFormMode}
        initialStudent={fullEditStudent}
        subjects={subjects}
        components={components}
        config={config}
        onClose={() => setStudentFormOpen(false)}
        onSave={onSaveStudent}
      />

      {/* Modal Bulk Edit Siswa */}
      <BulkEditModal
        open={studentBulkEditOpen}
        selectedCount={selectedStudentNis.size}
        onClose={() => setStudentBulkEditOpen(false)}
        onApply={handleApplyStudentBulkEdit}
      />

      {/* Modal Import CSV Siswa */}
      <CsvImportModal
        open={studentCsvImportOpen}
        subjects={subjects}
        components={components}
        onClose={() => setStudentCsvImportOpen(false)}
        onImport={onImportStudentsCsv}
      />

      {/* Modal Quick Edit Student Password (NISN) & Email */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Kredensial Akun Siswa
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editingStudent.nama} (NIS {editingStudent.nis})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveStudentCreds} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  NISN / Password Login Siswa
                </label>
                <input
                  type="text"
                  required
                  value={studNisnDraft}
                  onChange={(e) => setStudNisnDraft(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Siswa
                </label>
                <input
                  type="email"
                  value={studEmailDraft}
                  onChange={(e) => setStudEmailDraft(e.target.value)}
                  placeholder="nama.siswa@sekolah.sch.id"
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={studSaving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-theme-primary rounded-xl disabled:opacity-50"
                >
                  {studSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Simpan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      <ConfirmModal
        open={Boolean(deleteTarget)}
        title={deleteModalTitle}
        message={deleteModalMessage}
        confirmLabel="Ya, Hapus"
        loading={deleting || Boolean(busyId)}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};

interface UserFormModalProps {
  open: boolean;
  mode: 'add' | 'edit';
  initialUser: PortalUser | null;
  subjects: string[];
  classes: string[];
  onClose: () => void;
  onSave: (mode: 'add' | 'edit', input: SavePortalUserInput) => Promise<void>;
}

const UserFormModal: React.FC<UserFormModalProps> = ({
  open,
  mode,
  initialUser,
  subjects,
  classes,
  onClose,
  onSave,
}) => {
  const [role, setRole] = useState<PortalUserRole>('guru');
  const [nama, setNama] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [nip, setNip] = useState('');
  const [email, setEmail] = useState('');
  const [assignedSubjects, setAssignedSubjects] = useState<string[]>([]);
  const [assignedClasses, setAssignedClasses] = useState<string[]>([]);
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (!open || !initialUser) return;
    setRole(initialUser.role);
    setNama(initialUser.nama);
    setUsername(initialUser.username);
    setPassword('');
    setNip(initialUser.nip || '');
    setEmail(initialUser.email || '');
    setAssignedSubjects(initialUser.assignedSubjects || []);
    setAssignedClasses(initialUser.assignedClasses || []);
    setActive(initialUser.active);
  }, [open, initialUser]);

  if (!open) return null;

  const toggleItem = (list: string[], setList: (v: string[]) => void, item: string) => {
    if (list.includes(item)) setList(list.filter((x) => x !== item));
    else setList([...list, item]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(mode, {
        id: initialUser?.id,
        role,
        nama: nama.trim(),
        username: username.trim(),
        password: password.trim() || undefined,
        nip: nip.trim(),
        email: email.trim(),
        assignedSubjects: role === 'guru' ? assignedSubjects : [],
        assignedClasses: role === 'guru' ? assignedClasses : [],
        active,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="w-full max-w-2xl max-h-[92vh] bg-white rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              {mode === 'add' ? 'Tambah Akun Guru / Admin' : `Edit Akun: ${initialUser?.nama || ''}`}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Akun langsung dapat masuk melalui halaman login satu pintu.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Peran Akun</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as PortalUserRole)}
                className="w-full px-3.5 py-2 text-sm font-semibold bg-slate-50 border border-slate-300 rounded-xl"
              >
                <option value="guru">Guru (Dashboard Guru & Input Nilai Mapel)</option>
                <option value="admin">Administrator (Akses Panel Admin)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Status Akun
              </label>
              <label className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="rounded border-slate-300 text-theme-primary"
                />
                <span className="text-sm font-medium text-slate-800">
                  {active ? 'Aktif (Boleh Login)' : 'Nonaktif'}
                </span>
              </label>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nama Lengkap & Gelar (Wajib)
              </label>
              <input
                type="text"
                required
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder="Contoh: Budi Hartono, S.Pd."
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Username Login (Wajib)
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Contoh: budi.guru"
                className="w-full px-3.5 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {mode === 'add' ? 'Password Login (Min. 4 karakter)' : 'Password Baru (Opsional)'}
              </label>
              <input
                type="password"
                required={mode === 'add'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={
                  mode === 'add' ? 'Minimal 4 karakter' : 'Kosongkan jika tidak mengubah password'
                }
                className="w-full px-3.5 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                NIP / NUPTK (Opsional)
              </label>
              <input
                type="text"
                value={nip}
                onChange={(e) => setNip(e.target.value)}
                placeholder="198501012010011001"
                className="w-full px-3.5 py-2 text-sm font-mono bg-slate-50 border border-slate-300 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email (Opsional)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="guru@sekolah.sch.id"
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl"
              />
            </div>
          </div>

          {role === 'guru' && (
            <div className="space-y-4 pt-2 border-t border-slate-200">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-xs font-bold text-slate-800">
                      Mata Pelajaran yang Diampu ({assignedSubjects.length || 'Semua'})
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Kosongkan semua bila guru mengampu seluruh mata pelajaran.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setAssignedSubjects(
                        assignedSubjects.length === subjects.length ? [] : [...subjects]
                      )
                    }
                    className="text-xs font-semibold text-theme-heading hover:underline"
                  >
                    {assignedSubjects.length === subjects.length ? 'Reset Semua' : 'Pilih Semua'}
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto p-3 rounded-xl bg-slate-50 border border-slate-200">
                  {subjects.map((subj) => (
                    <label key={subj} className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={assignedSubjects.includes(subj)}
                        onChange={() => toggleItem(assignedSubjects, setAssignedSubjects, subj)}
                        className="rounded border-slate-300 text-theme-primary"
                      />
                      <span className="truncate text-slate-800 font-medium">{subj}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-xs font-bold text-slate-800">
                      Kelas yang Diampu ({assignedClasses.length || 'Semua'})
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Kosongkan semua bila guru mengampu seluruh kelas.
                    </p>
                  </div>
                  {classes.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setAssignedClasses(
                          assignedClasses.length === classes.length ? [] : [...classes]
                        )
                      }
                      className="text-xs font-semibold text-theme-heading hover:underline"
                    >
                      {assignedClasses.length === classes.length ? 'Reset Semua' : 'Pilih Semua'}
                    </button>
                  )}
                </div>
                {classes.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">
                    Belum ada rombel kelas pada data siswa.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-32 overflow-y-auto p-3 rounded-xl bg-slate-50 border border-slate-200">
                    {classes.map((cls) => (
                      <label key={cls} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={assignedClasses.includes(cls)}
                          onChange={() => toggleItem(assignedClasses, setAssignedClasses, cls)}
                          className="rounded border-slate-300 text-theme-primary"
                        />
                        <span className="truncate text-slate-800 font-medium">{cls}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-theme-primary rounded-xl disabled:opacity-50"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{mode === 'add' ? 'Buat Akun' : 'Simpan Perubahan'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
