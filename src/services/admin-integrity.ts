type ReferenceRecord = {
  id: string;
  slug?: string | null;
  name?: string | null;
  code?: string | null;
  shortName?: string | null;
};

export type AdminSubmission = {
  value: (...keys: string[]) => unknown;
  text: (...keys: string[]) => string;
};

export class AdminValidationError extends Error {
  readonly code = 'INVALID_ADMIN_INPUT';
}

export async function readAdminSubmission(request: Request): Promise<AdminSubmission> {
  let values: Record<string, unknown>;
  if ((request.headers.get('content-type') || '').includes('application/json')) {
    const body = await request.json().catch(() => ({}));
    values = body && typeof body === 'object' && !Array.isArray(body)
      ? body as Record<string, unknown>
      : {};
  } else {
    values = Object.fromEntries(await request.formData());
  }

  const value = (...keys: string[]): unknown => {
    for (const key of keys) {
      const candidate = values[key];
      if (candidate !== undefined && candidate !== null && candidate !== '') return candidate;
    }
    return undefined;
  };

  return {
    value,
    text: (...keys: string[]) => String(value(...keys) ?? '').trim(),
  };
}

export function resolveRequiredReference<T extends ReferenceRecord>(
  value: string,
  records: readonly T[],
  label: string,
): T {
  const requested = value.trim().toLowerCase();
  if (!requested) throw new AdminValidationError(`${label[0].toUpperCase()}${label.slice(1)} is required.`);

  const match = records.find(record =>
    [record.id, record.slug, record.name, record.code, record.shortName]
      .some(candidate => candidate?.toLowerCase() === requested),
  );

  if (!match) throw new AdminValidationError(`Unknown ${label}: ${value}`);
  return match;
}

export function parseBooleanInput(value: unknown, fallback = false): boolean {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;

  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  throw new AdminValidationError(`Invalid boolean value: ${value}`);
}

export function parseCheckboxInput(value: unknown): boolean {
  return parseBooleanInput(value, false);
}

export function parseIntegerInput(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(parsed)) throw new AdminValidationError(`Invalid integer value: ${value}`);
  return parsed;
}

export function parseOptionalNumberInput(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new AdminValidationError(`Invalid numeric value: ${value}`);
  return parsed;
}

export function parseStringListInput(value: unknown): string[] {
  if (value === undefined || value === null || value === '') return [];
  const items = Array.isArray(value) ? value : String(value).split(',');
  return items.map(item => String(item).trim()).filter(Boolean);
}

export function isAdminTestBypass(configuredToken: string | undefined, suppliedToken: string | null): boolean {
  return Boolean(configuredToken && suppliedToken && configuredToken === suppliedToken);
}

export function isAdminRequestAllowed(
  email: string | null,
  allowedAdmins: readonly string[],
  trustedLocalOrTestRequest = false,
): boolean {
  return Boolean(email && (trustedLocalOrTestRequest || allowedAdmins.includes(email.toLowerCase())));
}

export function isSameOrigin(origin: string | null, expectedHost: string): boolean {
  if (!origin) return false;
  try {
    return new URL(origin).host === expectedHost;
  } catch {
    return false;
  }
}
