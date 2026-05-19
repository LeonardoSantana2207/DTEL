'use client'

import { Droppable } from '@hello-pangea/dnd'
import { Ruler } from 'lucide-react'
import type { Project } from '@/types'
import ProjectCard from './ProjectCard'

interface CityKmzData {
  meters: number
  fileName: string
  ctoCount: number
}

interface CityColumn {
  id: string
  label: string
  projects: Project[]
  projectMeters: number
  kmzData: CityKmzData | null
}

interface Props {
  column: CityColumn
  onCardClick: (project: Project) => void
}

export default function KanbanColumn({ column, onCardClick }: Props) {
  return (
    <div className="flex flex-col w-[252px] flex-shrink-0">
      {/* Column header */}
      <div className="bg-[#021408] px-3 py-2.5 mb-2 rounded-lg">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[12px] font-bold text-[#FFDE00] uppercase tracking-wide leading-tight line-clamp-1 flex-1 mr-2">
            {column.label}
          </span>
          <span className="text-[10px] font-bold bg-[#FFDE00] text-[#021408] px-1.5 py-0.5 rounded-full flex-shrink-0">
            {column.projects.length}
          </span>
        </div>
        {column.kmzData ? (
          <div className="flex items-center gap-1 text-[11px] text-[#1a9e52]">
            <Ruler size={10} />
            <span className="font-semibold">{(column.kmzData.meters / 1000).toFixed(2)} km</span>
            {column.kmzData.ctoCount > 0 && (
              <span className="text-[#3a6347] opacity-70 ml-1">· {column.kmzData.ctoCount} CTOs</span>
            )}
          </div>
        ) : column.projectMeters > 0 ? (
          <div className="flex items-center gap-1 text-[11px] text-[#1a9e52]">
            <Ruler size={10} />
            <span className="font-semibold">{(column.projectMeters / 1000).toFixed(2)} km</span>
          </div>
        ) : (
          <div className="text-[10px] text-[#3a6347] opacity-50">Sem KMZ</div>
        )}
      </div>

      {/* Droppable area */}
      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`
              flex-1 min-h-[80px] px-0.5 py-1 rounded-lg transition-colors duration-150
              ${snapshot.isDraggingOver
                ? 'bg-[#006734]/8 ring-2 ring-[#006734]/20 ring-inset'
                : 'bg-transparent'
              }
            `}
          >
            {column.projects.map((project, index) => (
              <ProjectCard
                key={project.id}
                project={project}
                index={index}
                cityName={column.label}
                onClick={onCardClick}
              />
            ))}
            {provided.placeholder}
            {column.projects.length === 0 && !snapshot.isDraggingOver && (
              <div className="text-center py-6 text-[11px] text-[#bbb] italic">
                Sem rotas
              </div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  )
}
