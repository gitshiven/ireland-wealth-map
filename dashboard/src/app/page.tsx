'use client'
import { useEffect, useRef, useState } from 'react'

const FACTS = [
  { num: 786907, suffix: '',  label: 'property transactions analysed',        format: 'int'   },
  { num: 15588,  suffix: '',  label: 'luxury sales above 1 million euro',      format: 'int'   },
  { num: 11.6,   suffix: '%', label: 'CAGR fastest growing county in Ireland', format: 'float' },
  { num: 827,    suffix: '',  label: 'Eircode districts mapped across Ireland', format: 'int'   },
]

const INSIGHTS = [
  { text: 'Ireland has', bold: '26 counties', rest: 'but wealth is far from evenly spread.' },
  { text: '', bold: '15,588 properties', rest: 'sold above 1 million euro since 2010.' },
  { text: 'Sligo grew faster than Dublin with', bold: '11.6% CAGR', rest: 'over 5 years.' },
  { text: 'One Wicklow district saw', bold: '30% annual price growth.', rest: '' },
]

function fmtNum(n: number, format: string, suffix: string): string {
  if (format === 'float') return `${n.toFixed(1)}${suffix}`
  return `${Math.round(n).toLocaleString()}${suffix}`
}

function countUp(
  to: number, duration: number, format: string, suffix: string,
  onTick: (s: string) => void, onDone: () => void
) {
  const start = performance.now()
  const tick = (now: number) => {
    const p = Math.min((now - start) / duration, 1)
    const ease = 1 - Math.pow(1 - p, 4)
    onTick(fmtNum(ease * to, format, suffix))
    if (p < 1) requestAnimationFrame(tick)
    else { onTick(fmtNum(to, format, suffix)); onDone() }
  }
  requestAnimationFrame(tick)
}

