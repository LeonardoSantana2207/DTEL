'use client'

import { useEffect, useState } from 'react'
import type { Collaborator } from '@/types'

interface Props {
  selected: string[]
  onChange: (ids: string[]) => void
  label?: string
}

export default function CollaboratorSelect({ selected, onChange, label = 'Colaboradores' }: Props) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])

  useEffect(() => {
    fetch('/api/collaborators')
      .then(r => r.json())
      .then(setCollaborators)
      .catch(console.error)
  }, [])

  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter(s => s !== id))
    } else {
      onChange([...selected, id])
    }
  }

  const division = selected.length > 0 ? Math.round(100 / selected.length) : 0

  return (
    <div>
      <div className="text-[11px] font-semibold text-[#3a6347] uppercase tracking-wide mb-2">
        {label}
      </div>
      <div className="flex flex-wrap gap-2 mb-2">
        {collaborators.map(c => {
          const isSelected = selected.includes(c.id)
          const initials = c.initials ?? c.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
          return (
            <button
              key={c.id}
              onClick={() => toggle(c.id)}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-semibold
                border-2 transition-all duration-150
                ${isSelected
                  ? 'border-[#006734] text-[#006734] bg-[#f0faf4]'
                  : 'border-[#e4eee8] text-[#6b8f74] bg-white hover:border-[#006734]/30 hover:text-[#006734]'
                }
              `}
            >
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] text-white font-bold flex-shrink-0"
                style={{ backgroundColor: isSelected ? c.avatarColor : '#bbb' }}
              >
                {initials}
              </span>
              {c.nickname ?? c.name.split(' ')[0]}
              {isSelected && (
                <span className="text-[10px] text-[#006734]/70 ml-0.5">✓</span>
              )}
            </button>
          )
        })}
      </div>
      {selected.length > 0 && (
        <div className="text-[11px] text-[#3a6347] bg-[#f0faf4] rounded-lg px-3 py-2">
          {selected.length === 1
            ? '1 colaborador → 100% da metragem'
            : `${selected.length} colaboradores → ${division}% cada (divisão igual)`
          }
        </div>
      )}
    </div>
  )
}
