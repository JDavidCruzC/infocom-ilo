
CREATE SEQUENCE IF NOT EXISTS public.service_orders_order_number_seq;

SELECT setval('public.service_orders_order_number_seq',
  GREATEST(COALESCE((SELECT MAX(order_number) FROM public.service_orders), 0), 1));

ALTER TABLE public.service_orders
  ALTER COLUMN order_number SET DEFAULT nextval('public.service_orders_order_number_seq');

ALTER SEQUENCE public.service_orders_order_number_seq OWNED BY public.service_orders.order_number;
