import { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor/editor/editor.api'
import editorWorker from 'monaco-editor/editor/editor.worker?worker'
import tsWorker from 'monaco-editor/language/typescript/ts.worker?worker'
import 'monaco-editor/language/typescript/monaco.contribution'
import 'monaco-editor/languages/definitions/javascript/register'
import 'monaco-editor/languages/definitions/typescript/register'

type MonacoGlobal = typeof globalThis & {
  MonacoEnvironment?: {
    getWorker: (workerId: string, label: string) => Worker
  }
}

const monacoGlobal = globalThis as MonacoGlobal

monacoGlobal.MonacoEnvironment = {
  getWorker(_workerId, label) {
    if (label === 'typescript' || label === 'javascript') {
      return new tsWorker()
    }
    return new editorWorker()
  },
}

loader.config({ monaco })

monaco.editor.defineTheme('buglens', {
  base: 'vs-dark',
  inherit: true,
  rules: [{ token: 'comment', foreground: '8ea0bf', fontStyle: 'italic' }],
  colors: {
    'editor.background': '#0c1222',
    'editor.foreground': '#e8eefc',
    'editorLineNumber.foreground': '#66758f',
    'editorLineNumber.activeForeground': '#2EE6C7',
    'editor.selectionBackground': '#8B7CFF55',
    'editor.lineHighlightBackground': '#131c30',
    'editorCursor.foreground': '#2EE6C7',
    'editorWidget.background': '#111827',
    'editorWidget.border': '#243044',
  },
})
