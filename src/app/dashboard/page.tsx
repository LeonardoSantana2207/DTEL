'use client'

import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import {
  Cable, Zap, MapPin, Users, RefreshCw, Award, Radio,
  FolderKanban, CheckCircle2, AlertTriangle, TrendingUp,
} from 'lucide-react'
import AppShell from '@/components/layout/AppShell'
import { formatMeters } from '@/lib/utils'

interface AreaStat {
  name: string
  color: string
  meters: number
  areas: number
  done: number
}

interface FusionRankItem {
  collaborator: {
    name: string
    nickname?: string | null
    avatarColor: string
    initials?: string | null
  }
  ceos: number
  ctos: number
  total: number
}

interface DashData {
  stats: {
    totalProjects: number
    inProgress: number
    finished: number
    totalMeters: number
    totalCtos: number
    fusedCtos: number
    totalCeos: number
    pendingCtos: number
    withoutKmz: number
    withoutResponsible: number
  }
  topLaunchers: {
    collaborator: { name: string; nickname?: string | null; avatarColor: string; initials?: string | null }
    metersLaunched: number
    projectsLaunched: number
  }[]
  topFusers: {
    collaborator: { name: string; nickname?: string | null; avatarColor: string; initials?: string | null }
    ctosFused: number
    projectsFused: number
  }[]
  monthlyMeters: { month: string; meters: number }[]
  launchAreaStats: AreaStat[]
  totalKmFromAreas: number
  activeLaunchCities: number
  launcherCount: number
  fusionRanking: FusionRankItem[]
  fusionCitiesCount: number
}

function KpiCard({
  label, value, sub, icon, color, alert,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ReactNode
  color: string
  alert?: boolean
}) {
  return (
    <div
      className={`
        bg-white border rounded-xl p-4 shadow-[0_1px_4px_rgba(0,0,0,0.06)]
        border-l-4 transition-all hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]
        ${alert ? 'border-l-amber-400' : ''}
      `}
      style={{ borderLeftColor: alert ? undefined : color }}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="p-2 rounded-lg" style={{ backgroundColor: color + '15' }}>
          <span style={{ color }}>{icon}</span>
        </div>
        {alert && (
          <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
            Atenção
          </span>
        )}
      </div>
      <div className="text-[26px] font-bold text-[#0d2517] leading-none mt-1">{value}</div>
      <div className="text-[11px] text-[#6b8f74] mt-1 font-semibold uppercase tracking-wide">{label}</div>
      {sub && <div className="text-[10px] text-[#aaa] mt-0.5">{sub}</div>}
    </div>
  )
}

function CustomBar(props: { x?: number; y?: number; width?: number; height?: number; fill?: string }) {
  const { x = 0, y = 0, width = 0, height = 0, fill } = props
  return <rect x={x} y={y + 1} width={width} height={Math.max(height - 2, 1)} fill={fill} rx={4} />
}

