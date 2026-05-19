import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

interface AreaItem {
  code: string
  team: string
  members: string[]
  meters: number
  date: string
  done: boolean
}

export async function GET() {
  const [projects, collaborators, fusions] = await Promise.all([
    prisma.project.findMany({
      include: {
        collaborators: { include: { collaborator: true } },
        fusions: true,
      },
    }),
    prisma.collaborator.findMany({ where: { active: true } }),
    prisma.fusion.findMany({
      where: { fusedAt: { not: null } },
      include: { responsible: true },
    }),
  ])

  const totalProjects = projects.length
  const finished = projects.filter(p => p.status === 'FINISHED').length
  const inProgress = projects.filter(p => !['TODO', 'FINISHED'].includes(p.status)).length
  const withoutKmz = projects.filter(p => !p.kmzFilePath && !p.cableMeters).length
  const withoutResponsible = projects.filter(p => p.collaborators.length === 0).length

  const totalMeters = projects.reduce((s, p) => s + (p.cableMeters ?? 0), 0)
  const totalCtos = projects.reduce((s, p) => s + (p.ctoCount ?? 0), 0)

  const allCtoFusions = fusions.filter(f => f.type === 'CTO')
  const allCeoFusions = fusions.filter(f => f.type === 'SPLICE_BOX')
  const fusedCtos = allCtoFusions.length
  const totalCeos = allCeoFusions.length
  const pendingCtos = Math.max(0, totalCtos - fusedCtos)

  // --- Area-based launch stats from trelloAreaData ---
  const launchProjects = projects.filter(p => /lan[çc]amento/i.test(p.name ?? ''))
  const launchByMember = new Map<string, { meters: number; areas: number; done: number }>()
  let totalKmFromAreas = 0

  for (const p of launchProjects) {
    if (!p.trelloAreaData) continue
    try {
      const areas: AreaItem[] = JSON.parse(p.trelloAreaData as string)
      for (const area of areas) {
        totalKmFromAreas += area.meters
        for (const member of (area.members ?? [])) {
          const name = member.trim().toUpperCase()
          if (!name) continue
          const existing = launchByMember.get(name) ?? { meters: 0, areas: 0, done: 0 }
          existing.meters += area.meters
          existing.areas += 1
          if (area.done) existing.done += 1
          launchByMember.set(name, existing)
        }
      }
    } catch { /* malformed JSON */ }
  }

  // Match member names to collaborators to get avatar colors
  const launchAreaStats = Array.from(launchByMember.entries())
    .map(([rawName, v]) => {
      const nameUp = rawName.toUpperCase()
      const collab = collaborators.find(c => {
        const cUp = c.name.toUpperCase()
        return cUp === nameUp || cUp.includes(nameUp) || nameUp.includes(cUp)
      })
      return {
        name: collab?.nickname ?? collab?.name ?? rawName,
        color: collab?.avatarColor ?? '#006734',
        meters: v.meters,
        areas: v.areas,
        done: v.done,
      }
    })
    .sort((a, b) => b.meters - a.meters)

  const activeLaunchCities = new Set(
    launchProjects
      .filter(p => p.status !== 'FINISHED' && p.trelloListName)
      .map(p => p.trelloListName!)
  ).size

  const launcherCount = collaborators.filter(c => c.role === 'LAUNCHER').length

  // --- Fusion ranking from fusions table ---
  const ceosByCollab = new Map<string, number>()
  const ctosByCollab = new Map<string, number>()

  for (const f of fusions) {
    if (!f.responsibleId) continue
    if (f.type === 'CTO') {
      ctosByCollab.set(f.responsibleId, (ctosByCollab.get(f.responsibleId) ?? 0) + 1)
    } else if (f.type === 'SPLICE_BOX') {
      ceosByCollab.set(f.responsibleId, (ceosByCollab.get(f.responsibleId) ?? 0) + 1)
    }
  }

  const fusionProjects = projects.filter(p => /fus[ãa]o/i.test(p.name ?? ''))
  const fusionCitiesCount = new Set(
    fusionProjects.filter(p => p.trelloListName).map(p => p.trelloListName!)
  ).size

  const fusionRanking = collaborators
    .filter(c => c.role === 'FUSION')
    .map(c => ({
      collaborator: {
        name: c.name,
        nickname: c.nickname,
        avatarColor: c.avatarColor,
        initials: c.initials,
      },
      ceos: ceosByCollab.get(c.id) ?? 0,
      ctos: ctosByCollab.get(c.id) ?? 0,
      total: (ceosByCollab.get(c.id) ?? 0) + (ctosByCollab.get(c.id) ?? 0),
    }))
    .sort((a, b) => b.total - a.total)

  // --- Existing collaborator stats (topLaunchers / topFusers) ---
  const collabStats = collaborators.map(c => {
    const launches = projects.flatMap(p =>
      p.collaborators.filter(pc => pc.collaboratorId === c.id && pc.role === 'LAUNCHER')
    )
    const metersLaunched = launches.reduce((s, l) => s + (l.metersAssigned ?? 0), 0)
    const projectsLaunched = launches.length
    const ctosFused = fusions.filter(f => f.responsibleId === c.id && f.type === 'CTO').length
    const projectsFused = Array.from(new Set(
      fusions.filter(f => f.responsibleId === c.id).map(f => f.projectId)
    )).length
    return { collaborator: c, metersLaunched, projectsLaunched, ctosFused, projectsFused }
  })

  const topLaunchers = [...collabStats]
    .sort((a, b) => b.metersLaunched - a.metersLaunched)
    .filter(c => c.metersLaunched > 0)

  const topFusers = [...collabStats]
    .sort((a, b) => b.ctosFused - a.ctosFused)
    .filter(c => c.ctosFused > 0)

  // Monthly meters (last 6 months)
  const monthlyData: Record<string, number> = {}
  for (const p of projects) {
    if (!p.cableMeters) continue
    const date = new Date(p.updatedAt)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    monthlyData[key] = (monthlyData[key] ?? 0) + p.cableMeters
  }
  const monthlyMeters = Object.entries(monthlyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, meters]) => ({ month, meters }))

  return NextResponse.json({
    stats: {
      totalProjects, inProgress, finished, totalMeters, totalCtos,
      fusedCtos, totalCeos, pendingCtos, withoutKmz, withoutResponsible,
    },
    topLaunchers,
    topFusers,
    monthlyMeters,
    launchAreaStats,
    totalKmFromAreas,
    activeLaunchCities,
    launcherCount,
    fusionRanking,
    fusionCitiesCount,
  })
}
