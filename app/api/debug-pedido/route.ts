/**
 * GET /api/debug-pedido?numero=16980&cpf=XXX
 *
 * Endpoint de diagnóstico — mostra o JSON bruto do Bling (transporte completo)
 * + várias tentativas de busca no ME para entender como os pedidos estão linkados.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verificarAdmin } from '@/lib/auth-admin';

export const maxDuration = 60;

const BLING_BASE = 'https://www.bling.com.br/Api/v3';
const ME_BASE    = 'https://melhorenvio.com.br/api/v2';

function blingHeaders() {
  return {
    Authorization: `Bearer ${process.env.BLING_API_KEY}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

function meHeaders() {
  const email = process.env.LOJA_EMAIL || 'contato@lojaflaviaorganiza.com.br';
  return {
    Authorization: `Bearer ${process.env.MELHOR_ENVIO_TOKEN}`,
    Accept: 'application/json',
    'User-Agent': `Loja Flávia Organiza (${email})`,
  };
}

async function meBusca(termo: string) {
  const res = await fetch(
    `${ME_BASE}/me/orders?q=${encodeURIComponent(termo)}&per_page=5`,
    { headers: meHeaders() }
  );
  const text = await res.text();
  let parsed: unknown = null;
  try { parsed = JSON.parse(text); } catch { /* noop */ }
  return { status: res.status, body: parsed ?? text.substring(0, 500) };
}

export async function GET(req: NextRequest) {
  const auth = verificarAdmin(req);
  if (auth) return auth;
  const { searchParams } = new URL(req.url);
  const numero = searchParams.get('numero') ?? '';

  if (!numero) {
    return NextResponse.json({ erro: 'Passe ?numero=NUMERO_PEDIDO' }, { status: 400 });
  }

  // ── 1. Busca pedido no Bling ──────────────────────────────────
  const dataInicial = new Date();
  dataInicial.setDate(dataInicial.getDate() - 60);
  const dataInicialStr = dataInicial.toISOString().split('T')[0];

  let blingListItem: Record<string, unknown> | null = null;
  let blingFullOrder: Record<string, unknown> | null = null;

  for (let pagina = 1; pagina <= 5; pagina++) {
    const listRes = await fetch(
      `${BLING_BASE}/pedidos/vendas?limite=100&pagina=${pagina}&dataInicial=${dataInicialStr}`,
      { headers: blingHeaders(), cache: 'no-store' }
    );
    if (!listRes.ok) break;
    const listJson = await listRes.json();
    const pedidos: Record<string, unknown>[] = listJson?.data ?? [];

    const found = pedidos.find(
      (p) =>
        String(p.numeroLoja ?? '').trim() === numero ||
        String(p.numero ?? '').trim() === numero
    );

    if (found) {
      blingListItem = found;
      // Busca completo
      const fullRes = await fetch(`${BLING_BASE}/pedidos/vendas/${found.id}`, {
        headers: blingHeaders(),
        cache: 'no-store',
      });
      if (fullRes.ok) {
        const fullJson = await fullRes.json();
        blingFullOrder = fullJson?.data ?? null;
      }
      break;
    }
    if (pedidos.length < 100) break;
  }

  // ── 2. Extrai campos relevantes do Bling ─────────────────────
  const blingInfo = blingFullOrder
    ? {
        id: blingFullOrder.id,
        numero: blingFullOrder.numero,
        numeroLoja: blingFullOrder.numeroLoja,
        situacao: blingFullOrder.situacao,
        data: blingFullOrder.data,
        // CAMPO CRÍTICO — mostrar tudo dentro de transporte
        transporte_COMPLETO: blingFullOrder.transporte,
        // outros campos de nível raiz (sem itens/contato p/ brevidade)
        todos_campos_raiz: Object.keys(blingFullOrder),
      }
    : null;

  // ── 3. Tenta várias buscas no ME ─────────────────────────────
  const numeroLoja = String(blingFullOrder?.numeroLoja ?? blingListItem?.numeroLoja ?? '');
  const blingId    = String(blingFullOrder?.id ?? blingListItem?.id ?? '');

  const meTentativas: Record<string, unknown> = {};

  // Por número Bling interno (ex: 16980)
  meTentativas[`q=${numero}`] = await meBusca(numero);

  // Por numeroLoja (número Tray, se diferente)
  if (numeroLoja && numeroLoja !== numero) {
    meTentativas[`q=${numeroLoja}_(numeroLoja)`] = await meBusca(numeroLoja);
  }

  // Por ID Bling
  if (blingId && blingId !== numero) {
    meTentativas[`q=${blingId}_(blingId)`] = await meBusca(blingId);
  }

  // Por codigoRastreamento do Bling (se houver em algum sub-campo)
  const transporteObj = blingFullOrder?.transporte as Record<string, unknown> | undefined;
  const codRastreio =
    (transporteObj?.codigoRastreamento as string) ||
    ((transporteObj?.volumes as Record<string, unknown>[])?.[0]?.codigoRastreamento as string) ||
    '';

  if (codRastreio) {
    meTentativas[`q=${codRastreio}_(codigoRastreamento)`] = await meBusca(codRastreio);
  }

  // Lista os 5 pedidos ME mais recentes (para ver a estrutura de campos)
  const meRecentes = await fetch(
    `${ME_BASE}/me/orders?per_page=3&order_by=created_at&sort=desc`,
    { headers: meHeaders() }
  );
  const meRecentesJson = meRecentes.ok ? await meRecentes.json() : { erro: meRecentes.status };

  const meRecentesResumo = Array.isArray((meRecentesJson as Record<string, unknown>)?.data)
    ? ((meRecentesJson as Record<string, unknown>).data as Record<string, unknown>[]).map((o) => ({
        id: o.id,
        tracking: o.tracking,
        status: o.status,
        tag: o.tag,
        note: o.note,
        todos_campos: Object.keys(o),
      }))
    : meRecentesJson;

  return NextResponse.json({
    numero_consultado: numero,
    bling: blingInfo,
    me_tentativas_de_busca: meTentativas,
    me_3_pedidos_recentes_estrutura: meRecentesResumo,
  });
}
