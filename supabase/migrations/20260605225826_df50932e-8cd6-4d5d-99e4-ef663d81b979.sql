GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;

INSERT INTO public.role_metadata (role_key, label, icon, color, description, is_system, sort_order)
VALUES (
  'terminal',
  'Terminal Tienda',
  'Monitor',
  'text-accent',
  'Cuenta para terminales físicas: ventas y marcado de asistencia. No puede editar manualmente la cuadrícula.',
  true,
  3
)
ON CONFLICT (role_key) DO UPDATE
SET label = EXCLUDED.label,
    icon = EXCLUDED.icon,
    color = EXCLUDED.color,
    description = EXCLUDED.description,
    is_system = EXCLUDED.is_system,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();

INSERT INTO public.role_permissions (role, module, can_access)
VALUES
  ('terminal', 'dashboard', false),
  ('terminal', 'recepcion', false),
  ('terminal', 'soporte', false),
  ('terminal', 'inventario', false),
  ('terminal', 'combos', false),
  ('terminal', 'vitrinas', false),
  ('terminal', 'categorias', false),
  ('terminal', 'marcas', false),
  ('terminal', 'kardex', false),
  ('terminal', 'compras', false),
  ('terminal', 'proveedores', false),
  ('terminal', 'pos', true),
  ('terminal', 'pedidos', false),
  ('terminal', 'contabilidad', false),
  ('terminal', 'clientes', false),
  ('terminal', 'agenda', false),
  ('terminal', 'banners', false),
  ('terminal', 'pagos', false),
  ('terminal', 'empresa', false),
  ('terminal', 'personal', false),
  ('terminal', 'asistencias', true),
  ('terminal', 'roles', false),
  ('terminal', 'configuracion', false)
ON CONFLICT (role, module) DO UPDATE
SET can_access = EXCLUDED.can_access,
    updated_at = now();