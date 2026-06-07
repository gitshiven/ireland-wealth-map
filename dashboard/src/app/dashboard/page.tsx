'use client'
import { useState, useMemo, useEffect, useRef } from 'react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, ComposedChart, Legend,
} from 'recharts'
import { useCountySummary, useEmergingAreas, usePriceTrends, useHeatmapPoints } from '@/hooks/useData'

// ── helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number | null | undefined) =>
  n == null ? 'n/a'
  : n >= 1_000_000 ? `€${(n/1e6).toFixed(1)}M`
  : n >= 1_000    ? `€${Math.round(n/1_000)}k`
  : `€${n}`

const pct = (n: number | null | undefined) => n == null ? 'n/a' : `${n.toFixed(1)}%`

const TIER_COLORS: Record<string, string> = {
  'Tier 1 — Elite':    '#F59E0B',
  'Tier 2 — Affluent': '#4A7C59',
  'Tier 3 — Middle':   '#3B82F6',
  'Tier 4 — Emerging': '#8B5CF6',
}

const PRICE_TIER_COLORS: Record<string, string> = {
  '<200k':    '#94A3B8',
  '200-350k': '#60A5FA',
  '350-500k': '#4A7C59',
  '500-750k': '#F59E0B',
  '750k-1m':  '#F97316',
  '1m-2m':    '#EF4444',
  '2m+':      '#7C3AED',
}

const CT = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'#fff', border:'1px solid #E5E7EB', padding:'0.6rem 0.8rem', borderRadius:8, boxShadow:'0 4px 12px rgba(0,0,0,0.08)', fontSize:'0.72rem', fontFamily:'monospace' }}>
      <p style={{ color:'#4A7C59', fontWeight:700, marginBottom:'0.25rem' }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color:'#374151' }}>{p.name}: {typeof p.value==='number'&&p.value>1000?fmt(p.value):typeof p.value==='number'?p.value.toFixed(1)+'%':p.value}</p>
      ))}
    </div>
  )
}

// ── County positions on Ireland map ──────────────────────────────────────────
const COUNTY_POS: Record<string,[number,number]> = {
  Dublin:[78,52],Wicklow:[76,60],Wexford:[74,70],Waterford:[62,76],
  Cork:[40,85],Kerry:[18,78],Limerick:[30,66],Tipperary:[50,68],
  Kilkenny:[62,67],Clare:[26,59],Galway:[20,53],Offaly:[52,55],
  Laois:[60,60],Carlow:[64,64],Kildare:[66,56],Meath:[66,46],
  Louth:[72,40],Monaghan:[64,33],Cavan:[58,36],Longford:[50,47],
  Westmeath:[54,50],Roscommon:[38,46],Mayo:[20,40],Sligo:[34,33],
  Leitrim:[42,36],Donegal:[32,20],
}

