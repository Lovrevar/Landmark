export interface ApartmentFormData {
  project_id: string
  building_id: string
  number: string
  floor: number
  size_m2: number
  price: number
  ulaz?: string
  tip_stana?: string
  sobnost?: number | null
  povrsina_otvoreno?: number | null
  povrsina_ot_sa_koef?: number | null
  datum_potpisa_predugovora?: string | null
  contract_payment_type?: 'credit' | 'installments' | null
  kapara_10_posto?: string | null
  rata_1_ab_konstrukcija_30?: string | null
  rata_2_postava_stolarije_20?: string | null
  rata_3_obrtnicki_radovi_20?: string | null
  rata_4_uporabna_20?: string | null
  kredit_etaziranje_90?: string | null
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
  ulaz?: string | null
  tip_stana?: string | null
  sobnost?: number | null
  povrsina_otvoreno?: number | null
  povrsina_ot_sa_koef?: number | null
  datum_potpisa_predugovora?: string | null
  contract_payment_type?: 'credit' | 'installments' | null
  kapara_10_posto?: string | null
  rata_1_ab_konstrukcija_30?: string | null
  rata_2_postava_stolarije_20?: string | null
  rata_3_obrtnicki_radovi_20?: string | null
  rata_4_uporabna_20?: string | null
  kredit_etaziranje_90?: string | null
  garages?: Array<{
    id: string
    number: string
    size_m2: number
    price: number
    status: string
  }>
  repositories?: Array<{
    id: string
    number: string
    size_m2: number
    price: number
    status: string
  }>
}

export interface ApartmentPayment {
  id: string
  apartment_id: string
  customer_id: string
  project_id: string
  sale_id: string | null
  amount: number
  payment_date: string
  payment_type: 'down_payment' | 'installment' | 'final_payment' | 'other'
  notes: string
  garage_id: string | null
  storage_id: string | null
  created_at: string
  updated_at: string
}

export interface PaymentWithCustomer extends ApartmentPayment {
  customer_name: string
  customer_surname: string
  customer_email: string
}
