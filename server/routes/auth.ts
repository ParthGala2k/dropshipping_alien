import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { query } from '../db.js'
import { verifyAlienToken, setSessionCookie, clearSessionCookie } from '../auth.js'

const router = Router()

const AlienBody = z.object({ token: z.string().min(1) })

router.post('/alien', async (req: Request, res: Response) => {
  const parsed = AlienBody.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Missing or invalid token' })
  }
  const alien = verifyAlienToken(parsed.data.token)
  if (!alien) {
    return res.status(401).json({ error: 'Invalid Alien token' })
  }
  const { rows: users } = await query<{ id: string; display_name: string | null; is_verified: boolean }>(
    `INSERT INTO users (alien_user_id, display_name, is_verified)
     VALUES ($1, $2, true)
     ON CONFLICT (alien_user_id) DO UPDATE SET display_name = COALESCE(EXCLUDED.display_name, users.display_name)
     RETURNING id, display_name, is_verified`,
    [alien.sub, alien.name ?? null]
  )
  const user = users[0]
  if (!user) return res.status(500).json({ error: 'Failed to upsert user' })
  setSessionCookie(res, {
    userId: user.id,
    alienUserId: alien.sub,
    displayName: user.display_name,
    isVerified: user.is_verified,
  })
  res.json({ ok: true, user: { id: user.id, display_name: user.display_name, is_verified: user.is_verified } })
})

router.post('/logout', (_req, res) => {
  clearSessionCookie(res)
  res.json({ ok: true })
})

export default router
