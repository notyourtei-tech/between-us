import { dateShift, isoToday } from './date'
import type { AppData, LoveSpace, MemoryEntry, SavingsEntry } from '../types'

const now = isoToday()

export const createEmptySpace = (userId: string): LoveSpace => ({
  id: crypto.randomUUID(),
  user_id: userId,
  owner_name: '我',
  partner_name: 'TA',
  relationship_start_date: dateShift(-386),
  first_meeting_date: dateShift(-348),
  last_meeting_date: dateShift(-17),
  next_meeting_date: dateShift(23),
  savings_target: 6800,
})

export const createDemoData = (userId: string): AppData => {
  const space = createEmptySpace(userId)
  const savings: SavingsEntry[] = [
    { id: 'demo-save-1', love_space_id: space.id, amount: 12000, currency_code: 'JPY', contributor: 'me', note: '九月见面基金', occurred_on: dateShift(-1) },
    { id: 'demo-save-2', love_space_id: space.id, amount: 45, currency_code: 'BYN', contributor: 'partner', note: '少喝几杯咖啡', occurred_on: dateShift(-7) },
    { id: 'demo-save-3', love_space_id: space.id, amount: 666, currency_code: 'CNY', contributor: 'me', note: '八月结余', occurred_on: dateShift(-16) },
  ]
  const memories: MemoryEntry[] = [
    { id: 'demo-memory-1', love_space_id: space.id, kind: 'meeting', title: '上一次见面', note: '在站台拥抱了很久。', occurred_on: space.last_meeting_date },
    { id: 'demo-memory-2', love_space_id: space.id, kind: 'moment', title: '第一次见面', note: '一切从这天开始有了形状。', occurred_on: space.first_meeting_date },
    { id: 'demo-memory-3', love_space_id: space.id, kind: 'promise', title: '下一次相见', note: '把想念留到见面那天。', occurred_on: space.next_meeting_date },
  ]
  return { space, savings, memories }
}

export const localKey = (userId: string) => `between-us:demo:${userId}`

export const getLocalData = (userId: string): AppData => {
  const stored = localStorage.getItem(localKey(userId))
  if (!stored) return createDemoData(userId)
  try {
    const parsed = JSON.parse(stored) as AppData
    // Keeps preview data created by older versions compatible with the
    // multi-currency ledger instead of silently producing a bad total.
    return {
      ...parsed,
      savings: parsed.savings.map((entry) => ({
        ...entry,
        currency_code: entry.currency_code || 'CNY',
        contributor: entry.contributor || 'me',
      })),
    }
  } catch {
    return createDemoData(userId)
  }
}

export const persistLocalData = (userId: string, data: AppData) =>
  localStorage.setItem(localKey(userId), JSON.stringify(data))

export const currentDate = now
