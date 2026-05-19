'use client'

import { useState } from 'react'
import { Draggable } from '@hello-pangea/dnd'
import { Ruler, Radio, ExternalLink, CheckSquare, CheckCircle2, Clock, ChevronDown, ChevronRight } from 'lucide-react'
import type { Project, ProjectStatus, TrelloAreaItem } from '@/types'
import { formatMeters } from '@/lib/utils'

interface Props {
  project: Project
  index: number
  cityName: string
  onClick: (project: Project) => void
}

const STATUS_BADGE: Record<ProjectStatus, { label: string; color: string; bg: string }> = {
  'TODO':         { label: 'Pendente',   color: '#64748B', bg: '#F1F5F9' },
  'IN_PROJECT':   { label: 'Em Projeto', color: '#1D4ED8', bg: '#DBEAFE' },
  'PROJECT_DONE': { label: 'Proj. OK',   color: '#0E7490', bg: '#CFFAFE' },
  'IN_LAUNCH':    { label: 'Lançando',   color: '#B45309', bg: '#FEF3C7' },
  'LAUNCH_DONE':  { label: 'Lançado',    color: '#C2410C', bg: '#FFEDD5' },
  'IN_FUSION':    { label: 'Em Fusão',   color: '#6D28D9', bg: '#EDE9FE' },
  'FUSION_DONE':  { label: 'Fusão OK',   color: '#065F46', bg: '#D1FAE5' },
  'FINISHED':     { label: 'Concluído',  color: '#006734', bg: '#DCFCE7' },
}

const STATUS_TOP_COLOR: Record<ProjectStatus, string> = {
  'TODO':         '#94A3B8',
  'IN_PROJECT':   '#3B82F6',
  'PROJECT_DONE': '#06B6D4',
  'IN_LAUNCH':    '#F59E0B',
  'LAUNCH_DONE':  '#F97316',
  'IN_FUSION':    '#8B5CF6',
  'FUSION_DONE':  '#10B981',
  'FINISHED':     '#006734',
}

function getRouteLabel(name: string, cityName: string): string {
  const escaped = cityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return name
    .replace(new RegExp(`^${escaped}\\s*[-–]\\s*`, 'i'), '')
    .replace(/^rede\s+ftth\s+/i, '')
    .trim()
}

function getTypeBadge(name: string): { label: string; color: string; bg: string } | null {
  const n = name.toLowerCase()
  if (/lan[çc]amento/.test(n)) return { label: 'Lançamento', color: '#065F46', bg: '#D1FAE5' }
  if (/fus[ãa]o/.test(n))     return { label: 'Fusão',       color: '#4C1D95', bg: '#EDE9FE' }
  return null
}

