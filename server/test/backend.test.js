import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createApp } from '../src/app.js';
import { createAnalyzer } from '../src/analysis.js';
import { readConfig } from '../src/config.js';

const input = { code: 'const x = 1;', language: 'javascript' };
const detective = { summary: 'One issue', bugs: [{ severity: 'low', title: 'Unused', explanation: 'Unused variable', suggestedFix: 'Use it', line: 1 }], fixedCode: 'console.log(1);' };
const reviewer = { approved: true, feedback: 'Looks good', concerns: [] };
const mockConfig = () => readConfig({ ANALYSIS_MODE: 'mock' });
const geminiConfig = () => readConfig({ GEMINI_API_KEY: 'test-only-secret-never-real' });
const providerResponse = value => new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(value) }] } }] }));

async function serve(t, config = mockConfig(), options) {
  const server = createApp(config, { logDiagnostic: () => {}, ...options }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  return async (body = input, init = {}) => fetch(`http://127.0.0.1:${server.address().port}/api/analyze`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), ...init,
  });
}

test('mock supports both languages, preserves code, and never calls Gemini', async t => {
  const config = mockConfig();
  const analyze = createAnalyzer(config, () => { assert.fail('Mock must not use network'); });
  const post = await serve(t, config, { analyze });
  for (const language of ['javascript', 'typescript']) {
    const response = await post({ ...input, language });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.detective.fixedCode, input.code);
    assert.match(result.detective.summary, /Mock/);
    assert.equal(result.reviewer.approved, false);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-powered-by'), null);
  }
});

