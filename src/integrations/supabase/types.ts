export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      accounting_sales: {
        Row: {
          created_at: string | null
          created_by: string | null
          date: string
          id: string
          notes: string | null
          product_description: string
          quantity: number
          seller: string
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          date?: string
          id?: string
          notes?: string | null
          product_description: string
          quantity?: number
          seller: string
          total?: number
          unit_price?: number
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          date?: string
          id?: string
          notes?: string | null
          product_description?: string
          quantity?: number
          seller?: string
          total?: number
          unit_price?: number
        }
        Relationships: []
      }
      accounting_services: {
        Row: {
          created_at: string | null
          created_by: string | null
          date: string
          description: string
          device_type: string | null
          diagnosis: string | null
          id: string
          notes: string | null
          price: number
          responsible: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          date?: string
          description: string
          device_type?: string | null
          diagnosis?: string | null
          id?: string
          notes?: string | null
          price?: number
          responsible: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          date?: string
          description?: string
          device_type?: string | null
          diagnosis?: string | null
          id?: string
          notes?: string | null
          price?: number
          responsible?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          description: string | null
          duration_minutes: number
          id: string
          scheduled_at: string
          staff_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          duration_minutes?: number
          id?: string
          scheduled_at: string
          staff_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          description?: string | null
          duration_minutes?: number
          id?: string
          scheduled_at?: string
          staff_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          check_in_time: string | null
          check_out_time: string | null
          created_at: string | null
          date: string
          extra_punches: Json
          id: string
          marked_by: string | null
          notes: string | null
          staff_id: string
          status: string
        }
        Insert: {
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string | null
          date?: string
          extra_punches?: Json
          id?: string
          marked_by?: string | null
          notes?: string | null
          staff_id: string
          status?: string
        }
        Update: {
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string | null
          date?: string
          extra_punches?: Json
          id?: string
          marked_by?: string | null
          notes?: string | null
          staff_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      banners: {
        Row: {
          created_at: string
          cta_text: string | null
          ends_at: string | null
          id: string
          image_desktop: string
          image_mobile: string | null
          is_active: boolean | null
          link_url: string | null
          sort_order: number | null
          starts_at: string | null
          subtitle: string | null
          title: string
        }
        Insert: {
          created_at?: string
          cta_text?: string | null
          ends_at?: string | null
          id?: string
          image_desktop: string
          image_mobile?: string | null
          is_active?: boolean | null
          link_url?: string | null
          sort_order?: number | null
          starts_at?: string | null
          subtitle?: string | null
          title: string
        }
        Update: {
          created_at?: string
          cta_text?: string | null
          ends_at?: string | null
          id?: string
          image_desktop?: string
          image_mobile?: string | null
          is_active?: boolean | null
          link_url?: string | null
          sort_order?: number | null
          starts_at?: string | null
          subtitle?: string | null
          title?: string
        }
        Relationships: []
      }
      brands: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          slug: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          slug: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          slug?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          catalog_url: string | null
          created_at: string
          icon: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          parent_id: string | null
          slug: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          catalog_url?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          catalog_url?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      combo_items: {
        Row: {
          combo_id: string
          created_at: string
          id: string
          product_id: string | null
          product_name: string
          quantity: number
          unit_price: number
        }
        Insert: {
          combo_id: string
          created_at?: string
          id?: string
          product_id?: string | null
          product_name: string
          quantity?: number
          unit_price?: number
        }
        Update: {
          combo_id?: string
          created_at?: string
          id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "combo_items_combo_id_fkey"
            columns: ["combo_id"]
            isOneToOne: false
            referencedRelation: "combos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combo_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      combos: {
        Row: {
          combo_type: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          min_stock: number | null
          name: string
          notes: string | null
          promo_price: number
          stock: number
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          combo_type?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          min_stock?: number | null
          name: string
          notes?: string | null
          promo_price?: number
          stock?: number
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          combo_type?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          min_stock?: number | null
          name?: string
          notes?: string | null
          promo_price?: number
          stock?: number
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      company_certifications: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          issued_by: string | null
          name: string
          sort_order: number | null
          year: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          issued_by?: string | null
          name: string
          sort_order?: number | null
          year?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          issued_by?: string | null
          name?: string
          sort_order?: number | null
          year?: number | null
        }
        Relationships: []
      }
      company_info: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          is_visible: boolean | null
          section_key: string
          sort_order: number | null
          title: string
          updated_at: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          is_visible?: boolean | null
          section_key: string
          sort_order?: number | null
          title: string
          updated_at?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          is_visible?: boolean | null
          section_key?: string
          sort_order?: number | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      company_locations: {
        Row: {
          address: string
          city: string | null
          created_at: string | null
          department: string | null
          gmaps_url: string | null
          id: string
          is_active: boolean | null
          is_main: boolean | null
          name: string
          phone: string | null
          sort_order: number | null
        }
        Insert: {
          address: string
          city?: string | null
          created_at?: string | null
          department?: string | null
          gmaps_url?: string | null
          id?: string
          is_active?: boolean | null
          is_main?: boolean | null
          name: string
          phone?: string | null
          sort_order?: number | null
        }
        Update: {
          address?: string
          city?: string | null
          created_at?: string | null
          department?: string | null
          gmaps_url?: string | null
          id?: string
          is_active?: boolean | null
          is_main?: boolean | null
          name?: string
          phone?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      company_team: {
        Row: {
          bio: string | null
          created_at: string | null
          full_name: string
          id: string
          is_visible: boolean | null
          photo_url: string | null
          role: string
          sort_order: number | null
        }
        Insert: {
          bio?: string | null
          created_at?: string | null
          full_name: string
          id?: string
          is_visible?: boolean | null
          photo_url?: string | null
          role: string
          sort_order?: number | null
        }
        Update: {
          bio?: string | null
          created_at?: string | null
          full_name?: string
          id?: string
          is_visible?: boolean | null
          photo_url?: string | null
          role?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          document_number: string | null
          email: string | null
          full_name: string
          id: string
          is_vip: boolean
          last_purchase_at: string | null
          notes: string | null
          phone: string | null
          total_purchases: number
          total_spent: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          document_number?: string | null
          email?: string | null
          full_name: string
          id?: string
          is_vip?: boolean
          last_purchase_at?: string | null
          notes?: string | null
          phone?: string | null
          total_purchases?: number
          total_spent?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          document_number?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_vip?: boolean
          last_purchase_at?: string | null
          notes?: string | null
          phone?: string | null
          total_purchases?: number
          total_spent?: number
          updated_at?: string
        }
        Relationships: []
      }
      expense_catalog: {
        Row: {
          category: string
          created_at: string
          default_amount: number | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          default_amount?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          default_amount?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          description: string
          expense_date: string
          id: string
          notes: string | null
          payment_method: string | null
          receipt_url: string | null
          supplier_name: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          created_by?: string | null
          description: string
          expense_date?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          supplier_name?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          expense_date?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          supplier_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      inventory_movements: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          movement_type: string
          notes: string | null
          product_id: string | null
          product_name: string
          quantity: number
          reference_id: string | null
          reference_type: string | null
          stock_after: number | null
          stock_before: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          movement_type: string
          notes?: string | null
          product_id?: string | null
          product_name: string
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          stock_after?: number | null
          stock_before?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          movement_type?: string
          notes?: string | null
          product_id?: string | null
          product_name?: string
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          stock_after?: number | null
          stock_before?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string | null
          product_image: string | null
          product_name: string
          quantity: number
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id?: string | null
          product_image?: string | null
          product_name: string
          quantity?: number
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string | null
          product_image?: string | null
          product_name?: string
          quantity?: number
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          id: string
          notes: string | null
          order_number: string
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          payment_proof_url: string | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          shipping_address: string | null
          shipping_city: string | null
          shipping_cost: number | null
          shipping_department: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          id?: string
          notes?: string | null
          order_number: string
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_proof_url?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          shipping_address?: string | null
          shipping_city?: string | null
          shipping_cost?: number | null
          shipping_department?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          id?: string
          notes?: string | null
          order_number?: string
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_proof_url?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          shipping_address?: string | null
          shipping_city?: string | null
          shipping_cost?: number | null
          shipping_department?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      payment_accounts: {
        Row: {
          account_holder: string | null
          account_number: string | null
          bank_name: string | null
          created_at: string
          id: string
          instructions: string | null
          is_active: boolean | null
          label: string
          method: Database["public"]["Enums"]["payment_method"]
          qr_image_url: string | null
          sort_order: number | null
        }
        Insert: {
          account_holder?: string | null
          account_number?: string | null
          bank_name?: string | null
          created_at?: string
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          label: string
          method: Database["public"]["Enums"]["payment_method"]
          qr_image_url?: string | null
          sort_order?: number | null
        }
        Update: {
          account_holder?: string | null
          account_number?: string | null
          bank_name?: string | null
          created_at?: string
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          label?: string
          method?: Database["public"]["Enums"]["payment_method"]
          qr_image_url?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      products: {
        Row: {
          brand_id: string | null
          category_id: string | null
          cost_price: number | null
          created_at: string
          description: string | null
          discount_percent: number | null
          id: string
          images: string[] | null
          is_active: boolean | null
          is_featured: boolean | null
          is_new: boolean | null
          min_stock: number | null
          modelo: string | null
          name: string
          original_price: number | null
          price: number
          short_description: string | null
          sku: string | null
          slug: string
          specifications: Json | null
          stock: number
          updated_at: string
          vitrina_floor: number | null
          vitrina_id: string | null
          weight: number | null
        }
        Insert: {
          brand_id?: string | null
          category_id?: string | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          discount_percent?: number | null
          id?: string
          images?: string[] | null
          is_active?: boolean | null
          is_featured?: boolean | null
          is_new?: boolean | null
          min_stock?: number | null
          modelo?: string | null
          name: string
          original_price?: number | null
          price?: number
          short_description?: string | null
          sku?: string | null
          slug: string
          specifications?: Json | null
          stock?: number
          updated_at?: string
          vitrina_floor?: number | null
          vitrina_id?: string | null
          weight?: number | null
        }
        Update: {
          brand_id?: string | null
          category_id?: string | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          discount_percent?: number | null
          id?: string
          images?: string[] | null
          is_active?: boolean | null
          is_featured?: boolean | null
          is_new?: boolean | null
          min_stock?: number | null
          modelo?: string | null
          name?: string
          original_price?: number | null
          price?: number
          short_description?: string | null
          sku?: string | null
          slug?: string
          specifications?: Json | null
          stock?: number
          updated_at?: string
          vitrina_floor?: number | null
          vitrina_id?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_vitrina_id_fkey"
            columns: ["vitrina_id"]
            isOneToOne: false
            referencedRelation: "vitrinas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          city: string | null
          created_at: string
          department: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          department?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          department?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      purchase_items: {
        Row: {
          created_at: string | null
          id: string
          product_id: string | null
          product_name: string
          purchase_id: string
          quantity: number
          subtotal: number
          unit_cost: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id?: string | null
          product_name: string
          purchase_id: string
          quantity?: number
          subtotal?: number
          unit_cost?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string | null
          product_name?: string
          purchase_id?: string
          quantity?: number
          subtotal?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          arrival_date: string | null
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          order_date: string
          status: string
          supplier_id: string | null
          total: number | null
          updated_at: string | null
        }
        Insert: {
          arrival_date?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          status?: string
          supplier_id?: string | null
          total?: number | null
          updated_at?: string | null
        }
        Update: {
          arrival_date?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          status?: string
          supplier_id?: string | null
          total?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_templates: {
        Row: {
          content_html: string
          content_json: Json | null
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean
          kind: string
          name: string
          paper_size: string
          updated_at: string
        }
        Insert: {
          content_html?: string
          content_json?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          kind: string
          name: string
          paper_size?: string
          updated_at?: string
        }
        Update: {
          content_html?: string
          content_json?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          kind?: string
          name?: string
          paper_size?: string
          updated_at?: string
        }
        Relationships: []
      }
      role_metadata: {
        Row: {
          color: string
          created_at: string
          description: string | null
          icon: string
          is_system: boolean
          label: string
          role_key: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          icon?: string
          is_system?: boolean
          label: string
          role_key: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          icon?: string
          is_system?: boolean
          label?: string
          role_key?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          can_access: boolean
          created_at: string
          id: string
          module: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          can_access?: boolean
          created_at?: string
          id?: string
          module: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          can_access?: boolean
          created_at?: string
          id?: string
          module?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      service_orders: {
        Row: {
          accessories: string | null
          assigned_technician_id: string | null
          completed_at: string | null
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          delivered_at: string | null
          device_brand: string | null
          device_model: string | null
          device_type: string
          diagnosis: string | null
          estimated_cost: number | null
          final_cost: number | null
          id: string
          notes: string | null
          order_number: number
          priority: string
          received_at: string
          received_by_id: string | null
          reported_issue: string
          spare_parts: string | null
          status: string
          updated_at: string
        }
        Insert: {
          accessories?: string | null
          assigned_technician_id?: string | null
          completed_at?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          delivered_at?: string | null
          device_brand?: string | null
          device_model?: string | null
          device_type: string
          diagnosis?: string | null
          estimated_cost?: number | null
          final_cost?: number | null
          id?: string
          notes?: string | null
          order_number?: number
          priority?: string
          received_at?: string
          received_by_id?: string | null
          reported_issue: string
          spare_parts?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          accessories?: string | null
          assigned_technician_id?: string | null
          completed_at?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          delivered_at?: string | null
          device_brand?: string | null
          device_model?: string | null
          device_type?: string
          diagnosis?: string | null
          estimated_cost?: number | null
          final_cost?: number | null
          id?: string
          notes?: string | null
          order_number?: number
          priority?: string
          received_at?: string
          received_by_id?: string | null
          reported_issue?: string
          spare_parts?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      staff_documents: {
        Row: {
          created_at: string
          description: string | null
          file_type: string | null
          id: string
          name: string
          size_bytes: number | null
          staff_id: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_type?: string | null
          id?: string
          name: string
          size_bytes?: number | null
          staff_id: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          file_type?: string | null
          id?: string
          name?: string
          size_bytes?: number | null
          staff_id?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_documents_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_members: {
        Row: {
          address: string | null
          created_at: string | null
          deactivated_at: string | null
          deactivated_reason: string | null
          document_number: string | null
          email: string | null
          full_name: string
          id: string
          institution: string | null
          is_active: boolean | null
          phone: string | null
          position: string
          start_date: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          deactivated_at?: string | null
          deactivated_reason?: string | null
          document_number?: string | null
          email?: string | null
          full_name: string
          id?: string
          institution?: string | null
          is_active?: boolean | null
          phone?: string | null
          position?: string
          start_date?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          deactivated_at?: string | null
          deactivated_reason?: string | null
          document_number?: string | null
          email?: string | null
          full_name?: string
          id?: string
          institution?: string | null
          is_active?: boolean | null
          phone?: string | null
          position?: string
          start_date?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      staff_positions: {
        Row: {
          base_role: Database["public"]["Enums"]["app_role"]
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          base_role?: Database["public"]["Enums"]["app_role"]
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          base_role?: Database["public"]["Enums"]["app_role"]
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      staff_schedules: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean
          shift_name: string
          staff_id: string
          start_time: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time?: string
          id?: string
          is_active?: boolean
          shift_name?: string
          staff_id: string
          start_time?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean
          shift_name?: string
          staff_id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_schedules_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      store_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          company: string | null
          contact_person: string | null
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          phone: string | null
          ruc: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          company?: string | null
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          phone?: string | null
          ruc?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          company?: string | null
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          phone?: string | null
          ruc?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      theme_settings: {
        Row: {
          id: string
          is_active: boolean | null
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          id?: string
          is_active?: boolean | null
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          id?: string
          is_active?: boolean | null
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      transaction_history: {
        Row: {
          accion: string
          created_at: string
          detalles: Json | null
          id: string
          transaction_id: string
          usuario_id: string | null
        }
        Insert: {
          accion: string
          created_at?: string
          detalles?: Json | null
          id?: string
          transaction_id: string
          usuario_id?: string | null
        }
        Update: {
          accion?: string
          created_at?: string
          detalles?: Json | null
          id?: string
          transaction_id?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transaction_history_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_items: {
        Row: {
          cantidad: number
          combo_id: string | null
          combo_parent_item_id: string | null
          created_at: string
          descripcion: string
          diagnostico: string | null
          id: string
          item_type: Database["public"]["Enums"]["item_type"]
          precio_unitario: number
          referencia_id: string | null
          responsable: string | null
          subtotal: number
          tipo_equipo: string | null
          transaction_id: string
        }
        Insert: {
          cantidad?: number
          combo_id?: string | null
          combo_parent_item_id?: string | null
          created_at?: string
          descripcion: string
          diagnostico?: string | null
          id?: string
          item_type: Database["public"]["Enums"]["item_type"]
          precio_unitario?: number
          referencia_id?: string | null
          responsable?: string | null
          subtotal?: number
          tipo_equipo?: string | null
          transaction_id: string
        }
        Update: {
          cantidad?: number
          combo_id?: string | null
          combo_parent_item_id?: string | null
          created_at?: string
          descripcion?: string
          diagnostico?: string | null
          id?: string
          item_type?: Database["public"]["Enums"]["item_type"]
          precio_unitario?: number
          referencia_id?: string | null
          responsable?: string | null
          subtotal?: number
          tipo_equipo?: string | null
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_items_combo_id_fkey"
            columns: ["combo_id"]
            isOneToOne: false
            referencedRelation: "combos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_items_combo_parent_item_id_fkey"
            columns: ["combo_parent_item_id"]
            isOneToOne: false
            referencedRelation: "transaction_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          anulado_en: string | null
          anulado_por: string | null
          cliente_nombre: string | null
          cliente_telefono: string | null
          cobrado_en: string | null
          created_at: string
          created_by: string | null
          devuelto_en: string | null
          devuelto_por: string | null
          emitido_en: string | null
          emitido_por: string | null
          estado: Database["public"]["Enums"]["transaction_status"]
          fecha: string
          id: string
          impuestos: number
          motivo_anulacion: string | null
          motivo_devolucion: string | null
          notas: string | null
          numero_comprobante: string | null
          por_cobrar: boolean
          subtotal_productos: number
          subtotal_servicios: number
          ticket_number: string | null
          tipo_cliente: string | null
          tipo_comprobante: string | null
          tipo_general: Database["public"]["Enums"]["transaction_type"]
          total: number
          updated_at: string
        }
        Insert: {
          anulado_en?: string | null
          anulado_por?: string | null
          cliente_nombre?: string | null
          cliente_telefono?: string | null
          cobrado_en?: string | null
          created_at?: string
          created_by?: string | null
          devuelto_en?: string | null
          devuelto_por?: string | null
          emitido_en?: string | null
          emitido_por?: string | null
          estado?: Database["public"]["Enums"]["transaction_status"]
          fecha?: string
          id?: string
          impuestos?: number
          motivo_anulacion?: string | null
          motivo_devolucion?: string | null
          notas?: string | null
          numero_comprobante?: string | null
          por_cobrar?: boolean
          subtotal_productos?: number
          subtotal_servicios?: number
          ticket_number?: string | null
          tipo_cliente?: string | null
          tipo_comprobante?: string | null
          tipo_general?: Database["public"]["Enums"]["transaction_type"]
          total?: number
          updated_at?: string
        }
        Update: {
          anulado_en?: string | null
          anulado_por?: string | null
          cliente_nombre?: string | null
          cliente_telefono?: string | null
          cobrado_en?: string | null
          created_at?: string
          created_by?: string | null
          devuelto_en?: string | null
          devuelto_por?: string | null
          emitido_en?: string | null
          emitido_por?: string | null
          estado?: Database["public"]["Enums"]["transaction_status"]
          fecha?: string
          id?: string
          impuestos?: number
          motivo_anulacion?: string | null
          motivo_devolucion?: string | null
          notas?: string | null
          numero_comprobante?: string | null
          por_cobrar?: boolean
          subtotal_productos?: number
          subtotal_servicios?: number
          ticket_number?: string | null
          tipo_cliente?: string | null
          tipo_comprobante?: string | null
          tipo_general?: Database["public"]["Enums"]["transaction_type"]
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vitrinas: {
        Row: {
          code: string
          created_at: string
          description: string | null
          floors: number
          id: string
          is_active: boolean | null
          location: string | null
          name: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          floors?: number
          id?: string
          is_active?: boolean | null
          location?: string | null
          name: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          floors?: number
          id?: string
          is_active?: boolean | null
          location?: string | null
          name?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_create_role: {
        Args: {
          _color?: string
          _description?: string
          _icon?: string
          _key: string
          _label: string
        }
        Returns: undefined
      }
      admin_mark_pending_absences: {
        Args: { _month: number; _year: number }
        Returns: number
      }
      admin_set_comprobante_counter: {
        Args: { _kind: string; _value: number }
        Returns: undefined
      }
      auto_mark_absences_today: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      next_comprobante_number: { Args: { _kind: string }; Returns: string }
      terminal_mark_attendance: { Args: { _staff_id: string }; Returns: Json }
    }
    Enums: {
      app_role:
        | "admin"
        | "moderator"
        | "user"
        | "asistente"
        | "terminal"
        | "diseniadora"
      item_type: "producto" | "servicio"
      order_status:
        | "pending"
        | "confirmed"
        | "processing"
        | "shipped"
        | "delivered"
        | "cancelled"
      payment_method:
        | "yape"
        | "plin"
        | "bank_transfer"
        | "mercadopago"
        | "cash"
        | "whatsapp"
        | "other"
      payment_status: "pending" | "paid" | "failed" | "refunded"
      transaction_status: "borrador" | "emitido" | "anulado" | "devuelto"
      transaction_type: "venta" | "servicio" | "mixto"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "moderator",
        "user",
        "asistente",
        "terminal",
        "diseniadora",
      ],
      item_type: ["producto", "servicio"],
      order_status: [
        "pending",
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ],
      payment_method: [
        "yape",
        "plin",
        "bank_transfer",
        "mercadopago",
        "cash",
        "whatsapp",
        "other",
      ],
      payment_status: ["pending", "paid", "failed", "refunded"],
      transaction_status: ["borrador", "emitido", "anulado", "devuelto"],
      transaction_type: ["venta", "servicio", "mixto"],
    },
  },
} as const
