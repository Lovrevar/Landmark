import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../../../lib/supabase'
import { ApartmentWithDetails } from '../types'

interface LinkedUnit {
  id: string
  number: string
  size_m2: number
  price: number
  status: string
}

interface UseApartmentDataResult {
  apartments: ApartmentWithDetails[]
  projects: Array<{ id: string; name: string }>
  buildings: Array<{ id: string; name: string; project_id: string }>
  apartmentPaymentTotals: Record<string, number>
  garagePaymentTotals: Record<string, number>
  storagePaymentTotals: Record<string, number>
  linkedGarages: Record<string, LinkedUnit[]>
  linkedStorages: Record<string, LinkedUnit[]>
  loading: boolean
  refetch: () => void
}

type RawApartment = Record<string, unknown>
type PaymentRow = { amount: string; invoice?: { apartment_id: string } | null }
type GarageLink = { apartment_id: string; garage: LinkedUnit | null }
type StorageLink = { apartment_id: string; repository: LinkedUnit | null }

export function useApartmentData(): UseApartmentDataResult {
  const [apartments, setApartments] = useState<ApartmentWithDetails[]>([])
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([])
  const [buildings, setBuildings] = useState<Array<{ id: string; name: string; project_id: string }>>([])
  const [apartmentPaymentTotals, setApartmentPaymentTotals] = useState<Record<string, number>>({})
  const [garagePaymentTotals] = useState<Record<string, number>>({})
  const [storagePaymentTotals] = useState<Record<string, number>>({})
  const [linkedGarages, setLinkedGarages] = useState<Record<string, LinkedUnit[]>>({})
  const [linkedStorages, setLinkedStorages] = useState<Record<string, LinkedUnit[]>>({})
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: apartmentsData, error: apartmentsError } = await supabase
        .from('apartments')
        .select('*')
        .order('number')

      if (apartmentsError) throw apartmentsError

      const [{ data: allProjects }, { data: allBuildings }] = await Promise.all([
        supabase.from('projects').select('id, name').order('name'),
        supabase.from('buildings').select('id, name, project_id').order('name')
      ])

      setProjects(allProjects || [])
      setBuildings(allBuildings || [])

      const projectIds = [...new Set((apartmentsData || []).map((a: RawApartment) => a.project_id as string))]
      const buildingIds = [
        ...new Set(
          (apartmentsData || [])
            .map((a: RawApartment) => a.building_id as string | null)
            .filter((id): id is string => Boolean(id))
        )
      ]

      const [{ data: projectsData }, { data: buildingsData }, { data: paymentsData }] = await Promise.all([
        supabase.from('projects').select('id, name').in('id', projectIds),
        supabase.from('buildings').select('id, name').in('id', buildingIds),
        supabase
          .from('accounting_payments')
          .select('amount, invoice:accounting_invoices!inner(apartment_id)')
          .not('invoice.apartment_id', 'is', null)
      ])

      const aptPaymentTotals: Record<string, number> = {}
      if (paymentsData) {
        (paymentsData as unknown as PaymentRow[]).forEach((payment) => {
          const apartmentId = payment.invoice?.apartment_id
          if (apartmentId) {
            if (!aptPaymentTotals[apartmentId]) aptPaymentTotals[apartmentId] = 0
            aptPaymentTotals[apartmentId] += parseFloat(payment.amount)
          }
        })
      }
      setApartmentPaymentTotals(aptPaymentTotals)

      const garagesMap: Record<string, LinkedUnit[]> = {}
      const storagesMap: Record<string, LinkedUnit[]> = {}

      if (apartmentsData && apartmentsData.length > 0) {
        const apartmentIds = apartmentsData.map((a: RawApartment) => a.id as string)

        const [{ data: garageLinks }, { data: repositoryLinks }] = await Promise.all([
          supabase
            .from('apartment_garages')
            .select('apartment_id, garage:garages(id, number, size_m2, price, status)')
            .in('apartment_id', apartmentIds),
          supabase
            .from('apartment_repositories')
            .select('apartment_id, repository:repositories(id, number, size_m2, price, status)')
            .in('apartment_id', apartmentIds)
        ])

        if (garageLinks) {
          (garageLinks as unknown as GarageLink[]).forEach((link) => {
            if (!garagesMap[link.apartment_id]) garagesMap[link.apartment_id] = []
            if (link.garage) garagesMap[link.apartment_id].push(link.garage)
          })
        }

        if (repositoryLinks) {
          (repositoryLinks as unknown as StorageLink[]).forEach((link) => {
            if (!storagesMap[link.apartment_id]) storagesMap[link.apartment_id] = []
            if (link.repository) storagesMap[link.apartment_id].push(link.repository)
          })
        }
      }

      setLinkedGarages(garagesMap)
      setLinkedStorages(storagesMap)

      const apartmentsWithDetails = ((apartmentsData || []).map((apt: RawApartment) => {
        const project = projectsData?.find(p => p.id === apt.project_id)
        const building = buildingsData?.find(b => b.id === apt.building_id)
        return {
          id: apt.id,
          number: apt.number,
          floor: apt.floor,
          size_m2: apt.size_m2,
          price: apt.price,
          status: apt.status,
          buyer_name: apt.buyer_name,
          project_name: project?.name || 'Unknown Project',
          building_name: building?.name || 'No Building',
          project_id: apt.project_id,
          building_id: apt.building_id || '',
          ulaz: apt.ulaz ?? null,
          tip_stana: apt.tip_stana ?? null,
          sobnost: apt.sobnost ?? null,
          povrsina_otvoreno: apt.povrsina_otvoreno ?? null,
          povrsina_ot_sa_koef: apt.povrsina_ot_sa_koef ?? null,
          datum_potpisa_predugovora: apt.datum_potpisa_predugovora ?? null,
          contract_payment_type: apt.contract_payment_type ?? null,
          kapara_10_posto: apt.kapara_10_posto ?? null,
          rata_1_ab_konstrukcija_30: apt.rata_1_ab_konstrukcija_30 ?? null,
          rata_2_postava_stolarije_20: apt.rata_2_postava_stolarije_20 ?? null,
          rata_3_obrtnicki_radovi_20: apt.rata_3_obrtnicki_radovi_20 ?? null,
          rata_4_uporabna_20: apt.rata_4_uporabna_20 ?? null,
          kredit_etaziranje_90: apt.kredit_etaziranje_90 ?? null
        }
      })) as unknown as ApartmentWithDetails[]

      setApartments(apartmentsWithDetails)
    } catch (error) {
      console.error('Error fetching apartments:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    apartments,
    projects,
    buildings,
    apartmentPaymentTotals,
    garagePaymentTotals,
    storagePaymentTotals,
    linkedGarages,
    linkedStorages,
    loading,
    refetch: fetchData
  }
}
