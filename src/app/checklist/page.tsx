'use client'

import { useEffect, useState, useMemo } from 'react'
import { ChevronDown, ChevronRight, CheckCircle2, Clock, Download, RefreshCw, Search } from 'lucide-react'
import AppShell from '@/components/layout/AppShell'
import type { Project, TrelloAreaItem } from '@/types'

// ─── Types ───────────────────────────────────────────────────────────────────

interface RouteData {
  project: Project
  type: 'LAUNCH' | 'FUSION' | 'BACKBONE' | 'OTHER'
  typeLabel: string
  areaItems: TrelloAreaItem[]
  doneAreas: number
  totalAreas: number
  executedMeters: number
  totalMeters: number
}

interface CityData {
  name: string
  routes: RouteData[]
  doneAreas: number
  totalAreas: number
  executedKm: number
  projectedKm: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const NON_CITY = new Set([
  'SOLICITAÇÕES - MAPAS',
  'DWDM Recife <-> Fortaleza',
  'MAPA ANEL ABREU E LIMA -> PAULISTA',
  'ALAN KLEBSON',
])

function detectRouteType(name: string): RouteData['type'] {
  const n = name.toLowerCase()
  if (/backbone/i.test(n)) return 'BACKBONE'
  if (/lan[çc]amento/i.test(n)) return 'LAUNCH'
  if (/fus[ãa]o/i.test(n)) return 'FUSION'
  return 'OTHER'
}

const TYPE_LABELS: Record<RouteData['type'], string> = {
  LAUNCH: 'Lançamento',
  FUSION: 'Fusão',
  BACKBONE: 'Backbone',
  OTHER: 'Outro',
}

const TYPE_COLORS: Record<RouteData['type'], { bg: string; text: string; border: string }> = {
  LAUNCH:   { bg: '#f0faf4', text: '#006734', border: '#006734' },
  FUSION:   { bg: '#f5f3ff', text: '#7C3AED', border: '#7C3AED' },
  BACKBONE: { bg: '#eff6ff', text: '#1D4ED8', border: '#1D4ED8' },
  OTHER:    { bg: '#f9fafb', text: '#6b7280', border: '#9ca3af' },
}

function pct(done: number, total: number): number {
  if (total === 0) return 0
  return Math.round((done / total) * 100)
}

function fmtKm(m: number): string {
  if (m === 0) return '0 km'
  return (m / 1000).toFixed(2) + ' km'
}

function fmtMeters(m: number): string {
  if (m === 0) return '—'
  if (m >= 1000) return (m / 1000).toFixed(2) + ' km'
  return Math.round(m) + ' m'
}

// ─── Export CSV ──────────────────────────────────────────────────────────────

function exportCSV(cities: CityData[]) {
  const rows: string[][] = [['CIDADE', 'ROTA', 'TIPO', 'ÁREA', 'EQUIPE', 'METRAGEM', 'DATA', 'CONCLUÍDO']]
  for (const city of cities) {
    for (const route of city.routes) {
      for (const area of route.areaItems) {
        rows.push([
          city.name,
          route.project.name,
          route.typeLabel,
          area.code,
          area.members.join(' + ') || area.team || '',
          area.meters > 0 ? fmtMeters(area.meters) : '',
          area.date || '',
          area.done ? 'Sim' : 'Não',
        ])
      }
    }
  }
  const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `checklist-producao-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Area Table ───────────────────────────────────────────────────────────────

function AreaTable({ areas }: { areas: TrelloAreaItem[] }) {
  if (areas.length === 0) {
    return (
      <div className="py-6 text-center text-[12px] text-[#bbb] italic">
        Sem áreas — sincronize do Trello
      </div>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="bg-[#021408] text-[#FFDE00]">
            <th className="w-8 px-3 py-2 text-left font-bold text-[10px] uppercase tracking-wide">✓</th>
            <th className="px-3 py-2 text-left font-bold text-[10px] uppercase tracking-wide">Área</th>
            <th className="px-3 py-2 text-left font-bold text-[10px] uppercase tracking-wide">Equipe</th>
            <th className="px-3 py-2 text-left font-bold text-[10px] uppercase tracking-wide">Data</th>
            <th className="px-3 py-2 text-right font-bold text-[10px] uppercase tracking-wide">Metros</th>
          </tr>
        </thead>
        <tbody>
          {areas.map((a, i) => (
            <tr
              key={i}
              className={`border-b border-[#f0f4f2] last:border-0 ${a.done ? 'bg-[#f9fdfb]' : 'bg-white'} hover:bg-[#f5fbf7]`}
            >
              <td className="px-3 py-2.5">
                {a.done
                  ? <CheckCircle2 size={14} className="text-[#006734]" />
                  : <Clock size={14} className="text-[#FEBF11]" />
                }
              </td>
              <td className="px-3 py-2.5">
                <span className="font-bold font-mono text-[#0d2517] bg-[#edf5ef] px-1.5 py-0.5 rounded text-[11px]">
                  {a.code}
                </span>
              </td>
              <td className="px-3 py-2.5">
                <span className={`font-medium ${a.done ? 'line-through text-[#6b8f74]' : 'text-[#0d2517]'}`}>
                  {a.members.join(' + ') || a.team || '—'}
                </span>
              </td>
              <td className="px-3 py-2.5 text-[#6b8f74]">{a.date || '—'}</td>
              <td className="px-3 py-2.5 text-right font-bold text-[#006734]">
                {a.meters > 0 ? fmtMeters(a.meters) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Route Card ───────────────────────────────────────────────────────────────

function RouteCard({ route }: { route: RouteData }) {
  const [open, setOpen] = useState(false)
  const color = TYPE_COLORS[route.type]
  const p = pct(route.doneAreas, route.totalAreas)

  return (
    <div className="border border-[#e4eee8] rounded-xl overflow-hidden mb-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-[#f9fdfb] transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide flex-shrink-0"
            style={{ backgroundColor: color.bg, color: color.text, border: `1px solid ${color.border}30` }}
          >
            {route.typeLabel}
          </span>
          <span className="text-[12px] font-semibold text-[#0d2517] truncate text-left">
            {route.project.name}
          </span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-3">
          <span className="text-[11px] font-bold" style={{ color: p === 100 ? '#006734' : '#FEBF11' }}>
            {route.doneAreas}/{route.totalAreas} · {p}%
          </span>
          {open ? <ChevronDown size={14} className="text-[#6b8f74]" /> : <ChevronRight size={14} className="text-[#6b8f74]" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-[#f0f4f2]">
          <AreaTable areas={route.areaItems} />
        </div>
      )}
    </div>
  )
}

// ─── City Card ───────────────────────────────────────────────────────────────

function CityCard({ city }: { city: CityData }) {
  const [open, setOpen] = useState(false)
  const p = pct(city.doneAreas, city.totalAreas)
  const isComplete = p === 100 && city.totalAreas > 0

  return (
    <div className="bg-white border border-[#e4eee8] rounded-xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.05)]">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-5 py-4 hover:bg-[#f9fdfb] transition-colors"
      >
        <div className="flex items-center justify-between mb-2">
          <span className={`text-[13px] font-bold uppercase tracking-wide ${isComplete ? 'text-[#006734]' : 'text-[#0d2517]'}`}>
            {city.name}
          </span>
          <div className="flex items-center gap-3">
            <span className={`text-[12px] font-bold ${isComplete ? 'text-[#006734]' : 'text-[#FEBF11]'}`}>
              {city.doneAreas}/{city.totalAreas} · {p}%
            </span>
            {open ? <ChevronDown size={15} className="text-[#6b8f74]" /> : <ChevronDown size={15} className="text-[#6b8f74] -rotate-90" />}
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-[#e4eee8] rounded-full overflow-hidden mb-2">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${p}%`,
              background: isComplete
                ? 'linear-gradient(90deg, #006734, #1a9e52)'
                : 'linear-gradient(90deg, #006734 0%, #1a9e52 60%, #FEBF11 100%)',
            }}
          />
        </div>

        {city.executedKm > 0 && (
          <div className="text-[11px] text-[#6b8f74] text-left flex items-center gap-1">
            <span className="text-[#1a9e52]">🔌</span>
            <span className="font-semibold text-[#006734]">{fmtKm(city.executedKm)}</span>
            <span>executados</span>
            {city.projectedKm > 0 && (
              <span>/ <span className="font-semibold">{fmtKm(city.projectedKm)}</span> projetados</span>
            )}
          </div>
        )}
      </button>

      {/* Routes */}
      {open && (
        <div className="border-t border-[#f0f4f2] px-4 py-4">
          {city.routes.length === 0 ? (
            <div className="text-center py-4 text-[12px] text-[#bbb] italic">
              Sem rotas vinculadas
            </div>
          ) : (
            city.routes.map((r, i) => <RouteCard key={i} route={r} />)
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ChecklistPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  async function load() {
    setLoading(true)
    try {
      const r = await fetch('/api/projects?include=all')
      setProjects(await r.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const cities = useMemo<CityData[]>(() => {
    const map = new Map<string, Project[]>()
    for (const p of projects) {
      if (!p.trelloCardId || !p.trelloListName) continue
      if (NON_CITY.has(p.trelloListName)) continue
      const c = map.get(p.trelloListName) ?? []
      c.push(p)
      map.set(p.trelloListName, c)
    }

    return Array.from(map.entries())
      .map(([name, projs]): CityData => {
        const routes: RouteData[] = projs.map(p => {
          const areaItems = p.trelloAreaData ?? []
          const doneAreas = areaItems.filter(a => a.done).length
          const totalAreas = areaItems.length
          const executedMeters = areaItems.filter(a => a.done).reduce((s, a) => s + a.meters, 0)
          const totalMeters = areaItems.reduce((s, a) => s + a.meters, 0)
          const type = detectRouteType(p.name)
          return {
            project: p,
            type,
            typeLabel: TYPE_LABELS[type],
            areaItems,
            doneAreas,
            totalAreas,
            executedMeters,
            totalMeters,
          }
        }).sort((a, b) => a.project.name.localeCompare(b.project.name, 'pt-BR'))

        const doneAreas = routes.reduce((s, r) => s + r.doneAreas, 0)
        const totalAreas = routes.reduce((s, r) => s + r.totalAreas, 0)
        const executedKm = routes.reduce((s, r) => s + r.executedMeters, 0)
        const projectedKm = routes.reduce((s, r) => s + r.totalMeters, 0)

        return { name, routes, doneAreas, totalAreas, executedKm, projectedKm }
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }, [projects])

  const filtered = useMemo(() => {
    if (!search) return cities
    const q = search.toLowerCase()
    return cities.filter(c => c.name.toLowerCase().includes(q))
  }, [cities, search])

  // Global stats
  const totalAreas = cities.reduce((s, c) => s + c.totalAreas, 0)
  const doneAreas = cities.reduce((s, c) => s + c.doneAreas, 0)
  const totalExecutedKm = cities.reduce((s, c) => s + c.executedKm, 0)

  return (
    <AppShell>
      <div className="space-y-5 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-[18px] font-bold text-[#0d2517]">Checklist de Produção</h2>
            {!loading && (
              <p className="text-[12px] text-[#6b8f74] mt-0.5">
                {doneAreas}/{totalAreas} áreas concluídas · {fmtKm(totalExecutedKm)} executados
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="p-2 rounded-lg border border-[#d4e8dc] text-[#3a6347] hover:border-[#006734] hover:text-[#006734] transition-colors"
              title="Recarregar"
            >
              <RefreshCw size={14} />
            </button>
            <button
              onClick={() => exportCSV(cities)}
              disabled={cities.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-[#FFDE00] text-[#021408] rounded-lg text-[13px] font-bold hover:bg-[#FFD000] transition-colors disabled:opacity-50"
            >
              <Download size={14} />
              Exportar Excel
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b8f74]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar cidade..."
            className="w-full pl-9 pr-4 py-2 text-[13px] border border-[#d4e8dc] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#006734]/20 focus:border-[#006734] bg-white"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-[#e4eee8] border-t-[#006734] rounded-full animate-spin" />
              <span className="text-[12px] text-[#6b8f74]">Carregando checklist...</span>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-[#bbb] text-[13px] italic">
            {search ? 'Nenhuma cidade encontrada' : 'Sem dados — sincronize com o Trello'}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(city => <CityCard key={city.name} city={city} />)}
          </div>
        )}
      </div>
    </AppShell>
  )
}
