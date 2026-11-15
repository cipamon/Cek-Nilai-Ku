import {
  GenderCode,
  GradeVisibilityConfig,
  PortalUser,
  PortalUserRole,
  SchoolConfig,
  SignatureDisplayMode,
  StudentRecord,
} from '../types';

export const DEFAULT_KOP_LINES: string[] = [
  'YAYASAN PENDIDIKAN / PEMERINTAH DAERAH',
  'DINAS PENDIDIKAN DAN KEBUDAYAAN',
  'SMA NEGERI NUSANTARA',
  'Jl. Pendidikan No. 1, Indonesia',
  'Telp. (021) 0000000 · Laman: https://sekolah.sch.id',
  'Email: admin@sekolah.sch.id · NPSN: 00000000',
];

export const DEFAULT_SCHOOL_CONFIG: SchoolConfig = {
  name: 'SMA Negeri Nusantara',
  subtitle: 'Portal Akademik & Transkrip Nilai Siswa',
  address: 'Jl. Pendidikan No. 1, Indonesia',
  logoUrl: '',
  logoRightUrl: '',
  kopLines: [...DEFAULT_KOP_LINES],
  headmasterName: '',
  headmasterNip: '',
  cityName: '',
  showKopSurat: true,
  showHeadmasterSign: true,
  signatureMode: 'headmaster',
  teacherSignTitle: 'Guru / Wali Kelas',
  teacherSignName: '',
  teacherSignNip: '',
  loginLogoUrl: '',
  loginTitle: '',
  loginSubtitle: '',
  loginDescription: '',
  loginFooterText: 'Portal Terpadu Siswa, Guru & Admin',
  loginFormTitle: 'Portal Nilai Sekolah',
  loginFormSubtitle:
    'Masuk satu pintu untuk Siswa (NIS & NISN), Guru, maupun Administrator.',
  showLoginKkm: true,
  theme: 'royal-violet',
  kkm: 75,
  subjectKkm: {},
};

export function resolveSignatureMode(config: SchoolConfig): SignatureDisplayMode {
  const mode = config.signatureMode;
  if (mode === 'both' || mode === 'headmaster' || mode === 'teacher' || mode === 'none') {
    return mode;
  }
  return config.showHeadmasterSign === false ? 'none' : 'headmaster';
}

export function getSubjectKkm(
  kkmOrConfig: number | SchoolConfig | undefined,
  subject?: string
): number {
  if (typeof kkmOrConfig === 'number') {
    return !isNaN(kkmOrConfig) && kkmOrConfig >= 0 && kkmOrConfig <= 100 ? kkmOrConfig : 75;
  }
  const fallback =
    kkmOrConfig &&
    typeof kkmOrConfig.kkm === 'number' &&
    !isNaN(kkmOrConfig.kkm) &&
    kkmOrConfig.kkm >= 0 &&
    kkmOrConfig.kkm <= 100
      ? kkmOrConfig.kkm
      : 75;

  if (subject && kkmOrConfig?.subjectKkm) {
    const custom = Number(kkmOrConfig.subjectKkm[subject]);
    if (!isNaN(custom) && custom >= 0 && custom <= 100) {
      return custom;
    }
  }
  return fallback;
}

export const DEFAULT_ASSESSMENT_COMPONENTS = ['Tugas', 'UH', 'PTS', 'PAS'];

export const DEFAULT_GRADE_VISIBILITY: GradeVisibilityConfig = {
  mode: 'all',
  visibleSubjects: [],
  visibleComponents: [],
  showComponentDetails: true,
  showAverageAndStatus: true,
  applyToAdminViews: false,
  showStudentPhoto: true,
  showPrintButton: true,
};

