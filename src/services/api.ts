import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore';
import {
  db,
  handleFirestoreError,
  OperationType,
  testFirestoreConnection,
} from '../firebase';
import {
  ApiResponse,
  AuthSession,
  GenderCode,
  GradeVisibilityConfig,
  PortalUser,
  PortalUserRole,
  SchoolConfig,
  SignatureDisplayMode,
  StudentRecord,
  ThemePresetId,
} from '../types';
import {
  computeSubjectFinalScore,
  convertGDriveUrl,
  DEFAULT_ASSESSMENT_COMPONENTS,
  DEFAULT_GRADE_VISIBILITY,
  DEFAULT_SCHOOL_CONFIG,
  normalizeGender,
  normalizeKopLines,
  resolveSignatureMode,
  sortStudents,
} from '../utils/helpers';

const SESSION_STORAGE_KEY = 'portal_nilai_auth_session';
const PUBLIC_CACHE_KEY = 'portal_nilai_public_cache_v1';

const DEFAULT_SUBJECTS = [
  'Matematika',
  'Bahasa Indonesia',
  'Bahasa Inggris',
  'IPA',
  'IPS',
];

const SCHOOL_DOC_PATH = 'school_settings/main';
const ACADEMIC_DOC_PATH = 'academic_settings/main';

interface CachedAdminEntry {
  student: StudentRecord;
  token: string;
}

interface CachedPortalUserEntry {
  user: PortalUser;
  loginToken: string;
}

interface AdminMemoryCache {
  adminKey: string;
  bootstrapped: boolean;
  config: SchoolConfig;
  subjects: string[];
  components: string[];
  visibility: GradeVisibilityConfig;
  studentsByNis: Map<string, CachedAdminEntry>;
  usersById: Map<string, CachedPortalUserEntry>;
}

let adminCache: AdminMemoryCache | null = null;

export function clearAdminCache(): void {
  adminCache = null;
}

export function getCachedPublicSettings(): {
  config: SchoolConfig;
  subjects: string[];
  components: string[];
  visibility: GradeVisibilityConfig;
} | null {
  try {
    const raw = localStorage.getItem(PUBLIC_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      config: normalizeSchoolConfig(parsed.config),
      subjects: Array.isArray(parsed.subjects)
        ? parsed.subjects.map((s: unknown) => String(s).trim()).filter(Boolean)
        : [...DEFAULT_SUBJECTS],
      components: Array.isArray(parsed.components)
        ? parsed.components.map((c: unknown) => String(c).trim()).filter(Boolean)
        : [...DEFAULT_ASSESSMENT_COMPONENTS],
      visibility: normalizeVisibility(parsed.visibility),
    };
  } catch {
    return null;
  }
}

function savePublicCache(payload: {
  config: SchoolConfig;
  subjects: string[];
  components: string[];
  visibility: GradeVisibilityConfig;
}): void {
  try {
    localStorage.setItem(PUBLIC_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota errors
  }
}

export function getSavedSession(): AuthSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      (parsed.role === 'admin' || parsed.role === 'guru' || parsed.role === 'student') &&
      parsed.username
    ) {
      return parsed as AuthSession;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveSession(session: AuthSession | null): void {
  try {
    if (session) {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } else {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      clearAdminCache();
    }
  } catch {
    // Ignore storage errors
  }
}

export function nisToDocId(nis: string): string {
  const clean = nis.trim().slice(0, 50);
  const bytes = new TextEncoder().encode(clean);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `s_${hex}`.slice(0, 128);
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function computeStudentPortalToken(nis: string, nisn: string): Promise<string> {
  return sha256Hex(`${nis.trim()}:${nisn.trim()}`);
}

export async function computeAdminWorkspaceKey(
  username: string,
  password: string
): Promise<string> {
  return sha256Hex(`portal-akademik-admin:${username.trim()}:${password}`);
}

export async function computeUserSessionToken(
  username: string,
  password: string
): Promise<string> {
  return sha256Hex(`portal-akademik-user:${username.trim().toLowerCase()}:${password.trim()}`);
}

function roundTwo(val: number): number {
  return Math.round(val * 100) / 100;
}

function clampScore(val: unknown): number {
  const num = Number(val);
  if (isNaN(num)) return 0;
  return roundTwo(Math.max(0, Math.min(100, num)));
}

const VALID_THEMES: ThemePresetId[] = [
  'royal-violet',
  'bright-blue',
  'emerald-teal',
  'crimson-rose',
  'amber-gold',
  'teal-cyan',
];

function normalizeThemeId(raw?: unknown): ThemePresetId {
  const s = String(raw || '').trim() as ThemePresetId;
  return VALID_THEMES.includes(s) ? s : 'royal-violet';
}

function normalizeSubjectKkm(raw?: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, number> = {};
  const entries = Object.entries(raw as Record<string, unknown>).slice(0, 60);
  for (const [key, val] of entries) {
    const cleanKey = key.trim().slice(0, 100);
    const num = Number(val);
    if (cleanKey && !isNaN(num) && num >= 0 && num <= 100) {
      out[cleanKey] = roundTwo(num);
    }
  }
  return out;
}

function normalizeSignatureMode(
  rawMode: unknown,
  showHeadmasterSign?: unknown
): SignatureDisplayMode {
  const s = String(rawMode || '').trim();
  if (s === 'both' || s === 'headmaster' || s === 'teacher' || s === 'none') {
    return s;
  }
  return showHeadmasterSign === false ? 'none' : 'headmaster';
}

function normalizeSchoolConfig(data?: DocumentData): SchoolConfig {
  if (!data) {
    return {
      ...DEFAULT_SCHOOL_CONFIG,
      kopLines: normalizeKopLines(undefined, DEFAULT_SCHOOL_CONFIG),
      subjectKkm: {},
    };
  }
  const parsedKkm = Number(data.kkm);
  const name = String(data.name || DEFAULT_SCHOOL_CONFIG.name).slice(0, 150);
  const subtitle = String(data.subtitle ?? DEFAULT_SCHOOL_CONFIG.subtitle).slice(0, 200);
  const address = String(data.address ?? DEFAULT_SCHOOL_CONFIG.address).slice(0, 300);
  const signatureMode = normalizeSignatureMode(data.signatureMode, data.showHeadmasterSign);
  const showHeadmasterSign =
    signatureMode === 'headmaster' || signatureMode === 'both';

  return {
    name,
    subtitle,
    address,
    logoUrl: String(data.logoUrl ?? DEFAULT_SCHOOL_CONFIG.logoUrl).slice(0, 500),
    logoRightUrl: String(data.logoRightUrl ?? '').slice(0, 500),
    kopLines: normalizeKopLines(data.kopLines, { name, subtitle, address }),
    headmasterName: String(data.headmasterName ?? '').slice(0, 150),
    headmasterNip: String(data.headmasterNip ?? '').slice(0, 60),
    cityName: String(data.cityName ?? '').slice(0, 100),
    showKopSurat: typeof data.showKopSurat === 'boolean' ? data.showKopSurat : true,
    showHeadmasterSign,
    signatureMode,
    teacherSignTitle: String(data.teacherSignTitle ?? 'Guru / Wali Kelas').slice(0, 100),
    teacherSignName: String(data.teacherSignName ?? '').slice(0, 150),
    teacherSignNip: String(data.teacherSignNip ?? '').slice(0, 60),
    loginLogoUrl: String(data.loginLogoUrl ?? '').slice(0, 500),
    loginTitle: String(data.loginTitle ?? '').slice(0, 150),
    loginSubtitle: String(data.loginSubtitle ?? '').slice(0, 200),
    loginDescription: String(data.loginDescription ?? '').slice(0, 300),
    loginFooterText: String(
      data.loginFooterText ?? DEFAULT_SCHOOL_CONFIG.loginFooterText ?? ''
    ).slice(0, 120),
    loginFormTitle: String(
      data.loginFormTitle ?? DEFAULT_SCHOOL_CONFIG.loginFormTitle ?? ''
    ).slice(0, 120),
    loginFormSubtitle: String(
      data.loginFormSubtitle ?? DEFAULT_SCHOOL_CONFIG.loginFormSubtitle ?? ''
    ).slice(0, 250),
    showLoginKkm: typeof data.showLoginKkm === 'boolean' ? data.showLoginKkm : true,
    theme: normalizeThemeId(data.theme),
    kkm:
      !isNaN(parsedKkm) && parsedKkm >= 0 && parsedKkm <= 100
        ? parsedKkm
        : DEFAULT_SCHOOL_CONFIG.kkm,
    subjectKkm: normalizeSubjectKkm(data.subjectKkm),
  };
}

function normalizePortalUserDoc(data: DocumentData): PortalUser {
  return {
    id: String(data.id || ''),
    username: String(data.username || ''),
    nama: String(data.nama || ''),
    email: String(data.email || '').trim().slice(0, 150),
    nip: String(data.nip || '').trim().slice(0, 60),
    role: data.role === 'admin' ? 'admin' : 'guru',
    assignedSubjects: Array.isArray(data.assignedSubjects)
      ? data.assignedSubjects.map((s: unknown) => String(s).trim()).filter(Boolean)
      : [],
    assignedClasses: Array.isArray(data.assignedClasses)
      ? data.assignedClasses.map((c: unknown) => String(c).trim()).filter(Boolean)
      : [],
    active: typeof data.active === 'boolean' ? data.active : true,
  };
}

function getSortedUsersFromCache(cache: AdminMemoryCache): PortalUser[] {
  return Array.from(cache.usersById.values())
    .map((e) => e.user)
    .sort((a, b) => {
      if (a.role !== b.role) return a.role === 'admin' ? -1 : 1;
      return a.nama.localeCompare(b.nama, 'id', { sensitivity: 'base' });
    });
}

function normalizeVisibility(raw?: unknown): GradeVisibilityConfig {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_GRADE_VISIBILITY };
  }
  const obj = raw as Record<string, unknown>;
  const mode = obj.mode === 'selected' ? 'selected' : 'all';
  const visibleSubjects = Array.isArray(obj.visibleSubjects)
    ? Array.from(
        new Set(
          obj.visibleSubjects
            .map((s) => String(s).trim().slice(0, 100))
            .filter(Boolean)
        )
      ).slice(0, 50)
    : [];
  const visibleComponents = Array.isArray(obj.visibleComponents)
    ? Array.from(
        new Set(
          obj.visibleComponents
            .map((c) => String(c).trim().slice(0, 100))
            .filter(Boolean)
        )
      ).slice(0, 20)
    : [];

  return {
    mode,
    visibleSubjects,
    visibleComponents,
    showComponentDetails:
      typeof obj.showComponentDetails === 'boolean' ? obj.showComponentDetails : true,
    showAverageAndStatus:
      typeof obj.showAverageAndStatus === 'boolean' ? obj.showAverageAndStatus : true,
    applyToAdminViews:
      typeof obj.applyToAdminViews === 'boolean' ? obj.applyToAdminViews : false,
    showStudentPhoto:
      typeof obj.showStudentPhoto === 'boolean' ? obj.showStudentPhoto : true,
    showPrintButton:
      typeof obj.showPrintButton === 'boolean' ? obj.showPrintButton : true,
  };
}

function normalizeAcademicSettings(data?: DocumentData): {
  subjects: string[];
  components: string[];
  visibility: GradeVisibilityConfig;
} {
  if (!data) {
    return {
      subjects: [...DEFAULT_SUBJECTS],
      components: [...DEFAULT_ASSESSMENT_COMPONENTS],
      visibility: { ...DEFAULT_GRADE_VISIBILITY },
    };
  }
  const subjects = Array.isArray(data.subjects)
    ? data.subjects.map((s) => String(s).trim().slice(0, 100)).filter(Boolean).slice(0, 50)
    : [...DEFAULT_SUBJECTS];
  const components = Array.isArray(data.components)
    ? data.components.map((c) => String(c).trim().slice(0, 100)).filter(Boolean).slice(0, 20)
    : [...DEFAULT_ASSESSMENT_COMPONENTS];
  const visibility = normalizeVisibility(data.visibility);
  return { subjects, components, visibility };
}

