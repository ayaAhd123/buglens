import { Check, Copy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { correctedSource, hasCorrectedSource } from '../api/analyze'
import type { AnalysisStatus, Language } from '../types/analysis'
import { CodeEditor } from './CodeEditor'

type CorrectedCodePanelProps = {
  status: AnalysisStatus
  language: Language | null
  fixedCode: string | null
}

async function writeClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value)
      return
    } catch {
      // Fall through to the selection copy path when the page cannot use the async clipboard.
    }
  }
  const area = document.createElement('textarea')
  area.value = value
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.left = '-9999px'
  document.body.appendChild(area)
  area.select()
  const copied = document.execCommand('copy')
  area.remove()
  if (!copied) {
    throw new Error('copy failed')
  }
}

function WaitingCopy({ status }: { status: AnalysisStatus }) {
  if (status === 'loading') {
    return (
      <div role="status" className="space-y-3">
        <p className="text-sm text-slate-300">Waiting for the corrected source from POST /api/analyze…</p>
        <div className="h-64 animate-pulse rounded-2xl bg-white/5 motion-reduce:animate-none" />
      </div>
    )
  }
  if (status === 'error') {
    return (
      <p className="text-sm leading-6 text-slate-400">
        Corrected code stays hidden until an analysis response arrives. The error is shown in Findings.
      </p>
    )
  }
  return (
    <p className="text-sm leading-6 text-slate-400">
      After analysis, the complete corrected source appears here, ready to copy. BugLens does not invent a fix locally.
    </p>
  )
}

export function CorrectedCodePanel({ status, language, fixedCode }: CorrectedCodePanelProps) {
  const source = fixedCode === null ? '' : correctedSource(fixedCode)
  const available = status === 'success' && hasCorrectedSource(fixedCode)
  const editorLanguage = language ?? 'javascript'
  const extension = editorLanguage === 'typescript' ? 'ts' : 'js'
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState<string | null>(null)

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timer)
  }, [copied])

  const copy = async () => {
    setCopyError(null)
    try {
      await writeClipboard(source)
      setCopied(true)
    } catch {
      setCopied(false)
      setCopyError('Could not copy the corrected code.')
    }
  }

  return (
    <section className="rounded-3xl border border-[#2EE6C7]/30 bg-[#111827] p-4 shadow-[0_24px_80px_rgba(46,230,199,0.08)] sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2EE6C7]">Ready to paste</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">Corrected code</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
            The complete corrected source from the analysis response. Review it before you use it. A generated fix is not guaranteed to be secure or to preserve every behavior.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void copy()
          }}
          disabled={!available}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2EE6C7] to-[#7d9bff] px-4 text-sm font-semibold text-[#06141a] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy code'}
        </button>
      </div>
      {copyError ? (
        <p role="alert" className="mt-3 text-sm text-rose-200">
          {copyError}
        </p>
      ) : null}

      <div className="mt-4">
        {!available && status !== 'success' ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-[#0c1222]/70 px-4 py-6">
            <WaitingCopy status={status} />
          </div>
        ) : null}
        {status === 'success' && !available ? (
          <div className="rounded-2xl border border-dashed border-amber-300/30 bg-amber-300/8 px-4 py-8">
            <p className="text-sm font-semibold text-white">No corrected code was generated</p>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
              The analysis response did not include a complete fix. Findings and reviewer notes above are still from that response.
            </p>
          </div>
        ) : null}
        {available ? (
          <div className="overflow-hidden rounded-2xl border border-[#2EE6C7]/25 bg-[#0c1222]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-xs text-slate-400">
              <span className="font-mono">corrected.{extension}</span>
              <span>{source.length} characters</span>
            </div>
            <div className="h-[min(62vh,560px)] min-h-80">
              <CodeEditor
                code={source}
                language={editorLanguage}
                path={`file:///buglens/corrected-full.${extension}`}
                ariaLabel="Complete corrected code"
                readOnly
              />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