export function resolvePortalBranding(config: SchoolConfig) {
  return {
    logoUrl:
      (config.loginLogoUrl || '').trim() ||
      (config.logoUrl || '').trim() ||
      (config.logoRightUrl || '').trim(),
    title: (config.loginTitle || '').trim() || config.name,
    subtitle: (config.loginSubtitle || '').trim() || config.subtitle,
    description: (config.loginDescription || '').trim() || config.address,
    footerText: (config.loginFooterText || '').trim() || 'Portal Terpadu Siswa, Guru & Admin',
    formTitle: (config.loginFormTitle || '').trim() || 'Portal Nilai Sekolah',
    formSubtitle:
      (config.loginFormSubtitle || '').trim() ||
      'Masuk satu pintu untuk Siswa (NIS & NISN), Guru, maupun Administrator.',
    showKkm: config.showLoginKkm ?? true,
  };
}

export function normalizeGender(raw?: unknown): GenderCode {
  const val = String(raw || '').trim().toUpperCase();
  if (!val) return '';
  if (
    val === 'L' ||
    val === 'LK' ||
    val === 'LAKI-LAKI' ||
    val === 'LAKI LAKI' ||
    val === 'LAKI' ||
    val === 'PRIA' ||
    val === 'COWOK' ||
    val === 'MALE' ||
    val === 'M'
  ) {
    return 'L';
  }
  if (
    val === 'P' ||
    val === 'PR' ||
    val === 'PEREMPUAN' ||
    val === 'WANITA' ||
    val === 'CEWEK' ||
    val === 'FEMALE' ||
    val === 'F'
  ) {
    return 'P';
  }
  return '';
}

export function formatGenderLabel(gender?: string): string {
  const g = normalizeGender(gender);
  if (g === 'L') return 'Laki-laki';
  if (g === 'P') return 'Perempuan';
  return '-';
}

export function normalizeKopLines(
  kopLines?: unknown,
  fallback?: { name?: string; subtitle?: string; address?: string }
): string[] {
  if (Array.isArray(kopLines) && kopLines.length > 0) {
    const out: string[] = [];
    for (let i = 0; i < 6; i++) {
      out.push(String(kopLines[i] ?? '').slice(0, 200));
    }
    return out;
  }

  return [
    DEFAULT_KOP_LINES[0],
    DEFAULT_KOP_LINES[1],
    (fallback?.name || DEFAULT_SCHOOL_CONFIG.name).toUpperCase(),
    fallback?.subtitle || DEFAULT_SCHOOL_CONFIG.subtitle,
    fallback?.address || DEFAULT_SCHOOL_CONFIG.address,
    DEFAULT_KOP_LINES[5],
  ];
}

export function resolveVisibleGrades(
  subjects: string[],
  components: string[],
  visibility?: GradeVisibilityConfig
): {
  activeSubjects: string[];
  activeComponents: string[];
  isSubjectFiltered: boolean;
  isComponentFiltered: boolean;
} {
  if (!visibility || visibility.mode === 'all') {
    return {
      activeSubjects: subjects,
      activeComponents: components,
      isSubjectFiltered: false,
      isComponentFiltered: false,
    };
  }

  const subjSet = new Set(visibility.visibleSubjects);
  const compSet = new Set(visibility.visibleComponents);

  const activeSubjects = subjects.filter((s) => subjSet.has(s));
  const activeComponents = components.filter((c) => compSet.has(c));

  return {
    activeSubjects,
    activeComponents,
    isSubjectFiltered: activeSubjects.length !== subjects.length,
    isComponentFiltered: activeComponents.length !== components.length,
  };
}

