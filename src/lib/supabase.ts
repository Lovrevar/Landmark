import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type User = {
  id: string
  username: string
  password: string
  role: 'Director' | 'Accounting' | 'Sales' | 'Supervision'
  created_at: string
}

export type Project = {
  id: string
  name: string
  location: string
  start_date: string
  end_date: string | null
  budget: number
  investor: string | null
  status: 'Planning' | 'In Progress' | 'Completed' | 'On Hold'
  created_at: string
}

export type Task = {
  id: string
  project_id: string
  name: string
  description: string
  assigned_to: string
  deadline: string
  status: 'Pending' | 'In Progress' | 'Completed' | 'Overdue'
  progress: number
  created_at: string
}

export type Invoice = {
  id: string
  project_id: string
  amount: number
  due_date: string
  paid: boolean
  subcontractor_id: string | null
  created_at: string
}

export type Subcontractor = {
  id: string
  name: string
  contact: string
  job_description: string
  progress: number
  deadline: string
  cost: number
  created_at: string
}

export type Apartment = {
  id: string
  project_id: string
  number: string
  floor: number
  size_m2: number
  price: number
  status: 'Available' | 'Reserved' | 'Sold'
  buyer_name: string | null
  created_at: string
}

export type Todo = {
  id: string
  user_id: string
  title: string
  description: string
  completed: boolean
  due_date: string | null
  created_at: string
}