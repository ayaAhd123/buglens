import { DiffEditor } from '@monaco-editor/react'
import { useEffect, useState } from 'react'
import '../monaco'
import type { Language } from '../types/analysis'

type DiffSurfaceProps = {
  original: string
  modified: string
  language: Language
}

export default function DiffSurface({ original, modified, language }: DiffSurfaceProps) {
  const [inline, setInline] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(max-width: 1023px)')
    const apply = () => setInline(query.matches)
    apply()
    query.addEventListener('change', apply)
    return () => query.removeEventListener('change', apply)
  }, [])

  return (
    <DiffEditor
      original={original}
      modified={modified}
      language={language}
      originalModelPath="file:///buglens/before.js"
      modifiedModelPath="file:///buglens/after.js"
      theme="buglens"
      loading={
        <div className="grid h-full min-h-48 place-items-center text-sm text-slate-400">
          Loading diff…
        </div>
      }
      options={{
        readOnly: true,
        renderSideBySide: !inline,
        minimap: { enabled: false },
        fontSize: 13,
        fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
        fontLigatures: true,
        wordWrap: 'on',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        renderOverviewRuler: false,
        padding: { top: 12 },
        scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
      }}
    />
  )
}
