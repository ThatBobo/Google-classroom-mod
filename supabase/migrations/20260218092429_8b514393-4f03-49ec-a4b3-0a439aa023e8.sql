
-- Align invites table with Opix schema
ALTER TABLE public.invites ADD COLUMN IF NOT EXISTS type text DEFAULT 'link';
ALTER TABLE public.invites ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
ALTER TABLE public.invites ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';
ALTER TABLE public.invites ADD COLUMN IF NOT EXISTS used_at timestamptz;

-- Align invite_events table: add event_data jsonb, make event_type text
-- Drop the old enum constraint by adding a text column
ALTER TABLE public.invite_events ADD COLUMN IF NOT EXISTS event_data jsonb DEFAULT '{}'::jsonb;
-- We need to convert event_type from enum to text
ALTER TABLE public.invite_events ALTER COLUMN event_type TYPE text USING event_type::text;
-- Drop the enum type if no longer used
DROP TYPE IF EXISTS public.invite_event_type;

-- Align integrations table: add owner column mirroring user_id
ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS owner uuid;
UPDATE public.integrations SET owner = user_id WHERE owner IS NULL;

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_invites_type ON invites(type);
CREATE INDEX IF NOT EXISTS idx_invites_status ON invites(status);
CREATE INDEX IF NOT EXISTS idx_invites_expires_at ON invites(expires_at);
CREATE INDEX IF NOT EXISTS idx_invite_events_invite_id ON invite_events(invite_id);
CREATE INDEX IF NOT EXISTS idx_integrations_owner ON integrations(owner);

-- RLS POLICIES (error-proof, skip if exists)

-- Public read for invite events
DO $$ BEGIN
  BEGIN
    CREATE POLICY "Public read invite events" ON invite_events FOR SELECT USING (true);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END$$;

-- Invite owner can update
DO $$ BEGIN
  BEGIN
    CREATE POLICY "Invite owner can update" ON invites FOR UPDATE USING (auth.uid() = created_by);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END$$;

-- Anyone can insert invites
DO $$ BEGIN
  BEGIN
    CREATE POLICY "Anyone can insert invites" ON invites FOR INSERT WITH CHECK (true);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END$$;

-- REALTIME
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'invites'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE invites;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'invite_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE invite_events;
  END IF;
END$$;

-- FUNCTIONS + TRIGGERS

CREATE OR REPLACE FUNCTION public.log_invite_created()
RETURNS trigger AS $$
BEGIN
  INSERT INTO invite_events (invite_id, event_type, event_data)
  VALUES (new.id, 'created', jsonb_build_object(
    'type', new.type,
    'status', new.status,
    'source', new.source,
    'created_at', new.created_at
  ));
  RETURN new;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.log_invite_status_change()
RETURNS trigger AS $$
BEGIN
  IF new.status IS DISTINCT FROM old.status THEN
    INSERT INTO invite_events (invite_id, event_type, event_data)
    VALUES (new.id, new.status, jsonb_build_object(
      'old_status', old.status,
      'new_status', new.status,
      'used_at', new.used_at,
      'expires_at', new.expires_at
    ));
  ELSE
    INSERT INTO invite_events (invite_id, event_type, event_data)
    VALUES (new.id, 'updated', jsonb_build_object(
      'old_row', row_to_json(old),
      'new_row', row_to_json(new)
    ));
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers
DROP TRIGGER IF EXISTS trg_invite_created ON invites;
CREATE TRIGGER trg_invite_created
AFTER INSERT ON invites
FOR EACH ROW
EXECUTE FUNCTION log_invite_created();

DROP TRIGGER IF EXISTS trg_invite_status_change ON invites;
CREATE TRIGGER trg_invite_status_change
AFTER UPDATE ON invites
FOR EACH ROW
EXECUTE FUNCTION log_invite_status_change();
