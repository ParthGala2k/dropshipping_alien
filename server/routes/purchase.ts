import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { getClient } from '../db.js'
import { requireAuth } from '../auth.js'
import { sendPurchaseConfirmation } from '../email.js'

const router = Router()
router.use(requireAuth)

const MAX_QUANTITY = 6

const purchaseBody = z.object({
  queueEntryId: z.string().uuid(),
  levelId: z.string().uuid(),
  quantity: z.number().int().min(1).max(MAX_QUANTITY),
  email: z.string().email(),
  fullName: z.string().min(1),
  addressLine1: z.string().optional(),
  addressCity: z.string().optional(),
  addressPostalCode: z.string().optional(),
})

// POST /api/events/:id/purchase — complete purchase (queue slot must be active)
router.post('/:eventId/purchase', async (req: Request, res: Response) => {
  const user = (req as Request & { user: { id: string; is_verified: boolean } }).user
  if (!user.is_verified) return res.status(403).json({ error: 'Only verified humans can purchase' })
  const eventId = req.params.eventId
  const parsed = purchaseBody.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request. Check quantity (1–6), email, and name.' })
  }
  const { queueEntryId, levelId, quantity, email, fullName, addressLine1, addressCity, addressPostalCode } = parsed.data

  const client = await getClient()
  try {
    await client.query('BEGIN')

    const { rows: entry } = await client.query<{ id: string; event_id: string; user_id: string; status: string; expires_at: Date }>(
      `SELECT id, event_id, user_id, status, expires_at FROM queue_entries WHERE id = $1 FOR UPDATE`,
      [queueEntryId]
    )
    if (!entry.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Queue entry not found' })
    }
    const e = entry[0]
    if (e.event_id !== eventId) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'Event does not match queue entry' })
    }
    if (e.user_id !== user.id) {
      await client.query('ROLLBACK')
      return res.status(403).json({ error: 'Not your queue entry' })
    }
    if (e.status !== 'active') {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'Not your turn or already completed' })
    }
    if (new Date(e.expires_at) < new Date()) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'Purchase window expired' })
    }

    const { rows: level } = await client.query<{ id: string; name: string; price_cents: number; quantity_remaining: number }>(
      `SELECT id, name, price_cents, quantity_remaining FROM event_ticket_levels WHERE id = $1 AND event_id = $2 FOR UPDATE`,
      [levelId, eventId]
    )
    if (!level.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Ticket level not found' })
    }
    const lev = level[0]
    if (lev.quantity_remaining < quantity) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: `Only ${lev.quantity_remaining} tickets left for this level` })
    }

    const totalCents = lev.price_cents * quantity
    const { rows: purchaseRows } = await client.query(
      `INSERT INTO event_purchases (event_id, user_id, queue_entry_id, email, full_name, address_line1, address_city, address_postal_code, total_cents, quantity, level_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'completed')
       RETURNING id, total_cents, quantity, created_at`,
      [eventId, user.id, queueEntryId, email, fullName, addressLine1 ?? null, addressCity ?? null, addressPostalCode ?? null, totalCents, quantity, levelId]
    )
    const purchase = purchaseRows[0] as { id: string; total_cents: number; quantity: number; created_at: Date }

    const serials: string[] = []
    for (let i = 0; i < quantity; i++) {
      const serial = `T-${eventId.slice(0, 8)}-${Date.now()}-${i}`
      serials.push(serial)
      await client.query(
        `INSERT INTO tickets (event_id, owner_user_id, status, serial, purchase_id, level_name) VALUES ($1, $2, 'owned', $3, $4, $5)`,
        [eventId, user.id, serial, purchase.id, lev.name]
      )
    }

    const { rows: eventRow } = await client.query<{ title: string }>(`SELECT title FROM events WHERE id = $1`, [eventId])
    const eventTitle = eventRow[0]?.title ?? 'Event'

    await client.query(`UPDATE event_ticket_levels SET quantity_remaining = quantity_remaining - $1 WHERE id = $2`, [quantity, levelId])
    await client.query(`UPDATE events SET tickets_remaining = tickets_remaining - $1 WHERE id = $2`, [quantity, eventId])
    await client.query(`UPDATE queue_entries SET status = 'claimed' WHERE id = $1`, [queueEntryId])

    await client.query('COMMIT')

    sendPurchaseConfirmation({
      to: email,
      fullName,
      eventTitle,
      serials,
      totalCents: totalCents,
    }).catch((err) => console.error('Email send failed:', err))

    res.status(201).json({
      ok: true,
      purchase: {
        id: purchase.id,
        totalCents: purchase.total_cents,
        quantity: purchase.quantity,
        levelName: lev.name,
        email,
        createdAt: purchase.created_at.toISOString(),
      },
      message: `Confirmation and tickets sent to ${email}`,
    })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
})

export default router