export default function Landing() {
  const [phase, setPhase] = useState<'numbers'|'facts'|'headline'>('numbers')
  const [display, setDisplay] = useState('')
  const [label, setLabel] = useState('')
  const [numVisible, setNumVisible] = useState(false)
  const [factsVisible, setFactsVisible] = useState(false)
  const [visibleFacts, setVisibleFacts] = useState<number[]>([])
  const [headlineVisible, setHeadlineVisible] = useState(false)
  const [ctaVisible, setCtaVisible] = useState(false)
  const [dissolve, setDissolve] = useState(false)
  const [timerW, setTimerW] = useState(0)
  const navigating = useRef(false)

  // Single navigation function — no guards that block it
  const navigate = () => {
    if (navigating.current) return
    navigating.current = true
    setDissolve(true)
    setTimeout(() => { window.location.href = '/dashboard' }, 850)
  }

  useEffect(() => {
    setTimeout(() => setTimerW(100), 200)
    const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

    const runCount = (fact: typeof FACTS[0]) =>
      new Promise<void>(resolve => {
        setDisplay(fmtNum(0, fact.format, fact.suffix))
        setLabel(fact.label)
        setNumVisible(true)
        setTimeout(() => {
          countUp(fact.num, fact.format === 'float' ? 1800 : 2200, fact.format, fact.suffix,
            s => setDisplay(s), resolve)
        }, 150)
      })

    const run = async () => {
      // Phase 1: numbers
      setPhase('numbers')
      for (let i = 0; i < FACTS.length; i++) {
        if (navigating.current) return
        if (i > 0) { setNumVisible(false); await delay(350) }
        if (navigating.current) return
        await runCount(FACTS[i])
        await delay(900)
      }
      if (navigating.current) return

      // Phase 2: facts
      setNumVisible(false)
      await delay(400)
      setPhase('facts')
      setFactsVisible(true)
      await delay(300)
      for (let i = 0; i < INSIGHTS.length; i++) {
        if (navigating.current) return
        setVisibleFacts(prev => [...prev, i])
        await delay(1100)
      }
      await delay(800)
      if (navigating.current) return

      // Phase 3: headline
      setFactsVisible(false)
      await delay(500)
      setPhase('headline')
      setHeadlineVisible(true)
      await delay(700)
      setCtaVisible(true)
      await delay(3200)

      // Auto-navigate — no guard needed, navigate() handles double-call itself
      navigate()
    }

    run()
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#F4F1EA',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      opacity: dissolve ? 0 : 1,
      transition: 'opacity 0.8s ease',
      zIndex: 100, overflow: 'hidden',
    }}>
      {/* Grid texture */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {[25,50,75].map(v => <div key={v} style={{ position:'absolute', top:0, left:`${v}%`, width:1, height:'100%', background:'rgba(0,0,0,0.05)' }}/>)}
        {[33,66].map(v => <div key={v} style={{ position:'absolute', top:`${v}%`, left:0, width:'100%', height:1, background:'rgba(0,0,0,0.05)' }}/>)}
      </div>

      {/* Nav */}
      <nav style={{ position:'absolute', top:0, left:0, right:0, display:'flex', justifyContent:'space-between', alignItems:'center', padding:'1.25rem 2.5rem', borderBottom:'1px solid rgba(0,0,0,0.08)', zIndex:10 }}>
        <span style={{ fontWeight:900, fontSize:'0.9rem', letterSpacing:'-0.02em', color:'#1a1a1a', textTransform:'uppercase' }}>
          Ireland<span style={{ color:'#4A7C59' }}>.</span>WealthMap
        </span>
        <button onClick={navigate} style={{ fontSize:'0.7rem', color:'#9B9080', letterSpacing:'0.12em', cursor:'pointer', padding:'4px 12px', border:'1px solid #D6CFC0', borderRadius:20, background:'transparent', textTransform:'uppercase' }}>
          Skip
        </button>
      </nav>

      {/* Content */}
      <div style={{ width:'100%', textAlign:'center', padding:'0 2rem', minHeight:240, display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>

        {/* Phase 1: Numbers */}
        {phase === 'numbers' && (
          <div style={{ opacity:numVisible?1:0, transform:numVisible?'translateY(0)':'translateY(12px)', transition:'opacity 0.5s ease, transform 0.5s ease', textAlign:'center', position:'absolute', left:0, right:0 }}>
            <div style={{ fontSize:'clamp(5rem,12vw,9rem)', fontWeight:900, color:'#1a1a1a', letterSpacing:'-0.05em', lineHeight:1, fontVariantNumeric:'tabular-nums' }}>
              {display}
            </div>
            <div style={{ fontFamily:'monospace', fontSize:'0.75rem', color:'#9B9080', letterSpacing:'0.15em', textTransform:'uppercase', marginTop:'1rem' }}>
              {label}
            </div>
          </div>
        )}

        {/* Phase 2: Facts */}
        {phase === 'facts' && (
          <div style={{ opacity:factsVisible?1:0, transition:'opacity 0.6s ease', position:'absolute', left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:640, padding:'0 2rem' }}>
            {INSIGHTS.map((ins, i) => (
              <div key={i} style={{
                fontSize:'clamp(1.05rem,2.2vw,1.3rem)', color:'#3A3A35', lineHeight:1.7,
                marginBottom:'1rem', textAlign:'center',
                opacity:visibleFacts.includes(i)?1:0,
                transform:visibleFacts.includes(i)?'translateY(0)':'translateY(10px)',
                transition:'opacity 0.5s ease, transform 0.5s ease',
              }}>
                {ins.text && <span>{ins.text} </span>}
                {ins.bold && <strong style={{ color:'#4A7C59', fontWeight:800 }}>{ins.bold}</strong>}
                {ins.rest && <span> {ins.rest}</span>}
              </div>
            ))}
          </div>
        )}

        {/* Phase 3: Headline */}
        {phase === 'headline' && (
          <div style={{ opacity:headlineVisible?1:0, transform:headlineVisible?'translateY(0)':'translateY(16px)', transition:'opacity 0.7s ease, transform 0.7s ease', textAlign:'center', position:'absolute', left:0, right:0 }}>
            <div style={{ fontSize:'clamp(3rem,8vw,6.5rem)', fontWeight:900, lineHeight:0.92, letterSpacing:'-0.04em', color:'#1a1a1a', textTransform:'uppercase' }}>
              WHERE<br/>
              <span style={{ color:'#4A7C59' }}>MONEY</span><br/>
              LIVES
            </div>
            <div style={{ fontFamily:'monospace', fontSize:'0.7rem', color:'#9B9080', letterSpacing:'0.1em', marginTop:'1.5rem', textTransform:'uppercase', whiteSpace:'nowrap' }}>
              786,907 transactions&nbsp;&nbsp;·&nbsp;&nbsp;26 counties&nbsp;&nbsp;·&nbsp;&nbsp;827 districts
            </div>
            <div style={{ marginTop:'2rem', opacity:ctaVisible?1:0, transition:'opacity 0.6s ease' }}>
              <button onClick={navigate} style={{ background:'#1a1a1a', color:'#F4F1EA', padding:'0.75rem 2rem', fontWeight:700, fontSize:'0.85rem', border:'none', borderRadius:6, cursor:'pointer' }}>
                Open Dashboard
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Progress dots */}
      <div style={{ position:'absolute', bottom:32, left:'50%', transform:'translateX(-50%)', display:'flex', gap:8 }}>
        {(['numbers','facts','headline'] as const).map(p => (
          <div key={p} style={{ height:4, borderRadius:2, width:phase===p?24:6, background:phase===p?'#4A7C59':'#D6CFC0', transition:'all 0.4s ease' }}/>
        ))}
      </div>

      {/* Timer bar */}
      <div style={{ position:'absolute', bottom:0, left:0, height:2, background:'#4A7C59', width:`${timerW}%`, transition:'width 14s linear' }}/>
    </div>
  )
}