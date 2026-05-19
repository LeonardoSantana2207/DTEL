'use client'

import { useEffect, useState } from 'react'
import { Zap, Radio, CheckCircle2, Clock } from 'lucide-react'
import AppShell from '@/components/layout/AppShell'
import type { Project } from '@/types'
import { formatDate } from '@/lib/utils'

export default function FusaoPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/projects?include=all')
      .then(r => r.json())
      .then((data: Project[]) => {
        setProjects(data.filter(p =>
          ['IN_FUSION', 'FUSION_DONE', 'FINISHED', 'LAUNCH_DONE'].includes(p.status) ||
          (p.ctoCount && p.ctoCount > 0)
        ))
      })
      .finally(() => setLoading(false))
  }, [])

  async function markFusion(projectId: string, fusionId: string, responsibleId: string) {
    setSavingId(fusionId)
    try {
      await fetch(`/api/projects/${projectId}/fusions/${fusionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fusedAt: new Date().toISOString(), responsibleId }),
      })
      // Refresh
      const res = await fetch('/api/projects?include=all')
      const data: Project[] = await res.json()
      setProjects(data.filter(p =>
        ['IN_FUSION', 'FUSION_DONE', 'FINISHED', 'LAUNCH_DONE'].includes(p.status) ||
        (p.ctoCount && p.ctoCount > 0)
      ))
    } finally {
      setSavingId(null)
    }
  }

  const allCtos = projects.reduce((s, p) => s + (p.ctoCount ?? 0), 0)
  const fusedCtos = projects.reduce((s, p) => s + (p.fusions ?? []).filter(f => f.type === 'CTO' && f.fusedAt).length, 0)
  const pendingCtos = Math.max(0, allCtos - fusedCtos)

  return (
    <AppShell>
      <div className="space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total CTOs', value: allCtos, icon: <Radio size={20} />, color: '#8B5CF6' },
            { label: 'CTOs Fusionadas', value: fusedCtos, icon: <CheckCircle2 size={20} />, color: '#10B981' },
            { label: 'CTOs Pendentes', value: pendingCtos, icon: <Clock size={20} />, color: '#F59E0B' },
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

        {/* Projects list */}
        {loading ? (
          <div className="text-center py-10 text-[#bbb]">Carregando...</div>
        ) : projects.length === 0 ? (
          <div className="text-center py-10 text-[#bbb] italic text-[13px]">
            Nenhum projeto em fase de fusão
          </div>
        ) : (
          <div className="space-y-4">
            {projects.map(p => {
              const ctos = (p.fusions ?? []).filter(f => f.type === 'CTO')
              const fusedCount = ctos.filter(f => f.fusedAt).length
              const spliceBox = (p.fusions ?? []).find(f => f.type === 'SPLICE_BOX')
              const totalCtos = p.ctoCount ?? ctos.length
              const pct = totalCtos > 0 ? Math.round((fusedCount / totalCtos) * 100) : 0

              return (
                <div key={p.id} className="bg-white border border-[#e4eee8] rounded-xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
                  {/* Project header */}
                  <div className="px-5 py-4 border-b border-[#f0f4f2] bg-[#f9fdfb] flex items-center justify-between">
                    <div>
                      <div className="text-[14px] font-bold text-[#0d2517]">{p.name}</div>
                      {p.locality && <div className="text-[11px] text-[#6b8f74]">{p.locality}</div>}
                    </div>
                    <div className="text-right">
                      <div className="text-[14px] font-bold text-[#8B5CF6]">{fusedCount}/{totalCtos} CTOs</div>
                      <div className="text-[10px] text-[#6b8f74]">{pct}% fusionado</div>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="px-5 py-3 border-b border-[#f0f4f2]">
                    <div className="h-2.5 bg-[#e4eee8] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#8B5CF6] transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Caixa de emenda */}
                  <div className="px-5 py-3 border-b border-[#f0f4f2] bg-[#f9fdfb] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap size={14} className="text-[#FEBF11]" />
                      <span className="text-[12px] font-semibold text-[#0d2517]">Caixa de emenda</span>
                    </div>
                    {spliceBox?.fusedAt ? (
                      <span className="text-[11px] font-semibold text-[#10B981] bg-green-50 px-2.5 py-0.5 rounded-full">
                        ✓ Concluída — {formatDate(spliceBox.fusedAt)}
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full">
                        ⏳ Pendente
                      </span>
                    )}
                  </div>

                  {/* CTOs grid */}
                  {ctos.length > 0 && (
                    <div className="p-4 grid grid-cols-4 gap-2 max-h-52 overflow-y-auto">
                      {ctos.map(f => (
                        <div
                          key={f.id}
                          className={`
                            p-2.5 rounded-lg text-center border-2 text-[11px] font-bold
                            ${f.fusedAt
                              ? 'border-[#10B981]/30 bg-green-50 text-[#10B981]'
                              : 'border-amber-200 bg-amber-50 text-amber-700 cursor-pointer hover:border-amber-400'
                            }
                            ${savingId === f.id ? 'opacity-60' : ''}
                          `}
                        >
                          <div>{f.ctoName ?? 'CTO'}</div>
                          {f.fusedAt && <div className="text-[9px] opacity-70 mt-0.5">{formatDate(f.fusedAt)}</div>}
                          {!f.fusedAt && (
                            <div className="text-[9px] opacity-70 mt-0.5">Pendente</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AppShell>
  )
}
