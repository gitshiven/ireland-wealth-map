import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Ireland Wealth Map — Where Money Lives',
  description: 'Data-driven analysis of property wealth concentration across Ireland — 26 counties, 160+ Eircode districts. Emerging areas, established wealth, corporate ownership intelligence.',
  openGraph: {
    title: 'Ireland Wealth Map',
    description: 'Where money lives in Ireland — and where it\'s moving.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
