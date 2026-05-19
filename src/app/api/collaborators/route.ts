import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const collaborators = await prisma.collaborator.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(collaborators)
}

export async function POST(req: NextRequest) {
  const { name, nickname, avatarColor, role } = await req.json()
  if (!name) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })

  const initials = name.split(' ').filter(Boolean).slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()

  const collaborator = await prisma.collaborator.create({
    data: { name, nickname, avatarColor: avatarColor ?? '#006734', initials, role: role ?? 'TECHNICIAN' },
  })
  return NextResponse.json(collaborator, { status: 201 })
}
