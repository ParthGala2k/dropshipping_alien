-- One-time cleanup: remove duplicate events (same title + venue), keeping the most recently created one.
-- Run this in Supabase SQL Editor if you see duplicate events on the events page.

DELETE FROM events
WHERE id NOT IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY title, venue ORDER BY created_at DESC) AS rn
    FROM events
  ) sub
  WHERE rn = 1
);

-- Prevent future duplicates (optional; only add if no other events share the same title+venue)
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_events_title_venue ON events (title, venue);
