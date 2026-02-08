import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type Event, type QueueStatus } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { formatDateTime } from '@/lib/utils'
import { MapPin, Calendar, Bot, Loader2 } from 'lucide-react'

const CLAIM_WINDOW_SEC = 90

export function EventDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [yourTurnOpen, setYourTurnOpen] = useState(false)
  const [agentSuggestion, setAgentSuggestion] = useState<string | null>(null)
  const [agentLoading, setAgentLoading] = useState(false)

  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ['event', id],
    queryFn: () => api.events.get(id!),
    enabled: !!id,
  })
  const { data: dropStatus } = useQuery({
    queryKey: ['drop-status'],
    queryFn: () => api.dropStatus(),
    staleTime: 60_000,
  })
  const { data: queueStatus, isLoading: queueLoading, refetch: refetchQueue } = useQuery({
    queryKey: ['queue-status', id],
    queryFn: () => api.queue.status(id!),
    enabled: !!id && !!user,
    refetchInterval: 5000,
  })

  useEffect(() => {
    if (!id || !user) return
    const tick = () => api.queue.tick(id).then(() => refetchQueue())
    tick()
    const t = setInterval(tick, 5000)
    return () => clearInterval(t)
  }, [id, user, refetchQueue])

  const joinMutation = useMutation({
    mutationFn: () => api.queue.join(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue-status', id] })
      queryClient.invalidateQueries({ queryKey: ['event', id] })
    },
  })
  const isMyTurn = queueStatus?.yourEntry?.status === 'active' && queueStatus?.activeEntry?.id === queueStatus?.yourEntry?.id
  useEffect(() => {
    if (isMyTurn) setYourTurnOpen(true)
  }, [isMyTurn])

  const handleProceedToPurchase = () => {
    if (!queueStatus?.yourEntry?.id) return
    setYourTurnOpen(false)
    navigate(`/events/${id}/purchase?queueEntryId=${encodeURIComponent(queueStatus!.yourEntry!.id)}`)
  }

  const fetchAgentSuggestion = async () => {
    setAgentLoading(true)
    setAgentSuggestion(null)
    try {
      const { suggestion } = await api.agent.suggest('queue_timing', { eventId: id })
      setAgentSuggestion(suggestion)
    } finally {
      setAgentLoading(false)
    }
  }

  if (eventLoading || !event) return <div className="text-center py-12 text-slate-500">Loading…</div>
  const ev = event as Event
  const status = queueStatus as QueueStatus | undefined

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{ev.title}</h1>
            {(ev.drop_status && ev.drop_status !== 'unknown' || dropStatus?.status) && (
              <Badge variant={(ev.drop_status || dropStatus?.status) === 'live' ? 'default' : 'secondary'}>
                Drop: {ev.drop_status || dropStatus?.status || 'unknown'}
              </Badge>
            )}
          </div>
          <p className="text-slate-600 flex items-center gap-1"><MapPin className="h-4 w-4" /> {ev.venue}, {ev.city}</p>
          <p className="text-slate-600 flex items-center gap-1"><Calendar className="h-4 w-4" /> {formatDateTime(ev.date_time)}</p>
          <p className="font-medium text-emerald-700">{ev.tickets_remaining} tickets remaining</p>
        </CardHeader>
      </Card>

      {user && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-lg font-semibold">Queue</h2>
              <Button variant="outline" size="sm" onClick={fetchAgentSuggestion} disabled={agentLoading}>
                {agentLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                <span className="ml-1">Agent Assist</span>
              </Button>
            </div>
            {agentSuggestion && (
              <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3 border border-slate-200">
                <strong>Agent suggestion:</strong> {agentSuggestion} (You always approve any action.)
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {queueLoading && status === undefined ? (
              <p className="text-slate-500">Loading queue…</p>
            ) : status?.yourEntry ? (
              <div className="space-y-2">
                <p className="font-medium">
                  Your position: <span className="text-emerald-700">#{status.yourEntry.position}</span>
                  {status.yourEntry.status === 'active' && (
                    <Badge className="ml-2" variant="default">Your turn!</Badge>
                  )}
                </p>
                {status.estimatedWaitSeconds != null && status.yourEntry.status === 'waiting' && (
                  <p className="text-sm text-slate-600">Est. wait ~{Math.round(status.estimatedWaitSeconds / 60)} min</p>
                )}
                {status.yourEntry.status === 'active' && (
                  <Button onClick={() => setYourTurnOpen(true)}>Proceed to purchase</Button>
                )}
              </div>
            ) : (
              <div>
                <Button
                  onClick={() => joinMutation.mutate()}
                  disabled={joinMutation.isPending || ev.tickets_remaining === 0}
                >
                  {joinMutation.isPending ? 'Joining…' : 'Join queue'}
                </Button>
                {joinMutation.isError && <p className="text-sm text-red-600 mt-2">{(joinMutation.error as Error).message}</p>}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!user && (
        <Card>
          <CardContent className="py-6 text-center text-slate-600">
            Sign in (or use Demo login) to join the queue.
          </CardContent>
        </Card>
      )}

      <YourTurnDialog
        open={yourTurnOpen}
        onOpenChange={setYourTurnOpen}
        onProceed={handleProceedToPurchase}
        expiresAt={status?.yourEntry?.expiresAt}
      />
    </div>
  )
}

function YourTurnDialog({
  open,
  onOpenChange,
  onProceed,
  expiresAt,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onProceed: () => void
  expiresAt?: string
}) {
  const [secondsLeft, setSecondsLeft] = useState(CLAIM_WINDOW_SEC)
  useEffect(() => {
    if (!open || !expiresAt) return
    const update = () => {
      const left = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000))
      setSecondsLeft(left)
    }
    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [open, expiresAt])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Your turn!</DialogTitle>
          <DialogDescription>
            You have {secondsLeft} seconds to proceed. Click &quot;Proceed to purchase&quot; to choose your tickets and complete payment.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onProceed} disabled={secondsLeft <= 0}>
            Proceed to purchase
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
