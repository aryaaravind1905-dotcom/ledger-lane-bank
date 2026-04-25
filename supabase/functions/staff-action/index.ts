// Staff actions — UI demo. Posts staff replies and updates status using service role.
// In production this would be gated by a real staff role; here it's a permissive demo endpoint.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE);

    const body = await req.json();
    const { action, ticket_id, content } = body ?? {};
    if (!action || !ticket_id) {
      return new Response(JSON.stringify({ error: "action and ticket_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Staff demo gate (header-based; replace with real role check in prod)
    const staffKey = req.headers.get("x-staff-key");
    if (staffKey !== "demo-staff") {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reply") {
      if (!content) {
        return new Response(JSON.stringify({ error: "content required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await admin.from("ticket_messages").insert({ ticket_id, sender: "staff", content });
    } else if (action === "resolve") {
      await admin
        .from("support_tickets")
        .update({ status: "resolved", resolved_at: new Date().toISOString() })
        .eq("id", ticket_id);
      await admin
        .from("ticket_messages")
        .insert({ ticket_id, sender: "staff", content: "✓ Ticket marked as resolved." });
    } else {
      return new Response(JSON.stringify({ error: "unknown action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
