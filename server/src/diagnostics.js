// Only fixed vocabulary may cross the diagnostic boundary. Never retain messages,
// response bodies, request headers, source, or arbitrary provider strings.
const codes = new Set([
  'INVALID_ARGUMENT', 'FAILED_PRECONDITION', 'OUT_OF_RANGE', 'UNAUTHENTICATED',
  'PERMISSION_DENIED', 'RESOURCE_EXHAUSTED', 'NOT_FOUND', 'INTERNAL',
  'UNAVAILABLE', 'DEADLINE_EXCEEDED', 'CANCELLED', 'UNKNOWN',
]);
const categories = new Set(['authentication', 'quota', 'timeout', 'model', 'provider', 'invalid response', 'unknown']);

export function safeProviderCode(value) {
  return typeof value === 'string' && codes.has(value) ? value : null;
}

export function classifyProvider(status, code) {
  if (status === 429 || code === 'RESOURCE_EXHAUSTED') return 'quota';
  if (status === 401 || status === 403 || ['UNAUTHENTICATED', 'PERMISSION_DENIED'].includes(code)) return 'authentication';
  if (status === 408 || status === 504 || code === 'DEADLINE_EXCEEDED') return 'timeout';
  if (status === 404 || code === 'NOT_FOUND') return 'model';
  if (status >= 500 || ['INTERNAL', 'UNAVAILABLE'].includes(code)) return 'provider';
  // Invalid arguments/preconditions can have multiple causes. Do not guess.
  return 'unknown';
}

export function failureRecord(error, correlationId, apiKey) {
  const details = error?.diagnostics;
  const record = {
    event: 'analysis_failed', correlationId,
    role: ['Detective', 'Reviewer'].includes(details?.role) ? details.role : null,
    upstreamStatus: Number.isInteger(details?.upstreamStatus) && details.upstreamStatus >= 100 && details.upstreamStatus <= 599 ? details.upstreamStatus : null,
    providerCode: safeProviderCode(details?.providerCode),
    category: categories.has(details?.category) ? details.category : 'unknown',
  };
  // Defense in depth if a configured credential happens to equal an allowed code.
  if (apiKey && record.providerCode?.includes(apiKey)) record.providerCode = null;
  return record;
}
