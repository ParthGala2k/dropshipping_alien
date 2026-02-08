import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api, type MyTicket, type MyResaleListing, type MyMerchOrder } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { formatCents, formatDateTime } from '@/lib/utils'
import { Ticket, List, Package, ShoppingBag, Bot, Loader2 } from 'lucide-react'

export function MyPage() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [listTicketId, setListTicketId] = useState<string | null>(null)
  const [listPrice, setListPrice] = useState('')
  const [listFormError, setListFormError] = useState<string | null>(null)
  const [agentSuggestion, setAgentSuggestion] = useState<string | null>(null)
  const [agentLoading, setAgentLoading] = useState(false)

  const { data: tickets = [] } = useQuery({
    queryKey: ['my-tickets'],
    queryFn: () => api.my.tickets(),
    enabled: !!user,
  })
  const { data: resaleListings = [] } = useQuery({
    queryKey: ['my-resale-listings'],
    queryFn: () => api.my.resaleListings(),
    enabled: !!user,
  })
  const { data: merchListings = [] } = useQuery({
    queryKey: ['my-merch-listings'],
    queryFn: () => api.my.merchListings(),
    enabled: !!user,
  })
  const { data: merchOrders = [] } = useQuery({
    queryKey: ['my-merch-orders'],
    queryFn: () => api.my.merchOrders(),
    enabled: !!user,
  })
  const { data: sellingOrders = [] } = useQuery({
    queryKey: ['my-merch-orders-selling'],
    queryFn: () => api.my.merchOrdersSelling(),
    enabled: !!user,
  })

  const listMutation = useMutation({
    mutationFn: ({ ticketId, priceCents }: { ticketId: string; priceCents: number }) =>
      api.resale.list(ticketId, priceCents),
    onSuccess: async () => {
      setListTicketId(null)
      setListPrice('')
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['my-tickets'] }),
        queryClient.refetchQueries({ queryKey: ['my-resale-listings'] }),
        queryClient.refetchQueries({ queryKey: ['resale-listings'] }),
      ])
    },
    onError: () => {
      // Error is shown in UI via listMutation.error
    },
  })

  const handleListForResale = (ticketId: string) => {
    setListFormError(null)
    listMutation.reset()
    const priceCents = parseInt(listPrice, 10)
    if (!listPrice.trim() || isNaN(priceCents) || priceCents < 1) {
      setListFormError('Please enter a price of at least 1 cent (e.g. 5000 for $50).')
      return
    }
    listMutation.mutate({ ticketId, priceCents })
  }

  const markShippedMutation = useMutation({
    mutationFn: (orderId: string) => api.merch.markShipped(orderId, 'shipped'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-merch-orders-selling'] })
      queryClient.invalidateQueries({ queryKey: ['my-merch-orders'] })
    },
  })

  const fetchAgentSuggestion = async () => {
    setAgentLoading(true)
    setAgentSuggestion(null)
    try {
      const { suggestion } = await api.agent.suggest('resale_pricing')
      setAgentSuggestion(suggestion)
    } finally {
      setAgentLoading(false)
    }
  }

  if (!user) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-slate-600">Sign in to see your tickets, listings, and orders.</CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">My</h1>
        <Button variant="outline" size="sm" onClick={fetchAgentSuggestion} disabled={agentLoading}>
          {agentLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
          <span className="ml-1">Agent Assist</span>
        </Button>
      </div>
      {agentSuggestion && (
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="py-3 text-sm text-slate-700">{agentSuggestion}</CardContent>
        </Card>
      )}

      <section>
        <CardTitle className="flex items-center gap-2 text-lg mb-2"><Ticket className="h-5 w-5" /> My tickets</CardTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          {(tickets as MyTicket[]).map((t) => (
            <Card key={t.id}>
              <CardHeader className="pb-2">
                <p className="font-semibold">{t.event_title}</p>
                <p className="text-sm text-slate-500">{t.venue} · {formatDateTime(t.date_time)}</p>
                <p className="text-sm">Serial: {t.serial}</p>
                <Badge variant={t.ticket_status === 'listed' ? 'secondary' : 'default'}>{t.ticket_status}</Badge>
              </CardHeader>
              <CardContent>
                {t.ticket_status === 'owned' && (
                  <>
                    {listTicketId === t.id ? (
                      <div className="space-y-2">
                        <Label htmlFor={`price-${t.id}`}>Price (cents, e.g. 5000 = $50)</Label>
                        <Input
                          id={`price-${t.id}`}
                          type="number"
                          min={1}
                          value={listPrice}
                          onChange={(e) => {
                            setListPrice(e.target.value)
                            setListFormError(null)
                            listMutation.reset()
                          }}
                          placeholder="5000"
                          className={listMutation.isError || listFormError ? 'border-red-500' : ''}
                        />
                        {(listFormError || listMutation.isError) && (
                          <p className="text-sm text-red-600" role="alert">
                            {listFormError ||
                              (listMutation.error instanceof Error ? listMutation.error.message : 'Something went wrong. Please try again.')}
                          </p>
                        )}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleListForResale(t.id)}
                            disabled={listMutation.isPending}
                          >
                            {listMutation.isPending ? 'Listing…' : 'List'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setListTicketId(null)
                              setListPrice('')
                              setListFormError(null)
                              listMutation.reset()
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setListTicketId(t.id)}>List for resale</Button>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
        {tickets.length === 0 && <p className="text-slate-500 text-sm">No tickets yet. <Link to="/events" className="text-emerald-600">Join a queue</Link>.</p>}
      </section>

      <section>
        <CardTitle className="flex items-center gap-2 text-lg mb-2"><List className="h-5 w-5" /> My resale listings</CardTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          {(resaleListings as MyResaleListing[]).map((r) => (
            <Card key={r.id}>
              <CardContent className="pt-4">
                <p className="font-semibold">{r.event_title}</p>
                <p className="text-sm text-slate-500">{r.serial} · {formatCents(r.price_cents)} · {r.status}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        {resaleListings.length === 0 && <p className="text-slate-500 text-sm">No resale listings.</p>}
      </section>

      <section>
        <CardTitle className="flex items-center gap-2 text-lg mb-2"><Package className="h-5 w-5" /> My merch listings</CardTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          {merchListings.map((m: { id: string; title: string; price_cents: number; status: string }) => (
            <Card key={m.id}>
              <CardContent className="pt-4">
                <p className="font-semibold">{m.title}</p>
                <p className="text-sm text-slate-500">{formatCents(m.price_cents)} · {m.status}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        {merchListings.length === 0 && <p className="text-slate-500 text-sm">No merch listings. <Link to="/merch" className="text-emerald-600">List on Merch</Link>.</p>}
      </section>

      <section>
        <CardTitle className="flex items-center gap-2 text-lg mb-2"><ShoppingBag className="h-5 w-5" /> My orders</CardTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          {(merchOrders as MyMerchOrder[]).map((o) => (
            <Card key={o.id}>
              <CardContent className="pt-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold">{o.listing_title || 'Order'}</p>
                  <p className="text-sm text-slate-500">Qty: {o.qty} · {formatCents(o.total_cents)} · <Badge variant="secondary">{o.status}</Badge></p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        {merchOrders.length === 0 && <p className="text-slate-500 text-sm">No orders.</p>}
      </section>

      {sellingOrders.length > 0 && (
        <section>
          <CardTitle className="text-lg mb-2">Orders on my listings</CardTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            {(sellingOrders as MyMerchOrder[]).map((o) => (
              <Card key={o.id}>
                <CardContent className="pt-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{o.listing_title}</p>
                    <p className="text-sm text-slate-500">Qty: {o.qty} · {formatCents(o.total_cents)} · {o.status}</p>
                  </div>
                  {o.status === 'placed' && (
                    <Button size="sm" onClick={() => markShippedMutation.mutate(o.id)} disabled={markShippedMutation.isPending}>
                      Mark shipped
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
