export function recordPortalActivity(
  kind: 'LOGIN' | 'DOWNLOAD' | 'MEETING',
  title: string,
  options: { companyId?: string; metadata?: Record<string, unknown> } = {},
) {
  return fetch('/api/audit-events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, title, ...options }),
  });
}
