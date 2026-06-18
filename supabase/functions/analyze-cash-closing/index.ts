// Edge Function: analyze-cash-closing
// Analisa o fechamento de caixa via Lovable AI e devolve um parecer
// de conferência (causas possíveis da diferença, pontos a verificar,
// pagamentos não-dinheiro que devem ser ignorados no caixa físico).
// Read-only: não altera dados.

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

interface Payload {
  businessDate: string;
  operatorName?: string;
  openingBalance: number;
  cashIn: number;
  cashOut: number;
  expectedCash: number;
  countedCash: number | null;
  difference: number | null;
  status: 'ok' | 'sobra' | 'falta' | null;
  salesByMethod: Record<string, number>;
  incomeByMethod: Record<string, number>;
  expenseByMethod: Record<string, number>;
  fiadoPaymentsByMethod?: Record<string, number>;
  cancelledTotal?: number;
  sangriasTotal?: number;
  despesasTotal?: number;
  cashSalesTotal?: number;
  cashIncomeTotal?: number;
  cashExpenseTotal?: number;
}

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function buildPrompt(p: Payload): string {
  const lines: string[] = [];
  lines.push(`Você é um auditor contábil de caixa. Analise os dados abaixo e produza um parecer objetivo de conferência em português, em até 6 bullets curtos.`);
  lines.push('');
  lines.push('REGRA DE OURO (não pode ser violada):');
  lines.push('- Saldo esperado em DINHEIRO FÍSICO = saldo inicial + entradas em dinheiro − saídas em dinheiro.');
  lines.push('- PIX, cartão de crédito, cartão de débito, transferência e fiado em aberto NÃO entram no dinheiro físico.');
  lines.push('- Pagamentos de SPR/Fiado em dinheiro entram no caixa físico. Em PIX/cartão, NÃO entram.');
  lines.push('');
  lines.push(`Data: ${p.businessDate} | Operador: ${p.operatorName || '—'}`);
  lines.push('');
  lines.push('CAIXA FÍSICO (DINHEIRO):');
  lines.push(`- Saldo inicial: ${fmt(p.openingBalance)}`);
  lines.push(`- Entradas em dinheiro: ${fmt(p.cashIn)}`);
  lines.push(`- Saídas em dinheiro: ${fmt(p.cashOut)}`);
  lines.push(`- Saldo esperado: ${fmt(p.expectedCash)}`);
  if (p.countedCash != null) {
    lines.push(`- Valor contado: ${fmt(p.countedCash)}`);
    lines.push(`- Diferença: ${fmt(p.difference || 0)} (${p.status})`);
  } else {
    lines.push('- Valor contado: ainda não informado');
  }
  lines.push('');
  lines.push('MOVIMENTO FINANCEIRO POR FORMA DE PAGAMENTO:');
  lines.push(`- Vendas: ${JSON.stringify(p.salesByMethod)}`);
  lines.push(`- Entradas (cash_entries income): ${JSON.stringify(p.incomeByMethod)}`);
  lines.push(`- Saídas (cash_entries expense): ${JSON.stringify(p.expenseByMethod)}`);
  if (p.fiadoPaymentsByMethod) {
    lines.push(`- Pagamentos de Fiado: ${JSON.stringify(p.fiadoPaymentsByMethod)}`);
  }
  if (p.cancelledTotal) lines.push(`- Cancelados/excluídos: ${fmt(p.cancelledTotal)}`);
  lines.push('');
  lines.push('Tarefa:');
  lines.push('1. Se houver diferença, aponte as causas mais prováveis com base nos dados.');
  lines.push('2. Liste pagamentos PIX/cartão que poderiam ter sido contados como dinheiro por engano.');
  lines.push('3. Cite sangrias/despesas em dinheiro que merecem conferência de comprovante.');
  lines.push('4. Sugira ações objetivas de conferência (não altere dados).');
  lines.push('5. Se o caixa estiver conferido sem diferença, confirme em uma frase curta.');
  lines.push('');
  lines.push('Não invente valores. Responda em português, com bullets curtos e tom técnico.');
  return lines.join('\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'LOVABLE_API_KEY ausente' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload = (await req.json()) as Payload;
    if (!payload || typeof payload.expectedCash !== 'number') {
      return new Response(
        JSON.stringify({ error: 'Payload inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const prompt = buildPrompt(payload);

    const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Você é um auditor contábil objetivo, em português.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (aiResp.status === 429) {
      return new Response(
        JSON.stringify({ error: 'Limite de requisições da IA. Tente novamente em instantes.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (aiResp.status === 402) {
      return new Response(
        JSON.stringify({ error: 'Créditos de IA esgotados. Adicione créditos no workspace.' }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      return new Response(
        JSON.stringify({ error: 'Falha na IA', detail: t }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await aiResp.json();
    const analysis = data?.choices?.[0]?.message?.content || '';

    return new Response(
      JSON.stringify({ analysis }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: 'Erro inesperado', detail: String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
