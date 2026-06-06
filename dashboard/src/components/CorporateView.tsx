'use client'
import { useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts'
import { useCorporateBuyers, useNationalitySummary } from '@/hooks/useData'

const fmt = (n: number | null | undefined) =>
  n == null ? 'n/a'
  : n >= 1_000_000_000 ? `€${(n/1e9).toFixed(2)}B`
  : n >= 1_000_000     ? `€${(n/1e6).toFixed(1)}M`
  : `€${Math.round(n/1000)}k`

const NAT_COLOURS = [
  '#C9A84C', '#1A6B3C', '#3D7A9E', '#B94A2C',
  '#9B6B3E', '#5B4A8A', '#2D7A6B', '#8A4A5B',
]

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#111', border: '1px solid #333', padding: '0.75rem 1rem', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
      <p style={{ color: 'var(--gold)' }}>{payload[0]?.name || payload[0]?.payload?.nationality}</p>
      <p style={{ color: '#aaa' }}>Companies: {payload[0]?.payload?.company_count}</p>
      <p style={{ color: '#aaa' }}>Total Spend: {fmt(payload[0]?.payload?.total_spend)}</p>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100%', padding: '3rem',
      textAlign: 'center', gap: '1rem',
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%',
        border: '1px solid #333',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: '#333',
      }}>?</div>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: '#444', letterSpacing: '0.1em', maxWidth: '40ch' }}>{message}</p>
    </div>
  )
}

