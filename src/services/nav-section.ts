// A recruitment page opened from a section list (/recruitments/x?from=results) belongs to that
// section, so the header and breadcrumb keep it highlighted instead of falling back to All Jobs.
export const SECTION_LABELS = {
  results: 'Results',
  'admit-cards': 'Admit Cards',
  'answer-keys': 'Answer Keys',
  calendar: 'Exam Calendar',
} as const;

export type NavSection = keyof typeof SECTION_LABELS;

export function sectionFrom(url: URL): NavSection | null {
  if (!url.pathname.startsWith('/recruitments')) return null;
  const from = url.searchParams.get('from');
  return from && from in SECTION_LABELS ? (from as NavSection) : null;
}

// The path nav items match against: the section list's path when the page came from one.
export function navPathname(url: URL): string {
  const section = sectionFrom(url);
  return section ? `/${section}` : url.pathname;
}
