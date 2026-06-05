// Shared types used across the application

export interface Product {
  id: string;
  name: string;
  slug: string;
  description?: string;
  short_description?: string;
  sku?: string;
  price: number;
  original_price?: number;
  cost_price?: number;
  stock: number;
  min_stock?: number;
  category_id?: string;
  brand_id?: string;
  images: string[];
  specifications?: Record<string, string>;
  is_active?: boolean;
  is_featured?: boolean;
  is_new?: boolean;
  discount_percent?: number;
  weight?: number;
  created_at?: string;
  updated_at?: string;
  // Joined fields
  category?: Category;
  brand?: Brand;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  image_url?: string;
  parent_id?: string;
  sort_order?: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  children?: Category[];
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  is_active?: boolean;
  sort_order?: number;
  created_at?: string;
}

export interface Banner {
  id: string;
  title: string;
  subtitle?: string;
  image_desktop: string;
  image_mobile?: string;
  link_url?: string;
  cta_text?: string;
  sort_order?: number;
  is_active?: boolean;
  starts_at?: string;
  ends_at?: string;
  created_at?: string;
}

export interface Order {
  id: string;
  order_number: string;
  user_id?: string;
  status: OrderStatus;
  payment_method?: PaymentMethod;
  payment_status?: PaymentStatus;
  payment_proof_url?: string;
  subtotal: number;
  shipping_cost: number;
  total: number;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  shipping_address?: string;
  shipping_city?: string;
  shipping_department?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id?: string;
  product_name: string;
  product_image?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface PaymentAccount {
  id: string;
  method: PaymentMethod;
  label: string;
  account_number?: string;
  account_holder?: string;
  bank_name?: string;
  qr_image_url?: string;
  instructions?: string;
  is_active?: boolean;
  sort_order?: number;
}

export interface Profile {
  id: string;
  user_id: string;
  full_name?: string;
  phone?: string;
  avatar_url?: string;
  address?: string;
  city?: string;
  department?: string;
}

export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
export type PaymentMethod = 'yape' | 'plin' | 'bank_transfer' | 'mercadopago' | 'cash' | 'whatsapp' | 'other';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type AppRole = 'admin' | 'moderator' | 'user' | 'terminal';

export interface CartItem {
  product: Product;
  quantity: number;
}

export const CURRENCY = "S/";
export const COMPANY_NAME = "INFOCOM TECNOLOGÍA";
export const COMPANY_EMAIL = "infocomcotizaciones@gmail.com";
export const COMPANY_PHONE = "+51 963 326 971";
export const COMPANY_ADDRESS = "24 de Octubre Mz 53 Lt 03, casa, 18601 Ilo - Ilo, Moquegua - Perú";
export const WHATSAPP_NUMBER = "51963326971";

export const SOCIAL_LINKS = {
  facebook: "https://www.facebook.com/InfocomILo",
  tiktok: "https://www.tiktok.com/@infocomsoluciones",
  youtube: "https://www.youtube.com/@infocomilo",
};

export const COMPANY_INFO = {
  mission: "Cubrir las necesidades en equipos de cómputo, suministros y reparaciones para nuestros clientes generando confianza, otorgándole un valor agregado al servicio teniendo la calidad y la atención personalizada que usted se merece.",
  vision: "En INFOCOM, visualizamos un futuro donde la tecnología empodera a cada hogar, empresa e institución en Ilo. Con 11 años de trayectoria, nos consolidamos como el socio tecnológico preferido, reconocido por nuestra capacidad de innovar y adaptarnos a las necesidades cambiantes de nuestros clientes. Aspiramos a ser el referente en la región, ofreciendo soluciones integrales que van desde productos de vanguardia como cámaras, impresoras y sistemas de seguridad, hasta servicios especializados y un soporte técnico excepcional.",
  description: "Empresa ileña brindando soluciones en equipos de Cómputo en general, equipos de Seguridad y de Telecomunicaciones, atendiendo a clientes hogar, pymes y corporativos, además de servicios especializados y un Soporte Técnico excepcional.",
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  processing: 'En Proceso',
  shipped: 'Enviado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  yape: 'Yape',
  plin: 'Plin',
  bank_transfer: 'Transferencia Bancaria',
  mercadopago: 'MercadoPago',
  cash: 'Efectivo',
  whatsapp: 'WhatsApp',
  other: 'Otro',
};
