import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { query } from '../db.js'
import { requireAuth } from '../auth.js'

const router = Router()

const createListingBody = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  priceCents: z.number().int().min(0),
  imageUrl: z.string().url().optional().or(z.literal('')),
})
const createOrderBody = z.object({ listingId: z.string().uuid(), qty: z.number().int().min(1) })
const updateOrderStatusBody = z.object({ orderId: z.string().uuid(), status: z.enum(['placed', 'shipped', 'cancelled']) })

// GET /api/merch/listings — browse (no auth required to view)
router.get('/listings', async (_req: Request, res: Response) => {
  const { rows } = await query(
    `SELECT m.id, m.seller_user_id, m.title, m.description, m.price_cents, m.image_url, m.status, m.created_at,
            u.display_name AS seller_name
     FROM merch_listings m
     LEFT JOIN users u ON u.id = m.seller_user_id
     WHERE m.status = 'active'
     ORDER BY m.created_at DESC`
  )
  res.json(rows.map((r: Record<string, unknown>) => ({
    ...r,
    created_at: r.created_at instanceof Date ? (r.created_at as Date).toISOString() : r.created_at,
  })))
})

// POST /api/merch/listings — create (verified only)
router.post('/listings', requireAuth, async (req: Request, res: Response) => {
  const user = (req as Request & { user: { id: string; is_verified: boolean } }).user
  if (!user.is_verified) return res.status(403).json({ error: 'Only verified humans can list merch' })
  const parsed = createListingBody.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body' })
  const { title, description, priceCents, imageUrl } = parsed.data
  const { rows } = await query(
    `INSERT INTO merch_listings (seller_user_id, title, description, price_cents, image_url, status)
     VALUES ($1, $2, $3, $4, $5, 'active')
     RETURNING id, title, description, price_cents, image_url, status, created_at`,
    [user.id, title, description ?? null, priceCents, imageUrl || null]
  )
  const r = rows[0] as Record<string, unknown>
  res.status(201).json({ ...r, created_at: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at })
})

// POST /api/merch/orders — place order
router.post('/orders', requireAuth, async (req: Request, res: Response) => {
  const user = (req as Request & { user: { id: string; is_verified: boolean } }).user
  if (!user.is_verified) return res.status(403).json({ error: 'Only verified humans can order' })
  const parsed = createOrderBody.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body' })
  const { listingId, qty } = parsed.data
  const { rows: listing } = await query(
    `SELECT id, price_cents FROM merch_listings WHERE id = $1 AND status = 'active'`,
    [listingId]
  )
  if (!listing.length) return res.status(404).json({ error: 'Listing not found' })
  const totalCents = listing[0].price_cents * qty
  const { rows: ins } = await query(
    `INSERT INTO merch_orders (listing_id, buyer_user_id, qty, total_cents, status)
     VALUES ($1, $2, $3, $4, 'placed')
     RETURNING id, listing_id, qty, total_cents, status, created_at`,
    [listingId, user.id, qty, totalCents]
  )
  const r = ins[0] as Record<string, unknown>
  res.status(201).json({ ...r, created_at: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at })
})

// PATCH /api/merch/orders — seller mark shipped
router.patch('/orders', requireAuth, async (req: Request, res: Response) => {
  const user = (req as Request & { user: { id: string } }).user
  const parsed = updateOrderStatusBody.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body' })
  const { orderId, status } = parsed.data
  const { rows: order } = await query(
    `SELECT o.id, m.seller_user_id FROM merch_orders o JOIN merch_listings m ON m.id = o.listing_id WHERE o.id = $1`,
    [orderId]
  )
  if (!order.length) return res.status(404).json({ error: 'Order not found' })
  if ((order[0] as { seller_user_id: string }).seller_user_id !== user.id) return res.status(403).json({ error: 'Not your listing' })
  await query(`UPDATE merch_orders SET status = $1 WHERE id = $2`, [status, orderId])
  res.json({ ok: true, status })
})

export default router