function AreaChecklist({ areas }: { areas: TrelloAreaItem[] }) {
  const done = areas.filter(a => a.done).length
  const total = areas.length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const isComplete = pct === 100 && total > 0
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className="mt-2 pt-2 border-t border-[#f0faf4]"
      onClick={e => e.stopPropagation()}
    >
      {/* Checklist header — toggle row */}
      <button
        onClick={() => setExpanded(o => !o)}
        className="w-full flex items-center gap-1.5 hover:bg-[#f5fbf7] rounded px-0.5 py-0.5 transition-colors"
      >
        <CheckSquare size={10} className={isComplete ? 'text-[#006734]' : 'text-[#6b8f74]'} />
        <span className={`text-[10px] font-bold ${isComplete ? 'text-[#006734]' : 'text-[#6b8f74]'}`}>
          {done}/{total}
        </span>
        {/* Mini progress bar */}
        <div className="flex-1 h-1.5 bg-[#e4eee8] rounded-full overflow-hidden mx-1">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              background: isComplete
                ? 'linear-gradient(90deg, #006734, #1a9e52)'
                : 'linear-gradient(90deg, #006734 0%, #1a9e52 60%, #FEBF11 100%)',
            }}
          />
        </div>
        <span className={`text-[10px] font-bold ${isComplete ? 'text-[#006734]' : 'text-[#FEBF11]'}`}>
          {pct}%
        </span>
        {expanded
          ? <ChevronDown size={9} className="text-[#6b8f74] ml-0.5" />
          : <ChevronRight size={9} className="text-[#6b8f74] ml-0.5" />
        }
      </button>

      {/* Expanded area list */}
      {expanded && (
        <div className="mt-1.5 space-y-0.5">
          {areas.map((a, i) => (
            <div
              key={i}
              className={`flex items-center gap-1.5 px-1 py-1 rounded text-[10px] ${a.done ? 'bg-[#f0faf4]' : 'bg-[#fffdf5]'}`}
            >
              {a.done
                ? <CheckCircle2 size={10} className="text-[#006734] flex-shrink-0" />
                : <Clock size={10} className="text-[#FEBF11] flex-shrink-0" />
              }
              <span className={`font-bold font-mono text-[9px] px-1 py-0.5 rounded ${a.done ? 'bg-[#d4f0de] text-[#006734]' : 'bg-[#edf5ef] text-[#0d2517]'}`}>
                {a.code}
              </span>
              <span className={`flex-1 truncate ${a.done ? 'line-through text-[#6b8f74]' : 'text-[#0d2517] font-medium'}`}>
                {a.members.join(' + ') || a.team || '—'}
              </span>
              {a.meters > 0 && (
                <span className="text-[9px] font-semibold text-[#006734] flex-shrink-0">
                  {a.meters >= 1000 ? (a.meters / 1000).toFixed(1) + 'km' : Math.round(a.meters) + 'm'}
                </span>
              )}
              {a.date && (
                <span className="text-[9px] text-[#6b8f74] flex-shrink-0">{a.date}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ProjectCard({ project, index, cityName, onClick }: Props) {
  const statusBadge = STATUS_BADGE[project.status] ?? STATUS_BADGE['TODO']
  const topColor = STATUS_TOP_COLOR[project.status] ?? '#94A3B8'
  const routeLabel = getRouteLabel(project.name, cityName)
  const typeBadge = getTypeBadge(project.name)
  const launchers = (project.collaborators ?? []).filter(c => c.role === 'LAUNCHER')
  const areaItems: TrelloAreaItem[] = project.trelloAreaData ?? []

  return (
    <Draggable draggableId={project.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onClick(project)}
          className={`
            bg-white rounded-xl border border-[#e4eee8]
            cursor-pointer select-none mb-2
            transition-all duration-150
            hover:border-[#006734]/30 hover:shadow-[0_4px_12px_rgba(0,103,52,0.10)]
            ${snapshot.isDragging
              ? 'shadow-[0_8px_32px_rgba(0,103,52,0.20)] rotate-1'
              : 'shadow-[0_1px_3px_rgba(0,0,0,0.06)]'
            }
          `}
        >
          {/* Status color bar */}
          <div className="h-[3px] rounded-t-xl" style={{ backgroundColor: topColor }} />

          <div className="p-2.5">
            {/* Route label */}
            <div className="text-[12px] font-semibold text-[#0d2517] leading-snug mb-1.5 line-clamp-2">
              {routeLabel || project.name}
            </div>

            {/* Type + Status badges */}
            <div className="flex flex-wrap gap-1 mb-2">
              {typeBadge && (
                <span
                  className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide"
                  style={{ color: typeBadge.color, backgroundColor: typeBadge.bg }}
                >
                  {typeBadge.label}
                </span>
              )}
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ color: statusBadge.color, backgroundColor: statusBadge.bg }}
              >
                {statusBadge.label}
              </span>
            </div>

            {/* Metragem + CTOs */}
            {(project.cableMeters || project.ctoCount) && (
              <div className="flex items-center gap-2 flex-wrap">
                {project.cableMeters && (
                  <div className="flex items-center gap-1 text-[10px] text-[#006734] font-semibold">
                    <Ruler size={10} />
                    <span>{formatMeters(project.cableMeters)}</span>
                  </div>
                )}
                {project.ctoCount != null && (
                  <div className="flex items-center gap-1 text-[10px] text-[#6b8f74]">
                    <Radio size={10} />
                    <span>{project.ctoCount} CTOs</span>
                  </div>
                )}
              </div>
            )}

            {/* Footer: collaborators + Trello link */}
            {(launchers.length > 0 || project.trelloCardUrl) && (
              <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-[#f0faf4]">
                <div className="flex -space-x-1">
                  {launchers.slice(0, 4).map(c => {
                    const initials = c.collaborator.name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
                    return (
                      <span
                        key={c.id}
                        title={c.collaborator.name}
                        className="inline-flex items-center justify-center rounded-full text-white font-bold ring-1 ring-white flex-shrink-0"
                        style={{
                          width: 18, height: 18, fontSize: 7,
                          backgroundColor: c.collaborator.avatarColor,
                        }}
                      >
                        {initials}
                      </span>
                    )
                  })}
                  {launchers.length > 4 && (
                    <span
                      className="inline-flex items-center justify-center rounded-full bg-[#e4eee8] text-[#006734] font-bold ring-1 ring-white text-[7px]"
                      style={{ width: 18, height: 18 }}
                    >
                      +{launchers.length - 4}
                    </span>
                  )}
                </div>
                {project.trelloCardUrl && (
                  <a
                    href={project.trelloCardUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="text-[#0052cc] hover:text-blue-700 opacity-50 hover:opacity-100"
                    title="Ver no Trello"
                  >
                    <ExternalLink size={10} />
                  </a>
                )}
              </div>
            )}

            {/* Trello checklist — áreas de produção */}
            {areaItems.length > 0 && <AreaChecklist areas={areaItems} />}
          </div>
        </div>
      )}
    </Draggable>
  )
}
