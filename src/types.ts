export type View = 'home' | 'wallet' | 'memory'
export type CurrencyCode = 'CNY' | 'JPY' | 'USD' | 'BYN'
export type Contributor = 'me' | 'partner'

export type LoveSpace = {
  id: string
  user_id?: string
  invite_code?: string
  owner_name: string
  partner_name: string
  relationship_start_date: string
  first_meeting_date: string
  last_meeting_date: string
  next_meeting_date: string
  savings_target: number
  created_at?: string
  updated_at?: string
}

export type SavingsEntry = {
  id: string
  love_space_id: string
  amount: number
  currency_code: CurrencyCode
  contributor: Contributor
  note: string
  occurred_on: string
  created_at?: string
}

export type MemoryEntry = {
  id: string
  love_space_id: string
  kind: 'meeting' | 'moment' | 'promise'
  title: string
  note: string
  occurred_on: string
  created_at?: string
}

export type AppData = {
  space: LoveSpace
  savings: SavingsEntry[]
  memories: MemoryEntry[]
}

export type DataGateway = {
  isCloud: boolean
  load: (userId: string) => Promise<AppData | null>
  createSpace: (userId: string) => Promise<AppData>
  joinSpace: (userId: string, inviteCode: string) => Promise<AppData>
  saveSpace: (userId: string, space: LoveSpace) => Promise<LoveSpace>
  addSavings: (userId: string, entry: SavingsEntry) => Promise<SavingsEntry>
  addMemory: (userId: string, entry: MemoryEntry) => Promise<MemoryEntry>
}
