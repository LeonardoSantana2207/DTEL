'use client'

import { useEffect, useState, useMemo } from 'react'
import { RefreshCw, Search, MapPin, Radio, Zap, Cable } from 'lucide-react'
import AppShell from '@/components/layout/AppShell'
import type { Project } from '@/types'

interface CityKmz {
  meters: number
  fileName: string
  ctoCount: number
}

interface CityStats {
  name: string
  kmzData: CityKmz | null
  totalAreas: number
  doneAreas: number
  totalRoutes: number
  launchRoutes: number
  fusionRoutes: number
  projectedMeters: number
}

const NON_CITY = new Set([
  'SOLICITAÇÕES - MAPAS',
  'DWDM Recife <-> Fortaleza',
  'MAPA ANEL ABREU E LIMA -> PAULISTA',
  'ALAN KLEBSON',
])

export default function CidadesPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [kmzData, setKmzData] = useState<Record<string, CityKmz | null>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/projects?include=all')
      const data: Project[] = await res.json()
      setProjects(data)

      // Fetch KMZ totals per city
      const cities = Array.from(new Set(
        data
          .filter(p => p.trelloCardId && p.trelloListName && !NON_CITY.has(p.trelloListName ?? ''))
          .map(p => p.trelloListName!)
      ))
      if (cities.length > 0) {
        const qs = cities.map(encodeURIComponent).join(',')
        fetch(`/api/kmz/city-totals?cities=${qs}`)
          .then(r => r.ok ? r.json() : null)
          .then(d => { if (d) setKmzData(d) })
          .catch(() => {})
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const cities = useMemo<CityStats[]>(() => {
    const map = new Map<string, Project[]>()
    for (const p of projects) {
      if (!p.trelloCardId || !p.trelloListName) continue
      if (NON_CITY.has(p.trelloListName)) continue
      const c = map.get(p.trelloListName) ?? []
      c.push(p)
      map.set(p.trelloListName, c)
    }

    return Array.from(map.entries())
      .map(([name, projs]): CityStats => {
        const totalAreas = projs.reduce((s, p) => s + (p.trelloAreaData?.length ?? 0), 0)
        const doneAreas = projs.reduce((s, p) => s + (p.trelloAreaData?.filter(a => a.done).length ?? 0), 0)
        const projectMeters = projs.reduce((s, p) => s + (p.trelloAreaData?.reduce((sm, a) => sm + a.meters, 0) ?? 0), 0)
        const launchRoutes = projs.filter(p => /lan[çc]amento/i.test(p.name)).length
        const fusionRoutes = projs.filter(p => /fus[ãa]o/i.test(p.name)).length

        return {
          name,
          kmzData: kmzData[name] ?? null,
          totalAreas,
          doneAreas,
          totalRoutes: projs.length,
          launchRoutes,
          fusionRoutes,
          projectedMeters: projectMeters,
        }
      })
      .sort((a, b) => {
        // Sort by projected km descending (KMZ first, then project meters)
        const aKm = (a.kmzData?.meters ?? a.projectedMeters)
        const bKm = (b.kmzData?.meters ?? b.projectedMeters)
        return bKm - aKm
      })
  }, [projects, kmzData])

  const filtered = useMemo(() => {
    if (!search) return cities
    const q = search.toLowerCase()
    return cities.filter(c => c.name.toLowerCase().includes(q))
  }, [cities, search])

  const totalKm = cities.reduce((s, c) => s + (c.kmzData?.meters ?? c.projectedMeters), 0)
  const totalCtos = cities.reduce((s, c) => s + (c.kmzData?.ctoCount ?? 0), 0)

  return (
    <AppShell>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-[18px] font-bold text-[#0d2517]">Cidades</h2>
            {!loading && (
              <p className="text-[12px] text-[#6b8f74] mt-0.5">
                {cities.length} cidades · {(totalKm / 1000).toFixed(1)} km projetados · {totalCtos.toLocaleString('pt-BR')} CTOs
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b8f74]" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar cidade..."
                className="pl-9 pr-4 py-2 text-[13px] border border-[#d4e8dc] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#006734]/20 focus:border-[#006734] bg-white w-52"
              />
            </div>
            <button
              onClick={load}
              className="p-2 rounded-lg border border-[#d4e8dc] text-[#3a6347] hover:border-[#006734] hover:text-[#006734] transition-colors"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-[#e4eee8] border-t-[#006734] rounded-full animate-spin" />
              <span className="text-[12px] text-[#6b8f74]">Carregando cidades...</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(city => (
              <CityCard key={city.name} city={city} />
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full text-center py-12 text-[#bbb] text-[13px] italic">
                Nenhuma cidade encontrada
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  )
}

function CityCard({ city }: { city: CityStats }) {
  const km = city.kmzData?.meters ?? city.projectedMeters
  const ctos = city.kmzData?.ctoCount ?? 0
  const pct = city.totalAreas > 0 ? Math.round((city.doneAreas / city.totalAreas) * 100) : 0
  const isComplete = pct === 100 && city.totalAreas > 0

  return (
    <div className={`
      bg-white border rounded-xl p-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]
      hover:shadow-[0_4px_16px_rgba(0,0,0,0.10)] transition-all
      ${isComplete ? 'border-[#1a9e52]' : 'border-[#e4eee8]'}
    `}>
      {/* Name */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-1.5 min-w-0">
          <MapPin size={12} className={isComplete ? 'text-[#006734] flex-shrink-0' : 'text-[#6b8f74] flex-shrink-0'} />
          <h3 className={`text-[12px] font-bold uppercase tracking-wide leading-tight ${isComplete ? 'text-[#006734]' : 'text-[#0d2517]'}`}>
            {city.name}
          </h3>
        </div>
        {isComplete && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#f0faf4] text-[#006734] flex-shrink-0 ml-1">
            100%
          </span>
        )}
      </div>

      {/* KM projetados */}
      {km > 0 && (
        <div className="mb-3">
          <div className="text-[26px] font-bold text-[#0d2517] leading-none">
            {(km / 1000).toFixed(1)}
          </div>
          <div className="text-[10px] text-[#6b8f74] font-semibold uppercase tracking-wide mt-0.5">
            km projetados
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="flex items-center gap-3 text-[11px] text-[#6b8f74] mb-3 flex-wrap">
        {ctos > 0 && (
          <div className="flex items-center gap-1">
            <Radio size={10} className="text-[#8B5CF6]" />
            <span className="font-semibold text-[#0d2517]">{ctos.toLocaleString('pt-BR')}</span>
            <span>CTOs</span>
          </div>
        )}
        {city.totalAreas > 0 && (
          <div className="flex items-center gap-1">
            <Cable size={10} className="text-[#006734]" />
            <span className="font-semibold text-[#0d2517]">{city.totalAreas}</span>
            <span>áreas</span>
          </div>
        )}
      </div>

      {/* Progress */}
      {city.totalAreas > 0 && (
        <div>
          <div className="flex justify-between text-[10px] text-[#6b8f74] mb-1">
            <span>{city.doneAreas}/{city.totalAreas} concluídas</span>
            <span className={`font-bold ${isComplete ? 'text-[#006734]' : 'text-[#FEBF11]'}`}>{pct}%</span>
          </div>
          <div className="h-1.5 bg-[#e4eee8] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${pct}%`,
                background: isComplete
                  ? 'linear-gradient(90deg, #006734, #1a9e52)'
                  : 'linear-gradient(90deg, #006734 0%, #1a9e52 60%, #FEBF11 100%)',
              }}
            />
          </div>
        </div>
      )}

      {/* Route types */}
      {(city.launchRoutes > 0 || city.fusionRoutes > 0) && (
        <div className="flex gap-2 mt-3">
          {city.launchRoutes > 0 && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#f0faf4] text-[#006734]">
              {city.launchRoutes} Lanç.
            </span>
          )}
          {city.fusionRoutes > 0 && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#f5f3ff] text-[#7C3AED]">
              <Zap size={9} className="inline mr-0.5" />{city.fusionRoutes} Fusão
            </span>
          )}
        </div>
      )}
    </div>
  )
}
