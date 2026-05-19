import { NextResponse } from 'next/server'
import { findKMZForProject, parseKMZFile } from '@/lib/kmz'
import { prisma } from '@/lib/db'
import * as path from 'path'
import * as fs from 'fs'

const cache = new Map<string, { meters: number; fileName: string; ctoCount: number; updatedAt: number }>()
const CACHE_TTL_MS = 30 * 60 * 1000

function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')
}

async function getCityTotal(cityName: string) {
  const key = normalize(cityName)
  const cached = cache.get(key)
  if (cached && Date.now() - cached.updatedAt < CACHE_TTL_MS) return cached

  const filePath = findKMZForProject(cityName)
  if (!filePath) return null

  const result = await parseKMZFile(filePath)
  if (!result.success) return null

  const meters = (result.rawTotalMeters ?? 0) > 0
    ? result.rawTotalMeters!
    : (result.cableMeters ?? 0)

  const entry = { meters, fileName: result.fileName ?? path.basename(filePath), ctoCount: result.ctoCount ?? 0, updatedAt: Date.now() }
  cache.set(key, entry)
  return entry
}

async function getCityTotalsFromDB(cities: string[]): Promise<Record<string, { meters: number; fileName: string; ctoCount: number } | null>> {
  const projects = await prisma.project.findMany({
    where: { trelloListName: { in: cities }, trelloCardId: { not: null } },
    select: { trelloListName: true, kmzFileName: true, cableMeters: true, ctoCount: true },
  })

  const results: Record<string, { meters: number; fileName: string; ctoCount: number } | null> = {}

  for (const city of cities) {
    const cityProjects = projects.filter(p => p.trelloListName === city)
    if (cityProjects.length === 0) { results[city] = null; continue }

    const totalMeters = cityProjects.reduce((s, p) => s + (p.cableMeters ?? 0), 0)
    const totalCtos = cityProjects.reduce((s, p) => s + (p.ctoCount ?? 0), 0)
    const fileName = cityProjects.find(p => p.kmzFileName)?.kmzFileName ?? ''

    results[city] = totalMeters > 0 || totalCtos > 0
      ? { meters: totalMeters, fileName, ctoCount: totalCtos }
      : null
  }

  return results
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const citiesParam = searchParams.get('cities')
  if (!citiesParam) return NextResponse.json({ error: 'Parâmetro "cities" obrigatório' }, { status: 400 })

  const cities = citiesParam.split(',').map(c => decodeURIComponent(c.trim())).filter(Boolean)
  const basePath = process.env.KMZ_BASE_PATH

  // Production mode: no local KMZ files — serve from database
  if (!basePath || !fs.existsSync(basePath)) {
    const dbResults = await getCityTotalsFromDB(cities)
    return NextResponse.json(dbResults)
  }

  // Development mode: parse KMZ files from local drive
  const results: Record<string, { meters: number; fileName: string; ctoCount: number } | null> = {}
  await Promise.allSettled(
    cities.map(async city => {
      try { results[city] = await getCityTotal(city) } catch { results[city] = null }
    })
  )
  return NextResponse.json(results)
}
