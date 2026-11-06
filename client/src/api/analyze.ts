import type { AnalyzeRequest, AnalyzeResponse, BugFinding, Severity } from '../types/analysis'

const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'] as const

export class AnalyzeError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'AnalyzeError'
    this.status = status
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isKnownSeverity(value: string): value is Exclude<Severity, 'unspecified'> {
  return SEVERITIES.some((severity) => severity === value)
}

function readSeverity(value: unknown): Severity {
  if (typeof value === 'string' && isKnownSeverity(value)) {
    return value
  }
  return 'unspecified'
}

function readOptionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]
  return typeof value === 'string' ? value : undefined
}

function readBug(value: unknown, index: number): BugFinding {
  if (!isRecord(value)) {
    throw new AnalyzeError(`Bug ${index + 1} must be an object.`)
  }
  const explanation = readOptionalString(value, 'explanation')
  if (explanation === undefined) {
    throw new AnalyzeError(`Bug ${index + 1} is missing an explanation.`)
  }
  const line = value.line
  return {
    severity: readSeverity(value.severity),
    title: readOptionalString(value, 'title'),
    explanation,
    suggestedFix: readOptionalString(value, 'suggestedFix'),
    line: typeof line === 'number' && Number.isFinite(line) ? line : undefined,
  }
}

/** Unwrap one surrounding markdown fence so copied code stays pasteable. */
export function correctedSource(fixedCode: string): string {
  const trimmed = fixedCode.trim()
  const fenced = /^```[a-zA-Z0-9]*\r?\n([\s\S]*?)\r?\n```$/.exec(trimmed)
  if (fenced?.[1] !== undefined) {
    return fenced[1]
  }
  return fixedCode.replace(/^\uFEFF/, '').replace(/\s+$/, '')
}

export function hasCorrectedSource(fixedCode: string | null | undefined): boolean {
  return typeof fixedCode === 'string' && correctedSource(fixedCode).trim().length > 0
}

export function parseAnalyzeResponse(payload: unknown): AnalyzeResponse {
  if (!isRecord(payload)) {
    throw new AnalyzeError('The analysis response was not a JSON object.')
  }

  const detective = payload.detective
  const reviewer = payload.reviewer
  if (!isRecord(detective) || !isRecord(reviewer)) {
    throw new AnalyzeError('The analysis response is missing detective or reviewer.')
  }
  if (typeof detective.summary !== 'string' || typeof detective.fixedCode !== 'string') {
    throw new AnalyzeError('The detective section must include summary and fixedCode strings.')
  }
  if (!Array.isArray(detective.bugs)) {
    throw new AnalyzeError('The detective section must include a bugs array.')
  }
  if (typeof reviewer.approved !== 'boolean' || typeof reviewer.feedback !== 'string') {
    throw new AnalyzeError('The reviewer section must include approved and feedback.')
  }
  if (!Array.isArray(reviewer.concerns)) {
    throw new AnalyzeError('The reviewer section must include a concerns array.')
  }

  const concerns = reviewer.concerns.map((item, index) => {
    if (typeof item !== 'string') {
      throw new AnalyzeError(`Reviewer concern ${index + 1} must be a string.`)
    }
    return item
  })

  return {
    detective: {
      summary: detective.summary,
      bugs: detective.bugs.map((bug, index) => readBug(bug, index)),
      fixedCode: detective.fixedCode,
    },
    reviewer: {
      approved: reviewer.approved,
      feedback: reviewer.feedback,
      concerns,
    },
  }
}

export async function analyzeCode(
  request: AnalyzeRequest,
  signal?: AbortSignal,
): Promise<AnalyzeResponse> {
  const configuredBase = import.meta.env.VITE_API_BASE?.replace(/\/$/, '') ?? ''
  let response: Response
  try {
    response = await fetch(`${configuredBase}/api/analyze`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: request.code,
        language: request.language,
      } satisfies AnalyzeRequest),
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    throw new AnalyzeError('Could not reach POST /api/analyze.')
  }

  if (!response.ok) {
    let detail = ''
    try {
      const body: unknown = await response.json()
      if (isRecord(body) && typeof body.message === 'string' && body.message.trim()) {
        detail = ` ${body.message.trim()}`
      }
    } catch {
      detail = ''
    }
    throw new AnalyzeError(
      `Analysis request failed with status ${response.status}.${detail} BugLens does not generate findings in the browser.`,
      response.status,
    )
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new AnalyzeError('The analysis service returned invalid JSON.')
  }

  return parseAnalyzeResponse(payload)
}
