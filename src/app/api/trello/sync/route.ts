import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { fetchLists, fetchCards, fetchBoardChecklists } from '@/lib/trello'
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
// Formatos encontrados no board:
// "AAA - EQUIPE: Daniel - DATA DE EXECUÇÃO: 03/09/2024"
// "AAA - - EQUIPE: Daniel - DATA DE EXECUÇÃO: ..."   (duplo traço)
// "AAA: SPLITTER: Daniel - DATA DE EXECUÇÃO: ..."     (colon + SPLITTER)
// "AAA - SPLITTER - EQUIPE: Daniel - DATA: ..."       (SPLITTER como tipo)
// "CEO-10: - EQUIPE: Diego - DATA DE EXECUÇÃO: ..."   (código com traço+número)
// "¹CEO-06: EQUIPE: Diego - DATA DE EXECUÇÃO: ..."    (prefixo superscript)
// "DIO 144 EQUIPE: Diego // DATA DE EXECUÇÃO: ..."    (sem traço, "//" separador)
// "AAA - EQUIPE: Diego - DATA DE EXECUÇÃO: 06/12/21"  (ano com 2 dígitos)

function parseCheckItem(text: string): { code: string; team: string; date: string } | null {
  // Remove prefixos especiais: superscripts, espaços
  const clean = text.replace(/^[¹²³⁴⁵⁶⁷⁸⁹\s]+/, '').trim()

  // Extrai código: 2-5 letras maiúsculas, opcionalmente seguidas de -número ou espaço+número
  const codeMatch = clean.match(/^([A-Z]{2,5}(?:[-\s]\d+)?)\s*[-:–\s]/i)
  if (!codeMatch) return null
  const code = codeMatch[1].toUpperCase().replace(/\s+/g, '-')

  // Extrai data (dd/mm/yyyy ou dd/mm/yy)
  const dateMatch = clean.match(/DATA[^:]*:\s*(\d{2}\/\d{2}\/(\d{2}|\d{4}))\b/i)
  if (!dateMatch) return null
  const rawDate = dateMatch[1]
  // Normaliza ano de 2 dígitos: 21 → 2021
  const date = rawDate.length === 8 ? rawDate.slice(0, 6) + '20' + rawDate.slice(6) : rawDate

  // Extrai equipe: o que fica entre o separador do código e o início do DATA
  const afterCode = clean.slice(codeMatch[0].length)
  const dataPos = afterCode.search(/DATA[^:]*:/i)
  if (dataPos === -1) return null

  let teamRaw = afterCode.slice(0, dataPos).trim()
  // Remove sufixo a partir de //
  teamRaw = teamRaw.replace(/\s*\/\/.*$/, '').trim()
  // Remove separadores e keywords em loop (ex: "SPLITTER - EQUIPE: ...")
  for (let i = 0; i < 4; i++) {
    const before = teamRaw
    teamRaw = teamRaw
      .replace(/^[-–\s]+/, '')
      .replace(/^(?:EQUIPE|SPLITTER|FUSÃO|FUSAO)\s*[-–:,]?\s*/i, '')
      .trim()
    if (teamRaw === before) break
  }
  // Remove trailing separators
  teamRaw = teamRaw.replace(/\s*[-–]+\s*$/, '').trim()

  if (!teamRaw || teamRaw.length < 2) return null
  return { code, team: teamRaw, date }
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

// ─── Cache de colaboradores (carregado uma vez por sync) ─────────────────────

const COLORS = ['#006734', '#0a7a3e', '#1a9e52', '#FEBF11', '#3B82F6', '#8B5CF6', '#F97316', '#EF4444']

class CollaboratorCache {
  private map = new Map<string, string>()  // norm name → id
  private colorIdx = 0

  async load() {
    const all = await prisma.collaborator.findMany()
    for (const c of all) {
      this.map.set(normalizeName(c.name), c.id)
      if (c.nickname) this.map.set(normalizeName(c.nickname), c.id)
    }
  }

  find(name: string): string | null {
    if (!name || name.length < 2) return null
    const normInput = normalizeName(name)

    // Exact match
    if (this.map.has(normInput)) return this.map.get(normInput)!

    // Partial match (first name or contained)
    const entries = Array.from(this.map.entries())
    for (const [normDb, id] of entries) {
      if (normDb.includes(normInput) || normInput.includes(normDb)) return id
    }
    return null
  }

  async findOrCreate(name: string): Promise<string | null> {
    if (!name || name.length < 2) return null
    const existing = this.find(name)
    if (existing) return existing

    // Create new collaborator
    const initials = name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
    const color = COLORS[this.colorIdx % COLORS.length]
    this.colorIdx++
    const created = await prisma.collaborator.create({
      data: { name, initials, avatarColor: color, active: true },
    })
    this.map.set(normalizeName(name), created.id)
    return created.id
  }
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

  // Pré-carrega tudo em paralelo antes do loop de cards
  const collabCache = new CollaboratorCache()

  const t0 = Date.now()
  const lists = await fetchLists(boardId)
  const openLists = lists.filter(l => !l.closed)
  console.log(`[sync] fetchLists: ${Date.now()-t0}ms, ${openLists.length} listas`)

  const t1 = Date.now()
  const [, allChecklists, existingProjects, listCards, kmzByCity] = await Promise.all([
    collabCache.load(),
    fetchBoardChecklists(boardId),
    prisma.project.findMany({ select: { id: true, code: true, trelloCardId: true, trelloAreaData: true, status: true, name: true } }),
    Promise.all(
      openLists.map(list =>
        fetchCards(list.id)
          .then(cards => ({ list, cards }))
          .catch(() => ({ list, cards: [] as Awaited<ReturnType<typeof fetchCards>> }))
      )
    ),
    // Carrega todos os KMZs em paralelo
    Promise.all(openLists.map(list => loadKMZForCity(list.name).catch(() => null)))
      .then(results => {
        const m = new Map<string, Awaited<ReturnType<typeof loadKMZForCity>>>()
        openLists.forEach((list, i) => m.set(list.name, results[i]))
        return m
      }),
  ])
  console.log(`[sync] pré-carga paralela: ${Date.now()-t1}ms, ${allChecklists.size} cards com checklist, ${existingProjects.length} projetos no DB`)

  // Map de projetos existentes para lookup O(1)
  const projectByCardId = new Map(existingProjects.map(p => [p.trelloCardId, p]))

  let cardsProcessed = 0
  let projectsCreated = 0
  let projectsUpdated = 0
  const errors: string[] = []

  try {
    for (const { list, cards } of listCards) {
      const cityName = list.name
      const kmzInfo = kmzByCity.get(cityName) ?? null

      for (const card of cards) {
        if (card.closed) continue
        cardsProcessed++

        const isFinished = card.labels?.some(l => /conclu/i.test(l.name)) ?? false
        const parsed = parseCardName(card.name, cityName)
        parsed.isFinished = isFinished

        // Lookup antecipado para preservar metros existentes quando KMZ não está disponível
        const existingByTrelloEarly = projectByCardId.get(card.id) ?? null
        let existingMeters: Record<string, number> = {}
        if (!kmzInfo && existingByTrelloEarly?.trelloAreaData) {
          try {
            const prev = JSON.parse(existingByTrelloEarly.trelloAreaData) as AreaForDB[]
            for (const a of prev) { if (a.meters > 0) existingMeters[a.code] = a.meters }
          } catch { /* ignore */ }
        }

        // Busca checklists
        let areasItems: ParsedArea[] = []
        let cardMeters = 0
        let cardAreas: Record<string, number> = {}

        try {
          const checklists = allChecklists.get(card.id) ?? []
          // Procura checklist "Áreas" (pode ter variações)
          const areasChk = checklists.find(cl =>
            /^[áa]reas?$/i.test(cl.name.trim()) ||
            /^[áa]reas?\s+de\s+lan/i.test(cl.name)
          ) ?? checklists[0]

          if (areasChk) {
            for (const item of areasChk.checkItems) {
              const p = parseCheckItem(item.name)
              if (!p) continue

              const areaMeters = kmzInfo?.areas[p.code] ?? existingMeters[p.code] ?? 0
              if (areaMeters > 0) {
                cardAreas[p.code] = areaMeters
                cardMeters += areaMeters
              }

              const teamMembers = splitTeam(p.team)
              const executorIds: string[] = []
              for (const member of teamMembers) {
                const id = collabCache.find(member)
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
        } catch (e) {
          errors.push(`Falha ao processar checklist do card "${card.name}": ${e}`)
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

        const existingByTrello = existingByTrelloEarly

        let projectId: string

        // Computa se houve mudança antes de decidir escrever no banco
        const newAreaJSON = areaDataForDB.length > 0 ? JSON.stringify(areaDataForDB) : null
        const areasChanged = newAreaJSON !== (existingByTrello?.trelloAreaData ?? null)
        const statusChanged = existingByTrello ? status !== existingByTrello.status : false
        const nameChanged = existingByTrello ? card.name !== existingByTrello.name : false
        const needsUpdate = !existingByTrello || areasChanged || statusChanged || nameChanged

        if (existingByTrello) {
          if (needsUpdate) {
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
                ...(newAreaJSON && { trelloAreaData: newAreaJSON }),
              },
            })
            projectsUpdated++
          }
          projectId = existingByTrello.id
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

        // ── Registra colaboradores lançadores (só se áreas mudaram) ─────────
        if (parsed.type === 'LAUNCH' && areasItems.length > 0 && areasChanged) {
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

            // Resolve IDs first to deduplicate before inserting
            const resolvedCollabs: { collabId: string; stats: typeof collabAreas[string] }[] = []
            const seenIds = new Set<string>()
            for (const [normName, stats] of Object.entries(collabAreas)) {
              const originalName = areasItems
                .flatMap(a => a.teamMembers)
                .find(m => normalizeName(m) === normName) ?? normName
              const collabId = await collabCache.findOrCreate(originalName)
              if (!collabId || seenIds.has(collabId)) continue
              seenIds.add(collabId)
              resolvedCollabs.push({ collabId, stats })
            }

            await prisma.projectCollaborator.createMany({
              data: resolvedCollabs.map(({ collabId, stats }) => {
                const pct = totalMeters > 0
                  ? (stats.meters / totalMeters) * 100
                  : (stats.areas / totalAreas) * 100
                return {
                  projectId,
                  collaboratorId: collabId,
                  role: 'LAUNCHER' as const,
                  metersAssigned: stats.meters > 0 ? stats.meters : null,
                  percentage: pct,
                }
              }),
              skipDuplicates: true,
            })
          }
        }

        // Log apenas para projetos novos ou mudança de status
        if (!existingByTrello || statusChanged) {
          await prisma.activityLog.create({
            data: {
              projectId,
              action: existingByTrello
                ? `Status alterado para "${status}" via Trello`
                : `Projeto criado via sync Trello`,
              source: 'TRELLO',
              details: JSON.stringify({ areas: areasItems.length, done: areasDone }),
            },
          })
        }
      }
    }

    console.log(`[sync] loop DB: ${Date.now()-t1}ms total, ${cardsProcessed} cards, ${projectsCreated} criados, ${projectsUpdated} atualizados`)

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