test('frontend parser accepts real backend success payload', async t => {
  // Read-only integration check against Cursor-owned parser; no client dependencies needed.
  const { stripTypeScriptTypes } = await import('node:module');
  const source = await readFile(new URL('../../client/src/api/analyze.ts', import.meta.url), 'utf8');
  const { parseAnalyzeResponse } = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}`);
  const post = await serve(t, mockConfig(), { analyze: async () => ({ detective, reviewer }) });
  assert.deepEqual(parseAnalyzeResponse(await (await post()).json()), { detective, reviewer });
});

test('invalid inputs are rejected before analysis', async t => {
  const post = await serve(t, mockConfig(), { analyze: () => assert.fail('Invalid input reached analysis') });
  for (const body of [null, [], {}, { ...input, code: '' }, { ...input, code: ' \n\t' }, { ...input, code: 123 }, { ...input, code: 'x'.repeat(50001) }, { ...input, language: 'python' }, { ...input, language: null }, { ...input, extra: true }]) {
    assert.equal((await post(body)).status, 400);
  }
  assert.equal((await post(input, { body: '{' })).status, 400);
  assert.equal((await post(input, { headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await post({ ...input, code: 'x'.repeat(300000) })).status, 413);
});

test('CORS permits configured origins and rejects others', async t => {
  const post = await serve(t);
  const allowed = await post(input, { headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' } });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  const denied = await post(input, { headers: { 'Content-Type': 'application/json', Origin: 'https://untrusted.example' } });
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get('access-control-allow-origin'), null);
  const preflight = await post(undefined, { method: 'OPTIONS', body: undefined, headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' } });
  assert.equal(preflight.status, 204);
  assert.match(preflight.headers.get('access-control-allow-methods'), /POST/);
});

test('Gemini runs Detective then Reviewer with schema and header-only credentials', async t => {
  const config = geminiConfig();
  const calls = [];
  const analyze = createAnalyzer(config, async (url, options) => {
    assert.equal(url.includes(config.apiKey), false);
    assert.equal(options.headers['x-goog-api-key'], config.apiKey);
    assert.equal(options.body.includes(config.apiKey), false);
    const body = JSON.parse(options.body);
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.ok(body.generationConfig.responseJsonSchema);
    calls.push(body);
    return providerResponse(calls.length === 1 ? detective : reviewer);
  });
  const post = await serve(t, config, { analyze });
  const response = await post();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { detective, reviewer });
  assert.equal(calls.length, 2);
  assert.match(calls[0].systemInstruction.parts[0].text, /Detective/);
  assert.match(calls[1].systemInstruction.parts[0].text, /Reviewer/);
  assert.deepEqual(JSON.parse(calls[1].contents[0].parts[0].text).detective, detective);
});

test('provider failures are sanitized and never become mock successes', async t => {
  const config = geminiConfig();
  const cases = [
    [() => new Response(config.apiKey, { status: 429 }), 503],
    [() => new Response(config.apiKey, { status: 401 }), 502],
    [() => { throw new Error(config.apiKey); }, 502],
    [() => { throw new DOMException(config.apiKey, 'TimeoutError'); }, 504],
    [() => new Response('not json'), 502],
    [() => new Response(JSON.stringify({ candidates: [{ finishReason: 'MAX_TOKENS' }] })), 502],
    [() => providerResponse({ ...detective, bugs: [{ severity: 'wrong', explanation: 'bad' }] }), 502],
    [() => providerResponse({ ...detective, fixedCode: 4 }), 502],
  ];
  for (const [provider, status] of cases) {
    const post = await serve(t, config, { analyze: createAnalyzer(config, provider) });
    const response = await post();
    assert.equal(response.status, status);
    const body = await response.text();
    assert.equal(body.includes(config.apiKey), false);
    assert.equal(typeof JSON.parse(body).message, 'string');
  }
});

test('invalid Reviewer output rejects the entire analysis', async t => {
  let calls = 0;
  const config = geminiConfig();
  const post = await serve(t, config, { analyze: createAnalyzer(config, async () => providerResponse(++calls === 1 ? detective : { ...reviewer, concerns: [123] })) });
  assert.equal((await post()).status, 502);
  assert.equal(calls, 2);
});

test('unexpected errors and credential echoes are not exposed', async t => {
  const config = geminiConfig();
  for (const [analyze, status] of [
    [async () => { throw new Error(config.apiKey); }, 500],
    [async () => ({ detective: { ...detective, summary: config.apiKey }, reviewer }), 502],
  ]) {
    const post = await serve(t, config, { analyze });
    const response = await post();
    assert.equal(response.status, status);
    assert.equal((await response.text()).includes(config.apiKey), false);
  }
});

test('configuration requires a key only in Gemini mode and fails closed', () => {
  assert.equal(mockConfig().apiKey, '');
  for (const env of [{}, { ANALYSIS_MODE: 'typo' }, { ANALYSIS_MODE: 'mock', PORT: 'oops' }, { ANALYSIS_MODE: 'mock', GEMINI_TIMEOUT_MS: '-1' }, { ANALYSIS_MODE: 'mock', CORS_ORIGINS: '*' }, { ANALYSIS_MODE: 'mock', GEMINI_MODEL: '../bad' }]) {
    assert.throws(() => readConfig(env));
  }
});

test('complete bug fix survives provider parsing, review, and HTTP delivery', async t => {
  const code = 'export function total(items) {\n  return items.reduce((sum, item) => sum + item.price);\n}\n\nexport const currency = "USD";\n';
  const fixedCode = 'export function total(items) {\n  return items.reduce((sum, item) => sum + item.price, 0);\n}\n\nexport const currency = "USD";\n';
  const report = { summary: 'Initialize the accumulator for empty lists.', bugs: [{ severity: 'high', explanation: 'An empty list throws without an initial value.', suggestedFix: 'Supply zero as the initial accumulator.', line: 2 }], fixedCode };
  const config = geminiConfig();
  let calls = 0;
  const post = await serve(t, config, { analyze: createAnalyzer(config, async (_url, options) => {
    const body = JSON.parse(options.body);
    if (++calls === 2) assert.deepEqual(JSON.parse(body.contents[0].parts[0].text).detective, report);
    return providerResponse(calls === 1 ? report : reviewer);
  }) });
  const response = await post({ code, language: 'javascript' });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { detective: report, reviewer });
  assert.equal(calls, 2);
});

test('single source fences are removed before review without changing report fields', async t => {
  for (const [fixedCode, expected] of [
    ['```javascript\nconsole.log(1);\n```', 'console.log(1);'],
    ['  ~~~typescript\r\nconst x: number = 1;\r\n~~~  ', 'const x: number = 1;'],
    ['```\n\n```', ''],
    ['const label = `value`;\nconst fence = "```";\n', 'const label = `value`;\nconst fence = "```";\n'],
  ]) {
    const config = geminiConfig();
    let calls = 0;
    const post = await serve(t, config, { analyze: createAnalyzer(config, async (_url, options) => {
      if (++calls === 2) assert.equal(JSON.parse(JSON.parse(options.body).contents[0].parts[0].text).detective.fixedCode, expected);
      return providerResponse(calls === 1 ? { ...detective, fixedCode } : reviewer);
    }) });
    const response = await post();
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { detective: { ...detective, fixedCode: expected }, reviewer });
  }
});

test('unavailable fix remains empty and preserves both reports', async t => {
  for (const fixedCode of ['', ' \n\t']) {
    const config = geminiConfig();
    const review = { approved: false, feedback: 'No complete fix is available.', concerns: ['Manual review required.'] };
    let calls = 0;
    const post = await serve(t, config, { analyze: createAnalyzer(config, async (_url, options) => {
      if (++calls === 2) assert.equal(JSON.parse(JSON.parse(options.body).contents[0].parts[0].text).detective.fixedCode, '');
      return providerResponse(calls === 1 ? { ...detective, fixedCode } : review);
    }) });
    const response = await post();
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { detective: { ...detective, fixedCode: '' }, reviewer: review });
    assert.equal(calls, 2);
  }
});

test('missing fields and ambiguous fenced fixes fail safely before Reviewer', async t => {
  for (const fixedCode of [undefined, null, '```js\ncode', '```js\ncode\n~~~', 'Explanation:\n```js\ncode\n```', '```js\na\n```\n```js\nb\n```']) {
    const config = geminiConfig();
    let calls = 0;
    const post = await serve(t, config, { analyze: createAnalyzer(config, async () => {
      calls++;
      return providerResponse({ ...detective, fixedCode });
    }) });
    const response = await post();
    assert.equal(response.status, 502);
    assert.deepEqual(Object.keys(await response.json()), ['message']);
    assert.equal(calls, 1);
  }
});

test('Reviewer provider errors after a valid fix never return partial success or secrets', async t => {
  for (const [failure, expectedStatus] of [
    [key => new Response(key, { status: 500 }), 502],
    [key => new Response(key, { status: 429 }), 503],
    [key => { throw new Error(key); }, 502],
    [key => { throw new DOMException(key, 'TimeoutError'); }, 504],
  ]) {
    const config = geminiConfig();
    let calls = 0;
    const post = await serve(t, config, { analyze: createAnalyzer(config, async () => ++calls === 1 ? providerResponse(detective) : failure(config.apiKey)) });
    const response = await post();
    assert.equal(response.status, expectedStatus);
    const body = await response.text();
    assert.equal(body.includes(config.apiKey), false);
    assert.deepEqual(Object.keys(JSON.parse(body)), ['message']);
    assert.equal(calls, 2);
  }
});

for (const failingRole of ['Detective', 'Reviewer']) {
  test(`${failingRole} failure logs safe status/code/category and matching correlation ID`, async t => {
    const config = geminiConfig();
    const logs = [];
    let calls = 0;
    const post = await serve(t, config, {
      logDiagnostic: record => logs.push(record),
      analyze: createAnalyzer(config, async () => {
        if (++calls === 1 && failingRole === 'Reviewer') return providerResponse(detective);
        return new Response(JSON.stringify({ error: { status: 'PERMISSION_DENIED', message: `Authorization: Bearer ${config.apiKey}; source: ${input.code}` } }), { status: 403 });
      }),
    });
    const response = await post(input, { headers: { 'Content-Type': 'application/json', 'X-Request-ID': config.apiKey, Authorization: `Bearer ${config.apiKey}` } });
    assert.equal(response.status, 502);
    const id = response.headers.get('x-request-id');
    assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    const body = await response.json();
    assert.deepEqual(body, { message: `Analysis could not be completed. Reference: ${id}` });
    assert.deepEqual(logs, [{ event: 'analysis_failed', correlationId: id, role: failingRole, upstreamStatus: 403, providerCode: 'PERMISSION_DENIED', category: 'authentication' }]);
    const serialized = JSON.stringify({ logs, body, headers: [...response.headers] });
    for (const forbidden of [config.apiKey, input.code, 'Bearer', 'Authorization']) assert.equal(serialized.includes(forbidden), false);
    assert.equal(calls, failingRole === 'Detective' ? 1 : 2);
  });
}

test('timeout diagnostics preserve role and known HTTP status', async t => {
  for (const role of ['Detective', 'Reviewer']) {
    for (const receivedHeaders of [false, true]) {
      const config = geminiConfig();
      const logs = [];
      let calls = 0;
      const fail = () => { throw new DOMException(config.apiKey, 'TimeoutError'); };
      const post = await serve(t, config, {
        logDiagnostic: record => logs.push(record),
        analyze: createAnalyzer(config, async () => {
          if (++calls === 1 && role === 'Reviewer') return providerResponse(detective);
          if (receivedHeaders) return { status: 200, ok: true, json: fail };
          return fail();
        }),
      });
      const response = await post();
      assert.equal(response.status, 504);
      assert.deepEqual(logs, [{ event: 'analysis_failed', correlationId: response.headers.get('x-request-id'), role, upstreamStatus: receivedHeaders ? 200 : null, providerCode: null, category: 'timeout' }]);
      assert.equal(JSON.stringify(logs).includes(config.apiKey), false);
    }
  }
});

test('HTTP failure categories and allowlisted provider codes are recorded without error bodies', async t => {
  for (const [status, code, category, clientStatus] of [
    [429, 'RESOURCE_EXHAUSTED', 'quota', 503],
    [401, 'UNAUTHENTICATED', 'authentication', 502],
    [404, 'NOT_FOUND', 'model', 502],
    [500, 'INTERNAL', 'provider', 502],
    [503, 'UNAVAILABLE', 'provider', 502],
    [400, 'INVALID_ARGUMENT', 'unknown', 502],
    [504, 'DEADLINE_EXCEEDED', 'timeout', 504],
  ]) {
    const config = geminiConfig();
    const logs = [];
    const post = await serve(t, config, {
      logDiagnostic: record => logs.push(record),
      analyze: createAnalyzer(config, async () => new Response(JSON.stringify({ error: { status: code, message: `${config.apiKey} ${input.code}`, details: [{ secret: config.apiKey }] } }), { status })),
    });
    const response = await post();
    assert.equal(response.status, clientStatus);
    assert.deepEqual(logs, [{ event: 'analysis_failed', correlationId: response.headers.get('x-request-id'), role: 'Detective', upstreamStatus: status, providerCode: code, category }]);
    const body = await response.json();
    assert.deepEqual(Object.keys(body), ['message']);
    assert.equal(body.message.includes(code), false);
    assert.equal(JSON.stringify(logs).includes(config.apiKey), false);
  }
});

test('untrusted provider codes, raw bodies and exception messages never reach logs', async t => {
  const config = geminiConfig();
  const unsafe = `${config.apiKey}\nAuthorization: Bearer other-secret\n${input.code}`;
  for (const failure of [
    () => new Response(JSON.stringify({ error: { status: unsafe, code: unsafe, message: unsafe } }), { status: 400 }),
    () => new Response(unsafe, { status: 500 }),
    () => { throw new Error(unsafe); },
  ]) {
    const logs = [];
    const post = await serve(t, config, { logDiagnostic: record => logs.push(record), analyze: createAnalyzer(config, failure) });
    const response = await post();
    assert.equal(response.status, 502);
    assert.equal(logs.length, 1);
    assert.equal(logs[0].providerCode, null);
    const output = JSON.stringify(logs) + await response.text();
    for (const forbidden of [config.apiKey, input.code, 'Authorization', 'other-secret']) assert.equal(output.includes(forbidden), false);
  }
});

test('invalid JSON, schema and fences produce invalid-response diagnostics', async t => {
  for (const provider of [
    () => new Response('not json'),
    () => providerResponse({ ...detective, fixedCode: null }),
    () => providerResponse({ ...detective, fixedCode: '```js\nunclosed' }),
  ]) {
    const logs = [];
    const config = geminiConfig();
    const post = await serve(t, config, { logDiagnostic: record => logs.push(record), analyze: createAnalyzer(config, provider) });
    assert.equal((await post()).status, 502);
    assert.equal(logs.length, 1);
    assert.equal(logs[0].role, 'Detective');
    assert.equal(logs[0].upstreamStatus, 200);
    assert.equal(logs[0].category, 'invalid response');
  }
});

test('concurrent requests have distinct correlated logs and a failing sink stays safe', async t => {
  const config = geminiConfig();
  const logs = [];
  const analyze = createAnalyzer(config, async () => new Response('{}', { status: 500 }));
  const post = await serve(t, config, { analyze, logDiagnostic: record => logs.push(record) });
  const responses = await Promise.all([post(), post()]);
  const ids = responses.map(response => response.headers.get('x-request-id'));
  assert.notEqual(ids[0], ids[1]);
  assert.deepEqual(new Set(logs.map(record => record.correlationId)), new Set(ids));
  const brokenPost = await serve(t, config, { analyze, logDiagnostic: () => { throw new Error(config.apiKey); } });
  const response = await brokenPost();
  assert.equal(response.status, 502);
  assert.equal((await response.text()).includes(config.apiKey), false);
});
