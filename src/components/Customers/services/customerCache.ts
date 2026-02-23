import { CustomerWithApartments, CustomerCategory, CustomerCounts } from '../types/customerTypes'

const CACHE_TTL_MS = 5 * 60 * 1000

interface CacheEntry<T> {
  data: T
  timestamp: number
}

const customerCache = new Map<string, CacheEntry<CustomerWithApartments[]>>()
let countsCache: CacheEntry<CustomerCounts> | null = null

function cacheKey(category: CustomerCategory | null): string {
  return category ?? '__all__'
}

function isExpired(entry: CacheEntry<unknown>): boolean {
  return Date.now() - entry.timestamp > CACHE_TTL_MS
}

export const cache = {
  getCustomers(category: CustomerCategory | null): CustomerWithApartments[] | null {
    const entry = customerCache.get(cacheKey(category))
    if (!entry || isExpired(entry)) return null
    return entry.data
  },

  setCustomers(category: CustomerCategory | null, data: CustomerWithApartments[]): void {
    customerCache.set(cacheKey(category), { data, timestamp: Date.now() })
  },

  getCounts(): CustomerCounts | null {
    if (!countsCache || isExpired(countsCache)) return null
    return countsCache.data
  },

  setCounts(data: CustomerCounts): void {
    countsCache = { data, timestamp: Date.now() }
  },

  invalidate(): void {
    customerCache.clear()
    countsCache = null
  }
}