// ── Ireland map with pins + optional heatmap dots ─────────────────────────────
function IrelandMap({ counties, selected, onSelect, heatmap, showHeat }: any) {
  const maxIdx = Math.max(...counties.map((c: any) => c.affluence_index||0), 1)
  return (
    <div style={{ position:'relative', width:'100%', height:'100%' }}>
      <img src="/ireland_map.jpg" alt="Ireland" style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center', filter:'saturate(0.75) brightness(0.88)', display:'block' }}/>
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.12)', pointerEvents:'none' }}/>

      {/* Heatmap dots */}
      {showHeat && heatmap?.slice(0,8000).map((pt: any, i: number) => {
        if (!pt.lat || !pt.lng) return null
        const x = ((pt.lng - (-10.7)) / ((-5.9) - (-10.7))) * 100
        const y = ((54.4 - pt.lat) / (54.4 - 51.4)) * 100
        if (x < 0 || x > 100 || y < 0 || y > 100) return null
        const col = PRICE_TIER_COLORS[pt.price_tier] || '#94A3B8'
        return (
          <div key={i} style={{ position:'absolute', left:`${x}%`, top:`${y}%`, width: pt.is_luxury ? 5 : 3, height: pt.is_luxury ? 5 : 3, borderRadius:'50%', background: col, opacity: pt.geo_source==='nominatim' ? 0.85 : 0.35, transform:'translate(-50%,-50%)', pointerEvents:'none' }}/>
        )
      })}

      {/* County pins */}
      {counties.map((c: any) => {
        const pos = COUNTY_POS[c.county]; if (!pos) return null
        const intensity = (c.affluence_index||0)/maxIdx
        const r = 7 + intensity*9
        const isSel = selected===c.county
        const color = TIER_COLORS[c.affluence_tier]||'#9CA3AF'
        return (
          <div key={c.county} onClick={()=>onSelect(c.county)} style={{ position:'absolute', left:`${pos[0]}%`, top:`${pos[1]}%`, transform:'translate(-50%,-100%)', cursor:'pointer', zIndex: isSel?20:10 }}>
            {isSel && <div style={{ position:'absolute', bottom:'100%', left:'50%', transform:'translateX(-50%)', marginBottom:4, background:'#1a1a1a', color:'#fff', padding:'3px 8px', borderRadius:4, whiteSpace:'nowrap', fontSize:'0.6rem', fontFamily:'monospace', zIndex:30 }}>
              {c.county} · {fmt(c.median_price)}
              <div style={{ position:'absolute', top:'100%', left:'50%', transform:'translateX(-50%)', width:0, height:0, borderLeft:'4px solid transparent', borderRight:'4px solid transparent', borderTop:'4px solid #1a1a1a' }}/>
            </div>}
            <div style={{ width:isSel?r+4:r, height:isSel?r+4:r, borderRadius:'50%', background:color, border:`${isSel?2.5:1.5}px solid rgba(255,255,255,${isSel?1:0.6})`, boxShadow: isSel?`0 0 0 4px ${color}40, 0 3px 8px rgba(0,0,0,0.4)`:'0 2px 6px rgba(0,0,0,0.3)', transition:'all 0.15s' }}/>
            <div style={{ width:2, height:isSel?10:7, background:color, margin:'0 auto', borderRadius:'0 0 2px 2px' }}/>
          </div>
        )
      })}

      {/* Legend */}
      <div style={{ position:'absolute', bottom:10, left:10, background:'rgba(0,0,0,0.65)', backdropFilter:'blur(8px)', padding:'6px 10px', borderRadius:6, display:'flex', flexDirection:'column', gap:3 }}>
        {[['Elite','#F59E0B'],['Affluent','#4A7C59'],['Middle','#3B82F6'],['Emerging','#8B5CF6']].map(([l,c])=>(
          <div key={l} style={{ display:'flex', alignItems:'center', gap:5 }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background:c }}/>
            <span style={{ fontFamily:'monospace', fontSize:'0.52rem', color:'rgba(255,255,255,0.8)' }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function KPI({ icon, label, value, sub, color='#4A7C59' }: any) {
  return (
    <div style={{ background:'#fff', borderRadius:12, border:'1px solid #F0F0F0', padding:'1rem 1.25rem', display:'flex', alignItems:'center', gap:'0.9rem', boxShadow:'0 1px 8px rgba(0,0,0,0.04)' }}>
      <div style={{ width:42, height:42, borderRadius:10, background:`${color}15`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.2rem', flexShrink:0 }}>{icon}</div>
      <div>
        <p style={{ fontSize:'0.68rem', color:'#9CA3AF', fontWeight:500, marginBottom:'0.15rem', textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</p>
        <p style={{ fontSize:'1.3rem', fontWeight:800, color:'#111', lineHeight:1 }}>{value}</p>
        {sub && <p style={{ fontSize:'0.65rem', color, fontWeight:600, marginTop:'0.15rem' }}>{sub}</p>}
      </div>
    </div>
  )
}

function Card({ title, sub, children, style={} }: any) {
  return (
    <div style={{ background:'#fff', borderRadius:12, border:'1px solid #F0F0F0', boxShadow:'0 1px 8px rgba(0,0,0,0.04)', overflow:'hidden', ...style }}>
      {title && (
        <div style={{ padding:'0.85rem 1.1rem', borderBottom:'1px solid #F9FAFB', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <p style={{ fontWeight:700, fontSize:'0.82rem', color:'#111' }}>{title}</p>
          {sub && <span style={{ fontSize:'0.62rem', color:'#9CA3AF', fontFamily:'monospace', letterSpacing:'0.08em' }}>{sub}</span>}
        </div>
      )}
      <div style={{ padding:'0.85rem 1.1rem' }}>{children}</div>
    </div>
  )
}

// ── Main dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  // If user lands here directly without seeing landing, that's fine — dashboard works standalone
  const { data: counties } = useCountySummary()
  const { data: emerging } = useEmergingAreas()
  const { data: trends   } = usePriceTrends()
  const { data: heatmap  } = useHeatmapPoints()
  const [selected, setSelected] = useState('Dublin')
  const [activeTab, setActiveTab] = useState<'all'|'emerging'>('all')
  const [showHeat, setShowHeat] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const sorted = useMemo(() => [...(counties||[])].sort((a,b)=>a.affluence_rank-b.affluence_rank), [counties])
  const sel = useMemo(() => sorted.find(c=>c.county===selected), [sorted, selected])
  const trendData = useMemo(() => (trends?.[selected]||[]).map(d=>({ year:String(d.sale_year), median:d.median, count:d.count })), [trends, selected])
  const topCAGR = useMemo(() => [...sorted].filter(c=>c.price_cagr_5yr!=null).sort((a,b)=>(b.price_cagr_5yr||0)-(a.price_cagr_5yr||0)).slice(0,10), [sorted])
  const topGini = useMemo(() => [...sorted].filter(c=>c.gini_coefficient!=null).sort((a,b)=>(b.gini_coefficient||0)-(a.gini_coefficient||0)).slice(0,10), [sorted])
  const tierDist = useMemo(() => { const t:any={}; sorted.forEach(c=>{t[c.affluence_tier]=(t[c.affluence_tier]||0)+1}); return Object.entries(t).map(([name,value])=>({name:name.split('—')[1]?.trim()||name,value,color:TIER_COLORS[name]||'#9CA3AF'})) }, [sorted])
  const totalTx = sorted.reduce((s,c)=>s+c.transaction_count,0)
  const luxuryOverTime = useMemo(() => {
    const byYear: Record<number,number> = {}
    ;(heatmap||[]).filter((p:any)=>p.is_luxury).forEach((p:any)=>{ byYear[p.sale_year]=(byYear[p.sale_year]||0)+1 })
    return Object.entries(byYear).sort((a,b)=>+a[0]-+b[0]).map(([year,count])=>({year,count}))
  }, [heatmap])
  const txByYear = useMemo(() => {
    const byYear: Record<number,number> = {}
    ;(heatmap||[]).forEach((p:any)=>{ byYear[p.sale_year]=(byYear[p.sale_year]||0)+1 })
    return Object.entries(byYear).sort((a,b)=>+a[0]-+b[0]).map(([year,count])=>({year,count}))
  }, [heatmap])
  const top = sorted[0]
  const fastest = topCAGR[0]

  if (!mounted) return null

  return (
    <div style={{ minHeight:'100vh', background:'#F8F9FA', fontFamily:'system-ui, sans-serif' }}>

      {/* Topbar */}
      <div style={{ background:'#fff', borderBottom:'1px solid #F0F0F0', padding:'0.7rem 1.5rem', display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, zIndex:50 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'0.6rem' }}>
          <a href="/" style={{ fontWeight:900, fontSize:'0.85rem', color:'#1a1a1a', textDecoration:'none', letterSpacing:'-0.02em', textTransform:'uppercase' }}>
            Ireland<span style={{ color:'#4A7C59' }}>.</span>WealthMap
          </a>
          <span style={{ fontWeight:400, color:'#9CA3AF', fontSize:'0.8rem' }}>Analytics Dashboard</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'1rem' }}>

          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:'#22C55E' }}/>
            <span style={{ fontSize:'0.65rem', color:'#9CA3AF', fontFamily:'monospace' }}>LIVE · PPR DATA</span>
          </div>
        </div>
      </div>

      <div style={{ padding:'1.25rem 1.5rem', display:'flex', flexDirection:'column', gap:'1rem' }}>

        {/* KPIs */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'0.85rem' }}>
          <KPI icon="🏠" label="Total Transactions" value={`${(totalTx/1000).toFixed(0)}k`} sub="Since 2010" color="#4A7C59"/>
          <KPI icon="🏆" label="Top County" value={top?.county||'Dublin'} sub={`Index ${top?.affluence_index?.toFixed(1)||'72.2'}`} color="#F59E0B"/>
          <KPI icon="📈" label="Fastest Growing" value={fastest?.county||'Sligo'} sub={`${pct(fastest?.price_cagr_5yr)} CAGR`} color="#3B82F6"/>
          <KPI icon="💎" label="Luxury Sales" value="15,588" sub="Properties above 1M euro" color="#8B5CF6"/>
        </div>

        {/* Row 1: Map + County table + Price history */}
        <div style={{ display:'grid', gridTemplateColumns:'1.4fr 0.8fr 1fr', gap:'0.85rem' }}>

          {/* Ireland map */}
          <div style={{ background:'#fff', borderRadius:12, border:'1px solid #F0F0F0', overflow:'hidden', boxShadow:'0 1px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ padding:'0.85rem 1.1rem', borderBottom:'1px solid #F9FAFB', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
              <div>
                <p style={{ fontWeight:700, fontSize:'0.82rem', color:'#111' }}>Ireland Property Map</p>
                <p style={{ fontSize:'0.62rem', color:'#9CA3AF', marginTop:2 }}>Click any county pin to explore its data</p>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                {!showHeat && (
                  <div style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px', background:'#F9FAFB', borderRadius:6, border:'1px solid #F0F0F0' }}>
                    <span style={{ fontSize:'0.58rem', color:'#9CA3AF', fontFamily:'monospace', letterSpacing:'0.08em' }}>
                      HEATMAP: shows 50k property sales as dots coloured by price band across all districts
                    </span>
                  </div>
                )}
                <button
                  onClick={()=>setShowHeat(v=>!v)}
                  title="Shows 50,000 property transactions as coloured dots across Ireland's Eircode districts. Brighter dots = higher value sales."
                  style={{ fontSize:'0.68rem', padding:'4px 14px', borderRadius:20, border:'1px solid', borderColor: showHeat?'#4A7C59':'#D1D5DB', color: showHeat?'#fff':'#6B7280', background: showHeat?'#4A7C59':'transparent', cursor:'pointer', fontWeight:600, whiteSpace:'nowrap', transition:'all 0.2s' }}>
                  {showHeat ? 'Hide Heatmap' : 'Show Heatmap'}
                </button>
              </div>
            </div>
            {showHeat && (
              <div style={{ padding:'6px 1.1rem', background:'#F0FFF4', borderBottom:'1px solid #D1FAE5', display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                <span style={{ fontSize:'0.6rem', color:'#4A7C59', fontFamily:'monospace', fontWeight:600 }}>HEATMAP ACTIVE</span>
                <span style={{ fontSize:'0.6rem', color:'#6B7280', fontFamily:'monospace' }}>Each dot = one property sale across Ireland Eircode districts</span>
                <div style={{ display:'flex', gap:8, marginLeft:'auto', flexWrap:'wrap' }}>
                  {[['#94A3B8','Below 200k'],['#60A5FA','200-350k'],['#4A7C59','350-500k'],['#F59E0B','500-750k'],['#EF4444','Above 1M']].map(([c,l])=>(
                    <div key={l} style={{ display:'flex', alignItems:'center', gap:3 }}>
                      <div style={{ width:7, height:7, borderRadius:'50%', background:c }}/>
                      <span style={{ fontSize:'0.58rem', color:'#6B7280' }}>{l}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ height:380 }}>
              <IrelandMap counties={sorted} selected={selected} onSelect={setSelected} heatmap={heatmap} showHeat={showHeat}/>
            </div>
          </div>

          {/* County table */}
          <Card title="County Rankings" sub="ALL 26">
            <div style={{ display:'flex', gap:4, marginBottom:8 }}>
              {(['all','emerging'] as const).map(t=>(
                <button key={t} onClick={()=>setActiveTab(t)} style={{ padding:'3px 10px', borderRadius:6, border:'none', cursor:'pointer', fontSize:'0.65rem', fontWeight:600, background:activeTab===t?'#4A7C59':'transparent', color:activeTab===t?'#fff':'#9CA3AF' }}>
                  {t==='all'?'All':'Emerging'}
                </button>
              ))}
            </div>
            <div style={{ maxHeight:320, overflowY:'auto' }}>
              {(activeTab==='all'?sorted:(emerging||[])).slice(0,26).map((c:any,i:number)=>(
                <div key={i} onClick={()=>{if(c.county)setSelected(c.county)}} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 0', borderBottom:'1px solid #F9FAFB', cursor:'pointer', background:selected===c.county?'#F0FFF4':'' }}>
                  <span style={{ fontFamily:'monospace', fontSize:'0.58rem', color:'#D1D5DB', width:18 }}>{activeTab==='all'?`#${c.affluence_rank}`:c.eircode_district||`#${i+1}`}</span>
                  <div style={{ flex:1 }}>
                    <p style={{ fontSize:'0.75rem', fontWeight:600, color:'#111' }}>{c.county}</p>
                    <div style={{ marginTop:2, height:3, background:'#F3F4F6', borderRadius:2 }}>
                      <div style={{ height:'100%', borderRadius:2, width:activeTab==='all'?`${c.affluence_index||0}%`:`${Math.min((c.price_cagr_5yr||0)*3,100)}%`, background:TIER_COLORS[c.affluence_tier]||'#4A7C59', transition:'width 0.4s' }}/>
                    </div>
                  </div>
                  <span style={{ fontFamily:'monospace', fontSize:'0.6rem', color:'#9CA3AF' }}>
                    {activeTab==='all'?fmt(c.median_price):(c.price_cagr_5yr!=null?`${c.price_cagr_5yr>0?'▲':'▼'}${Math.abs(c.price_cagr_5yr).toFixed(1)}%`:'n/a')}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Price history + county stats */}
          <div style={{ display:'flex', flexDirection:'column', gap:'0.85rem' }}>
            <Card title={selected ? `${selected} Price History` : 'Select a County'} sub="2010 TO 2024" style={{ flex:1 }}>
              {sel && (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:10 }}>
                  {[
                    { label:'Affluence Index', value:sel.affluence_index?.toFixed(1)||'n/a', color:'#4A7C59' },
                    { label:'Median Price',    value:fmt(sel.median_price),                  color:'#F59E0B' },
                    { label:'5yr CAGR',        value:pct(sel.price_cagr_5yr),               color:'#3B82F6' },
                    { label:'Gini',            value:sel.gini_coefficient?.toFixed(3)||'n/a',color:'#8B5CF6' },
                  ].map(s=>(
                    <div key={s.label} style={{ padding:'6px 8px', background:'#F9FAFB', borderRadius:6 }}>
                      <p style={{ fontSize:'0.58rem', color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'0.08em' }}>{s.label}</p>
                      <p style={{ fontSize:'1rem', fontWeight:800, color:s.color, lineHeight:1.2 }}>{s.value}</p>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ height:160 }}>
                {trendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData} margin={{top:5,right:5,bottom:0,left:0}}>
                      <defs>
                        <linearGradient id="gr" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4A7C59" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#4A7C59" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="year" stroke="transparent" tick={{fill:'#D1D5DB',fontSize:8,fontFamily:'monospace'}} interval={2}/>
                      <YAxis stroke="transparent" tick={{fill:'#D1D5DB',fontSize:8,fontFamily:'monospace'}} tickFormatter={v=>`€${Math.round(v/1000)}k`} width={40}/>
                      <Tooltip content={<CT/>}/>
                      <Area type="monotone" dataKey="median" name="Median Price" stroke="#4A7C59" strokeWidth={2.5} fill="url(#gr)" dot={false} activeDot={{r:4,fill:'#4A7C59'}}/>
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{height:'100%',display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <p style={{color:'#D1D5DB',fontSize:'0.75rem'}}>Select a county</p>
                  </div>
                )}
              </div>
            </Card>

            {/* Tier donut */}
            <Card title="County Tier Split">
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', alignItems:'center', gap:8 }}>
                <div style={{ height:100 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={tierDist} dataKey="value" cx="50%" cy="50%" outerRadius={42} innerRadius={24} paddingAngle={2}>
                        {tierDist.map((d:any,i:number)=><Cell key={i} fill={d.color}/>)}
                      </Pie>
                      <Tooltip content={<CT/>}/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  {tierDist.map((d:any)=>(
                    <div key={d.name} style={{ display:'flex', alignItems:'center', gap:5 }}>
                      <div style={{ width:7, height:7, borderRadius:2, background:d.color, flexShrink:0 }}/>
                      <span style={{ fontSize:'0.62rem', color:'#6B7280' }}>{d.name}</span>
                      <span style={{ fontSize:'0.62rem', fontWeight:700, marginLeft:'auto', fontFamily:'monospace' }}>{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Row 2: CAGR + Inequality + Luxury over time */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'0.85rem' }}>

          {/* Fastest CAGR */}
          <Card title="Fastest Growing Counties" sub="5 YEAR CAGR">
            <div style={{ height:220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topCAGR} layout="vertical" margin={{left:52,right:24,top:0,bottom:0}}>
                  <XAxis type="number" hide/>
                  <YAxis type="category" dataKey="county" tick={{fill:'#6B7280',fontSize:9,fontFamily:'monospace'}} width={52}/>
                  <Tooltip content={<CT/>}/>
                  <Bar dataKey="price_cagr_5yr" name="CAGR %" radius={[0,4,4,0]}>
                    {topCAGR.map((c:any,i:number)=><Cell key={i} fill={c.county===selected?'#F59E0B':'#4A7C59'} opacity={c.county===selected?1:0.7}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Inequality — Gini */}
          <Card title="Wealth Inequality by County" sub="GINI COEFFICIENT">
            <div style={{ height:220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topGini} layout="vertical" margin={{left:52,right:24,top:0,bottom:0}}>
                  <XAxis type="number" hide/>
                  <YAxis type="category" dataKey="county" tick={{fill:'#6B7280',fontSize:9,fontFamily:'monospace'}} width={52}/>
                  <Tooltip content={<CT/>}/>
                  <Bar dataKey="gini_coefficient" name="Gini" radius={[0,4,4,0]}>
                    {topGini.map((c:any,i:number)=><Cell key={i} fill={c.county===selected?'#F59E0B':'#EF4444'} opacity={0.7+i*0.03}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Luxury sales over time */}
          <Card title="Luxury Sales Over Time" sub="PROPERTIES ABOVE 1M EURO">
            <div style={{ height:220 }}>
              {luxuryOverTime.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={luxuryOverTime} margin={{top:5,right:5,bottom:0,left:0}}>
                    <defs>
                      <linearGradient id="luxGr" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="year" stroke="transparent" tick={{fill:'#D1D5DB',fontSize:8,fontFamily:'monospace'}} interval={1}/>
                    <YAxis stroke="transparent" tick={{fill:'#D1D5DB',fontSize:8,fontFamily:'monospace'}} width={32}/>
                    <Tooltip content={<CT/>}/>
                    <Area type="monotone" dataKey="count" name="Luxury Sales" stroke="#F59E0B" strokeWidth={2.5} fill="url(#luxGr)" dot={false} activeDot={{r:4,fill:'#F59E0B'}}/>
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div style={{height:'100%',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <p style={{color:'#D1D5DB',fontSize:'0.7rem',fontFamily:'monospace'}}>Loading luxury trend data...</p>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Row 3: Transaction volume + Emerging districts + Phase 2 */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1.2fr 0.8fr', gap:'0.85rem' }}>

          {/* Transaction volume by year */}
          <Card title="Market Activity 2010 to 2024" sub="TOTAL TRANSACTIONS PER YEAR">
            <div style={{ height:180 }}>
              {txByYear.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={txByYear} margin={{top:5,right:5,bottom:0,left:0}}>
                    <XAxis dataKey="year" stroke="transparent" tick={{fill:'#D1D5DB',fontSize:8,fontFamily:'monospace'}} interval={1}/>
                    <YAxis stroke="transparent" tick={{fill:'#D1D5DB',fontSize:8,fontFamily:'monospace'}} tickFormatter={v=>`${(v/1000).toFixed(0)}k`} width={28}/>
                    <Tooltip content={<CT/>}/>
                    <Bar dataKey="count" name="Transactions" radius={[2,2,0,0]}>
                      {txByYear.map((d:any,i:number)=><Cell key={i} fill={+d.year<=2012?'#EF4444':+d.year<=2015?'#F59E0B':'#4A7C59'} opacity={0.75}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{height:'100%',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <p style={{color:'#D1D5DB',fontSize:'0.7rem',fontFamily:'monospace'}}>Loading transaction data...</p>
                </div>
              )}
            </div>
            <div style={{ display:'flex', gap:12, marginTop:6 }}>
              {[['#EF4444','Post-crash'],['#F59E0B','Recovery'],['#4A7C59','Growth']].map(([c,l])=>(
                <div key={l} style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <div style={{ width:8, height:8, borderRadius:2, background:c }}/>
                  <span style={{ fontSize:'0.6rem', color:'#9CA3AF' }}>{l}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Emerging districts */}
          <Card title="Most Surprising Emerging Districts" sub="HIGH CAGR FROM LOW BASE">
            <div style={{ maxHeight:200, overflowY:'auto' }}>
              {(emerging||[]).slice(0,12).map((d:any,i:number)=>(
                <div key={i} style={{ display:'grid', gridTemplateColumns:'2.5rem 1fr 3.5rem 4rem', gap:6, alignItems:'center', padding:'5px 0', borderBottom:'1px solid #F9FAFB' }}>
                  <span style={{ fontFamily:'monospace', fontSize:'0.62rem', color:'#4A7C59', fontWeight:700 }}>{d.eircode_district}</span>
                  <div>
                    <p style={{ fontSize:'0.72rem', fontWeight:600, color:'#111' }}>{d.county}</p>
                    <p style={{ fontSize:'0.58rem', color:'#9CA3AF' }}>{d.area_type}</p>
                  </div>
                  <span style={{ fontFamily:'monospace', fontSize:'0.62rem', color:'#6B7280', textAlign:'right' }}>{fmt(d.median_price)}</span>
                  <span style={{ fontFamily:'monospace', fontSize:'0.68rem', fontWeight:700, color: d.price_cagr_5yr>0?'#4A7C59':'#EF4444', textAlign:'right' }}>
                    {d.price_cagr_5yr!=null?`${d.price_cagr_5yr>0?'▲':'▼'}${Math.abs(d.price_cagr_5yr).toFixed(1)}%`:'n/a'}
                  </span>
                </div>
              ))}
              {!emerging?.length && <p style={{ fontSize:'0.7rem', color:'#D1D5DB', fontFamily:'monospace', textAlign:'center', padding:'1rem 0' }}>No emerging district data</p>}
            </div>
          </Card>

          {/* Phase 2 + Affluence summary */}
          <div style={{ display:'flex', flexDirection:'column', gap:'0.85rem' }}>
            <div style={{ background:'#fff', borderRadius:12, border:'1px solid #F0F0F0', boxShadow:'0 1px 8px rgba(0,0,0,0.04)', padding:'1rem', flex:1, display:'flex', flexDirection:'column', gap:10 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <p style={{ fontWeight:700, fontSize:'0.82rem', color:'#111' }}>Who Owns Ireland?</p>
                <span style={{ fontSize:'0.6rem', fontWeight:600, color:'#4A7C59', background:'#F0FFF4', border:'1px solid #D1FAE5', padding:'2px 8px', borderRadius:20, fontFamily:'monospace', letterSpacing:'0.06em' }}>PHASE 2</span>
              </div>
              <p style={{ fontSize:'0.72rem', color:'#6B7280', lineHeight:1.7 }}>Beneficial owner nationality of corporate property purchases above 500k euro, cross-referenced from the public Register of Beneficial Owners.</p>
              <div style={{ marginTop:'auto', padding:'8px 10px', background:'#F9FAFB', border:'1px solid #F0F0F0', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div>
                  <p style={{ fontFamily:'monospace', fontSize:'0.58rem', color:'#9CA3AF', letterSpacing:'0.08em', marginBottom:2 }}>IDENTIFIED FOR ANALYSIS</p>
                  <p style={{ fontFamily:'monospace', fontSize:'1rem', fontWeight:800, color:'#111' }}>167</p>
                </div>
                <div style={{ textAlign:'right' }}>
                  <p style={{ fontFamily:'monospace', fontSize:'0.58rem', color:'#9CA3AF', letterSpacing:'0.08em', marginBottom:2 }}>STATUS</p>
                  <p style={{ fontFamily:'monospace', fontSize:'0.68rem', fontWeight:700, color:'#4A7C59' }}>In progress</p>
                </div>
              </div>
            </div>
            <Card title="Affluence Leaders">
              {sorted.slice(0,5).map((c:any,i:number)=>(
                <div key={i} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
                  <span style={{ fontFamily:'monospace', fontSize:'0.6rem', color:'#D1D5DB', width:16 }}>#{c.affluence_rank}</span>
                  <span style={{ fontSize:'0.72rem', fontWeight:600, flex:1 }}>{c.county}</span>
                  <span style={{ fontFamily:'monospace', fontSize:'0.65rem', fontWeight:700, color:TIER_COLORS[c.affluence_tier]||'#4A7C59' }}>{c.affluence_index?.toFixed(1)}</span>
                </div>
              ))}
            </Card>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign:'center', padding:'0.5rem 0', borderTop:'1px solid #F0F0F0' }}>
          <p style={{ fontFamily:'monospace', fontSize:'0.58rem', color:'#D1D5DB', letterSpacing:'0.1em' }}>
            DATA: PROPERTY PRICE REGISTER · POBAL HP INDEX · CRO · RBO · BUILT BY SHIVEN · DUBLIN · 2024
          </p>
        </div>
      </div>
    </div>
  )
}