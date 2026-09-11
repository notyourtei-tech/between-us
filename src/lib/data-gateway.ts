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
    const { error: rpcError } = await supabase.rpc('create_love_space', {
      p_owner_name: fallback.owner_name,
      p_partner_name: fallback.partner_name,
      p_relationship_start_date: fallback.relationship_start_date,
      p_first_meeting_date: fallback.first_meeting_date,
      p_last_meeting_date: fallback.last_meeting_date,
      p_next_meeting_date: fallback.next_meeting_date,
      p_savings_target: fallback.savings_target,
    })
    // Existing installations can be one migration behind. Fall back safely to
    // the already-supported two-step creation if this RPC is not present yet.
    if (rpcError && rpcError.code !== 'PGRST202') throw rpcError
    if (rpcError) {
      // Do not append `.select()` here: a new space cannot be selected until
      // its owner membership exists, by design of the RLS policy.
      const { error: createError } = await supabase
        .from('love_spaces')
        .insert({ ...fallback, user_id: userId })
      if (createError) throw createError
      const { error: memberError } = await supabase
        .from('love_space_members')
        .insert({ love_space_id: fallback.id, user_id: userId, role: 'owner' })
      if (memberError) throw memberError
    }
    const data = await loadSharedSpace(userId)
    if (!data) throw new Error('空间已创建，但暂时无法读取；请刷新页面后重试。')
    return data
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
