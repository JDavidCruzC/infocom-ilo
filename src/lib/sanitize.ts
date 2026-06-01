/**
 * Centralized input sanitization utilities for INFOCOM.
 *
 * "Sanitización": proceso mediante el cual se reduce el número de elementos
 * potencialmente peligrosos en una entrada (HTML, scripts, caracteres de
 * control, espacios en exceso, longitudes abusivas) hasta un nivel
 * considerado seguro para la aplicación y la base de datos.
 *
 * Capas que aplicamos:
 *  1. Strip de HTML / scripts con DOMPurify (anti-XSS).
 *  2. Normalización Unicode (NFKC) para evitar homoglifos.
 *  3. Eliminación de caracteres de control (\u0000-\u001F, \u007F).
 *  4. Trim y colapso de espacios.
 *  5. Límites de longitud por tipo.
 *  6. Validación de formato con Zod (email, password, teléfono, etc.).
 */
import DOMPurify from "isomorphic-dompurify";
import { z } from "zod";

// ---------- low-level cleaners ----------

/** Strip ALL HTML tags & attributes; keep only plain text. */
export const stripHtml = (raw: string): string =>
  DOMPurify.sanitize(raw, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });

/** Remove control characters (except tab \t and newline \n if preserve=true). */
export const stripControlChars = (raw: string, preserveNewlines = false): string => {
  if (preserveNewlines) {
    return raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  }
  return raw.replace(/[\u0000-\u001F\u007F]/g, "");
};

/** Normalize unicode (NFKC) and collapse whitespace. */
export const normalize = (raw: string): string =>
  raw.normalize("NFKC").replace(/\s+/g, " ").trim();

/**
 * Master sanitizer for plain text inputs (names, addresses, search, etc).
 * Returns a safe string of at most maxLength chars.
 */
export const sanitizeText = (
  raw: unknown,
  options: { maxLength?: number; preserveNewlines?: boolean } = {},
): string => {
  if (raw === null || raw === undefined) return "";
  const str = String(raw);
  const { maxLength = 500, preserveNewlines = false } = options;
  let out = stripHtml(str);
  out = stripControlChars(out, preserveNewlines);
  out = out.normalize("NFKC");
  if (!preserveNewlines) out = out.replace(/\s+/g, " ");
  out = out.trim();
  if (out.length > maxLength) out = out.slice(0, maxLength);
  return out;
};

/** Sanitizer for rich content where some basic formatting is allowed. */
export const sanitizeRichText = (raw: string): string =>
  DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "u", "p", "br", "ul", "ol", "li", "a"],
    ALLOWED_ATTR: ["href", "target", "rel"],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:)/i,
  });

/** Escape a string before injecting it into a URL parameter. */
export const sanitizeForUrl = (raw: string): string =>
  encodeURIComponent(sanitizeText(raw, { maxLength: 1000 }));

/** Email-safe sanitizer. */
export const sanitizeEmail = (raw: string): string =>
  sanitizeText(raw, { maxLength: 254 }).toLowerCase();

/** Numeric-only sanitizer (DNI, RUC, phone). */
export const sanitizeDigits = (raw: string, maxLength = 15): string =>
  String(raw ?? "").replace(/\D+/g, "").slice(0, maxLength);

// ---------- zod schemas ----------

export const emailSchema = z
  .string()
  .trim()
  .min(1, "El correo es obligatorio")
  .max(254, "Correo demasiado largo")
  .email("Correo no válido")
  .transform(sanitizeEmail);

export const passwordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .max(72, "La contraseña no puede exceder 72 caracteres")
  .regex(/[A-Za-z]/, "Debe contener al menos una letra")
  .regex(/\d/, "Debe contener al menos un número");

export const fullNameSchema = z
  .string()
  .trim()
  .min(2, "Nombre demasiado corto")
  .max(80, "Nombre demasiado largo")
  .regex(/^[\p{L}\p{M}\s.'\-]+$/u, "Solo letras, espacios y - . '")
  .transform((v) => sanitizeText(v, { maxLength: 80 }));

export const phoneSchema = z
  .string()
  .transform((v) => sanitizeDigits(v, 15))
  .refine((v) => v.length === 0 || (v.length >= 7 && v.length <= 15), {
    message: "Teléfono no válido (7-15 dígitos)",
  });

export const dniSchema = z
  .string()
  .transform((v) => sanitizeDigits(v, 8))
  .refine((v) => v.length === 8, { message: "DNI debe tener 8 dígitos" });

export const rucSchema = z
  .string()
  .transform((v) => sanitizeDigits(v, 11))
  .refine((v) => v.length === 11, { message: "RUC debe tener 11 dígitos" });

export const messageSchema = z
  .string()
  .trim()
  .min(1, "Mensaje vacío")
  .max(2000, "Mensaje demasiado largo")
  .transform((v) => sanitizeText(v, { maxLength: 2000, preserveNewlines: true }));

// ---------- composite schemas for auth ----------

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Contraseña obligatoria").max(72),
});

export const registerSchema = z
  .object({
    fullName: fullNameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
