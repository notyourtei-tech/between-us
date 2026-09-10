import { createEmptySpace, createDemoData, getLocalData, persistLocalData } from './defaults'
import { supabase } from './supabase'
import type { AppData, DataGateway, LoveSpace, MemoryEntry, SavingsEntry } from '../types'

const localGateway: DataGateway = {
  isCloud: false,
  load: async (userId) => getLocalData(userId),
  createSpace: async (userId) => getLocalData(userId),
  joinSpace: async () => {
    throw new Error('预览模式不能加入共享空间，请先连接 Supabase。')
  },
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

const loadSharedSpace = async (userId: string): Promise<AppData | null> => {
  if (!supabase) return localGateway.load(userId)
  const { data: membership, error: membershipError } = await supabase
    .from('love_space_members')
    .select('love_space_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (membershipError) throw membershipError
  if (!membership) return null

  const [spaceResult, savingsResult, memoriesResult] = await Promise.all([
    supabase.from('love_spaces').select('*').eq('id', membership.love_space_id).single(),
    supabase.from('savings_entries').select('*').eq('love_space_id', membership.love_space_id).order('occurred_on', { ascending: false }),
    supabase.from('memory_entries').select('*').eq('love_space_id', membership.love_space_id).order('occurred_on', { ascending: false }),
  ])
  const error = spaceResult.error || savingsResult.error || memoriesResult.error
  if (error) throw error
  return {
    space: spaceResult.data as LoveSpace,
    savings: (savingsResult.data ?? []) as SavingsEntry[],
    memories: (memoriesResult.data ?? []) as MemoryEntry[],
  }
}

const cloudGateway: DataGateway = {
  isCloud: true,
  load: loadSharedSpace,
  createSpace: async (userId) => {
    if (!supabase) return createDemoData(userId)
    const fallback = createEmptySpace(userId)
    const { data: created, error: createError } = await supabase
      .from('love_spaces')
      .insert({ ...fallback, user_id: userId })
      .select()
      .single()
    if (createError) throw createError
    const { error: memberError } = await supabase
      .from('love_space_members')
      .insert({ love_space_id: created.id, user_id: userId, role: 'owner' })
    if (memberError) throw memberError
    return { space: created as LoveSpace, savings: [], memories: [] }
  },
  joinSpace: async (userId, inviteCode) => {
    if (!supabase) return localGateway.joinSpace(userId, inviteCode)
    const { error } = await supabase.rpc('join_love_space', { code: inviteCode.trim().toUpperCase() })
    if (error) throw error
    const data = await loadSharedSpace(userId)
    if (!data) throw new Error('邀请码无效，或该空间暂时无法加入。')
    return data
  },
  saveSpace: async (userId, space) => {
    if (!supabase) return localGateway.saveSpace(userId, space)
    const payload = { ...space, user_id: space.user_id ?? userId, updated_at: new Date().toISOString() }
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
