# Plan de implementación

## 1. Nuevo rol `terminal` (Semi-Administrador / Terminal Tienda)

**Base de datos (migración):**
- Añadir valor `'terminal'` al enum `app_role`.
- Insertar permisos por defecto en `role_permissions` para `terminal`: solo `pos` y `asistencias` activos; el resto bloqueados.
- Las políticas RLS existentes (`has_role(_, 'admin')`, `'moderator'`) ya cubren acceso; `terminal` queda restringido salvo lo que se habilite explícitamente vía `role_permissions`.

**Frontend:**
- `usePermissions.tsx`: agregar `terminal` como rol soportado (admin sigue siendo "todo permitido"; terminal pasa por `role_permissions` igual que moderator).
- `PermissionsConfigPage.tsx`: añadir tab "Terminal Tienda" con icono y conteo. Admin lo edita.
- `RolesPage.tsx`: opción en el `Select` para asignar rol `terminal`.
- `ProtectedRoute.tsx`: incluir `terminal` en `ADMIN_PANEL_ROLES` (puede entrar al panel admin, pero solo verá módulos permitidos).
- `AttendancePage.tsx`: detectar rol `terminal` y:
  - Bloquear edición manual de celdas (A/F/T/J/D) y horas en la grilla mensual (read-only).
  - Mantener habilitada únicamente la tarjeta superior "Marcar Asistencia Rápida — Hoy" para su propio `staff_id` (filtrar selector al usuario actual).

## 2. Reportes mensuales en PDF

**Cálculo de horas:**
- Helper `calcMonthlyHours(records, schedules)` que sume horas reales por empleado: `(check_out - check_in)` + extra_punches pares, ignorando faltas/justificadas/descansos.
- Mostrar columna/resumen "Total Horas" en la vista mensual.

**Exportación (usando `jspdf` + `jspdf-autotable`, ya estilo dark tech):**
- Botón **"PDF General del Mes"**: una tabla por trabajador con días, estado, entrada/salida, horas, totales (A/F/T/J/D, horas trabajadas, extras placeholder).
- Selector de empleado + botón **"PDF Individual"**: mismo formato pero un solo trabajador.
- Estilo: fondo oscuro, header verde corporativo, fuente sans, encabezado con logo/empresa, footer con `© {YYYY} INFOCOM SOLUCIONES` y página X/Y.

## 3. Personal: dirección y documentos adjuntos

**Migración:**
- `staff_members`: añadir `address text`.
- Nueva tabla `staff_documents` (id, staff_id, name, file_url, file_type, size_bytes, uploaded_by, created_at) + GRANTs + RLS (admin gestiona, moderator/usuario ve sus propios).
- Bucket de Storage privado `staff-documents` con políticas: admins all, staff lee solo carpeta `{user_id}/`.

**Frontend (`StaffPage.tsx`):**
- Añadir input "Dirección" (requerido) en el formulario crear/editar.
- Sección "Documentos Adjuntos" en el dialog: dropzone que acepta PDF (otros formatos opcionales), lista los documentos con botones Ver (abre signed URL en nueva pestaña) y Descargar; admin puede eliminar.

## 4. Columna "Extra" (placeholder)

- Mantener visualización actual en la tabla con un tooltip "Cálculo en revisión — pendiente de optimización" y dejar comentario `// TODO: refactor overtime logic` en el helper de cálculo. Sin cambios funcionales.

## Detalles técnicos

- Librerías ya instaladas: `jspdf`, `jspdf-autotable` (verificar; si faltan, `bun add`).
- Storage: `supabase--storage_create_bucket` para `staff-documents` privado, luego RLS en `storage.objects`.
- Migración corre primero (enum + tabla + columna). Tras aprobación, regenero types y aplico cambios de código.
- Sanitización: aplicar `sanitizeText` al campo de dirección y nombre de documento usando el helper ya existente en `src/lib/sanitize.ts`.

¿Procedo con la migración y la implementación?