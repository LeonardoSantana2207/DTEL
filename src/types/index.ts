// ─── Status / Kanban ─────────────────────────────────────────────────────────

export type ProjectStatus =
  | 'TODO'
  | 'IN_PROJECT'
  | 'PROJECT_DONE'
  | 'IN_LAUNCH'
  | 'LAUNCH_DONE'
  | 'IN_FUSION'
  | 'FUSION_DONE'
  | 'FINISHED'

export type ChecklistStep =
  | 'PROJECT_RECEIVED'
  | 'KMZ_LOCATED'
  | 'CABLE_MEASURED'
  | 'CTO_COUNTED'
  | 'PROJECT_CHECKED'
  | 'PROJECT_LAUNCHED'
  | 'CTO_VERIFIED'
  | 'FUSION_DONE'
  | 'PROJECT_FINISHED'

export type CollaboratorRole = 'LAUNCHER' | 'FUSION' | 'DESIGNER'

// ─── Entidades principais ────────────────────────────────────────────────────

export interface Collaborator {
  id: string
  name: string
  nickname?: string | null
  avatarColor: string
  initials?: string | null
  role: string
  active: boolean
  createdAt: string
}

export interface ProjectCollaborator {
  id: string
  projectId: string
  collaboratorId: string
  role: CollaboratorRole
  metersAssigned?: number | null
  percentage?: number | null
  assignedAt: string
  collaborator: Collaborator
}

export interface ChecklistItem {
  id: string
  projectId: string
  step: ChecklistStep
  stepOrder: number
  completed: boolean
  completedAt?: string | null
  completedById?: string | null
  notes?: string | null
  completedBy?: Collaborator | null
}

export interface Fusion {
  id: string
  projectId: string
  type: 'CTO' | 'SPLICE_BOX'
  ctoName?: string | null
  fusedAt?: string | null
  responsibleId?: string | null
  notes?: string | null
  evidenceUrl?: string | null
  createdAt: string
  responsible?: Collaborator | null
}

export interface ActivityLog {
  id: string
  projectId: string
  action: string
  details?: Record<string, unknown> | null
  source: 'MANUAL' | 'TRELLO' | 'SYSTEM'
  authorName?: string | null
  createdAt: string
}

export interface Project {
  id: string
  name: string
  code?: string | null
  locality?: string | null
  status: ProjectStatus
  kanbanOrder: number
  createdAt: string
  updatedAt: string
  dueDate?: string | null
  notes?: string | null

  // Trello
  trelloCardId?: string | null
  trelloCardUrl?: string | null
  trelloListId?: string | null
  trelloListName?: string | null
  trelloBoardId?: string | null
  trelloLabels?: string[] | null
  trelloDesc?: string | null

  // KMZ
  kmzFilePath?: string | null
  kmzFileName?: string | null
  kmzFileUrl?: string | null
  kmzLastParsed?: string | null
  kmzRawAreas?: Record<string, number> | null
  trelloAreaData?: TrelloAreaItem[] | null
  cableMeters?: number | null
  ctoCount?: number | null
  spliceBoxes: number

  // Relações
  collaborators?: ProjectCollaborator[]
  checklistItems?: ChecklistItem[]
  fusions?: Fusion[]
  activityLogs?: ActivityLog[]
}

// ─── Kanban ──────────────────────────────────────────────────────────────────

export interface KanbanColumn {
  id: ProjectStatus
  label: string
  color: string
  bgColor: string
  textColor: string
  projects: Project[]
}

export const KANBAN_COLUMNS: Omit<KanbanColumn, 'projects'>[] = [
  { id: 'TODO',          label: 'A Fazer',               color: '#94A3B8', bgColor: '#F8FAFC', textColor: '#64748B' },
  { id: 'IN_PROJECT',    label: 'Em Projeto',             color: '#3B82F6', bgColor: '#EFF6FF', textColor: '#1D4ED8' },
  { id: 'PROJECT_DONE',  label: 'Projeto Concluído',      color: '#06B6D4', bgColor: '#ECFEFF', textColor: '#0E7490' },
  { id: 'IN_LAUNCH',     label: 'Em Lançamento',          color: '#F59E0B', bgColor: '#FFFBEB', textColor: '#B45309' },
  { id: 'LAUNCH_DONE',   label: 'Lançamento Concluído',   color: '#F97316', bgColor: '#FFF7ED', textColor: '#C2410C' },
  { id: 'IN_FUSION',     label: 'Em Fusão',               color: '#8B5CF6', bgColor: '#F5F3FF', textColor: '#6D28D9' },
  { id: 'FUSION_DONE',   label: 'Fusão Concluída',        color: '#10B981', bgColor: '#ECFDF5', textColor: '#065F46' },
  { id: 'FINISHED',      label: 'Finalizado',             color: '#006734', bgColor: '#f0faf4', textColor: '#006734' },
]

export const CHECKLIST_STEPS_CONFIG: { step: ChecklistStep; label: string; order: number }[] = [
  { step: 'PROJECT_RECEIVED',  label: 'Projeto recebido',            order: 1 },
  { step: 'KMZ_LOCATED',       label: 'KMZ localizado no Drive',     order: 2 },
  { step: 'CABLE_MEASURED',    label: 'Metragem de cabo extraída',   order: 3 },
  { step: 'CTO_COUNTED',       label: 'Quantidade de CTOs extraída', order: 4 },
  { step: 'PROJECT_CHECKED',   label: 'Projeto conferido',           order: 5 },
  { step: 'PROJECT_LAUNCHED',  label: 'Projeto lançado',             order: 6 },
  { step: 'CTO_VERIFIED',      label: 'CTOs conferidas',             order: 7 },
  { step: 'FUSION_DONE',       label: 'Fusão realizada',             order: 8 },
  { step: 'PROJECT_FINISHED',  label: 'Projeto finalizado',          order: 9 },
]

// ─── Trello Area Item ────────────────────────────────────────────────────────

export interface TrelloAreaItem {
  code: string        // "AAA", "AAB"
  team: string        // raw team string from checklist
  members: string[]   // split team members
  meters: number      // from KMZ area matching (0 if not found)
  date: string        // "03/09/2024"
  done: boolean       // checklist item state
}

// ─── KMZ ─────────────────────────────────────────────────────────────────────

export interface KmzParseResult {
  success: boolean
  fileName?: string
  filePath?: string
  cableMeters?: number
  ctoCount?: number
  areas?: Record<string, number>
  rawTotalMeters?: number
  error?: string
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export interface DashboardStats {
  totalProjects: number
  inProgress: number
  finished: number
  totalMeters: number
  totalCtos: number
  fusedCtos: number
  pendingCtos: number
  projectsWithoutKmz: number
  projectsWithoutResponsible: number
  projectsLate: number
}

export interface CollaboratorStats {
  collaborator: Collaborator
  metersLaunched: number
  projectsLaunched: number
  ctosFused: number
  projectsFused: number
}
