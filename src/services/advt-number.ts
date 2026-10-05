/** An advertisement number is stored as NULL when the official notice states none (never a substitute reference number). */
export const ADVT_NOT_STATED = 'Not stated';

export function cleanAdvt(value: unknown): string | null {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || null;
}

export function advtLabel(value: unknown): string {
  return cleanAdvt(value) ?? ADVT_NOT_STATED;
}
