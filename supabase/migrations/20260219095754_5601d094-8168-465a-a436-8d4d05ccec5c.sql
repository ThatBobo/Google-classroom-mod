
-- Add URL column to integrations
ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS url text;

-- Add credits column to profiles (default 10 credits)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS credits integer NOT NULL DEFAULT 10;

-- Add class_id to integrations so they're class-scoped
ALTER TABLE public.integrations ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE;

-- Index for class-scoped queries
CREATE INDEX IF NOT EXISTS idx_integrations_class_id ON public.integrations(class_id);
