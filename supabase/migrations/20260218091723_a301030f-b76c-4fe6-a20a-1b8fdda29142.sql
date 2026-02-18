
-- Allow any authenticated user to find a class by class_code (needed for joining)
CREATE POLICY "Anyone can find class by code"
ON public.classes
FOR SELECT
TO authenticated
USING (true);

-- Drop the old restrictive select policy since the new one covers it
DROP POLICY IF EXISTS "Members can view classes" ON public.classes;
