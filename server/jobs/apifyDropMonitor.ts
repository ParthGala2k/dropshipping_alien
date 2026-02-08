/**
 * Optional Apify integration: monitor drop pages / event inventory.
 * Enable with APIFY_TOKEN and APIFY_DROP_URL env vars. Feature-flag in app.
 */

const APIFY_TOKEN = process.env.APIFY_TOKEN
const APIFY_DROP_URL = process.env.APIFY_DROP_URL

export type DropStatus = 'live' | 'unknown' | 'offline'

let cachedStatus: DropStatus = 'unknown'
let lastFetch = 0
const CACHE_MS = 60_000

export async function getDropStatus(): Promise<DropStatus> {
  if (!APIFY_TOKEN || !APIFY_DROP_URL) return 'unknown'
  if (Date.now() - lastFetch < CACHE_MS) return cachedStatus
  try {
    // Minimal: use fetch to scrape or call Apify actor if you have one.
    // For MVP we simulate: fetch the URL and infer "live" if 200.
    const res = await fetch(APIFY_DROP_URL, { signal: AbortSignal.timeout(5000) })
    cachedStatus = res.ok ? 'live' : 'offline'
    lastFetch = Date.now()
    return cachedStatus
  } catch {
    cachedStatus = 'unknown'
    lastFetch = Date.now()
    return cachedStatus
  }
}

export function setDropStatusForEvent(_eventId: string, status: DropStatus): void {
  cachedStatus = status
}
