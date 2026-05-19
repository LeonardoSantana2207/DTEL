import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'DTEL Produção FTTH',
  description: 'Sistema de gestão de produção de projetos de fibra óptica',
  icons: { icon: '/logo.png' },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className="bg-[#f4f7f5] min-h-screen">{children}</body>
    </html>
  )
}
