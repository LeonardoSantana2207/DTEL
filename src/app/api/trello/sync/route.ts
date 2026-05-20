import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { fetchLists, fetchCards, fetchCardChecklists } from '@/lib/trello'
import { findKMZForProject, parseKMZFile } from '@/lib/kmz'
import { CHECKLIST_STEPS_CONFIG } from '@/types'
import * as fs from 'fs'
import * as path from 'path'

export const maxDuration = 60

// ─── Tipos internos do sync ───────────────────────────────────────────────────

interface ParsedArea {
  code: string                  // "AAA", "AAB"…
  teamRaw: string               // "Daniel Antonio + Severino"
  teamMembers: string[]         // ["Daniel Antonio", "Severino"]
  executorIds: string[]         // IDs dos colaboradores resolvidos
  dateRaw: string               // "03/09/2024"
  done: boolean
  meters: number                // vem do KMZ
}

type AreaForDB = {
  code: string
  team: string
  members: string[]
  executorIds: string[]
  meters: number
  date: string
  done: boolean
  source: 'TRELLO' | 'KMZ' | 'MANUAL'
}

interface ParsedCard {
  city: string                  // nome da lista
  type: 'LAUNCH' | 'FUSION' | 'OTHER'
  routeLabel: string            // "OLT A Rota 1", "OLT B Rota 3"…
  status: string                // status interno do sistema
  isFinished: boolean           // etiqueta verde "Concluída"
}

// ─── Parse do nome do card ────────────────────────────────────────────────────

function parseCardName(cardName: string, listName: string): ParsedCard {
  const n = cardName.trim()

  // Detecta tipo
  const isLaunch = /lan[çc]amento/i.test(n)
  const isFusion = /fus[ãa]o/i.test(n)
  const type: ParsedCard['type'] = isLaunch ? 'LAUNCH' : isFusion ? 'FUSION' : 'OTHER'

  // Extrai rota (ex: "OLT A Rota 1", "OLT B Rota 3", "Rota 2")
  const routeMatch = n.match(/(?:OLT\s+[A-Z\d]+\s+)?Rota\s+\d+/i)
  const routeLabel = routeMatch?.[0]?.trim() ?? ''

  return {
    city: listName,
    type,
    routeLabel,
    status: 'TODO',
    isFinished: false,
  }
}

// ─── Status baseado em labels e tipo ─────────────────────────────────────────

function deriveStatus(
  type: 'LAUNCH' | 'FUSION' | 'OTHER',
  isFinished: boolean,
  areasTotal: number,
  areasDone: number,
): string {
  if (type === 'LAUNCH') {
    if (isFinished || (areasTotal > 0 && areasDone === areasTotal)) return 'LAUNCH_DONE'
    if (areasDone > 0) return 'IN_LAUNCH'
    return 'IN_LAUNCH'
  }
  if (type === 'FUSION') {
    if (isFinished || (areasTotal > 0 && areasDone === areasTotal)) return 'FUSION_DONE'
    if (areasDone > 0) return 'IN_FUSION'
    return 'IN_FUSION'
  }
  return 'TODO'
}

// ─── Parse do item de checklist ───────────────────────────────────────────────
// Formato: "AAA - EQUIPE: Daniel Antonio - DATA DE EXECUÇÃO: 03/09/2024"
// Variações: "AAB- EQUIPE:...", "AAK- EQUIPE: X + Y - DATA..."

const AREA_ITEM_RE = /^([A-Z]{2,4})\s*[-–]\s*EQUIPE:\s*(.+?)\s*[-–]\s*DATA.*?:\s*(\d{2}\/\d{2}\/\d{4})/i

function parseCheckItem(text: string): { code: string; team: string; date: string } | null {
  const m = text.match(AREA_ITEM_RE)
  if (!m) return null
  return { code: m[1].toUpperCase(), team: m[2].trim(), date: m[3] }
}

// ─── Normalização de nomes de colaboradores ───────────────────────────────────

function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')  // remove acentos
    .replace(/\s+/g, ' ')
}

function cleanName(raw: string): string {
  return raw
    .replace(/[()[\]{}:;]/g, '')  // remove parênteses, colchetes, dois-pontos
    .replace(/\s+/g, ' ')
    .trim()
}

