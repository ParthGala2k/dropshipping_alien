import { Router, Request, Response } from 'express'
import { query } from '../db.js'
import { requireAuth } from '../auth.js'

const router = Router()

export interface EventRow {
  id: string
  title: string
  venue: string
  city: string
  date_time: Date
  total_tickets: number
  tickets_remaining: number
  drop_status: string | null
  created_at: Date
}

// GET /api/events — list (optional auth for drop_status)
router.get('/', async (_req: Request, res: Response) => {
  const { rows } = await query<EventRow>(
    `SELECT id, title, venue, city, date_time, total_tickets, tickets_remaining, drop_status, created_at FROM events ORDER BY date_time ASC`
  )
  res.json(rows.map((e) => ({ ...e, date_time: e.date_time.toISOString(), created_at: e.created_at.toISOString() })))
})

// GET /api/events/:id — single event (public)
router.get('/:id', async (req: Request, res: Response) => {
  const { rows } = await query<EventRow>(
    `SELECT id, title, venue, city, date_time, total_tickets, tickets_remaining, drop_status, created_at FROM events WHERE id = $1`,
    [req.params.id]
  )
  if (!rows.length) return res.status(404).json({ error: 'Event not found' })
  const e = rows[0]
  res.json({ ...e, date_time: e.date_time.toISOString(), created_at: e.created_at.toISOString() })
})

// GET /api/events/:id/levels — ticket levels (venue “map”: levels with prices)
router.get('/:id/levels', async (req: Request, res: Response) => {
  const { rows } = await query(
    `SELECT id, event_id, name, price_cents, quantity_remaining, sort_order FROM event_ticket_levels WHERE event_id = $1 ORDER BY sort_order ASC, name ASC`,
    [req.params.id]
  )
  res.json(rows)
})

export default router
