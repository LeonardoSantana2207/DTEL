import JSZip from 'jszip'
import { XMLParser } from 'fast-xml-parser'
import * as fs from 'fs'
import * as path from 'path'
import type { KmzParseResult } from '@/types'

// ─── Haversine ───────────────────────────────────────────────────────────────

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const rad = (x: number) => (x * Math.PI) / 180
  const dLat = rad(lat2 - lat1)
  const dLon = rad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function lineStringLength(coordStr: string): number {
  const pts = coordStr
    .trim()
    .split(/\s+/)
    .map(p => p.split(','))
    .filter(p => p.length >= 2)
    .map(([lon, lat]) => [+lon, +lat])
    .filter(([, lat]) => !isNaN(lat))
  let total = 0
  for (let i = 1; i < pts.length; i++)
    total += haversine(pts[i - 1][1], pts[i - 1][0], pts[i][1], pts[i][0])
  return total
}

// ─── KML Parser ──────────────────────────────────────────────────────────────

function extractFolderBlock(kml: string, startPos: number): string | null {
  let depth = 1
  let pos = startPos + 8
  while (depth > 0 && pos < kml.length) {
    const open = kml.indexOf('<Folder>', pos)
    const close = kml.indexOf('</Folder>', pos)
    if (close === -1) return null
    if (open !== -1 && open < close) {
      depth++
      pos = open + 8
    } else {
      depth--
      pos = close + 9
    }
  }
  return kml.slice(startPos, pos)
}

// Extrai código de área de nomes de pasta KMZ:
// "AAA", "ABK" → direto
// "Área 1 - AAA", "Área 1 - AAA*" → extrai o código
function extractAreaCode(folderName: string): string | null {
  const name = folderName.trim()
  if (/^[A-Z]{2,4}$/.test(name)) return name
  const m = name.match(/[áa]rea\s+\d+\s*[-–]\s*([A-Z]{2,4})\*?/i)
  return m ? m[1] : null
}

function parseKMLAreas(kml: string): Record<string, number> {
  const areas: Record<string, number> = {}
  let pos = 0

  while (pos < kml.length) {
    const fStart = kml.indexOf('<Folder>', pos)
    if (fStart === -1) break

    const nStart = kml.indexOf('<name>', fStart + 8)
    const nEnd = nStart > -1 ? kml.indexOf('</name>', nStart) : -1
    const nextF = kml.indexOf('<Folder>', fStart + 8)

    if (nStart === -1 || nEnd === -1 || (nextF !== -1 && nStart > nextF)) {
      pos = fStart + 8
      continue
    }

    const name = kml.slice(nStart + 6, nEnd).trim()
    const code = extractAreaCode(name)

    if (code) {
      const block = extractFolderBlock(kml, fStart)
      if (!block) { pos = fStart + 8; continue }

      let total = 0
      const coordRe = /<coordinates>([\s\S]*?)<\/coordinates>/g
      let m: RegExpExecArray | null
      while ((m = coordRe.exec(block)) !== null) {
        const pts = m[1].trim().split(/\s+/).filter(p => p.includes(','))
        if (pts.length > 1) total += lineStringLength(m[1])
      }
      if (total > 0) areas[code] = (areas[code] ?? 0) + total
      pos = fStart + block.length
    } else {
      pos = fStart + 8
    }
  }
  return areas
}

function countCTOs(kml: string): number {
  // Conta Placemarks que tenham "CTO" no nome
  const placemarkRe = /<Placemark>([\s\S]*?)<\/Placemark>/gi
  let count = 0
  let m: RegExpExecArray | null
  while ((m = placemarkRe.exec(kml)) !== null) {
    const block = m[1]
    const nameMatch = block.match(/<name>([\s\S]*?)<\/name>/i)
    if (nameMatch) {
      const n = nameMatch[1].trim()
      // CTO-01, CTO 01, CTO_01, CTO01, etc.
      if (/\bCTO\b/i.test(n)) count++
    }
    // Também verifica styleUrl ou description
    if (!nameMatch) {
      const styleMatch = block.match(/<styleUrl>([\s\S]*?)<\/styleUrl>/i)
      if (styleMatch && /cto/i.test(styleMatch[1])) count++
    }
  }
  return count
}

// ─── Soma bruta de todos os LineStrings do KML ───────────────────────────────

function parseTotalLineStringMeters(kml: string): number {
  let total = 0
  const coordRe = /<coordinates>([\s\S]*?)<\/coordinates>/g
  let m: RegExpExecArray | null
  while ((m = coordRe.exec(kml)) !== null) {
    const pts = m[1].trim().split(/\s+/).filter(p => p.includes(','))
    if (pts.length > 1) total += lineStringLength(m[1])
  }
  return total
}

