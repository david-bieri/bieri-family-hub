-- ─── Messages ─────────────────────────────────────────────────────────────────
-- Unified feed: in-app posts (channel='app') and inbound SMS (channel='sms')
CREATE TABLE IF NOT EXISTS messages (
  id           TEXT PRIMARY KEY,
  channel      TEXT NOT NULL DEFAULT 'app',   -- 'app' | 'sms'
  author       TEXT NOT NULL,                  -- display name or phone number
  body         TEXT NOT NULL,
  phone_from   TEXT,                           -- raw E.164 phone for SMS rows
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages (created_at DESC);

-- ─── Phone contacts (optional display-name mapping for inbound SMS) ──────────
-- Maps a raw E.164 phone number to a friendly name shown in the feed.
-- If no mapping exists for an inbound SMS number, the raw number is shown.
CREATE TABLE IF NOT EXISTS phone_contacts (
  id           TEXT PRIMARY KEY,
  phone        TEXT NOT NULL UNIQUE,   -- E.164, e.g. +15405551234
  name         TEXT NOT NULL
);
