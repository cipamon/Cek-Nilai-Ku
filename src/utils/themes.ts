import { ThemePresetId } from '../types';

export interface ThemePreset {
  id: ThemePresetId;
  name: string;
  description: string;
  pageBg: string;
  primary: string;
  primaryHover: string;
  heading: string;
  softBg: string;
  softBorder: string;
  gradFrom: string;
  gradVia: string;
  gradTo: string;
  swatchGradient: string;
}

export const THEME_PRESETS: Record<ThemePresetId, ThemePreset> = {
  'royal-violet': {
    id: 'royal-violet',
    name: 'Ungu Indigo (Default)',
    description: 'Gradasi ungu elektrik dan indigo modern sesuai palet warna pilihan.',
    pageBg: '#F5F3FF',
    primary: '#6D28D9',
    primaryHover: '#5B21B6',
    heading: '#5B21B6',
    softBg: '#EDE9FE',
    softBorder: '#DDD6FE',
    gradFrom: '#6C2DF4',
    gradVia: '#5335E5',
    gradTo: '#3729B0',
    swatchGradient: 'linear-gradient(135deg, #6C2DF4 0%, #5335E5 50%, #3729B0 100%)',
  },
  'bright-blue': {
    id: 'bright-blue',
    name: 'Biru Cerah',
    description: 'Biru akademik cerah dan bersih dengan sentuhan langit biru.',
    pageBg: '#F0F7FF',
    primary: '#2563EB',
    primaryHover: '#1D4ED8',
    heading: '#1D4ED8',
    softBg: '#DBEAFE',
    softBorder: '#BFDBFE',
    gradFrom: '#2563EB',
    gradVia: '#3B82F6',
    gradTo: '#0EA5E9',
    swatchGradient: 'linear-gradient(135deg, #2563EB 0%, #3B82F6 50%, #0EA5E9 100%)',
  },
  'emerald-teal': {
    id: 'emerald-teal',
    name: 'Hijau Zamrud',
    description: 'Hijau zamrud sejuk dan berwibawa untuk suasana pendidikan yang asri.',
    pageBg: '#ECFDF5',
    primary: '#059669',
    primaryHover: '#047857',
    heading: '#047857',
    softBg: '#D1FAE5',
    softBorder: '#A7F3D0',
    gradFrom: '#047857',
    gradVia: '#059669',
    gradTo: '#0D9488',
    swatchGradient: 'linear-gradient(135deg, #047857 0%, #059669 50%, #0D9488 100%)',
  },
  'teal-cyan': {
    id: 'teal-cyan',
    name: 'Toska Modern',
    description: 'Kombinasi cyan dan teal yang segar, kontras tinggi, dan modern.',
    pageBg: '#ECFEFF',
    primary: '#0891B2',
    primaryHover: '#0E7490',
    heading: '#0E7490',
    softBg: '#CFFAFE',
    softBorder: '#A5F3FC',
    gradFrom: '#0E7490',
    gradVia: '#0891B2',
    gradTo: '#0284C7',
    swatchGradient: 'linear-gradient(135deg, #0E7490 0%, #0891B2 50%, #0284C7 100%)',
  },
  'crimson-rose': {
    id: 'crimson-rose',
    name: 'Merah Marun',
    description: 'Aksen merah mawar tegas dan berenergi untuk identitas sekolah unggulan.',
    pageBg: '#FFF1F2',
    primary: '#E11D48',
    primaryHover: '#BE123C',
    heading: '#BE123C',
    softBg: '#FFE4E6',
    softBorder: '#FECDD3',
    gradFrom: '#BE123C',
    gradVia: '#E11D48',
    gradTo: '#DB2777',
    swatchGradient: 'linear-gradient(135deg, #BE123C 0%, #E11D48 50%, #DB2777 100%)',
  },
  'amber-gold': {
    id: 'amber-gold',
    name: 'Emas & Navy',
    description: 'Perpaduan navy formal dengan aksen emas klasik yang elegan.',
    pageBg: '#FFFBEB',
    primary: '#D97706',
    primaryHover: '#B45309',
    heading: '#92400E',
    softBg: '#FEF3C7',
    softBorder: '#FDE68A',
    gradFrom: '#1E293B',
    gradVia: '#334155',
    gradTo: '#B45309',
    swatchGradient: 'linear-gradient(135deg, #1E293B 0%, #334155 55%, #D97706 100%)',
  },
};

export const THEME_LIST: ThemePreset[] = Object.values(THEME_PRESETS);

export function getThemePreset(themeId?: string): ThemePreset {
  if (themeId && themeId in THEME_PRESETS) {
    return THEME_PRESETS[themeId as ThemePresetId];
  }
  return THEME_PRESETS['royal-violet'];
}

export function applyThemeToDocument(themeId?: string): ThemePreset {
  const preset = getThemePreset(themeId);
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.style.setProperty('--theme-page-bg', preset.pageBg);
    root.style.setProperty('--theme-primary', preset.primary);
    root.style.setProperty('--theme-primary-hover', preset.primaryHover);
    root.style.setProperty('--theme-heading', preset.heading);
    root.style.setProperty('--theme-soft-bg', preset.softBg);
    root.style.setProperty('--theme-soft-border', preset.softBorder);
    root.style.setProperty('--theme-grad-from', preset.gradFrom);
    root.style.setProperty('--theme-grad-via', preset.gradVia);
    root.style.setProperty('--theme-grad-to', preset.gradTo);
  }
  return preset;
}
