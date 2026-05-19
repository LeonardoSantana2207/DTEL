'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, CheckCircle, AlertCircle, Link2, Folder } from 'lucide-react'
import AppShell from '@/components/layout/AppShell'

interface SyncLog {
  id: string; boardId: string; syncedAt: string
  status: string; cardsSynced: number; cardsCreated: number; cardsUpdated: number
  errorDetails?: string | null
}

export default function IntegracoesPage() {
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<Record<string, unknown> | null>(null)
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([])

  useEffect(() => {
    fetch('/api/trello/sync')
      .then(r => r.json())
      .then(setSyncLogs)
      .catch(console.error)
  }, [])

  async function handleSync() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/trello/sync', { method: 'POST' })
      const data = await res.json()
      setSyncResult(data)
      const logs = await fetch('/api/trello/sync').then(r => r.json())
      setSyncLogs(logs)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h2 className="text-[17px] font-bold text-[#0d2517]">Integrações</h2>
          <p className="text-[12px] text-[#6b8f74] mt-0.5">Sincronize dados do Trello e do Google Drive</p>
        </div>

        {/* Trello integration */}
        <div className="bg-white border border-[#e4eee8] rounded-xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <div className="px-5 py-4 border-b border-[#f0f4f2] bg-[#f0faf4] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#0052cc] flex items-center justify-center">
              <Link2 size={16} className="text-white" />
            </div>
            <div>
              <div className="text-[13px] font-bold text-[#0d2517]">Trello</div>
              <div className="text-[10px] text-[#6b8f74]">Sincroniza cards do board configurado</div>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3 text-[12px]">
              <div className="p-3 bg-[#f9fdfb] rounded-lg">
                <div className="text-[#6b8f74] font-semibold uppercase text-[10px] tracking-wide mb-1">Board ID</div>
                <div className="font-mono text-[#0d2517]">{process.env.NEXT_PUBLIC_TRELLO_BOARD_ID ?? 'Z7yXOJ5o'}</div>
              </div>
              <div className="p-3 bg-[#f9fdfb] rounded-lg">
                <div className="text-[#6b8f74] font-semibold uppercase text-[10px] tracking-wide mb-1">Status</div>
                <div className={`font-semibold ${syncLogs[0]?.status === 'OK' ? 'text-[#10B981]' : 'text-amber-600'}`}>
                  {syncLogs[0] ? (syncLogs[0].status === 'OK' ? '✓ Conectado' : '⚠ Erro') : 'Não sincronizado'}
                </div>
              </div>
            </div>

            <button
              onClick={handleSync}
              disabled={syncing}
              className="
                flex items-center gap-2 px-5 py-2.5 rounded-lg text-[13px] font-semibold
                bg-[#006734] text-[#FFDE00] hover:bg-[#0a7a3e]
                transition-colors disabled:opacity-60
              "
            >
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Sincronizando...' : 'Sincronizar Agora'}
            </button>

            {syncResult && (
              <div className={`flex items-start gap-3 p-4 rounded-xl ${
                (syncResult as { ok?: boolean }).ok ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
              }`}>
                {(syncResult as { ok?: boolean }).ok
                  ? <CheckCircle size={18} className="text-[#10B981] flex-shrink-0 mt-0.5" />
                  : <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
                }
                <div className="text-[13px]">
                  {(syncResult as { ok?: boolean }).ok ? (
                    <div>
                      <div className="font-semibold text-[#10B981]">Sincronizado com sucesso!</div>
                      <div className="text-[#3a6347] text-[12px] mt-1">
                        {(syncResult as { cardsSynced?: number }).cardsSynced} cards sincronizados —{' '}
                        {(syncResult as { cardsCreated?: number }).cardsCreated} novos —{' '}
                        {(syncResult as { cardsUpdated?: number }).cardsUpdated} atualizados
                      </div>
                    </div>
                  ) : (
                    <div className="text-red-700">{String((syncResult as { error?: string }).error ?? 'Erro desconhecido')}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Drive integration */}
        <div className="bg-white border border-[#e4eee8] rounded-xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <div className="px-5 py-4 border-b border-[#f0f4f2] bg-[#f0faf4] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#FEBF11] flex items-center justify-center">
              <Folder size={16} className="text-white" />
            </div>
            <div>
              <div className="text-[13px] font-bold text-[#0d2517]">Google Drive / KMZ</div>
              <div className="text-[10px] text-[#6b8f74]">Leitura de arquivos KMZ do Drive montado</div>
            </div>
          </div>
          <div className="p-5 space-y-3">
            <div className="p-3 bg-[#f9fdfb] rounded-lg">
              <div className="text-[#6b8f74] font-semibold uppercase text-[10px] tracking-wide mb-1">Caminho base</div>
              <div className="font-mono text-[11px] text-[#0d2517] break-all">
                G:\Drives compartilhados\ENGENHARIA DTEL\Projetos\FTTH\Projetos DTEL\Rede FTTH
              </div>
            </div>
            <div className="text-[12px] text-[#6b8f74] bg-blue-50 p-3 rounded-lg border border-blue-100">
              A leitura do KMZ é feita automaticamente por projeto. Acesse um projeto no Kanban e clique em &quot;Buscar KMZ&quot; na aba Dados KMZ.
            </div>
          </div>
        </div>

        {/* Sync history */}
        {syncLogs.length > 0 && (
          <div className="bg-white border border-[#e4eee8] rounded-xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
            <div className="px-5 py-4 border-b border-[#f0f4f2] bg-[#f9fdfb]">
              <div className="text-[12px] font-bold text-[#006734] uppercase tracking-wide">
                Histórico de Sincronizações
              </div>
            </div>
            <div className="divide-y divide-[#f0f4f2]">
              {syncLogs.slice(0, 8).map(log => (
                <div key={log.id} className="px-5 py-3 flex items-center gap-3">
                  {log.status === 'OK'
                    ? <CheckCircle size={14} className="text-[#10B981]" />
                    : <AlertCircle size={14} className="text-red-500" />
                  }
                  <div className="flex-1">
                    <div className="text-[12px] text-[#0d2517]">
                      {log.cardsSynced} cards — {log.cardsCreated} novos — {log.cardsUpdated} atualizados
                    </div>
                    <div className="text-[10px] text-[#bbb]">
                      {new Date(log.syncedAt).toLocaleString('pt-BR')}
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${log.status === 'OK' ? 'bg-green-50 text-[#10B981]' : 'bg-red-50 text-red-600'}`}>
                    {log.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
