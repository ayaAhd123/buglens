import express from 'express';
import { randomUUID } from 'node:crypto';
import { AnalysisError, createAnalyzer } from './analysis.js';
import { failureRecord } from './diagnostics.js';
import { validateRequest, validateDetective, validateReviewer } from './schema.js';

export function createApp(config, { analyze = createAnalyzer(config), logDiagnostic = record => console.error(JSON.stringify(record)) } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    // Always generate internally: caller-supplied IDs may contain sensitive data.
    res.locals.correlationId = randomUUID();
    res.set('X-Request-ID', res.locals.correlationId);
    res.set('Access-Control-Expose-Headers', 'X-Request-ID');
    res.set('Cache-Control', 'no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    res.vary('Origin');
    const origin = req.get('Origin');
    if (origin && !config.origins.includes(origin)) return res.status(403).json({ message: 'Origin is not allowed.' });
    if (origin) res.set('Access-Control-Allow-Origin', origin);
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type, Accept');
      return res.sendStatus(204);
    }
    next();
  });
  app.post('/api/analyze', (req, res, next) => {
    if (!req.is('application/json')) return res.status(415).json({ message: 'Content-Type must be application/json.' });
    next();
  }, express.json({ limit: '256kb', strict: true, inflate: false }), async (req, res) => {
    if (!validateRequest(req.body)) {
      return res.status(400).json({ message: 'Provide code (1–50000 characters, not blank) and language (javascript or typescript), with no extra fields.' });
    }
    const result = await analyze(req.body);
    for (const role of ['Detective', 'Reviewer']) {
      const validate = role === 'Detective' ? validateDetective : validateReviewer;
      if (!validate(result?.[role.toLowerCase()])) {
        throw new AnalysisError(502, 'Analysis provider returned an invalid response.', { role, category: 'invalid response' });
      }
      const section = JSON.stringify(result[role.toLowerCase()]);
      if (config.apiKey && section.includes(JSON.stringify(config.apiKey).slice(1, -1))) {
        throw new AnalysisError(502, 'Analysis response could not be safely returned.', { role, category: 'invalid response' });
      }
    }
    // Defense in depth: prevent configured credentials from appearing even if echoed by a provider.
    const json = JSON.stringify({ detective: result.detective, reviewer: result.reviewer });
    res.type('application/json').send(json);
  });
  app.use((_req, res) => res.status(404).json({ message: 'Endpoint not found.' }));
  app.use((error, _req, res, _next) => {
    if (error.type === 'entity.too.large') return res.status(413).json({ message: 'Request body is too large.' });
    if (error.type === 'entity.parse.failed') return res.status(400).json({ message: 'Request body must be valid JSON.' });
    if (error.status === 415) return res.status(415).json({ message: 'Unsupported request encoding.' });
    const correlationId = res.locals.correlationId;
    try { logDiagnostic(failureRecord(error, correlationId, config.apiKey)); } catch {
      // A broken log sink must not expose errors or change the API response.
    }
    const status = error instanceof AnalysisError && [502, 503, 504].includes(error.status) ? error.status : 500;
    res.status(status).json({ message: `Analysis could not be completed. Reference: ${correlationId}` });
  });
  return app;
}
