import Editor from '@monaco-editor/react'
import '../monaco'
import type { Language } from '../types/analysis'

type MonacoSurfaceProps = {
  code: string
  language: Language
  path: string
  readOnly: boolean
  onChange?: (value: string) => void
}

export default function MonacoSurface({
  code,
  language,
  path,
  readOnly,
  onChange,
}: MonacoSurfaceProps) {
  return (
    <Editor
      path={path}
      language={language}
      theme="buglens"
      value={code}
      onChange={onChange ? (value) => onChange(value ?? '') : undefined}
      loading={
        <div className="grid h-full min-h-48 place-items-center text-sm text-slate-400">
          Loading editor…
        </div>
      }
      options={{
        readOnly,
        domReadOnly: readOnly,
        minimap: { enabled: false },
        fontSize: 13,
        fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
        fontLigatures: true,
        scrollBeyondLastLine: false,
        automaticLayout: true,
        padding: { top: 16, bottom: 16 },
        smoothScrolling: true,
        tabSize: 2,
        wordWrap: 'on',
        renderLineHighlight: readOnly ? 'none' : 'line',
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
        lineNumbersMinChars: 3,
      }}
    />
  )
}
