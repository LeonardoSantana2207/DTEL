import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { step, completed, collaboratorId } = await req.json()

  const item = await prisma.checklistItem.update({
    where: { projectId_step: { projectId: params.id, step } },
    data: {
      completed,
      completedAt: completed ? new Date() : null,
      completedById: completed ? (collaboratorId || null) : null,
    },
    include: { completedBy: true },
  })

  // Log
  await prisma.activityLog.create({
    data: {
      projectId: params.id,
      action: `Checklist: "${step}" ${completed ? 'marcado' : 'desmarcado'}`,
      source: 'MANUAL',
      authorName: item.completedBy?.name ?? null,
    },
  })

  return NextResponse.json(item)
}