function normalizeStudentDoc(data: DocumentData, subjects: string[]): StudentRecord {
  const rawDetails = (data.scoreDetails && typeof data.scoreDetails === 'object'
    ? data.scoreDetails
    : {}) as Record<string, Record<string, unknown>>;
  const rawScores = (data.scores && typeof data.scores === 'object'
    ? data.scores
    : {}) as Record<string, unknown>;

  const scoreDetails: Record<string, Record<string, number>> = {};
  const scores: Record<string, number> = {};

  for (const subj of subjects) {
    const compMapRaw = rawDetails[subj];
    const cleanCompMap: Record<string, number> = {};
    if (compMapRaw && typeof compMapRaw === 'object') {
      for (const [compName, compVal] of Object.entries(compMapRaw)) {
        if (
          compVal !== null &&
          compVal !== undefined &&
          compVal !== '' &&
          !isNaN(Number(compVal))
        ) {
          cleanCompMap[compName] = clampScore(compVal);
        }
      }
    }
    if (Object.keys(cleanCompMap).length > 0) {
      scoreDetails[subj] = cleanCompMap;
      scores[subj] = computeSubjectFinalScore(cleanCompMap, 0);
    } else {
      scores[subj] = clampScore(rawScores[subj] ?? 0);
    }
  }

  const rawPhoto = String(data.photoUrl || '').trim();
  const photoUrl = rawPhoto ? convertGDriveUrl(rawPhoto).converted.slice(0, 500) : '';

  return {
    nis: String(data.nis || ''),
    nisn: String(data.nisn || ''),
    nama: String(data.nama || ''),
    jenisKelamin: normalizeGender(data.jenisKelamin),
    noAbsen: String(data.noAbsen || ''),
    kelas: String(data.kelas || ''),
    ttl: String(data.ttl || ''),
    email: String(data.email || '').trim().slice(0, 150),
    status: String(data.status || 'LULUS') === 'DITANGGUHKAN' ? 'DITANGGUHKAN' : 'LULUS',
    photoUrl,
    scores,
    scoreDetails,
  };
}

function buildSanitizedStudentMaps(
  student: StudentRecord,
  subjects: string[]
): {
  nis: string;
  nisn: string;
  nama: string;
  jenisKelamin: GenderCode;
  noAbsen: string;
  kelas: string;
  ttl: string;
  email: string;
  status: 'LULUS' | 'DITANGGUHKAN';
  photoUrl: string;
  scores: Record<string, number>;
  scoreDetails: Record<string, Record<string, number>>;
} {
  const nis = String(student.nis || '').trim().slice(0, 50);
  const nisn = String(student.nisn || '').trim().slice(0, 50);
  const nama = String(student.nama || '').trim().slice(0, 150);
  const jenisKelamin = normalizeGender(student.jenisKelamin);
  const noAbsen = String(student.noAbsen || '').trim().slice(0, 20);
  const kelas = String(student.kelas || '').trim().slice(0, 50);
  const ttl = String(student.ttl || '').trim().slice(0, 150);
  const email = String(student.email || '').trim().slice(0, 150);
  const status =
    String(student.status || 'LULUS').trim() === 'DITANGGUHKAN' ? 'DITANGGUHKAN' : 'LULUS';
  const rawPhoto = String(student.photoUrl || '').trim();
  const photoUrl = rawPhoto ? convertGDriveUrl(rawPhoto).converted.slice(0, 500) : '';

  const scores: Record<string, number> = {};
  const scoreDetails: Record<string, Record<string, number>> = {};

  for (const subj of subjects.slice(0, 50)) {
    const incomingDetail = student.scoreDetails?.[subj];
    const cleanDetail: Record<string, number> = {};
    if (incomingDetail && typeof incomingDetail === 'object') {
      for (const [k, v] of Object.entries(incomingDetail)) {
        const cleanComp = k.trim().slice(0, 100);
        if (cleanComp && v !== null && v !== undefined && String(v) !== '' && !isNaN(Number(v))) {
          cleanDetail[cleanComp] = clampScore(v);
        }
      }
    }
    if (Object.keys(cleanDetail).length > 0) {
      scoreDetails[subj] = cleanDetail;
      scores[subj] = computeSubjectFinalScore(cleanDetail, 0);
    } else {
      scores[subj] = clampScore(student.scores?.[subj] ?? 0);
    }
  }

  return {
    nis,
    nisn,
    nama,
    jenisKelamin,
    noAbsen,
    kelas,
    ttl,
    email,
    status,
    photoUrl,
    scores,
    scoreDetails,
  };
}

function addWriteProof(batch: ReturnType<typeof writeBatch>, adminKey: string): void {
  batch.set(doc(db, 'workspaces', adminKey, 'meta', 'write_proof'), {
    updatedAt: serverTimestamp(),
  });
}

function getSortedStudentsFromCache(cache: AdminMemoryCache): StudentRecord[] {
  return sortStudents(Array.from(cache.studentsByNis.values()).map((entry) => entry.student));
}

async function readSettingsPublic(): Promise<{
  config: SchoolConfig;
  subjects: string[];
  components: string[];
  visibility: GradeVisibilityConfig;
  schoolExists: boolean;
  academicExists: boolean;
}> {
  void testFirestoreConnection();

  const [schoolSnap, academicSnap] = await Promise.all([
    getDoc(doc(db, 'school_settings', 'main')).catch((err) =>
      handleFirestoreError(err, OperationType.GET, SCHOOL_DOC_PATH)
    ),
    getDoc(doc(db, 'academic_settings', 'main')).catch((err) =>
      handleFirestoreError(err, OperationType.GET, ACADEMIC_DOC_PATH)
    ),
  ]);

  const config = normalizeSchoolConfig(schoolSnap.exists() ? schoolSnap.data() : undefined);
  const academic = normalizeAcademicSettings(
    academicSnap.exists() ? academicSnap.data() : undefined
  );

  savePublicCache({
    config,
    subjects: academic.subjects,
    components: academic.components,
    visibility: academic.visibility,
  });

  return {
    config,
    subjects: academic.subjects,
    components: academic.components,
    visibility: academic.visibility,
    schoolExists: schoolSnap.exists(),
    academicExists: academicSnap.exists(),
  };
}

async function resolveAdminWorkspaceKey(
  session: AuthSession,
  verifyRemote = false
): Promise<string> {
  if (session.username.trim().toLowerCase() === 'admin') {
    return computeAdminWorkspaceKey(session.username, session.password);
  }
  if (!verifyRemote && session.workspaceKey) {
    return session.workspaceKey;
  }
  const userToken = await computeUserSessionToken(session.username, session.password);
  const snap = await getDoc(doc(db, 'user_sessions', userToken)).catch((err) =>
    handleFirestoreError(err, OperationType.GET, `user_sessions/${userToken}`)
  );
  if (!snap.exists()) {
    throw new Error('Akun Administrator tidak ditemukan atau password salah.');
  }
  const data = snap.data();
  if (!data.active || !data.workspaceKey) {
    throw new Error('Akun Anda sedang dinonaktifkan oleh Administrator.');
  }
  if (data.role !== 'admin') {
    throw new Error('Akun ini tidak memiliki hak akses Administrator.');
  }
  return String(data.workspaceKey);
}

