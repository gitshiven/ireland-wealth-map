'use client'
import { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, Cell
} from 'recharts'
import { useCountySummary, useEmergingAreas, usePriceTrends } from '@/hooks/useData'
import { TIER_COLOURS, AREA_TYPE_COLOURS } from '@/types'

const fmt = (n: number | null | undefined, prefix = '€') =>
  n == null ? 'n/a' : `${prefix}${n >= 1_000_000 ? (n/1e6).toFixed(2)+'M' : n >= 1_000 ? Math.round(n/1_000)+'k' : n}`

const pct = (n: number | null | undefined) => n == null ? 'n/a' : `${n.toFixed(1)}%`

function Stat({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{
      padding: '0.75rem 1rem',
      background: highlight ? 'rgba(201,168,76,0.08)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${highlight ? 'rgba(201,168,76,0.2)' : '#1f1f1f'}`,
    }}>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#555', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '0.3rem' }}>{label}</p>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 700, color: highlight ? 'var(--gold)' : 'var(--paper)' }}>{value}</p>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#111', border: '1px solid #333', padding: '0.75rem 1rem', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
      <p style={{ color: 'var(--gold)', marginBottom: '0.3rem' }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {typeof p.value === 'number' && p.value > 1000 ? fmt(p.value) : p.value?.toFixed?.(1) ?? p.value}</p>
      ))}
    </div>
  )
}

