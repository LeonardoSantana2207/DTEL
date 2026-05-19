import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { CHECKLIST_STEPS_CONFIG } from '@/types'

const INCLUDE_ALL = {
  collaborators: { include: { collaborator: true } },
  checklistItems: { include: { completedBy: true }, orderBy: { stepOrder: 'asc' as const } },
  fusions: { include: { responsible: true }, orderBy: { createdAt: 'asc' as const } },
  activityLogs: { orderBy: { createdAt: 'desc' as const }, take: 50 },
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const include = searchParams.get('include')
  const status = searchParams.get('status')

  const where = status ? { status } : {}
  const includeOpts = include === 'all' ? INCLUDE_ALL : {}

  const projects = await prisma.project.findMany({
    where,
    include: includeOpts as Record<string, unknown>,
    orderBy: [{ status: 'asc' }, { kanbanOrder: 'asc' }, { createdAt: 'desc' }],
  })

  return NextResponse.json(
    projects.map(p => ({
      ...p,
      trelloLabels: p.trelloLabels ? JSON.parse(p.trelloLabels) : null,
      kmzRawAreas: p.kmzRawAreas ? JSON.parse(p.kmzRawAreas) : null,
      trelloAreaData: p.trelloAreaData ? JSON.parse(p.trelloAreaData) : null,
    }))
  )
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, code, locality, status = 'TODO', notes, dueDate, launcherIds = [] } = body

  if (!name) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })

  // Check duplicate
  if (code) {
    const existing = await prisma.project.findFirst({ where: { code } })
    if (existing) {
      return NextResponse.json({ error: `Projeto com código "${code}" já existe` }, { status: 409 })
    }
  }

  const project = await prisma.project.create({
    data: {
      name,
      code: code || null,
      locality: locality || null,
      status,
      notes: notes || null,
      dueDate: dueDate ? new Date(dueDate) : null,
    },
  })

  // Create checklist items
  await prisma.checklistItem.createMany({
    data: CHECKLIST_STEPS_CONFIG.map(s => ({
      projectId: project.id,
      step: s.step,
      stepOrder: s.order,
      completed: false,
    })),
  })

  // Set launcher collaborators
  if (launcherIds.length > 0) {
    const metersEach = (project.cableMeters ?? 0) / launcherIds.length
    await prisma.projectCollaborator.createMany({
      data: launcherIds.map((id: string) => ({
        projectId: project.id,
        collaboratorId: id,
        role: 'LAUNCHER',
        metersAssigned: metersEach,
        percentage: 100 / launcherIds.length,
      })),
    })
  }

  // Log
  await prisma.activityLog.create({
    data: {
      projectId: project.id,
      action: `Projeto "${name}" criado`,
      source: 'MANUAL',
    },
  })

  const full = await prisma.project.findUnique({
    where: { id: project.id },
    include: INCLUDE_ALL as Record<string, unknown>,
  })

  return NextResponse.json({
    ...full,
    trelloLabels: full?.trelloLabels ? JSON.parse(full.trelloLabels) : null,
    kmzRawAreas: full?.kmzRawAreas ? JSON.parse(full.kmzRawAreas) : null,
  }, { status: 201 })
}
