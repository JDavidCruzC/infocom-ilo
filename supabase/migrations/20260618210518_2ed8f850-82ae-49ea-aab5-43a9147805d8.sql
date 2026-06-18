
-- Security definer function: checks role_permissions for user's roles
CREATE OR REPLACE FUNCTION public.has_module_access(_user_id uuid, _module text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role = ur.role
    WHERE ur.user_id = _user_id
      AND rp.module = _module
      AND rp.can_access = true
  )
$$;

GRANT EXECUTE ON FUNCTION public.has_module_access(uuid, text) TO authenticated, anon, service_role;

-- Helper to (re)create the manage policy for a table tied to a module
DO $$
DECLARE
  r record;
  pairs text[][] := ARRAY[
    ['products','inventario'],
    ['brands','marcas'],
    ['categories','categorias'],
    ['vitrinas','vitrinas'],
    ['combos','combos'],
    ['combo_items','combos'],
    ['suppliers','proveedores'],
    ['purchases','compras'],
    ['purchase_items','compras'],
    ['customers','clientes'],
    ['inventory_movements','inventario']
  ];
  i int;
  tbl text;
  modn text;
  polname text;
  pol record;
BEGIN
  FOR i IN 1 .. array_length(pairs,1) LOOP
    tbl := pairs[i][1];
    modn := pairs[i][2];

    -- Drop existing manage-style policies (ALL/INSERT/UPDATE/DELETE) that gate on admin/moderator only
    FOR pol IN
      SELECT policyname, cmd FROM pg_policies
      WHERE schemaname='public' AND tablename = tbl
        AND cmd IN ('ALL','INSERT','UPDATE','DELETE')
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
    END LOOP;

    -- Recreate single ALL policy admin OR moderator OR has_module_access
    EXECUTE format($f$
      CREATE POLICY "Manage %1$s by module permission"
      ON public.%1$I
      FOR ALL
      TO authenticated
      USING (
        public.has_role(auth.uid(),'admin')
        OR public.has_role(auth.uid(),'moderator')
        OR public.has_module_access(auth.uid(), %2$L)
      )
      WITH CHECK (
        public.has_role(auth.uid(),'admin')
        OR public.has_role(auth.uid(),'moderator')
        OR public.has_module_access(auth.uid(), %2$L)
      )
    $f$, tbl, modn);
  END LOOP;
END $$;
