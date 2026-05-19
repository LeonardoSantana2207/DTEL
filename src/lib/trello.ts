// ─── Trello API client ────────────────────────────────────────────────────────

const TRELLO_BASE = 'https://api.trello.com/1'

function getCredentials() {
  return {
    key: process.env.TRELLO_KEY ?? '',
    token: process.env.TRELLO_TOKEN ?? '',
    boardId: process.env.TRELLO_BOARD_ID ?? '',
  }
}

async function trelloFetch<T>(endpoint: string, params = ''): Promise<T> {
  const { key, token } = getCredentials()
  const url = `${TRELLO_BASE}${endpoint}?key=${key}&token=${token}${params}`
  const res = await fetch(url, { next: { revalidate: 0 } })
  if (!res.ok) throw new Error(`Trello API error ${res.status}: ${endpoint}`)
  return res.json() as Promise<T>
}

export interface TrelloList {
  id: string
  name: string
  closed: boolean
  idBoard: string
}

export interface TrelloCard {
  id: string
  name: string
  desc: string
  url: string
  shortUrl: string
  idList: string
  idLabels: string[]
  labels: TrelloLabel[]
  due: string | null
  dateLastActivity: string
  pos: number
  closed: boolean
  idMembers: string[]
  attachments?: TrelloAttachment[]
  checklists?: TrelloChecklist[]
  actions?: TrelloAction[]
}

export interface TrelloLabel {
  id: string
  name: string
  color: string
}

export interface TrelloChecklist {
  id: string
  name: string
  checkItems: TrelloCheckItem[]
}

export interface TrelloCheckItem {
  id: string
  name: string
  state: 'complete' | 'incomplete'
}

export interface TrelloAttachment {
  id: string
  name: string
  url: string
  mimeType: string
}

export interface TrelloAction {
  id: string
  type: string
  date: string
  data: Record<string, unknown>
  memberCreator?: { fullName: string; username: string }
}

// ─── Public functions ─────────────────────────────────────────────────────────

export async function fetchBoards() {
  return trelloFetch<{ id: string; name: string }[]>('/members/me/boards', '&fields=name,id')
}

export async function fetchLists(boardId?: string) {
  const { boardId: defaultBoardId } = getCredentials()
  const id = boardId ?? defaultBoardId
  return trelloFetch<TrelloList[]>(`/boards/${id}/lists`, '&fields=name,id,closed')
}

export async function fetchCards(listId: string) {
  return trelloFetch<TrelloCard[]>(
    `/lists/${listId}/cards`,
    '&fields=name,desc,url,shortUrl,idList,idLabels,labels,due,dateLastActivity,pos,closed,idMembers'
  )
}

export async function fetchCardChecklists(cardId: string) {
  return trelloFetch<TrelloChecklist[]>(`/cards/${cardId}/checklists`)
}

export async function fetchCardActions(cardId: string) {
  return trelloFetch<TrelloAction[]>(
    `/cards/${cardId}/actions`,
    '&filter=updateCard,createCard,commentCard,moveCardToBoard'
  )
}

export async function fetchCardAttachments(cardId: string) {
  return trelloFetch<TrelloAttachment[]>(`/cards/${cardId}/attachments`)
}

// ─── Full board sync ──────────────────────────────────────────────────────────

export interface SyncedCard {
  trelloCardId: string
  trelloCardUrl: string
  trelloListId: string
  trelloListName: string
  name: string
  desc: string
  labels: string[]
  due: string | null
  dateLastActivity: string
  pos: number
}

export async function syncBoard(boardId?: string): Promise<SyncedCard[]> {
  const { boardId: defaultBoardId } = getCredentials()
  const id = boardId ?? defaultBoardId

  const lists = await fetchLists(id)
  const openLists = lists.filter(l => !l.closed)

  const allCards: SyncedCard[] = []

  await Promise.all(
    openLists.map(async list => {
      const cards = await fetchCards(list.id)
      const openCards = cards.filter(c => !c.closed)
      for (const card of openCards) {
        allCards.push({
          trelloCardId: card.id,
          trelloCardUrl: card.shortUrl,
          trelloListId: list.id,
          trelloListName: list.name,
          name: card.name,
          desc: card.desc ?? '',
          labels: card.labels?.map(l => l.name) ?? [],
          due: card.due,
          dateLastActivity: card.dateLastActivity,
          pos: card.pos,
        })
      }
    })
  )

  return allCards
}
