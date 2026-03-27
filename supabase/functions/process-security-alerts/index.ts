import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get unprocessed high/critical alerts without AI summary
    const { data: alerts, error: alertError } = await supabase
      .from("security_alerts")
      .select("*")
      .is("summary", null)
      .in("severity", ["high", "critical"])
      .order("created_at", { ascending: false })
      .limit(10);

    if (alertError) throw alertError;
    if (!alerts || alerts.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve user names
    const userIds = new Set<string>();
    alerts.forEach((a: any) => {
      if (a.actor_user_id) userIds.add(a.actor_user_id);
      if (a.target_user_id) userIds.add(a.target_user_id);
    });
    
    let nameMap: Record<string, string> = {};
    if (userIds.size > 0) {
      const { data: names } = await supabase.rpc("get_user_names", {
        _user_ids: Array.from(userIds),
      });
      nameMap = Object.fromEntries(
        (names || []).map((n: any) => [n.id, n.full_name])
      );
    }

    let processed = 0;

    for (const alert of alerts) {
      const actorName = nameMap[alert.actor_user_id] || "Desconhecido";
      const targetName = alert.target_user_id
        ? nameMap[alert.target_user_id] || "Desconhecido"
        : null;
      const ctx = alert.context_json || {};

      // Build context for AI
      const contextText = [
        `Evento: ${alert.event_type}`,
        `Título: ${alert.title}`,
        `Severidade: ${alert.severity}`,
        `Prioridade: ${alert.priority}`,
        `Usuário executor: ${actorName} (${ctx.user_role || "?"})`,
        targetName ? `Usuário afetado: ${targetName}` : null,
        ctx.reason ? `Motivo: ${ctx.reason}` : null,
        ctx.action_summary ? `Resumo da ação: ${ctx.action_summary}` : null,
        alert.business_date ? `Data operacional: ${alert.business_date}` : null,
        alert.session_id ? `Sessão de caixa: ${alert.session_id}` : null,
        ctx.old_data ? `Dados anteriores: ${JSON.stringify(ctx.old_data).substring(0, 500)}` : null,
        ctx.new_data ? `Dados novos: ${JSON.stringify(ctx.new_data).substring(0, 500)}` : null,
      ].filter(Boolean).join("\n");

      let summary = "";
      let recommendedAction = "";

      // Use AI for summary if available
      if (lovableApiKey) {
        try {
          const aiResponse = await fetch(
            "https://api.lovable.dev/v1/chat/completions",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${lovableApiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash-lite",
                messages: [
                  {
                    role: "system",
                    content: `Você é um analista de segurança de um sistema de caixa registradora (POS). Analise o evento de segurança abaixo e gere:
1. Um resumo claro e objetivo (2-3 frases) do que aconteceu e por que é relevante.
2. Uma recomendação prática para o administrador (1-2 frases).

Responda em JSON com as chaves "summary" e "recommended_action". Seja direto, sem formalidades. Use português brasileiro.`,
                  },
                  {
                    role: "user",
                    content: contextText,
                  },
                ],
                response_format: { type: "json_object" },
                max_tokens: 300,
              }),
            }
          );

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            const content = aiData.choices?.[0]?.message?.content;
            if (content) {
              try {
                const parsed = JSON.parse(content);
                summary = parsed.summary || "";
                recommendedAction = parsed.recommended_action || "";
              } catch {
                summary = content;
              }
            }
          }
        } catch (e) {
          console.error("AI enrichment failed:", e);
        }
      }

      // Fallback if AI didn't work
      if (!summary) {
        summary = `${alert.title}. Executado por ${actorName}${targetName ? ` afetando ${targetName}` : ""}.${alert.business_date ? ` Data: ${alert.business_date}.` : ""}`;
        recommendedAction = alert.severity === "critical"
          ? "Revise imediatamente na Central de Segurança."
          : "Verifique os detalhes na Central de Segurança.";
      }

      // Update alert with AI summary
      await supabase
        .from("security_alerts")
        .update({
          summary,
          recommended_action: recommendedAction,
        })
        .eq("id", alert.id);

      processed++;
    }

    return new Response(
      JSON.stringify({ processed, total: alerts.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing alerts:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
