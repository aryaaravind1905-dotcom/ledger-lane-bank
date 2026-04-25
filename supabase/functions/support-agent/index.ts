// Support agent — calls Lovable AI with tool-calling for banking RPCs.
// Loops up to 5 times: model decides to call tools, we execute, feed results back.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are LedgerLane Support — a helpful, concise banking support agent.

You have access to tools that read live account data and (when explicitly requested by the user) take actions on their behalf.

Guidelines:
- Be warm but brief. Use INR (₹) formatting.
- ALWAYS call tools to fetch real data before answering balance/transaction/loan/FD/card questions. Never guess numbers.
- For destructive actions (transfer, repay EMI, premature FD withdraw, set/unblock PIN, apply loan, create FD), confirm intent first unless the user already explicitly authorized it in this conversation.
- If a tool errors with "insufficient_balance", "card_blocked", "pin_must_be_4_digits" etc., explain plainly and suggest next steps.
- If you cannot resolve the issue (fraud, dispute, complex complaint), respond with the literal token [ESCALATE] at the end of your message and a human will take over.
- Keep replies under 4 short paragraphs. Use markdown lists when helpful.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "get_accounts",
      description: "List the user's bank accounts with balances in paise.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_recent_transactions",
      description: "Get the user's most recent transactions (last 20).",
      parameters: {
        type: "object",
        properties: { limit: { type: "number", description: "1-50, default 20" } },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_loans",
      description: "List the user's loans with status, EMI and balance.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_fixed_deposits",
      description: "List the user's fixed deposits.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_cards",
      description: "List the user's cards (masked) with status.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_autopays",
      description: "List the user's autopay configurations.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "execute_transfer",
      description: "Send money. Requires explicit user confirmation.",
      parameters: {
        type: "object",
        properties: {
          from_account_id: { type: "string" },
          to_account_number: { type: "string" },
          to_ifsc: { type: "string" },
          amount_paise: { type: "number" },
          description: { type: "string" },
        },
        required: ["from_account_id", "to_account_number", "to_ifsc", "amount_paise"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "unblock_card",
      description: "Unblock a card with OTP and a new 4-digit PIN.",
      parameters: {
        type: "object",
        properties: {
          card_id: { type: "string" },
          otp: { type: "string", description: "6 digits" },
          new_pin: { type: "string", description: "4 digits" },
        },
        required: ["card_id", "otp", "new_pin"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "classify_ticket",
      description: "Set a classification for the current ticket. Call this once you understand the topic.",
      parameters: {
        type: "object",
        properties: {
          classification: {
            type: "string",
            enum: ["account", "payments", "cards", "loans", "fd", "autopay", "other"],
          },
        },
        required: ["classification"],
        additionalProperties: false,
      },
    },
  },
];

async function runTool(supabase: any, name: string, args: any, ticketId: string) {
  switch (name) {
    case "get_accounts": {
      const { data: accs } = await supabase.from("accounts").select("*");
      const enriched = await Promise.all(
        (accs ?? []).map(async (a: any) => {
          const { data: bal } = await supabase.rpc("account_balance_paise", { p_account: a.id });
          return { ...a, balance_paise: bal ?? 0 };
        }),
      );
      return enriched;
    }
    case "get_recent_transactions": {
      const limit = Math.min(Math.max(args?.limit ?? 20, 1), 50);
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      return data ?? [];
    }
    case "get_loans": {
      const { data } = await supabase.from("loans").select("*").order("applied_at", { ascending: false });
      return data ?? [];
    }
    case "get_fixed_deposits": {
      const { data } = await supabase.from("fixed_deposits").select("*").order("created_at", { ascending: false });
      return data ?? [];
    }
    case "get_cards": {
      const { data } = await supabase.from("cards").select("*");
      return data ?? [];
    }
    case "get_autopays": {
      const { data } = await supabase.from("autopay_configs").select("*");
      return data ?? [];
    }
    case "execute_transfer": {
      const { data, error } = await supabase.rpc("execute_transfer", {
        p_from_account: args.from_account_id,
        p_to_account_number: args.to_account_number,
        p_to_ifsc: args.to_ifsc,
        p_amount_paise: args.amount_paise,
        p_description: args.description ?? "Support agent transfer",
        p_idempotency_key: `support:${ticketId}:${Date.now()}`,
      });
      if (error) return { error: error.message };
      return data;
    }
    case "unblock_card": {
      const { data, error } = await supabase.rpc("unblock_card", {
        p_card: args.card_id,
        p_otp: args.otp,
        p_new_pin: args.new_pin,
      });
      if (error) return { error: error.message };
      return data;
    }
    case "classify_ticket": {
      await supabase
        .from("support_tickets")
        .update({ classification: args.classification })
        .eq("id", ticketId);
      return { ok: true };
    }
    default:
      return { error: `unknown tool: ${name}` };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE);

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "unauthenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const { ticket_id, user_message } = await req.json();
    if (!ticket_id || !user_message) {
      return new Response(JSON.stringify({ error: "ticket_id and user_message required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify ticket ownership
    const { data: ticket } = await userClient
      .from("support_tickets")
      .select("*")
      .eq("id", ticket_id)
      .single();
    if (!ticket) {
      return new Response(JSON.stringify({ error: "ticket_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load history
    const { data: history } = await userClient
      .from("ticket_messages")
      .select("sender, content")
      .eq("ticket_id", ticket_id)
      .order("created_at", { ascending: true })
      .limit(50);

    const messages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(history ?? []).map((m: any) => ({
        role: m.sender === "user" ? "user" : m.sender === "staff" ? "user" : "assistant",
        content: m.sender === "staff" ? `[Staff] ${m.content}` : m.content,
      })),
      { role: "user", content: user_message },
    ];

    let finalText = "";
    for (let iter = 0; iter < 5; iter++) {
      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages,
          tools: TOOLS,
        }),
      });

      if (aiResp.status === 429) {
        finalText = "I'm getting a lot of requests right now. Please try again in a moment.";
        break;
      }
      if (aiResp.status === 402) {
        finalText = "AI credits exhausted. Please contact your administrator.";
        break;
      }
      if (!aiResp.ok) {
        const t = await aiResp.text();
        console.error("AI gateway error:", aiResp.status, t);
        finalText = "I had trouble reaching the assistant. Please try again.";
        break;
      }

      const ai = await aiResp.json();
      const choice = ai.choices?.[0];
      const msg = choice?.message;
      if (!msg) break;

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        messages.push(msg);
        for (const tc of msg.tool_calls) {
          let args: any = {};
          try {
            args = JSON.parse(tc.function.arguments || "{}");
          } catch {}
          const result = await runTool(userClient, tc.function.name, args, ticket_id);
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          });
        }
        continue;
      }

      finalText = msg.content ?? "";
      break;
    }

    if (!finalText) finalText = "I wasn't able to produce a response. A human will follow up.";

    // Detect escalation
    let newStatus: string | null = null;
    if (finalText.includes("[ESCALATE]")) {
      finalText = finalText.replace(/\[ESCALATE\]/g, "").trim();
      newStatus = "escalated";
    }

    // Persist user message + AI reply (service role bypasses RLS for ai/staff senders)
    await adminClient.from("ticket_messages").insert([
      { ticket_id, sender: "user", content: user_message },
      { ticket_id, sender: "ai", content: finalText },
    ]);

    if (newStatus) {
      await adminClient.from("support_tickets").update({ status: newStatus }).eq("id", ticket_id);
    }

    return new Response(JSON.stringify({ reply: finalText, escalated: !!newStatus }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("support-agent error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
