'use client'

import { useState } from 'react'
import { Download, FileSpreadsheet, FileText } from 'lucide-react'
import AppShell from '@/components/layout/AppShell'

export default function RelatoriosPage() {
  const [generating, setGenerating] = useState<string | null>(null)

  async function exportExcel() {
    setGenerating('excel')
    try {
      const res = await fetch('/api/projects?include=all')
      const projects = await res.json()

      // Dynamic import to avoid SSR issues
      const XLSX = await import('xlsx')
      const ws = XLSX.utils.json_to_sheet(projects.map((p: Record<string, unknown>) => ({
        'Projeto': p.name,
        'Código': p.code ?? '',
        'Localidade': p.locality ?? '',
        'Status': p.status,
        'Metragem (m)': p.cableMeters ?? '',
        'CTOs': p.ctoCount ?? '',
        'Caixas Emenda': p.spliceBoxes,
        'Trello': p.trelloCardUrl ?? '',
        'KMZ': p.kmzFileName ?? '',
        'Criado em': new Date(p.createdAt as string).toLocaleDateString('pt-BR'),
      })))
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Projetos')
      XLSX.writeFile(wb, `DTEL_Producao_${new Date().toISOString().slice(0, 10)}.xlsx`)
    } finally {
      setGenerating(null)
    }
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h2 className="text-[17px] font-bold text-[#0d2517]">Relatórios</h2>
          <p className="text-[12px] text-[#6b8f74] mt-0.5">Exporte dados de produção e projetos</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Excel report */}
          <div className="bg-white border border-[#e4eee8] rounded-xl p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center mb-3">
              <FileSpreadsheet size={20} className="text-green-600" />
            </div>
            <div className="text-[14px] font-bold text-[#0d2517] mb-1">Excel — Projetos</div>
            <div className="text-[11px] text-[#6b8f74] mb-4">
              Lista completa de projetos com metragem, CTOs e colaboradores
            </div>
            <button
              onClick={exportExcel}
              disabled={generating === 'excel'}
              className="
                w-full flex items-center justify-center gap-2 py-2.5 rounded-lg
                text-[13px] font-semibold bg-[#006734] text-[#FFDE00]
                hover:bg-[#0a7a3e] transition-colors disabled:opacity-60
              "
            >
              <Download size={14} />
              {generating === 'excel' ? 'Gerando...' : 'Exportar Excel'}
            </button>
          </div>

          {/* Production report */}
          <div className="bg-white border border-[#e4eee8] rounded-xl p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center mb-3">
              <FileText size={20} className="text-purple-600" />
            </div>
            <div className="text-[14px] font-bold text-[#0d2517] mb-1">Relatório de Produção</div>
            <div className="text-[11px] text-[#6b8f74] mb-4">
              Ranking de colaboradores, metros lançados e CTOs fusionadas
            </div>
            <button
              onClick={() => window.print()}
              className="
                w-full flex items-center justify-center gap-2 py-2.5 rounded-lg
                text-[13px] font-semibold border-2 border-[#006734] text-[#006734]
                hover:bg-[#f0faf4] transition-colors
              "
            >
              <FileText size={14} />
              Imprimir / PDF
            </button>
          </div>
        </div>

        <div className="bg-[#f0faf4] border border-[#d4e8dc] rounded-xl p-4 text-[12px] text-[#3a6347]">
          <strong>Dica:</strong> Para relatórios mais detalhados, use a aba Dashboard que tem todos os indicadores em tempo real. A exportação Excel inclui todos os projetos com dados atualizados.
        </div>
      </div>
    </AppShell>
  )
}
