import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { query, getClient } from '../db.js'
import { requireAuth } from '../auth.js'

const router = Router()
router.use(requireAuth)

const CLAIM_WINDOW_SEC = 90

const joinBody = z.object({ eventId: z.string().uuid() })
const tickBody = z.object({ eventId: z.string().uuid() })
const claimBody = z.object({ queueEntryId: z.string().uuid() })
const statusQuery = z.object({ eventId: z.string().uuid() })

// POST /api/queue/join
router.post('/join', async (req: Request, res: Response) => {
  const user = (req as Request & { user: { id: string; is_verified: boolean } }).user
  if (!user.is_verified) return res.status(403).json({ error: 'Only verified humans can join the queue' })
  const parsed = joinBody.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid eventId' })
  const { eventId } = parsed.data
  const client = await getClient()
  try {
    const { rows: existing } = await client.query(
      `SELECT id FROM queue_entries WHERE event_id = $1 AND user_id = $2 AND status IN ('waiting', 'active')`,
      [eventId, user.id]
    )
    if (existing.length) return res.status(409).json({ error: 'Already in queue for this event' })
    const { rows: maxPos } = await client.query<{ m: number }>(
      `SELECT COALESCE(MAX(position), 0) AS m FROM queue_entries WHERE event_id = $1`,
      [eventId]
    )
    const nextPos = (maxPos[0]?.m ?? 0) + 1
    await client.query(
      `INSERT INTO queue_entries (event_id, user_id, status, position) VALUES ($1, $2, 'waiting', $3)`,
      [eventId, user.id, nextPos]
    )
    const { rows: events } = await client.query<{ tickets_remaining: number }>(
      `SELECT tickets_remaining FROM events WHERE id = $1`,
      [eventId]
    )
    if (!events.length) return res.status(404).json({ error: 'Event not found' })
    res.json({ ok: true, position: nextPos, tickets_remaining: events[0].tickets_remaining })
  } finally {
    client.release()
  }
})

// POST /api/queue/tick — call when page loads and every 5s
router.post('/tick', async (req: Request, res: Response) => {
  const parsed = tickBody.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid eventId' })
  const { eventId } = parsed.data
  const client = await getClient()
  try {
    const now = new Date()
    const expired = now.toISOString()
    await client.query(
      `UPDATE queue_entries SET status = 'expired' WHERE event_id = $1 AND status = 'active' AND expires_at < $2`,
      [eventId, expired]
    )
    const { rows: active } = await client.query(
      `SELECT id FROM queue_entries WHERE event_id = $1 AND status = 'active' LIMIT 1`,
      [eventId]
    )
    if (active.length) {
      return res.json({ ok: true, active: true })
    }
    const { rows: next } = await client.query<{ id: string }>(
      `SELECT id FROM queue_entries WHERE event_id = $1 AND status = 'waiting' ORDER BY position ASC LIMIT 1`,
      [eventId]
    )
    if (next.length) {
      const expires = new Date(now.getTime() + CLAIM_WINDOW_SEC * 1000)
      await client.query(
        `UPDATE queue_entries SET status = 'active', activated_at = $1, expires_at = $2 WHERE id = $3`,
        [now, expires, next[0].id]
      )
      return res.json({ ok: true, activated: next[0].id })
    }
    res.json({ ok: true })
  } finally {
    client.release()
  }
})

// POST /api/queue/claim
router.post('/claim', async (req: Request, res: Response) => {
  const user = (req as Request & { user: { id: string; is_verified: boolean } }).user
  if (!user.is_verified) return res.status(403).json({ error: 'Only verified humans can claim' })
  const parsed = claimBody.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid queueEntryId' })
  const { queueEntryId } = parsed.data
  const client = await getClient()
  try {
    await client.query('BEGIN')
    const { rows: entry } = await client.query<{ id: string; event_id: string; user_id: string; status: string; expires_at: Date }>(
      `SELECT id, event_id, user_id, status, expires_at FROM queue_entries WHERE id = $1`,
      [queueEntryId]
    )
    if (!entry.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Queue entry not found' })
    }
    const e = entry[0]
    if (e.user_id !== user.id) {
      await client.query('ROLLBACK')
      return res.status(403).json({ error: 'Not your queue entry' })
    }
    if (e.status !== 'active') {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'Not your turn or already claimed' })
    }
    if (new Date(e.expires_at) < new Date()) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'Claim window expired' })
    }
    const { rows: ev } = await client.query<{ tickets_remaining: number }>(
      `SELECT tickets_remaining FROM events WHERE id = $1 FOR UPDATE`,
      [e.event_id]
    )
    if (!ev.length || ev[0].tickets_remaining < 1) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'No tickets remaining' })
    }
    await client.query(`UPDATE events SET tickets_remaining = tickets_remaining - 1 WHERE id = $1`, [e.event_id])
    const serial = `T-${e.event_id.slice(0, 8)}-${Date.now()}`
    await client.query(
      `INSERT INTO tickets (event_id, owner_user_id, status, serial) VALUES ($1, $2, 'owned', $3)`,
      [e.event_id, user.id, serial]
    )
    await client.query(`UPDATE queue_entries SET status = 'claimed' WHERE id = $1`, [queueEntryId])
    const { rows: ticket } = await client.query<{ id: string; serial: string }>(
      `SELECT id, serial FROM tickets WHERE serial = $1`,
      [serial]
    )
    await client.query('COMMIT')
    res.json({ ok: true, ticket: ticket[0] })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
})

// GET /api/queue/status?eventId=...
router.get('/status', async (req: Request, res: Response) => {
  const user = (req as Request & { user: { id: string } }).user
  const parsed = statusQuery.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid eventId' })
  const { eventId } = parsed.data
  const { rows: event } = await query<{ tickets_remaining: number }>(
    `SELECT tickets_remaining FROM events WHERE id = $1`,
    [eventId]
  )
  if (!event.length) return res.status(404).json({ error: 'Event not found' })
  const { rows: active } = await query<{ id: string; user_id: string; position: number; expires_at: Date }>(
    `SELECT id, user_id, position, expires_at FROM queue_entries WHERE event_id = $1 AND status = 'active' LIMIT 1`,
    [eventId]
  )
  const { rows: myEntry } = await query<{ id: string; status: string; position: number; expires_at: Date }>(
    `SELECT id, status, position, expires_at FROM queue_entries WHERE event_id = $1 AND user_id = $2 AND status IN ('waiting', 'active')`,
    [eventId, user.id]
  )
  const { rows: waitingCount } = await query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM queue_entries WHERE event_id = $1 AND status = 'waiting'`,
    [eventId]
  )
  const waitCount = parseInt(waitingCount[0]?.c ?? '0', 10)
  const myPos = myEntry[0]?.position
  const estimatedWaitSec = myPos != null ? (myPos - 1) * CLAIM_WINDOW_SEC : null
  res.json({
    tickets_remaining: event[0].tickets_remaining,
    activeEntry: active[0] ? { id: active[0].id, userId: active[0].user_id, position: active[0].position, expiresAt: active[0].expires_at } : null,
    yourEntry: myEntry[0] ? { id: myEntry[0].id, status: myEntry[0].status, position: myEntry[0].position, expiresAt: myEntry[0].expires_at } : null,
    yourPosition: myPos ?? null,
    estimatedWaitSeconds: estimatedWaitSec,
  })
})

export default router
