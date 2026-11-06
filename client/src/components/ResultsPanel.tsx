import { CircleExclamationPoint, Search } from 'lucide-react'
import type { AnalysisStatus, AnalyzeResponse, Severity } from '../types/analysis'

const SEVERITY_STYLES: Record<Severity, string> = {
  critical: 'bg-rose-500/15 text-rose-200 ring-rose-400/40',
  high: 'bg-orange-500/15 text-orange-100 ring-orange-300/40',
  medium: 'bg-amber-400/15 text-amber-100 ring-amber-200/40',
  low: 'bg-[#2EE6C7]/12 text-[#b8fff2] ring-[#2EE6C7]/35',
  info: 'bg-[#8B7CFF]/15 text-[#ddd7ff] ring-[#8B7CFF]/40',
  unspecified: 'bg-slate-400/10 text-slate-200 ring-slate-300/30',
}

type ResultsPanelProps = {
  status: AnalysisStatus
  error: string | null
  result: AnalyzeResponse | null
}

function SeverityBadge({ severity }: { severity: Severity }) {
  const label = severity === 'unspecified' ? 'Unspecified' : severity
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ring-1 ${SEVERITY_STYLES[severity]}`}>
      {label}
    </span>
  )
}

function EmptyState() {
  return (
    <div className="flex min-h-64 flex-col items-start justify-center rounded-2xl border border-dashed border-white/15 bg-[#0c1222]/70 px-5 py-8">
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#2EE6C7]/10 text-[#2EE6C7]">
        <Search className="h-5 w-5" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-lg font-semibold text-white">No analysis yet</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">
        Run Analyze code to request a detective report. Severity, explanations, and suggested fixes appear here only after the API responds.
      </p>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="space-y-3" aria-hidden="true">
      <div className="h-16 animate-pulse rounded-2xl bg-white/5 motion-reduce:animate-none" />
      <div className="h-28 animate-pulse rounded-2xl bg-white/5 motion-reduce:animate-none" />
      <div className="h-28 animate-pulse rounded-2xl bg-white/5 motion-reduce:animate-none" />
    </div>
  )
}

export function ResultsPanel({ status, error, result }: ResultsPanelProps) {
  const bugs = result?.detective.bugs ?? []

  return (
    <section
      id="findings"
      aria-busy={status === 'loading'}
      className="scroll-mt-20 rounded-3xl border border-white/10 bg-[#111827] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-5"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B7CFF]">Detective</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight text-white">Analysis results</h2>
        {status === 'success' ? (
          <p className="text-sm text-slate-400">
            {bugs.length} {bugs.length === 1 ? 'finding' : 'findings'}
          </p>
        ) : null}
      </div>

      <div className="mt-4">
        {status === 'idle' ? <EmptyState /> : null}
        {status === 'loading' ? (
          <div role="status" className="space-y-3">
            <p className="text-sm text-slate-300">Waiting for POST /api/analyze…</p>
            <LoadingState />
          </div>
        ) : null}
        {status === 'error' ? (
          <div role="alert" className="flex gap-3 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-4 text-sm leading-6 text-rose-100">
            <CircleExclamationPoint className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-semibold text-white">Analysis could not be completed</p>
              <p className="mt-1">{error}</p>
            </div>
          </div>
        ) : null}
        {status === 'success' && result ? (
          <div className="space-y-3">
            <div className="rounded-2xl border border-white/10 bg-[#0c1222] px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Summary</p>
              <p className="mt-2 text-sm leading-6 text-slate-100">
                {result.detective.summary.trim() ? result.detective.summary : 'No summary was included.'}
              </p>
            </div>
            {bugs.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-white/15 px-4 py-6 text-sm text-slate-300">
                The detective report did not include any bugs.
              </p>
            ) : (
              <ol className="space-y-3">
                {bugs.map((bug, index) => (
                  <li key={`${bug.title ?? 'finding'}-${bug.line ?? index}-${index}`} className="rounded-2xl border border-white/10 bg-[#0c1222] p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <SeverityBadge severity={bug.severity} />
                      {bug.line !== undefined ? (
                        <span className="text-xs font-medium text-slate-400">Line {bug.line}</span>
                      ) : null}
                    </div>
                    <h3 className="mt-3 text-base font-semibold text-white">
                      {bug.title?.trim() ? bug.title : `Finding ${index + 1}`}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-300">{bug.explanation}</p>
                    <div className="mt-4 border-l-2 border-[#2EE6C7] pl-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2EE6C7]">
                        Suggested fix
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-100">
                        {bug.suggestedFix?.trim()
                          ? bug.suggestedFix
                          : 'No suggested fix was included.'}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        ) : null}
      </div>
    </section>
  )
}
