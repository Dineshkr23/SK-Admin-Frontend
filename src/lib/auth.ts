export type UserRole = 'ADMIN' | 'DOC_MANAGER' | 'PRICE_EDITOR';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

function base64UrlDecode(input: string): string {
  // JWT uses base64url; convert to normal base64 first.
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  return atob(b64 + pad);
}

function decodeJwtPayload(token: string): unknown {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  const payload = parts[1];
  const json = base64UrlDecode(payload);
  try {
    return JSON.parse(json) as unknown;
  } catch {
    return null;
  }
}

export function getUserRole(): UserRole {
  const token = getToken();
  if (!token) return 'ADMIN';

  const payload = decodeJwtPayload(token) as { role?: unknown } | null;
  const role = payload?.role;

  if (role === 'ADMIN' || role === 'DOC_MANAGER' || role === 'PRICE_EDITOR') {
    return role;
  }

  // Backward compatibility: older JWTs didn't include `role`, so treat them as admin.
  return 'ADMIN';
}

