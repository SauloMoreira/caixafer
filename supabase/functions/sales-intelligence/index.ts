import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { period_days = 90, category_filter, product_filter, role } = await req.json();
    const isCoordinator = role === 'cash_coordinator';

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period_days);
    const startISO = startDate.toISOString().split("T")[0];
    const endISO = endDate.toISOString().split("T")[0];

    // Previous period for comparison
    const prevStart = new Date(startDate);
    prevStart.setDate(prevStart.getDate() - period_days);
    const prevStartISO = prevStart.toISOString().split("T")[0];

    // Fetch all sales in current period
    const { data: sales } = await supabase
      .from("sales")
      .select("id, business_date, total_amount, payment_method, is_deleted")
      .gte("business_date", startISO)
      .lte("business_date", endISO)
      .eq("is_deleted", false);

    // Fetch previous period sales for comparison
    const { data: prevSales } = await supabase
      .from("sales")
      .select("id, business_date, total_amount")
      .gte("business_date", prevStartISO)
      .lt("business_date", startISO)
      .eq("is_deleted", false);

    // Fetch sale items
    const saleIds = (sales || []).map((s: any) => s.id);
    let saleItems: any[] = [];
    if (saleIds.length > 0) {
      // Batch fetch in chunks of 500
      for (let i = 0; i < saleIds.length; i += 500) {
        const chunk = saleIds.slice(i, i + 500);
        const { data } = await supabase
          .from("sale_items")
          .select("sale_id, quantity, unit_price, line_total, product_id, manual_item_name")
          .in("sale_id", chunk);
        if (data) saleItems.push(...data);
      }
    }

    // Fetch all products
    const { data: products } = await supabase
      .from("products")
      .select("id, name, category, unit_price, is_active");

    const productMap: Record<string, any> = {};
    (products || []).forEach((p: any) => { productMap[p.id] = p; });

    // Build sale date lookup
    const saleIdToDate: Record<string, string> = {};
    (sales || []).forEach((s: any) => { saleIdToDate[s.id] = s.business_date; });

    // ========== ANALYTICS ==========

    // Product analytics
    const productStats: Record<string, { name: string; category: string; qty: number; revenue: number; days: Set<string> }> = {};
    saleItems.forEach((item: any) => {
      const pid = item.product_id || `manual_${item.manual_item_name}`;
      const product = productMap[item.product_id];
      const name = product?.name || item.manual_item_name || "Desconhecido";
      const cat = product?.category || "Outros";
      if (!productStats[pid]) productStats[pid] = { name, category: cat, qty: 0, revenue: 0, days: new Set() };
      productStats[pid].qty += item.quantity || 0;
      productStats[pid].revenue += Number(item.line_total) || 0;
      const saleDate = saleIdToDate[item.sale_id];
      if (saleDate) productStats[pid].days.add(saleDate);
    });

    const productList = Object.entries(productStats).map(([id, s]) => ({
      id, name: s.name, category: s.category,
      quantity_sold: s.qty,
      total_revenue: Math.round(s.revenue * 100) / 100,
      active_days: s.days.size,
      avg_daily_qty: s.days.size > 0 ? Math.round((s.qty / s.days.size) * 10) / 10 : 0,
    }));

    const topByQuantity = [...productList].sort((a, b) => b.quantity_sold - a.quantity_sold).slice(0, 10);
    const bottomByQuantity = [...productList].filter(p => p.quantity_sold > 0).sort((a, b) => a.quantity_sold - b.quantity_sold).slice(0, 10);
    const topByRevenue = [...productList].sort((a, b) => b.total_revenue - a.total_revenue).slice(0, 10);
    const lowTurnover = [...productList].sort((a, b) => a.avg_daily_qty - b.avg_daily_qty).slice(0, 10);

    // Category analytics
    const categoryStats: Record<string, { qty: number; revenue: number }> = {};
    productList.forEach(p => {
      if (!categoryStats[p.category]) categoryStats[p.category] = { qty: 0, revenue: 0 };
      categoryStats[p.category].qty += p.quantity_sold;
      categoryStats[p.category].revenue += p.total_revenue;
    });
    const categoryList = Object.entries(categoryStats)
      .map(([cat, s]) => ({ category: cat, quantity: s.qty, revenue: Math.round(s.revenue * 100) / 100 }))
      .sort((a, b) => b.revenue - a.revenue);

    // Day of week analysis
    const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    const dayStats: Record<number, { revenue: number; count: number; sales: number }> = {};
    (sales || []).forEach((s: any) => {
      const d = new Date(s.business_date + "T12:00:00Z").getDay();
      if (!dayStats[d]) dayStats[d] = { revenue: 0, count: 0, sales: 0 };
      dayStats[d].revenue += Number(s.total_amount);
      dayStats[d].sales += 1;
    });
    // Count unique dates per day of week
    const datesByDay: Record<number, Set<string>> = {};
    (sales || []).forEach((s: any) => {
      const d = new Date(s.business_date + "T12:00:00Z").getDay();
      if (!datesByDay[d]) datesByDay[d] = new Set();
      datesByDay[d].add(s.business_date);
    });
    Object.entries(datesByDay).forEach(([d, dates]) => {
      if (dayStats[Number(d)]) dayStats[Number(d)].count = dates.size;
    });

    const dayOfWeekData = Object.entries(dayStats)
      .map(([d, s]) => ({
        day: dayNames[Number(d)],
        day_index: Number(d),
        total_revenue: Math.round(s.revenue * 100) / 100,
        avg_revenue: s.count > 0 ? Math.round((s.revenue / s.count) * 100) / 100 : 0,
        total_sales: s.sales,
        avg_sales: s.count > 0 ? Math.round((s.sales / s.count) * 10) / 10 : 0,
      }))
      .sort((a, b) => b.avg_revenue - a.avg_revenue);

    const bestDay = dayOfWeekData[0];

    // Month period analysis (1-10, 11-20, 21-31)
    const periodStats: Record<string, { revenue: number; days: Set<string> }> = {
      "Início (1-10)": { revenue: 0, days: new Set() },
      "Meio (11-20)": { revenue: 0, days: new Set() },
      "Fim (21-31)": { revenue: 0, days: new Set() },
    };
    (sales || []).forEach((s: any) => {
      const day = new Date(s.business_date + "T12:00:00Z").getDate();
      const period = day <= 10 ? "Início (1-10)" : day <= 20 ? "Meio (11-20)" : "Fim (21-31)";
      periodStats[period].revenue += Number(s.total_amount);
      periodStats[period].days.add(s.business_date);
    });
    const periodData = Object.entries(periodStats).map(([period, s]) => ({
      period,
      total_revenue: Math.round(s.revenue * 100) / 100,
      avg_daily_revenue: s.days.size > 0 ? Math.round((s.revenue / s.days.size) * 100) / 100 : 0,
      days_count: s.days.size,
    })).sort((a, b) => b.avg_daily_revenue - a.avg_daily_revenue);

    const bestPeriod = periodData[0];

    // Monthly analysis
    const monthStats: Record<string, { revenue: number; sales: number }> = {};
    (sales || []).forEach((s: any) => {
      const m = s.business_date.substring(0, 7); // YYYY-MM
      if (!monthStats[m]) monthStats[m] = { revenue: 0, sales: 0 };
      monthStats[m].revenue += Number(s.total_amount);
      monthStats[m].sales += 1;
    });
    const monthData = Object.entries(monthStats)
      .map(([month, s]) => ({ month, revenue: Math.round(s.revenue * 100) / 100, sales: s.sales }))
      .sort((a, b) => b.revenue - a.revenue);

    const bestMonth = monthData[0];

    // Overall KPIs
    const totalRevenue = (sales || []).reduce((s: number, r: any) => s + Number(r.total_amount), 0);
    const totalSalesCount = (sales || []).length;
    const uniqueDates = new Set((sales || []).map((s: any) => s.business_date));
    const activeDays = uniqueDates.size;
    const avgTicket = totalSalesCount > 0 ? totalRevenue / totalSalesCount : 0;
    const avgDailyRevenue = activeDays > 0 ? totalRevenue / activeDays : 0;

    // Previous period comparison
    const prevTotalRevenue = (prevSales || []).reduce((s: number, r: any) => s + Number(r.total_amount), 0);
    const prevTotalSales = (prevSales || []).length;
    const revenueChange = prevTotalRevenue > 0 ? ((totalRevenue - prevTotalRevenue) / prevTotalRevenue) * 100 : 0;
    const salesChange = prevTotalSales > 0 ? ((totalSalesCount - prevTotalSales) / prevTotalSales) * 100 : 0;

    // High volume low revenue products (sell a lot but low revenue)
    const highVolLowRev = productList
      .filter(p => p.quantity_sold > 0 && p.total_revenue > 0)
      .map(p => ({ ...p, revenue_per_unit: p.total_revenue / p.quantity_sold }))
      .sort((a, b) => a.revenue_per_unit - b.revenue_per_unit)
      .slice(0, 5);

    // Low volume high revenue products
    const lowVolHighRev = productList
      .filter(p => p.quantity_sold > 0 && p.total_revenue > 0)
      .map(p => ({ ...p, revenue_per_unit: p.total_revenue / p.quantity_sold }))
      .sort((a, b) => b.revenue_per_unit - a.revenue_per_unit)
      .slice(0, 5);

    // Build data summary for AI
    const dataSummary = {
      period: `${startISO} a ${endISO}`,
      period_days,
      total_revenue: Math.round(totalRevenue * 100) / 100,
      total_sales: totalSalesCount,
      active_days: activeDays,
      avg_ticket: Math.round(avgTicket * 100) / 100,
      avg_daily_revenue: Math.round(avgDailyRevenue * 100) / 100,
      revenue_change_pct: Math.round(revenueChange * 10) / 10,
      sales_change_pct: Math.round(salesChange * 10) / 10,
      best_day_of_week: bestDay,
      best_month_period: bestPeriod,
      best_month: bestMonth,
      top_5_by_quantity: topByQuantity.slice(0, 5).map(p => ({ name: p.name, qty: p.quantity_sold, revenue: p.total_revenue })),
      bottom_5_by_quantity: bottomByQuantity.slice(0, 5).map(p => ({ name: p.name, qty: p.quantity_sold, revenue: p.total_revenue })),
      top_5_by_revenue: topByRevenue.slice(0, 5).map(p => ({ name: p.name, qty: p.quantity_sold, revenue: p.total_revenue })),
      low_turnover: lowTurnover.slice(0, 5).map(p => ({ name: p.name, avg_daily: p.avg_daily_qty, revenue: p.total_revenue })),
      high_vol_low_rev: highVolLowRev.map(p => ({ name: p.name, qty: p.quantity_sold, revenue: p.total_revenue, per_unit: Math.round(p.revenue_per_unit * 100) / 100 })),
      categories: categoryList,
      day_of_week_ranking: dayOfWeekData,
      month_period_ranking: periodData,
    };

    // AI prompt - different for coordinator (operational only) vs admin (full financial)
    const prompt = isCoordinator
      ? `Você é um analista operacional da Cantina da FER (cantina escolar).

Analise os dados abaixo e gere insights e sugestões EXCLUSIVAMENTE OPERACIONAIS. 
NUNCA mencione faturamento, receita, ticket médio em R$, valores monetários ou desempenho financeiro.
Foque em: quantidade vendida, giro de produtos, estoque, reposição, exposição, ruptura e consumo.

DADOS DO PERÍODO (${period_days} dias):
${JSON.stringify({
  period: dataSummary.period,
  period_days: dataSummary.period_days,
  total_sales: dataSummary.total_sales,
  active_days: dataSummary.active_days,
  sales_change_pct: dataSummary.sales_change_pct,
  best_day_of_week: dataSummary.best_day_of_week ? { day: dataSummary.best_day_of_week.day, avg_sales: dataSummary.best_day_of_week.avg_sales } : null,
  top_5_by_quantity: dataSummary.top_5_by_quantity.map((p: any) => ({ name: p.name, qty: p.qty })),
  bottom_5_by_quantity: dataSummary.bottom_5_by_quantity.map((p: any) => ({ name: p.name, qty: p.qty })),
  low_turnover: dataSummary.low_turnover.map((p: any) => ({ name: p.name, avg_daily: p.avg_daily })),
  categories: dataSummary.categories.map((c: any) => ({ category: c.category, quantity: c.quantity })),
}, null, 2)}

REGRAS:
- PROIBIDO mencionar faturamento, receita, R$, ticket médio, valores monetários.
- Gere sugestões baseadas em quantidade, giro, consumo, estoque e operação.
- Cada sugestão deve ter: insight, oportunidade, sugestão prática e prioridade (alta/media/baixa).
- Use linguagem operacional: "maior saída", "menor giro", "reposição", "exposição".
- Máximo 8 sugestões.

FORMATO DE RESPOSTA (JSON puro, sem markdown):
{
  "summary": "Resumo operacional em 2-3 frases, sem valores financeiros.",
  "suggestions": [
    {
      "insight": "O que os dados operacionais mostram",
      "opportunity": "Qual oportunidade operacional isso representa",
      "action": "O que fazer na prática",
      "priority": "alta",
      "basis": "Baseado em quê (ex: volume de vendas dos últimos 90 dias)"
    }
  ],
  "opportunities": [
    {
      "title": "Título curto da oportunidade operacional",
      "description": "Descrição clara sem valores financeiros",
      "impact": "alto"
    }
  ]
}`
      : `Você é um analista inteligente de vendas da Cantina da FER (cantina escolar).

Analise os dados abaixo e gere insights e sugestões práticas para o administrador melhorar vendas e faturamento.

DADOS DO PERÍODO (${period_days} dias):
${JSON.stringify(dataSummary, null, 2)}

REGRAS:
- Gere sugestões BASEADAS nos dados reais. Não invente padrões.
- Se o histórico for curto (< 14 dias), avise que as conclusões são preliminares.
- Cada sugestão deve ter: insight, oportunidade, sugestão prática e prioridade (alta/media/baixa).
- Use linguagem clara, amigável e direta.
- Foque em ações que o administrador pode executar.
- Máximo 8 sugestões, priorizadas por impacto estimado.
- Identifique tendências de alta ou queda.
- Identifique produtos que vendem muito mas faturam pouco e vice-versa.
- Identifique oportunidades por dia da semana e período do mês.

FORMATO DE RESPOSTA (JSON puro, sem markdown):
{
  "summary": "Resumo analítico geral em 2-3 frases.",
  "suggestions": [
    {
      "insight": "O que os dados mostram",
      "opportunity": "Qual oportunidade isso representa",
      "action": "O que fazer na prática",
      "priority": "alta",
      "basis": "Baseado em quê (ex: últimos 90 dias de vendas)"
    }
  ],
  "opportunities": [
    {
      "title": "Título curto da oportunidade",
      "description": "Descrição clara",
      "impact": "alto"
    }
  ],
  "trends": {
    "revenue_trend": "alta|estavel|queda",
    "revenue_trend_description": "Descrição da tendência"
  }
}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um analista de vendas de cantina. Responda APENAS com JSON válido, sem markdown." },
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
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
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

    let aiParsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      aiParsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { summary: "Sem dados suficientes.", suggestions: [], opportunities: [] };
    } catch {
      aiParsed = { summary: "Não foi possível gerar análise.", suggestions: [], opportunities: [] };
    }

    return new Response(JSON.stringify({
      ai: aiParsed,
      data: {
        kpis: {
          total_revenue: Math.round(totalRevenue * 100) / 100,
          total_sales: totalSalesCount,
          active_days: activeDays,
          avg_ticket: Math.round(avgTicket * 100) / 100,
          avg_daily_revenue: Math.round(avgDailyRevenue * 100) / 100,
          revenue_change_pct: Math.round(revenueChange * 10) / 10,
          sales_change_pct: Math.round(salesChange * 10) / 10,
        },
        best_day: bestDay,
        best_period: bestPeriod,
        best_month: bestMonth,
        top_by_quantity: topByQuantity,
        bottom_by_quantity: bottomByQuantity,
        top_by_revenue: topByRevenue,
        low_turnover: lowTurnover,
        categories: categoryList,
        day_of_week: dayOfWeekData,
        month_periods: periodData,
        monthly: monthData,
        champion_quantity: topByQuantity[0] || null,
        champion_revenue: topByRevenue[0] || null,
        worst_turnover: lowTurnover[0] || null,
      },
      period: { start: startISO, end: endISO, days: period_days },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("sales-intelligence error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