// ─── KMZ Parse ───────────────────────────────────────────────────────────────

export async function parseKMZBuffer(buffer: Buffer): Promise<{
  areas: Record<string, number>
  ctoCount: number
  totalMeters: number
  rawTotalMeters: number
}> {
  const zip = await JSZip.loadAsync(buffer)
  const kmlFile = Object.keys(zip.files).find(f => f.endsWith('.kml'))
  if (!kmlFile) throw new Error('Nenhum arquivo KML encontrado no KMZ')

  const kml = await zip.files[kmlFile].async('string')
  const areas = parseKMLAreas(kml)
  const totalMeters = Object.values(areas).reduce((s, v) => s + v, 0)
  const rawTotalMeters = parseTotalLineStringMeters(kml)
  const ctoCount = countCTOs(kml)

  return { areas, ctoCount, totalMeters, rawTotalMeters }
}

// ─── Busca de KMZ no Drive local ─────────────────────────────────────────────

const NORM = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')

function collectKmzFiles(dir: string, maxDepth: number): string[] {
  if (maxDepth <= 0) return []
  const results: string[] = []
  try {
    const entries = fs.readdirSync(dir)
    for (const entry of entries) {
      if (/^(celpe|neoenergia|neoenerg|ação|acao|orçamento|orcamento|planilha|documento|condominios?|nox|abordagem)/i.test(entry)) continue
      const full = path.join(dir, entry)
      try {
        const stat = fs.statSync(full)
        if (stat.isDirectory()) {
          results.push(...collectKmzFiles(full, maxDepth - 1))
        } else if (entry.toLowerCase().endsWith('.kmz')) {
          results.push(full)
        }
      } catch { /* skip */ }
    }
  } catch { /* skip */ }
  return results
}

// ─── Áreas Detalhadas ────────────────────────────────────────────────────────

const SKIP_DIRS = /^(celpe|neoenergia|planilha|documento|condominios?|nox|verificacao|acao|orcamento|arquivos?anteriores?|arquivos?antigos?|antigos?|backup|old|eletrico|engenharia|acesso|permissao)/

// Totalmente assíncrono para não bloquear o event loop no drive de rede
async function collectAreasDetalhadasDirsAsync(dir: string, maxDepth: number): Promise<string[]> {
  if (maxDepth <= 0) return []
  const results: string[] = []
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true })
    const subdirs = entries.filter(e => e.isDirectory())
    await Promise.all(subdirs.map(async entry => {
      const n = NORM(entry.name)
      const full = path.join(dir, entry.name)
      if (/areadet|areasdet|areasd/.test(n.replace(/\s/g, ''))) {
        results.push(full)
      } else if (!SKIP_DIRS.test(n)) {
        const sub = await collectAreasDetalhadasDirsAsync(full, maxDepth - 1)
        results.push(...sub)
      }
    }))
  } catch { /* skip */ }
  return results
}

function extractCodeFromAreaFilename(filename: string): string | null {
  const base = path.basename(filename, path.extname(filename))
  const m = base.match(/[áa]rea\s*\d+\s*[-–\s]+([A-Z]{2,5})\s*$/i)
  if (m) return m[1].toUpperCase()
  const bare = base.trim()
  if (/^[A-Z]{2,5}$/i.test(bare)) return bare.toUpperCase()
  return null
}

async function parseOneAreaFile(dir: string, file: string): Promise<{ code: string; meters: number; ctos: number } | null> {
  const code = extractCodeFromAreaFilename(file)
  if (!code) return null
  try {
    const full = path.join(dir, file)
    let meters = 0
    let ctos = 0
    if (file.toLowerCase().endsWith('.kmz')) {
      const buf = await fs.promises.readFile(full)
      const { rawTotalMeters, ctoCount } = await parseKMZBuffer(buf)
      meters = rawTotalMeters
      ctos = ctoCount
    } else {
      const kml = await fs.promises.readFile(full, 'utf8')
      meters = parseTotalLineStringMeters(kml)
      ctos = countCTOs(kml)
    }
    if (meters <= 0 && ctos <= 0) return null
    return { code, meters, ctos }
  } catch { return null }
}

export interface AreasDetalhadasResult {
  areas: Record<string, number>   // código → metros
  ctos: Record<string, number>    // código → quantidade de CTOs
  areasDirPath: string | null     // caminho da pasta Áreas Detalhadas
}

