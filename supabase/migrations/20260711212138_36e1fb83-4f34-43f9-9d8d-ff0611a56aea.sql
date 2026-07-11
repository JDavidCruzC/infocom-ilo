GRANT SELECT, INSERT, UPDATE ON public.service_orders TO authenticated;
GRANT ALL ON public.service_orders TO service_role;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE public.service_orders_order_number_seq TO authenticated;
GRANT ALL ON SEQUENCE public.service_orders_order_number_seq TO service_role;

DROP POLICY IF EXISTS "All staff can view service orders" ON public.service_orders;
DROP POLICY IF EXISTS "All staff can create service orders" ON public.service_orders;
DROP POLICY IF EXISTS "All staff can update service orders" ON public.service_orders;

CREATE POLICY "All staff can view service orders"
ON public.service_orders
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "All staff can create service orders"
ON public.service_orders
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "All staff can update service orders"
ON public.service_orders
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (auth.uid() IS NOT NULL);