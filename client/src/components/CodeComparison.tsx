import { lazy, Suspense } from 'react'
import { correctedSource, hasCorrectedSource } from '../api/analyze'
import type { AnalysisStatus, Language } from '../types/analysis'

const DiffSurface = lazy(() => import('./DiffSurface'))

type CodeComparisonProps = {
  status: AnalysisStatus
  language: Language | null
  originalCode: string | null
  fixedCode: string | null
}

export function CodeComparison({ status, language, originalCode, fixedCode }: CodeComparisonProps) {
  const editorLanguage = language ?? 'javascript'
  const modified = fixedCode === null ? '' : correctedSource(fixedCode)
  const ready =
    status === 'success' &&
    originalCode !== null &&
    language !== null &&
    hasCorrectedSource(fixedCode)

  return (
    <section id="comparison" className="scroll-mt-20 rounded-3xl border border-white/10 bg-[#111827] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B7CFF]">Before and after</p>
      <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">Original versus corrected</h2>
      <p className="mt-1 text-sm leading-6 text-slate-400">
        Before is the code you submitted. After is the corrected source from the response. On a narrow screen the changes stack inline.
      </p>

      {status === 'loading' ? (
        <div role="status" className="mt-4 h-72 animate-pulse rounded-2xl bg-white/5 motion-reduce:animate-none" />
      ) : null}

      {!ready && status !== 'loading' ? (
        <div className="mt-4 rounded-2xl border border-dashed border-white/15 bg-[#0c1222]/70 px-4 py-8 text-sm leading-6 text-slate-400">
          {status === 'success'
            ? 'A before/after diff appears when the response includes corrected code.'
            : status === 'error'
              ? 'The diff appears after a successful analysis. The current request did not return one.'
              : 'Submit code to compare the original snippet with the corrected source from the API.'}
        </div>
      ) : null}

      {ready ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-[#0c1222]">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            <span>Before</span>
            <span className="text-[#2EE6C7]">After</span>
          </div>
          <div className="h-[min(70vh,640px)] min-h-80">
            <Suspense
              fallback={
                <div className="grid h-full place-items-center text-sm text-slate-400">Loading diff…</div>
              }
            >
              <DiffSurface original={originalCode} modified={modified} language={editorLanguage} />
            </Suspense>
          </div>
        </div>
      ) : null}
    </section>
  )
}