export function getVisibleStudentView(
  student: StudentRecord,
  subjects: string[],
  components: string[],
  visibility?: GradeVisibilityConfig
): {
  student: StudentRecord;
  activeSubjects: string[];
  activeComponents: string[];
  isSubjectFiltered: boolean;
  isComponentFiltered: boolean;
} {
  const { activeSubjects, activeComponents, isSubjectFiltered, isComponentFiltered } =
    resolveVisibleGrades(subjects, components, visibility);

  if (!visibility || visibility.mode === 'all' || !isComponentFiltered) {
    return {
      student,
      activeSubjects,
      activeComponents,
      isSubjectFiltered,
      isComponentFiltered,
    };
  }

  const compSet = new Set(activeComponents);
  const nextScores: Record<string, number> = {};
  const nextDetails: Record<string, Record<string, number>> = {};

  for (const subj of activeSubjects) {
    const rawDetail = student.scoreDetails?.[subj];
    if (rawDetail && Object.keys(rawDetail).length > 0) {
      const filteredDetail: Record<string, number> = {};
      for (const [k, v] of Object.entries(rawDetail)) {
        if (compSet.has(k)) {
          filteredDetail[k] = v;
        }
      }
      if (Object.keys(filteredDetail).length > 0) {
        nextDetails[subj] = filteredDetail;
        nextScores[subj] = computeSubjectFinalScore(filteredDetail, 0);
      } else {
        nextScores[subj] = 0;
      }
    } else {
      nextScores[subj] = student.scores?.[subj] ?? 0;
    }
  }

  return {
    student: {
      ...student,
      scores: nextScores,
      scoreDetails: nextDetails,
    },
    activeSubjects,
    activeComponents,
    isSubjectFiltered,
    isComponentFiltered,
  };
}

export function computeSubjectFinalScore(
  componentMap?: Record<string, number>,
  fallbackScore = 0
): number {
  if (!componentMap) return fallbackScore;
  const entries = Object.values(componentMap).filter(
    (v) => typeof v === 'number' && !isNaN(v)
  );
  if (entries.length === 0) return fallbackScore;
  const sum = entries.reduce((acc, n) => acc + n, 0);
  return Math.round((sum / entries.length) * 100) / 100;
}

export function convertGDriveUrl(rawUrl: string): { converted: string; changed: boolean } {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return { converted: '', changed: false };

  let fileId: string | null = null;

  const filePathMatch = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i);
  if (filePathMatch && filePathMatch[1]) {
    fileId = filePathMatch[1];
  }

  if (!fileId) {
    const idParamMatch = trimmed.match(
      /drive\.google\.com\/(?:open|uc|thumbnail)\?[^#]*[?&]?id=([a-zA-Z0-9_-]+)/i
    );
    if (idParamMatch && idParamMatch[1]) {
      fileId = idParamMatch[1];
    }
  }

  if (fileId) {
    const directUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
    return {
      converted: directUrl,
      changed: directUrl !== trimmed,
    };
  }

  return { converted: trimmed, changed: false };
}

export function sortStudents(students: StudentRecord[]): StudentRecord[] {
  return [...students].sort((a, b) => {
    const classCmp = (a.kelas || '').localeCompare(b.kelas || '', 'id', {
      numeric: true,
      sensitivity: 'base',
    });
    if (classCmp !== 0) return classCmp;

    const numA = parseInt(String(a.noAbsen || '').replace(/\D/g, ''), 10);
    const numB = parseInt(String(b.noAbsen || '').replace(/\D/g, ''), 10);

    if (!isNaN(numA) && !isNaN(numB)) {
      if (numA !== numB) return numA - numB;
    }
    return (a.noAbsen || '').localeCompare(b.noAbsen || '', 'id', { numeric: true });
  });
}

export function getPredicate(score: number, kkm: number): 'A' | 'B' | 'C' | 'D' {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= kkm) return 'C';
  return 'D';
}

export interface StudentMetrics {
  total: number;
  average: number;
  remedialSubjects: Array<{ subject: string; score: number; kkm: number }>;
  passedCount: number;
  allPassed: boolean;
}

export function calculateStudentMetrics(
  student: StudentRecord,
  subjects: string[],
  kkmOrConfig: number | SchoolConfig
): StudentMetrics {
  if (!subjects.length) {
    return {
      total: 0,
      average: 0,
      remedialSubjects: [],
      passedCount: 0,
      allPassed: true,
    };
  }

  let total = 0;
  const remedialSubjects: Array<{ subject: string; score: number; kkm: number }> = [];

  for (const subj of subjects) {
    const raw = student.scores?.[subj];
    const score = typeof raw === 'number' && !isNaN(raw) ? raw : Number(raw) || 0;
    const subjKkm = getSubjectKkm(kkmOrConfig, subj);
    total += score;
    if (score < subjKkm) {
      remedialSubjects.push({ subject: subj, score, kkm: subjKkm });
    }
  }

  const average = total / subjects.length;
  return {
    total,
    average,
    remedialSubjects,
    passedCount: subjects.length - remedialSubjects.length,
    allPassed: remedialSubjects.length === 0,
  };
}

