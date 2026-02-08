-- Fair Ticket Queue for Verified Humans - Initial Schema
-- Run with: supabase db push or apply via Supabase SQL editor

-- Users (Alien-verified identity)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alien_user_id TEXT UNIQUE NOT NULL,
  display_name TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_alien_user_id ON users(alien_user_id);

-- Events
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  venue TEXT NOT NULL,
  city TEXT NOT NULL,
  date_time TIMESTAMPTZ NOT NULL,
  total_tickets INT NOT NULL,
  tickets_remaining INT NOT NULL,
  drop_status TEXT DEFAULT 'unknown',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Queue entries
CREATE TYPE queue_entry_status AS ENUM ('waiting', 'active', 'expired', 'claimed');

CREATE TABLE IF NOT EXISTS queue_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status queue_entry_status NOT NULL DEFAULT 'waiting',
  position INT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_queue_entries_one_per_user_per_event
  ON queue_entries(event_id, user_id)
  WHERE status IN ('waiting', 'active');

CREATE INDEX IF NOT EXISTS idx_queue_entries_event_status ON queue_entries(event_id, status);
CREATE INDEX IF NOT EXISTS idx_queue_entries_event_position ON queue_entries(event_id, position);

-- Tickets
CREATE TYPE ticket_status AS ENUM ('owned', 'listed');

CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status ticket_status NOT NULL DEFAULT 'owned',
  serial TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tickets_owner ON tickets(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_event ON tickets(event_id);

-- Resale listings
CREATE TYPE resale_listing_status AS ENUM ('active', 'sold', 'cancelled');

CREATE TABLE IF NOT EXISTS resale_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID UNIQUE NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  seller_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  price_cents INT NOT NULL,
  status resale_listing_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resale_listings_status ON resale_listings(status);

-- Resale purchases
CREATE TABLE IF NOT EXISTS resale_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES resale_listings(id) ON DELETE CASCADE,
  buyer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  price_cents INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Merch listings
CREATE TYPE merch_listing_status AS ENUM ('active', 'paused');

CREATE TABLE IF NOT EXISTS merch_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  price_cents INT NOT NULL,
  image_url TEXT,
  status merch_listing_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Merch orders
CREATE TYPE merch_order_status AS ENUM ('placed', 'shipped', 'cancelled');

CREATE TABLE IF NOT EXISTS merch_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES merch_listings(id) ON DELETE CASCADE,
  buyer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  qty INT NOT NULL,
  total_cents INT NOT NULL,
  status merch_order_status NOT NULL DEFAULT 'placed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_merch_orders_buyer ON merch_orders(buyer_user_id);
CREATE INDEX IF NOT EXISTS idx_merch_orders_listing ON merch_orders(listing_id);
