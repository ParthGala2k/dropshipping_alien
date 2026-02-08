import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { EventsPage } from '@/pages/EventsPage'
import { EventDetailPage } from '@/pages/EventDetailPage'
import { EventPurchasePage } from '@/pages/EventPurchasePage'
import { MyPage } from '@/pages/MyPage'
import { ResalePage } from '@/pages/ResalePage'
import { MerchPage } from '@/pages/MerchPage'
import { cn } from '@/lib/utils'

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 5000 } } })

function Layout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout, devLogin } = useAuth()
  const loc = useLocation()
  const nav = [
    { to: '/events', label: 'Events' },
    { to: '/resale', label: 'Resale' },
    { to: '/merch', label: 'Merch' },
    { to: '/my', label: 'My' },
  ]
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4">
          <Link to="/events" className="font-semibold text-emerald-700">Fair Ticket Queue</Link>
          <nav className="flex gap-1">
            {nav.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={cn(
                  'rounded-md px-3 py-2 text-sm font-medium',
                  loc.pathname.startsWith(to) ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-100'
                )}
              >
                {label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {loading ? (
              <span className="text-sm text-slate-400">Loading…</span>
            ) : user ? (
              <>
                <span className="text-sm text-slate-600">{user.display_name || 'Verified'}</span>
                <Button variant="ghost" size="sm" onClick={() => logout()}>Log out</Button>
              </>
            ) : (
              <>
                {import.meta.env.DEV && (
                  <Button variant="outline" size="sm" onClick={() => devLogin()}>Demo login</Button>
                )}
              </>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </div>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<Navigate to="/events" replace />} />
              <Route path="/events" element={<EventsPage />} />
              <Route path="/events/:id" element={<EventDetailPage />} />
              <Route path="/events/:id/purchase" element={<EventPurchasePage />} />
              <Route path="/my" element={<MyPage />} />
              <Route path="/resale" element={<ResalePage />} />
              <Route path="/merch" element={<MerchPage />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
