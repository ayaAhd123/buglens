export function readConfig(env = process.env) {
  const mode = env.ANALYSIS_MODE ?? 'gemini';
  if (!['gemini', 'mock'].includes(mode)) throw new Error('Invalid ANALYSIS_MODE.');
  const port = Number(env.PORT ?? 3001);
  const timeoutMs = Number(env.GEMINI_TIMEOUT_MS ?? 30000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT.');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000) throw new Error('Invalid GEMINI_TIMEOUT_MS.');
  const apiKey = env.GEMINI_API_KEY?.trim() ?? '';
  if (mode === 'gemini' && !apiKey) throw new Error('GEMINI_API_KEY is required in gemini mode.');
  const model = env.GEMINI_MODEL ?? 'gemini-2.5-flash';
  if (!/^[a-zA-Z0-9.-]+$/.test(model)) throw new Error('Invalid GEMINI_MODEL.');
  const origins = (env.CORS_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',').map(value => value.trim()).filter(Boolean);
  for (const origin of origins) {
    let url;
    try { url = new URL(origin); } catch { throw new Error('Invalid CORS_ORIGINS.'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) throw new Error('Invalid CORS_ORIGINS.');
  }
  return { mode, apiKey, model, timeoutMs, origins, port, host: env.HOST ?? '127.0.0.1' };
}
