'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  KanbanSquare,
  Cable,
  Zap,
  CheckSquare,
  MapPin,
  Users,
  BarChart3,
  Settings,
  Link2,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/dashboard',      label: 'Dashboard',        icon: LayoutDashboard },
  { href: '/kanban',         label: 'Kanban',            icon: KanbanSquare },
  { href: '/cidades',        label: 'Cidades',           icon: MapPin },
  { href: '/producao',       label: 'Produção de Cabo',  icon: Cable },
  { href: '/fusao',          label: 'Fusão',             icon: Zap },
  { href: '/equipe',         label: 'Equipe',            icon: Users },
  { href: '/relatorios',     label: 'Relatórios',        icon: BarChart3 },
  { href: '/integracoes',    label: 'Integrações',       icon: Link2 },
  { href: '/configuracoes',  label: 'Configurações',     icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside
      className="
        flex flex-col w-[220px] min-h-screen flex-shrink-0
        bg-[#021408] text-white
        border-r border-[#0a3018]
      "
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-[#0a3018]">
        <Image
          src="/logo.png"
          alt="DTEL Telecom"
          width={44}
          height={44}
          className="object-contain drop-shadow-lg"
        />
        <div>
          <div className="text-[#FFDE00] font-bold text-[13px] leading-tight tracking-wider uppercase">
            DTEL
          </div>
          <div className="text-[#4d9965] text-[10px] tracking-wider uppercase leading-tight">
            Produção FTTH
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
        {NAV.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 group relative',
                active
                  ? 'bg-[#FFDE00]/10 text-[#FFDE00] border-r-[3px] border-[#FFDE00] rounded-r-none mr-[-8px] pr-[11px]'
                  : 'text-[#4d9965] hover:text-[#a8d5b0] hover:bg-[#0a2e14]'
              )}
            >
              <Icon size={17} strokeWidth={active ? 2.5 : 2} />
              <span>{item.label}</span>
              {active && (
                <ChevronRight size={13} className="ml-auto text-[#FFDE00]/60" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-[#0a3018]">
        <div className="text-[10px] text-[#4d9965] leading-tight">
          <div className="font-semibold text-[#6bc985] mb-0.5">DTEL Telecom</div>
          <div>Sistema de Produção FTTH</div>
        </div>
      </div>
    </aside>
  )
}
