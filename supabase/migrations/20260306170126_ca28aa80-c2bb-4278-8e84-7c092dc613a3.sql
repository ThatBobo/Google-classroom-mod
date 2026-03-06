
ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS access_token text,
  ADD COLUMN IF NOT EXISTS refresh_token text,
  ADD COLUMN IF NOT EXISTS token_expires_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS auth_method text NOT NULL DEFAULT 'api_key';
