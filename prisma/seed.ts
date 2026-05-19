import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const COLLABORATORS = [
  { name: 'Carlos Fernando', initials: 'CF', avatarColor: '#006734', role: 'LAUNCHER' },
  { name: 'Daniel José',     initials: 'DJ', avatarColor: '#0a7a3e', role: 'LAUNCHER' },
  { name: 'Daniel China',    initials: 'DC', avatarColor: '#1a9e52', role: 'LAUNCHER' },
  { name: 'Roberto',         initials: 'RO', avatarColor: '#8B5CF6', role: 'FUSION' },
  { name: 'Valdir',          initials: 'VA', avatarColor: '#7C3AED', role: 'FUSION' },
  { name: 'Diego',           initials: 'DI', avatarColor: '#6D28D9', role: 'FUSION' },
  { name: 'Eron',            initials: 'ER', avatarColor: '#5B21B6', role: 'FUSION' },
]

async function main() {
  console.log('Seeding collaborators...')
  for (const c of COLLABORATORS) {
    const existing = await prisma.collaborator.findFirst({ where: { name: c.name } })
    if (existing) { console.log(`  skip ${c.name} (already exists)`); continue }
    await prisma.collaborator.create({
      data: { name: c.name, initials: c.initials, avatarColor: c.avatarColor, role: c.role, active: true },
    })
    console.log(`  + ${c.name} (${c.role})`)
  }
  console.log('Done.')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
