import { supabase } from './supabaseClient'

export async function listProjects() {
  return supabase
    .from('projects')
    .select('*')
    .order('name')
}
