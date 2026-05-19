import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const INCLUDE_ALL = {
  collaborators: { include: { collaborator: true } },
  checklistItems: { include: { completedBy: true }, orderBy: { stepOrder: 'asc' as const } },
  fusions: { include: { responsible: true }, orderBy: { createdAt: 'asc' as const } },
  activityLogs: { orderBy: { createdAt: 'desc' as const }, take: 50 },
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(req.url)
  const include = searchParams.get('include')

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: include === 'all' ? INCLUDE_ALL as Record<string, unknown> : {},
  })

  if (!project) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })

  return NextResponse.json({
    ...project,
    trelloLabels: project.trelloLabels ? JSON.parse(project.trelloLabels) : null,
    kmzRawAreas: project.kmzRawAreas ? JSON.parse(project.kmzRawAreas) : null,
    trelloAreaData: project.trelloAreaData ? JSON.parse(project.trelloAreaData) : null,
  })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const {
    name, code, locality, status, notes, dueDate, kanbanOrder,
    launcherIds, cableMeters,
  } = body

  const existing = await prisma.project.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'Projeto não encontrado' }, { status: 404 })

  // Build update data
  const updateData: Record<string, unknown> = {}
  if (name !== undefined) updateData.name = name
  if (code !== undefined) updateData.code = code
  if (locality !== undefined) updateData.locality = locality
  if (status !== undefined) updateData.status = status
  if (notes !== undefined) updateData.notes = notes
  if (kanbanOrder !== undefined) updateData.kanbanOrder = kanbanOrder
  if (cableMeters !== undefined) updateData.cableMeters = cableMeters
  if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null

  const project = await prisma.project.update({
    where: { id: params.id },
    data: updateData,
  })

  // Update launcher collaborators
  if (launcherIds !== undefined) {
    await prisma.projectCollaborator.deleteMany({
      where: { projectId: params.id, role: 'LAUNCHER' },
    })
    if (launcherIds.length > 0) {
      const meters = (project.cableMeters ?? 0) / launcherIds.length
      await prisma.projectCollaborator.createMany({
        data: launcherIds.map((id: string) => ({
          projectId: project.id,
          collaboratorId: id,
          role: 'LAUNCHER',
          metersAssigned: meters,
          percentage: 100 / launcherIds.length,
        })),
      })
    }
  }

  // Log status change
  if (status && status !== existing.status) {
    await prisma.activityLog.create({
      data: {
        projectId: params.id,
        action: `Status alterado para "${status}"`,
        details: JSON.stringify({ from: existing.status, to: status }),
        source: 'MANUAL',
      },
    })
  }

  const full = await prisma.project.findUnique({
    where: { id: params.id },
    include: INCLUDE_ALL as Record<string, unknown>,
  })

  return NextResponse.json({
    ...full,
    trelloLabels: full?.trelloLabels ? JSON.parse(full.trelloLabels) : null,
    kmzRawAreas: full?.kmzRawAreas ? JSON.parse(full.kmzRawAreas) : null,
    trelloAreaData: full?.trelloAreaData ? JSON.parse(full.trelloAreaData) : null,
  })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({ where: { id: params.id } })
  if (!project) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  await prisma.project.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
