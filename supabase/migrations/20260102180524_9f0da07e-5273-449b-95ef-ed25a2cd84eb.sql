-- Drop existing restrictive INSERT policy
DROP POLICY IF EXISTS "Users can create organizations" ON public.organizations;

-- Recreate as PERMISSIVE policy (default)
CREATE POLICY "Users can create organizations" 
ON public.organizations
FOR INSERT 
TO authenticated
WITH CHECK (true);