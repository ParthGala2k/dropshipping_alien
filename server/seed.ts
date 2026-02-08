import 'dotenv/config'
import { getClient } from './db.js'

async function seed() {
  const client = await getClient()

  try {
    // Ensure at least one dev user for DEV_BYPASS
    await client.query(
      `INSERT INTO users (alien_user_id, display_name, is_verified) VALUES ('dev-user-1', 'Demo Human', true) ON CONFLICT (alien_user_id) DO NOTHING`
    )

    // Remove existing seed events so we never have duplicates when re-running seed
    await client.query(
      `DELETE FROM events WHERE title IN ('Neon Nights Festival', 'Cosmic Concert', 'Alien Expo 2025')`
    )

    // 3 events
    const events = [
      { title: 'Neon Nights Festival', venue: 'Skyline Arena', city: 'San Francisco', date_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), total_tickets: 100, tickets_remaining: 98 },
      { title: 'Cosmic Concert', venue: 'Starlight Hall', city: 'Austin', date_time: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), total_tickets: 50, tickets_remaining: 50 },
      { title: 'Alien Expo 2025', venue: 'Convention Center', city: 'Seattle', date_time: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), total_tickets: 200, tickets_remaining: 200 },
    ]
    const eventIds: string[] = []
    for (const e of events) {
      const { rows } = await client.query(
        `INSERT INTO events (title, venue, city, date_time, total_tickets, tickets_remaining) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [e.title, e.venue, e.city, e.date_time, e.total_tickets, e.tickets_remaining]
      )
      const eventId = rows[0].id
      eventIds.push(eventId)
      await client.query(
        `INSERT INTO event_ticket_levels (event_id, name, price_cents, quantity_remaining, sort_order) VALUES ($1, 'General Admission', 5000, $2, 0)`,
        [eventId, e.tickets_remaining]
      )
    }
    // Ensure any existing events without levels get one (e.g. after migration 002)
    const { rows: eventsWithoutLevels } = await client.query(
      `SELECT e.id, e.tickets_remaining FROM events e WHERE NOT EXISTS (SELECT 1 FROM event_ticket_levels l WHERE l.event_id = e.id)`
    )
    for (const ev of eventsWithoutLevels as { id: string; tickets_remaining: number }[]) {
      await client.query(
        `INSERT INTO event_ticket_levels (event_id, name, price_cents, quantity_remaining, sort_order) VALUES ($1, 'General Admission', 5000, $2, 0)`,
        [ev.id, ev.tickets_remaining]
      )
    }

    // Get dev user id for initial tickets
    const { rows: users } = await client.query<{ id: string }>(`SELECT id FROM users WHERE alien_user_id = 'dev-user-1' LIMIT 1`)
    const userId = users[0]?.id
    if (userId) {
      for (let i = 0; i < 2; i++) {
        await client.query(
          `INSERT INTO tickets (event_id, owner_user_id, status, serial) VALUES ($1, $2, 'owned', $3) ON CONFLICT (serial) DO NOTHING`,
          [eventIds[0], userId, `T-${eventIds[0].slice(0, 8)}-seed-${i + 1}`]
        )
      }
    }

    console.log('Seed complete: 3 events, optional dev user + 2 tickets for event 1')
  } finally {
    client.release()
  }
  process.exit(0)
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})
