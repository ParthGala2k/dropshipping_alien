import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type Event, type EventLevel } from '@/lib/api'
import { formatCents, formatDateTime } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MapPin, Loader2, CheckCircle2, Mail } from 'lucide-react'

const MAX_QUANTITY = 6
const STEPS = ['Confirm', 'Tickets', 'Details', 'Payment', 'Receipt'] as const

export function EventPurchasePage() {
  const { id: eventId } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const queueEntryId = searchParams.get('queueEntryId')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [step, setStep] = useState(0)
  const [levelId, setLevelId] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [addressLine1, setAddressLine1] = useState('')
  const [addressCity, setAddressCity] = useState('')
  const [addressPostalCode, setAddressPostalCode] = useState('')
  const [purchaseComplete, setPurchaseComplete] = useState<{ email: string; totalCents: number; quantity: number; levelName: string } | null>(null)

  const { data: event } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => api.events.get(eventId!),
    enabled: !!eventId,
  })
  const { data: levels = [] } = useQuery({
    queryKey: ['event-levels', eventId],
    queryFn: () => api.events.levels(eventId!),
    enabled: !!eventId && step >= 1,
  })

  useEffect(() => {
    if (!queueEntryId && step === 0) navigate(`/events/${eventId}`, { replace: true })
  }, [queueEntryId, eventId, step, navigate])

  const purchaseMutation = useMutation({
    mutationFn: () =>
      api.events.purchase(eventId!, {
        queueEntryId: queueEntryId!,
        levelId: levelId!,
        quantity,
        email,
        fullName,
        addressLine1: addressLine1 || undefined,
        addressCity: addressCity || undefined,
        addressPostalCode: addressPostalCode || undefined,
      }),
    onSuccess: (data) => {
      setPurchaseComplete({
        email: data.purchase.email,
        totalCents: data.purchase.totalCents,
        quantity: data.purchase.quantity,
        levelName: data.purchase.levelName,
      })
      setStep(4)
      queryClient.invalidateQueries({ queryKey: ['events'] })
      queryClient.invalidateQueries({ queryKey: ['event', eventId] })
      queryClient.invalidateQueries({ queryKey: ['queue-status', eventId] })
      queryClient.invalidateQueries({ queryKey: ['my-tickets'] })
    },
  })

  const ev = event as Event | undefined
  const levelList = levels as EventLevel[]
  const selectedLevel = levelList.find((l) => l.id === levelId)

  if (!ev) return <div className="text-center py-12 text-slate-500">Loading…</div>
  if (!queueEntryId) return null

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-600">
        {STEPS.map((s, i) => (
          <span key={s} className={step === i ? 'font-medium text-emerald-700' : step > i ? 'text-emerald-600' : ''}>
            {i + 1}. {s}
          </span>
        ))}
      </div>

      {/* Step 0: Confirm */}
      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Proceed to ticket purchase</CardTitle>
            <p className="text-sm text-slate-600">It’s your turn. You’ll choose your ticket level, quantity, and payment details next.</p>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button onClick={() => setStep(1)}>Continue</Button>
            <Button variant="outline" onClick={() => navigate(`/events/${eventId}`)}>Back</Button>
          </CardContent>
        </Card>
      )}

      {/* Step 1: Level + quantity (venue “map” = level list) */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" /> {ev.venue}</CardTitle>
            <p className="text-sm text-slate-600">{ev.title} · {formatDateTime(ev.date_time)}</p>
            <p className="text-xs text-slate-500">Select a level and quantity (max {MAX_QUANTITY} per order).</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {levelList.length === 0 ? (
              <p className="text-slate-500">No ticket levels available. Please try again later.</p>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Ticket level</Label>
                  <div className="grid gap-2">
                    {levelList.map((l) => (
                      <label key={l.id} className="flex items-center justify-between rounded-lg border p-3 cursor-pointer hover:bg-slate-50">
                        <input type="radio" name="level" checked={levelId === l.id} onChange={() => setLevelId(l.id)} className="mr-2" />
                        <span className="font-medium">{l.name}</span>
                        <span className="text-emerald-700">{formatCents(l.price_cents)}</span>
                        <span className="text-sm text-slate-500">({l.quantity_remaining} left)</span>
                      </label>
                    ))}
                  </div>
                </div>
                {selectedLevel && (
                  <div>
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      min={1}
                      max={Math.min(MAX_QUANTITY, selectedLevel.quantity_remaining)}
                      value={quantity}
                      onChange={(e) => {
                        const raw = parseInt(e.target.value, 10)
                        const q = Number.isNaN(raw) ? 1 : raw
                        setQuantity(Math.min(MAX_QUANTITY, Math.max(1, q)))
                      }}
                    />
                    <p className="text-sm text-slate-500 mt-1">
                      Total: {formatCents(selectedLevel.price_cents * quantity)}
                    </p>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button onClick={() => setStep(2)} disabled={!levelId}>Continue</Button>
                  <Button variant="outline" onClick={() => setStep(0)}>Back</Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Contact & address */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Contact & delivery details</CardTitle>
            <p className="text-sm text-slate-600">Receipt and tickets will be sent to this email.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
            </div>
            <div>
              <Label htmlFor="fullName">Full name *</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" required />
            </div>
            <div>
              <Label htmlFor="addressLine1">Address (optional)</Label>
              <Input id="addressLine1" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} placeholder="Street address" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="city">City</Label>
                <Input id="city" value={addressCity} onChange={(e) => setAddressCity(e.target.value)} placeholder="City" />
              </div>
              <div>
                <Label htmlFor="postal">Postal code</Label>
                <Input id="postal" value={addressPostalCode} onChange={(e) => setAddressPostalCode(e.target.value)} placeholder="Postal code" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setStep(3)} disabled={!email.trim() || !fullName.trim()}>Continue to payment</Button>
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Confirm payment */}
      {step === 3 && selectedLevel && (
        <Card>
          <CardHeader>
            <CardTitle>Confirm purchase</CardTitle>
            <p className="text-sm text-slate-600">{ev.title} · {selectedLevel.name} × {quantity}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-4 space-y-1 text-sm">
              <p><strong>Total:</strong> {formatCents(selectedLevel.price_cents * quantity)}</p>
              <p><strong>Email:</strong> {email}</p>
              <p><strong>Name:</strong> {fullName}</p>
            </div>
            <p className="text-xs text-slate-500">Click “Pay” to complete. No real payment is processed in this demo.</p>
            <div className="flex gap-2">
              <Button
                onClick={() => purchaseMutation.mutate()}
                disabled={purchaseMutation.isPending}
              >
                {purchaseMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Pay'}
              </Button>
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
            </div>
            {purchaseMutation.isError && (
              <p className="text-sm text-red-600">{(purchaseMutation.error as Error).message}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 4: Receipt + confirmation */}
      {step === 4 && purchaseComplete && (
        <Card className="border-emerald-200">
          <CardHeader>
            <div className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="h-8 w-8" />
              <CardTitle>Purchase complete</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-slate-700">Your tickets have been reserved.</p>
            <div className="rounded-lg bg-slate-50 p-4 space-y-2 text-sm">
              <p><strong>Total paid:</strong> {formatCents(purchaseComplete.totalCents)}</p>
              <p><strong>Quantity:</strong> {purchaseComplete.quantity} × {purchaseComplete.levelName}</p>
              <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                <Mail className="h-4 w-4" />
                <span>Confirmation and tickets sent to <strong>{purchaseComplete.email}</strong></span>
              </div>
            </div>
            <p className="text-xs text-slate-500">In production, a real email would be sent with your ticket(s).</p>
            <div className="flex gap-2">
              <Button onClick={() => navigate('/my')}>View my tickets</Button>
              <Button variant="outline" onClick={() => navigate('/events')}>Back to events</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="text-center text-sm text-slate-500">
        {ev.title} · {ev.venue}
      </div>
    </div>
  )
}