export function parseCsvText(rawText: string): { headers: string[]; rows: string[][] } {
  const cleanText = rawText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const firstLine = cleanText.split('\n')[0] || '';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const delimiter = semiCount > commaCount ? ';' : ',';

  const parsedRows: string[][] = [];
  let currentRow: string[] = [];
  let currentVal = '';
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const ch = cleanText[i];
    const nextCh = cleanText[i + 1];

    if (inQuotes) {
      if (ch === '"' && nextCh === '"') {
        currentVal += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentVal += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        currentRow.push(stripExcelFormulaWrapper(currentVal.trim()));
        currentVal = '';
      } else if (ch === '\n') {
        currentRow.push(stripExcelFormulaWrapper(currentVal.trim()));
        if (currentRow.some((cell) => cell !== '')) {
          parsedRows.push(currentRow);
        }
        currentRow = [];
        currentVal = '';
      } else {
        currentVal += ch;
      }
    }
  }

  if (currentVal.length > 0 || currentRow.length > 0) {
    currentRow.push(stripExcelFormulaWrapper(currentVal.trim()));
    if (currentRow.some((cell) => cell !== '')) {
      parsedRows.push(currentRow);
    }
  }

  if (parsedRows.length === 0) {
    return { headers: [], rows: [] };
  }

  return {
    headers: parsedRows[0],
    rows: parsedRows.slice(1),
  };
}

const FIXED_CSV_KEYS = new Set([
  'nis',
  'nisn',
  'nama',
  'nama siswa',
  'nama lengkap',
  'jenis kelamin',
  'jeniskelamin',
  'jenis_kelamin',
  'jk',
  'kelamin',
  'gender',
  'l/p',
  'lp',
  'noabsen',
  'no absen',
  'no_absen',
  'absen',
  'kelas',
  'ttl',
  'tempat tanggal lahir',
  'email',
  'email siswa',
  'alamat email',
  'e-mail',
  'status',
  'status kelulusan',
  'foto',
  'photourl',
  'photo_url',
  'foto_url',
  'url foto',
  'foto siswa',
]);