export async function parseAreasDetalhadasForCity(cityDir: string): Promise<AreasDetalhadasResult> {
  const areas: Record<string, number> = {}
  const ctos: Record<string, number> = {}
  const dirs = await collectAreasDetalhadasDirsAsync(cityDir, 4)

  const allFiles: { dir: string; file: string }[] = []
  await Promise.all(dirs.map(async dir => {
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true })
      for (const e of entries) {
        if (!e.isDirectory() && /\.(kmz|kml)$/i.test(e.name)) allFiles.push({ dir, file: e.name })
      }
    } catch { /* skip */ }
  }))

  const BATCH = 15
  for (let i = 0; i < allFiles.length; i += BATCH) {
    const batch = allFiles.slice(i, i + BATCH)
    const results = await Promise.allSettled(batch.map(({ dir, file }) => parseOneAreaFile(dir, file)))
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        areas[r.value.code] = r.value.meters
        if (r.value.ctos > 0) ctos[r.value.code] = r.value.ctos
      }
    }
  }

  return { areas, ctos, areasDirPath: dirs[0] ?? null }
}

// ─── Localiza pasta da cidade ─────────────────────────────────────────────────

export function findCityDir(cityName: string, code?: string | null): string | null {
  const basePath = process.env.KMZ_BASE_PATH
  if (!basePath || !fs.existsSync(basePath)) return null

  const normName = NORM(cityName.replace(/^rede\s+ftth\s+/i, ''))
  const normCode = code ? NORM(code) : null

  let cityDir: string | null = null
  let bestScore = 0

  try {
    const cities = fs.readdirSync(basePath).filter(c => {
      try { return fs.statSync(path.join(basePath, c)).isDirectory() } catch { return false }
    })

    for (const city of cities) {
      const normCity = NORM(city.replace(/^rede\s+ftth\s+/i, ''))
      if (normCity.length < 3) continue

      const nameInCity = normCity.includes(normName) && normName.length >= 3
      const cityInName = normName.includes(normCity) && normCity.length >= 3
      const codeMatch = normCode ? (normCity.includes(normCode) || normCode.includes(normCity)) : false

      if (!nameInCity && !cityInName && !codeMatch) continue

      const score = normCity === normName ? 10 : nameInCity ? 6 : cityInName ? 4 : 2
      if (score > bestScore) {
        bestScore = score
        cityDir = path.join(basePath, city)
      }
    }
  } catch { return null }

  return cityDir
}

export function findKMZForProject(
  projectName: string,
  code?: string | null
): string | null {
  const cityDir = findCityDir(projectName, code)
  if (!cityDir) return null

  // Busca recursiva de arquivos KMZ na pasta da cidade
  const allKmz = collectKmzFiles(cityDir, 4)
  if (!allKmz.length) return null

  const normName = NORM(projectName.replace(/^rede\s+ftth\s+/i, ''))

  // Pontua e escolhe o melhor KMZ para representar a rede de cabos da cidade
  const cityDirLower = cityDir.toLowerCase()

  const scored = allKmz.map(f => {
    const baseName = path.basename(f).toLowerCase()
    const relPath = f.toLowerCase().replace(cityDirLower, '').split(path.sep).filter(Boolean)
    let score = 0

    // Conteúdo do nome
    if (/cabos/.test(baseName)) score += 30
    if (/ftth/.test(baseName)) score += 15
    if (/rede/.test(baseName)) score += 8
    if (normName && baseName.replace(/[^a-z0-9]/g, '').includes(normName)) score += 12

    // Posição na árvore de pastas
    const inKmzDir = relPath[0] === 'kmz'
    if (inKmzDir && relPath.length === 2) score += 25  // diretamente em /KMZ/
    else if (inKmzDir) score += 12                      // em /KMZ/subpasta/
    if (/atualiz/.test(f.toLowerCase())) score += 10   // FTTH ATUALIZADO

    // Tamanho do arquivo (arquivo maior = mais dados de rede)
    try { score += Math.min(15, Math.floor(fs.statSync(f).size / 30000)) } catch { /* skip */ }

    // Penaliza arquivos que parecem ser de outras finalidades
    if (/arquivo.anterior|antigo|backup|old/i.test(f)) score -= 15

    return { f, score }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored[0]?.f ?? null
}

export async function parseKMZFile(filePath: string): Promise<KmzParseResult> {
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, error: `Arquivo não encontrado: ${filePath}` }
    }
    const buffer = fs.readFileSync(filePath)
    const { areas, ctoCount, totalMeters, rawTotalMeters } = await parseKMZBuffer(buffer)

    return {
      success: true,
      fileName: path.basename(filePath),
      filePath,
      cableMeters: totalMeters > 0 ? totalMeters : rawTotalMeters,
      ctoCount,
      areas,
      rawTotalMeters,
    }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro ao processar KMZ' }
  }
}