function splitTeam(teamRaw: string): string[] {
  return teamRaw
    .split(/\s*[+&,/]\s*|\s+e\s+/i)
    .map(s => cleanName(s))
    .filter(s => s.length >= 2)
}

// ─── Busca ou cria colaborador no banco ───────────────────────────────────────

const COLORS = ['#006734', '#0a7a3e', '#1a9e52', '#FEBF11', '#3B82F6', '#8B5CF6', '#F97316', '#EF4444']
let colorIdx = 0

async function findOrCreateCollaborator(name: string): Promise<string | null> {
  if (!name || name.length < 2) return null

  // Busca todos e faz comparação normalizada
  const all = await prisma.collaborator.findMany()
  const normInput = normalizeName(name)

  // Tenta match exato
  const exact = all.find(c => normalizeName(c.name) === normInput)
  if (exact) return exact.id

  // Tenta match parcial (primeiro nome ou sobrenome)
  const partial = all.find(c => {
    const normDb = normalizeName(c.name)
    return normDb.includes(normInput) || normInput.includes(normDb) ||
      normalizeName(c.nickname ?? '') === normInput
  })
  if (partial) return partial.id

  // Cria novo colaborador
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
  const color = COLORS[colorIdx % COLORS.length]
  colorIdx++

  const created = await prisma.collaborator.create({
    data: {
      name,
      initials,
      avatarColor: color,
      active: true,
    },
  })
  return created.id
}

// ─── KMZ cache por cidade ─────────────────────────────────────────────────────

type KmzCacheEntry = {
  areas: Record<string, number>
  filePath: string
  fileName: string
  ctoCount: number
  rawTotalMeters: number  // soma bruta de todos os LineStrings
}

const kmzCache = new Map<string, KmzCacheEntry>()

async function loadKMZForCity(cityName: string): Promise<KmzCacheEntry | null> {
  const key = normalizeName(cityName)
  if (kmzCache.has(key)) return kmzCache.get(key)!

  const filePath = findKMZForProject(cityName)
  if (!filePath) return null

  const result = await parseKMZFile(filePath)
  if (!result.success) return null

  const entry: KmzCacheEntry = {
    areas: result.areas ?? {},
    filePath,
    fileName: result.fileName ?? path.basename(filePath),
    ctoCount: result.ctoCount ?? 0,
    rawTotalMeters: result.rawTotalMeters ?? 0,
  }
  kmzCache.set(key, entry)
  return entry
}

// ─── Sync principal ───────────────────────────────────────────────────────────

