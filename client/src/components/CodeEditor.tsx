import { lazy, Suspense } from 'react'
import type { Language } from '../types/analysis'

const MonacoSurface = lazy(() => import('./MonacoSurface'))

type CodeEditorProps = {
  code: string
  language: Language
  path: string
  ariaLabel: string
  readOnly?: boolean
  onChange?: (value: string) => void
}

export function CodeEditor({
  code,
  language,
  path,
  ariaLabel,
  readOnly = false,
  onChange,
}: CodeEditorProps) {
  return (
    <div className="h-full min-h-0" aria-label={ariaLabel}>
      <Suspense
        fallback={
          <div className="grid h-full min-h-48 place-items-center text-sm text-slate-400">
            Loading editor…
          </div>
        }
      >
        <MonacoSurface
          code={code}
          language={language}
          path={path}
          readOnly={readOnly}
          onChange={onChange}
        />
      </Suspense>
    </div>
  )
}
