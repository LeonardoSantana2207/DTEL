'use client'

import { useState } from 'react'
import { FileSearch, RefreshCw, CheckCircle, AlertCircle, Folder } from 'lucide-react'
import type { Project } from '@/types'
import { formatMeters, formatDate } from '@/lib/utils'

interface Props {
  project: Project
  onUpdate: (p: Project) => void
}

export default function KmzDataPanel({ project, onUpdate }: Props) {
  const [parsing, setParsing] = useState(false)
  const [searching, setSearching] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  async function handleSearch() {
    setSearching(true)
    setMessage(null)
    try {
      const res = await fetch('/api/kmz/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, auto: true }),
      })
      const data = await res.json()
      if (data.success) {
        onUpdate({ ...project, ...data.project })
        setMessage({ type: 'ok', text: `KMZ encontrado: ${data.project.kmzFileName}` })
      } else {
        setMessage({ type: 'err', text: data.error ?? 'KMZ não encontrado automaticamente' })
      }
    } catch {
      setMessage({ type: 'err', text: 'Erro ao buscar KMZ' })
    } finally {
      setSearching(false)
    }
  }

  async function handleReparse() {
    if (!project.kmzFilePath) return
    setParsing(true)
    setMessage(null)
    try {
      const res = await fetch('/api/kmz/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, filePath: project.kmzFilePath }),
      })
      const data = await res.json()
      if (data.success) {
        onUpdate({ ...project, ...data.project })
        setMessage({ type: 'ok', text: 'Dados recalculados com sucesso!' })
      } else {
        setMessage({ type: 'err', text: data.error ?? 'Erro ao processar KMZ' })
      }
    } catch {
      setMessage({ type: 'err', text: 'Erro ao processar KMZ' })
    } finally {
      setParsing(false)
    }
  }

  const hasKmz = !!project.kmzFilePath || !!project.cableMeters
  const areas = project.kmzRawAreas ?? {}
  const areaEntries = Object.entries(areas).sort(([, a], [, b]) => b - a)

  return (
    <div className="space-y-4">
      {/* Status banner */}
      {!hasKmz ? (
        <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertCircle size={18} className="text-amber-500 flex-shrink-0" />
          <div>
            <div className="text-[13px] font-semibold text-amber-800">KMZ não vinculado</div>
            <div className="text-[11px] text-amber-600">
              Clique em &quot;Buscar KMZ&quot; para localizar automaticamente no Drive
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 p-3 bg-[#f0faf4] border border-[#d4e8dc] rounded-xl">
          <CheckCircle size={18} className="text-[#006734] flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-[#006734]">KMZ vinculado</div>
            <div className="text-[11px] text-[#3a6347] truncate">
              {project.kmzFileName ?? project.kmzFilePath}
            </div>
          </div>
        </div>
      )}

      {/* KMZ metrics */}
      {hasKmz && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border border-[#e4eee8] rounded-xl p-4 text-center">
            <div className="text-[24px] font-bold text-[#006734]">
              {formatMeters(project.cableMeters)}
            </div>
            <div className="text-[11px] text-[#6b8f74] mt-1 uppercase tracking-wide font-semibold">
              Cabo total
            </div>
          </div>
          <div className="bg-white border border-[#e4eee8] rounded-xl p-4 text-center">
            <div className="text-[24px] font-bold text-[#006734]">
              {project.ctoCount ?? '—'}
            </div>
            <div className="text-[11px] text-[#6b8f74] mt-1 uppercase tracking-wide font-semibold">
              CTOs
            </div>
          </div>
          <div className="bg-white border border-[#e4eee8] rounded-xl p-4 text-center">
            <div className="text-[24px] font-bold text-[#3a6347]">
              {project.spliceBoxes}
            </div>
            <div className="text-[11px] text-[#6b8f74] mt-1 uppercase tracking-wide font-semibold">
              Caixa de emenda
            </div>
          </div>
          {project.kmzLastParsed && (
            <div className="bg-white border border-[#e4eee8] rounded-xl p-4 text-center">
              <div className="text-[14px] font-bold text-[#3a6347]">
                {formatDate(project.kmzLastParsed)}
              </div>
              <div className="text-[11px] text-[#6b8f74] mt-1 uppercase tracking-wide font-semibold">
                Último parse
              </div>
            </div>
          )}
        </div>
      )}

      {/* Areas breakdown */}
      {areaEntries.length > 0 && (
        <div className="bg-white border border-[#e4eee8] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#f0f4f2] bg-[#f9fdfb]">
            <div className="text-[11px] font-bold text-[#006734] uppercase tracking-wide">
              Áreas detectadas ({areaEntries.length})
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {areaEntries.map(([code, meters]) => (
              <div
                key={code}
                className="flex items-center justify-between px-4 py-2 border-b border-[#f0f4f2] last:border-0 hover:bg-[#f9fdfb]"
              >
                <span className="text-[12px] font-mono font-bold text-[#006734] bg-[#f0faf4] px-1.5 py-0.5 rounded">
                  {code}
                </span>
                <span className="text-[12px] text-[#3a6347] font-medium">
                  {formatMeters(meters)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={handleSearch}
          disabled={searching}
          className="
            flex items-center gap-2 px-3.5 py-2 rounded-lg text-[12px] font-semibold
            border-2 border-[#006734] text-[#006734] bg-white
            hover:bg-[#f0faf4] transition-colors disabled:opacity-60
          "
        >
          <FileSearch size={14} className={searching ? 'animate-pulse' : ''} />
          {searching ? 'Buscando...' : 'Buscar KMZ'}
        </button>

        {hasKmz && (
          <button
            onClick={handleReparse}
            disabled={parsing}
            className="
              flex items-center gap-2 px-3.5 py-2 rounded-lg text-[12px] font-semibold
              bg-[#006734] text-[#FFDE00]
              hover:bg-[#0a7a3e] transition-colors disabled:opacity-60
            "
          >
            <RefreshCw size={14} className={parsing ? 'animate-spin' : ''} />
            {parsing ? 'Recalculando...' : 'Recalcular'}
          </button>
        )}
      </div>

      {/* Message */}
      {message && (
        <div
          className={`
            flex items-center gap-2 p-3 rounded-lg text-[12px] font-medium
            ${message.type === 'ok'
              ? 'bg-[#f0faf4] text-[#006734] border border-[#d4e8dc]'
              : 'bg-red-50 text-red-700 border border-red-200'
            }
          `}
        >
          {message.type === 'ok' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
          {message.text}
        </div>
      )}
    </div>
  )
}
