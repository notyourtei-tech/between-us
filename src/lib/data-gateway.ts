import { createDemoData, getLocalData, persistLocalData } from './defaults'
import { supabase } from './supabase'
import type { DataGateway, LoveSpace, MemoryEntry, SavingsEntry } from '../types'

const localGateway: DataGateway = {
  isCloud: false,
  load: async (userId) => getLocalData(userId),
  saveSpace: async (userId, space) => {
    const data = getLocalData(userId)
    persistLocalData(userId, { ...data, space })
    return space
  },
  addSavings: async (userId, entry) => {
    const data = getLocalData(userId)
    persistLocalData(userId, { ...data, savings: [entry, ...data.savings] })
    return entry
  },
  addMemory: async (userId, entry) => {
    const data = getLocalData(userId)
    persistLocalData(userId, { ...data, memories: [entry, ...data.memories] })
    return entry
  },
}

const cloudGateway: DataGateway = {
  isCloud: true,
  load: async (userId) => {
    if (!supabase) return localGateway.load(userId)
    const [spaceResult, savingsResult, memoriesResult] = await Promise.all([
      supabase.from('love_spaces').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('savings_entries').select('*').eq('user_id', userId).order('occurred_on', { ascending: false }),
      supabase.from('memory_entries').select('*').eq('user_id', userId).order('occurred_on', { ascending: false }),
    ])
    const error = spaceResult.error || savingsResult.error || memoriesResult.error
    if (error) throw error
    const fallback = createDemoData(userId)
    let activeSpace = spaceResult.data as LoveSpace | null
    if (!activeSpace) {
      const { data: created, error: createError } = await supabase
        .from('love_spaces')
        .upsert({ ...fallback.space, user_id: userId })
        .select()
        .single()
      if (createError) throw createError
      activeSpace = created as LoveSpace
    }
    return {
      space: activeSpace,
      savings: (savingsResult.data ?? []) as SavingsEntry[],
      memories: (memoriesResult.data ?? []) as MemoryEntry[],
    }
  },
  saveSpace: async (userId, space) => {
    if (!supabase) return localGateway.saveSpace(userId, space)
    const payload = { ...space, user_id: userId, updated_at: new Date().toISOString() }
    const { data, error } = await supabase.from('love_spaces').upsert(payload).select().single()
    if (error) throw error
    return data as LoveSpace
  },
  addSavings: async (userId, entry) => {
    if (!supabase) return localGateway.addSavings(userId, entry)
    const { data, error } = await supabase
      .from('savings_entries')
      .insert({ ...entry, user_id: userId })
      .select()
      .single()
    if (error) throw error
    return data as SavingsEntry
  },
  addMemory: async (userId, entry) => {
    if (!supabase) return localGateway.addMemory(userId, entry)
    const { data, error } = await supabase
      .from('memory_entries')
      .insert({ ...entry, user_id: userId })
      .select()
      .single()
    if (error) throw error
    return data as MemoryEntry
  },
}

export const dataGateway = supabase ? cloudGateway : localGateway
