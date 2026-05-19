import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { KANBAN_COLUMNS, type ProjectStatus } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatMeters(meters: number | null | undefined): string {
  if (!meters) return '—'
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`
  return `${Math.round(meters)} m`
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('pt-BR')
}

export function getStatusConfig(status: ProjectStatus) {
  return KANBAN_COLUMNS.find(c => c.id === status) ?? KANBAN_COLUMNS[0]
}

export function getStatusLabel(status: ProjectStatus): string {
  return getStatusConfig(status).label
}

export function divideMeters(totalMeters: number, collaboratorCount: number): number {
  if (collaboratorCount <= 0) return 0
  return totalMeters / collaboratorCount
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('')
}

export function normalizeCity(raw: string): string {
  return raw
    .replace(/^rede\s+ftth\s+/i, '')
    .replace(/\s*[-–]\s*OLT.*/i, '')
    .replace(/\s+OLT\b.*/i, '')
    .replace(/\s*[-–]\s*(PE|AL|PB|RN|CE|BA)\s*$/i, '')
    .replace(/\s*\(.*\)\s*$/, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

export function checklistProgress(items: { completed: boolean }[]): number {
  if (!items.length) return 0
  return Math.round((items.filter(i => i.completed).length / items.length) * 100)
}
