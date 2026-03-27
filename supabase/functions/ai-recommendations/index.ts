import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { business_date, user_id } = await req.json();
    if (!business_date || !user_id) {
      return new Response(JSON.stringify({ error: "business_date and user_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get day of week for the target date
    const targetDate = new Date(business_date + "T12:00:00Z");
    const dayOfWeek = targetDate.getDay(); // 0=Sun, 1=Mon...
    const dayNames = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
    const dayName = dayNames[dayOfWeek];

    // Fetch last 30 days of operation insights
    const thirtyDaysAgo = new Date(targetDate);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { data: insights } = await supabase
      .from("daily_operation_insights")
      .select("*")
      .gte("business_date", thirtyDaysAgo.toISOString().split("T")[0])
      .lte("business_date", business_date)
      .order("business_date", { ascending: false });

    // Fetch last 30 days of sales with items for category breakdown
    const { data: sales } = await supabase
      .from("sales")
      .select("id, business_date, total_amount, is_deleted")
      .gte("business_date", thirtyDaysAgo.toISOString().split("T")[0])
      .lte("business_date", business_date)
      .eq("is_deleted", false);

    const saleIds = (sales || []).map((s: any) => s.id);
    let saleItems: any[] = [];
    if (saleIds.length > 0) {
      const { data } = await supabase
        .from("sale_items")
        .select("sale_id, quantity, product_id")
        .in("sale_id", saleIds.slice(0, 500));
      saleItems = data || [];
    }

    // Get product categories
    const productIds = [...new Set(saleItems.map((i: any) => i.product_id).filter(Boolean))];
    let products: any[] = [];
    if (productIds.length > 0) {
      const { data } = await supabase
        .from("products")
        .select("id, category, name")
        .in("id", productIds.slice(0, 200));
      products = data || [];
    }

    const productCategoryMap: Record<string, string> = {};
    products.forEach((p: any) => { productCategoryMap[p.id] = p.category; });

    // Build sales by date and category
    const saleByDate: Record<string, Record<string, number>> = {};
    const saleIdToDate: Record<string, string> = {};
    (sales || []).forEach((s: any) => { saleIdToDate[s.id] = s.business_date; });

    saleItems.forEach((item: any) => {
      const saleDate = saleIdToDate[item.sale_id];
      if (!saleDate) return;
      const cat = normalizeCat(productCategoryMap[item.product_id] || "outros");
      if (!saleByDate[saleDate]) saleByDate[saleDate] = {};
      saleByDate[saleDate][cat] = (saleByDate[saleDate][cat] || 0) + (item.quantity || 0);
    });

    // Summarize insights by category
    const categories = ["salgados", "doces", "bolos", "agua", "refrigerante"];
    const categorySummary: Record<string, any> = {};

    categories.forEach(cat => {
      const catInsights = (insights || []).filter((i: any) => i.category === cat);
      const sameDayInsights = catInsights.filter((i: any) => {
        const d = new Date(i.business_date + "T12:00:00Z");
        return d.getDay() === dayOfWeek;
      });

      const avgSold = catInsights.length > 0
        ? catInsights.reduce((s: number, i: any) => s + (i.sold_quantity || 0), 0) / catInsights.length
        : 0;
      const avgLeftover = catInsights.length > 0
        ? catInsights.reduce((s: number, i: any) => s + (i.leftover_quantity || 0), 0) / catInsights.length
        : 0;
      const avgExposed = catInsights.length > 0
        ? catInsights.reduce((s: number, i: any) => s + (i.exposed_quantity || 0), 0) / catInsights.length
        : 0;
      const shortageCount = catInsights.filter((i: any) => i.had_shortage).length;
      const restockCount = catInsights.filter((i: any) => i.had_restock).length;

      const sameDayAvgSold = sameDayInsights.length > 0
        ? sameDayInsights.reduce((s: number, i: any) => s + (i.sold_quantity || 0), 0) / sameDayInsights.length
        : avgSold;

      // Sales-based data for this category across dates
      const salesQuantities = Object.values(saleByDate)
        .map((dayData: any) => dayData[cat] || 0)
        .filter((v: number) => v > 0);
      const avgSalesQty = salesQuantities.length > 0
        ? salesQuantities.reduce((a: number, b: number) => a + b, 0) / salesQuantities.length
        : 0;

      categorySummary[cat] = {
        avg_sold: Math.round(avgSold * 10) / 10,
        avg_leftover: Math.round(avgLeftover * 10) / 10,
        avg_exposed: Math.round(avgExposed * 10) / 10,
        shortage_count: shortageCount,
        restock_count: restockCount,
        total_records: catInsights.length,
        same_day_avg_sold: Math.round(sameDayAvgSold * 10) / 10,
        same_day_records: sameDayInsights.length,
        avg_sales_quantity: Math.round(avgSalesQty * 10) / 10,
      };
    });

    // Build prompt for AI
    const prompt = `Você é um assistente inteligente de operações de cantina escolar (Cantina da FER).

Hoje é ${dayName}, data ${business_date}.

Com base no histórico dos últimos 30 dias, gere uma recomendação de quantidade de exposição para cada categoria de produto.

DADOS HISTÓRICOS POR CATEGORIA (últimos 30 dias):
${JSON.stringify(categorySummary, null, 2)}

REGRAS:
- Se houve muita sobra recorrente, reduza a sugestão.
- Se houve falta de produto (shortage), aumente a sugestão.
- Se houve reposição frequente, a demanda real foi maior que a exposição inicial.
- Considere o dia da semana: use same_day_avg_sold quando disponível.
- Se não há dados históricos suficientes, sugira um valor conservador.
- Arredonde para números inteiros.
- Retorne APENAS um JSON válido sem markdown, no formato exato abaixo.

FORMATO DE RESPOSTA (JSON puro):
{
  "recommendations": [
    {
      "category": "salgados",
      "suggested_quantity": 25,
      "confidence": "alta",
      "reasoning": "Média de 23 vendidos em segundas, com baixa sobra."
    }
  ],
  "general_insight": "Resumo geral curto do dia."
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
          { role: "system", content: "Você é um analista operacional de cantina. Responda APENAS com JSON válido, sem markdown." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos nas configurações." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ error: "Erro ao consultar IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await aiResponse.json();
    const content = aiResult.choices?.[0]?.message?.content || "";

    // Parse JSON from response (handle potential markdown wrapping)
    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { recommendations: [], general_insight: "Sem dados suficientes." };
    } catch {
      parsed = { recommendations: [], general_insight: "Não foi possível gerar recomendações." };
    }

    return new Response(JSON.stringify({
      ...parsed,
      historical_summary: categorySummary,
      day_of_week: dayName,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("recommendation error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function normalizeCat(cat: string): string {
  const lower = cat.toLowerCase();
  if (lower.includes("salgado")) return "salgados";
  if (lower.includes("doce")) return "doces";
  if (lower.includes("bolo")) return "bolos";
  if (lower.includes("agua") || lower.includes("água")) return "agua";
  if (lower.includes("refrigerante")) return "refrigerante";
  return lower;
}
