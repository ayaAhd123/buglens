export type Language = 'javascript' | 'typescript'

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info' | 'unspecified'

export type AnalysisStatus = 'idle' | 'loading' | 'success' | 'error'

export interface BugFinding {
  severity: Severity
  title?: string
  explanation: string
  suggestedFix?: string
  line?: number
}

export interface AnalyzeRequest {
  code: string
  language: Language
}

export interface DetectiveReport {
  summary: string
  bugs: BugFinding[]
  fixedCode: string
}

export interface ReviewerReport {
  approved: boolean
  feedback: string
  concerns: string[]
}

export interface AnalyzeResponse {
  detective: DetectiveReport
  reviewer: ReviewerReport
}
