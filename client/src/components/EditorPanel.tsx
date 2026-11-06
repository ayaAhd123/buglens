import { FileCode, LoaderCircle, Search } from 'lucide-react'
import type { Language } from '../types/analysis'
import { CodeEditor } from './CodeEditor'

type EditorPanelProps = {
  code: string
  language: Language
  loading: boolean
  usingSample: boolean
  onCodeChange: (code: string) => void
  onLanguageChange: (language: Language) => void
  onAnalyze: () => void
  onLoadSample: () => void
}

export function EditorPanel({
  code,
  language,
  loading,
  usingSample,
  onCodeChange,
  onLanguageChange,
  onAnalyze,
  onLoadSample,
}: EditorPanelProps) {
  const extension = language === 'typescript' ? 'ts' : 'js'

  return (
    <section id="editor" className="scroll-mt-20 rounded-3xl border border-white/10 bg-[#111827] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2EE6C7]">Workspace</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">Code editor</h2>
          <p className="mt-1 max-w-xl text-sm leading-6 text-slate-400">
            Write JavaScript or TypeScript, then send it for analysis. Ctrl+Enter runs the same request.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <label htmlFor="language" className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
            Language
          </label>
          <select
            id="language"
            value={language}
            onChange={(event) => onLanguageChange(event.target.value as Language)}
            className="h-11 rounded-xl border border-white/10 bg-[#0c1222] px-3 text-sm text-white"
          >
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
          </select>
        </div>
      </div>

      {usingSample ? (
        <p className="mt-4 rounded-2xl border border-[#8B7CFF]/30 bg-[#8B7CFF]/10 px-3 py-2 text-sm leading-6 text-[#e4e0ff]">
          <span className="mr-2 font-semibold uppercase tracking-[0.14em] text-[#b7adff]">Sample</span>
          This editor text is a local starter snippet. It is not an analysis result.
        </p>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-[#0c1222]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-xs text-slate-400">
          <span className="inline-flex items-center gap-2 font-mono">
            <FileCode className="h-3.5 w-3.5 text-[#2EE6C7]" aria-hidden="true" />
            snippet.{extension}
          </span>
          <span>{code.length} characters</span>
        </div>
        <div className="h-[min(62vh,640px)] min-h-80">
          <CodeEditor
            code={code}
            language={language}
            path={`file:///buglens/snippet.${extension}`}
            ariaLabel="Source code editor"
            onChange={onCodeChange}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-slate-500">
          Requests go to <span className="font-mono text-slate-300">POST /api/analyze</span> with code and language.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onLoadSample}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 px-4 text-sm font-medium text-slate-200 hover:bg-white/5"
          >
            Load sample snippet
          </button>
          <button
            type="button"
            onClick={onAnalyze}
            disabled={loading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2EE6C7] to-[#7d9bff] px-4 text-sm font-semibold text-[#06141a] shadow-[0_10px_30px_rgba(46,230,199,0.22)] disabled:cursor-wait disabled:opacity-70"
          >
            {loading ? (
              <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : (
              <Search className="h-4 w-4" aria-hidden="true" />
            )}
            {loading ? 'Analyzing' : 'Analyze code'}
          </button>
        </div>
      </div>
    </section>
  )
}
