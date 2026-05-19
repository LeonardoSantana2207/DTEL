'use client'

import { useState } from 'react'
import { CheckCircle2, Circle, ChevronDown } from 'lucide-react'
import type { ChecklistItem, Collaborator } from '@/types'
import { CHECKLIST_STEPS_CONFIG } from '@/types'
import { formatDate } from '@/lib/utils'

interface Props {
  projectId: string
  items: ChecklistItem[]
  collaborators: Collaborator[]
  onChange: (items: ChecklistItem[]) => void
}

export default function ChecklistPanel({ projectId, items, collaborators, onChange }: Props) {
  const [markingStep, setMarkingStep] = useState<string | null>(null)
  const [selectedCollab, setSelectedCollab] = useState<string>('')

  const sortedItems = [...items].sort((a, b) => a.stepOrder - b.stepOrder)
  const completed = items.filter(i => i.completed).length

  async function handleToggle(item: ChecklistItem) {
    if (item.completed) {
      // Unmark
      await updateItem(item.step, false, null)
    } else {
      // Show collaborator selector
      setMarkingStep(item.step)
    }
  }

  async function confirmMark() {
    if (!markingStep) return
    await updateItem(markingStep, true, selectedCollab || null)
    setMarkingStep(null)
    setSelectedCollab('')
  }

  async function updateItem(step: string, completed: boolean, collaboratorId: string | null) {
    try {
      const res = await fetch(`/api/projects/${projectId}/checklist`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step, completed, collaboratorId }),
      })
      if (!res.ok) return
      const updated: ChecklistItem = await res.json()
      onChange(items.map(i => (i.step === step ? updated : i)))
    } catch (e) {
      console.error(e)
    }
  }

  const pct = items.length > 0 ? Math.round((completed / items.length) * 100) : 0

  return (
    <div>
      {/* Progress */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] text-[#6b8f74]">
          {completed} de {items.length} etapas
        </div>
        <div className="text-[12px] font-bold text-[#006734]">{pct}%</div>
      </div>
      <div className="h-2 bg-[#e4eee8] rounded-full overflow-hidden mb-4">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, #006734, #1a9e52)',
          }}
        />
      </div>

      {/* Items */}
      <div className="space-y-1">
        {sortedItems.map(item => {
          const config = CHECKLIST_STEPS_CONFIG.find(s => s.step === item.step)
          const isMarking = markingStep === item.step

          return (
            <div key={item.step}>
              <button
                onClick={() => handleToggle(item)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left
                  transition-colors duration-100
                  ${item.completed
                    ? 'opacity-70 hover:opacity-90'
                    : 'hover:bg-[#f0faf4]'
                  }
                `}
              >
                {item.completed ? (
                  <CheckCircle2 size={18} className="text-[#006734] flex-shrink-0" />
                ) : (
                  <Circle size={18} className="text-[#bbb] flex-shrink-0" />
                )}
                <div className="flex-1">
                  <span
                    className={`text-[13px] font-medium ${
                      item.completed ? 'line-through text-[#6b8f74]' : 'text-[#0d2517]'
                    }`}
                  >
                    {config?.label ?? item.step}
                  </span>
                  {item.completed && (
                    <div className="text-[10px] text-[#6b8f74] mt-0.5 flex items-center gap-1">
                      {item.completedBy && (
                        <span className="font-medium text-[#3a6347]">
                          {item.completedBy.nickname ?? item.completedBy.name}
                        </span>
                      )}
                      {item.completedAt && (
                        <span>— {formatDate(item.completedAt)}</span>
                      )}
                    </div>
                  )}
                </div>
              </button>

              {/* Collaborator selector modal */}
              {isMarking && (
                <div className="mx-3 mb-2 p-3 bg-[#f0faf4] border border-[#d4e8dc] rounded-lg">
                  <div className="text-[11px] font-semibold text-[#3a6347] mb-2">
                    Quem realizou esta etapa?
                  </div>
                  <div className="flex gap-2 mb-3 flex-wrap">
                    {collaborators.map(c => (
                      <button
                        key={c.id}
                        onClick={() => setSelectedCollab(c.id)}
                        className={`
                          px-3 py-1.5 rounded-full text-[12px] font-medium border-2 transition-all
                          ${selectedCollab === c.id
                            ? 'border-[#006734] bg-[#006734] text-white'
                            : 'border-[#d4e8dc] text-[#3a6347] bg-white hover:border-[#006734]'
                          }
                        `}
                      >
                        {c.nickname ?? c.name.split(' ')[0]}
                      </button>
                    ))}
                    <button
                      onClick={() => setSelectedCollab('')}
                      className={`
                        px-3 py-1.5 rounded-full text-[12px] font-medium border-2 transition-all
                        ${selectedCollab === ''
                          ? 'border-[#006734] bg-[#006734] text-white'
                          : 'border-[#d4e8dc] text-[#3a6347] bg-white hover:border-[#006734]'
                        }
                      `}
                    >
                      Sistema
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={confirmMark}
                      className="px-4 py-1.5 bg-[#006734] text-[#FFDE00] text-[12px] font-semibold rounded-lg hover:bg-[#0a7a3e] transition-colors"
                    >
                      Confirmar
                    </button>
                    <button
                      onClick={() => { setMarkingStep(null); setSelectedCollab('') }}
                      className="px-4 py-1.5 bg-white text-[#6b8f74] text-[12px] font-semibold rounded-lg border border-[#d4e8dc] hover:border-[#006734] transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
