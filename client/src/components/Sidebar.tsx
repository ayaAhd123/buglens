import { Bug, CodeXml, GitCompare, Search, ShieldCheck, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type DashboardView = 'analyze' | 'findings' | 'review' | 'compare'

type NavItem = {
  id: DashboardView
  label: string
  description: string
  icon: LucideIcon
  target: string
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'analyze',
    label: 'Analyze',
    description: 'Editor and request',
    icon: CodeXml,
    target: 'editor',
  },
  {
    id: 'findings',
    label: 'Findings',
    description: 'Detective report',
    icon: Search,
    target: 'findings',
  },
  {
    id: 'review',
    label: 'AI Reviewer',
    description: 'Approval and concerns',
    icon: ShieldCheck,
    target: 'review',
  },
  {
    id: 'compare',
    label: 'Corrected',
    description: 'Copy the full fix',
    icon: GitCompare,
    target: 'corrected',
  },
]

type SidebarProps = {
  open: boolean
  activeView: DashboardView
  onNavigate: (view: DashboardView, target: string) => void
  onClose: () => void
}

export function Sidebar({ open, activeView, onNavigate, onClose }: SidebarProps) {
  return (
    <aside
      id="navigation"
      className={`fixed inset-y-0 left-0 z-40 flex w-72 shrink-0 flex-col overflow-y-auto border-r border-white/10 bg-[#0d1322] transition-transform duration-200 lg:sticky lg:top-0 lg:h-svh lg:translate-x-0 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="flex items-start justify-between gap-3 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-[#2EE6C7] to-[#8B7CFF] text-[#07131a] shadow-[0_8px_30px_rgba(139,124,255,0.35)]">
            <Bug className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#2EE6C7]">
              BugLens
            </p>
            <h1 className="text-lg font-semibold tracking-tight text-white">BugLens AI</h1>
          </div>
        </div>
        <button
          type="button"
          className="rounded-lg p-2 text-slate-300 lg:hidden"
          onClick={onClose}
          aria-label="Close navigation"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <p className="px-5 text-sm leading-6 text-slate-400">
        A debugging workspace for JavaScript and TypeScript. Findings come from the analysis API.
      </p>

      <nav className="mt-6 flex flex-1 flex-col gap-1 px-3" aria-label="Workspace">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const active = activeView === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id, item.target)}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
                active
                  ? 'bg-white/8 text-white shadow-[inset_0_0_0_1px_rgba(46,230,199,0.35)]'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span
                className={`grid h-9 w-9 place-items-center rounded-lg ${
                  active ? 'bg-[#2EE6C7]/15 text-[#2EE6C7]' : 'bg-white/5 text-slate-300'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-sm font-medium">{item.label}</span>
                <span className="block text-xs text-slate-400">{item.description}</span>
              </span>
            </button>
          )
        })}
      </nav>

      <div className="m-4 rounded-2xl border border-white/10 bg-[#111827] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8B7CFF]">
          Analysis service
        </p>
        <p className="mt-2 font-mono text-xs text-slate-300">POST /api/analyze</p>
        <p className="mt-2 text-xs leading-5 text-slate-400">
          The dashboard sends code and language. It does not invent detective or reviewer output.
        </p>
      </div>
    </aside>
  )
}
