import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_FACTILIZA_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0MTIyMCIsImh0dHA6Ly9zY2hlbWFzLm1pY3Jvc29mdC5jb20vd3MvMjAwOC8wNi9pZGVudGl0eS9jbGFpbXMvcm9sZSI6ImNvbnN1bHRvciJ9.cQA5mkKquk4jd4C6McnxNNfYUNr8Mlo2MDdD7wr-4G4";
const DEFAULT_LIMIT = 100;

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(supabaseUrl, serviceRoleKey);

function currentPeriod() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function getConfig() {
  const { data } = await admin.from("store_settings").select("value").eq("key", "dni_api_config").maybeSingle();
  const v: any = data?.value || {};
  const period = currentPeriod();
  const stored = v.period === period ? (v.count || 0) : 0;
  return {
    token: (v.token && String(v.token).trim()) || DEFAULT_FACTILIZA_TOKEN,
    limit: Number(v.limit) || DEFAULT_LIMIT,
    count: stored,
    period,
  };
}

async function incrementUsage(cfg: { token: string; limit: number; count: number; period: string }) {
  const newVal = { token: cfg.token, limit: cfg.limit, count: cfg.count + 1, period: cfg.period, last_used_at: new Date().toISOString() };
  const { data: existing } = await admin.from("store_settings").select("id").eq("key", "dni_api_config").maybeSingle();
  if (existing) {
    await admin.from("store_settings").update({ value: newVal }).eq("key", "dni_api_config");
  } else {
    await admin.from("store_settings").insert({ key: "dni_api_config", value: newVal });
  }
  return newVal.count;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { dni } = await req.json();
    if (!dni || String(dni).length !== 8) {
      return new Response(JSON.stringify({ error: "DNI debe tener 8 dígitos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cfg = await getConfig();

    if (cfg.count >= cfg.limit) {
      return new Response(JSON.stringify({
        error: `Límite mensual alcanzado (${cfg.count}/${cfg.limit}). Actualiza el token en Configuración → API DNI.`,
        usage: { count: cfg.count, limit: cfg.limit, period: cfg.period },
      }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    try {
      const res = await fetch(`https://api.factiliza.com/v1/dni/info/${dni}`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${cfg.token}` },
      });
      if (res.ok) {
        const json = await res.json();
        const d = json?.data;
        if (d && (d.nombres || d.nombre_completo)) {
          const nombres = d.nombres || "";
          const apPat = d.apellido_paterno || "";
          const apMat = d.apellido_materno || "";
          const nombre = d.nombre_completo
            ? `${nombres} ${apPat} ${apMat}`.trim() || d.nombre_completo
            : `${nombres} ${apPat} ${apMat}`.trim();
          const newCount = await incrementUsage(cfg);
          return new Response(JSON.stringify({
            nombre,
            nombres,
            apellido_paterno: apPat,
            apellido_materno: apMat,
            direccion: d.direccion_completa || d.direccion || "",
            usage: { count: newCount, limit: cfg.limit, period: cfg.period },
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      } else {
        const txt = await res.text();
        console.error("factiliza error:", res.status, txt);
        if (res.status === 401 || res.status === 403) {
          return new Response(JSON.stringify({
            error: "Token de Factiliza inválido o expirado. Actualízalo en Configuración → API DNI.",
          }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
    } catch (e) {
      console.error("factiliza fetch error:", (e as Error)?.message);
    }

    return new Response(JSON.stringify({
      error: "No se encontró el DNI. Ingrese el nombre manualmente.",
    }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = (e as Error)?.message || "Error";
    console.error("General error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
