import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const { name, nickname, avatarColor, role, active } = body

  const collaborator = await prisma.collaborator.update({
    where: { id: params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(nickname !== undefined && { nickname }),
      ...(avatarColor !== undefined && { avatarColor }),
      ...(role !== undefined && { role }),
      ...(active !== undefined && { active }),
    },
  })
  return NextResponse.json(collaborator)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const existing = await prisma.collaborator.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

  // Remove all project assignments first
  await prisma.projectCollaborator.deleteMany({ where: { collaboratorId: params.id } })
  await prisma.collaborator.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
