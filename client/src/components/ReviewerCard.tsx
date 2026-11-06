import { ShieldCheck, ShieldX } from 'lucide-react'
import type { AnalysisStatus, ReviewerReport } from '../types/analysis'

type ReviewerCardProps = {
  status: AnalysisStatus
  reviewer: ReviewerReport | null
}

function WaitingCopy({ status }: { status: AnalysisStatus }) {
  if (status === 'loading') {
    return (
      <div role="status" className="space-y-3">
        <p className="text-sm text-slate-300">The reviewer response is still in flight.</p>
        <div className="h-24 animate-pulse rounded-2xl bg-white/5 motion-reduce:animate-none" />
      </div>
    )
  }
  if (status === 'error') {
    return (
      <p className="text-sm leading-6 text-slate-400">
        Reviewer notes stay empty until an analysis response arrives. The error is shown in Findings.
      </p>
    )
  }
  return (
    <p className="text-sm leading-6 text-slate-400">
      Approval, feedback, and concerns appear here only from the reviewer section of the API response.
    </p>
  )
}

export function ReviewerCard({ status, reviewer }: ReviewerCardProps) {
  const approved = reviewer?.approved === true

  return (
    <section id="review" className="scroll-mt-20 rounded-3xl border border-white/10 bg-[#111827] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2EE6C7]">Second pass</p>
      <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">AI Reviewer</h2>

      <div className="mt-4">
        {status !== 'success' || !reviewer ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-[#0c1222]/70 px-4 py-6">
            <WaitingCopy status={status} />
          </div>
        ) : (
          <div
            className={`rounded-2xl border px-4 py-4 ${
              approved ? 'border-[#2EE6C7]/35 bg-[#2EE6C7]/8' : 'border-amber-300/30 bg-amber-300/8'
            }`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`grid h-10 w-10 place-items-center rounded-xl ${
                  approved ? 'bg-[#2EE6C7]/15 text-[#2EE6C7]' : 'bg-amber-300/15 text-amber-100'
                }`}
              >
                {approved ? (
                  <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <ShieldX className="h-5 w-5" aria-hidden="true" />
                )}
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">Verdict</p>
                <p className="text-lg font-semibold text-white">{approved ? 'Approved' : 'Concerns raised'}</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-100">
              {reviewer.feedback.trim() ? reviewer.feedback : 'No feedback was included.'}
            </p>
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Concerns</p>
              {reviewer.concerns.length === 0 ? (
                <p className="mt-2 text-sm text-slate-300">No concerns were listed.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {reviewer.concerns.map((concern, index) => (
                    <li key={`${index}-${concern}`} className="rounded-xl bg-[#090D18]/70 px-3 py-2 text-sm leading-6 text-slate-100">
                      {concern}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