export default function EmergingView() {
  const { data: counties, loading: cl } = useCountySummary()
  const { data: emerging, loading: el } = useEmergingAreas()
  const { data: trends,   loading: tl } = usePriceTrends()
  const [selectedCounty, setSelectedCounty] = useState<string | null>(null)

  const trendData = useMemo(() => {
    if (!trends || !selectedCounty) return []
    return (trends[selectedCounty] || []).map(d => ({ ...d, year: d.sale_year }))
  }, [trends, selectedCounty])

  const sortedCounties = useMemo(() =>
    [...(counties || [])].sort((a, b) => a.affluence_rank - b.affluence_rank),
  [counties])

  if (cl || el || tl) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#555', letterSpacing: '0.2em' }}>
        LOADING DATA …
      </p>
    </div>
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, minHeight: '80vh' }}>

      {/* ── LEFT PANEL — County Leaderboard ────────────────────────── */}
      <div style={{ borderRight: '1px solid #1f1f1f' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #1f1f1f' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 700 }}>
            Affluence Leaderboard
          </h2>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#555', letterSpacing: '0.12em', marginTop: '0.25rem' }}>
            COMPOSITE INDEX — MEDIAN PRICE + CAGR + LUXURY SHARE + BER
          </p>
        </div>

        <div style={{ maxHeight: '65vh', overflowY: 'auto' }}>
          {sortedCounties.map((c) => (
            <div
              key={c.county}
              onClick={() => setSelectedCounty(c.county === selectedCounty ? null : c.county)}
              style={{
                display: 'grid',
                gridTemplateColumns: '2rem 1fr auto 3.5rem',
                gap: '0.75rem',
                alignItems: 'center',
                padding: '0.7rem 1.5rem',
                borderBottom: '1px solid #111',
                cursor: 'pointer',
                background: selectedCounty === c.county ? 'rgba(201,168,76,0.06)' : 'transparent',
                transition: 'background 0.15s',
              }}
            >
              {/* Rank */}
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#444' }}>
                #{c.affluence_rank}
              </span>

              {/* County + tier */}
              <div>
                <p style={{ fontWeight: 500, fontSize: '0.9rem' }}>{c.county}</p>
                <p style={{
                  fontFamily: 'var(--font-mono)', fontSize: '0.6rem',
                  color: TIER_COLOURS[c.affluence_tier] || '#666',
                  letterSpacing: '0.1em', marginTop: '0.1rem'
                }}>
                  {c.affluence_tier}
                </p>
              </div>

              {/* Median price */}
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#aaa', textAlign: 'right' }}>
                {fmt(c.median_price)}
              </span>

              {/* Index score bar */}
              <div style={{ position: 'relative', height: '4px', background: '#1a1a1a', borderRadius: '2px', width: '100%' }}>
                <div style={{
                  position: 'absolute', left: 0, top: 0, height: '100%',
                  width: `${c.affluence_index}%`,
                  background: TIER_COLOURS[c.affluence_tier] || '#333',
                  borderRadius: '2px',
                  transition: 'width 0.4s ease',
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT PANEL — Insights ──────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>

        {/* Stats row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          borderBottom: '1px solid #1f1f1f',
        }}>
          <Stat label="Total Transactions" value={`${(sortedCounties.reduce((s,c)=>s+c.transaction_count,0)/1000).toFixed(0)}k`} />
          <Stat label="Highest Index"      value={sortedCounties[0]?.county || '—'}     highlight />
          <Stat label="Fastest CAGR"
            value={(() => {
              const best = [...(sortedCounties)].filter(c=>c.price_cagr_5yr!=null).sort((a,b)=>(b.price_cagr_5yr??0)-(a.price_cagr_5yr??0))[0]
              return best ? `${best.county} ${pct(best.price_cagr_5yr)}` : '—'
            })()}
          />
        </div>

        {/* Price trend chart */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #1f1f1f', flex: 1 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.25rem' }}>
            {selectedCounty ? `${selectedCounty} — Price History` : 'Select a county to see price history'}
          </h3>
          {selectedCounty && trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                <XAxis dataKey="year" stroke="#333" tick={{ fill: '#555', fontSize: 10, fontFamily: 'var(--font-mono)' }} />
                <YAxis stroke="#333" tick={{ fill: '#555', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                  tickFormatter={v => `€${Math.round(v/1000)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="median" name="Median" stroke="var(--gold)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="mean"   name="Mean"   stroke="#3D7A9E" strokeWidth={1.5} strokeDasharray="4 2" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: '#333' }}>
                ← Click a county
              </p>
            </div>
          )}
        </div>

        {/* Emerging areas table */}
        <div style={{ padding: '1.25rem 1.5rem', flex: 1 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.25rem' }}>
            Most Surprising Emerging Districts
          </h3>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#555', letterSpacing: '0.12em', marginBottom: '0.75rem' }}>
            HIGH CAGR FROM LOW BASELINE — THE I DIDN&apos;T KNOW THIS TABLE
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'auto auto 1fr 1fr 1fr', gap: '0', fontSize: '0.72rem' }}>
            {/* Headers */}
            {['RNK', 'DIST', 'COUNTY', 'WAS', 'NOW →'].map(h => (
              <div key={h} style={{
                padding: '0.35rem 0.5rem',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.6rem',
                color: '#444',
                letterSpacing: '0.1em',
                borderBottom: '1px solid #1f1f1f',
              }}>{h}</div>
            ))}
            {/* Rows */}
            {(emerging || []).slice(0, 8).map((d, i) => (
              <>
                <div key={`r${i}`} style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid #111', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#555' }}>#{d.surprise_rank}</div>
                <div key={`d${i}`} style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid #111', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: AREA_TYPE_COLOURS[d.area_type], fontWeight: 500 }}>{d.eircode_district}</div>
                <div key={`c${i}`} style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid #111', fontSize: '0.75rem' }}>{d.county}</div>
                <div key={`b${i}`} style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid #111', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#666' }}>{fmt(d.baseline_price)}</div>
                <div key={`n${i}`} style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid #111', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--paper)' }}>{fmt(d.median_price)}</span>
                  {d.price_cagr_5yr != null && (
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: '0.6rem',
                      color: d.price_cagr_5yr > 0 ? '#1A6B3C' : 'var(--rust)',
                      background: d.price_cagr_5yr > 0 ? 'rgba(26,107,60,0.15)' : 'rgba(185,74,44,0.15)',
                      padding: '0.1rem 0.3rem',
                    }}>
                      {d.price_cagr_5yr > 0 ? '▲' : '▼'} {Math.abs(d.price_cagr_5yr).toFixed(1)}%
                    </span>
                  )}
                </div>
              </>
            ))}
          </div>

          {!emerging?.length && (
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: '#333', marginTop: '1rem' }}>
              Run pipeline with real PPR data to see emerging district analysis.
            </p>
          )}
        </div>

      </div>
    </div>
  )
}