async function hydrateAdminCache(
  session: AuthSession,
  forceRefresh = false
): Promise<AdminMemoryCache> {
  const fastAdminKey = await resolveAdminWorkspaceKey(session, forceRefresh);

  if (
    !forceRefresh &&
    adminCache &&
    adminCache.adminKey === fastAdminKey &&
    adminCache.bootstrapped
  ) {
    return adminCache;
  }

  void testFirestoreConnection();

  const adminKey = fastAdminKey;
  const path = `workspaces/${adminKey}/students`;
  const [schoolSnap, academicSnap, studentsSnap, usersSnap] = await Promise.all([
    getDoc(doc(db, 'school_settings', 'main')).catch((err) =>
      handleFirestoreError(err, OperationType.GET, SCHOOL_DOC_PATH)
    ),
    getDoc(doc(db, 'academic_settings', 'main')).catch((err) =>
      handleFirestoreError(err, OperationType.GET, ACADEMIC_DOC_PATH)
    ),
    getDocs(collection(db, 'workspaces', adminKey, 'students')).catch((err) => {
      const raw = err instanceof Error ? err.message : String(err);
      if (raw.toLowerCase().includes('missing or insufficient permissions')) {
        throw new Error('Username atau Password Administrator tidak sesuai.');
      }
      return handleFirestoreError(err, OperationType.LIST, path);
    }),
    getDocs(collection(db, 'workspaces', adminKey, 'users')).catch((err) =>
      handleFirestoreError(err, OperationType.LIST, `workspaces/${adminKey}/users`)
    ),
  ]);

  const config = normalizeSchoolConfig(schoolSnap.exists() ? schoolSnap.data() : undefined);
  const academic = normalizeAcademicSettings(
    academicSnap.exists() ? academicSnap.data() : undefined
  );

  if (!schoolSnap.exists() || !academicSnap.exists()) {
    const batch = writeBatch(db);
    addWriteProof(batch, adminKey);

    if (!schoolSnap.exists()) {
      batch.set(doc(db, 'school_settings', 'main'), {
        name: config.name,
        subtitle: config.subtitle,
        address: config.address,
        logoUrl: config.logoUrl,
        logoRightUrl: config.logoRightUrl || '',
        kopLines: normalizeKopLines(config.kopLines, config),
        headmasterName: config.headmasterName || '',
        headmasterNip: config.headmasterNip || '',
        cityName: config.cityName || '',
        showKopSurat: config.showKopSurat ?? true,
        showHeadmasterSign: config.showHeadmasterSign ?? true,
        signatureMode: resolveSignatureMode(config),
        teacherSignTitle: config.teacherSignTitle || 'Guru / Wali Kelas',
        teacherSignName: config.teacherSignName || '',
        teacherSignNip: config.teacherSignNip || '',
        loginLogoUrl: config.loginLogoUrl || '',
        loginTitle: config.loginTitle || '',
        loginSubtitle: config.loginSubtitle || '',
        loginDescription: config.loginDescription || '',
        loginFooterText: config.loginFooterText || '',
        loginFormTitle: config.loginFormTitle || '',
        loginFormSubtitle: config.loginFormSubtitle || '',
        showLoginKkm: config.showLoginKkm ?? true,
        theme: normalizeThemeId(config.theme),
        kkm: config.kkm,
        subjectKkm: config.subjectKkm || {},
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    if (!academicSnap.exists()) {
      batch.set(doc(db, 'academic_settings', 'main'), {
        subjects: academic.subjects,
        components: academic.components,
        visibility: academic.visibility,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, SCHOOL_DOC_PATH);
    }
  }

  const studentsByNis = new Map<string, CachedAdminEntry>();
  for (const d of studentsSnap.docs) {
    const raw = d.data();
    const st = normalizeStudentDoc(raw, academic.subjects);
    if (st.nis) {
      studentsByNis.set(st.nis, {
        student: st,
        token: String(raw.portalToken || ''),
      });
    }
  }

  const usersById = new Map<string, CachedPortalUserEntry>();
  for (const d of usersSnap.docs) {
    const raw = d.data();
    const user = normalizePortalUserDoc({ ...raw, id: String(raw.id || d.id) });
    if (user.id && user.username) {
      usersById.set(user.id, {
        user,
        loginToken: String(raw.loginToken || ''),
      });
    }
  }

  savePublicCache({
    config,
    subjects: academic.subjects,
    components: academic.components,
    visibility: academic.visibility,
  });

  adminCache = {
    adminKey,
    bootstrapped: true,
    config,
    subjects: academic.subjects,
    components: academic.components,
    visibility: academic.visibility,
    studentsByNis,
    usersById,
  };

  return adminCache;
}

async function commitBatchedOps(
  adminKey: string,
  applyOps: (batch: ReturnType<typeof writeBatch>, index: number) => void,
  totalItems: number,
  errorPath?: string
): Promise<void> {
  const maxItemsPerBatch = 8;
  for (let start = 0; start < totalItems; start += maxItemsPerBatch) {
    const end = Math.min(totalItems, start + maxItemsPerBatch);
    const batch = writeBatch(db);
    addWriteProof(batch, adminKey);
    for (let i = start; i < end; i++) {
      applyOps(batch, i);
    }
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.WRITE,
        errorPath || `workspaces/${adminKey}/students`
      );
    }
  }
}

export async function fetchSchoolConfig(): Promise<ApiResponse> {
  const { config, subjects, components, visibility } = await readSettingsPublic();
  return { ok: true, config, subjects, components, visibility };
}

export async function loginAccount(username: string, password: string): Promise<ApiResponse> {
  const cleanUser = username.trim();
  const cleanPass = password.trim();

  if (!cleanUser || !cleanPass) {
    throw new Error('Username / NIS dan Password / NISN wajib diisi.');
  }

  if (cleanUser.toLowerCase() === 'admin') {
    const adminKey = await computeAdminWorkspaceKey(cleanUser, cleanPass);
    const adminSession: AuthSession = {
      role: 'admin',
      username: cleanUser,
      password: cleanPass,
      workspaceKey: adminKey,
      displayName: 'Administrator Utama',
    };
    const res = await fetchAdminData(adminSession, true);
    return { ...res, role: 'admin', session: adminSession };
  }

  const [userToken, studentToken] = await Promise.all([
    computeUserSessionToken(cleanUser, cleanPass),
    computeStudentPortalToken(cleanUser, cleanPass),
  ]);

  const [settings, userSnap, transcriptSnap] = await Promise.all([
    readSettingsPublic(),
    getDoc(doc(db, 'user_sessions', userToken)).catch((err) =>
      handleFirestoreError(err, OperationType.GET, `user_sessions/${userToken}`)
    ),
    getDoc(doc(db, 'transcripts', studentToken)).catch((err) =>
      handleFirestoreError(err, OperationType.GET, `transcripts/${studentToken}`)
    ),
  ]);

  if (userSnap.exists()) {
    const uData = userSnap.data();
    if (!uData.active || !uData.workspaceKey) {
      throw new Error('Akun ini sedang dinonaktifkan oleh Administrator.');
    }

    const nextSession: AuthSession = {
      role: uData.role === 'admin' ? 'admin' : 'guru',
      username: String(uData.username || cleanUser),
      password: cleanPass,
      workspaceKey: String(uData.workspaceKey),
      displayName: String(uData.nama || cleanUser),
      email: String(uData.email || ''),
      nip: String(uData.nip || ''),
      userId: String(uData.userId || ''),
      assignedSubjects: Array.isArray(uData.assignedSubjects)
        ? uData.assignedSubjects.map((s: unknown) => String(s))
        : [],
      assignedClasses: Array.isArray(uData.assignedClasses)
        ? uData.assignedClasses.map((c: unknown) => String(c))
        : [],
    };

    if (nextSession.role === 'admin') {
      const res = await fetchAdminData(nextSession, true);
      return { ...res, role: 'admin', session: nextSession };
    }

    const res = await fetchTeacherData(nextSession, true);
    return { ...res, role: 'guru', session: res.session || nextSession };
  }

  if (!transcriptSnap.exists()) {
    throw new Error(
      'NIS / Username atau Password (NISN) tidak sesuai. Periksa kembali kredensial Anda.'
    );
  }

  const student = normalizeStudentDoc(transcriptSnap.data(), settings.subjects);
  return {
    ok: true,
    role: 'student',
    config: settings.config,
    subjects: settings.subjects,
    components: settings.components,
    visibility: settings.visibility,
    student,
  };
}

export async function fetchStudentTranscript(nis: string, nisn: string): Promise<ApiResponse> {
  const cleanNis = nis.trim();
  const cleanNisn = nisn.trim();
  if (!cleanNis || !cleanNisn) {
    throw new Error('NIS dan NISN wajib diisi.');
  }

  const token = await computeStudentPortalToken(cleanNis, cleanNisn);
  const [settings, transcriptSnap] = await Promise.all([
    readSettingsPublic(),
    getDoc(doc(db, 'transcripts', token)).catch((err) =>
      handleFirestoreError(err, OperationType.GET, `transcripts/${token}`)
    ),
  ]);

  if (!transcriptSnap.exists()) {
    throw new Error('Data siswa tidak ditemukan.');
  }

  return {
    ok: true,
    config: settings.config,
    subjects: settings.subjects,
    components: settings.components,
    visibility: settings.visibility,
    student: normalizeStudentDoc(transcriptSnap.data(), settings.subjects),
  };
}

export async function fetchAdminData(
  session: AuthSession,
  forceRefresh = true
): Promise<ApiResponse> {
  const state = await hydrateAdminCache(session, forceRefresh);
  return {
    ok: true,
    config: state.config,
    subjects: state.subjects,
    components: state.components,
    visibility: state.visibility,
    students: getSortedStudentsFromCache(state),
    users: getSortedUsersFromCache(state),
  };
}

export async function fetchTeacherData(
  session: AuthSession,
  forceRefresh = true
): Promise<ApiResponse> {
  void forceRefresh;
  const userToken = await computeUserSessionToken(session.username, session.password);
  const [settings, userSnap] = await Promise.all([
    readSettingsPublic(),
    getDoc(doc(db, 'user_sessions', userToken)).catch((err) =>
      handleFirestoreError(err, OperationType.GET, `user_sessions/${userToken}`)
    ),
  ]);

  if (!userSnap.exists()) {
    throw new Error('Sesi Guru tidak ditemukan atau password telah diubah.');
  }
  const uData = userSnap.data();
  if (!uData.active || !uData.workspaceKey || uData.role !== 'guru') {
    throw new Error('Akun Guru sedang dinonaktifkan atau tidak memiliki izin.');
  }

  const workspaceKey = String(uData.workspaceKey);
  const studentsSnap = await getDocs(collection(db, 'workspaces', workspaceKey, 'students')).catch(
    (err) => handleFirestoreError(err, OperationType.LIST, `workspaces/${workspaceKey}/students`)
  );

  const students: StudentRecord[] = [];
  for (const d of studentsSnap.docs) {
    const st = normalizeStudentDoc(d.data(), settings.subjects);
    if (st.nis) students.push(st);
  }

  const refreshedSession: AuthSession = {
    role: 'guru',
    username: String(uData.username || session.username),
    password: session.password,
    workspaceKey,
    displayName: String(uData.nama || session.displayName || session.username),
    email: String(uData.email || ''),
    nip: String(uData.nip || ''),
    userId: String(uData.userId || ''),
    assignedSubjects: Array.isArray(uData.assignedSubjects)
      ? uData.assignedSubjects.map((s: unknown) => String(s))
      : [],
    assignedClasses: Array.isArray(uData.assignedClasses)
      ? uData.assignedClasses.map((c: unknown) => String(c))
      : [],
  };

  return {
    ok: true,
    role: 'guru',
    session: refreshedSession,
    config: settings.config,
    subjects: settings.subjects,
    components: settings.components,
    visibility: settings.visibility,
    students: sortStudents(students),
  };
}

export async function saveTeacherScores(
  session: AuthSession,
  updates: Array<{
    nis: string;
    scores?: Record<string, number>;
    scoreDetails?: Record<string, Record<string, number>>;
  }>
): Promise<ApiResponse> {
  if (!updates.length) {
    throw new Error('Tidak ada perubahan nilai untuk disimpan.');
  }

  const userToken = await computeUserSessionToken(session.username, session.password);
  const [settings, userSnap] = await Promise.all([
    readSettingsPublic(),
    getDoc(doc(db, 'user_sessions', userToken)).catch((err) =>
      handleFirestoreError(err, OperationType.GET, `user_sessions/${userToken}`)
    ),
  ]);

  if (!userSnap.exists()) {
    throw new Error('Sesi Guru tidak valid.');
  }
  const uData = userSnap.data();
  if (!uData.active || !uData.workspaceKey || uData.role !== 'guru') {
    throw new Error('Akun Guru sedang dinonaktifkan.');
  }

  const workspaceKey = String(uData.workspaceKey);
  const assignedSubjs = Array.isArray(uData.assignedSubjects)
    ? uData.assignedSubjects.map((s: unknown) => String(s)).filter(Boolean)
    : [];
  const assignedClasses = Array.isArray(uData.assignedClasses)
    ? uData.assignedClasses.map((c: unknown) => String(c)).filter(Boolean)
    : [];

  const allowedSubjects = new Set(
    assignedSubjs.length > 0 ? assignedSubjs : settings.subjects
  );
  const allowedClassSet = assignedClasses.length > 0 ? new Set(assignedClasses) : null;

  const docs = await Promise.all(
    updates.map((u) =>
      getDoc(doc(db, 'workspaces', workspaceKey, 'students', nisToDocId(u.nis.trim())))
    )
  );

  interface PreparedTeacherWrite {
    docId: string;
    token: string;
    payload: ReturnType<typeof buildSanitizedStudentMaps>;
  }
  const prepared: PreparedTeacherWrite[] = [];

  for (let i = 0; i < updates.length; i++) {
    const snap = docs[i];
    if (!snap.exists()) continue;
    const raw = snap.data();
    const existing = normalizeStudentDoc(raw, settings.subjects);
    if (allowedClassSet && !allowedClassSet.has(existing.kelas)) continue;

    const item = updates[i];
    const nextScores = { ...existing.scores };
    const nextDetails = { ...(existing.scoreDetails || {}) };

    if (item.scores) {
      for (const [subj, val] of Object.entries(item.scores)) {
        if (allowedSubjects.has(subj)) {
          nextScores[subj] = val;
        }
      }
    }
    if (item.scoreDetails) {
      for (const [subj, detailMap] of Object.entries(item.scoreDetails)) {
        if (allowedSubjects.has(subj)) {
          nextDetails[subj] = detailMap;
        }
      }
    }

    const sanitized = buildSanitizedStudentMaps(
      { ...existing, scores: nextScores, scoreDetails: nextDetails },
      settings.subjects
    );
    const token =
      String(raw.portalToken || '') ||
      (await computeStudentPortalToken(sanitized.nis, sanitized.nisn));

    prepared.push({
      docId: nisToDocId(sanitized.nis),
      token,
      payload: sanitized,
    });
  }

  await commitBatchedOps(
    workspaceKey,
    (batch, idx) => {
      const p = prepared[idx];
      batch.update(doc(db, 'workspaces', workspaceKey, 'students', p.docId), {
        ...p.payload,
        portalToken: p.token,
        updatedAt: serverTimestamp(),
      });
      batch.update(doc(db, 'transcripts', p.token), {
        ...p.payload,
        updatedAt: serverTimestamp(),
      });
    },
    prepared.length
  );

  return {
    ok: true,
    message: `Nilai untuk ${prepared.length} siswa berhasil disimpan.`,
  };
}

export async function saveStudent(
  session: AuthSession,
  mode: 'add' | 'edit',
  student: StudentRecord,
  originalNis?: string
): Promise<ApiResponse> {
  const state = await hydrateAdminCache(session, false);
  const { adminKey, subjects, components } = state;
  const sanitized = buildSanitizedStudentMaps(student, subjects);

  if (!sanitized.nis || !sanitized.nisn || !sanitized.nama) {
    throw new Error('NIS, NISN, dan Nama Siswa wajib diisi.');
  }

  const newDocId = nisToDocId(sanitized.nis);
  const newToken = await computeStudentPortalToken(sanitized.nis, sanitized.nisn);

  if (mode === 'add') {
    if (state.studentsByNis.has(sanitized.nis)) {
      throw new Error(`NIS "${sanitized.nis}" sudah terdaftar pada siswa lain.`);
    }

    const batch = writeBatch(db);
    addWriteProof(batch, adminKey);
    batch.set(doc(db, 'workspaces', adminKey, 'students', newDocId), {
      ...sanitized,
      portalToken: newToken,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'transcripts', newToken), {
      ...sanitized,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `workspaces/${adminKey}/students/${newDocId}`);
    }

    state.studentsByNis.set(sanitized.nis, {
      student: { ...sanitized },
      token: newToken,
    });

    return {
      ok: true,
      message: 'Siswa baru berhasil ditambahkan.',
      subjects,
      components,
      students: getSortedStudentsFromCache(state),
    };
  }

  const oldNis = (originalNis || sanitized.nis).trim();
  const oldEntry = state.studentsByNis.get(oldNis);
  if (!oldEntry) {
    throw new Error(`Siswa dengan NIS "${oldNis}" tidak ditemukan.`);
  }

  const oldDocId = nisToDocId(oldNis);
  const oldToken = oldEntry.token;

  if (newDocId !== oldDocId && state.studentsByNis.has(sanitized.nis)) {
    throw new Error(`NIS "${sanitized.nis}" sudah terdaftar pada siswa lain.`);
  }

  const batch = writeBatch(db);
  addWriteProof(batch, adminKey);

  if (newDocId !== oldDocId) {
    batch.delete(doc(db, 'workspaces', adminKey, 'students', oldDocId));
    batch.set(doc(db, 'workspaces', adminKey, 'students', newDocId), {
      ...sanitized,
      portalToken: newToken,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else {
    batch.update(doc(db, 'workspaces', adminKey, 'students', oldDocId), {
      ...sanitized,
      portalToken: newToken,
      updatedAt: serverTimestamp(),
    });
  }

  if (oldToken && oldToken !== newToken) {
    batch.delete(doc(db, 'transcripts', oldToken));
    batch.set(doc(db, 'transcripts', newToken), {
      ...sanitized,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else if (oldToken === newToken && oldToken) {
    batch.update(doc(db, 'transcripts', newToken), {
      ...sanitized,
      updatedAt: serverTimestamp(),
    });
  } else {
    batch.set(doc(db, 'transcripts', newToken), {
      ...sanitized,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `workspaces/${adminKey}/students/${newDocId}`);
  }

  if (oldNis !== sanitized.nis) {
    state.studentsByNis.delete(oldNis);
  }
  state.studentsByNis.set(sanitized.nis, {
    student: { ...sanitized },
    token: newToken,
  });

  return {
    ok: true,
    message: `Data siswa "${sanitized.nama}" berhasil diperbarui.`,
    subjects,
    components,
    students: getSortedStudentsFromCache(state),
  };
}

export async function deleteStudent(session: AuthSession, nis: string): Promise<ApiResponse> {
  const state = await hydrateAdminCache(session, false);
  const { adminKey, subjects, components } = state;
  const cleanNis = nis.trim();
  const entry = state.studentsByNis.get(cleanNis);

  if (!entry) {
    throw new Error(`Siswa dengan NIS "${cleanNis}" tidak ditemukan.`);
  }

  const docId = nisToDocId(cleanNis);
  const batch = writeBatch(db);
  addWriteProof(batch, adminKey);
  batch.delete(doc(db, 'workspaces', adminKey, 'students', docId));
  if (entry.token) {
    batch.delete(doc(db, 'transcripts', entry.token));
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `workspaces/${adminKey}/students/${docId}`);
  }

  state.studentsByNis.delete(cleanNis);

  return {
    ok: true,
    message: `Data siswa dengan NIS "${cleanNis}" berhasil dihapus.`,
    subjects,
    components,
    students: getSortedStudentsFromCache(state),
  };
}

export async function bulkUpdateStudents(
  session: AuthSession,
  updates: Array<{
    nis: string;
    kelas?: string;
    status?: string;
    jenisKelamin?: GenderCode;
    scores?: Record<string, number>;
    scoreDetails?: Record<string, Record<string, number>>;
  }>
): Promise<ApiResponse> {
  if (!updates.length) {
    throw new Error('Tidak ada perubahan data siswa untuk disimpan.');
  }

  const state = await hydrateAdminCache(session, false);
  const { adminKey, subjects, components } = state;

  interface PreparedUpdate {
    nis: string;
    docId: string;
    token: string;
    payload: ReturnType<typeof buildSanitizedStudentMaps>;
  }

  const prepared: PreparedUpdate[] = [];
  for (const item of updates) {
    const cleanNis = String(item.nis || '').trim();
    const existingEntry = state.studentsByNis.get(cleanNis);
    if (!existingEntry) continue;
    const existing = existingEntry.student;

    const merged: StudentRecord = {
      ...existing,
      kelas: item.kelas !== undefined ? item.kelas : existing.kelas,
      status: item.status !== undefined ? item.status : existing.status,
      jenisKelamin: item.jenisKelamin !== undefined ? item.jenisKelamin : existing.jenisKelamin,
      scores: item.scores ? { ...existing.scores, ...item.scores } : existing.scores,
      scoreDetails: item.scoreDetails
        ? { ...(existing.scoreDetails || {}), ...item.scoreDetails }
        : existing.scoreDetails,
    };

    const sanitized = buildSanitizedStudentMaps(merged, subjects);
    const token =
      existingEntry.token || (await computeStudentPortalToken(sanitized.nis, sanitized.nisn));
    prepared.push({
      nis: sanitized.nis,
      docId: nisToDocId(sanitized.nis),
      token,
      payload: sanitized,
    });
  }

  await commitBatchedOps(
    adminKey,
    (batch, idx) => {
      const p = prepared[idx];
      batch.update(doc(db, 'workspaces', adminKey, 'students', p.docId), {
        ...p.payload,
        portalToken: p.token,
        updatedAt: serverTimestamp(),
      });
      batch.update(doc(db, 'transcripts', p.token), {
        ...p.payload,
        updatedAt: serverTimestamp(),
      });
    },
    prepared.length
  );

  for (const p of prepared) {
    state.studentsByNis.set(p.nis, {
      student: { ...p.payload },
      token: p.token,
    });
  }

  return {
    ok: true,
    message: `${prepared.length} data siswa berhasil diperbarui.`,
    subjects,
    components,
    students: getSortedStudentsFromCache(state),
  };
}

export async function bulkDeleteStudents(
  session: AuthSession,
  nisList: string[]
): Promise<ApiResponse> {
  if (!nisList.length) {
    throw new Error('Tidak ada siswa yang dipilih untuk dihapus.');
  }

  const state = await hydrateAdminCache(session, false);
  const { adminKey, subjects, components } = state;

  const targets: Array<{ nis: string; docId: string; token: string }> = [];
  for (const rawNis of nisList) {
    const cleanNis = rawNis.trim();
    const entry = state.studentsByNis.get(cleanNis);
    if (entry) {
      targets.push({
        nis: cleanNis,
        docId: nisToDocId(cleanNis),
        token: entry.token,
      });
    }
  }

  await commitBatchedOps(
    adminKey,
    (batch, idx) => {
      const t = targets[idx];
      batch.delete(doc(db, 'workspaces', adminKey, 'students', t.docId));
      if (t.token) {
        batch.delete(doc(db, 'transcripts', t.token));
      }
    },
    targets.length
  );

  for (const t of targets) {
    state.studentsByNis.delete(t.nis);
  }

  return {
    ok: true,
    message: `${targets.length} siswa terpilih berhasil dihapus.`,
    subjects,
    components,
    students: getSortedStudentsFromCache(state),
  };
}

export async function importStudents(
  session: AuthSession,
  incomingStudents: StudentRecord[],
  subjectsFromCsv: string[],
  mode: 'upsert' | 'skip',
  componentsFromCsv: string[] = []
): Promise<ApiResponse> {
  if (!incomingStudents.length) {
    throw new Error('Tidak ada baris data siswa untuk diimpor.');
  }

  const state = await hydrateAdminCache(session, false);
  const { adminKey, subjects: existingSubjs, components: existingComps } = state;

  const mergedSubjects = [...existingSubjs];
  for (const s of subjectsFromCsv) {
    const clean = s.trim().slice(0, 100);
    if (clean && !mergedSubjects.some((e) => e.toLowerCase() === clean.toLowerCase())) {
      if (mergedSubjects.length < 50) mergedSubjects.push(clean);
    }
  }

  const mergedComponents = [...existingComps];
  for (const c of componentsFromCsv) {
    const clean = c.trim().slice(0, 100);
    if (clean && !mergedComponents.some((e) => e.toLowerCase() === clean.toLowerCase())) {
      if (mergedComponents.length < 20) mergedComponents.push(clean);
    }
  }

  if (
    mergedSubjects.length !== existingSubjs.length ||
    mergedComponents.length !== existingComps.length
  ) {
    const batch = writeBatch(db);
    addWriteProof(batch, adminKey);
    batch.update(doc(db, 'academic_settings', 'main'), {
      subjects: mergedSubjects,
      components: mergedComponents,
      updatedAt: serverTimestamp(),
    });
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, ACADEMIC_DOC_PATH);
    }
    state.subjects = mergedSubjects;
    state.components = mergedComponents;
    savePublicCache({
      config: state.config,
      subjects: mergedSubjects,
      components: mergedComponents,
      visibility: state.visibility,
    });
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  interface ImportOp {
    isUpdate: boolean;
    nis: string;
    docId: string;
    oldToken: string;
    newToken: string;
    payload: ReturnType<typeof buildSanitizedStudentMaps>;
  }
  const ops: ImportOp[] = [];

  for (const item of incomingStudents) {
    const sanitized = buildSanitizedStudentMaps(item, mergedSubjects);
    if (!sanitized.nis || !sanitized.nama || !sanitized.nisn) {
      skipped++;
      continue;
    }

    const docId = nisToDocId(sanitized.nis);
    const existingEntry = state.studentsByNis.get(sanitized.nis);

    if (existingEntry && mode === 'skip') {
      skipped++;
      continue;
    }

    const newToken = await computeStudentPortalToken(sanitized.nis, sanitized.nisn);
    const oldToken = existingEntry ? existingEntry.token : '';

    if (existingEntry) {
      updated++;
      ops.push({ isUpdate: true, nis: sanitized.nis, docId, oldToken, newToken, payload: sanitized });
    } else {
      inserted++;
      ops.push({ isUpdate: false, nis: sanitized.nis, docId, oldToken: '', newToken, payload: sanitized });
    }
  }

  await commitBatchedOps(
    adminKey,
    (batch, idx) => {
      const op = ops[idx];
      const studentRef = doc(db, 'workspaces', adminKey, 'students', op.docId);
      const newTransRef = doc(db, 'transcripts', op.newToken);

      if (op.isUpdate) {
        batch.update(studentRef, {
          ...op.payload,
          portalToken: op.newToken,
          updatedAt: serverTimestamp(),
        });
        if (op.oldToken && op.oldToken !== op.newToken) {
          batch.delete(doc(db, 'transcripts', op.oldToken));
          batch.set(newTransRef, {
            ...op.payload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else if (op.oldToken === op.newToken && op.oldToken) {
          batch.update(newTransRef, {
            ...op.payload,
            updatedAt: serverTimestamp(),
          });
        } else {
          batch.set(newTransRef, {
            ...op.payload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } else {
        batch.set(studentRef, {
          ...op.payload,
          portalToken: op.newToken,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        batch.set(newTransRef, {
          ...op.payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    },
    ops.length
  );

  for (const op of ops) {
    state.studentsByNis.set(op.nis, {
      student: { ...op.payload },
      token: op.newToken,
    });
  }

  return {
    ok: true,
    message: `Impor selesai: ${inserted} baru, ${updated} diperbarui, ${skipped} dilewati.`,
    subjects: mergedSubjects,
    components: mergedComponents,
    students: getSortedStudentsFromCache(state),
    stats: { inserted, updated, skipped },
  };
}

export async function addSubject(session: AuthSession, name: string): Promise<ApiResponse> {
  const clean = name.trim().slice(0, 100);
  if (!clean) throw new Error('Nama mata pelajaran wajib diisi.');

  const state = await hydrateAdminCache(session, false);
  const { adminKey, subjects, components } = state;

  if (subjects.some((s) => s.toLowerCase() === clean.toLowerCase())) {
    throw new Error(`Mata pelajaran "${clean}" sudah terdaftar.`);
  }
  if (subjects.length >= 50) {
    throw new Error('Maksimal 50 mata pelajaran telah tercapai.');
  }

  const nextSubjects = [...subjects, clean];

  const batch = writeBatch(db);
  addWriteProof(batch, adminKey);
  batch.update(doc(db, 'academic_settings', 'main'), {
    subjects: nextSubjects,
    updatedAt: serverTimestamp(),
  });
  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, ACADEMIC_DOC_PATH);
  }

  state.subjects = nextSubjects;
  savePublicCache({
    config: state.config,
    subjects: nextSubjects,
    components,
    visibility: state.visibility,
  });

  return {
    ok: true,
    message: `Mata pelajaran "${clean}" berhasil ditambahkan.`,
    subjects: nextSubjects,
    components,
    students: getSortedStudentsFromCache(state),
  };
}

export async function renameSubject(
  session: AuthSession,
  oldName: string,
  newName: string
): Promise<ApiResponse> {
  const cleanOld = oldName.trim();
  const cleanNew = newName.trim().slice(0, 100);
  if (!cleanOld || !cleanNew) throw new Error('Nama mapel lama dan baru wajib diisi.');

  const state = await hydrateAdminCache(session, false);
  const { adminKey, subjects, components, visibility } = state;

  const idx = subjects.findIndex((s) => s === cleanOld);
  if (idx === -1) throw new Error(`Mata pelajaran "${cleanOld}" tidak ditemukan.`);
  if (subjects.some((s, i) => i !== idx && s.toLowerCase() === cleanNew.toLowerCase())) {
    throw new Error(`Mata pelajaran "${cleanNew}" sudah digunakan.`);
  }

  const nextSubjects = subjects.map((s, i) => (i === idx ? cleanNew : s));
  const nextVisibility: GradeVisibilityConfig = {
    ...visibility,
    visibleSubjects: visibility.visibleSubjects.map((s) => (s === cleanOld ? cleanNew : s)),
  };

  const nextSubjectKkm = { ...(state.config.subjectKkm || {}) };
  let kkmMapChanged = false;
  if (nextSubjectKkm[cleanOld] !== undefined) {
    nextSubjectKkm[cleanNew] = nextSubjectKkm[cleanOld];
    delete nextSubjectKkm[cleanOld];
    kkmMapChanged = true;
  }

  const settingsBatch = writeBatch(db);
  addWriteProof(settingsBatch, adminKey);
  settingsBatch.update(doc(db, 'academic_settings', 'main'), {
    subjects: nextSubjects,
    visibility: nextVisibility,
    updatedAt: serverTimestamp(),
  });
  if (kkmMapChanged) {
    settingsBatch.update(doc(db, 'school_settings', 'main'), {
      subjectKkm: nextSubjectKkm,
      updatedAt: serverTimestamp(),
    });
  }
  try {
    await settingsBatch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, ACADEMIC_DOC_PATH);
  }
  if (kkmMapChanged) {
    state.config = { ...state.config, subjectKkm: nextSubjectKkm };
  }

  const migrated: Array<{
    docId: string;
    token: string;
    scores: Record<string, number>;
    scoreDetails: Record<string, Record<string, number>>;
  }> = [];

  for (const [nis, entry] of state.studentsByNis.entries()) {
    const st = entry.student;
    const scores = { ...(st.scores || {}) };
    const scoreDetails = { ...(st.scoreDetails || {}) };
    let changed = false;

    if (scores[cleanOld] !== undefined) {
      scores[cleanNew] = scores[cleanOld];
      delete scores[cleanOld];
      changed = true;
    }
    if (scoreDetails[cleanOld] !== undefined) {
      scoreDetails[cleanNew] = scoreDetails[cleanOld];
      delete scoreDetails[cleanOld];
      changed = true;
    }

    if (changed) {
      st.scores = scores;
      st.scoreDetails = scoreDetails;
      migrated.push({
        docId: nisToDocId(nis),
        token: entry.token,
        scores,
        scoreDetails,
      });
    }
  }

  if (migrated.length > 0) {
    await commitBatchedOps(
      adminKey,
      (batch, i) => {
        const m = migrated[i];
        batch.update(doc(db, 'workspaces', adminKey, 'students', m.docId), {
          scores: m.scores,
          scoreDetails: m.scoreDetails,
          updatedAt: serverTimestamp(),
        });
        if (m.token) {
          batch.update(doc(db, 'transcripts', m.token), {
            scores: m.scores,
            scoreDetails: m.scoreDetails,
            updatedAt: serverTimestamp(),
          });
        }
      },
      migrated.length
    );
  }

  state.subjects = nextSubjects;
  state.visibility = nextVisibility;
  savePublicCache({
    config: state.config,
    subjects: nextSubjects,
    components,
    visibility: nextVisibility,
  });

  return {
    ok: true,
    message: `Mata pelajaran berhasil diubah menjadi "${cleanNew}".`,
    subjects: nextSubjects,
    components,
    visibility: nextVisibility,
    students: getSortedStudentsFromCache(state),
  };
}

export async function deleteSubject(session: AuthSession, name: string): Promise<ApiResponse> {
  const clean = name.trim();
  const state = await hydrateAdminCache(session, false);
  const { adminKey, subjects, components, visibility } = state;

  if (!subjects.includes(clean)) {
    throw new Error(`Mata pelajaran "${clean}" tidak ditemukan.`);
  }

  const nextSubjects = subjects.filter((s) => s !== clean);
  const nextVisibility: GradeVisibilityConfig = {
    ...visibility,
    visibleSubjects: visibility.visibleSubjects.filter((s) => s !== clean),
  };

  const nextSubjectKkm = { ...(state.config.subjectKkm || {}) };
  let kkmMapChanged = false;
  if (nextSubjectKkm[clean] !== undefined) {
    delete nextSubjectKkm[clean];
    kkmMapChanged = true;
  }

  const settingsBatch = writeBatch(db);
  addWriteProof(settingsBatch, adminKey);
  settingsBatch.update(doc(db, 'academic_settings', 'main'), {
    subjects: nextSubjects,
    visibility: nextVisibility,
    updatedAt: serverTimestamp(),
  });
  if (kkmMapChanged) {
    settingsBatch.update(doc(db, 'school_settings', 'main'), {
      subjectKkm: nextSubjectKkm,
      updatedAt: serverTimestamp(),
    });
  }
  try {
    await settingsBatch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, ACADEMIC_DOC_PATH);
  }
  if (kkmMapChanged) {
    state.config = { ...state.config, subjectKkm: nextSubjectKkm };
  }

  const updatedRows: Array<{
    docId: string;
    token: string;
    scores: Record<string, number>;
    scoreDetails: Record<string, Record<string, number>>;
  }> = [];

  for (const [nis, entry] of state.studentsByNis.entries()) {
    const st = entry.student;
    const scores = { ...(st.scores || {}) };
    const scoreDetails = { ...(st.scoreDetails || {}) };
    let changed = false;

    if (scores[clean] !== undefined) {
      delete scores[clean];
      changed = true;
    }
    if (scoreDetails[clean] !== undefined) {
      delete scoreDetails[clean];
      changed = true;
    }

    if (changed) {
      st.scores = scores;
      st.scoreDetails = scoreDetails;
      updatedRows.push({
        docId: nisToDocId(nis),
        token: entry.token,
        scores,
        scoreDetails,
      });
    }
  }

  if (updatedRows.length > 0) {
    await commitBatchedOps(
      adminKey,
      (batch, i) => {
        const r = updatedRows[i];
        batch.update(doc(db, 'workspaces', adminKey, 'students', r.docId), {
          scores: r.scores,
          scoreDetails: r.scoreDetails,
          updatedAt: serverTimestamp(),
        });
        if (r.token) {
          batch.update(doc(db, 'transcripts', r.token), {
            scores: r.scores,
            scoreDetails: r.scoreDetails,
            updatedAt: serverTimestamp(),
          });
        }
      },
      updatedRows.length
    );
  }

  state.subjects = nextSubjects;
  state.visibility = nextVisibility;
  savePublicCache({
    config: state.config,
    subjects: nextSubjects,
    components,
    visibility: nextVisibility,
  });

  return {
    ok: true,
    message: `Mata pelajaran "${clean}" berhasil dihapus.`,
    subjects: nextSubjects,
    components,
    visibility: nextVisibility,
    students: getSortedStudentsFromCache(state),
  };
}

export async function addComponent(session: AuthSession, name: string): Promise<ApiResponse> {
  const clean = name.trim().slice(0, 100);
  if (!clean) throw new Error('Nama komponen nilai wajib diisi.');

  const state = await hydrateAdminCache(session, false);
  const { adminKey, subjects, components } = state;

  if (components.some((c) => c.toLowerCase() === clean.toLowerCase())) {
    throw new Error(`Komponen "${clean}" sudah terdaftar.`);
  }
  if (components.length >= 20) {
    throw new Error('Maksimal 20 komponen penilaian telah tercapai.');
  }

  const nextComponents = [...components, clean];

  const batch = writeBatch(db);
  addWriteProof(batch, adminKey);
  batch.update(doc(db, 'academic_settings', 'main'), {
    components: nextComponents,
    updatedAt: serverTimestamp(),
  });
  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, ACADEMIC_DOC_PATH);
  }

  state.components = nextComponents;
  savePublicCache({
    config: state.config,
    subjects,
    components: nextComponents,
    visibility: state.visibility,
  });

  return {
    ok: true,
    message: `Komponen nilai "${clean}" berhasil ditambahkan.`,
    subjects,
    components: nextComponents,
    students: getSortedStudentsFromCache(state),
  };
}

export async function renameComponent(
  session: AuthSession,
  oldName: string,
  newName: string
): Promise<ApiResponse> {
  const cleanOld = oldName.trim();
  const cleanNew = newName.trim().slice(0, 100);
  if (!cleanOld || !cleanNew) throw new Error('Nama komponen lama dan baru wajib diisi.');

  const state = await hydrateAdminCache(session, false);
  const { adminKey, subjects, components, visibility } = state;

  const idx = components.findIndex((c) => c === cleanOld);
  if (idx === -1) throw new Error(`Komponen "${cleanOld}" tidak ditemukan.`);
  if (components.some((c, i) => i !== idx && c.toLowerCase() === cleanNew.toLowerCase())) {
    throw new Error(`Komponen "${cleanNew}" sudah digunakan.`);
  }

  const nextComponents = components.map((c, i) => (i === idx ? cleanNew : c));
  const nextVisibility: GradeVisibilityConfig = {
    ...visibility,
    visibleComponents: visibility.visibleComponents.map((c) => (c === cleanOld ? cleanNew : c)),
  };

  const settingsBatch = writeBatch(db);
  addWriteProof(settingsBatch, adminKey);
  settingsBatch.update(doc(db, 'academic_settings', 'main'), {
    components: nextComponents,
    visibility: nextVisibility,
    updatedAt: serverTimestamp(),
  });
  try {
    await settingsBatch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, ACADEMIC_DOC_PATH);
  }

  const migrated: Array<{
    docId: string;
    token: string;
    scoreDetails: Record<string, Record<string, number>>;
  }> = [];

  for (const [nis, entry] of state.studentsByNis.entries()) {
    const st = entry.student;
    const scoreDetails = { ...(st.scoreDetails || {}) };
    let changed = false;

    for (const subj of Object.keys(scoreDetails)) {
      const compMap = { ...(scoreDetails[subj] || {}) };
      if (compMap[cleanOld] !== undefined) {
        compMap[cleanNew] = compMap[cleanOld];
        delete compMap[cleanOld];
        scoreDetails[subj] = compMap;
        changed = true;
      }
    }

    if (changed) {
      st.scoreDetails = scoreDetails;
      migrated.push({
        docId: nisToDocId(nis),
        token: entry.token,
        scoreDetails,
      });
    }
  }

  if (migrated.length > 0) {
    await commitBatchedOps(
      adminKey,
      (batch, i) => {
        const m = migrated[i];
        batch.update(doc(db, 'workspaces', adminKey, 'students', m.docId), {
          scoreDetails: m.scoreDetails,
          updatedAt: serverTimestamp(),
        });
        if (m.token) {
          batch.update(doc(db, 'transcripts', m.token), {
            scoreDetails: m.scoreDetails,
            updatedAt: serverTimestamp(),
          });
        }
      },
      migrated.length
    );
  }

  state.components = nextComponents;
  state.visibility = nextVisibility;
  savePublicCache({
    config: state.config,
    subjects,
    components: nextComponents,
    visibility: nextVisibility,
  });

  return {
    ok: true,
    message: `Komponen nilai berhasil diubah menjadi "${cleanNew}".`,
    subjects,
    components: nextComponents,
    visibility: nextVisibility,
    students: getSortedStudentsFromCache(state),
  };
}

export async function deleteComponent(session: AuthSession, name: string): Promise<ApiResponse> {
  const clean = name.trim();
  const state = await hydrateAdminCache(session, false);
  const { adminKey, subjects, components, visibility } = state;

  if (!components.includes(clean)) {
    throw new Error(`Komponen "${clean}" tidak ditemukan.`);
  }

  const nextComponents = components.filter((c) => c !== clean);
  const nextVisibility: GradeVisibilityConfig = {
    ...visibility,
    visibleComponents: visibility.visibleComponents.filter((c) => c !== clean),
  };

  const settingsBatch = writeBatch(db);
  addWriteProof(settingsBatch, adminKey);
  settingsBatch.update(doc(db, 'academic_settings', 'main'), {
    components: nextComponents,
    visibility: nextVisibility,
    updatedAt: serverTimestamp(),
  });
  try {
    await settingsBatch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, ACADEMIC_DOC_PATH);
  }

  const updatedRows: Array<{
    docId: string;
    token: string;
    scores: Record<string, number>;
    scoreDetails: Record<string, Record<string, number>>;
  }> = [];

  for (const [nis, entry] of state.studentsByNis.entries()) {
    const st = entry.student;
    const scores = { ...(st.scores || {}) };
    const scoreDetails = { ...(st.scoreDetails || {}) };
    let changed = false;

    for (const subj of subjects) {
      if (scoreDetails[subj] && scoreDetails[subj][clean] !== undefined) {
        const compMap = { ...scoreDetails[subj] };
        delete compMap[clean];
        if (Object.keys(compMap).length > 0) {
          scoreDetails[subj] = compMap;
          scores[subj] = computeSubjectFinalScore(compMap, 0);
        } else {
          delete scoreDetails[subj];
          scores[subj] = 0;
        }
        changed = true;
      }
    }

    if (changed) {
      st.scores = scores;
      st.scoreDetails = scoreDetails;
      updatedRows.push({
        docId: nisToDocId(nis),
        token: entry.token,
        scores,
        scoreDetails,
      });
    }
  }

  if (updatedRows.length > 0) {
    await commitBatchedOps(
      adminKey,
      (batch, i) => {
        const r = updatedRows[i];
        batch.update(doc(db, 'workspaces', adminKey, 'students', r.docId), {
          scores: r.scores,
          scoreDetails: r.scoreDetails,
          updatedAt: serverTimestamp(),
        });
        if (r.token) {
          batch.update(doc(db, 'transcripts', r.token), {
            scores: r.scores,
            scoreDetails: r.scoreDetails,
            updatedAt: serverTimestamp(),
          });
        }
      },
      updatedRows.length
    );
  }

  state.components = nextComponents;
  state.visibility = nextVisibility;
  savePublicCache({
    config: state.config,
    subjects,
    components: nextComponents,
    visibility: nextVisibility,
  });

  return {
    ok: true,
    message: `Komponen nilai "${clean}" berhasil dihapus.`,
    subjects,
    components: nextComponents,
    visibility: nextVisibility,
    students: getSortedStudentsFromCache(state),
  };
}

export async function saveVisibility(
  session: AuthSession,
  visibilityInput: GradeVisibilityConfig
): Promise<ApiResponse> {
  const state = await hydrateAdminCache(session, false);
  const nextVisibility = normalizeVisibility(visibilityInput);

  const batch = writeBatch(db);
  addWriteProof(batch, state.adminKey);
  batch.update(doc(db, 'academic_settings', 'main'), {
    visibility: nextVisibility,
    updatedAt: serverTimestamp(),
  });
  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, ACADEMIC_DOC_PATH);
  }

  state.visibility = nextVisibility;
  savePublicCache({
    config: state.config,
    subjects: state.subjects,
    components: state.components,
    visibility: nextVisibility,
  });

  return {
    ok: true,
    message:
      nextVisibility.mode === 'all'
        ? 'Pengaturan tampilan nilai disetel ke Semua Nilai.'
        : `Pengaturan tampil nilai disimpan (${nextVisibility.visibleSubjects.length} mapel, ${nextVisibility.visibleComponents.length} komponen).`,
    visibility: nextVisibility,
  };
}

export async function saveConfig(
  session: AuthSession,
  partialConfig: Partial<SchoolConfig>
): Promise<ApiResponse> {
  const state = await hydrateAdminCache(session, false);
  const { adminKey, config: current } = state;

  const nextName =
    (partialConfig.name !== undefined ? String(partialConfig.name) : current.name)
      .trim()
      .slice(0, 150) || DEFAULT_SCHOOL_CONFIG.name;
  const nextSubtitle = (partialConfig.subtitle !== undefined
    ? String(partialConfig.subtitle)
    : current.subtitle
  ).slice(0, 200);
  const nextAddress = (partialConfig.address !== undefined
    ? String(partialConfig.address)
    : current.address
  ).slice(0, 300);

  const rawLogoLeft =
    partialConfig.logoUrl !== undefined ? String(partialConfig.logoUrl) : current.logoUrl;
  const rawLogoRight =
    partialConfig.logoRightUrl !== undefined
      ? String(partialConfig.logoRightUrl)
      : current.logoRightUrl || '';

  const rawLoginLogo =
    partialConfig.loginLogoUrl !== undefined
      ? String(partialConfig.loginLogoUrl)
      : current.loginLogoUrl || '';

  const resolvedMode: SignatureDisplayMode =
    partialConfig.signatureMode !== undefined
      ? normalizeSignatureMode(partialConfig.signatureMode, partialConfig.showHeadmasterSign)
      : partialConfig.showHeadmasterSign !== undefined
        ? partialConfig.showHeadmasterSign
          ? resolveSignatureMode(current) === 'both'
            ? 'both'
            : 'headmaster'
          : resolveSignatureMode(current) === 'teacher'
            ? 'teacher'
            : 'none'
        : resolveSignatureMode(current);

  const next: SchoolConfig = {
    name: nextName,
    subtitle: nextSubtitle,
    address: nextAddress,
    logoUrl: convertGDriveUrl(rawLogoLeft).converted.slice(0, 500),
    logoRightUrl: convertGDriveUrl(rawLogoRight).converted.slice(0, 500),
    kopLines: normalizeKopLines(
      partialConfig.kopLines !== undefined ? partialConfig.kopLines : current.kopLines,
      { name: nextName, subtitle: nextSubtitle, address: nextAddress }
    ),
    headmasterName: (partialConfig.headmasterName !== undefined
      ? String(partialConfig.headmasterName)
      : current.headmasterName || ''
    ).slice(0, 150),
    headmasterNip: (partialConfig.headmasterNip !== undefined
      ? String(partialConfig.headmasterNip)
      : current.headmasterNip || ''
    ).slice(0, 60),
    cityName: (partialConfig.cityName !== undefined
      ? String(partialConfig.cityName)
      : current.cityName || ''
    ).slice(0, 100),
    showKopSurat:
      partialConfig.showKopSurat !== undefined
        ? Boolean(partialConfig.showKopSurat)
        : current.showKopSurat ?? true,
    showHeadmasterSign: resolvedMode === 'headmaster' || resolvedMode === 'both',
    signatureMode: resolvedMode,
    teacherSignTitle: (partialConfig.teacherSignTitle !== undefined
      ? String(partialConfig.teacherSignTitle)
      : current.teacherSignTitle || 'Guru / Wali Kelas'
    ).slice(0, 100),
    teacherSignName: (partialConfig.teacherSignName !== undefined
      ? String(partialConfig.teacherSignName)
      : current.teacherSignName || ''
    ).slice(0, 150),
    teacherSignNip: (partialConfig.teacherSignNip !== undefined
      ? String(partialConfig.teacherSignNip)
      : current.teacherSignNip || ''
    ).slice(0, 60),
    loginLogoUrl: convertGDriveUrl(rawLoginLogo).converted.slice(0, 500),
    loginTitle: (partialConfig.loginTitle !== undefined
      ? String(partialConfig.loginTitle)
      : current.loginTitle || ''
    ).slice(0, 150),
    loginSubtitle: (partialConfig.loginSubtitle !== undefined
      ? String(partialConfig.loginSubtitle)
      : current.loginSubtitle || ''
    ).slice(0, 200),
    loginDescription: (partialConfig.loginDescription !== undefined
      ? String(partialConfig.loginDescription)
      : current.loginDescription || ''
    ).slice(0, 300),
    loginFooterText: (partialConfig.loginFooterText !== undefined
      ? String(partialConfig.loginFooterText)
      : current.loginFooterText || ''
    ).slice(0, 120),
    loginFormTitle: (partialConfig.loginFormTitle !== undefined
      ? String(partialConfig.loginFormTitle)
      : current.loginFormTitle || ''
    ).slice(0, 120),
    loginFormSubtitle: (partialConfig.loginFormSubtitle !== undefined
      ? String(partialConfig.loginFormSubtitle)
      : current.loginFormSubtitle || ''
    ).slice(0, 250),
    showLoginKkm:
      partialConfig.showLoginKkm !== undefined
        ? Boolean(partialConfig.showLoginKkm)
        : current.showLoginKkm ?? true,
    theme: normalizeThemeId(
      partialConfig.theme !== undefined ? partialConfig.theme : current.theme
    ),
    kkm:
      partialConfig.kkm !== undefined &&
      !isNaN(Number(partialConfig.kkm)) &&
      Number(partialConfig.kkm) >= 0 &&
      Number(partialConfig.kkm) <= 100
        ? Number(partialConfig.kkm)
        : current.kkm,
    subjectKkm:
      partialConfig.subjectKkm !== undefined
        ? normalizeSubjectKkm(partialConfig.subjectKkm)
        : current.subjectKkm || {},
  };

  const batch = writeBatch(db);
  addWriteProof(batch, adminKey);
  batch.update(doc(db, 'school_settings', 'main'), {
    name: next.name,
    subtitle: next.subtitle,
    address: next.address,
    logoUrl: next.logoUrl,
    logoRightUrl: next.logoRightUrl || '',
    kopLines: next.kopLines || [],
    headmasterName: next.headmasterName || '',
    headmasterNip: next.headmasterNip || '',
    cityName: next.cityName || '',
    showKopSurat: next.showKopSurat ?? true,
    showHeadmasterSign: next.showHeadmasterSign ?? true,
    signatureMode: next.signatureMode || 'headmaster',
    teacherSignTitle: next.teacherSignTitle || 'Guru / Wali Kelas',
    teacherSignName: next.teacherSignName || '',
    teacherSignNip: next.teacherSignNip || '',
    loginLogoUrl: next.loginLogoUrl || '',
    loginTitle: next.loginTitle || '',
    loginSubtitle: next.loginSubtitle || '',
    loginDescription: next.loginDescription || '',
    loginFooterText: next.loginFooterText || '',
    loginFormTitle: next.loginFormTitle || '',
    loginFormSubtitle: next.loginFormSubtitle || '',
    showLoginKkm: next.showLoginKkm ?? true,
    theme: next.theme || 'royal-violet',
    kkm: next.kkm,
    subjectKkm: next.subjectKkm || {},
    updatedAt: serverTimestamp(),
  });
  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, SCHOOL_DOC_PATH);
  }

  state.config = next;
  savePublicCache({
    config: next,
    subjects: state.subjects,
    components: state.components,
    visibility: state.visibility,
  });

  return {
    ok: true,
    message: 'Pengaturan sekolah, kop surat, dan tema berhasil disimpan.',
    config: next,
  };
}

export async function saveSubjectKkm(
  session: AuthSession,
  subjectKkmMap: Record<string, number>
): Promise<ApiResponse> {
  const state = await hydrateAdminCache(session, false);
  const cleanMap = normalizeSubjectKkm(subjectKkmMap);

  const batch = writeBatch(db);
  addWriteProof(batch, state.adminKey);
  batch.update(doc(db, 'school_settings', 'main'), {
    subjectKkm: cleanMap,
    updatedAt: serverTimestamp(),
  });
  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, SCHOOL_DOC_PATH);
  }

  const nextConfig: SchoolConfig = {
    ...state.config,
    subjectKkm: cleanMap,
  };
  state.config = nextConfig;
  savePublicCache({
    config: nextConfig,
    subjects: state.subjects,
    components: state.components,
    visibility: state.visibility,
  });

  return {
    ok: true,
    message: 'Pengaturan KKM per mata pelajaran berhasil disimpan.',
    config: nextConfig,
  };
}

export interface PortalBackupBundle {
  version: number;
  exportedAt: string;
  config?: Partial<SchoolConfig>;
  subjects?: string[];
  components?: string[];
  visibility?: GradeVisibilityConfig;
  students: StudentRecord[];
}

export async function importPortalBundle(
  session: AuthSession,
  bundle: PortalBackupBundle,
  mode: 'upsert' | 'skip' = 'upsert'
): Promise<ApiResponse> {
  const state = await hydrateAdminCache(session, false);
  const { adminKey } = state;

  let nextConfig = state.config;
  let nextSubjects = state.subjects;
  let nextComponents = state.components;
  let nextVisibility = state.visibility;

  const hasSettingsToUpdate =
    Boolean(bundle.config) ||
    Boolean(bundle.subjects?.length) ||
    Boolean(bundle.components?.length) ||
    Boolean(bundle.visibility);

  if (hasSettingsToUpdate) {
    if (bundle.config) {
      nextConfig = normalizeSchoolConfig({ ...state.config, ...bundle.config });
    }
    if (Array.isArray(bundle.subjects) && bundle.subjects.length > 0) {
      nextSubjects = Array.from(
        new Set(
          [...state.subjects, ...bundle.subjects.map((s) => String(s).trim().slice(0, 100))]
            .filter(Boolean)
        )
      ).slice(0, 50);
    }
    if (Array.isArray(bundle.components) && bundle.components.length > 0) {
      nextComponents = Array.from(
        new Set(
          [...state.components, ...bundle.components.map((c) => String(c).trim().slice(0, 100))]
            .filter(Boolean)
        )
      ).slice(0, 20);
    }
    if (bundle.visibility) {
      nextVisibility = normalizeVisibility(bundle.visibility);
    }

    const settingsBatch = writeBatch(db);
    addWriteProof(settingsBatch, adminKey);
    if (bundle.config) {
      settingsBatch.update(doc(db, 'school_settings', 'main'), {
        name: nextConfig.name,
        subtitle: nextConfig.subtitle,
        address: nextConfig.address,
        logoUrl: nextConfig.logoUrl,
        logoRightUrl: nextConfig.logoRightUrl || '',
        kopLines: nextConfig.kopLines || [],
        headmasterName: nextConfig.headmasterName || '',
        headmasterNip: nextConfig.headmasterNip || '',
        cityName: nextConfig.cityName || '',
        showKopSurat: nextConfig.showKopSurat ?? true,
        showHeadmasterSign: nextConfig.showHeadmasterSign ?? true,
        signatureMode: resolveSignatureMode(nextConfig),
        teacherSignTitle: nextConfig.teacherSignTitle || 'Guru / Wali Kelas',
        teacherSignName: nextConfig.teacherSignName || '',
        teacherSignNip: nextConfig.teacherSignNip || '',
        loginLogoUrl: nextConfig.loginLogoUrl || '',
        loginTitle: nextConfig.loginTitle || '',
        loginSubtitle: nextConfig.loginSubtitle || '',
        loginDescription: nextConfig.loginDescription || '',
        loginFooterText: nextConfig.loginFooterText || '',
        loginFormTitle: nextConfig.loginFormTitle || '',
        loginFormSubtitle: nextConfig.loginFormSubtitle || '',
        showLoginKkm: nextConfig.showLoginKkm ?? true,
        theme: nextConfig.theme || 'royal-violet',
        kkm: nextConfig.kkm,
        subjectKkm: nextConfig.subjectKkm || {},
        updatedAt: serverTimestamp(),
      });
    }
    settingsBatch.update(doc(db, 'academic_settings', 'main'), {
      subjects: nextSubjects,
      components: nextComponents,
      visibility: nextVisibility,
      updatedAt: serverTimestamp(),
    });
    try {
      await settingsBatch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, SCHOOL_DOC_PATH);
    }

    state.config = nextConfig;
    state.subjects = nextSubjects;
    state.components = nextComponents;
    state.visibility = nextVisibility;
    savePublicCache({
      config: nextConfig,
      subjects: nextSubjects,
      components: nextComponents,
      visibility: nextVisibility,
    });
  }

  let studentResult: ApiResponse | null = null;
  if (Array.isArray(bundle.students) && bundle.students.length > 0) {
    studentResult = await importStudents(
      session,
      bundle.students,
      nextSubjects,
      mode,
      nextComponents
    );
  }

  return {
    ok: true,
    message: studentResult?.message
      ? `Pengaturan & ${studentResult.message}`
      : 'Pengaturan sekolah, tema, dan kop surat berhasil diimpor.',
    config: nextConfig,
    subjects: state.subjects,
    components: state.components,
    visibility: state.visibility,
    students: studentResult?.students || getSortedStudentsFromCache(state),
  };
}

export interface SavePortalUserInput {
  id?: string;
  username: string;
  password?: string;
  nama: string;
  email?: string;
  nip?: string;
  role: PortalUserRole;
  assignedSubjects: string[];
  assignedClasses: string[];
  active: boolean;
}

export async function savePortalUser(
  session: AuthSession,
  mode: 'add' | 'edit',
  input: SavePortalUserInput
): Promise<ApiResponse> {
  const state = await hydrateAdminCache(session, false);
  const { adminKey } = state;

  const cleanUsername = input.username.trim().slice(0, 80);
  const cleanNama = input.nama.trim().slice(0, 150);
  const cleanPassword = (input.password || '').trim();
  const cleanEmail = (input.email || '').trim().slice(0, 150);
  const cleanNip = (input.nip || '').trim().slice(0, 60);
  const role: PortalUserRole = input.role === 'admin' ? 'admin' : 'guru';
  const assignedSubjects =
    role === 'guru'
      ? Array.from(new Set(input.assignedSubjects.map((s) => s.trim().slice(0, 100)).filter(Boolean))).slice(0, 50)
      : [];
  const assignedClasses =
    role === 'guru'
      ? Array.from(new Set(input.assignedClasses.map((c) => c.trim().slice(0, 50)).filter(Boolean))).slice(0, 50)
      : [];
  const active = Boolean(input.active);

  if (!cleanUsername || !cleanNama) {
    throw new Error('Username dan Nama lengkap wajib diisi.');
  }
  if (cleanUsername.toLowerCase() === 'admin') {
    throw new Error('Username "admin" sudah digunakan untuk Administrator Utama.');
  }

  if (mode === 'add') {
    if (cleanPassword.length < 4) {
      throw new Error('Password minimal 4 karakter.');
    }
    for (const entry of state.usersById.values()) {
      if (entry.user.username.toLowerCase() === cleanUsername.toLowerCase()) {
        throw new Error(`Username "${cleanUsername}" sudah terdaftar.`);
      }
    }

    const userId = `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const loginToken = await computeUserSessionToken(cleanUsername, cleanPassword);

    const userObj: PortalUser = {
      id: userId,
      username: cleanUsername,
      nama: cleanNama,
      email: cleanEmail,
      nip: cleanNip,
      role,
      assignedSubjects,
      assignedClasses,
      active,
    };

    const batch = writeBatch(db);
    addWriteProof(batch, adminKey);
    batch.set(doc(db, 'workspaces', adminKey, 'users', userId), {
      ...userObj,
      loginToken,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'user_sessions', loginToken), {
      userId,
      username: cleanUsername,
      nama: cleanNama,
      email: cleanEmail,
      nip: cleanNip,
      role,
      assignedSubjects,
      assignedClasses,
      active,
      workspaceKey: active ? adminKey : '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `workspaces/${adminKey}/users/${userId}`);
    }

    state.usersById.set(userId, { user: userObj, loginToken });

    return {
      ok: true,
      message: `Akun ${role === 'admin' ? 'Administrator' : 'Guru'} "${cleanNama}" berhasil ditambahkan.`,
      user: userObj,
      users: getSortedUsersFromCache(state),
    };
  }

  // Edit mode
  const targetId = String(input.id || '').trim();
  const existingEntry = state.usersById.get(targetId);
  if (!existingEntry) {
    throw new Error('Akun pengguna tidak ditemukan.');
  }

  for (const [id, entry] of state.usersById.entries()) {
    if (id !== targetId && entry.user.username.toLowerCase() === cleanUsername.toLowerCase()) {
      throw new Error(`Username "${cleanUsername}" sudah digunakan pengguna lain.`);
    }
  }

  const usernameChanged =
    existingEntry.user.username.toLowerCase() !== cleanUsername.toLowerCase();
  if (usernameChanged && cleanPassword.length < 4) {
    throw new Error('Masukkan password baru (min. 4 karakter) saat mengubah username.');
  }
  if (cleanPassword && cleanPassword.length < 4) {
    throw new Error('Password baru minimal 4 karakter.');
  }

  const oldToken = existingEntry.loginToken;
  const newToken = cleanPassword
    ? await computeUserSessionToken(cleanUsername, cleanPassword)
    : oldToken;

  const userObj: PortalUser = {
    id: targetId,
    username: cleanUsername,
    nama: cleanNama,
    email: cleanEmail,
    nip: cleanNip,
    role,
    assignedSubjects,
    assignedClasses,
    active,
  };

  let sameTokenExists = false;
  if (oldToken === newToken && newToken) {
    const snap = await getDoc(doc(db, 'user_sessions', newToken));
    sameTokenExists = snap.exists();
  }

  const batch = writeBatch(db);
  addWriteProof(batch, adminKey);
  batch.update(doc(db, 'workspaces', adminKey, 'users', targetId), {
    ...userObj,
    loginToken: newToken,
    updatedAt: serverTimestamp(),
  });

  if (oldToken && oldToken !== newToken) {
    batch.delete(doc(db, 'user_sessions', oldToken));
  }

  if (oldToken === newToken && sameTokenExists) {
    batch.update(doc(db, 'user_sessions', newToken), {
      userId: targetId,
      username: cleanUsername,
      nama: cleanNama,
      email: cleanEmail,
      nip: cleanNip,
      role,
      assignedSubjects,
      assignedClasses,
      active,
      workspaceKey: active ? adminKey : '',
      updatedAt: serverTimestamp(),
    });
  } else {
    batch.set(doc(db, 'user_sessions', newToken), {
      userId: targetId,
      username: cleanUsername,
      nama: cleanNama,
      email: cleanEmail,
      nip: cleanNip,
      role,
      assignedSubjects,
      assignedClasses,
      active,
      workspaceKey: active ? adminKey : '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `workspaces/${adminKey}/users/${targetId}`);
  }

  state.usersById.set(targetId, { user: userObj, loginToken: newToken });

  return {
    ok: true,
    message: `Akun "${cleanNama}" berhasil diperbarui.`,
    user: userObj,
    users: getSortedUsersFromCache(state),
  };
}

export async function togglePortalUserActive(
  session: AuthSession,
  userId: string,
  active: boolean
): Promise<ApiResponse> {
  const state = await hydrateAdminCache(session, false);
  const { adminKey } = state;
  const entry = state.usersById.get(userId);
  if (!entry) {
    throw new Error('Akun pengguna tidak ditemukan.');
  }

  const batch = writeBatch(db);
  addWriteProof(batch, adminKey);
  batch.update(doc(db, 'workspaces', adminKey, 'users', userId), {
    active,
    updatedAt: serverTimestamp(),
  });
  if (entry.loginToken) {
    batch.update(doc(db, 'user_sessions', entry.loginToken), {
      active,
      workspaceKey: active ? adminKey : '',
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `workspaces/${adminKey}/users/${userId}`);
  }

  const nextUser: PortalUser = { ...entry.user, active };
  state.usersById.set(userId, { ...entry, user: nextUser });

  return {
    ok: true,
    message: `Akun "${nextUser.nama}" ${active ? 'diaktifkan' : 'dinonaktifkan'}.`,
    users: getSortedUsersFromCache(state),
  };
}

export async function deletePortalUser(
  session: AuthSession,
  userId: string
): Promise<ApiResponse> {
  const state = await hydrateAdminCache(session, false);
  const { adminKey } = state;
  const entry = state.usersById.get(userId);
  if (!entry) {
    throw new Error('Akun pengguna tidak ditemukan.');
  }

  const batch = writeBatch(db);
  addWriteProof(batch, adminKey);
  batch.delete(doc(db, 'workspaces', adminKey, 'users', userId));
  if (entry.loginToken) {
    batch.delete(doc(db, 'user_sessions', entry.loginToken));
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `workspaces/${adminKey}/users/${userId}`);
  }

  state.usersById.delete(userId);

  return {
    ok: true,
    message: `Akun "${entry.user.nama}" berhasil dihapus.`,
    users: getSortedUsersFromCache(state),
  };
}

export async function bulkUpdatePortalUsers(
  session: AuthSession,
  userIds: string[],
  changes: {
    active?: boolean;
    role?: PortalUserRole;
    assignedSubjects?: string[];
    assignedClasses?: string[];
  }
): Promise<ApiResponse> {
  if (!userIds.length) {
    throw new Error('Tidak ada akun yang dipilih untuk diperbarui.');
  }

  const state = await hydrateAdminCache(session, false);
  const { adminKey } = state;

  interface PreparedUserUpdate {
    user: PortalUser;
    loginToken: string;
    sessionExists: boolean;
  }

  const targets: Array<{ entry: CachedPortalUserEntry; nextUser: PortalUser }> = [];
  for (const id of userIds) {
    const entry = state.usersById.get(id);
    if (!entry) continue;
    const nextRole: PortalUserRole = changes.role ?? entry.user.role;
    const nextActive = changes.active !== undefined ? changes.active : entry.user.active;
    const nextSubjects =
      nextRole === 'guru'
        ? changes.assignedSubjects !== undefined
          ? Array.from(
              new Set(changes.assignedSubjects.map((s) => s.trim().slice(0, 100)).filter(Boolean))
            ).slice(0, 50)
          : entry.user.assignedSubjects
        : [];
    const nextClasses =
      nextRole === 'guru'
        ? changes.assignedClasses !== undefined
          ? Array.from(
              new Set(changes.assignedClasses.map((c) => c.trim().slice(0, 50)).filter(Boolean))
            ).slice(0, 50)
          : entry.user.assignedClasses
        : [];

    targets.push({
      entry,
      nextUser: {
        ...entry.user,
        role: nextRole,
        active: nextActive,
        assignedSubjects: nextSubjects,
        assignedClasses: nextClasses,
      },
    });
  }

  if (!targets.length) {
    throw new Error('Tidak ditemukan akun yang valid untuk diperbarui.');
  }

  const sessionSnaps = await Promise.all(
    targets.map((t) =>
      t.entry.loginToken ? getDoc(doc(db, 'user_sessions', t.entry.loginToken)) : Promise.resolve(null)
    )
  );

  const prepared: PreparedUserUpdate[] = targets.map((t, i) => ({
    user: t.nextUser,
    loginToken: t.entry.loginToken,
    sessionExists: Boolean(sessionSnaps[i]?.exists()),
  }));

  await commitBatchedOps(
    adminKey,
    (batch, idx) => {
      const p = prepared[idx];
      batch.update(doc(db, 'workspaces', adminKey, 'users', p.user.id), {
        ...p.user,
        loginToken: p.loginToken,
        updatedAt: serverTimestamp(),
      });
      if (p.loginToken) {
        if (p.sessionExists) {
          batch.update(doc(db, 'user_sessions', p.loginToken), {
            userId: p.user.id,
            username: p.user.username,
            nama: p.user.nama,
            email: p.user.email || '',
            nip: p.user.nip || '',
            role: p.user.role,
            assignedSubjects: p.user.assignedSubjects,
            assignedClasses: p.user.assignedClasses,
            active: p.user.active,
            workspaceKey: p.user.active ? adminKey : '',
            updatedAt: serverTimestamp(),
          });
        } else {
          batch.set(doc(db, 'user_sessions', p.loginToken), {
            userId: p.user.id,
            username: p.user.username,
            nama: p.user.nama,
            email: p.user.email || '',
            nip: p.user.nip || '',
            role: p.user.role,
            assignedSubjects: p.user.assignedSubjects,
            assignedClasses: p.user.assignedClasses,
            active: p.user.active,
            workspaceKey: p.user.active ? adminKey : '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }
    },
    prepared.length,
    `workspaces/${adminKey}/users`
  );

  for (const p of prepared) {
    state.usersById.set(p.user.id, { user: p.user, loginToken: p.loginToken });
  }

  return {
    ok: true,
    message: `${prepared.length} akun pengguna berhasil diperbarui.`,
    users: getSortedUsersFromCache(state),
  };
}

export async function bulkDeletePortalUsers(
  session: AuthSession,
  userIds: string[]
): Promise<ApiResponse> {
  if (!userIds.length) {
    throw new Error('Tidak ada akun yang dipilih untuk dihapus.');
  }

  const state = await hydrateAdminCache(session, false);
  const { adminKey } = state;

  const targets: Array<{ id: string; loginToken: string }> = [];
  for (const id of userIds) {
    const entry = state.usersById.get(id);
    if (entry) {
      targets.push({ id, loginToken: entry.loginToken });
    }
  }

  await commitBatchedOps(
    adminKey,
    (batch, idx) => {
      const t = targets[idx];
      batch.delete(doc(db, 'workspaces', adminKey, 'users', t.id));
      if (t.loginToken) {
        batch.delete(doc(db, 'user_sessions', t.loginToken));
      }
    },
    targets.length,
    `workspaces/${adminKey}/users`
  );

  for (const t of targets) {
    state.usersById.delete(t.id);
  }

  return {
    ok: true,
    message: `${targets.length} akun pengguna berhasil dihapus.`,
    users: getSortedUsersFromCache(state),
  };
}

export async function importPortalUsers(
  session: AuthSession,
  incomingUsers: SavePortalUserInput[],
  mode: 'upsert' | 'skip'
): Promise<ApiResponse> {
  if (!incomingUsers.length) {
    throw new Error('Tidak ada baris data pengguna untuk diimpor.');
  }

  const state = await hydrateAdminCache(session, false);
  const { adminKey } = state;

  const byUsernameLower = new Map<string, CachedPortalUserEntry>();
  for (const entry of state.usersById.values()) {
    byUsernameLower.set(entry.user.username.toLowerCase(), entry);
  }

  interface PreparedUserImport {
    kind: 'add' | 'edit';
    user: PortalUser;
    oldToken: string;
    newToken: string;
    checkSameTokenExists?: boolean;
    sameTokenExists?: boolean;
  }

  const prepared: PreparedUserImport[] = [];
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const raw of incomingUsers) {
    const cleanUsername = raw.username.trim().slice(0, 80);
    const cleanNama = raw.nama.trim().slice(0, 150);
    const cleanPass = (raw.password || '').trim();
    if (!cleanUsername || !cleanNama || cleanUsername.toLowerCase() === 'admin') {
      skipped++;
      continue;
    }

    const role: PortalUserRole = raw.role === 'admin' ? 'admin' : 'guru';
    const assignedSubjects =
      role === 'guru'
        ? Array.from(new Set(raw.assignedSubjects.map((s) => s.trim().slice(0, 100)).filter(Boolean))).slice(0, 50)
        : [];
    const assignedClasses =
      role === 'guru'
        ? Array.from(new Set(raw.assignedClasses.map((c) => c.trim().slice(0, 50)).filter(Boolean))).slice(0, 50)
        : [];

    const existing = byUsernameLower.get(cleanUsername.toLowerCase());
    if (existing) {
      if (mode === 'skip') {
        skipped++;
        continue;
      }
      if (cleanPass && cleanPass.length < 4) {
        skipped++;
        continue;
      }
      const newToken = cleanPass
        ? await computeUserSessionToken(cleanUsername, cleanPass)
        : existing.loginToken;

      const userObj: PortalUser = {
        id: existing.user.id,
        username: cleanUsername,
        nama: cleanNama,
        email: (raw.email || '').trim().slice(0, 150),
        nip: (raw.nip || '').trim().slice(0, 60),
        role,
        assignedSubjects,
        assignedClasses,
        active: Boolean(raw.active),
      };

      const op: PreparedUserImport = {
        kind: 'edit',
        user: userObj,
        oldToken: existing.loginToken,
        newToken,
        checkSameTokenExists: existing.loginToken === newToken && Boolean(newToken),
      };
      prepared.push(op);
      byUsernameLower.set(cleanUsername.toLowerCase(), { user: userObj, loginToken: newToken });
      updated++;
    } else {
      if (cleanPass.length < 4) {
        skipped++;
        continue;
      }
      const userId = `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}_${prepared.length}`;
      const newToken = await computeUserSessionToken(cleanUsername, cleanPass);
      const userObj: PortalUser = {
        id: userId,
        username: cleanUsername,
        nama: cleanNama,
        email: (raw.email || '').trim().slice(0, 150),
        nip: (raw.nip || '').trim().slice(0, 60),
        role,
        assignedSubjects,
        assignedClasses,
        active: Boolean(raw.active),
      };
      prepared.push({
        kind: 'add',
        user: userObj,
        oldToken: '',
        newToken,
      });
      byUsernameLower.set(cleanUsername.toLowerCase(), { user: userObj, loginToken: newToken });
      inserted++;
    }
  }

  const sameTokenChecks = prepared.filter((p) => p.checkSameTokenExists);
  if (sameTokenChecks.length > 0) {
    const snaps = await Promise.all(
      sameTokenChecks.map((p) => getDoc(doc(db, 'user_sessions', p.newToken)))
    );
    sameTokenChecks.forEach((p, idx) => {
      p.sameTokenExists = snaps[idx].exists();
    });
  }

  if (prepared.length > 0) {
    await commitBatchedOps(
      adminKey,
      (batch, idx) => {
        const p = prepared[idx];
        const u = p.user;
        if (p.kind === 'add') {
          batch.set(doc(db, 'workspaces', adminKey, 'users', u.id), {
            ...u,
            loginToken: p.newToken,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          batch.set(doc(db, 'user_sessions', p.newToken), {
            userId: u.id,
            username: u.username,
            nama: u.nama,
            email: u.email || '',
            nip: u.nip || '',
            role: u.role,
            assignedSubjects: u.assignedSubjects,
            assignedClasses: u.assignedClasses,
            active: u.active,
            workspaceKey: u.active ? adminKey : '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          batch.update(doc(db, 'workspaces', adminKey, 'users', u.id), {
            ...u,
            loginToken: p.newToken,
            updatedAt: serverTimestamp(),
          });
          if (p.oldToken && p.oldToken !== p.newToken) {
            batch.delete(doc(db, 'user_sessions', p.oldToken));
          }
          if (p.oldToken === p.newToken && p.sameTokenExists) {
            batch.update(doc(db, 'user_sessions', p.newToken), {
              userId: u.id,
              username: u.username,
              nama: u.nama,
              email: u.email || '',
              nip: u.nip || '',
              role: u.role,
              assignedSubjects: u.assignedSubjects,
              assignedClasses: u.assignedClasses,
              active: u.active,
              workspaceKey: u.active ? adminKey : '',
              updatedAt: serverTimestamp(),
            });
          } else {
            batch.set(doc(db, 'user_sessions', p.newToken), {
              userId: u.id,
              username: u.username,
              nama: u.nama,
              email: u.email || '',
              nip: u.nip || '',
              role: u.role,
              assignedSubjects: u.assignedSubjects,
              assignedClasses: u.assignedClasses,
              active: u.active,
              workspaceKey: u.active ? adminKey : '',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        }
        state.usersById.set(u.id, { user: u, loginToken: p.newToken });
      },
      prepared.length,
      `workspaces/${adminKey}/users`
    );
  }

  return {
    ok: true,
    message: `Impor user selesai: ${inserted} ditambah, ${updated} diperbarui, ${skipped} dilewati.`,
    stats: { inserted, updated, skipped },
    users: getSortedUsersFromCache(state),
  };
}
