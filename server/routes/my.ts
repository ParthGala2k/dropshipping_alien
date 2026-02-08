import { Router, Request, Response } from 'express'
import { query } from '../db.js'
import { requireAuth } from '../auth.js'

const router = Router()
router.use(requireAuth)

// GET /api/my/tickets
router.get('/tickets', async (req: Request, res: Response) => {
  const user = (req as Request & { user: { id: string } }).user
  const { rows } = await query(
    `SELECT t.id, t.event_id, t.serial, t.status AS ticket_status, t.created_at,
            e.title AS event_title, e.venue, e.date_time
     FROM tickets t
     JOIN events e ON e.id = t.event_id
     WHERE t.owner_user_id = $1
     ORDER BY t.created_at DESC`,
    [user.id]
  )
  res.json(rows.map((r: Record<string, unknown>) => ({
    ...r,
    date_time: r.date_time instanceof Date ? (r.date_time as Date).toISOString() : r.date_time,
    created_at: r.created_at instanceof Date ? (r.created_at as Date).toISOString() : r.created_at,
  })))
})

// GET /api/my/resale-listings
router.get('/resale-listings', async (req: Request, res: Response) => {
  const user = (req as Request & { user: { id: string } }).user
  const { rows } = await query(
    `SELECT r.id, r.ticket_id, r.price_cents, r.status, r.created_at,
            t.serial, e.title AS event_title, e.venue, e.date_time
     FROM resale_listings r
     JOIN tickets t ON t.id = r.ticket_id
     JOIN events e ON e.id = t.event_id
     WHERE r.seller_user_id = $1
     ORDER BY r.created_at DESC`,
    [user.id]
  )
  res.json(rows.map((r: Record<string, unknown>) => ({
    ...r,
    date_time: r.date_time instanceof Date ? (r.date_time as Date).toISOString() : r.date_time,
    created_at: r.created_at instanceof Date ? (r.created_at as Date).toISOString() : r.created_at,
  })))
})

// GET /api/my/merch-listings (as seller)
router.get('/merch-listings', async (req: Request, res: Response) => {
  const user = (req as Request & { user: { id: string } }).user
  const { rows } = await query(
    `SELECT m.id, m.title, m.description, m.price_cents, m.image_url, m.status, m.created_at
     FROM merch_listings m WHERE m.seller_user_id = $1 ORDER BY m.created_at DESC`,
    [user.id]
  )
  res.json(rows.map((r: Record<string, unknown>) => ({
    ...r,
    created_at: r.created_at instanceof Date ? (r.created_at as Date).toISOString() : r.created_at,
  })))
})

// GET /api/my/merch-orders (as buyer)
router.get('/merch-orders', async (req: Request, res: Response) => {
  const user = (req as Request & { user: { id: string } }).user
  const { rows } = await query(
    `SELECT o.id, o.listing_id, o.qty, o.total_cents, o.status, o.created_at,
            m.title AS listing_title, m.image_url
     FROM merch_orders o
     JOIN merch_listings m ON m.id = o.listing_id
     WHERE o.buyer_user_id = $1
     ORDER BY o.created_at DESC`,
    [user.id]
  )
  res.json(rows.map((r: Record<string, unknown>) => ({
    ...r,
    created_at: r.created_at instanceof Date ? (r.created_at as Date).toISOString() : r.created_at,
  })))
})

// GET /api/my/merch-orders/selling (orders on my listings)
router.get('/merch-orders/selling', async (req: Request, res: Response) => {
  const user = (req as Request & { user: { id: string } }).user
  const { rows } = await query(
    `SELECT o.id, o.listing_id, o.qty, o.total_cents, o.status, o.created_at,
            m.title AS listing_title
     FROM merch_orders o
     JOIN merch_listings m ON m.id = o.listing_id
     WHERE m.seller_user_id = $1
     ORDER BY o.created_at DESC`,
    [user.id]
  )
  res.json(rows.map((r: Record<string, unknown>) => ({
    ...r,
    created_at: r.created_at instanceof Date ? (r.created_at as Date).toISOString() : r.created_at,
  })))
})

export default router
