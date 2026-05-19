'use client'

import { useState, useEffect } from 'react'
import {
  X, MapPin, ExternalLink, Ruler, Radio,
  CheckSquare, Zap, History, FileText, Cable, Save,
  CheckCircle2, Clock
} from 'lucide-react'
import type { Project, Collaborator, ProjectStatus, TrelloAreaItem } from '@/types'
import { KANBAN_COLUMNS } from '@/types'
import { formatMeters, formatDate, formatDateTime, getStatusConfig } from '@/lib/utils'
import KmzDataPanel from './KmzDataPanel'
import CollaboratorSelect from './CollaboratorSelect'

type Tab = 'geral' | 'kmz' | 'producao' | 'fusao' | 'historico'

interface Props {
  project: Project
  onClose: () => void
  onUpdate: (p: Project) => void
}

export default function ProjectModal({ project: initialProject, onClose, onUpdate }: Props) {
  const [project, setProject] = useState<Project>(initialProject)
  const [tab, setTab] = useState<Tab>('geral')
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [saving, setSaving] = useState(false)
  const [isNew] = useState(!initialProject.id)

  // Form state for new/edit
  const [form, setForm] = useState({
    name: initialProject.name,
    code: initialProject.code ?? '',
    locality: initialProject.locality ?? '',
    status: initialProject.status,
    notes: initialProject.notes ?? '',
    dueDate: initialProject.dueDate ? initialProject.dueDate.split('T')[0] : '',
  })

  // Launcher IDs
  const [launcherIds, setLauncherIds] = useState<string[]>(
    (initialProject.collaborators ?? [])
      .filter(c => c.role === 'LAUNCHER')
      .map(c => c.collaboratorId)
  )

  useEffect(() => {
    fetch('/api/collaborators')
      .then(r => r.json())
      .then(setCollaborators)
      .catch(console.error)
  }, [])

  // Reload full project if it has an id
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
      })
      .catch(console.error)
  }, [project.id])

  async function handleSave() {
    setSaving(true)
    try {
      const body = {
        ...form,
        launcherIds,
        cableMeters: project.cableMeters,
      }

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

  const areaItems: TrelloAreaItem[] = project.trelloAreaData ?? []

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'geral',     label: 'Geral',       icon: <FileText size={14} /> },
    { id: 'kmz',       label: 'Dados KMZ',   icon: <Ruler size={14} /> },
    { id: 'producao',  label: 'Produção',     icon: <Cable size={14} /> },
    { id: 'fusao',     label: 'Fusão',        icon: <Zap size={14} /> },
    { id: 'historico', label: 'Histórico',    icon: <History size={14} /> },
  ]

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="
          fixed right-0 top-0 h-full w-full max-w-[640px]
          bg-white z-50 flex flex-col
          shadow-2xl slide-in-right
        "
      >
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
                className="
                  text-[17px] font-bold text-[#0d2517] w-full
                  border-none outline-none bg-transparent
                  placeholder:text-[#bbb]
                "
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
        <div className="flex gap-0 border-b border-[#e4eee8] px-6 bg-white">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`
                flex items-center gap-1.5 px-3 py-3 text-[12px] font-semibold
                border-b-2 transition-colors
                ${tab === t.id
                  ? 'border-[#006734] text-[#006734]'
                  : 'border-transparent text-[#6b8f74] hover:text-[#3a6347]'
                }
              `}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ── TAB: GERAL ── */}
          {tab === 'geral' && (
            <div className="space-y-5">
              {/* Fields grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-semibold text-[#3a6347] uppercase tracking-wide block mb-1">
                    Código
                  </label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                    className="w-full px-3 py-2 text-[13px] border border-[#d4e8dc] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#006734]/20 focus:border-[#006734]"
                    placeholder="Ex: GRV"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#3a6347] uppercase tracking-wide block mb-1">
                    Localidade
                  </label>
                  <input
                    type="text"
                    value={form.locality}
                    onChange={e => setForm(f => ({ ...f, locality: e.target.value }))}
                    className="w-full px-3 py-2 text-[13px] border border-[#d4e8dc] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#006734]/20 focus:border-[#006734]"
                    placeholder="Cidade - UF"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#3a6347] uppercase tracking-wide block mb-1">
                    Status
                  </label>
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
                  <label className="text-[11px] font-semibold text-[#3a6347] uppercase tracking-wide block mb-1">
                    Prazo
                  </label>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                    className="w-full px-3 py-2 text-[13px] border border-[#d4e8dc] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#006734]/20 focus:border-[#006734]"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-[11px] font-semibold text-[#3a6347] uppercase tracking-wide block mb-1">
                  Observações
                </label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 text-[13px] border border-[#d4e8dc] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#006734]/20 focus:border-[#006734] resize-none"
                  placeholder="Notas sobre o projeto..."
                />
              </div>

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
                      Divisão de metragem
                    </div>
                    {launcherIds.map(id => {
                      const c = collaborators.find(c => c.id === id)
                      if (!c) return null
                      const meters = (project.cableMeters ?? 0) / launcherIds.length
                      return (
                        <div key={id} className="flex items-center justify-between py-1.5 px-3 bg-white rounded-lg border border-[#e4eee8]">
                          <span className="text-[12px] font-medium text-[#0d2517]">
                            {c.nickname ?? c.name}
                          </span>
                          <span className="text-[12px] font-bold text-[#006734]">
                            {formatMeters(meters)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Checklist — Áreas do Trello */}
              <div className="bg-white border border-[#e4eee8] rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-[#f0faf4] border-b border-[#e4eee8] flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[12px] font-bold text-[#006734] uppercase tracking-wide">
                    <CheckSquare size={14} />
                    Checklist de Áreas
                  </div>
                  {areaItems.length > 0 && (
                    <div className="flex items-center gap-3 text-[11px] text-[#6b8f74]">
                      <span className="flex items-center gap-1 text-[#006734] font-semibold">
                        <CheckCircle2 size={12} />
                        {areaItems.filter(a => a.done).length} concluídas
                      </span>
                      <span className="flex items-center gap-1 text-[#FEBF11] font-semibold">
                        <Clock size={12} />
                        {areaItems.filter(a => !a.done).length} pendentes
                      </span>
                    </div>
                  )}
                </div>

                {areaItems.length === 0 ? (
                  <div className="py-6 text-center text-[12px] text-[#bbb] italic">
                    Sem áreas — sincronize do Trello para preencher
                  </div>
                ) : (
                  <>
                    {/* Header da tabela */}
                    <div className="grid grid-cols-[60px_1fr_100px_96px_28px] bg-[#f9fdfb] border-b border-[#e4eee8] px-4 py-2">
                      <div className="text-[10px] font-bold text-[#3a6347] uppercase tracking-wide">Área</div>
                      <div className="text-[10px] font-bold text-[#3a6347] uppercase tracking-wide">Equipe</div>
                      <div className="text-[10px] font-bold text-[#3a6347] uppercase tracking-wide">Metragem</div>
                      <div className="text-[10px] font-bold text-[#3a6347] uppercase tracking-wide">Data</div>
                      <div />
                    </div>

                    {/* Linhas */}
                    <div className="max-h-64 overflow-y-auto">
                      {areaItems.map((area, i) => (
                        <div
                          key={i}
                          className={`
                            grid grid-cols-[60px_1fr_100px_96px_28px]
                            px-4 py-2.5 border-b border-[#f0f4f2] last:border-0
                            ${area.done ? 'bg-[#f9fdfb] opacity-80' : 'bg-white'}
                          `}
                        >
                          <div className="flex items-center">
                            <span className="text-[11px] font-bold font-mono text-[#0d2517] bg-[#edf5ef] px-1.5 py-0.5 rounded">
                              {area.code}
                            </span>
                          </div>
                          <div className="flex items-center pr-2">
                            <span className={`text-[12px] font-medium leading-tight ${area.done ? 'line-through text-[#6b8f74]' : 'text-[#0d2517]'}`}>
                              {area.members.join(' + ') || area.team || '—'}
                            </span>
                          </div>
                          <div className="flex items-center">
                            {area.meters > 0 ? (
                              <span className="text-[12px] font-bold text-[#006734]">
                                {area.meters >= 1000
                                  ? (area.meters / 1000).toFixed(2) + ' km'
                                  : Math.round(area.meters) + ' m'}
                              </span>
                            ) : (
                              <span className="text-[11px] text-[#bbb]">—</span>
                            )}
                          </div>
                          <div className="flex items-center">
                            <span className="text-[11px] text-[#6b8f74]">{area.date || '—'}</span>
                          </div>
                          <div className="flex items-center justify-center">
                            {area.done
                              ? <CheckCircle2 size={14} className="text-[#006734]" />
                              : <Clock size={14} className="text-[#FEBF11]" />
                            }
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
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
                  <div className="text-[26px] font-bold text-[#006734]">
                    {formatMeters(project.cableMeters)}
                  </div>
                  <div className="text-[11px] text-[#6b8f74] uppercase tracking-wide mt-1 font-semibold">Total de cabo</div>
                </div>
                <div className="bg-white border border-[#e4eee8] rounded-xl p-4 text-center">
                  <div className="text-[26px] font-bold text-[#FEBF11]">
                    {launcherIds.length || '—'}
                  </div>
                  <div className="text-[11px] text-[#6b8f74] uppercase tracking-wide mt-1 font-semibold">Lançadores</div>
                </div>
              </div>

              {/* Per-collaborator breakdown */}
              {launcherIds.length > 0 && project.cableMeters && (
                <div className="bg-white border border-[#e4eee8] rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-[#f9fdfb] border-b border-[#e4eee8]">
                    <div className="text-[11px] font-bold text-[#006734] uppercase tracking-wide">
                      Produtividade Individual
                    </div>
                  </div>
                  {launcherIds.map((id, idx) => {
                    const c = collaborators.find(c => c.id === id)
                    if (!c) return null
                    const meters = (project.cableMeters ?? 0) / launcherIds.length
                    const pct = 100 / launcherIds.length
                    return (
                      <div key={id} className="px-4 py-3 border-b border-[#f0f4f2] last:border-0">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                              style={{ backgroundColor: c.avatarColor }}
                            >
                              {c.initials ?? c.name.slice(0, 2).toUpperCase()}
                            </div>
                            <span className="text-[13px] font-semibold text-[#0d2517]">
                              {c.nickname ?? c.name}
                            </span>
                          </div>
                          <span className="text-[13px] font-bold text-[#006734]">
                            {formatMeters(meters)}
                          </span>
                        </div>
                        <div className="h-1.5 bg-[#e4eee8] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${pct}%`,
                              background: 'linear-gradient(90deg, #006734, #1a9e52)',
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="p-4 bg-[#f9fdfb] border border-[#e4eee8] rounded-xl">
                <CollaboratorSelect
                  selected={launcherIds}
                  onChange={setLauncherIds}
                  label="Alterar equipe de lançamento"
                />
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

              {/* Fusion progress */}
              {totalCtos > 0 && (
                <div>
                  <div className="flex justify-between text-[11px] text-[#6b8f74] mb-1">
                    <span>Progresso de fusão</span>
                    <span className="font-bold text-[#10B981]">
                      {Math.round((fusedCtos / totalCtos) * 100)}%
                    </span>
                  </div>
                  <div className="h-2 bg-[#e4eee8] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#10B981] transition-all duration-500"
                      style={{ width: `${(fusedCtos / totalCtos) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Caixa de emenda */}
              <div className="bg-white border border-[#e4eee8] rounded-xl p-4">
                <div className="text-[11px] font-bold text-[#006734] uppercase tracking-wide mb-3">
                  Caixa de Emenda
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-[13px] text-[#0d2517]">
                    1 caixa de emenda por projeto
                  </div>
                  <span className={`
                    text-[11px] font-semibold px-2 py-0.5 rounded-full
                    ${(project.fusions ?? []).some(f => f.type === 'SPLICE_BOX')
                      ? 'bg-[#f0faf4] text-[#006734]'
                      : 'bg-amber-50 text-amber-700'
                    }
                  `}>
                    {(project.fusions ?? []).some(f => f.type === 'SPLICE_BOX') ? '✓ Concluída' : '⏳ Pendente'}
                  </span>
                </div>
              </div>

              {/* Fusions list */}
              {(project.fusions?.length ?? 0) > 0 && (
                <div className="bg-white border border-[#e4eee8] rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#f0f4f2] bg-[#f9fdfb]">
                    <div className="text-[11px] font-bold text-[#006734] uppercase tracking-wide">
                      Fusões registradas
                    </div>
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
                <div className="text-center py-10 text-[#bbb] text-[13px] italic">
                  Sem histórico registrado
                </div>
              ) : (
                [...(project.activityLogs ?? [])].reverse().map(log => (
                  <div key={log.id} className="flex gap-3 px-3 py-2.5 rounded-lg hover:bg-[#f9fdfb]">
                    <div className="flex-shrink-0 mt-0.5">
                      <div className={`
                        w-2 h-2 rounded-full mt-1.5
                        ${log.source === 'TRELLO' ? 'bg-blue-400' :
                          log.source === 'SYSTEM' ? 'bg-[#FEBF11]' : 'bg-[#006734]'}
                      `} />
                    </div>
                    <div className="flex-1">
                      <div className="text-[12px] font-medium text-[#0d2517]">{log.action}</div>
                      {log.authorName && (
                        <div className="text-[10px] text-[#6b8f74]">
                          por {log.authorName}
                        </div>
                      )}
                      <div className="text-[10px] text-[#bbb]">{formatDateTime(log.createdAt)}</div>
                    </div>
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[#f0f4f2] text-[#6b8f74] h-fit">
                      {log.source}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer with Save */}
        <div className="px-6 py-4 border-t border-[#e4eee8] bg-[#f9fdfb] flex items-center justify-between">
          <div className="text-[11px] text-[#6b8f74]">
            {project.id ? `Criado em ${formatDate(project.createdAt)}` : 'Novo projeto'}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-[13px] font-semibold text-[#6b8f74] border border-[#d4e8dc] rounded-lg hover:border-[#006734] hover:text-[#006734] transition-colors"
            >
              Fechar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.name}
              className="
                flex items-center gap-2 px-5 py-2 text-[13px] font-semibold
                bg-[#006734] text-[#FFDE00] rounded-lg
                hover:bg-[#0a7a3e] transition-colors
                disabled:opacity-60
              "
            >
              <Save size={14} />
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
