import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

console.log('Supabase config:', {
  url: supabaseUrl,
  key: supabaseAnonKey ? 'Present' : 'Missing'
})

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
  created_by: string
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

export type TaskComment = {
  id: string
  task_id: string
  user_id: string
  comment: string
  created_at: string
  user?: {
    username: string
    role: string
  }
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

export type WorkLog = {
  id: string
  subcontractor_id: string
  date: string
  workers_count: number
  work_description: string
  hours_worked: number
  notes: string
  photos: string[]
  created_by: string
  created_at: string
}

export type SubcontractorComment = {
  id: string
  subcontractor_id: string
  user_id: string
  comment: string
  comment_type: 'completed' | 'issue' | 'general'
  created_at: string
  user?: {
    username: string
    role: string
  }
}

export type Customer = {
  id: string
  name: string
  surname: string
  email: string
  phone: string
  address: string
  bank_account: string
  id_number: string
  status: 'buyer' | 'interested' | 'lead'
  created_at: string
}

export type Sale = {
  id: string
  apartment_id: string
  customer_id: string
  sale_price: number
  payment_method: 'cash' | 'credit' | 'bank_loan' | 'installments'
  down_payment: number
  total_paid: number
  remaining_amount: number
  next_payment_date: string | null
  monthly_payment: number
  sale_date: string
  contract_signed: boolean
  notes: string
  created_at: string
}

export type Lead = {
  id: string
  customer_id: string
  project_id: string
  apartment_preferences: string
  budget_range_min: number
  budget_range_max: number
  priority: 'high' | 'medium' | 'low'
  status: 'new' | 'contacted' | 'viewing_scheduled' | 'negotiating' | 'closed'
  last_contact_date: string
  next_follow_up: string
  notes: string
  created_at: string
}

export type Customer = {
  id: string
  name: string
  surname: string
  email: string
  phone: string
  address: string
  bank_account: string
  id_number: string
  status: 'buyer' | 'interested' | 'lead'
  created_at: string
}

export type Sale = {
  id: string
  apartment_id: string
  customer_id: string
  sale_price: number
  payment_method: 'cash' | 'credit' | 'bank_loan' | 'installments'
  down_payment: number
  total_paid: number
  remaining_amount: number
  next_payment_date: string | null
  monthly_payment: number
  sale_date: string
  contract_signed: boolean
  notes: string
  created_at: string
}

export type Lead = {
  id: string
  customer_id: string
  project_id: string
  apartment_preferences: string
  budget_range_min: number
  budget_range_max: number
  priority: 'high' | 'medium' | 'low'
  status: 'new' | 'contacted' | 'viewing_scheduled' | 'negotiating' | 'closed'
  last_contact_date: string
  next_follow_up: string
  notes: string
  created_at: string
}