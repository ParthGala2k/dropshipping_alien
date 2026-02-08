/**
 * Sends purchase confirmation email. Uses Resend when RESEND_API_KEY is set.
 * Set RESEND_FROM to a verified sender (e.g. onboarding@resend.dev for testing).
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = process.env.RESEND_FROM || 'Fair Ticket Queue <onboarding@resend.dev>'

export async function sendPurchaseConfirmation(params: {
  to: string
  fullName: string
  eventTitle: string
  serials: string[]
  totalCents: number
}): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set – skipping confirmation email')
    return false
  }
  const { to, fullName, eventTitle, serials, totalCents } = params
  const total = (totalCents / 100).toFixed(2)
  const ticketList = serials.map((s) => `  • ${s}`).join('\n')
  const html = `
    <h2>Ticket confirmation</h2>
    <p>Hi ${fullName},</p>
    <p>Your tickets for <strong>${eventTitle}</strong> are confirmed.</p>
    <p><strong>Total paid:</strong> $${total}</p>
    <p><strong>Ticket serial(s):</strong></p>
    <pre>${ticketList}</pre>
    <p>Present this confirmation (or serials) at the venue.</p>
    <p>— Fair Ticket Queue</p>
  `
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject: `Tickets confirmed: ${eventTitle}`,
        html,
      }),
    })
    if (!res.ok) {
      const err = await res.text()
      console.error('Resend error:', res.status, err)
      return false
    }
    return true
  } catch (err) {
    console.error('Failed to send confirmation email:', err)
    return false
  }
}
