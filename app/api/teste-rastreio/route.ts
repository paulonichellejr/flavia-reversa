/**
 * GET /api/teste-rastreio?tracking=XX000000000BR
 *
 * Endpoint de diagnóstico — consulta o Melhor Envio e devolve
 * a resposta bruta + o resultado da verificação de entrega.
 * Remover antes de ir para produção final.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verificarAdmin } from '@/lib/auth-admin';

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const auth = verificarAdmin(request);
  if (auth) return auth;
  const { searchParams } = new URL(request.url);
  const tracking = searchParams.get('tracking') ?? '';

  if (!tracking) {
    return NextResponse.json({ erro: 'Passe ?tracking=CODIGO_DE_RASTREIO' }, { status: 400 });
  }

  const token = process.env.MELHOR_ENVIO_TOKEN;
  const email = process.env.LOJA_EMAIL || 'contato@lojaflaviaorganiza.com.br';

  if (!token) {
    return NextResponse.json({ erro: 'MELHOR_ENVIO_TOKEN não configurado' }, { status: 500 });
  }

  const meUrl = 'https://melhorenvio.com.br/api/v2';

  try {
    const res = await fetch(
      `${meUrl}/me/orders?q=${encodeURIComponent(tracking)}&per_page=10`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'User-Agent': `Loja Flávia Organiza (${email})`,
        },
      }
    );

    const rawText = await res.text();
    let parsed: unknown = null;
    try { parsed = JSON.parse(rawText); } catch { /* ignora */ }

    // Extrai campos de status de cada order retornada
    const orders: Record<string, unknown>[] =
      Array.isArray((parsed as Record<string, unknown>)?.data)
        ? (parsed as Record<string, unknown>).data as Record<string, unknown>[]
        : Array.isArray(parsed)
          ? parsed as Record<string, unknown>[]
          : [];

    const resumo = orders.map((o) => ({
      id: o.id,
      tracking: o.tracking,
      status: o.status,
      tag: o.tag,
      last_occurrence: o.last_occurrence ?? o.lastOccurrence,
      // inclui todos os campos de nível raiz para diagnóstico
      todos_campos: Object.keys(o),
    }));

    const pedidoME = orders.find(
      (o) => String(o.tracking ?? '').toUpperCase() === tracking.toUpperCase()
    ) ?? (orders.length === 1 ? orders[0] : null);

    const status = String(pedidoME?.status ?? '').toLowerCase().trim();
    const entregue = status === 'delivered' || status.includes('entreg');

    return NextResponse.json({
      tracking_consultado: tracking,
      http_status: res.status,
      total_orders_retornados: orders.length,
      resultado_verificacao: entregue ? '✅ ENTREGUE — devolução PERMITIDA' : '❌ NÃO ENTREGUE — devolução BLOQUEADA',
      status_encontrado: pedidoME?.status ?? null,
      orders_resumo: resumo,
      raw_body_primeiros_1000_chars: rawText.substring(0, 1000),
    });
  } catch (e) {
    return NextResponse.json({ erro: String(e) }, { status: 500 });
  }
}
