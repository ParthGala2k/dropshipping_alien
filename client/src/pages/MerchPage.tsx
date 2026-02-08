import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type MerchListing } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCents } from '@/lib/utils'
import { ShoppingBag } from 'lucide-react'

export function MerchPage() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [createOpen, setCreateOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priceCents, setPriceCents] = useState('')
  const [imageUrl, setImageUrl] = useState('')

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ['merch-listings'],
    queryFn: () => api.merch.listings(),
  })
  const createMutation = useMutation({
    mutationFn: (data: { title: string; description?: string; priceCents: number; imageUrl?: string }) =>
      api.merch.createListing(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merch-listings'] })
      queryClient.invalidateQueries({ queryKey: ['my-merch-listings'] })
      setCreateOpen(false)
      setTitle('')
      setDescription('')
      setPriceCents('')
      setImageUrl('')
    },
  })
  const orderMutation = useMutation({
    mutationFn: ({ listingId, qty }: { listingId: string; qty: number }) =>
      api.merch.createOrder(listingId, qty),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-merch-orders'] })
    },
  })

  const handleCreate = () => {
    const cents = Math.round(parseFloat(priceCents || '0') * 100)
    if (!title || cents < 0) return
    createMutation.mutate({
      title,
      description: description || undefined,
      priceCents: cents,
      imageUrl: imageUrl || undefined,
    })
  }

  if (isLoading) return <div className="text-center py-12 text-slate-500">Loading…</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Community Merch</h1>
          <p className="text-slate-600 mt-1">Verified humans list & order. Sellers mark shipped.</p>
        </div>
        {user?.is_verified && (
          <Button onClick={() => setCreateOpen(true)}>List item</Button>
        )}
      </div>

      {createOpen && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">New listing</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Product name" />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description" />
            </div>
            <div>
              <Label>Price (USD)</Label>
              <Input type="number" step="0.01" value={priceCents} onChange={(e) => setPriceCents(e.target.value)} placeholder="19.99" />
            </div>
            <div>
              <Label>Image URL (optional)</Label>
              <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending || !title}>Create</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(listings as MerchListing[]).map((m) => (
          <Card key={m.id}>
            {m.image_url && (
              <div className="aspect-video w-full overflow-hidden rounded-t-xl bg-slate-100">
                <img src={m.image_url} alt={m.title} className="h-full w-full object-cover" />
              </div>
            )}
            <CardHeader className="pb-2">
              <p className="font-semibold">{m.title}</p>
              {m.description && <p className="text-sm text-slate-500 line-clamp-2">{m.description}</p>}
              <p className="text-lg font-bold text-emerald-700">{formatCents(m.price_cents)}</p>
            </CardHeader>
            <CardContent>
              {user?.is_verified && user.id !== m.seller_user_id && (
                <Button
                  size="sm"
                  onClick={() => orderMutation.mutate({ listingId: m.id, qty: 1 })}
                  disabled={orderMutation.isPending}
                >
                  <ShoppingBag className="h-4 w-4 mr-1" /> Order
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      {listings.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-slate-500">No merch listings yet. List an item to start.</CardContent>
        </Card>
      )}
    </div>
  )
}
