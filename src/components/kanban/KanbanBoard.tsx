'use client'

import { useState, useEffect, useCallback } from 'react'
import { DragDropContext, type DropResult } from '@hello-pangea/dnd'
import { RefreshCw, Search, MapPin } from 'lucide-react'
import type { Project } from '@/types'
import KanbanColumn from './KanbanColumn'
import ProjectModal from '../project/ProjectModal'

interface CityKmzData {
  meters: number
  fileName: string
  ctoCount: number
}

interface CityColumn {
  id: string           // trelloListName
  label: string
  projects: Project[]
  projectMeters: number   // soma de cableMeters dos projetos (área matching)
  kmzData: CityKmzData | null  // total real do KMZ
}

// Listas do Trello que não são cidades de produção
const NON_CITY_LISTS = new Set([
  'SOLICITAÇÕES - MAPAS',
  'DWDM Recife <-> Fortaleza',
  'MAPA ANEL ABREU E LIMA -> PAULISTA',
  'ALAN KLEBSON',
])

export default function KanbanBoard() {
  const [projects, setProjects] = useState<Project[]>([])
  const [cityKmz, setCityKmz] = useState<Record<string, CityKmzData | null>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  const loadProjects = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/projects?include=all')
      if (!res.ok) throw new Error('Falha ao carregar projetos')
      const data: Project[] = await res.json()
      setProjects(data)

      // Busca totais KMZ por cidade (em background, sem bloquear o Kanban)
      const cities = Array.from(new Set(
        data.filter(p => p.trelloCardId && p.trelloListName && !NON_CITY_LISTS.has(p.trelloListName ?? ''))
            .map(p => p.trelloListName!)
      ))
      if (cities.length > 0) {
        const qs = cities.map(encodeURIComponent).join(',')
        fetch(`/api/kmz/city-totals?cities=${qs}`)
          .then(r => r.ok ? r.json() : null)
          .then(data => { if (data) setCityKmz(data) })
          .catch(() => { /* silently fail */ })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [refreshKey])

  useEffect(() => { loadProjects() }, [loadProjects])

  const filteredProjects = projects.filter(p => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (
        !p.name.toLowerCase().includes(q) &&
        !p.code?.toLowerCase().includes(q) &&
        !p.locality?.toLowerCase().includes(q)
      ) return false
    }
    return true
  })

  // Agrupa por cidade (trelloListName), excluindo listas não-produção
  const cityMap = new Map<string, Project[]>()
  for (const p of filteredProjects) {
    const city = p.trelloListName ?? p.locality ?? 'Sem cidade'
    if (NON_CITY_LISTS.has(city)) continue
    if (!p.trelloCardId) continue
    if (!cityMap.has(city)) cityMap.set(city, [])
    cityMap.get(city)!.push(p)
  }

  const columns: CityColumn[] = Array.from(cityMap.entries())
    .map(([city, projs]) => ({
      id: city,
      label: city,
      projects: projs.sort((a, b) => a.kanbanOrder - b.kanbanOrder),
      projectMeters: projs.reduce((s, p) => s + (p.cableMeters ?? 0), 0),
      kmzData: cityKmz[city] ?? null,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))

  async function onDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result
    if (!destination) return
    // Só reordena dentro da mesma cidade
    if (destination.droppableId !== source.droppableId) return
    if (destination.index === source.index) return

    setProjects(prev =>
      prev.map(p =>
        p.id === draggableId
          ? { ...p, kanbanOrder: destination.index }
          : p
      )
    )
    await fetch(`/api/projects/${draggableId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kanbanOrder: destination.index }),
    }).catch(() => loadProjects())
  }

  function handleModalClose() {
    setSelectedProject(null)
    setRefreshKey(k => k + 1)
  }

  function handleProjectUpdate(updated: Project) {
    setProjects(prev => prev.map(p => (p.id === updated.id ? updated : p)))
    setSelectedProject(updated)
  }

  const totalCities = columns.length
  const totalMeters = columns.reduce((s, c) => s + (c.kmzData?.meters ?? c.projectMeters), 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-8 h-8 border-2 border-[#e4eee8] border-t-[#006734] rounded-full"
            style={{ animation: 'spin 0.8s linear infinite' }}
          />
          <span className="text-sm text-[#6b8f74]">Carregando projetos...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-red-700 font-medium">{error}</p>
        <button
          onClick={() => setRefreshKey(k => k + 1)}
          className="mt-3 px-4 py-2 bg-[#006734] text-white rounded-lg text-sm"
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex items-center">
          <Search size={14} className="absolute left-3 text-[#6b8f74]" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar cidade ou rota..."
            className="
              pl-9 pr-4 py-2 text-[13px]
              bg-white border border-[#d4e8dc] rounded-lg
              text-[#0d2517] placeholder:text-[#6b8f74]
              focus:outline-none focus:ring-2 focus:ring-[#006734]/20 focus:border-[#006734]
              w-60
            "
          />
        </div>

        <div className="flex items-center gap-2 ml-auto text-[12px] text-[#6b8f74]">
          <MapPin size={12} className="text-[#006734]" />
          <span className="font-semibold text-[#0d2517]">{totalCities}</span>
          <span>cidades</span>
          {totalMeters > 0 && (
            <>
              <span className="text-[#d4e8dc]">·</span>
              <span className="font-semibold text-[#006734]">
                {(totalMeters / 1000).toFixed(1)} km
              </span>
              <span>total</span>
            </>
          )}
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            className="ml-2 p-2 rounded-lg hover:bg-[#f0faf4] text-[#3a6347] transition-colors"
            title="Recarregar"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Kanban board — colunas por cidade */}
      <div className="flex-1 overflow-x-auto kanban-scroll pb-4">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-3 min-h-[400px]" style={{ minWidth: 'max-content' }}>
            {columns.map(col => (
              <KanbanColumn
                key={col.id}
                column={col}
                onCardClick={setSelectedProject}
              />
            ))}
            {columns.length === 0 && (
              <div className="flex items-center justify-center w-full text-[#6b8f74] text-sm">
                Nenhuma cidade encontrada
              </div>
            )}
          </div>
        </DragDropContext>
      </div>

      {selectedProject !== null && (
        <ProjectModal
          project={selectedProject}
          onClose={handleModalClose}
          onUpdate={handleProjectUpdate}
        />
      )}
    </div>
  )
}
