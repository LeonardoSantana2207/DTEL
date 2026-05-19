import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { parseKMZFile, findKMZForProject } from '@/lib/kmz'

export async function POST(req: NextRequest) {
  const { projectId, filePath, auto } = await req.json()

  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })

  let targetPath = filePath ?? project.kmzFilePath

  // Auto-search by project name / code
  if (auto && !targetPath) {
    targetPath = findKMZForProject(project.name, project.code)
  }

  if (!targetPath) {
    return NextResponse.json({
      success: false,
      error: 'Nenhum arquivo KMZ encontrado. Informe o caminho manualmente ou verifique o Drive.',
    })
  }

  const result = await parseKMZFile(targetPath)

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error })
  }

  // Persist to database
  const updated = await prisma.project.update({
    where: { id: projectId },
    data: {
      kmzFilePath: result.filePath,
      kmzFileName: result.fileName,
      cableMeters: result.cableMeters,
      ctoCount: result.ctoCount,
      kmzRawAreas: JSON.stringify(result.areas ?? {}),
      kmzLastParsed: new Date(),
    },
  })

  // Create/update fusions for each CTO
  if (result.ctoCount && result.ctoCount > 0) {
    const existingFusions = await prisma.fusion.count({
      where: { projectId, type: 'CTO' },
    })
    if (existingFusions < result.ctoCount) {
      const toCreate = result.ctoCount - existingFusions
      await prisma.fusion.createMany({
        data: Array.from({ length: toCreate }, (_, i) => ({
          projectId,
          type: 'CTO',
          ctoName: `CTO-${String(existingFusions + i + 1).padStart(2, '0')}`,
        })),
      })
    }
  }

  // Ensure splice box fusion exists
  const spliceBox = await prisma.fusion.findFirst({
    where: { projectId, type: 'SPLICE_BOX' },
  })
  if (!spliceBox) {
    await prisma.fusion.create({
      data: { projectId, type: 'SPLICE_BOX', ctoName: 'Caixa de emenda' },
    })
  }

  // Mark checklist steps as done
  await prisma.checklistItem.updateMany({
    where: { projectId, step: 'KMZ_LOCATED' },
    data: { completed: true, completedAt: new Date() },
  })
  await prisma.checklistItem.updateMany({
    where: { projectId, step: 'CABLE_MEASURED' },
    data: { completed: true, completedAt: new Date() },
  })
  await prisma.checklistItem.updateMany({
    where: { projectId, step: 'CTO_COUNTED' },
    data: { completed: true, completedAt: new Date() },
  })

  // Log
  await prisma.activityLog.create({
    data: {
      projectId,
      action: `KMZ processado: ${result.cableMeters?.toFixed(0)}m, ${result.ctoCount} CTOs`,
      source: 'SYSTEM',
    },
  })

  return NextResponse.json({
    success: true,
    project: {
      ...updated,
      kmzRawAreas: result.areas,
    },
  })
}
