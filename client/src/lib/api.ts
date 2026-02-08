const API = import.meta.env.VITE_API_URL || ''

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  return res.json()
}

export const api = {
  auth: {
    alien: (token: string) => request<{ ok: boolean; user: { id: string; display_name: string | null; is_verified: boolean } }>('/api/auth/alien', { method: 'POST', body: JSON.stringify({ token }) }),
    logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  },
  events: {
    list: () => request<Event[]>('/api/events'),
    get: (id: string) => request<Event>(`/api/events/${id}`),
    levels: (id: string) => request<EventLevel[]>(`/api/events/${id}/levels`),
    purchase: (eventId: string, body: PurchaseBody) =>
      request<PurchaseResponse>(`/api/events/${eventId}/purchase`, { method: 'POST', body: JSON.stringify(body) }),
  },
  queue: {
    status: (eventId: string) => request<QueueStatus>(`/api/queue/status?eventId=${encodeURIComponent(eventId)}`),
    join: (eventId: string) => request<{ ok: boolean; position: number; tickets_remaining: number }>('/api/queue/join', { method: 'POST', body: JSON.stringify({ eventId }) }),
    tick: (eventId: string) => request<{ ok: boolean; active?: boolean; activated?: string }>('/api/queue/tick', { method: 'POST', body: JSON.stringify({ eventId }) }),
    claim: (queueEntryId: string) => request<{ ok: boolean; ticket: { id: string; serial: string } }>('/api/queue/claim', { method: 'POST', body: JSON.stringify({ queueEntryId }) }),
  },
  resale: {
    listings: () => request<ResaleListing[]>('/api/resale/listings'),
    list: (ticketId: string, priceCents: number) => request<ResaleListing>('/api/resale/list', { method: 'POST', body: JSON.stringify({ ticketId, priceCents }) }),
    purchase: (listingId: string) => request<{ ok: boolean; ticketId: string }>('/api/resale/purchase', { method: 'POST', body: JSON.stringify({ listingId }) }),
  },
  merch: {
    listings: () => request<MerchListing[]>('/api/merch/listings'),
    createListing: (data: { title: string; description?: string; priceCents: number; imageUrl?: string }) =>
      request<MerchListing>('/api/merch/listings', { method: 'POST', body: JSON.stringify(data) }),
    createOrder: (listingId: string, qty: number) =>
      request<MerchOrder>('/api/merch/orders', { method: 'POST', body: JSON.stringify({ listingId, qty }) }),
    markShipped: (orderId: string, status: string) =>
      request<{ ok: boolean }>('/api/merch/orders', { method: 'PATCH', body: JSON.stringify({ orderId, status }) }),
  },
  my: {
    tickets: () => request<MyTicket[]>('/api/my/tickets'),
    resaleListings: () => request<MyResaleListing[]>('/api/my/resale-listings'),
    merchListings: () => request<MerchListing[]>('/api/my/merch-listings'),
    merchOrders: () => request<MyMerchOrder[]>('/api/my/merch-orders'),
    merchOrdersSelling: () => request<MyMerchOrder[]>('/api/my/merch-orders/selling'),
  },
  agent: {
    suggest: (type: 'queue_timing' | 'resale_pricing' | 'general', context?: Record<string, unknown>) =>
      request<{ suggestion: string; requiresApproval: boolean }>('/api/agent/suggest', { method: 'POST', body: JSON.stringify({ type, context }) }),
  },
  dropStatus: () => request<{ status: string }>('/api/drop-status'),
}

export interface Event {
  id: string
  title: string
  venue: string
  city: string
  date_time: string
  total_tickets: number
  tickets_remaining: number
  drop_status?: string | null
  created_at: string
}

export interface EventLevel {
  id: string
  event_id: string
  name: string
  price_cents: number
  quantity_remaining: number
  sort_order: number
}

export interface PurchaseBody {
  queueEntryId: string
  levelId: string
  quantity: number
  email: string
  fullName: string
  addressLine1?: string
  addressCity?: string
  addressPostalCode?: string
}

export interface PurchaseResponse {
  ok: boolean
  purchase: { id: string; totalCents: number; quantity: number; levelName: string; email: string; createdAt: string }
  message: string
}

export interface QueueStatus {
  tickets_remaining: number
  activeEntry: { id: string; userId: string; position: number; expiresAt: string } | null
  yourEntry: { id: string; status: string; position: number; expiresAt: string } | null
  yourPosition: number | null
  estimatedWaitSeconds: number | null
}

export interface ResaleListing {
  id: string
  ticket_id: string
  seller_user_id: string
  price_cents: number
  status: string
  serial?: string
  event_id?: string
  event_title?: string
  venue?: string
  date_time?: string
  created_at: string
}

export interface MerchListing {
  id: string
  seller_user_id: string
  title: string
  description?: string | null
  price_cents: number
  image_url?: string | null
  status: string
  seller_name?: string | null
  created_at: string
}

export interface MerchOrder {
  id: string
  listing_id: string
  qty: number
  total_cents: number
  status: string
  created_at: string
}

export interface MyTicket {
  id: string
  event_id: string
  serial: string
  ticket_status: string
  event_title: string
  venue: string
  date_time: string
  created_at: string
}

export interface MyResaleListing {
  id: string
  ticket_id: string
  price_cents: number
  status: string
  serial: string
  event_title: string
  venue: string
  date_time: string
  created_at: string
}

export interface MyMerchOrder {
  id: string
  listing_id: string
  qty: number
  total_cents: number
  status: string
  listing_title?: string
  image_url?: string | null
  created_at: string
}