export async function POST() {
  const boardId = process.env.TRELLO_BOARD_ID ?? ''
  if (!boardId || !process.env.TRELLO_KEY) {
    return NextResponse.json({ error: 'Trello não configurado' }, { status: 400 })
  }

  kmzCache.clear()

  let cardsProcessed = 0
  let projectsCreated = 0
  let projectsUpdated = 0
  const errors: string[] = []

  try {
    const lists = await fetchLists(boardId)
    const openLists = lists.filter(l => !l.closed)

    for (const list of openLists) {
      const cityName = list.name

      // Carrega KMZ da cidade (uma vez por lista)
      const kmzInfo = await loadKMZForCity(cityName).catch(() => null)

      // Busca cards da lista
      let cards: Awaited<ReturnType<typeof fetchCards>>
      try {
        cards = await fetchCards(list.id)
      } catch {
        errors.push(`Falha ao buscar cards de "${cityName}"`)
        continue
      }

      for (const card of cards) {
        if (card.closed) continue
        cardsProcessed++

        const isFinished = card.labels?.some(l => /conclu/i.test(l.name)) ?? false
        const parsed = parseCardName(card.name, cityName)
        parsed.isFinished = isFinished

        // Busca checklists
        let areasItems: ParsedArea[] = []
        let cardMeters = 0
        let cardAreas: Record<string, number> = {}

        try {
          const checklists = await fetchCardChecklists(card.id)
          // Procura checklist "Áreas" (pode ter variações)
          const areasChk = checklists.find(cl =>
            /^[áa]reas?$/i.test(cl.name.trim()) ||
            /^[áa]reas?\s+de\s+lan/i.test(cl.name)
          ) ?? checklists[0]

          if (areasChk) {
            for (const item of areasChk.checkItems) {
              const p = parseCheckItem(item.name)
              if (!p) continue

              const areaMeters = kmzInfo?.areas[p.code] ?? 0
              if (areaMeters > 0) {
                cardAreas[p.code] = areaMeters
                cardMeters += areaMeters
              }

              const teamMembers = splitTeam(p.team)
              const executorIds: string[] = []
              for (const member of teamMembers) {
                const id = await findOrCreateCollaborator(member)
                if (id) executorIds.push(id)
              }

              areasItems.push({
                code: p.code,
                teamRaw: p.team,
                teamMembers,
                executorIds,
                dateRaw: p.date,
                done: item.state === 'complete',
                meters: areaMeters,
              })
            }
          }
        } catch {
          errors.push(`Falha ao buscar checklist do card "${card.name}"`)
        }

        const areasDone = areasItems.filter(a => a.done).length
        const areasTotal = areasItems.length
        const status = deriveStatus(parsed.type, isFinished, areasTotal, areasDone)

        // Serializa áreas para salvar no banco
        const areaDataForDB: AreaForDB[] = areasItems.map(a => ({
          code: a.code,
          team: a.teamRaw,
          members: a.teamMembers,
          executorIds: a.executorIds,
          meters: a.meters,
          date: a.dateRaw,
          done: a.done,
          source: 'TRELLO' as const,
        }))

        // Código do projeto: ex "GRV-OLT_A-R1-LANC"
        const cityCode = cityName.replace(/\s+/g, '').slice(0, 5).toUpperCase()
        const routeCode = parsed.routeLabel.replace(/\s+/g, '_').toUpperCase()
        const typeCode = parsed.type === 'LAUNCH' ? 'LANC' : parsed.type === 'FUSION' ? 'FUS' : 'OUT'
        const projectCode = `${cityCode}_${routeCode}_${typeCode}`.replace(/[^A-Z0-9_]/g, '')

        // Cria ou atualiza o projeto
        const existingByTrello = await prisma.project.findFirst({
          where: { trelloCardId: card.id },
        })

        let projectId: string

        if (existingByTrello) {
          await prisma.project.update({
            where: { id: existingByTrello.id },
            data: {
              name: card.name,
              status,
              locality: cityName,
              ...(existingByTrello.code == null && { code: projectCode }),
              trelloListName: list.name,
              trelloCardUrl: card.shortUrl,
              trelloDesc: card.desc,
              trelloLabels: JSON.stringify(card.labels?.map(l => ({ name: l.name, color: l.color ?? 'black' })) ?? []),
              ...(cardMeters > 0 && { cableMeters: cardMeters }),
              ...(Object.keys(cardAreas).length > 0 && { kmzRawAreas: JSON.stringify(cardAreas) }),
              ...(kmzInfo && { kmzFilePath: kmzInfo.filePath, kmzFileName: kmzInfo.fileName, kmzLastParsed: new Date() }),
              ...(areaDataForDB.length > 0 && { trelloAreaData: JSON.stringify(areaDataForDB) }),
            },
          })
          projectId = existingByTrello.id
          projectsUpdated++
        } else {
          const created = await prisma.project.create({
            data: {
              name: card.name,
              code: projectCode,
              locality: cityName,
              status,
              trelloCardId: card.id,
              trelloCardUrl: card.shortUrl,
              trelloListId: list.id,
              trelloListName: list.name,
              trelloBoardId: boardId,
              trelloDesc: card.desc,
              trelloLabels: JSON.stringify(card.labels?.map(l => ({ name: l.name, color: l.color ?? 'black' })) ?? []),
              cableMeters: cardMeters > 0 ? cardMeters : null,
              ctoCount: kmzInfo?.ctoCount ?? null,
              kmzFilePath: kmzInfo?.filePath ?? null,
              kmzFileName: kmzInfo?.fileName ?? null,
              kmzRawAreas: Object.keys(cardAreas).length > 0 ? JSON.stringify(cardAreas) : null,
              kmzLastParsed: kmzInfo ? new Date() : null,
              trelloAreaData: areaDataForDB.length > 0 ? JSON.stringify(areaDataForDB) : null,
            },
          })
          projectId = created.id

          // Cria checklist de produção
          await prisma.checklistItem.createMany({
            data: CHECKLIST_STEPS_CONFIG.map(s => ({
              projectId,
              step: s.step,
              stepOrder: s.order,
              completed: false,
            })),
          })

          // Marca automaticamente KMZ_LOCATED e CABLE_MEASURED se kmz encontrado
          if (kmzInfo) {
            await prisma.checklistItem.updateMany({
              where: { projectId, step: { in: ['KMZ_LOCATED', 'CABLE_MEASURED', 'CTO_COUNTED'] } },
              data: { completed: true, completedAt: new Date() },
            })
          }

          projectsCreated++
        }

        // ── Registra colaboradores lançadores ────────────────────────────────
        if (parsed.type === 'LAUNCH' && areasItems.length > 0) {
          // Coleta colaboradores e suas áreas (com ou sem KMZ)
          const collabAreas: Record<string, { meters: number; areas: number }> = {}

          for (const area of areasItems) {
            if (!area.done) continue
            const membersCount = area.teamMembers.length || 1
            const metersEach = area.meters / membersCount
            for (const memberName of area.teamMembers) {
              const normN = normalizeName(memberName)
              if (!collabAreas[normN]) collabAreas[normN] = { meters: 0, areas: 0 }
              collabAreas[normN].meters += metersEach
              collabAreas[normN].areas += 1
            }
          }

          // Fallback: se nenhuma área concluída, usa todas as áreas
          if (Object.keys(collabAreas).length === 0) {
            for (const area of areasItems) {
              const membersCount = area.teamMembers.length || 1
              const metersEach = area.meters / membersCount
              for (const memberName of area.teamMembers) {
                const normN = normalizeName(memberName)
                if (!collabAreas[normN]) collabAreas[normN] = { meters: 0, areas: 0 }
                collabAreas[normN].meters += metersEach
                collabAreas[normN].areas += 1
              }
            }
          }

          if (Object.keys(collabAreas).length > 0) {
            await prisma.projectCollaborator.deleteMany({
              where: { projectId, role: 'LAUNCHER' },
            })

            const totalMeters = Object.values(collabAreas).reduce((s, v) => s + v.meters, 0)
            const totalAreas = Object.values(collabAreas).reduce((s, v) => s + v.areas, 0)

            for (const [normName, stats] of Object.entries(collabAreas)) {
              const originalName = areasItems
                .flatMap(a => a.teamMembers)
                .find(m => normalizeName(m) === normName) ?? normName

              const collabId = await findOrCreateCollaborator(originalName)
              if (!collabId) continue

              // Percentual baseado em metros (se disponível) ou em áreas
              const pct = totalMeters > 0
                ? (stats.meters / totalMeters) * 100
                : (stats.areas / totalAreas) * 100

              await prisma.projectCollaborator.create({
                data: {
                  projectId,
                  collaboratorId: collabId,
                  role: 'LAUNCHER',
                  metersAssigned: stats.meters > 0 ? stats.meters : null,
                  percentage: pct,
                },
              }).catch(() => {/* ignore duplicate */})
            }
          }
        }

        // ── Log de atividade ──────────────────────────────────────────────────
        await prisma.activityLog.create({
          data: {
            projectId,
            action: `Sincronizado do Trello${kmzInfo ? ` — KMZ: ${kmzInfo.fileName}` : ''}${cardMeters > 0 ? ` — ${Math.round(cardMeters)}m` : ''}`,
            source: 'TRELLO',
            details: JSON.stringify({ areas: areasItems.length, done: areasDone }),
          },
        })
      }
    }

    await prisma.trelloSync.create({
      data: {
        boardId,
        status: 'OK',
        cardsSynced: cardsProcessed,
        cardsCreated: projectsCreated,
        cardsUpdated: projectsUpdated,
        errorDetails: errors.length > 0 ? JSON.stringify(errors.slice(0, 10)) : null,
      },
    })

    return NextResponse.json({
      ok: true,
      cardsSynced: cardsProcessed,
      projectsCreated,
      projectsUpdated,
      errors: errors.slice(0, 5),
    })
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Erro desconhecido'
    await prisma.trelloSync.create({
      data: { boardId, status: 'ERROR', errorDetails: error },
    })
    return NextResponse.json({ error }, { status: 500 })
  }
}

export async function GET() {
  const syncs = await prisma.trelloSync.findMany({
    orderBy: { syncedAt: 'desc' },
    take: 10,
  })
  return NextResponse.json(syncs)
}
