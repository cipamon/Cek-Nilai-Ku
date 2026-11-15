export type ThemePresetId =
  | 'royal-violet'
  | 'bright-blue'
  | 'emerald-teal'
  | 'crimson-rose'
  | 'amber-gold'
  | 'teal-cyan';

export type GenderCode = 'L' | 'P' | '';

export type SignatureDisplayMode = 'both' | 'headmaster' | 'teacher' | 'none';

export interface SchoolConfig {
  name: string;
  subtitle: string;
  address: string;
  logoUrl: string;
  logoRightUrl?: string;
  kopLines?: string[];
  headmasterName?: string;
  headmasterNip?: string;
  cityName?: string;
  showKopSurat?: boolean;
  showHeadmasterSign?: boolean;
  signatureMode?: SignatureDisplayMode;
  teacherSignTitle?: string;
  teacherSignName?: string;
  teacherSignNip?: string;
  loginLogoUrl?: string;
  loginTitle?: string;
  loginSubtitle?: string;
  loginDescription?: string;
  loginFooterText?: string;
  loginFormTitle?: string;
  loginFormSubtitle?: string;
  showLoginKkm?: boolean;
  theme?: ThemePresetId;
  kkm: number;
  subjectKkm?: Record<string, number>;
}

export interface StudentRecord {
  rowIndex?: number;
  nis: string;
  nisn: string;
  nama: string;
  jenisKelamin?: GenderCode;
  noAbsen: string;
  kelas: string;
  ttl: string;
  email?: string;
  status: string;
  photoUrl?: string;
  scores: Record<string, number>;
  scoreDetails?: Record<string, Record<string, number>>;
}

export type GradeVisibilityMode = 'all' | 'selected';

export interface GradeVisibilityConfig {
  mode: GradeVisibilityMode;
  visibleSubjects: string[];
  visibleComponents: string[];
  showComponentDetails: boolean;
  showAverageAndStatus: boolean;
  applyToAdminViews: boolean;
  showStudentPhoto?: boolean;
  showPrintButton?: boolean;
}

export type PortalUserRole = 'admin' | 'guru';

export interface PortalUser {
  id: string;
  username: string;
  nama: string;
  email?: string;
  nip?: string;
  role: PortalUserRole;
  assignedSubjects: string[];
  assignedClasses: string[];
  active: boolean;
}

export type UserRole = 'student' | 'guru' | 'admin';

export interface AuthSession {
  role: UserRole;
  username: string;
  password: string;
  workspaceKey?: string;
  displayName?: string;
  email?: string;
  nip?: string;
  userId?: string;
  assignedSubjects?: string[];
  assignedClasses?: string[];
}

export type AdminMenuKey =
  | 'dashboard'
  | 'users'
  | 'students'
  | 'leger'
  | 'visibility'
  | 'subjects'
  | 'csv'
  | 'school';

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export interface ApiResponse {
  ok: boolean;
  error?: string;
  message?: string;
  role?: UserRole;
  session?: AuthSession;
  config?: SchoolConfig;
  subjects?: string[];
  components?: string[];
  visibility?: GradeVisibilityConfig;
  students?: StudentRecord[];
  student?: StudentRecord;
  users?: PortalUser[];
  user?: PortalUser;
  stats?: {
    inserted: number;
    updated: number;
    skipped: number;
  };
}
