'use client'

import { useEffect, useState } from 'react'
import { Cable, Ruler, Users, Calendar } from 'lucide-react'
import AppShell from '@/components/layout/AppShell'
import type { Project } from '@/types'
import { formatMeters, formatDate } from '@/lib/utils'

export default function ProducaoPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/projects?include=all')
      .then(r => r.json())
      .then(data => {
        // Only projects with cable data or in launch stages
        setProjects(data.filter((p: Project) =>
          p.cableMeters || ['IN_LAUNCH', 'LAUNCH_DONE', 'IN_FUSION', 'FUSION_DONE', 'FINISHED'].includes(p.status)
        ))
      })
      .finally(() => setLoading(false))
  }, [])

  const totalMeters = projects.reduce((s, p) => s + (p.cableMeters ?? 0), 0)
  const withMeters = projects.filter(p => p.cableMeters).length

  // All launcher assignments
  const allLaunches = projects.flatMap(p =>
    (p.collaborators ?? [])
      .filter(c => c.role === 'LAUNCHER')
      .map(c => ({ project: p, collab: c }))
  )

  // Per-collaborator totals
  const byCollab: Record<string, { name: string; color: string; meters: number; projects: number }> = {}
  for (const { project, collab } of allLaunches) {
    const id = collab.collaboratorId
    if (!byCollab[id]) {
      byCollab[id] = {
        name: collab.collaborator.nickname ?? collab.collaborator.name,
        color: collab.collaborator.avatarColor,
        meters: 0,
        projects: 0,
      }
    }
    byCollab[id].meters += collab.metersAssigned ?? 0
    byCollab[id].projects++
  }
  const collabStats = Object.values(byCollab).sort((a, b) => b.meters - a.meters)

  return (
    <AppShell>
      <div className="space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Lançado', value: formatMeters(totalMeters), icon: <Ruler size={20} />, color: '#006734' },
            { label: 'Projetos com Cabo', value: withMeters, icon: <Cable size={20} />, color: '#3B82F6' },
            { label: 'Lançadores Ativos', value: collabStats.length, icon: <Users size={20} />, color: '#8B5CF6' },
          ].map(k => (
            <div key={k.label} className="bg-white border border-[#e4eee8] rounded-xl p-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]" style={{ borderLeftColor: k.color, borderLeftWidth: 4 }}>
              <div className="p-2 rounded-lg w-fit mb-2" style={{ backgroundColor: k.color + '18' }}>
                <span style={{ color: k.color }}>{k.icon}</span>
              </div>
              <div className="text-[26px] font-bold text-[#0d2517]">{k.value}</div>
              <div className="text-[11px] text-[#6b8f74] font-semibold uppercase tracking-wide mt-1">{k.label}</div>
            </div>
          ))}
        </div>

        {/* Produtividade por colaborador */}
        <div className="bg-white border border-[#e4eee8] rounded-xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <div className="px-5 py-4 border-b border-[#f0f4f2] bg-[#f0faf4]">
            <h3 className="text-[13px] font-bold text-[#006734] uppercase tracking-wide">
              Produtividade por Colaborador
            </h3>
          </div>
          {collabStats.length === 0 ? (
            <div className="p-10 text-center text-[13px] text-[#bbb] italic">
              Nenhum dado de lançamento cadastrado
            </div>
          ) : (
            <div>
              {collabStats.map((c, i) => {
                const maxM = collabStats[0].meters
                const pct = maxM > 0 ? (c.meters / maxM) * 100 : 0
                return (
                  <div key={i} className="px-5 py-4 border-b border-[#f0f4f2] last:border-0 hover:bg-[#f9fdfb]">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold" style={{ backgroundColor: c.color }}>
                        {c.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <div className="text-[13px] font-semibold text-[#0d2517]">{c.name}</div>
                        <div className="text-[10px] text-[#6b8f74]">{c.projects} projeto{c.projects !== 1 ? 's' : ''}</div>
                      </div>
                      <div className="text-[14px] font-bold text-[#006734]">{formatMeters(c.meters)}</div>
                    </div>
                    <div className="h-2 bg-[#e4eee8] rounded-full overflow-hidden ml-11">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #006734, #1a9e52)' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Tabela de projetos */}
        <div className="bg-white border border-[#e4eee8] rounded-xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <div className="px-5 py-4 border-b border-[#f0f4f2] bg-[#f0faf4]">
            <h3 className="text-[13px] font-bold text-[#006734] uppercase tracking-wide">
              Detalhe por Projeto
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Projeto</th>
                  <th>Localidade</th>
                  <th>Metragem</th>
                  <th>Equipe</th>
                  <th>Produção individual</th>
                  <th>Status</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center text-[#bbb] py-8 italic">Carregando...</td></tr>
                ) : projects.length === 0 ? (
                  <tr><td colSpan={7} className="text-center text-[#bbb] py-8 italic">Nenhum projeto com lançamento</td></tr>
                ) : projects.map(p => {
                  const launchers = (p.collaborators ?? []).filter(c => c.role === 'LAUNCHER')
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="font-semibold text-[#0d2517]">{p.name}</div>
                        {p.code && <div className="text-[10px] font-mono text-[#006734]">{p.code}</div>}
                      </td>
                      <td className="text-[#3a6347]">{p.locality ?? '—'}</td>
                      <td className="font-semibold text-[#006734]">{formatMeters(p.cableMeters)}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          {launchers.map(c => (
                            <span
                              key={c.id}
                              className="px-2 py-0.5 rounded-full text-[10px] font-semibold text-white"
                              style={{ backgroundColor: c.collaborator.avatarColor }}
                            >
                              {c.collaborator.nickname ?? c.collaborator.name.split(' ')[0]}
                            </span>
                          ))}
                          {launchers.length === 0 && <span className="text-[#bbb] text-[11px]">—</span>}
                        </div>
                      </td>
                      <td>
                        {launchers.length > 0 ? (
                          <div className="text-[11px] text-[#3a6347]">
                            {launchers.map(c => (
                              <div key={c.id}>
                                {c.collaborator.nickname ?? c.collaborator.name.split(' ')[0]}: {formatMeters(c.metersAssigned)}
                              </div>
                            ))}
                          </div>
                        ) : '—'}
                      </td>
                      <td>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#f0faf4] text-[#006734]">
                          {p.status}
                        </span>
                      </td>
                      <td className="text-[#6b8f74] text-[11px]">{formatDate(p.updatedAt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
