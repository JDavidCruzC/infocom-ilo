import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Token público proporcionado por el usuario (Factiliza - plan consultor gratuito).
// Se puede sobrescribir definiendo el secreto FACTILIZA_TOKEN en el proyecto.
const DEFAULT_FACTILIZA_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0MTIyMCIsImh0dHA6Ly9zY2hlbWFzLm1pY3Jvc29mdC5jb20vd3MvMjAwOC8wNi9pZGVudGl0eS9jbGFpbXMvcm9sZSI6ImNvbnN1bHRvciJ9.cQA5mkKquk4jd4C6McnxNNfYUNr8Mlo2MDdD7wr-4G4";

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

    // 1) Factiliza (principal)
    const factilizaToken = Deno.env.get("FACTILIZA_TOKEN") || DEFAULT_FACTILIZA_TOKEN;
    try {
      const res = await fetch(`https://api.factiliza.com/v1/dni/info/${dni}`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${factilizaToken}`,
        },
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
          return new Response(JSON.stringify({
            nombre,
            nombres,
            apellido_paterno: apPat,
            apellido_materno: apMat,
            direccion: d.direccion_completa || d.direccion || "",
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      } else {
        console.error("factiliza error:", res.status, await res.text());
      }
    } catch (e) {
      console.error("factiliza fetch error:", (e as Error)?.message);
    }

    // 2) apis.net.pe (fallback si hay token)
    const apiToken = Deno.env.get("DNI_API_TOKEN");
    if (apiToken) {
      try {
        const res = await fetch(`https://api.apis.net.pe/v2/reniec/dni?numero=${dni}`, {
          headers: { Accept: "application/json", Authorization: `Bearer ${apiToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.nombres) {
            return new Response(JSON.stringify({
              nombre: `${data.nombres} ${data.apellidoPaterno || ""} ${data.apellidoMaterno || ""}`.trim(),
              nombres: data.nombres,
              apellido_paterno: data.apellidoPaterno || "",
              apellido_materno: data.apellidoMaterno || "",
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
        }
      } catch (e) {
        console.error("apis.net.pe fetch error:", (e as Error)?.message);
      }
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
