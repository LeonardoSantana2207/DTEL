'use client'

import { useState, useEffect, useRef } from 'react'
import {
  X, MapPin, ExternalLink, Ruler, Radio,
  CheckSquare, Zap, History, FileText, Cable, Save,
  CheckCircle2, Clock, ChevronDown, AlertCircle, Users
} from 'lucide-react'
import type { Project, Collaborator, ProjectStatus, TrelloAreaItem } from '@/types'
import { KANBAN_COLUMNS } from '@/types'
import { formatMeters, formatDate, formatDateTime, getStatusConfig } from '@/lib/utils'
import KmzDataPanel from './KmzDataPanel'
import CollaboratorSelect from './CollaboratorSelect'

type Tab = 'geral' | 'checklist' | 'kmz' | 'producao' | 'fusao' | 'historico'

interface Props {
  project: Project
  onClose: () => void
  onUpdate: (p: Project) => void
}

// ─── Utilitários de data ──────────────────────────────────────────────────────

function toInputDate(display: string): string {
  if (!display) return ''
  const parts = display.split('/')
  if (parts.length !== 3) return ''
  return `${parts[2]}-${parts[1]}-${parts[0]}`
}

function fromInputDate(input: string): string {
  if (!input) return ''
  const parts = input.split('-')
  if (parts.length !== 3) return ''
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

// ─── Badge de origem ──────────────────────────────────────────────────────────

function SourceBadge({ source }: { source?: string }) {
  const cfg: Record<string, { label: string; color: string; bg: string }> = {
    TRELLO: { label: 'Trello', color: '#0052cc', bg: '#DBEAFE' },
    KMZ:    { label: 'KMZ',   color: '#065F46', bg: '#D1FAE5' },
    MANUAL: { label: 'Manual',color: '#92400E', bg: '#FEF3C7' },
  }
  const c = cfg[source ?? 'TRELLO'] ?? cfg['TRELLO']
  return (
    <span
      className="text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap"
      style={{ color: c.color, backgroundColor: c.bg }}
    >
      {c.label}
    </span>
  )
}

// ─── Executor multi-select por área ──────────────────────────────────────────

interface ExecutorSelectProps {
  executorIds: string[]
  collaborators: Collaborator[]
  onChange: (ids: string[], names: string[]) => void
}

function ExecutorSelect({ executorIds, collaborators, onChange }: ExecutorSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const launchers = collaborators.filter(c => c.role === 'LAUNCHER' || c.role === 'TECHNICIAN' || !c.role)

  function toggle(id: string) {
    const next = executorIds.includes(id)
      ? executorIds.filter(i => i !== id)
      : [...executorIds, id]
    const names = next.map(i => collaborators.find(c => c.id === i)?.name ?? '').filter(Boolean)
    onChange(next, names)
  }

  const selectedNames = executorIds
    .map(id => collaborators.find(c => c.id === id))
    .filter(Boolean) as Collaborator[]

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 w-full text-left rounded px-1.5 py-1 hover:bg-[#f0faf4] transition-colors"
      >
        <div className="flex -space-x-1 flex-shrink-0">
          {selectedNames.length === 0 ? (
            <span className="text-[11px] text-[#bbb] italic">+ Equipe</span>
          ) : (
            selectedNames.slice(0, 3).map(c => (
              <span
                key={c.id}
                title={c.name}
                className="inline-flex items-center justify-center rounded-full text-white font-bold ring-1 ring-white flex-shrink-0"
                style={{ width: 18, height: 18, fontSize: 7, backgroundColor: c.avatarColor }}
              >
                {c.initials ?? c.name.slice(0, 2).toUpperCase()}
              </span>
            ))
          )}
          {selectedNames.length > 3 && (
            <span className="inline-flex items-center justify-center rounded-full bg-[#e4eee8] text-[#006734] font-bold ring-1 ring-white text-[7px]" style={{ width: 18, height: 18 }}>
              +{selectedNames.length - 3}
            </span>
          )}
        </div>
        {selectedNames.length > 0 && (
          <span className="text-[10px] text-[#0d2517] font-medium truncate max-w-[80px]">
            {selectedNames.map(c => c.name.split(' ')[0]).join('+')}
          </span>
        )}
        <ChevronDown size={10} className="text-[#6b8f74] ml-auto flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-48 bg-white border border-[#d4e8dc] rounded-xl shadow-lg overflow-hidden">
          <div className="px-3 py-2 text-[10px] font-bold text-[#3a6347] uppercase tracking-wide border-b border-[#f0faf4]">
            Selecionar equipe
          </div>
          <div className="max-h-40 overflow-y-auto">
            {collaborators.map(c => {
              const selected = executorIds.includes(c.id)
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggle(c.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-[12px] hover:bg-[#f0faf4] transition-colors ${selected ? 'bg-[#f0faf4]' : ''}`}
                >
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0"
                    style={{ backgroundColor: c.avatarColor }}
                  >
                    {c.initials ?? c.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className={`flex-1 text-left ${selected ? 'font-semibold text-[#006734]' : 'text-[#0d2517]'}`}>
                    {c.name}
                  </span>
                  {selected && <CheckCircle2 size={12} className="text-[#006734]" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Linha de área editável ───────────────────────────────────────────────────

interface AreaRowProps {
  area: TrelloAreaItem
  index: number
  collaborators: Collaborator[]
  onUpdate: (index: number, changes: Partial<TrelloAreaItem>) => void
}

function AreaRow({ area, index, collaborators, onUpdate }: AreaRowProps) {
  return (
    <div className={`
      grid grid-cols-[28px_64px_1fr_76px_80px_44px_36px_60px]
      items-center gap-1 px-3 py-2
      border-b border-[#f0f4f2] last:border-0
      ${area.done ? 'bg-[#f9fdfb]' : 'bg-white hover:bg-[#fafffe]'}
      transition-colors
    `}>
      {/* Done toggle */}
      <button
        type="button"
        onClick={() => onUpdate(index, { done: !area.done, source: 'MANUAL' })}
        className="flex items-center justify-center"
        title={area.done ? 'Marcar como pendente' : 'Marcar como concluído'}
      >
        {area.done
          ? <CheckCircle2 size={15} className="text-[#006734]" />
          : <div className="w-[15px] h-[15px] rounded border-2 border-[#d4e8dc] hover:border-[#006734] transition-colors" />
        }
      </button>

      {/* Código */}
      <div className="flex items-center">
        <span className={`text-[11px] font-bold font-mono px-1.5 py-0.5 rounded ${area.done ? 'bg-[#d4f0de] text-[#006734] line-through opacity-60' : 'bg-[#edf5ef] text-[#0d2517]'}`}>
          {area.code}
        </span>
      </div>

      {/* Equipe — executor select */}
      <div className="min-w-0">
        <ExecutorSelect
          executorIds={area.executorIds ?? []}
          collaborators={collaborators}
          onChange={(ids, names) => onUpdate(index, { executorIds: ids, members: names, source: 'MANUAL' })}
        />
      </div>

      {/* Metragem */}
      <div>
        <input
          type="number"
          value={area.meters || ''}
          onChange={e => onUpdate(index, { meters: parseFloat(e.target.value) || 0, source: 'MANUAL' })}
          placeholder="—"
          className="w-full text-[11px] font-semibold text-[#006734] bg-transparent border-b border-transparent hover:border-[#d4e8dc] focus:border-[#006734] focus:outline-none px-1 py-0.5 text-right"
        />
      </div>

      {/* Data */}
      <div>
        <input
          type="date"
          value={toInputDate(area.date)}
          onChange={e => onUpdate(index, { date: fromInputDate(e.target.value), source: 'MANUAL' })}
          className="w-full text-[10px] text-[#6b8f74] bg-transparent border-b border-transparent hover:border-[#d4e8dc] focus:border-[#006734] focus:outline-none px-1 py-0.5"
        />
      </div>

      {/* CTOs */}
      <div>
        <input
          type="number"
          value={area.ctoCount ?? ''}
          onChange={e => onUpdate(index, { ctoCount: parseInt(e.target.value) || undefined })}
          placeholder="—"
          className="w-full text-[11px] text-center text-[#6b8f74] bg-transparent border-b border-transparent hover:border-[#d4e8dc] focus:border-[#006734] focus:outline-none px-1 py-0.5"
        />
      </div>

      {/* CEOs (sempre 1) */}
      <div className="text-[11px] text-center text-[#6b8f74]">1</div>

      {/* Origem */}
      <div className="flex items-center justify-end">
        <SourceBadge source={area.source} />
      </div>
    </div>
  )
}

// ─── Modal principal ──────────────────────────────────────────────────────────

export default function ProjectModal({ project: initialProject, onClose, onUpdate }: Props) {
  const [project, setProject] = useState<Project>(initialProject)
  const [tab, setTab] = useState<Tab>('geral')
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [saving, setSaving] = useState(false)
  const [areasSaving, setAreasSaving] = useState(false)
  const [areasSaved, setAreasSaved] = useState(false)
  const [isNew] = useState(!initialProject.id)

  const [form, setForm] = useState({
    name: initialProject.name,
    code: initialProject.code ?? '',
    locality: initialProject.locality ?? '',
    status: initialProject.status,
    notes: initialProject.notes ?? '',
    dueDate: initialProject.dueDate ? initialProject.dueDate.split('T')[0] : '',
  })

  const [launcherIds, setLauncherIds] = useState<string[]>(
    (initialProject.collaborators ?? [])
      .filter(c => c.role === 'LAUNCHER')
      .map(c => c.collaboratorId)
  )

  const [editedAreas, setEditedAreas] = useState<TrelloAreaItem[]>(
    (initialProject.trelloAreaData ?? []).map(a => ({
      ...a,
      executorIds: a.executorIds ?? [],
    }))
  )

  useEffect(() => {
    fetch('/api/collaborators')
      .then(r => r.json())
      .then((data: Collaborator[]) => {
        setCollaborators(data)
        // Auto-resolve executor IDs from member names if not set
        setEditedAreas(prev => prev.map(area => {
          if ((area.executorIds ?? []).length > 0) return area
          const resolvedIds = (area.members ?? [])
            .map(name => data.find(c =>
              c.name.toLowerCase().includes(name.toLowerCase().split(' ')[0]) ||
              name.toLowerCase().includes(c.name.toLowerCase().split(' ')[0])
            )?.id)
            .filter(Boolean) as string[]
          return resolvedIds.length > 0 ? { ...area, executorIds: resolvedIds } : area
        }))
      })
      .catch(console.error)
  }, [])

  useEffect(() => {
    if (!project.id) return
    fetch(`/api/projects/${project.id}?include=all`)
      .then(r => r.json())
      .then(data => {
        setProject(data)
        setLauncherIds(
          (data.collaborators ?? [])
            .filter((c: { role: string }) => c.role === 'LAUNCHER')
            .map((c: { collaboratorId: string }) => c.collaboratorId)
        )
        setEditedAreas(
          (data.trelloAreaData ?? []).map((a: TrelloAreaItem) => ({
            ...a,
            executorIds: a.executorIds ?? [],
          }))
        )
      })
      .catch(console.error)
  }, [project.id])

  function updateArea(index: number, changes: Partial<TrelloAreaItem>) {
    setEditedAreas(prev => prev.map((a, i) => i === index ? { ...a, ...changes } : a))
  }

  async function saveAreas() {
    setAreasSaving(true)
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trelloAreaData: editedAreas }),
      })
      const updated = await res.json()
      setProject(updated)
      onUpdate(updated)
      setAreasSaved(true)
      setTimeout(() => setAreasSaved(false), 2000)
    } catch (e) {
      console.error(e)
    } finally {
      setAreasSaving(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      const body = { ...form, launcherIds, cableMeters: project.cableMeters }
      let updated: Project
      if (!project.id) {
        const res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        updated = await res.json()
      } else {
        const res = await fetch(`/api/projects/${project.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        updated = await res.json()
      }
      onUpdate(updated)
      setProject(updated)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  function handleKmzUpdate(updated: Project) {
    setProject(updated)
    onUpdate(updated)
  }

  const statusConfig = getStatusConfig(project.status as ProjectStatus)
  const fusedCtos = (project.fusions ?? []).filter(f => f.type === 'CTO').length
  const totalCtos = project.ctoCount ?? 0
  const pendingCtos = Math.max(0, totalCtos - fusedCtos)

  const areasDone = editedAreas.filter(a => a.done).length
  const areasTotal = editedAreas.length
  const areasPct = areasTotal > 0 ? Math.round((areasDone / areasTotal) * 100) : 0

  // Divisão de metros por executor (soma de todas as áreas por pessoa)
  const executorMeters = new Map<string, number>()
  for (const area of editedAreas) {
    if (!area.done && !area.meters) continue
    const ids = area.executorIds ?? []
    if (ids.length === 0) continue
    const each = (area.meters ?? 0) / ids.length
    for (const id of ids) {
      executorMeters.set(id, (executorMeters.get(id) ?? 0) + each)
    }
  }

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'geral',      label: 'Geral',       icon: <FileText size={13} /> },
    { id: 'checklist',  label: 'Checklist',   icon: <CheckSquare size={13} /> },
    { id: 'kmz',        label: 'KMZ',         icon: <Ruler size={13} /> },
    { id: 'producao',   label: 'Produção',    icon: <Cable size={13} /> },
    { id: 'fusao',      label: 'Fusão',       icon: <Zap size={13} /> },
    { id: 'historico',  label: 'Histórico',   icon: <History size={13} /> },
  ]

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 fade-in" onClick={onClose} />

      <div className="fixed right-0 top-0 h-full w-full max-w-[680px] bg-white z-50 flex flex-col shadow-2xl slide-in-right">

        {/* Header */}
        <div
          className="flex items-start justify-between px-6 py-4 border-b border-[#e4eee8]"
          style={{ borderTop: `4px solid ${statusConfig.color}` }}
        >
          <div className="flex-1 min-w-0 pr-4">
            {isNew ? (
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Nome do projeto..."
                className="text-[17px] font-bold text-[#0d2517] w-full border-none outline-none bg-transparent placeholder:text-[#bbb]"
              />
            ) : (
              <h2 className="text-[17px] font-bold text-[#0d2517] leading-tight">{project.name}</h2>
            )}

            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {project.code && (
                <span className="text-[11px] font-mono text-[#006734] bg-[#f0faf4] px-2 py-0.5 rounded">
                  {project.code}
                </span>
              )}
              <span
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: statusConfig.bgColor, color: statusConfig.textColor }}
              >
                {statusConfig.label}
              </span>
              {project.locality && (
                <span className="flex items-center gap-1 text-[11px] text-[#6b8f74]">
                  <MapPin size={10} />
                  {project.locality}
                </span>
              )}
              {areasTotal > 0 && (
                <span className={`flex items-center gap-1 text-[11px] font-semibold ${areasPct === 100 ? 'text-[#006734]' : 'text-[#6b8f74]'}`}>
                  <CheckSquare size={10} />
                  {areasDone}/{areasTotal} áreas
                </span>
              )}
              {project.trelloCardUrl && (
                <a
                  href={project.trelloCardUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800"
                >
                  <ExternalLink size={10} />
                  Trello
                </a>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[#f0faf4] text-[#6b8f74] hover:text-[#006734] transition-colors flex-shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-[#e4eee8] px-4 bg-white overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`
                flex items-center gap-1.5 px-3 py-2.5 text-[12px] font-semibold whitespace-nowrap
                border-b-2 transition-colors
                ${tab === t.id
                  ? 'border-[#006734] text-[#006734]'
                  : 'border-transparent text-[#6b8f74] hover:text-[#3a6347]'
                }
              `}
            >
              {t.icon}
              {t.label}
              {t.id === 'checklist' && areasTotal > 0 && (
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${areasPct === 100 ? 'bg-[#D1FAE5] text-[#065F46]' : 'bg-[#FEF3C7] text-[#B45309]'}`}>
                  {areasDone}/{areasTotal}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* ── TAB: GERAL ── */}
          {tab === 'geral' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-[#3a6347] uppercase tracking-wide block mb-1">Código</label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                    className="w-full px-3 py-2 text-[13px] border border-[#d4e8dc] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#006734]/20 focus:border-[#006734]"
                    placeholder="Ex: GRV"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#3a6347] uppercase tracking-wide block mb-1">Localidade</label>
                  <input
                    type="text"
                    value={form.locality}
                    onChange={e => setForm(f => ({ ...f, locality: e.target.value }))}
                    className="w-full px-3 py-2 text-[13px] border border-[#d4e8dc] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#006734]/20 focus:border-[#006734]"
                    placeholder="Cidade - UF"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#3a6347] uppercase tracking-wide block mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value as ProjectStatus }))}
                    className="w-full px-3 py-2 text-[13px] border border-[#d4e8dc] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#006734]/20 focus:border-[#006734] bg-white"
                  >
                    {KANBAN_COLUMNS.map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#3a6347] uppercase tracking-wide block mb-1">Prazo</label>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                    className="w-full px-3 py-2 text-[13px] border border-[#d4e8dc] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#006734]/20 focus:border-[#006734]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#3a6347] uppercase tracking-wide block mb-1">Observações</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 text-[13px] border border-[#d4e8dc] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#006734]/20 focus:border-[#006734] resize-none"
                  placeholder="Notas sobre o projeto..."
                />
              </div>

              {/* Descrição do Trello */}
              {project.trelloDesc && (
                <div>
                  <label className="text-[11px] font-semibold text-[#3a6347] uppercase tracking-wide block mb-1">Descrição (Trello)</label>
                  <div className="w-full px-3 py-2 text-[12px] border border-[#e4eee8] rounded-lg bg-[#f9fdfb] text-[#6b8f74] whitespace-pre-line">
                    {project.trelloDesc}
                  </div>
                </div>
              )}

              {/* Launchers */}
              <div className="p-4 bg-[#f9fdfb] border border-[#e4eee8] rounded-xl">
                <CollaboratorSelect
                  selected={launcherIds}
                  onChange={setLauncherIds}
                  label="Equipe de Lançamento"
                />
                {project.cableMeters && launcherIds.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <div className="text-[11px] font-semibold text-[#3a6347] uppercase tracking-wide mb-2">
                      Divisão de metragem ({formatMeters(project.cableMeters)} ÷ {launcherIds.length})
                    </div>
                    {launcherIds.map(id => {
                      const c = collaborators.find(c => c.id === id)
                      if (!c) return null
                      const meters = (project.cableMeters ?? 0) / launcherIds.length
                      return (
                        <div key={id} className="flex items-center justify-between py-1.5 px-3 bg-white rounded-lg border border-[#e4eee8]">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0"
                              style={{ backgroundColor: c.avatarColor }}>
                              {c.initials ?? c.name.slice(0, 2).toUpperCase()}
                            </span>
                            <span className="text-[12px] font-medium text-[#0d2517]">{c.name}</span>
                          </div>
                          <span className="text-[12px] font-bold text-[#006734]">{formatMeters(meters)}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB: CHECKLIST ── */}
          {tab === 'checklist' && (
            <div className="space-y-4">
              {/* Progress summary */}
              <div className="flex items-center gap-3 p-3 bg-[#f0faf4] rounded-xl border border-[#d4eede]">
                {areasPct === 100 && areasTotal > 0
                  ? <CheckCircle2 size={16} className="text-[#006734] flex-shrink-0" />
                  : <CheckSquare size={16} className="text-[#6b8f74] flex-shrink-0" />
                }
                <span className="text-[13px] font-bold text-[#0d2517]">{areasDone}/{areasTotal} áreas</span>
                <div className="flex-1 h-2 bg-[#e4eee8] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${areasPct}%`,
                      background: areasPct === 100 ? 'linear-gradient(90deg,#006734,#1a9e52)' : 'linear-gradient(90deg,#006734,#FEBF11)',
                    }}
                  />
                </div>
                <span className={`text-[13px] font-bold ${areasPct === 100 ? 'text-[#006734]' : 'text-[#FEBF11]'}`}>
                  {areasPct}%
                </span>
              </div>

              {areasTotal === 0 ? (
                <div className="text-center py-12 text-[#bbb]">
                  <AlertCircle size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-[13px]">Sem áreas — sincronize do Trello para preencher</p>
                </div>
              ) : (
                <>
                  {/* Table */}
                  <div className="border border-[#e4eee8] rounded-xl overflow-hidden">
                    {/* Header */}
                    <div className="grid grid-cols-[28px_64px_1fr_76px_80px_44px_36px_60px] items-center gap-1 px-3 py-2 bg-[#f0faf4] border-b border-[#e4eee8]">
                      <div />
                      <div className="text-[9px] font-bold text-[#3a6347] uppercase tracking-wide">Área</div>
                      <div className="text-[9px] font-bold text-[#3a6347] uppercase tracking-wide flex items-center gap-1">
                        <Users size={9} /> Equipe
                      </div>
                      <div className="text-[9px] font-bold text-[#3a6347] uppercase tracking-wide text-right">Metros</div>
                      <div className="text-[9px] font-bold text-[#3a6347] uppercase tracking-wide">Data</div>
                      <div className="text-[9px] font-bold text-[#3a6347] uppercase tracking-wide text-center">CTOs</div>
                      <div className="text-[9px] font-bold text-[#3a6347] uppercase tracking-wide text-center">CEO</div>
                      <div className="text-[9px] font-bold text-[#3a6347] uppercase tracking-wide text-right">Origem</div>
                    </div>

                    <div className="max-h-[380px] overflow-y-auto">
                      {editedAreas.map((area, i) => (
                        <AreaRow
                          key={i}
                          area={area}
                          index={i}
                          collaborators={collaborators}
                          onUpdate={updateArea}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Divisão por executor */}
                  {executorMeters.size > 0 && (
                    <div className="bg-[#f9fdfb] border border-[#e4eee8] rounded-xl overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-[#e4eee8] bg-[#f0faf4]">
                        <div className="text-[11px] font-bold text-[#006734] uppercase tracking-wide">
                          Produção por executor
                        </div>
                      </div>
                      <div className="divide-y divide-[#f0f4f2]">
                        {Array.from(executorMeters.entries())
                          .sort((a, b) => b[1] - a[1])
                          .map(([id, meters]) => {
                            const c = collaborators.find(c => c.id === id)
                            if (!c) return null
                            const totalMeters = project.cableMeters ?? Array.from(executorMeters.values()).reduce((a, b) => a + b, 0)
                            const pct = totalMeters > 0 ? Math.round((meters / totalMeters) * 100) : 0
                            return (
                              <div key={id} className="flex items-center gap-3 px-4 py-2.5">
                                <span
                                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                                  style={{ backgroundColor: c.avatarColor }}
                                >
                                  {c.initials ?? c.name.slice(0, 2).toUpperCase()}
                                </span>
                                <span className="flex-1 text-[12px] font-medium text-[#0d2517]">{c.name}</span>
                                <div className="w-20 h-1.5 bg-[#e4eee8] rounded-full overflow-hidden">
                                  <div className="h-full rounded-full bg-[#006734]" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-[12px] font-bold text-[#006734] w-16 text-right">{formatMeters(meters)}</span>
                              </div>
                            )
                          })}
                      </div>
                    </div>
                  )}

                  {/* Save areas */}
                  <button
                    onClick={saveAreas}
                    disabled={areasSaving}
                    className={`
                      w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold transition-all
                      ${areasSaved
                        ? 'bg-[#D1FAE5] text-[#065F46] border border-[#6EE7B7]'
                        : 'bg-[#006734] text-[#FFDE00] hover:bg-[#0a7a3e]'
                      }
                      disabled:opacity-60
                    `}
                  >
                    {areasSaving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-[#FFDE00]/30 border-t-[#FFDE00] rounded-full animate-spin" />
                        Salvando...
                      </>
                    ) : areasSaved ? (
                      <><CheckCircle2 size={16} /> Checklist salvo!</>
                    ) : (
                      <><Save size={14} /> Salvar Checklist</>
                    )}
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── TAB: KMZ ── */}
          {tab === 'kmz' && (
            <KmzDataPanel project={project} onUpdate={handleKmzUpdate} />
          )}

          {/* ── TAB: PRODUÇÃO ── */}
          {tab === 'producao' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white border border-[#e4eee8] rounded-xl p-4 text-center">
                  <div className="text-[26px] font-bold text-[#006734]">{formatMeters(project.cableMeters)}</div>
                  <div className="text-[11px] text-[#6b8f74] uppercase tracking-wide mt-1 font-semibold">Total de cabo</div>
                </div>
                <div className="bg-white border border-[#e4eee8] rounded-xl p-4 text-center">
                  <div className="text-[26px] font-bold text-[#FEBF11]">{launcherIds.length || '—'}</div>
                  <div className="text-[11px] text-[#6b8f74] uppercase tracking-wide mt-1 font-semibold">Lançadores</div>
                </div>
              </div>

              {launcherIds.length > 0 && project.cableMeters && (
                <div className="bg-white border border-[#e4eee8] rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-[#f9fdfb] border-b border-[#e4eee8]">
                    <div className="text-[11px] font-bold text-[#006734] uppercase tracking-wide">Produtividade Individual</div>
                  </div>
                  {launcherIds.map(id => {
                    const c = collaborators.find(c => c.id === id)
                    if (!c) return null
                    const meters = (project.cableMeters ?? 0) / launcherIds.length
                    const pct = 100 / launcherIds.length
                    return (
                      <div key={id} className="px-4 py-3 border-b border-[#f0f4f2] last:border-0">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: c.avatarColor }}>
                              {c.initials ?? c.name.slice(0, 2).toUpperCase()}
                            </div>
                            <span className="text-[13px] font-semibold text-[#0d2517]">{c.nickname ?? c.name}</span>
                          </div>
                          <span className="text-[13px] font-bold text-[#006734]">{formatMeters(meters)}</span>
                        </div>
                        <div className="h-1.5 bg-[#e4eee8] rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #006734, #1a9e52)' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="p-4 bg-[#f9fdfb] border border-[#e4eee8] rounded-xl">
                <CollaboratorSelect selected={launcherIds} onChange={setLauncherIds} label="Alterar equipe de lançamento" />
              </div>
            </div>
          )}

          {/* ── TAB: FUSÃO ── */}
          {tab === 'fusao' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white border border-[#e4eee8] rounded-xl p-3 text-center">
                  <div className="text-[22px] font-bold text-[#006734]">{totalCtos}</div>
                  <div className="text-[10px] text-[#6b8f74] uppercase tracking-wide mt-0.5 font-semibold">Total CTOs</div>
                </div>
                <div className="bg-white border border-[#e4eee8] rounded-xl p-3 text-center">
                  <div className="text-[22px] font-bold text-[#10B981]">{fusedCtos}</div>
                  <div className="text-[10px] text-[#6b8f74] uppercase tracking-wide mt-0.5 font-semibold">Fusionadas</div>
                </div>
                <div className="bg-white border border-[#e4eee8] rounded-xl p-3 text-center">
                  <div className="text-[22px] font-bold text-amber-500">{pendingCtos}</div>
                  <div className="text-[10px] text-[#6b8f74] uppercase tracking-wide mt-0.5 font-semibold">Pendentes</div>
                </div>
              </div>

              {totalCtos > 0 && (
                <div>
                  <div className="flex justify-between text-[11px] text-[#6b8f74] mb-1">
                    <span>Progresso de fusão</span>
                    <span className="font-bold text-[#10B981]">{Math.round((fusedCtos / totalCtos) * 100)}%</span>
                  </div>
                  <div className="h-2 bg-[#e4eee8] rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-[#10B981] transition-all duration-500" style={{ width: `${(fusedCtos / totalCtos) * 100}%` }} />
                  </div>
                </div>
              )}

              <div className="bg-white border border-[#e4eee8] rounded-xl p-4">
                <div className="text-[11px] font-bold text-[#006734] uppercase tracking-wide mb-3">Caixa de Emenda / CEO</div>
                <div className="flex items-center gap-3">
                  <div className="text-[13px] text-[#0d2517]">1 caixa de emenda por projeto</div>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${(project.fusions ?? []).some(f => f.type === 'SPLICE_BOX') ? 'bg-[#f0faf4] text-[#006734]' : 'bg-amber-50 text-amber-700'}`}>
                    {(project.fusions ?? []).some(f => f.type === 'SPLICE_BOX') ? '✓ Concluída' : '⏳ Pendente'}
                  </span>
                </div>
              </div>

              {(project.fusions?.length ?? 0) > 0 && (
                <div className="bg-white border border-[#e4eee8] rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#f0f4f2] bg-[#f9fdfb]">
                    <div className="text-[11px] font-bold text-[#006734] uppercase tracking-wide">Fusões registradas</div>
                  </div>
                  <div className="max-h-52 overflow-y-auto">
                    {(project.fusions ?? []).map(f => (
                      <div key={f.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-[#f0f4f2] last:border-0">
                        <div className="w-2 h-2 rounded-full bg-[#10B981] flex-shrink-0" />
                        <div className="flex-1">
                          <div className="text-[12px] font-semibold text-[#0d2517]">
                            {f.ctoName ?? (f.type === 'SPLICE_BOX' ? 'Caixa de emenda' : 'CTO')}
                          </div>
                          {f.responsible && (
                            <div className="text-[10px] text-[#6b8f74]">
                              {f.responsible.nickname ?? f.responsible.name}
                              {f.fusedAt && ` — ${formatDate(f.fusedAt)}`}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: HISTÓRICO ── */}
          {tab === 'historico' && (
            <div className="space-y-2">
              {(project.activityLogs?.length ?? 0) === 0 ? (
                <div className="text-center py-10 text-[#bbb] text-[13px] italic">Sem histórico registrado</div>
              ) : (
                [...(project.activityLogs ?? [])].reverse().map(log => (
                  <div key={log.id} className="flex gap-3 px-3 py-2.5 rounded-lg hover:bg-[#f9fdfb]">
                    <div className="flex-shrink-0 mt-0.5">
                      <div className={`w-2 h-2 rounded-full mt-1.5 ${log.source === 'TRELLO' ? 'bg-blue-400' : log.source === 'SYSTEM' ? 'bg-[#FEBF11]' : 'bg-[#006734]'}`} />
                    </div>
                    <div className="flex-1">
                      <div className="text-[12px] font-medium text-[#0d2517]">{log.action}</div>
                      {log.authorName && <div className="text-[10px] text-[#6b8f74]">por {log.authorName}</div>}
                      <div className="text-[10px] text-[#bbb]">{formatDateTime(log.createdAt)}</div>
                    </div>
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[#f0f4f2] text-[#6b8f74] h-fit">{log.source}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#e4eee8] bg-[#f9fdfb] flex items-center justify-between">
          <div className="text-[11px] text-[#6b8f74]">
            {project.id ? `Atualizado ${formatDate(project.updatedAt)}` : 'Novo projeto'}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-[13px] font-semibold text-[#6b8f74] border border-[#d4e8dc] rounded-lg hover:border-[#006734] hover:text-[#006734] transition-colors"
            >
              Fechar
            </button>
            {tab !== 'checklist' && (
              <button
                onClick={handleSave}
                disabled={saving || !form.name}
                className="flex items-center gap-2 px-5 py-2 text-[13px] font-semibold bg-[#006734] text-[#FFDE00] rounded-lg hover:bg-[#0a7a3e] transition-colors disabled:opacity-60"
              >
                <Save size={14} />
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
