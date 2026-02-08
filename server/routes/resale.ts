import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { query, getClient } from '../db.js'
import { requireAuth } from '../auth.js'

const router = Router()
router.use(requireAuth)

const createListingBody = z.object({ ticketId: z.string().uuid(), priceCents: z.number().int().min(1) })
const purchaseBody = z.object({ listingId: z.string().uuid() })

// GET /api/resale/listings — browse active
router.get('/listings', async (_req: Request, res: Response) => {
  const { rows } = await query(
    `SELECT r.id, r.ticket_id, r.seller_user_id, r.price_cents, r.status, r.created_at,
            t.serial, t.event_id,
            e.title AS event_title, e.venue, e.date_time
     FROM resale_listings r
     JOIN tickets t ON t.id = r.ticket_id
     JOIN events e ON e.id = t.event_id
     WHERE r.status = 'active'
     ORDER BY r.created_at DESC`
  )
  res.json(rows.map((r: Record<string, unknown>) => ({
    ...r,
    date_time: r.date_time instanceof Date ? (r.date_time as Date).toISOString() : r.date_time,
    created_at: r.created_at instanceof Date ? (r.created_at as Date).toISOString() : r.created_at,
  })))
})

// POST /api/resale/list — create listing (verified only)
router.post('/list', async (req: Request, res: Response) => {
  const user = (req as Request & { user: { id: string; is_verified: boolean } }).user
  if (!user.is_verified) return res.status(403).json({ error: 'Only verified humans can list' })
  const parsed = createListingBody.safeParse(req.body)
  if (!parsed.success) {
    const msg = parsed.error.issues.find((i) => i.path.includes('priceCents'))
      ? 'Price must be at least 1 cent'
      : 'Invalid request. Check ticket and price.'
    return res.status(400).json({ error: msg })
  }
  const { ticketId, priceCents } = parsed.data
  const { rows: ticket } = await query(
    `SELECT id, owner_user_id, status FROM tickets WHERE id = $1`,
    [ticketId]
  )
  if (!ticket.length) return res.status(404).json({ error: 'Ticket not found' })
  const t0 = ticket[0] as { owner_user_id: string; status: string }
  if (t0.owner_user_id !== user.id) return res.status(403).json({ error: 'Not your ticket' })
  if (t0.status === 'listed') return res.status(400).json({ error: 'Ticket already listed' })
  const { rows: existing } = await query(
    `SELECT id FROM resale_listings WHERE ticket_id = $1 AND status = 'active'`,
    [ticketId]
  )
  if (existing.length) return res.status(400).json({ error: 'Already have active listing for this ticket' })
  const client = await getClient()
  try {
    await client.query('BEGIN')
    await client.query(`UPDATE tickets SET status = 'listed' WHERE id = $1`, [ticketId])
    const { rows: ins } = await client.query(
      `INSERT INTO resale_listings (ticket_id, seller_user_id, price_cents, status) VALUES ($1, $2, $3, 'active') RETURNING id, ticket_id, price_cents, status, created_at`,
      [ticketId, user.id, priceCents]
    )
    await client.query('COMMIT')
    const r = ins[0]
    res.status(201).json({ ...r, created_at: r.created_at?.toISOString?.() ?? r.created_at })
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    client.release()
  }
})

// POST /api/resale/purchase
router.post('/purchase', async (req: Request, res: Response) => {
  const user = (req as Request & { user: { id: string; is_verified: boolean } }).user
  if (!user.is_verified) return res.status(403).json({ error: 'Only verified humans can buy' })
  const parsed = purchaseBody.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid listingId' })
  const { listingId } = parsed.data
  const client = await getClient()
  try {
    await client.query('BEGIN')
    const { rows: listing } = await client.query(
      `SELECT id, ticket_id, seller_user_id, price_cents FROM resale_listings WHERE id = $1 AND status = 'active' FOR UPDATE`,
      [listingId]
    )
    if (!listing.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Listing not found or not active' })
    }
    const l = listing[0]
    if (l.seller_user_id === user.id) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'Cannot buy your own listing' })
    }
    await client.query(
      `INSERT INTO resale_purchases (listing_id, buyer_user_id, price_cents) VALUES ($1, $2, $3)`,
      [listingId, user.id, l.price_cents]
    )
    await client.query(`UPDATE resale_listings SET status = 'sold' WHERE id = $1`, [listingId])
    await client.query(`UPDATE tickets SET owner_user_id = $1, status = 'owned' WHERE id = $2`, [user.id, l.ticket_id])
    await client.query('COMMIT')
    res.json({ ok: true, ticketId: l.ticket_id })
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    client.release()
  }
})

export default router
