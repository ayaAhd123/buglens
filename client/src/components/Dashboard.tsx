import { Menu } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AnalyzeError, analyzeCode } from '../api/analyze'
import { SAMPLE_SNIPPETS } from '../sampleSnippets'
import type { AnalysisStatus, AnalyzeResponse, Language } from '../types/analysis'
import { CodeComparison } from './CodeComparison'
import { CorrectedCodePanel } from './CorrectedCodePanel'
import { EditorPanel } from './EditorPanel'
import { ResultsPanel } from './ResultsPanel'
import { ReviewerCard } from './ReviewerCard'
import { Sidebar, type DashboardView } from './Sidebar'

function sectionVisibility(active: DashboardView, section: DashboardView) {
  return active === section ? 'block' : 'hidden lg:block'
}

export function Dashboard() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [view, setView] = useState<DashboardView>('analyze')
  const [language, setLanguage] = useState<Language>('javascript')
  const [code, setCode] = useState(SAMPLE_SNIPPETS.javascript)
  const [usingSample, setUsingSample] = useState(true)
  const [status, setStatus] = useState<AnalysisStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AnalyzeResponse | null>(null)
  const [submittedCode, setSubmittedCode] = useState<string | null>(null)
  const [submittedLanguage, setSubmittedLanguage] = useState<Language | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const clearRequest = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  useEffect(() => clearRequest, [clearRequest])

  const analyze = useCallback(async () => {
    if (!code.trim()) {
      clearRequest()
      setStatus('error')
      setError('Add some code before requesting an analysis.')
      setResult(null)
      setSubmittedCode(null)
      setSubmittedLanguage(null)
      setView('findings')
      return
    }

    clearRequest()
    const controller = new AbortController()
    abortRef.current = controller
    setStatus('loading')
    setError(null)
    setResult(null)
    setSubmittedCode(null)
    setSubmittedLanguage(null)
    setView('findings')

    try {
      const response = await analyzeCode({ code, language }, controller.signal)
      if (controller.signal.aborted) return
      setResult(response)
      setSubmittedCode(code)
      setSubmittedLanguage(language)
      setStatus('success')
    } catch (caught) {
      if (controller.signal.aborted || (caught instanceof DOMException && caught.name === 'AbortError')) {
        return
      }
      setStatus('error')
      setResult(null)
      setSubmittedCode(null)
      setSubmittedLanguage(null)
      setError(caught instanceof AnalyzeError ? caught.message : 'The analysis request failed.')
    }
  }, [clearRequest, code, language])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault()
        void analyze()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [analyze])

  const loadSample = useCallback(() => {
    clearRequest()
    setCode(SAMPLE_SNIPPETS[language])
    setUsingSample(true)
    setStatus('idle')
    setError(null)
    setResult(null)
    setSubmittedCode(null)
    setSubmittedLanguage(null)
    setView('analyze')
  }, [clearRequest, language])

  const navigate = (next: DashboardView, target: string) => {
    setView(next)
    setMenuOpen(false)
    requestAnimationFrame(() => {
      document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  return (
    <div className="min-h-svh bg-[#090D18] text-slate-200">
      {menuOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-[#02040a]/70 lg:hidden"
          aria-label="Close navigation overlay"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <div className="lg:flex">
        <Sidebar
          open={menuOpen}
          activeView={view}
          onNavigate={navigate}
          onClose={() => setMenuOpen(false)}
        />

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/10 bg-[#090D18]/90 px-4 py-3 backdrop-blur lg:hidden">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2EE6C7]">BugLens</p>
              <p className="text-sm font-medium text-white">Debugging workspace</p>
            </div>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-white"
              aria-expanded={menuOpen}
              aria-controls="navigation"
              onClick={() => setMenuOpen(true)}
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
              <span className="sr-only">Open navigation</span>
            </button>
          </header>

          <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6">
            <div className="hidden items-end justify-between gap-4 lg:flex">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8B7CFF]">Developer dashboard</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight text-white">Debug with a detective and a reviewer</p>
              </div>
              <p className="max-w-sm text-right text-sm leading-6 text-slate-400">
                Dark workspace for code review. Results stay empty until the analysis service answers.
              </p>
            </div>

            <div className={sectionVisibility(view, 'analyze')}>
              <EditorPanel
                code={code}
                language={language}
                loading={status === 'loading'}
                usingSample={usingSample}
                onCodeChange={(next) => {
                  if (next === code) return
                  setCode(next)
                  setUsingSample(false)
                }}
                onLanguageChange={setLanguage}
                onAnalyze={() => {
                  void analyze()
                }}
                onLoadSample={loadSample}
              />
            </div>

            <div className={`grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] ${view === 'analyze' ? 'hidden lg:grid' : ''}`}>
              <div className={`space-y-4 ${sectionVisibility(view, 'findings')}`}>
                <ResultsPanel status={status} error={error} result={result} />
              </div>
              <div className={sectionVisibility(view, 'review')}>
                <ReviewerCard status={status} reviewer={result?.reviewer ?? null} />
              </div>
            </div>

            <div id="corrected" className={`scroll-mt-20 space-y-4 ${sectionVisibility(view, 'compare')}`}>
              <CorrectedCodePanel
                status={status}
                language={submittedLanguage}
                fixedCode={result?.detective.fixedCode ?? null}
              />
              <CodeComparison
                status={status}
                language={submittedLanguage}
                originalCode={submittedCode}
                fixedCode={result?.detective.fixedCode ?? null}
              />
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
