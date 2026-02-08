import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type ResaleListing } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCents, formatDateTime } from '@/lib/utils'
import { Bot, Loader2 } from 'lucide-react'

export function ResalePage() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [agentSuggestion, setAgentSuggestion] = useState<string | null>(null)
  const [agentLoading, setAgentLoading] = useState(false)

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ['resale-listings'],
    queryFn: () => api.resale.listings(),
  })
  const purchaseMutation = useMutation({
    mutationFn: (listingId: string) => api.resale.purchase(listingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resale-listings'] })
      queryClient.invalidateQueries({ queryKey: ['my-tickets'] })
      queryClient.invalidateQueries({ queryKey: ['my-resale-listings'] })
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

  if (isLoading) return <div className="text-center py-12 text-slate-500">Loading…</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Resale</h1>
          <p className="text-slate-600 mt-1">Verified resale listings. One listing per ticket.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAgentSuggestion} disabled={agentLoading}>
          {agentLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
          <span className="ml-1">Agent Assist</span>
        </Button>
      </div>
      {agentSuggestion && (
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="py-3 text-sm text-slate-700">
            <strong>Agent suggestion:</strong> {agentSuggestion} Any purchase requires your approval.
          </CardContent>
        </Card>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {(listings as ResaleListing[]).map((l) => (
          <Card key={l.id}>
            <CardHeader className="pb-2">
              <p className="font-semibold">{l.event_title}</p>
              <p className="text-sm text-slate-500">{l.venue} · {l.date_time && formatDateTime(l.date_time)}</p>
              <p className="text-sm">Serial: {l.serial}</p>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <span className="text-lg font-bold text-emerald-700">{formatCents(l.price_cents)}</span>
              {user && user.id !== l.seller_user_id && (
                <Button
                  size="sm"
                  onClick={() => purchaseMutation.mutate(l.id)}
                  disabled={purchaseMutation.isPending}
                >
                  {purchaseMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buy'}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      {listings.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-slate-500">No resale listings yet.</CardContent>
        </Card>
      )}
    </div>
  )
}
