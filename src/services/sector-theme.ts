// src/services/sector-theme.ts
// Authoritative registry for Sector Icons, Themes, and Presentation standards in NIRNAY

export interface SectorIconDef {
  key: string;
  label: string;
  svgInner: string;
}

export const SECTOR_ICONS: Record<string, SectorIconDef> = {
  shield: {
    key: 'shield',
    label: 'Shield (Police & Defence)',
    svgInner: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />',
  },
  scale: {
    key: 'scale',
    label: 'Scales of Justice (Judiciary & Law)',
    svgInner: '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" /><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" /><path d="M7 21h10" /><path d="M12 3v18" /><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" />',
  },
  'graduation-cap': {
    key: 'graduation-cap',
    label: 'Graduation Cap (Education & Teaching)',
    svgInner: '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" /><path d="M22 10v6" /><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />',
  },
  trees: {
    key: 'trees',
    label: 'Trees (Forest & Wildlife)',
    svgInner: '<path d="M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z" /><path d="M7 16v6" /><path d="M13 19v3" /><path d="M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7l-2.6-3.4a1 1 0 0 0-1.6 0L10.8 7.3a1 1 0 0 0 .8 1.7H12l-3 3.3a1 1 0 0 0 .7 1.7H13" />',
  },
  wrench: {
    key: 'wrench',
    label: 'Wrench & Tool (Engineering & Trades)',
    svgInner: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />',
  },
  monitor: {
    key: 'monitor',
    label: 'Monitor / Computer (IT & e-Gov)',
    svgInner: '<rect width="20" height="14" x="2" y="3" rx="2" /><line x1="8" x2="16" y1="21" y2="21" /><line x1="12" x2="12" y1="17" y2="21" />',
  },
  landmark: {
    key: 'landmark',
    label: 'Landmark Secretariat (Civil Services)',
    svgInner: '<line x1="3" x2="21" y1="22" y2="22" /><line x1="6" x2="6" y1="18" y2="11" /><line x1="10" x2="10" y1="18" y2="11" /><line x1="14" x2="14" y1="18" y2="11" /><line x1="18" x2="18" y1="18" y2="11" /><polygon points="12 2 20 7 4 7" /><path d="M4 18h16" />',
  },
  activity: {
    key: 'activity',
    label: 'Activity Pulse (Health & Medical)',
    svgInner: '<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.48 12H2" />',
  },
  building: {
    key: 'building',
    label: 'Building (Revenue & Administration)',
    svgInner: '<rect width="16" height="20" x="4" y="2" rx="2" ry="2" /><path d="M9 22v-4h6v4" /><path d="M8 6h.01" /><path d="M16 6h.01" /><path d="M12 6h.01" /><path d="M12 10h.01" /><path d="M12 14h.01" /><path d="M16 10h.01" /><path d="M16 14h.01" /><path d="M8 10h.01" /><path d="M8 14h.01" />',
  },
  train: {
    key: 'train',
    label: 'Train (Railways & Transport)',
    svgInner: '<rect width="16" height="16" x="4" y="3" rx="2" /><path d="M4 11h16" /><path d="M12 3v8" /><path d="m8 19-2 3" /><path d="m18 22-2-3" /><path d="M8 15h0" /><path d="M16 15h0" />',
  },
  wallet: {
    key: 'wallet',
    label: 'Wallet (Banking & Finance)',
    svgInner: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" /><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />',
  },
  briefcase: {
    key: 'briefcase',
    label: 'Briefcase (General & Allied Services)',
    svgInner: '<rect width="20" height="14" x="2" y="7" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />',
  },
};

export const SECTOR_ICON_LIST = Object.values(SECTOR_ICONS);

export interface SectorThemeDef {
  key: string;
  label: string;
  badgeClass: string;
  hoverBorderClass: string;
}

