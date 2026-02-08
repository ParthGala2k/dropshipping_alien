#!/usr/bin/env node
/**
 * Quick script to test database connection. Run from server dir:
 *   node check-db.js
 * Or from project root:
 *   node server/check-db.js
 * Requires: DATABASE_URL in .env (or set before running)
 */
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import dotenv from 'dotenv'
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '.env') })
import pg from 'pg'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('Missing DATABASE_URL in environment (.env)')
  process.exit(1)
}

const client = new pg.Client({ connectionString })
client
  .connect()
  .then(() => client.query('SELECT 1 as ok'))
  .then((res) => {
    console.log('Database connected successfully. Ping:', res.rows[0])
    return client.end()
  })
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Database connection failed:', err.message)
    client.end().catch(() => {})
    process.exit(1)
  })
