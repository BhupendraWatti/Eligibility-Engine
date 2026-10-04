/**
 * Hostname and subdomain helper utilities
 */

export function getHostname(request: Request | URL | string): string {
  if (typeof request === 'string') {
    try {
      return new URL(request).hostname.toLowerCase();
    } catch {
      return request.split(':')[0].toLowerCase();
    }
  }

  if (request instanceof URL) {
    return request.hostname.toLowerCase();
  }

  if (request && typeof request === 'object') {
    if ('url' in request && typeof request.url === 'string') {
      try {
        return new URL(request.url).hostname.toLowerCase();
      } catch {
        // Fall through for non-standard request objects.
      }
    }
    if ('headers' in request && typeof request.headers?.get === 'function') {
      const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
      if (host) {
        return host.split(':')[0].toLowerCase();
      }
    }
  }

  return '';
}

export function isAdminSubdomain(request: Request | URL | string): boolean {
  const hostname = getHostname(request);
  return hostname.startsWith('admin.');
}

export function isWorkersDev(hostname: string): boolean {
  const clean = hostname.split(':')[0].toLowerCase();
  return clean.endsWith('.workers.dev');
}
