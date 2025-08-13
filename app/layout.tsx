import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'LPR Session Matching Dashboard',
  description: 'License Plate Recognition session matching and analytics dashboard',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <div className="flex flex-col min-h-screen">
          <header className="border-b border-border bg-card">
            <div className="container mx-auto px-4 py-4">
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-2xl font-bold text-primary">
                    LPR Session Matching Dashboard
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1">
                    License Plate Recognition Analytics & Session Management
                  </p>
                </div>
                <nav className="flex gap-4">
                  <a href="/" className="px-4 py-2 text-sm font-medium text-foreground hover:text-primary transition-colors border-b-2 border-transparent hover:border-primary">
                    Dashboard
                  </a>
                  <a href="/upload" className="px-4 py-2 text-sm font-medium text-foreground hover:text-primary transition-colors border-b-2 border-transparent hover:border-primary">
                    Upload CSV
                  </a>
                </nav>
              </div>
            </div>
          </header>
          <main className="flex-1 container mx-auto px-4 py-6">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}