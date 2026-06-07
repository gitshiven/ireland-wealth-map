'use client'

export default function CorporateView() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '70vh', gap: '2rem', padding: '3rem', maxWidth: '800px', margin: '0 auto' }}>

      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', fontWeight: 700, textAlign: 'center', lineHeight: 1.2 }}>
        Who Really<br/>
        <em style={{ color: 'var(--gold)', fontStyle: 'italic' }}>Owns Ireland</em>
      </h2>

      <p style={{ fontFamily: 'var(--font-body)', fontSize: '1rem', color: '#888', lineHeight: 1.8, textAlign: 'center', maxWidth: '50ch' }}>
        This view maps the nationality of beneficial owners behind high-value corporate property purchases across Ireland — sourced directly from the public Register of Beneficial Owners.
      </p>

      <div style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1px', background: '#1f1f1f', border: '1px solid #1f1f1f' }}>
        {[
          { label: 'Data Source',   value: 'RBO — rbo.gov.ie',            sub: 'Public register, legally required' },
          { label: 'What it shows', value: 'Beneficial owner nationality', sub: 'Per company, verified by CRO'     },
          { label: 'Target',        value: '€500k+ purchases',            sub: 'Corporate buyers only'             },
        ].map(s => (
          <div key={s.label} style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.02)' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#555', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>{s.label}</p>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, marginBottom: '0.2rem' }}>{s.value}</p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: '#555' }}>{s.sub}</p>
          </div>
        ))}
      </div>

      <div style={{ width: '100%', padding: '1.25rem', border: '1px solid #1f1f1f', background: 'rgba(255,255,255,0.02)' }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#555', letterSpacing: '0.12em', marginBottom: '0.5rem' }}>
          WHY THIS MATTERS
        </p>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.9rem', color: '#888', lineHeight: 1.7 }}>
          The Property Price Register records every sale but not the buyer. The Register of Beneficial Owners — a public database introduced under EU anti-money-laundering law — requires every Irish company to declare the nationality of anyone owning 25%+ of shares. Cross-referencing these two datasets reveals what percentage of high-value Irish property is ultimately controlled by non-Irish beneficial owners. Nobody has done this at scale.
        </p>
      </div>

      <div style={{ width: '100%', padding: '1.25rem', border: '1px solid rgba(201,168,76,0.2)', background: 'rgba(201,168,76,0.04)' }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--gold)', letterSpacing: '0.12em', marginBottom: '0.5rem' }}>
          PHASE 2 — IN PROGRESS
        </p>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.9rem', color: '#888', lineHeight: 1.7 }}>
          167 high-value transactions (≥€500k) have been identified for corporate ownership analysis. Beneficial owner nationality data is currently being cross-referenced against the RBO. Results will populate this view on completion.
        </p>
      </div>

    </div>
  )
}