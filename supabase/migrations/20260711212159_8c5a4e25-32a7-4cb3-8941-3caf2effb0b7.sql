DROP POLICY IF EXISTS "All staff can create service orders" ON public.service_orders;
DROP POLICY IF EXISTS "All staff can update service orders" ON public.service_orders;

CREATE POLICY "All staff can create service orders"
ON public.service_orders
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "All staff can update service orders"
ON public.service_orders
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);