export default function CorporateView() {
  const { data: buyers,  loading: bl } = useCorporateBuyers()
  const { data: natData, loading: nl } = useNationalitySummary()

  const hasData = !bl && !nl && (buyers?.length || natData?.length)

  const topBuyers = useMemo(() =>
    [...(buyers || [])].sort((a, b) => b.total_spend - a.total_spend).slice(0, 15),
  [buyers])

  const natChartData = useMemo(() =>
    (natData || []).filter(d => d.nationality && d.nationality !== 'Unknown' && d.nationality !== 'Pending').slice(0, 8),
  [natData])

  const irishShare = useMemo(() => {
    if (!natData?.length) return null
    const total  = natData.reduce((s, d) => s + d.company_count, 0)
    const irish  = natData.find(d => d.nationality === 'Irish' || d.nationality === 'Ireland')?.company_count || 0
    return total > 0 ? (irish / total * 100).toFixed(1) : null
  }, [natData])

  if (bl || nl) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#555', letterSpacing: '0.2em' }}>LOADING …</p>
    </div>
  )

  if (!hasData) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '70vh', gap: '2rem', padding: '3rem' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 700, textAlign: 'center' }}>
        Corporate &amp; Foreign Ownership
      </h2>
      <div style={{ maxWidth: '55ch', textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.95rem', color: '#888', lineHeight: 1.7 }}>
          This view shows nationality of beneficial owners behind corporate property purchases ≥€500k.
        </p>
        <div style={{ marginTop: '1.5rem', padding: '1.5rem', border: '1px solid #1f1f1f', background: 'rgba(255,255,255,0.02)', textAlign: 'left' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--gold)', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>TO UNLOCK THIS VIEW:</p>
          {[
            '1. Run: python run_pipeline.py --steps 1,7,8',
            '2. Requires: real PPR-ALL.csv (not synthetic)',
            '3. Step 8 needs: playwright install chromium',
            '4. Expected: ~500 companies, ~2hr runtime',
          ].map(s => (
            <p key={s} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: '#555', marginBottom: '0.4rem' }}>{s}</p>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, minHeight: '80vh' }}>

      {/* ── LEFT — Nationality breakdown ───────────────────────────── */}
      <div style={{ borderRight: '1px solid #1f1f1f' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #1f1f1f' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 700 }}>
            Who Owns the €500k+ Market?
          </h2>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#555', letterSpacing: '0.12em', marginTop: '0.25rem' }}>
            NATIONALITY OF BENEFICIAL OWNERS — CORPORATE PROPERTY PURCHASES
          </p>
        </div>

        {/* Key stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '1px solid #1f1f1f' }}>
          {[
            { label: 'Companies Identified', value: buyers?.length?.toString() || '0' },
            { label: 'Irish-owned',           value: irishShare ? `${irishShare}%` : '—' },
            { label: 'Total Corporate Spend', value: fmt(buyers?.reduce((s,b)=>s+b.total_spend,0)) },
          ].map(s => (
            <div key={s.label} style={{ padding: '0.75rem 1rem', borderRight: '1px solid #1f1f1f' }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.3rem' }}>{s.label}</p>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 700 }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Pie chart */}
        {natChartData.length > 0 ? (
          <div style={{ padding: '1rem 1.5rem' }}>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={natChartData} dataKey="company_count" nameKey="nationality"
                     cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                  {natChartData.map((_, i) => (
                    <Cell key={i} fill={NAT_COLOURS[i % NAT_COLOURS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', marginTop: '0.5rem' }}>
              {natChartData.map((d, i) => (
                <div key={d.nationality} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <div style={{ width: 8, height: 8, background: NAT_COLOURS[i % NAT_COLOURS.length], borderRadius: '50%' }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#888' }}>
                    {d.nationality} ({d.company_count})
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState message="NATIONALITY DATA NOT YET SCRAPED — RUN STEP 7B (RBO PLAYWRIGHT SCRAPER)" />
        )}

        {/* Bar chart — spend by nationality */}
        {natChartData.length > 0 && (
          <div style={{ padding: '0 1.5rem 1.25rem' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#444', letterSpacing: '0.12em', marginBottom: '0.5rem' }}>TOTAL SPEND BY NATIONALITY</p>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={natChartData} layout="vertical" margin={{ left: 60, right: 10 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="nationality" tick={{ fill: '#666', fontSize: 10, fontFamily: 'var(--font-mono)' }} width={60} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total_spend" name="Total Spend" radius={[0,2,2,0]}>
                  {natChartData.map((_, i) => <Cell key={i} fill={NAT_COLOURS[i % NAT_COLOURS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── RIGHT — Top corporate buyers ───────────────────────────── */}
      <div>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #1f1f1f' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 700 }}>
            Top Corporate Buyers
          </h2>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#555', letterSpacing: '0.12em', marginTop: '0.25rem' }}>
            RANKED BY TOTAL PROPERTY SPEND · CRO VERIFIED
          </p>
        </div>

        <div style={{ maxHeight: '75vh', overflowY: 'auto' }}>
          {topBuyers.length > 0 ? topBuyers.map((b, i) => (
            <div key={i} style={{
              display: 'grid',
              gridTemplateColumns: '1.5rem 1fr auto',
              gap: '0.75rem',
              alignItems: 'start',
              padding: '0.85rem 1.5rem',
              borderBottom: '1px solid #111',
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#444', paddingTop: '0.1rem' }}>
                {i + 1}
              </span>
              <div>
                <p style={{ fontSize: '0.85rem', fontWeight: 500, lineHeight: 1.3 }}>{b.cro_company_name || b.company_name_extracted}</p>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.3rem', flexWrap: 'wrap' }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: '0.6rem', letterSpacing: '0.08em',
                    padding: '0.1rem 0.4rem',
                    background: b.nationality === 'Irish' || b.nationality === 'Ireland'
                      ? 'rgba(26,107,60,0.15)' : 'rgba(185,74,44,0.12)',
                    color: b.nationality === 'Irish' || b.nationality === 'Ireland'
                      ? '#1A6B3C' : '#B94A2C',
                  }}>
                    {b.nationality || 'Unknown'}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#444',
                    padding: '0.1rem 0.4rem', background: 'rgba(255,255,255,0.04)',
                  }}>
                    {b.tx_count} transactions
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#444',
                    padding: '0.1rem 0.4rem', background: 'rgba(255,255,255,0.04)',
                  }}>
                    {b.cro_status || 'Unverified'}
                  </span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--gold)', fontWeight: 500 }}>
                  {fmt(b.total_spend)}
                </p>
              </div>
            </div>
          )) : (
            <EmptyState message="RUN PIPELINE STEPS 7 + 7B WITH REAL PPR DATA TO SEE CORPORATE BUYERS" />
          )}
        </div>
      </div>
    </div>
  )
}
