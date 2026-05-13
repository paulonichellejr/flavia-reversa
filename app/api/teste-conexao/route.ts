import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verificarAdmin } from '@/lib/auth-admin';

export async function GET(req: NextRequest) {
  const auth = verificarAdmin(req);
  if (auth) return auth;
  const resultados: Record<string, unknown> = {};

  try {
    // ── Supabase ────────────────────────────────────────────
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error: errTabela } = await supabase.from('logs_reversa').select('count').limit(1);
    resultados.supabase_tabela = errTabela ? `❌ ${errTabela.message}` : '✅ OK';

    const { error: errBucket } = await supabase.storage.from('fotos-reversa').list('', { limit: 1 });
    resultados.supabase_bucket = errBucket ? `❌ ${errBucket.message}` : '✅ OK';

    // ── Bling: testa sub-recursos de /logisticas/165638 ─────
    const ID_LOGISTICA = '165638';
    const ID_PEDIDO    = '25504173696'; // pedido 13103

    const candidatos: Record<string, string> = {
      'logisticas_reversas_sub':   `/logisticas/${ID_LOGISTICA}/reversas`,
      'logisticas_reversa_sub':    `/logisticas/${ID_LOGISTICA}/reversa`,
      'pedido_reversa':            `/pedidos/vendas/${ID_PEDIDO}/reversa`,
      'pedido_reversas':           `/pedidos/vendas/${ID_PEDIDO}/reversas`,
      'pedido_logistica_reversa':  `/pedidos/vendas/${ID_PEDIDO}/logisticas/reversas`,
    };

    for (const [chave, path] of Object.entries(candidatos)) {
      const r = await fetch(`https://www.bling.com.br/Api/v3${path}`, {
        headers: { 'Authorization': `Bearer ${process.env.BLING_API_KEY}`, 'Accept': 'application/json' },
        cache: 'no-store',
      });
      const j = await r.json();
      resultados[chave] = r.ok
        ? `✅ ENCONTRADO! ${JSON.stringify(j?.data ?? j).slice(0, 200)}`
        : `❌ ${r.status}`;
    }


    // ── Bling: busca por número da Tray via paginação ───────
    const dataInicial = new Date();
    dataInicial.setDate(dataInicial.getDate() - 30);
    const dataInicialStr = dataInicial.toISOString().split('T')[0];

    const NUMERO_TRAY_TESTE = '16866'; // Pedido Tray que corresponde ao Bling 13103
    let pedidoEncontrado = null;
    let totalPedidos = 0;

    for (let pagina = 1; pagina <= 5; pagina++) {
      const res = await fetch(
        `https://www.bling.com.br/Api/v3/pedidos/vendas?limite=100&pagina=${pagina}&dataInicial=${dataInicialStr}`,
        {
          headers: { 'Authorization': `Bearer ${process.env.BLING_API_KEY}`, 'Accept': 'application/json' },
          cache: 'no-store',
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        resultados.bling_erro = `❌ ${err?.error?.description || res.status}`;
        break;
      }

      const json = await res.json();
      const pedidos = json?.data ?? [];
      totalPedidos += pedidos.length;

      pedidoEncontrado = pedidos.find(
        (p: { numeroLoja: string }) => String(p.numeroLoja).trim() === NUMERO_TRAY_TESTE
      );

      if (pedidoEncontrado || pedidos.length < 100) break;
    }

    resultados.bling_pedidos_verificados = `${totalPedidos} pedidos dos últimos 30 dias`;

    if (!pedidoEncontrado) {
      resultados.bling_pedido = `❌ Pedido Tray ${NUMERO_TRAY_TESTE} não encontrado`;
    } else {
      const p = pedidoEncontrado as { id: number; numero: number; numeroLoja: string; data: string; contato: { id: number; nome: string }; situacao: { id: number; valor: string } };
      resultados.bling_pedido = `✅ ID: ${p.id} | Nº Bling: ${p.numero} | Tray: ${p.numeroLoja} | Data: ${p.data} | Cliente: ${p.contato?.nome} | Status: [${p.situacao?.id}] "${p.situacao?.valor}"`;

      // Busca CPF no contato
      const contatoRes = await fetch(
        `https://www.bling.com.br/Api/v3/contatos/${p.contato?.id}`,
        {
          headers: { 'Authorization': `Bearer ${process.env.BLING_API_KEY}`, 'Accept': 'application/json' },
          cache: 'no-store',
        }
      );
      const contatoJson = await contatoRes.json();

      if (contatoRes.ok && contatoJson?.data) {
        const cpf = contatoJson.data.numeroDocumento || contatoJson.data.cpfCnpj || 'não encontrado';
        resultados.bling_cpf = `✅ ${cpf}`;
      } else {
        resultados.bling_cpf = `❌ ${contatoJson?.error?.description || 'Erro ao buscar contato'}`;
      }
    }

    // ── Melhor Envio: testa múltiplas URLs ─────────────────
    const meEnv = process.env.MELHOR_ENVIO_ENV || 'production';
    const meUrls = meEnv === 'sandbox'
      ? ['https://sandbox.melhorenvio.com.br/api/v2']
      : [
          'https://melhorenvio.com.br/api/v2',
          'https://www.melhorenvio.com.br/api/v2',
          'https://app.melhorenvio.com.br/api/v2',
        ];

    const meHeaders = {
      'Authorization': `Bearer ${process.env.MELHOR_ENVIO_TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Loja Flávia Organiza (contato@lojaflaviaorganiza.com.br)',
    };

    for (const baseUrl of meUrls) {
      try {
        const meRes = await fetch(`${baseUrl}/me`, {
          headers: meHeaders,
          redirect: 'manual',
          cache: 'no-store',
        });

        const chave = `melhor_envio_${baseUrl.replace('https://', '').split('/')[0]}`;

        if (meRes.status === 301 || meRes.status === 302 || meRes.status === 307 || meRes.status === 308) {
          const location = meRes.headers.get('location');
          resultados[chave] = `🔄 Redirect ${meRes.status} → ${location}`;
        } else if (meRes.ok) {
          const meJson = await meRes.json();
          resultados[chave] = `✅ OK — Conta: ${meJson?.firstname} ${meJson?.lastname} (${meJson?.email})`;
        } else {
          const meErr = await meRes.json().catch(() => ({}));
          resultados[chave] = `❌ ${meRes.status} — ${meErr?.message || JSON.stringify(meErr).slice(0, 100)}`;
        }
      } catch (e) {
        const chave = `melhor_envio_${baseUrl.replace('https://', '').split('/')[0]}`;
        resultados[chave] = `❌ ERRO: ${e instanceof Error ? e.message : 'desconhecido'}`;
      }
    }

  } catch (e) {
    resultados.erro_geral = `❌ ${e instanceof Error ? e.message : 'Erro desconhecido'}`;
  }

  return NextResponse.json(resultados, { status: 200 });
}
