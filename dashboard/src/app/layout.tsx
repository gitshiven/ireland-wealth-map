import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Ireland Wealth Map',
  description: 'Where money lives in Ireland. 786k+ property transactions analysed.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}