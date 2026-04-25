// Staff list — returns all tickets (or filtered) with last message + user info.
// Demo gate via x-staff-key header.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-staff-key",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (req.headers.get("x-staff-key") !== "demo-staff") {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE);

    const url = new URL(req.url);
    const filter = url.searchParams.get("filter") ?? "all";
    const id = url.searchParams.get("id");

    if (id) {
      const { data: ticket } = await admin.from("support_tickets").select("*").eq("id", id).single();
      const { data: messages } = await admin
        .from("ticket_messages")
        .select("*")
        .eq("ticket_id", id)
        .order("created_at", { ascending: true });
      const { data: profile } = ticket
        ? await admin.from("profiles").select("full_name").eq("id", ticket.user_id).single()
        : { data: null };
      return new Response(JSON.stringify({ ticket, messages: messages ?? [], profile }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let q = admin.from("support_tickets").select("*").order("created_at", { ascending: false });
    if (filter === "escalated") q = q.eq("status", "escalated");
    else if (filter === "auto_resolved") q = q.eq("status", "resolved");
    const { data: tickets } = await q.limit(200);

    return new Response(JSON.stringify({ tickets: tickets ?? [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