export function parseStudentsCsvText(text: string):
  | {
      ok: true;
      students: StudentRecord[];
      subjectsFromCsv: string[];
      componentsFromCsv: string[];
    }
  | { ok: false; error: string } {
  const { headers, rows } = parseCsvText(text);
  if (headers.length < 3 || rows.length === 0) {
    return { ok: false, error: 'File CSV kosong atau format header tidak valid.' };
  }

  const lowerHeaders = headers.map((h) => h.trim().toLowerCase());
  const findCol = (aliases: string[]) => lowerHeaders.findIndex((h) => aliases.includes(h));

  const idxNis = findCol(['nis']);
  const idxNisn = findCol(['nisn']);
  const idxNama = findCol(['nama', 'nama siswa', 'nama lengkap']);
  const idxGender = findCol([
    'jenis kelamin',
    'jeniskelamin',
    'jenis_kelamin',
    'jk',
    'kelamin',
    'gender',
    'l/p',
    'lp',
  ]);
  const idxAbsen = findCol(['noabsen', 'no absen', 'no_absen', 'absen']);
  const idxKelas = findCol(['kelas']);
  const idxTtl = findCol(['ttl', 'tempat tanggal lahir']);
  const idxEmail = findCol(['email', 'email siswa', 'alamat email', 'e-mail']);
  const idxStatus = findCol(['status', 'status kelulusan']);
  const idxFoto = findCol(['foto', 'photourl', 'photo_url', 'foto_url', 'url foto', 'foto siswa']);

  if (idxNis === -1 || idxNisn === -1 || idxNama === -1) {
    return {
      ok: false,
      error: 'Kolom wajib "NIS", "NISN", dan "Nama" harus ada pada baris header CSV.',
    };
  }

  const ignoredSummaryCols = new Set(['jumlah', 'rata-rata', 'rata rata', 'ketuntasan']);
  const fixedIndices = new Set(
    [
      idxNis,
      idxNisn,
      idxNama,
      idxGender,
      idxAbsen,
      idxKelas,
      idxTtl,
      idxEmail,
      idxStatus,
      idxFoto,
    ].filter((i) => i >= 0)
  );

  const simpleSubjectCols: Array<{ index: number; name: string }> = [];
  const compCols: Array<{ index: number; subject: string; component: string }> = [];
  const subjectSet = new Set<string>();
  const compSet = new Set<string>();

  headers.forEach((rawHeader, idx) => {
    const clean = rawHeader.trim();
    const low = clean.toLowerCase();
    if (
      !clean ||
      FIXED_CSV_KEYS.has(low) ||
      fixedIndices.has(idx) ||
      ignoredSummaryCols.has(low) ||
      low.startsWith('nilai akhir ')
    ) {
      return;
    }

    const compMatch = clean.match(/^(.+?)\s*\[(.+?)\]$/);
    if (compMatch) {
      const subjName = compMatch[1].trim();
      const compName = compMatch[2].trim();
      compCols.push({ index: idx, subject: subjName, component: compName });
      subjectSet.add(subjName);
      compSet.add(compName);
    } else {
      simpleSubjectCols.push({ index: idx, name: clean });
      subjectSet.add(clean);
    }
  });

  const parsedStudents: StudentRecord[] = [];
  for (const row of rows) {
    const nis = String(row[idxNis] ?? '').trim();
    const nama = String(row[idxNama] ?? '').trim();
    if (!nis || !nama) continue;

    const scores: Record<string, number> = {};
    const scoreDetails: Record<string, Record<string, number>> = {};

    for (const sc of simpleSubjectCols) {
      const rawVal = String(row[sc.index] ?? '').trim().replace(',', '.');
      const num = rawVal === '' ? 0 : Number(rawVal);
      scores[sc.name] = isNaN(num) ? 0 : num;
    }

    for (const cc of compCols) {
      const rawVal = String(row[cc.index] ?? '').trim().replace(',', '.');
      if (rawVal === '') continue;
      const num = Number(rawVal);
      if (!isNaN(num)) {
        if (!scoreDetails[cc.subject]) scoreDetails[cc.subject] = {};
        scoreDetails[cc.subject][cc.component] = num;
      }
    }

    for (const [subj, det] of Object.entries(scoreDetails)) {
      if (Object.keys(det).length > 0) {
        scores[subj] = computeSubjectFinalScore(det, scores[subj] ?? 0);
      }
    }

    const rawFoto = idxFoto >= 0 ? String(row[idxFoto] ?? '').trim() : '';
    const photoUrl = rawFoto ? convertGDriveUrl(rawFoto).converted.slice(0, 500) : '';
    const jenisKelamin = idxGender >= 0 ? normalizeGender(row[idxGender]) : '';

    parsedStudents.push({
      nis,
      nisn: String(row[idxNisn] ?? '').trim(),
      nama,
      jenisKelamin,
      noAbsen: idxAbsen >= 0 ? String(row[idxAbsen] ?? '').trim() : '',
      kelas: idxKelas >= 0 ? String(row[idxKelas] ?? '').trim() : '',
      ttl: idxTtl >= 0 ? String(row[idxTtl] ?? '').trim() : '',
      email: idxEmail >= 0 ? String(row[idxEmail] ?? '').trim().slice(0, 150) : '',
      status:
        idxStatus >= 0 && String(row[idxStatus] ?? '').trim()
          ? String(row[idxStatus]).trim()
          : 'LULUS',
      photoUrl,
      scores,
      scoreDetails: Object.keys(scoreDetails).length > 0 ? scoreDetails : undefined,
    });
  }

  if (parsedStudents.length === 0) {
    return { ok: false, error: 'Tidak ditemukan baris siswa dengan NIS dan Nama yang valid.' };
  }

  return {
    ok: true,
    students: parsedStudents,
    subjectsFromCsv: Array.from(subjectSet),
    componentsFromCsv: Array.from(compSet),
  };
}

