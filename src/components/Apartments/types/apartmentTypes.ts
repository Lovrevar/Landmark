export interface ApartmentFormData {
  project_id: string
  building_id: string
  number: string
  floor: number
  size_m2: number
  price: number
}

export interface BulkApartmentData {
  project_id: string
  building_id: string
  start_number: number
  quantity: number
  floor: number
  size_m2: number
  price: number
}

export interface ApartmentWithDetails {
  id: string
  number: string
  floor: number
  size_m2: number
  price: number
  status: string
  buyer_name: string | null
  project_name: string
  building_name: string
  project_id: string
  building_id: string
}

export interface ApartmentPayment {
  id: string
  apartment_id: string
  amount: number
  payment_date: string
  notes: string
  created_by: string
  created_at: string
}

export interface PaymentWithUser extends ApartmentPayment {
  user_email: string
}
