import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { findCityDir, parseAreasDetalhadasForCity } from '@/lib/kmz'

export const maxDuration = 60

// POST /api/kmz/parse
// Lê as Áreas Detalhadas da cidade do projeto e popula metros (+16%), CTOs e área-por-área no DB
export async function POST(req: NextRequest) {
  const { projectId } = await req.json()

  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })

  if (!process.env.KMZ_BASE_PATH) {
    return NextResponse.json({ success: false, error: 'KMZ_BASE_PATH não configurado (rode localmente)' })
  }

  const cityDir = findCityDir(project.locality ?? project.name, project.code)
  if (!cityDir) {
    return NextResponse.json({
      success: false,
      error: `Pasta da cidade não encontrada no Drive para "${project.locality ?? project.name}"`,
    })
  }

  const { areas, ctos, areasDirPath } = await parseAreasDetalhadasForCity(cityDir)

  if (Object.keys(areas).length === 0) {
    return NextResponse.json({
      success: false,
      error: `Nenhuma área encontrada em "Áreas Detalhadas" para ${project.locality ?? project.name}`,
    })
  }

  // Total metros das áreas + 16% de folga técnica
  const rawTotal = Object.values(areas).reduce((s, v) => s + v, 0)
  const cableMeters = Math.round(rawTotal * 1.16)

  // Total CTOs somando todas as áreas
  const ctoCount = Object.values(ctos).reduce((s, v) => s + v, 0)

  // Atualiza metros e CTOs por área no trelloAreaData existente
  let updatedAreaData: string | null = project.trelloAreaData ?? null
  if (project.trelloAreaData) {
    try {
      type AreaItem = { code: string; meters?: number; ctoCount?: number; [key: string]: unknown }
      const existing = JSON.parse(project.trelloAreaData) as AreaItem[]
      const updated = existing.map(a => ({
        ...a,
        ...(areas[a.code] !== undefined && { meters: areas[a.code] }),
        ...(ctos[a.code] !== undefined && { ctoCount: ctos[a.code] }),
      }))
      updatedAreaData = JSON.stringify(updated)
    } catch { /* mantém existente */ }
  }

  const updatedProject = await prisma.project.update({
    where: { id: projectId },
    data: {
      kmzFilePath: areasDirPath ?? cityDir,
      kmzFileName: `Áreas Detalhadas (${Object.keys(areas).length} áreas)`,
      cableMeters,
      ...(ctoCount > 0 && { ctoCount }),
      kmzRawAreas: JSON.stringify(areas),
      kmzLastParsed: new Date(),
      ...(updatedAreaData && { trelloAreaData: updatedAreaData }),
    },
  })

  // Cria fusions de CTO se não existirem
  if (ctoCount > 0) {
    const existingFusions = await prisma.fusion.count({ where: { projectId, type: 'CTO' } })
    if (existingFusions < ctoCount) {
      await prisma.fusion.createMany({
        data: Array.from({ length: ctoCount - existingFusions }, (_, i) => ({
          projectId,
          type: 'CTO' as const,
          ctoName: `CTO-${String(existingFusions + i + 1).padStart(2, '0')}`,
        })),
      })
    }
  }

  // Garante caixa de emenda
  const spliceBox = await prisma.fusion.findFirst({ where: { projectId, type: 'SPLICE_BOX' } })
  if (!spliceBox) {
    await prisma.fusion.create({ data: { projectId, type: 'SPLICE_BOX', ctoName: 'Caixa de emenda' } })
  }

  // Marca etapas do checklist de produção
  await prisma.checklistItem.updateMany({
    where: { projectId, step: { in: ['KMZ_LOCATED', 'CABLE_MEASURED', 'CTO_COUNTED'] } },
    data: { completed: true, completedAt: new Date() },
  })

  await prisma.activityLog.create({
    data: {
      projectId,
      action: `Áreas Detalhadas processadas: ${Object.keys(areas).length} áreas, ${cableMeters}m total (+16%), ${ctoCount} CTOs`,
      source: 'SYSTEM',
    },
  })

  return NextResponse.json({
    success: true,
    project: { ...updatedProject, kmzRawAreas: areas },
  })
}
