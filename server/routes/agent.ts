import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { requireAuth } from '../auth.js'

const router = Router()
router.use(requireAuth)

const suggestBody = z.object({
  type: z.enum(['queue_timing', 'resale_pricing', 'general']),
  context: z.record(z.unknown()).optional(),
})

/**
 * Minimal Agent Assist: returns a suggested message/plan. No state changes.
 * Any action that would change state (join queue, buy, list) must be done by the user via "Approve" in UI.
 */
router.post('/suggest', async (req: Request, res: Response) => {
  const parsed = suggestBody.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid body' })
  const { type, context } = parsed.data

  // Stub: local heuristics. Optional: call OpenAI when OPENAI_API_KEY is set.
  let suggestion: string
  if (type === 'queue_timing') {
    suggestion = 'Best time to join: early in the queue window. Positions are FIFO—join as soon as the event is live to get a lower number.'
  } else if (type === 'resale_pricing') {
    const eventTitle = context?.eventTitle as string | undefined
    suggestion = eventTitle
      ? `For "${eventTitle}", consider listing at 10–20% above face value if demand is high; otherwise list at face value for a quick sale.`
      : 'List at or slightly above face value for a fair resale. Check similar listings on the resale page first.'
  } else {
    suggestion = 'You can join event queues, list tickets for resale, or list merch—all as a verified human. Use Agent Assist for suggestions; you always approve any action.'
  }

  res.json({ suggestion, requiresApproval: true })
})

export default router
