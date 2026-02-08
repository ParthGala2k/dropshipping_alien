# Fair Ticket Queue — Alien Mini App

**Fair Ticket Queue for Verified Humans**: queue + purchase window, verified resale, and community merch dropshipping. Built for the Alien Mini App ecosystem with identity-first rules and a minimal AI agent (human-approved actions only).

## Tech stack

- **Frontend**: Vite, React 18, TypeScript, TailwindCSS, shadcn-style UI (CVA + Tailwind), Lucide icons, React Router, TanStack Query
- **Backend**: Node, Express, TypeScript, Zod, pg (Postgres)
- **DB**: Supabase (Postgres); migrations in `supabase/migrations/`
- **Auth**: Alien host provides JWT → backend verifies (stub verifier + `DEV_BYPASS_AUTH` for local demo) → app session in httpOnly cookie

## Repository structure

```
/client          # Vite + React SPA
/server          # Express API (auth, queue, resale, merch, agent)
/supabase        # SQL migrations
```

## Setup

### 1. Dependencies

```bash
npm install
cd client && npm install && cd ..
cd server && npm install && cd ..
```

### 2. Environment variables

**Server** (`/server/.env`):

```env
# Required
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Session signing (change in production)
APP_JWT_SECRET=your-secret-min-32-chars

# Optional: local demo without Alien host
DEV_BYPASS_AUTH=true

# Optional: CORS (e.g. http://localhost:5173 for Vite dev)
CORS_ORIGIN=http://localhost:5173

# Optional: Apify drop monitor (feature-flag style)
# APIFY_TOKEN=...
# APIFY_DROP_URL=https://...
```

**Client** (optional):

- `VITE_API_URL` — leave unset in dev (Vite proxies `/api` to the server). Set to your backend URL for production builds.
- `VITE_DEV_BYPASS_AUTH=true` — auto “Demo login” on load in dev (no Alien host).

### 3. Database

- Create a Supabase project and get the connection string.
- Apply migrations (Supabase dashboard SQL editor or CLI):

```bash
# From project root: paste contents of supabase/migrations/001_initial_schema.sql into Supabase SQL editor and run.
```

### 4. Seed data

```bash
cd server && npm run build && npm run seed && cd ..
```

Creates 3 events and (if dev user exists) 2 sample tickets for the first event.

### 5. Run locally

**Terminal 1 — API:**

```bash
npm run dev:server
# or: cd server && npm run dev
```

**Terminal 2 — Frontend:**

```bash
npm run dev:client
# or: cd client && npm run dev
```

- App: http://localhost:5173  
- API: http://localhost:3001  

Use **Demo login** (header) when `DEV_BYPASS_AUTH=true` on the server and you’re not inside the Alien host.

## Testing inside the Alien app

1. Deploy the frontend to a URL the Alien host can load (e.g. Vercel/Netlify).
2. In the Alien host, embed the app (e.g. iframe or webview) and inject the host JWT so the app can read it:
   - Set `window.__ALIEN_JWT__ = <host JWT>` before or when the app loads.
3. The app calls `POST /api/auth/alien` with `{ token: window.__ALIEN_JWT__ }` and then uses the session cookie for all API requests.
4. Ensure the backend allows your frontend origin in `CORS_ORIGIN` and is served over HTTPS so cookies work.

## Demo script (≈30 seconds)

1. Open http://localhost:5173 and click **Demo login** (with server `DEV_BYPASS_AUTH=true`).
2. **Events** → open an event → **Join queue**.
3. **Queue**: wait for “Your turn” (or trigger tick: reload or wait 5s). Click **Claim ticket** in the modal before the countdown ends.
4. **My** → see your ticket; optionally **List for resale** (enter price in cents), then open **Resale** in another session (or same) and **Buy**.
5. **Merch** → **List item** (title, price), then **Order** as same or another user. **My** → **Orders on my listings** → **Mark shipped**.

## Deployment

- **Frontend**: Vercel or Netlify. Set `VITE_API_URL` to your backend URL. Build: `npm run build -w client`.
- **Backend**: Render, Fly.io, or similar. Set `DATABASE_URL`, `APP_JWT_SECRET`, `CORS_ORIGIN` (your frontend URL). Run: `node dist/index.js` after `npm run build -w server`.
- **DB**: Use Supabase hosted Postgres; run migrations once.

## Product rules (identity-first)

- Only verified humans can join queues, create listings, buy/resell, or list merch.
- One verified human = one active queue position per event; queue position is server-assigned (FIFO).
- Purchase window: 90 seconds to claim when it’s your turn; otherwise you’re skipped.
- Resale: one active resale listing per ticket; sellers and buyers must be verified; ownership transfers on purchase.
- Merch: only verified users list/order; orders have fulfillment status (e.g. placed → shipped).

## Agent assist (AI ↔ trust)

- **Agent Assist** suggests messages (e.g. “best time to join”, “resale pricing suggestion”) via a stub/local heuristic (optional OpenAI behind env).
- Any agent-suggested **action** that changes state (join queue, buy, list) requires explicit human confirmation (“Approve”) in the UI; the app never auto-executes state-changing actions.

## Apify (optional)

- `server/jobs/apifyDropMonitor.ts`: if `APIFY_TOKEN` and `APIFY_DROP_URL` are set, fetches drop status and caches it; `/api/drop-status` returns `live` / `unknown` / `offline`.
- Event detail can show a small “Drop status” badge when the feature is enabled.

## Assumptions

- Alien host provides a JWT that identifies the user; verification is stubbed with a TODO for production (Alien docs/spec to be used when available). `DEV_BYPASS_AUTH` and token `dev-bypass` allow local demos without the host.
- Payments: no real payment integration in MVP; “Pay” / “Buy” / “Order” complete the flow in the DB only. A future “Pay with Alien” button could record a payment intent when Alien payments are available.
- Cline & Greptile: used for fast auditing/iteration during development; not integrated as runtime products.

## Scripts

| Command | Description |
|--------|-------------|
| `npm run dev` | Concurrent server + client (from root) |
| `npm run dev:client` | Vite dev server |
| `npm run dev:server` | Express dev (tsx watch) |
| `npm run build` | Build client and server |
| `npm run seed` | Run DB seed (from root: runs server seed script) |
