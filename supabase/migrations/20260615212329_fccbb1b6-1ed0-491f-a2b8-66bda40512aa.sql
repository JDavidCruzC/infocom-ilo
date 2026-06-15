GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_orders TO authenticated;
GRANT ALL ON public.service_orders TO service_role;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE public.service_orders_order_number_seq TO authenticated;
GRANT ALL ON SEQUENCE public.service_orders_order_number_seq TO service_role;

DO $$
DECLARE tbl record; has_priv boolean;
BEGIN
  FOR tbl IN SELECT c.relname AS table_name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='r' AND n.nspname='public' LOOP
    SELECT EXISTS(SELECT 1 FROM information_schema.role_table_grants WHERE grantee='authenticated' AND table_schema='public' AND table_name=tbl.table_name AND privilege_type IN ('SELECT','INSERT','UPDATE','DELETE')) INTO has_priv;
    IF NOT has_priv THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', tbl.table_name);
    END IF;
    SELECT EXISTS(SELECT 1 FROM information_schema.role_table_grants WHERE grantee='service_role' AND table_schema='public' AND table_name=tbl.table_name AND privilege_type IN ('SELECT','INSERT','UPDATE','DELETE')) INTO has_priv;
    IF NOT has_priv THEN
      EXECUTE format('GRANT ALL ON public.%I TO service_role', tbl.table_name);
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE seq record;
BEGIN
  FOR seq IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='S' AND n.nspname='public' LOOP
    EXECUTE format('GRANT USAGE, SELECT, UPDATE ON SEQUENCE public.%I TO authenticated', seq.relname);
    EXECUTE format('GRANT ALL ON SEQUENCE public.%I TO service_role', seq.relname);
  END LOOP;
END $$;