import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { findCityDir, parseAreasDetalhadasForCity, type AreasDetalhadasResult } from '@/lib/kmz'
import type { TrelloAreaItem } from '@/types'
import * as path from 'path'

export const maxDuration = 60

// POST /api/kmz/sync-areas
// Lê cada KMZ em "Áreas Detalhadas" por cidade → atualiza metros (+16%), CTOs e caminho KMZ no DB
export async function POST(req: Request) {
  const basePath = process.env.KMZ_BASE_PATH
  if (!basePath) {
    return NextResponse.json({ error: 'KMZ_BASE_PATH não configurado' }, { status: 400 })
  }

  const { searchParams } = new URL(req.url)
  const citiesParam = searchParams.get('cities')
  const onlyCities = citiesParam ? citiesParam.split(',').map(c => c.trim()) : null

  const projects = await prisma.project.findMany({
    where: { trelloAreaData: { not: null } },
    select: { id: true, locality: true, trelloAreaData: true, name: true },
  })

  const filtered = onlyCities
    ? projects.filter(p => onlyCities.some(c => p.locality?.toLowerCase().includes(c.toLowerCase())))
    : projects

  const byCityMap = new Map<string, typeof filtered>()
  for (const p of filtered) {
    const city = p.locality ?? ''
    if (!byCityMap.has(city)) byCityMap.set(city, [])
    byCityMap.get(city)!.push(p)
  }

  let updatedProjects = 0
  let updatedAreas = 0
  const skipped: string[] = []

  const EMPTY_RESULT: AreasDetalhadasResult = { areas: {}, ctos: {}, areasDirPath: null }

  for (const [city, cityProjects] of byCityMap) {
    const cityDir = findCityDir(city)
    if (!cityDir) { skipped.push(city); continue }

    let result: AreasDetalhadasResult
    try {
      const timeout = new Promise<AreasDetalhadasResult>(resolve =>
        setTimeout(() => resolve(EMPTY_RESULT), 30000)
      )
      result = await Promise.race([parseAreasDetalhadasForCity(cityDir), timeout])
    } catch { skipped.push(city); continue }

    const { areas: areaMeters, ctos: areaCtos, areasDirPath } = result
    if (Object.keys(areaMeters).length === 0) { skipped.push(city); continue }

    for (const proj of cityProjects) {
      let areas: TrelloAreaItem[]
      try { areas = JSON.parse(proj.trelloAreaData!) } catch { continue }

      let changed = false
      const updated = areas.map(area => {
        const m = areaMeters[area.code]
        const c = areaCtos[area.code]
        const metersChanged = m && m > 0 && Math.abs((area.meters ?? 0) - m) > 1
        const ctosChanged = c !== undefined && c !== (area.ctoCount ?? 0)
        if (metersChanged || ctosChanged) {
          changed = true
          if (metersChanged) updatedAreas++
          return {
            ...area,
            ...(metersChanged && { meters: m }),
            ...(ctosChanged && { ctoCount: c }),
          }
        }
        return area
      })

      if (changed) {
        // Total metros da soma das áreas + 16% de folga técnica
        const rawTotal = updated.reduce((s, a) => s + (a.meters ?? 0), 0)
        const totalMeters = rawTotal > 0 ? Math.round(rawTotal * 1.16) : 0
        // Total CTOs do projeto = soma das CTOs de cada área
        const totalCtos = updated.reduce((s, a) => s + (a.ctoCount ?? 0), 0)

        await prisma.project.update({
          where: { id: proj.id },
          data: {
            trelloAreaData: JSON.stringify(updated),
            ...(totalMeters > 0 && { cableMeters: totalMeters }),
            ...(totalCtos > 0 && { ctoCount: totalCtos }),
            ...(areasDirPath && {
              kmzFilePath: areasDirPath,
              kmzFileName: `Áreas Detalhadas (${Object.keys(areaMeters).length} áreas)`,
              kmzLastParsed: new Date(),
            }),
          },
        })
        updatedProjects++
      }
    }
  }

  return NextResponse.json({
    ok: true,
    citiesProcessed: byCityMap.size - skipped.length,
    projectsUpdated: updatedProjects,
    areasUpdated: updatedAreas,
    citiesSkipped: skipped,
  })
}