function stripExcelFormulaWrapper(val: string): string {
  const match = val.match(/^="(.*)"$/);
  return match ? match[1] : val;
}

function escapeCsvCell(value: string | number): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildStudentsCsv(
  students: StudentRecord[],
  subjects: string[],
  includeSummaryColumns = true,
  kkmOrConfig: number | SchoolConfig = 75
): string {
  const baseHeaders = [
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
  ];
  const summaryHeaders = includeSummaryColumns ? ['Jumlah', 'Rata-Rata', 'Ketuntasan'] : [];
  const allHeaders = [...baseHeaders, ...subjects, ...summaryHeaders];

  const lines: string[] = [allHeaders.map(escapeCsvCell).join(',')];

  for (const st of sortStudents(students)) {
    const metrics = calculateStudentMetrics(st, subjects, kkmOrConfig);
    const rowCells: (string | number)[] = [
      st.nis,
      st.nisn,
      st.nama,
      normalizeGender(st.jenisKelamin),
      st.noAbsen,
      st.kelas,
      st.ttl,
      st.email || '',
      st.status,
      st.photoUrl || '',
      ...subjects.map((subj) => st.scores?.[subj] ?? 0),
    ];

    if (includeSummaryColumns) {
      rowCells.push(
        Number(metrics.total.toFixed(2)),
        Number(metrics.average.toFixed(2)),
        metrics.allPassed ? 'Tuntas' : `Remidi (${metrics.remedialSubjects.length})`
      );
    }

    lines.push(rowCells.map(escapeCsvCell).join(','));
  }

  return '\uFEFF' + lines.join('\r\n');
}

export function buildSubjectDetailCsv(
  students: StudentRecord[],
  subject: string,
  components: string[],
  kkm = 75
): string {
  const baseHeaders = ['NIS', 'NISN', 'Nama', 'Jenis Kelamin', 'NoAbsen', 'Kelas', 'Email', 'Foto'];
  const compHeaders = components.map((c) => `${subject} [${c}]`);
  const allHeaders = [...baseHeaders, ...compHeaders, `Nilai Akhir ${subject}`, 'Ketuntasan'];

  const lines: string[] = [allHeaders.map(escapeCsvCell).join(',')];

  for (const st of sortStudents(students)) {
    const details = st.scoreDetails?.[subject] || {};
    const finalScore = Number(st.scores?.[subject] ?? 0);
    const rowCells: (string | number)[] = [
      st.nis,
      st.nisn,
      st.nama,
      normalizeGender(st.jenisKelamin),
      st.noAbsen,
      st.kelas,
      st.email || '',
      st.photoUrl || '',
      ...components.map((c) => (details[c] !== undefined ? details[c] : '')),
      finalScore,
      finalScore < kkm ? 'Remidi' : 'Tuntas',
    ];
    lines.push(rowCells.map(escapeCsvCell).join(','));
  }

  return '\uFEFF' + lines.join('\r\n');
}

export function downloadTextFile(
  content: string,
  filename: string,
  mimeType = 'text/csv;charset=utf-8;'
) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export interface ParsedCsvPortalUser {
  username: string;
  nama: string;
  role: PortalUserRole;
  nip: string;
  email: string;
  assignedSubjects: string[];
  assignedClasses: string[];
  active: boolean;
  password: string;
}

