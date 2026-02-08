-- Ticket levels per event (e.g. General, VIP) and purchase flow

-- Ticket levels for an event (venue "map" is represented by level names; no levels = single "General" level)
CREATE TABLE IF NOT EXISTS event_ticket_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price_cents INT NOT NULL,
  quantity_remaining INT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_ticket_levels_event ON event_ticket_levels(event_id);

-- Purchase record (one per checkout: user + event + queue claim)
CREATE TABLE IF NOT EXISTS event_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  queue_entry_id UUID REFERENCES queue_entries(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  address_line1 TEXT,
  address_city TEXT,
  address_postal_code TEXT,
  total_cents INT NOT NULL,
  quantity INT NOT NULL,
  level_id UUID REFERENCES event_ticket_levels(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_purchases_user ON event_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_event_purchases_event ON event_purchases(event_id);

-- Add optional purchase and level to tickets
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS purchase_id UUID REFERENCES event_purchases(id) ON DELETE SET NULL;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS level_name TEXT;

CREATE INDEX IF NOT EXISTS idx_tickets_purchase ON tickets(purchase_id);
