'use client'
import { useState } from 'react'
import { ViewType } from '@/types'
import EmergingView  from '@/components/EmergingView'
import CorporateView from '@/components/CorporateView'

export default function Home() {
  const [view, setView] = useState<ViewType>('emerging')

  return (
    <main className="min-h-screen grain" style={{ background: 'var(--ink)', color: 'var(--paper)' }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden scanlines"
              style={{ borderBottom: '1px solid #1f1f1f', padding: '2rem 2.5rem 1.5rem' }}>

        <div style={{ position: 'relative', zIndex: 2 }}>
          {/* Kicker */}
          <p style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.7rem',
            letterSpacing: '0.2em',
            color: 'var(--gold)',
            textTransform: 'uppercase',
            marginBottom: '0.5rem'
          }}>
            Data Investigation · Ireland · 2010–2024
          </p>

          {/* Title */}
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(2.2rem, 5vw, 4rem)',
            fontWeight: 900,
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
            maxWidth: '16ch',
          }}>
            Where Money<br/>
            <em style={{ color: 'var(--gold)', fontStyle: 'italic' }}>Lives</em> in Ireland
          </h1>

          {/* Subtitle */}
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.95rem',
            fontWeight: 300,
            color: '#888',
            marginTop: '0.75rem',
            maxWidth: '55ch',
          }}>
            600,000+ property transactions. 26 counties. 160 Eircode districts.
            One composite Affluence Index — and two questions nobody has answered cleanly.
          </p>
        </div>

        {/* Decorative large number */}
        <div style={{
          position: 'absolute', right: '2rem', top: '50%',
          transform: 'translateY(-50%)',
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(6rem, 14vw, 12rem)',
          fontWeight: 900,
          color: 'rgba(201,168,76,0.06)',
          lineHeight: 1,
          userSelect: 'none',
          pointerEvents: 'none',
        }}>
          €
        </div>
      </header>

      {/* ── View Switcher ──────────────────────────────────────────── */}
      <nav style={{
        display: 'flex',
        gap: 0,
        borderBottom: '1px solid #1f1f1f',
        background: 'rgba(255,255,255,0.02)',
      }}>
        {[
          { id: 'emerging'  as ViewType, label: 'View I',  sub: 'Emerging vs Established Wealth' },
          { id: 'corporate' as ViewType, label: 'View II', sub: 'Who Really Owns Ireland' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setView(tab.id)}
            style={{
              flex: 1,
              padding: '1rem 1.5rem',
              background: view === tab.id ? 'rgba(201,168,76,0.08)' : 'transparent',
              borderRight: '1px solid #1f1f1f',
              borderBottom: view === tab.id ? `2px solid var(--gold)` : '2px solid transparent',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s ease',
            }}
          >
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.65rem',
              letterSpacing: '0.15em',
              color: view === tab.id ? 'var(--gold)' : '#555',
              textTransform: 'uppercase',
              display: 'block',
            }}>
              {tab.label}
            </span>
            <span style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.95rem',
              fontWeight: 500,
              color: view === tab.id ? 'var(--paper)' : '#666',
              marginTop: '0.2rem',
              display: 'block',
            }}>
              {tab.sub}
            </span>
          </button>
        ))}
      </nav>

      {/* ── Content ────────────────────────────────────────────────── */}
      <div style={{ minHeight: 'calc(100vh - 260px)' }}>
        {view === 'emerging'  && <EmergingView  />}
        {view === 'corporate' && <CorporateView />}
      </div>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer style={{
        padding: '1.5rem 2.5rem',
        borderTop: '1px solid #1f1f1f',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.5rem',
      }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: '#444', letterSpacing: '0.1em' }}>
          DATA: Property Price Register · Daft.ie · CRO / RBO · Pobal HP Index
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: '#444', letterSpacing: '0.1em' }}>
          BUILT BY SHIVEN · DUBLIN · 2024
        </span>
      </footer>

    </main>
  )
}
