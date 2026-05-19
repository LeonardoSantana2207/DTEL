'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, Cable, Zap } from 'lucide-react'
import AppShell from '@/components/layout/AppShell'
import type { Collaborator } from '@/types'

const COLORS = ['#006734', '#0a7a3e', '#1a9e52', '#FEBF11', '#3B82F6', '#8B5CF6', '#F97316', '#EF4444']

const ROLE_OPTIONS = [
  { value: 'LAUNCHER', label: 'Lançamento', icon: '🔌' },
  { value: 'FUSION', label: 'Fusão', icon: '⚡' },
  { value: 'DESIGNER', label: 'Projetos', icon: '📐' },
]

export default function EquipePage() {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', nickname: '', avatarColor: '#006734', role: 'LAUNCHER' })

  useEffect(() => {
    load()
  }, [])

  function load() {
    fetch('/api/collaborators')
      .then(r => r.json())
      .then(setCollaborators)
      .finally(() => setLoading(false))
  }

  async function handleAdd() {
    if (!form.name) return
    const res = await fetch('/api/collaborators', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const c = await res.json()
    setCollaborators(prev => [...prev, c])
    setForm({ name: '', nickname: '', avatarColor: '#006734', role: 'LAUNCHER' })
    setShowForm(false)
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await fetch(`/api/collaborators/${id}`, { method: 'DELETE' })
      setCollaborators(prev => prev.filter(c => c.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  const launchers = collaborators.filter(c => c.role === 'LAUNCHER')
  const fusers = collaborators.filter(c => c.role === 'FUSION')
  const others = collaborators.filter(c => c.role !== 'LAUNCHER' && c.role !== 'FUSION')

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[17px] font-bold text-[#0d2517]">Equipe FTTH</h2>
            <p className="text-[12px] text-[#6b8f74]">{collaborators.length} colaboradores ativos</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#006734] text-[#FFDE00] rounded-lg text-[13px] font-semibold hover:bg-[#0a7a3e] transition-colors"
          >
            <Plus size={14} />
            Novo Colaborador
          </button>
        </div>

        {/* Add form */}
        {showForm && (
          <div className="bg-white border border-[#d4e8dc] rounded-xl p-5 shadow-[0_2px_8px_rgba(0,103,52,0.08)]">
            <div className="text-[13px] font-bold text-[#006734] mb-4">Adicionar colaborador</div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-[11px] font-semibold text-[#3a6347] uppercase tracking-wide block mb-1">Nome completo *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 text-[13px] border border-[#d4e8dc] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#006734]/20 focus:border-[#006734]"
                  placeholder="Nome do colaborador"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#3a6347] uppercase tracking-wide block mb-1">Apelido</label>
                <input
                  type="text"
                  value={form.nickname}
                  onChange={e => setForm(f => ({ ...f, nickname: e.target.value }))}
                  className="w-full px-3 py-2 text-[13px] border border-[#d4e8dc] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#006734]/20 focus:border-[#006734]"
                  placeholder="Como prefere ser chamado"
                />
              </div>
            </div>
            <div className="mb-4">
              <label className="text-[11px] font-semibold text-[#3a6347] uppercase tracking-wide block mb-2">Equipe / Função</label>
              <div className="flex gap-2">
                {ROLE_OPTIONS.map(r => (
                  <button
                    key={r.value}
                    onClick={() => setForm(f => ({ ...f, role: r.value }))}
                    className={`
                      flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold border-2 transition-all
                      ${form.role === r.value
                        ? 'border-[#006734] bg-[#006734] text-white'
                        : 'border-[#d4e8dc] text-[#3a6347] bg-white hover:border-[#006734]'
                      }
                    `}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-4">
              <label className="text-[11px] font-semibold text-[#3a6347] uppercase tracking-wide block mb-2">Cor do avatar</label>
              <div className="flex gap-2">
                {COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setForm(f => ({ ...f, avatarColor: c }))}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${form.avatarColor === c ? 'border-white scale-110 shadow-lg' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                className="px-5 py-2 bg-[#006734] text-[#FFDE00] rounded-lg text-[13px] font-semibold hover:bg-[#0a7a3e]"
              >
                Salvar
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-5 py-2 border border-[#d4e8dc] text-[#6b8f74] rounded-lg text-[13px] font-semibold hover:border-[#006734]"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-10 text-[#bbb]">Carregando...</div>
        ) : (
          <div className="space-y-6">
            <TeamSection
              title="Equipe de Lançamento"
              icon={<Cable size={15} className="text-[#006734]" />}
              collaborators={launchers}
              deletingId={deletingId}
              onDelete={handleDelete}
              accentColor="#006734"
            />
            <TeamSection
              title="Equipe de Fusão"
              icon={<Zap size={15} className="text-[#8B5CF6]" />}
              collaborators={fusers}
              deletingId={deletingId}
              onDelete={handleDelete}
              accentColor="#8B5CF6"
            />
            {others.length > 0 && (
              <TeamSection
                title="Outros"
                icon={<Plus size={15} className="text-[#6b8f74]" />}
                collaborators={others}
                deletingId={deletingId}
                onDelete={handleDelete}
                accentColor="#6b8f74"
              />
            )}
          </div>
        )}
      </div>
    </AppShell>
  )
}

function TeamSection({
  title, icon, collaborators, deletingId, onDelete, accentColor,
}: {
  title: string
  icon: React.ReactNode
  collaborators: Collaborator[]
  deletingId: string | null
  onDelete: (id: string) => void
  accentColor: string
}) {
  if (collaborators.length === 0) return null

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-[13px] font-bold uppercase tracking-wide" style={{ color: accentColor }}>
          {title}
        </h3>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#f0faf4] text-[#6b8f74]">
          {collaborators.length}
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {collaborators.map(c => {
          const initials = c.initials ?? c.name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
          return (
            <div
              key={c.id}
              className="bg-white border border-[#e4eee8] rounded-xl p-5 text-center shadow-[0_1px_4px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-shadow relative group"
            >
              {/* Delete button */}
              <button
                onClick={() => onDelete(c.id)}
                disabled={deletingId === c.id}
                className="
                  absolute top-2 right-2 p-1.5 rounded-lg
                  opacity-0 group-hover:opacity-100
                  bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600
                  transition-all disabled:opacity-50
                "
                title="Remover colaborador"
              >
                <Trash2 size={12} />
              </button>

              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-white text-[22px] font-bold mx-auto mb-3 shadow-lg"
                style={{ backgroundColor: c.avatarColor }}
              >
                {initials}
              </div>
              <div className="text-[14px] font-bold text-[#0d2517]">{c.name}</div>
              {c.nickname && <div className="text-[11px] text-[#6b8f74] mt-0.5">{c.nickname}</div>}
              <div className="mt-3">
                <span
                  className="text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide"
                  style={{ backgroundColor: accentColor + '18', color: accentColor }}
                >
                  {c.role === 'LAUNCHER' ? 'Lançamento' : c.role === 'FUSION' ? 'Fusão' : c.role}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
