export interface CountySummary {
  county:              string
  affluence_index:     number
  affluence_rank:      number
  affluence_tier:      string
  median_price:        number
  price_cagr_5yr:      number | null
  luxury_share_pct:    number
  transaction_count:   number
  gini_coefficient:    number | null
  daft_median_asking:  number | null
  daft_pct_high_ber:   number | null
}

export interface DistrictData {
  eircode_district:      string
  county:                string
  median_price:          number
  mean_price:            number
  max_price:             number
  tx_count:              number
  luxury_count:          number
  luxury_share_pct:      number
  price_cagr_5yr:        number | null
  price_cv:              number | null
  baseline_price:        number | null
  area_type:             'Established' | 'Emerging' | 'Accelerating' | 'Mature' | 'Stable'
  surprise_score:        number
  surprise_rank:         number
  deprivation_score:     number | null
  wealth_deprivation_tension: number | null
}

export interface HeatmapPoint {
  lat:             number
  lng:             number
  price:           number
  county:          string
  affluence_index: number
  sale_year:       number
  price_tier:      string
}

export interface PriceTrendPoint {
  sale_year: number
  median:    number
  mean:      number
  count:     number
}

export interface CorporateBuyer {
  company_name_extracted: string
  cro_company_name:       string
  cro_company_num:        string
  cro_status:             string
  total_spend:            number
  tx_count:               number
  nationality:            string
  country:                string
  rbo_scraped:            boolean
}

export interface NationalitySummary {
  nationality:    string
  company_count:  number
  total_spend:    number
}

export type ViewType = 'emerging' | 'corporate'

export const TIER_COLOURS: Record<string, string> = {
  'Tier 1 — Elite':     '#C9A84C',
  'Tier 2 — Affluent':  '#1A6B3C',
  'Tier 3 — Middle':    '#3D7A9E',
  'Tier 4 — Emerging':  '#9B6B3E',
}

export const AREA_TYPE_COLOURS: Record<string, string> = {
  Established:  '#C9A84C',
  Accelerating: '#B94A2C',
  Emerging:     '#1A6B3C',
  Mature:       '#3D7A9E',
  Stable:       '#4B5563',
}

export const PRICE_TIER_COLOURS: Record<string, string> = {
  '<200k':    '#4B5563',
  '200-350k': '#3D7A9E',
  '350-500k': '#1A6B3C',
  '500-750k': '#9B6B3E',
  '750k-1m':  '#B94A2C',
  '1m-2m':    '#C9A84C',
  '2m+':      '#FFD700',
}
