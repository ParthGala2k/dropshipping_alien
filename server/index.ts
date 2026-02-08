import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import authRoutes from './routes/auth.js'
import eventsRoutes from './routes/events.js'
import purchaseRoutes from './routes/purchase.js'
import queueRoutes from './routes/queue.js'
import resaleRoutes from './routes/resale.js'
import merchRoutes from './routes/merch.js'
import myRoutes from './routes/my.js'
import agentRoutes from './routes/agent.js'
import { getDropStatus } from './jobs/apifyDropMonitor.js'
import { query } from './db.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || true,
    credentials: true,
  })
)
app.use(cookieParser())
app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/events', eventsRoutes)
app.use('/api/events', purchaseRoutes)
app.use('/api/queue', queueRoutes)
app.use('/api/resale', resaleRoutes)
app.use('/api/merch', merchRoutes)
app.use('/api/my', myRoutes)
app.use('/api/agent', agentRoutes)

app.get('/api/health', async (_req, res) => {
  try {
    await query('SELECT 1')
    return res.json({ ok: true, database: 'connected' })
  } catch (err) {
    return res.status(503).json({ ok: false, database: 'disconnected', error: (err as Error).message })
  }
})

app.get('/api/drop-status', async (_req, res) => {
  const status = await getDropStatus()
  res.json({ status })
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
