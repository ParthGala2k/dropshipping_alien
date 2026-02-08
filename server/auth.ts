import jwt from 'jsonwebtoken'
import type { Request, Response, NextFunction } from 'express'

const DEV_BYPASS = process.env.DEV_BYPASS_AUTH === 'true'
const APP_JWT_SECRET = process.env.APP_JWT_SECRET || 'dev-secret-change-in-production'
const COOKIE_NAME = 'fair_ticket_session'

export interface AppUser {
  id: string
  alien_user_id: string
  display_name: string | null
  is_verified: boolean
}

export interface SessionPayload {
  userId: string
  alienUserId: string
  displayName: string | null
  isVerified: boolean
}

export function signAppToken(payload: SessionPayload): string {
  return jwt.sign(payload, APP_JWT_SECRET, { expiresIn: '7d' })
}

export function verifyAppToken(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, APP_JWT_SECRET) as SessionPayload
    return decoded
  } catch {
    return null
  }
}

/**
 * Verify Alien host-provided JWT.
 * TODO: Replace with real Alien JWT verification when docs/spec are available.
 * For now: if token is a valid-looking JWT with sub/email/name we accept it; else DEV_BYPASS allows mock.
 */
export function verifyAlienToken(token: string | undefined): { sub: string; name?: string } | null {
  if (!token) return null
  if (DEV_BYPASS && (token === 'dev-bypass' || token.startsWith('dev:'))) {
    const id = token === 'dev-bypass' ? 'dev-user-1' : token.replace('dev:', '')
    return { sub: id, name: id === 'dev-user-1' ? 'Demo Human' : id }
  }
  try {
    // Stub: decode without verification (Alien would provide public key / JWKS)
    const decoded = jwt.decode(token) as { sub?: string; email?: string; name?: string } | null
    if (decoded && typeof decoded.sub === 'string') {
      return { sub: decoded.sub, name: decoded.name ?? decoded.email ?? undefined }
    }
    return null
  } catch {
    return null
  }
}

export function setSessionCookie(res: Response, payload: SessionPayload): void {
  const token = signAppToken(payload)
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  })
}

export function getSessionToken(req: Request): string | undefined {
  return req.cookies?.[COOKIE_NAME]
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: '/' })
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (DEV_BYPASS && req.headers['x-dev-user']) {
    const devUser = req.headers['x-dev-user'] as string
    ;(req as Request & { user: AppUser }).user = {
      id: devUser.startsWith('id:') ? devUser.slice(3) : 'dev-user-id',
      alien_user_id: devUser.startsWith('id:') ? devUser : devUser,
      display_name: 'Dev User',
      is_verified: true,
    }
    return next()
  }
  const token = getSessionToken(req)
  const payload = token ? verifyAppToken(token) : null
  if (!payload) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  ;(req as Request & { user: AppUser }).user = {
    id: payload.userId,
    alien_user_id: payload.alienUserId,
    display_name: payload.displayName,
    is_verified: payload.isVerified,
  }
  next()
}
