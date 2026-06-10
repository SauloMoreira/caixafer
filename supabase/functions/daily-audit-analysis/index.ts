import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { date, summary, movements_sample } = await req.json();
    if (!date || !summary) {
      return new Response(JSON.stringify({ error: "date e summary obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurado");

    const prompt = `Você é um auditor operacional. Analise o movimento do dia ${date} de uma operação de caixa (PDV, SPR, Fiado, estoque) e gere um relatório curto e objetivo apontando riscos.

RESUMO DO DIA:
${JSON.stringify(summary, null, 2)}

AMOSTRA DE MOVIMENTOS (até 200):
${JSON.stringify(movements_sample ?? [], null, 2)}

REGRAS:
- Você NÃO altera dados. Apenas analisa e sugere conferências.
- Aponte divergências entre PDV, SPR, Fiado, pagamentos e estoque.
- Destaque cancelamentos, estornos, ajustes manuais relevantes, vendas excluídas.
- Destaque usuários com muitas alterações ou lançamentos manuais.
- Destaque saídas de estoque sem venda correspondente, se evidente.
- Seja conciso (frases curtas).
- Retorne APENAS JSON válido, sem markdown, no formato exato abaixo.

FORMATO:
{
  "resumo": "Resumo executivo em 1-3 frases.",
  "pontos_de_atencao": ["..."],
  "divergencias": ["..."],
  "sugestoes": ["..."]
}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "Você é um auditor operacional. Responda APENAS com JSON válido, sem markdown, sem comentários.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos nas configurações." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const txt = await aiResponse.text();
      console.error("AI error", aiResponse.status, txt);
      return new Response(JSON.stringify({ error: "Erro ao consultar IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await aiResponse.json();
    const content = result.choices?.[0]?.message?.content ?? "";
    let parsed: any;
    try {
      const m = content.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : null;
    } catch {
      parsed = null;
    }
    if (!parsed) {
      parsed = {
        resumo: "Não foi possível interpretar a resposta da IA.",
        pontos_de_atencao: [],
        divergencias: [],
        sugestoes: [],
      };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("daily-audit-analysis error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
