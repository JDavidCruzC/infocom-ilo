
-- Allow moderators full management on operational catalogs (same as admins)

-- combos
DROP POLICY IF EXISTS "Admins manage combos" ON public.combos;
DROP POLICY IF EXISTS "Mods view combos" ON public.combos;
CREATE POLICY "Admins and moderators manage combos" ON public.combos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));

-- combo_items
DROP POLICY IF EXISTS "Admins manage combo items" ON public.combo_items;
DROP POLICY IF EXISTS "Mods view combo items" ON public.combo_items;
CREATE POLICY "Admins and moderators manage combo items" ON public.combo_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));

-- categories
DROP POLICY IF EXISTS "Admins manage categories" ON public.categories;
CREATE POLICY "Admins and moderators manage categories" ON public.categories
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));

-- suppliers
DROP POLICY IF EXISTS "Admins manage suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Mods view suppliers" ON public.suppliers;
CREATE POLICY "Admins and moderators manage suppliers" ON public.suppliers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));

-- purchases
DROP POLICY IF EXISTS "Admins manage purchases" ON public.purchases;
DROP POLICY IF EXISTS "Mods view purchases" ON public.purchases;
CREATE POLICY "Admins and moderators manage purchases" ON public.purchases
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));

-- purchase_items
DROP POLICY IF EXISTS "Admins manage purchase_items" ON public.purchase_items;
DROP POLICY IF EXISTS "Mods view purchase_items" ON public.purchase_items;
CREATE POLICY "Admins and moderators manage purchase_items" ON public.purchase_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));

-- customers
DROP POLICY IF EXISTS "Admins manage customers" ON public.customers;
DROP POLICY IF EXISTS "Mods view customers" ON public.customers;
DROP POLICY IF EXISTS "Mods insert customers" ON public.customers;
CREATE POLICY "Admins and moderators manage customers" ON public.customers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));

-- inventory_movements
DROP POLICY IF EXISTS "Admins manage movements" ON public.inventory_movements;
DROP POLICY IF EXISTS "Mods view movements" ON public.inventory_movements;
DROP POLICY IF EXISTS "Mods insert movements" ON public.inventory_movements;
CREATE POLICY "Admins and moderators manage movements" ON public.inventory_movements
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));