export default function DashboardPage() {
  const [data, setData] = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'launch' | 'fusion'>('launch')

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/dashboard')
      setData(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading || !data) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-[#e4eee8] border-t-[#006734] rounded-full animate-spin" />
        </div>
      </AppShell>
    )
  }

  const { stats, launchAreaStats, fusionRanking, totalKmFromAreas } = data

  // Determine effective km total for launch: prefer area-derived, fall back to cableMeters sum
  const launchKmDisplay = totalKmFromAreas > 0 ? totalKmFromAreas : stats.totalMeters
  const hasAreaData = launchAreaStats.length > 0
  const hasFusionData = fusionRanking.some(r => r.total > 0)

  const medals = ['🥇', '🥈', '🥉']

  return (
    <AppShell>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-[18px] font-bold text-[#0d2517]">Dashboard de Produção</h2>
            <p className="text-[12px] text-[#6b8f74] mt-0.5">
              {stats.totalProjects} projetos · {stats.inProgress} em andamento · {stats.finished} finalizados
            </p>
          </div>
          <button
            onClick={load}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-[12px] font-semibold border border-[#d4e8dc] text-[#3a6347] hover:border-[#006734] hover:text-[#006734] transition-colors"
          >
            <RefreshCw size={13} />
            Atualizar
          </button>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label="Total de Projetos"
            value={stats.totalProjects}
            sub={`${stats.inProgress} em andamento`}
            icon={<FolderKanban size={16} />}
            color="#006734"
          />
          <KpiCard
            label="Finalizados"
            value={stats.finished}
            sub={`${Math.round((stats.finished / Math.max(stats.totalProjects, 1)) * 100)}% do total`}
            icon={<CheckCircle2 size={16} />}
            color="#10B981"
          />
          <KpiCard
            label="Sem KMZ"
            value={stats.withoutKmz}
            icon={<AlertTriangle size={16} />}
            color="#F59E0B"
            alert={stats.withoutKmz > 0}
          />
          <KpiCard
            label="Sem Responsável"
            value={stats.withoutResponsible}
            icon={<Users size={16} />}
            color="#F97316"
            alert={stats.withoutResponsible > 0}
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-[#e4eee8]">
          <button
            onClick={() => setTab('launch')}
            className={`
              flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold rounded-t-lg border-b-2 transition-all
              ${tab === 'launch'
                ? 'border-[#006734] text-[#006734] bg-[#f0faf4]'
                : 'border-transparent text-[#6b8f74] hover:text-[#0d2517] hover:bg-[#f9fdfb]'
              }
            `}
          >
            <Cable size={14} />
            Lançamento
          </button>
          <button
            onClick={() => setTab('fusion')}
            className={`
              flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold rounded-t-lg border-b-2 transition-all
              ${tab === 'fusion'
                ? 'border-[#8B5CF6] text-[#8B5CF6] bg-[#f5f3ff]'
                : 'border-transparent text-[#6b8f74] hover:text-[#0d2517] hover:bg-[#f9fdfb]'
              }
            `}
          >
            <Zap size={14} />
            Fusão
          </button>
        </div>

        {/* ── LANÇAMENTO TAB ── */}
        {tab === 'launch' && (
          <div className="space-y-5">
            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <KpiCard
                label="KM Projetados"
                value={(launchKmDisplay / 1000).toFixed(1) + ' km'}
                sub={hasAreaData ? 'dados do Trello' : 'dados do KMZ'}
                icon={<Cable size={18} />}
                color="#006734"
              />
              <KpiCard
                label="Cidades Ativas"
                value={data.activeLaunchCities}
                sub="em lançamento"
                icon={<MapPin size={18} />}
                color="#3B82F6"
              />
              <KpiCard
                label="Colaboradores"
                value={data.launcherCount}
                sub="equipe de lançamento"
                icon={<Users size={18} />}
                color="#10B981"
              />
            </div>

            {/* Bar chart */}
            <div className="bg-white border border-[#e4eee8] rounded-xl p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
              <div className="flex items-center gap-2 mb-4">
                <Award size={16} className="text-[#FEBF11]" />
                <h3 className="text-[13px] font-bold text-[#0d2517]">METROS POR COLABORADOR — LANÇAMENTO</h3>
              </div>

              {hasAreaData ? (
                <ResponsiveContainer width="100%" height={Math.max(launchAreaStats.length * 44, 120)}>
                  <BarChart
                    data={launchAreaStats}
                    layout="vertical"
                    margin={{ left: 8, right: 50, top: 4, bottom: 4 }}
                    barCategoryGap="25%"
                  >
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10, fill: '#6b8f74' }}
                      tickFormatter={v => `${(v / 1000).toFixed(1)}km`}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={130}
                      tick={{ fontSize: 12, fill: '#0d2517', fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: '1px solid #e4eee8', fontSize: 12 }}
                      formatter={(v: number, _name, entry) => [
                        `${(v / 1000).toFixed(2)} km  (${entry.payload.areas} áreas, ${entry.payload.done} concluídas)`,
                        'Metros'
                      ]}
                    />
                    <Bar dataKey="meters" shape={<CustomBar />} maxBarSize={26}>
                      {launchAreaStats.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                // Fallback: topLaunchers from projectCollaborator
                data.topLaunchers.length > 0 ? (
                  <div className="space-y-0">
                    {data.topLaunchers.slice(0, 8).map((item, i) => {
                      const maxM = Math.max(...data.topLaunchers.map(l => l.metersLaunched), 1)
                      const pct = (item.metersLaunched / maxM) * 100
                      const initials = item.collaborator.initials
                        ?? item.collaborator.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
                      return (
                        <div key={i} className="flex items-center gap-3 py-2.5 border-b border-[#f0f4f2] last:border-0">
                          <span className="text-[13px] w-6 text-center shrink-0">{medals[i] ?? `${i + 1}º`}</span>
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                            style={{ backgroundColor: item.collaborator.avatarColor }}
                          >
                            {initials}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[12px] font-semibold text-[#0d2517]">
                              {item.collaborator.nickname ?? item.collaborator.name}
                            </div>
                            <div className="h-1.5 bg-[#e4eee8] rounded-full mt-1 overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${pct}%`,
                                  backgroundColor: item.collaborator.avatarColor,
                                }}
                              />
                            </div>
                          </div>
                          <div className="text-[12px] font-bold text-[#006734] shrink-0">
                            {formatMeters(item.metersLaunched)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="py-10 text-center text-[12px] text-[#bbb] italic">
                    Sincronize com o Trello para ver os dados de lançamento
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {/* ── FUSÃO TAB ── */}
        {tab === 'fusion' && (
          <div className="space-y-5">
            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <KpiCard
                label="CEOs Fusionados"
                value={stats.totalCeos}
                sub="caixas de emenda óptica"
                icon={<Zap size={18} />}
                color="#8B5CF6"
              />
              <KpiCard
                label="CTOs Fusionadas"
                value={stats.fusedCtos}
                sub={`de ${stats.totalCtos} total`}
                icon={<Radio size={18} />}
                color="#EC4899"
              />
              <KpiCard
                label="Cidades c/ Fusão"
                value={data.fusionCitiesCount}
                sub="em fusão"
                icon={<MapPin size={18} />}
                color="#F97316"
              />
            </div>

            {/* Ranking table */}
            <div className="bg-white border border-[#e4eee8] rounded-xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
              <div className="px-5 py-4 border-b border-[#f0f4f2] bg-gradient-to-r from-[#f5f3ff] to-white flex items-center gap-2">
                <Award size={16} className="text-[#8B5CF6]" />
                <h3 className="text-[13px] font-bold text-[#0d2517]">RANKING FUSÃO</h3>
              </div>

              {hasFusionData ? (
                <>
                  {/* Table header */}
                  <div className="grid grid-cols-[36px_1fr_80px_80px_80px] px-5 py-2 bg-[#fafbfa] border-b border-[#f0f4f2] text-[10px] font-bold text-[#6b8f74] uppercase tracking-wide">
                    <span>#</span>
                    <span>Colaborador</span>
                    <span className="text-center">CEOs</span>
                    <span className="text-center">CTOs</span>
                    <span className="text-center">Total</span>
                  </div>
                  {fusionRanking.map((item, i) => {
                    const initials = item.collaborator.initials
                      ?? item.collaborator.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
                    const maxTotal = Math.max(...fusionRanking.map(r => r.total), 1)
                    const pct = (item.total / maxTotal) * 100
                    return (
                      <div
                        key={i}
                        className="grid grid-cols-[36px_1fr_80px_80px_80px] px-5 py-3 border-b border-[#f0f4f2] last:border-0 hover:bg-[#f9fdfb] items-center"
                      >
                        <span className="text-[14px]">{medals[i] ?? `${i + 1}º`}</span>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                            style={{ backgroundColor: item.collaborator.avatarColor }}
                          >
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="text-[13px] font-semibold text-[#0d2517] truncate">
                              {item.collaborator.nickname ?? item.collaborator.name}
                            </div>
                            <div className="h-1.5 bg-[#ede9fe] rounded-full mt-1 overflow-hidden w-24">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${pct}%`,
                                  background: 'linear-gradient(90deg, #8B5CF6, #A78BFA)',
                                }}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="text-center">
                          <span className="text-[14px] font-bold text-[#8B5CF6]">{item.ceos}</span>
                          <div className="text-[9px] text-[#bbb]">CEOs</div>
                        </div>
                        <div className="text-center">
                          <span className="text-[14px] font-bold text-[#EC4899]">{item.ctos}</span>
                          <div className="text-[9px] text-[#bbb]">CTOs</div>
                        </div>
                        <div className="text-center">
                          <span className="text-[14px] font-bold text-[#0d2517]">{item.total}</span>
                          <div className="text-[9px] text-[#bbb]">Total</div>
                        </div>
                      </div>
                    )
                  })}
                </>
              ) : (
                /* No fusion data — show team with zeroes and instructions */
                <div>
                  {fusionRanking.length > 0 ? (
                    <>
                      <div className="grid grid-cols-[36px_1fr_80px_80px_80px] px-5 py-2 bg-[#fafbfa] border-b border-[#f0f4f2] text-[10px] font-bold text-[#6b8f74] uppercase tracking-wide">
                        <span>#</span>
                        <span>Colaborador</span>
                        <span className="text-center">CEOs</span>
                        <span className="text-center">CTOs</span>
                        <span className="text-center">Total</span>
                      </div>
                      {fusionRanking.map((item, i) => {
                        const initials = item.collaborator.initials
                          ?? item.collaborator.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
                        return (
                          <div
                            key={i}
                            className="grid grid-cols-[36px_1fr_80px_80px_80px] px-5 py-3 border-b border-[#f0f4f2] last:border-0 items-center opacity-60"
                          >
                            <span className="text-[13px] text-[#bbb]">{i + 1}º</span>
                            <div className="flex items-center gap-2.5">
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                                style={{ backgroundColor: item.collaborator.avatarColor }}
                              >
                                {initials}
                              </div>
                              <span className="text-[13px] font-semibold text-[#0d2517]">
                                {item.collaborator.nickname ?? item.collaborator.name}
                              </span>
                            </div>
                            <div className="text-center text-[14px] text-[#bbb]">0</div>
                            <div className="text-center text-[14px] text-[#bbb]">0</div>
                            <div className="text-center text-[14px] text-[#bbb]">0</div>
                          </div>
                        )
                      })}
                    </>
                  ) : (
                    <div className="py-10 text-center text-[12px] text-[#bbb] italic">
                      Nenhum colaborador de fusão cadastrado
                    </div>
                  )}
                  <div className="px-5 py-3 bg-[#faf9ff] border-t border-[#ede9fe] text-[11px] text-[#8B5CF6]">
                    Registre fusões na aba de Fusão para ver o ranking preenchido
                  </div>
                </div>
              )}
            </div>

            {/* Bar charts for CEOs/CTOs if data exists */}
            {hasFusionData && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* CEOs chart */}
                {stats.totalCeos > 0 && (
                  <div className="bg-white border border-[#e4eee8] rounded-xl p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
                    <div className="flex items-center gap-2 mb-4">
                      <Zap size={14} className="text-[#8B5CF6]" />
                      <h3 className="text-[12px] font-bold text-[#0d2517]">CEOs POR COLABORADOR</h3>
                    </div>
                    <ResponsiveContainer width="100%" height={Math.max(fusionRanking.filter(r => r.ceos > 0).length * 44, 80)}>
                      <BarChart
                        data={fusionRanking.filter(r => r.ceos > 0)}
                        layout="vertical"
                        margin={{ left: 8, right: 30, top: 4, bottom: 4 }}
                        barCategoryGap="25%"
                      >
                        <XAxis type="number" tick={{ fontSize: 10, fill: '#6b8f74' }} axisLine={false} tickLine={false} />
                        <YAxis
                          type="category"
                          dataKey="collaborator.name"
                          width={120}
                          tick={{ fontSize: 11, fill: '#0d2517' }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={v => {
                            const r = fusionRanking.find(x => x.collaborator.name === v)
                            return r?.collaborator.nickname ?? v.split(' ')[0]
                          }}
                        />
                        <Tooltip
                          contentStyle={{ borderRadius: 8, border: '1px solid #e4eee8', fontSize: 12 }}
                          formatter={(v: number) => [v, 'CEOs']}
                        />
                        <Bar dataKey="ceos" shape={<CustomBar />} maxBarSize={26}>
                          {fusionRanking.filter(r => r.ceos > 0).map((entry, i) => (
                            <Cell key={i} fill={entry.collaborator.avatarColor} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* CTOs chart */}
                {stats.fusedCtos > 0 && (
                  <div className="bg-white border border-[#e4eee8] rounded-xl p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
                    <div className="flex items-center gap-2 mb-4">
                      <Radio size={14} className="text-[#EC4899]" />
                      <h3 className="text-[12px] font-bold text-[#0d2517]">CTOs POR COLABORADOR</h3>
                    </div>
                    <ResponsiveContainer width="100%" height={Math.max(fusionRanking.filter(r => r.ctos > 0).length * 44, 80)}>
                      <BarChart
                        data={fusionRanking.filter(r => r.ctos > 0)}
                        layout="vertical"
                        margin={{ left: 8, right: 30, top: 4, bottom: 4 }}
                        barCategoryGap="25%"
                      >
                        <XAxis type="number" tick={{ fontSize: 10, fill: '#6b8f74' }} axisLine={false} tickLine={false} />
                        <YAxis
                          type="category"
                          dataKey="collaborator.name"
                          width={120}
                          tick={{ fontSize: 11, fill: '#0d2517' }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={v => {
                            const r = fusionRanking.find(x => x.collaborator.name === v)
                            return r?.collaborator.nickname ?? v.split(' ')[0]
                          }}
                        />
                        <Tooltip
                          contentStyle={{ borderRadius: 8, border: '1px solid #e4eee8', fontSize: 12 }}
                          formatter={(v: number) => [v, 'CTOs']}
                        />
                        <Bar dataKey="ctos" shape={<CustomBar />} maxBarSize={26}>
                          {fusionRanking.filter(r => r.ctos > 0).map((entry, i) => (
                            <Cell key={i} fill={entry.collaborator.avatarColor} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}

            {/* Fallback: existing topFusers */}
            {!hasFusionData && data.topFusers.length > 0 && (
              <div className="bg-white border border-[#e4eee8] rounded-xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
                <div className="px-5 py-4 border-b border-[#f0f4f2] flex items-center gap-2">
                  <TrendingUp size={14} className="text-[#8B5CF6]" />
                  <h3 className="text-[13px] font-bold text-[#0d2517]">Top Fusionadores (dados históricos)</h3>
                </div>
                {data.topFusers.slice(0, 5).map((item, i) => {
                  const maxCtos = Math.max(...data.topFusers.map(f => f.ctosFused), 1)
                  const pct = (item.ctosFused / maxCtos) * 100
                  const initials = item.collaborator.initials
                    ?? item.collaborator.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
                  return (
                    <div key={i} className="px-5 py-3.5 border-b border-[#f0f4f2] last:border-0 hover:bg-[#f9fdfb]">
                      <div className="flex items-center gap-3 mb-1.5">
                        <span className="text-[14px] w-6 text-center">{medals[i] ?? `${i + 1}º`}</span>
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                          style={{ backgroundColor: item.collaborator.avatarColor }}
                        >
                          {initials}
                        </div>
                        <div className="flex-1">
                          <div className="text-[13px] font-semibold text-[#0d2517]">
                            {item.collaborator.nickname ?? item.collaborator.name}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[13px] font-bold text-[#8B5CF6]">{item.ctosFused}</div>
                          <div className="text-[9px] text-[#bbb]">CTOs</div>
                        </div>
                      </div>
                      <div className="ml-9 h-1.5 bg-[#ede9fe] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #8B5CF6, #A78BFA)' }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  )
}