export function buildUsersCsv(users: PortalUser[]): string {
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
  const lines: string[] = [headers.map(escapeCsvCell).join(',')];

  for (const u of users) {
    const row = [
      u.username,
      u.nama,
      u.role,
      u.nip || '',
      u.email || '',
      (u.assignedSubjects || []).join(' | '),
      (u.assignedClasses || []).join(' | '),
      u.active ? 'Aktif' : 'Nonaktif',
      '',
    ];
    lines.push(row.map(escapeCsvCell).join(','));
  }

  return '\uFEFF' + lines.join('\r\n');
}

function splitListCell(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  const sep = trimmed.includes('|') ? '|' : ';';
  return Array.from(
    new Set(
      trimmed
        .split(sep)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

export function parseUsersCsvText(
  text: string
): { ok: true; users: ParsedCsvPortalUser[] } | { ok: false; error: string } {
  const { headers, rows } = parseCsvText(text);
  if (headers.length < 2 || rows.length === 0) {
    return { ok: false, error: 'File CSV kosong atau format header tidak valid.' };
  }

  const lowerHeaders = headers.map((h) => h.trim().toLowerCase());
  const findCol = (aliases: string[]) => lowerHeaders.findIndex((h) => aliases.includes(h));

  const idxUsername = findCol(['username', 'user', 'akun', 'id login']);
  const idxNama = findCol(['nama', 'nama lengkap', 'nama guru', 'nama user']);
  const idxRole = findCol(['peran', 'role', 'hak akses', 'level']);
  const idxNip = findCol(['nip', 'nuptk', 'nip/nuptk']);
  const idxEmail = findCol(['email', 'e-mail', 'alamat email']);
  const idxSubjects = findCol(['mapel diampu', 'mapel', 'mata pelajaran', 'subjects']);
  const idxClasses = findCol(['kelas diampu', 'kelas', 'rombel', 'classes']);
  const idxStatus = findCol(['status', 'aktif', 'active']);
  const idxPassword = findCol(['password', 'kata sandi', 'sandi', 'pass']);

  if (idxUsername === -1 || idxNama === -1) {
    return {
      ok: false,
      error: 'Kolom wajib "Username" dan "Nama" harus ada pada baris header CSV.',
    };
  }

  const parsed: ParsedCsvPortalUser[] = [];
  for (const row of rows) {
    const username = String(row[idxUsername] ?? '').trim().slice(0, 80);
    const nama = String(row[idxNama] ?? '').trim().slice(0, 150);
    if (!username || !nama || username.toLowerCase() === 'admin') continue;

    const rawRole = idxRole >= 0 ? String(row[idxRole] ?? '').trim().toLowerCase() : 'guru';
    const role: PortalUserRole =
      rawRole === 'admin' || rawRole === 'administrator' ? 'admin' : 'guru';

    const rawStatus = idxStatus >= 0 ? String(row[idxStatus] ?? '').trim().toLowerCase() : 'aktif';
    const active = !(
      rawStatus === 'nonaktif' ||
      rawStatus === 'tidak aktif' ||
      rawStatus === 'inactive' ||
      rawStatus === 'false' ||
      rawStatus === '0'
    );

    const assignedSubjects =
      role === 'guru' && idxSubjects >= 0
        ? splitListCell(String(row[idxSubjects] ?? '')).slice(0, 50)
        : [];
    const assignedClasses =
      role === 'guru' && idxClasses >= 0
        ? splitListCell(String(row[idxClasses] ?? '')).slice(0, 50)
        : [];

    parsed.push({
      username,
      nama,
      role,
      nip: idxNip >= 0 ? String(row[idxNip] ?? '').trim().slice(0, 60) : '',
      email: idxEmail >= 0 ? String(row[idxEmail] ?? '').trim().slice(0, 150) : '',
      assignedSubjects,
      assignedClasses,
      active,
      password: idxPassword >= 0 ? String(row[idxPassword] ?? '').trim() : '',
    });
  }

  if (parsed.length === 0) {
    return {
      ok: false,
      error: 'Tidak ditemukan baris akun dengan Username dan Nama yang valid.',
    };
  }

  return { ok: true, users: parsed };
}
