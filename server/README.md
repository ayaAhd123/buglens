# BugLens analysis backend

Self-contained Node.js/Express service for BL-002. All backend files and dependencies live here. Requires Node.js 22.13+ (tests use Node's TypeScript stripping to check the existing frontend parser).

## Run without Gemini quota

From `server/`:

```powershell
npm ci
Copy-Item .env.example .env
npm start
```

The example selects `ANALYSIS_MODE=mock`. It returns explicitly labeled mock reports, no bugs, unchanged source, and `approved: false`; it does not perform real analysis or contact Google. Tests also make no Google requests. Run `npm test` from this directory. `npm run dev` enables Node watch mode.

## Enable Gemini

Set `ANALYSIS_MODE=gemini` and supply `GEMINI_API_KEY` in your process environment or ignored `server/.env`. Never put the key in frontend environment variables, source control, screenshots, or logs. An unset mode defaults to Gemini and requires a key; failures never silently fall back to mock mode. `GEMINI_MODEL` defaults to `gemini-2.5-flash` and can be changed to a model available to your account that supports structured output. `GEMINI_TIMEOUT_MS` is the per-role timeout (default 30000, maximum 120000); two sequential calls may take twice that time. Each successful real analysis makes two provider calls and may incur charges.

The Detective checks bugs, errors, and security, proposing complete corrected code. The Reviewer receives the original code plus the Detective report and checks quality, performance, maintainability, and regressions. Both outputs are checked against JSON schemas before being returned. Source and model responses are treated as data and never executed. Model reports still need human review.

Uses Google's [generateContent API](https://ai.google.dev/api/generate-content) and [structured JSON output](https://ai.google.dev/gemini-api/docs/structured-output). Credentials are sent only in the `x-goog-api-key` header; upstream error bodies and stack traces are never returned or logged.

## Frontend contract

Matches `client/src/types/analysis.ts` and `client/src/api/analyze.ts`, inspected read-only. The API listens on `http://127.0.0.1:3001` by default (`HOST` and `PORT` configure the listener). Cursor must set the client's `VITE_API_BASE=http://localhost:3001`, or configure its development proxy; the existing frontend uses a relative URL when that variable is absent. Restart Vite after changing its environment.

`POST /api/analyze`, `Content-Type: application/json`:

```json
{ "code": "const total: number = 1;", "language": "typescript" }
```

Only `javascript` and `typescript` are accepted. Code must contain non-whitespace text and be at most 50000 characters. Extra request fields are rejected; JSON bodies are limited to 256 KiB. Success is exactly:

```json
{
  "detective": {
    "summary": "Explanation of findings",
    "bugs": [
      {
        "severity": "low",
        "title": "Optional title",
        "explanation": "Required explanation",
        "suggestedFix": "Optional fix",
        "line": 1
      }
    ],
    "fixedCode": "Complete proposed source"
  },
  "reviewer": {
    "approved": false,
    "feedback": "Review explanation",
    "concerns": ["Actionable concern"]
  }
}
```

Bug severity is `critical`, `high`, `medium`, `low`, `info`, or `unspecified`. `title`, `suggestedFix`, and positive 1-based integer `line` are optional; `severity` and `explanation` are required. Arrays may be empty. The example above illustrates the format, not an actual analysis.

`detective.fixedCode` contains the entire corrected source when a fix is generated, preserving intended behavior and unchanged code. The prompt forbids partial snippets, diffs, placeholders, unrelated changes, and Markdown fences. A single whole-source backtick/tilde fence is removed before review and delivery; remaining or malformed fence lines cause a safe 502 error. Raw source is otherwise preserved. An empty or whitespace-only fix becomes `""` (fix unavailable), and the Reviewer still returns feedback and concerns. An omitted, null, or non-string field is an invalid provider response and causes 502. The service never substitutes the original source for an unavailable fix. Prompt instructions and shape validation cannot guarantee semantic completeness or security; human review remains necessary.

Errors use `{ "message": "Safe explanation" }`: 400 invalid input/JSON, 403 denied origin, 404 unknown endpoint, 413 oversized body, 415 unsupported content type/encoding, 500 unexpected internal error, 502 provider failure/invalid output, 503 provider quota or rate limit, 504 provider timeout.

## Configuration and deployment

`CORS_ORIGINS` is a comma-separated exact origin allowlist, defaulting to `http://localhost:5173,http://127.0.0.1:5173`. Wildcards are rejected. Requests with no Origin (CLI or same-origin service requests) are allowed. Responses disable caching. The service logs startup status and sanitized failure metadata, never request bodies, raw provider responses, headers, or secrets. `.gitignore` excludes `.env` variants, logs, and dependencies; only the blank `.env.example` belongs in Git.

The default listener is local-only. Before exposing it publicly, supply authentication, rate limits, concurrency limits, TLS, and request limits at an API gateway. CORS is browser policy, not authentication. Submitted source is sent to Google in Gemini mode; do not submit credentials or private code without appropriate authorization. A canceled browser request can still finish its in-flight provider work until the per-role timeout; no automatic retries are made.

## Safe failure diagnostics

Analysis failures produce one JSON record on server stderr with `event: "analysis_failed"`, `correlationId`, `role` (`Detective`, `Reviewer`, or null if unknown), `upstreamStatus` (or null before HTTP headers arrive), `providerCode` (an allowlisted Google status such as `PERMISSION_DENIED`, or null), and `category`. Logs omit provider messages, raw responses, stack traces, source code, request headers, and keys. Unknown provider code strings are discarded rather than partially redacted. Capture stderr in your deployment's log collector to retain these records; the service does not create log files.

The response shape remains `{ "message": "..." }`. Analysis failures use the generic message `Analysis could not be completed. Reference: <ID>`. The same server-generated UUID appears in `X-Request-ID` (exposed through CORS) and the server log. Caller-provided IDs are ignored. Successful Detective/Reviewer JSON is unchanged. Input validation errors keep their existing safe messages and also receive the ID header.

Categories are diagnostic hints: 401/403 or authentication codes map to `authentication`; 429/`RESOURCE_EXHAUSTED` to `quota`; abort/deadline errors to `timeout`; 404/`NOT_FOUND` to `model`; other 5xx to `provider`; malformed successful JSON, schema violations, and invalid fences to `invalid response`. Ambiguous errors, including 400/`INVALID_ARGUMENT`, map to `unknown` while retaining safe status/code metadata. A `model` category indicates a model/endpoint lookup failure, not proof of retirement. Failure logs alone do not establish the historical 502's cause.

To investigate, match the frontend reference ID to the server record and inspect role, upstream status, provider code, and category. Do not enable raw HTTP debugging or log environment variables. A failed log sink does not change the safe client error, but may lose the diagnostic record.

## Verification

`npm test` covers both languages, actual frontend parser compatibility, input limits, malformed JSON, CORS/preflight, two-role request construction, invalid provider schemas, timeout/quota/auth/network failures, and suppression of credential echoes. Diagnostics tests cover both failing roles, correlation IDs under concurrent requests, category mapping, secret/header/source omission, malformed provider errors, and a failing log sink. Provider tests stub `fetch`; no real API key or quota is needed. Live Gemini access and deployment authentication are not tested by this suite.
