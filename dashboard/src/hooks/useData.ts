'use client'
import { useState, useEffect } from 'react'
import type {
  CountySummary, DistrictData, HeatmapPoint,
  PriceTrendPoint, CorporateBuyer, NationalitySummary
} from '@/types'

function useData<T>(path: string) {
  const [data, setData]     = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)

  useEffect(() => {
    fetch(path)
      .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json() })
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [path])

  return { data, loading, error }
}

export function useCountySummary() {
  return useData<CountySummary[]>('/data/county_summary.json')
}

export function useDistrictData() {
  return useData<DistrictData[]>('/data/district_data.json')
}

export function useEmergingAreas() {
  return useData<DistrictData[]>('/data/emerging_areas.json')
}

export function useHeatmapPoints() {
  return useData<HeatmapPoint[]>('/data/heatmap_points.json')
}

export function usePriceTrends() {
  return useData<Record<string, PriceTrendPoint[]>>('/data/price_trends.json')
}

export function useCorporateBuyers() {
  return useData<CorporateBuyer[]>('/data/corporate_buyers.json')
}

export function useNationalitySummary() {
  return useData<NationalitySummary[]>('/data/nationality_summary.json')
}