export const SECTOR_THEMES: Record<string, SectorThemeDef> = {
  blue: {
    key: 'blue',
    label: 'Gov Blue (Cobalt)',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/60',
    hoverBorderClass: 'hover:border-blue-300 dark:hover:border-blue-800',
  },
  indigo: {
    key: 'indigo',
    label: 'Indigo (Defence)',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/60',
    hoverBorderClass: 'hover:border-indigo-300 dark:hover:border-indigo-800',
  },
  green: {
    key: 'green',
    label: 'Green (Forest & Ecology)',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/60',
    hoverBorderClass: 'hover:border-emerald-300 dark:hover:border-emerald-800',
  },
  amber: {
    key: 'amber',
    label: 'Amber (Revenue & Land)',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60',
    hoverBorderClass: 'hover:border-amber-300 dark:hover:border-amber-800',
  },
  red: {
    key: 'red',
    label: 'Red / Rose (Health & Medical)',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/60',
    hoverBorderClass: 'hover:border-rose-300 dark:hover:border-rose-800',
  },
  purple: {
    key: 'purple',
    label: 'Purple (Higher Education)',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900/60',
    hoverBorderClass: 'hover:border-purple-300 dark:hover:border-purple-800',
  },
  cyan: {
    key: 'cyan',
    label: 'Cyan (Digital & Technology)',
    badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-900/60',
    hoverBorderClass: 'hover:border-cyan-300 dark:hover:border-cyan-800',
  },
  slate: {
    key: 'slate',
    label: 'Slate (Judiciary & Administration)',
    badgeClass: 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
    hoverBorderClass: 'hover:border-zinc-300 dark:hover:border-zinc-700',
  },
};

export const SECTOR_THEME_LIST = Object.values(SECTOR_THEMES);

/**
 * Normalizes any icon input string (including legacy PascalCase icon names) into an approved key.
 * Always returns a valid registered icon key. Unknown or empty values safely return 'briefcase'.
 */
export function normalizeSectorIcon(rawIcon?: string | null): string {
  if (!rawIcon) return 'briefcase';
  const clean = rawIcon.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');

  if (SECTOR_ICONS[clean]) return clean;

  // Legacy mappings from initial prototype fixtures
  const legacyMap: Record<string, string> = {
    graduationcap: 'graduation-cap',
    tree: 'trees',
    tool: 'wrench',
    cpu: 'monitor',
    computer: 'monitor',
    building2: 'building',
    railway: 'train',
    coins: 'wallet',
    bank: 'wallet',
    users: 'briefcase',
  };

  const mapped = legacyMap[clean.replace(/-/g, '')];
  if (mapped && SECTOR_ICONS[mapped]) return mapped;

  return 'briefcase';
}

/**
 * Normalizes theme key to predefined safe set. Defaults to 'blue'.
 */
export function normalizeSectorTheme(rawTheme?: string | null): string {
  if (!rawTheme) return 'blue';
  const clean = rawTheme.trim().toLowerCase();
  if (SECTOR_THEMES[clean]) return clean;

  const aliasMap: Record<string, string> = {
    cobalt: 'blue',
    emerald: 'green',
    teal: 'cyan',
    rose: 'red',
    crimson: 'red',
    zinc: 'slate',
    gray: 'slate',
    grey: 'slate',
  };

  return aliasMap[clean] || 'blue';
}

/**
 * Returns the theme styling definition for a given theme key
 */
export function getSectorThemeDef(rawTheme?: string | null): SectorThemeDef {
  const normalizedKey = normalizeSectorTheme(rawTheme);
  return SECTOR_THEMES[normalizedKey] || SECTOR_THEMES.blue;
}

/**
 * Returns the icon definition for a given icon key
 */
export function getSectorIconDef(rawIcon?: string | null): SectorIconDef {
  const normalizedKey = normalizeSectorIcon(rawIcon);
  return SECTOR_ICONS[normalizedKey] || SECTOR_ICONS.briefcase;
}
