import { supabase } from '../../../lib/supabase'

export interface BusyBlock {
  user_id: string
  start_at: string
  end_at: string
}

export async function fetchBusyBlocks(
  userIds: string[],
  fromIso: string,
  toIso: string,
): Promise<BusyBlock[]> {
  if (userIds.length === 0) return []
  const { data, error } = await supabase.rpc('get_busy_blocks', {
    p_user_ids: userIds,
    p_from: fromIso,
    p_to: toIso,
  })
  if (error) throw error
  return (data || []) as BusyBlock[]
}
