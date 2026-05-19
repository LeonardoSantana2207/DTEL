'use client'

import { useState } from 'react'
import { Save, Settings } from 'lucide-react'
import AppShell from '@/components/layout/AppShell'

export default function ConfiguracoesPage() {
  const [saved, setSaved] = useState(false)

  return (
    <AppShell>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h2 className="text-[17px] font-bold text-[#0d2517]">Configurações</h2>
          <p className="text-[12px] text-[#6b8f74] mt-0.5">Configurações gerais do sistema</p>
        </div>

        <div className="bg-white border border-[#e4eee8] rounded-xl p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <div className="flex items-center gap-2 mb-4">
            <Settings size={16} className="text-[#006734]" />
            <h3 className="text-[13px] font-bold text-[#0d2517]">Parâmetros de cálculo</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-[11px] font-semibold text-[#3a6347] uppercase tracking-wide block mb-1">
                Fator de correção de metragem
              </label>
              <input
                type="number"
                defaultValue="1.16"
                step="0.01"
                min="1"
                max="2"
                className="w-48 px-3 py-2 text-[13px] border border-[#d4e8dc] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#006734]/20 focus:border-[#006734]"
              />
              <div className="text-[10px] text-[#6b8f74] mt-1">
                Aplica fator de 1.16 (+16%) sobre metros brutos do KMZ para corridas/emendas
              </div>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#3a6347] uppercase tracking-wide block mb-1">
                Caixas de emenda por projeto (padrão)
              </label>
              <input
                type="number"
                defaultValue="1"
                min="1"
                max="10"
                className="w-32 px-3 py-2 text-[13px] border border-[#d4e8dc] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#006734]/20 focus:border-[#006734]"
              />
            </div>
          </div>
          <button
            onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000) }}
            className="mt-5 flex items-center gap-2 px-5 py-2.5 bg-[#006734] text-[#FFDE00] rounded-lg text-[13px] font-semibold hover:bg-[#0a7a3e] transition-colors"
          >
            <Save size={14} />
            {saved ? 'Salvo!' : 'Salvar configurações'}
          </button>
        </div>

        <div className="bg-white border border-[#e4eee8] rounded-xl p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <h3 className="text-[13px] font-bold text-[#0d2517] mb-4">Sobre o sistema</h3>
          <div className="space-y-2 text-[12px] text-[#6b8f74]">
            <div><strong className="text-[#3a6347]">Versão:</strong> 1.0.0</div>
            <div><strong className="text-[#3a6347]">Stack:</strong> Next.js 14, Prisma, SQLite</div>
            <div><strong className="text-[#3a6347]">Empresa:</strong> DTEL Telecom</div>
            <div><strong className="text-[#3a6347]">Contato:</strong> leonardo@dtel.com.br</div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
