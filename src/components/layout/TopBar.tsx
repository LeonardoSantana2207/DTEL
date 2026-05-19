'use client'

import { usePathname } from 'next/navigation'
import { Bell, RefreshCw, Search } from 'lucide-react'
import { useState } from 'react'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':     'Dashboard',
  '/kanban':        'Kanban de Projetos',
  '/producao':      'Produção de Cabo',
  '/fusao':         'Fusão',
  '/equipe':        'Equipe',
  '/relatorios':    'Relatórios',
  '/integracoes':   'Integrações',
  '/configuracoes': 'Configurações',
}

export default function TopBar() {
  const pathname = usePathname()
  const [syncing, setSyncing] = useState(false)
  const [search, setSearch] = useState('')

  const title = Object.entries(PAGE_TITLES).find(([p]) => pathname.startsWith(p))?.[1] ?? ''

  async function handleSync() {
    setSyncing(true)
    try {
      await fetch('/api/trello/sync', { method: 'POST' })
    } finally {
      setSyncing(false)
    }
  }

  return (
    <header
      className="
        flex items-center gap-4 px-6 py-3.5
        bg-white border-b border-[#d4e8dc]
        sticky top-0 z-30
      "
      style={{ boxShadow: '0 1px 6px rgba(0,103,52,0.06)' }}
    >
      {/* Page title */}
      <div className="flex-1">
        <h1 className="text-[15px] font-bold text-[#0d2517] tracking-tight">{title}</h1>
      </div>

      {/* Search bar */}
      <div className="relative hidden md:flex items-center">
        <Search size={14} className="absolute left-3 text-[#6b8f74]" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar projeto..."
          className="
            pl-9 pr-4 py-2 text-[13px]
            bg-[#f4f7f5] border border-[#d4e8dc] rounded-lg
            text-[#0d2517] placeholder:text-[#6b8f74]
            focus:outline-none focus:ring-2 focus:ring-[#006734]/20 focus:border-[#006734]
            w-52 transition-all
          "
        />
      </div>

      {/* Sync Trello button */}
      <button
        onClick={handleSync}
        disabled={syncing}
        className="
          flex items-center gap-2 px-3.5 py-2 rounded-lg text-[12px] font-semibold
          bg-[#006734] hover:bg-[#0a7a3e] text-[#FFDE00]
          transition-colors disabled:opacity-60
          border border-[#006734]
        "
      >
        <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
        {syncing ? 'Sincronizando...' : 'Sync Trello'}
      </button>

      {/* Notifications */}
      <button className="relative p-2 rounded-lg hover:bg-[#f0faf4] transition-colors">
        <Bell size={18} className="text-[#3a6347]" />
        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#FEBF11] rounded-full" />
      </button>
    </header>
  )
}
