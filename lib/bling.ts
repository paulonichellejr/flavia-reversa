/**
 * INTEGRAÇÃO BLING ERP v3
 * Fluxo simplificado — Bling como fonte única de verdade:
 * 1. Busca pedido pelo número da loja virtual (= número Tray) ou número interno do Bling
 * 2. Verifica se o pedido não está em status "não enviado" (Em aberto, etc.)
 * 3. Verifica entrega real via rastreio no Melhor Envio
 * 4. Valida prazo de 30 dias
 * 5. Busca CPF no cadastro do contato vinculado
 * 6. Abre processo de devolução (registra observação)
 */

import type { RespostaAPI } from '@/types';
import { getBlingToken } from './bling-token';

const BASE_URL  = 'https://www.bling.com.br/Api/v3';
const PRAZO_DIAS = 30; // janela total: entrega (~20 dias) + 7 dias de devolução + margem

async function headers() {
  const token = await getBlingToken();
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  };
}

// ─── Tipos internos do Bling ─────────────────────────────────

export interface BlingPedido {
  id: number;
  numero: number;
  numeroLoja: string;
  data: string; // formato: "YYYY-MM-DD"
  situacao: { id: number; valor: string | number };
  contato: { id: number; nome: string };
  valorTotal: number;
  itens: { id: number; descricao: string; quantidade: number; valor: number }[];
  transporte?: {
    codigoRastreamento?: string;
    volumes?: Array<{ id?: number; servico?: string; codigoRastreamento?: string }>;
  };
}

interface BlingContato {
  id: number;
  nome: string;
  cpfCnpj: string;
  numeroDocumento: string;
}

// ─── IDs de situação do Bling ────────────────────────────────
// Situações que indicam pedido ainda NÃO foi despachado (bloqueia direto):
const IDS_NAO_ENVIADO = [6, 15]; // 6 = Em aberto, 15 = Em andamento (pré-envio)

// ─── Buscar pedido pelo número ───────────────────────────────
async function buscarPedidoPorNumero(
  numeroPedido: string
): Promise<BlingPedido | null> {
  const dataInicial = new Date();
  dataInicial.setDate(dataInicial.getDate() - 30);
  const dataInicialStr = dataInicial.toISOString().split('T')[0];

  const LIMITE_POR_PAGINA = 100;
  const MAX_PAGINAS = 5;

  for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
    const url = `${BASE_URL}/pedidos/vendas?limite=${LIMITE_POR_PAGINA}&pagina=${pagina}&dataInicial=${dataInicialStr}`;
    const res = await fetch(url, { headers: await headers(), cache: 'no-store' });
    if (!res.ok) break;

    const json = await res.json();
    const pedidos: BlingPedido[] = json?.data ?? [];

    const encontrado = pedidos.find(
      (p) =>
        String(p.numeroLoja).trim() === String(numeroPedido).trim() ||
        String(p.numero).trim()     === String(numeroPedido).trim()
    );

    if (encontrado) {
      // Preserva a situacao.valor textual da lista (endpoint completo retorna valor numérico "1")
      const situacaoLista = encontrado.situacao;

      // Busca pedido completo (com itens e transporte)
      const fullRes = await fetch(`${BASE_URL}/pedidos/vendas/${encontrado.id}`, {
        headers: await headers(),
        cache: 'no-store',
      });

      if (fullRes.ok) {
        const fullJson = await fullRes.json();
        const pedidoCompleto = fullJson?.data as BlingPedido | undefined;

        if (pedidoCompleto) {
          // O endpoint completo retorna situacao.valor como número (ex: "1").
          // Restaura o texto legível vindo da lista (ex: "Em aberto", "Atendido").
          const valorCompleto = String(pedidoCompleto.situacao?.valor ?? '');
          const valorEhNumerico = /^\d+$/.test(valorCompleto) || valorCompleto === '';
          if (valorEhNumerico && situacaoLista?.valor) {
            pedidoCompleto.situacao = situacaoLista;
          }

          // O código de rastreio fica em transporte.volumes[0].codigoRastreamento,
          // não em transporte.codigoRastreamento (que vem vazio da API do Bling).
          const codVol = pedidoCompleto.transporte?.volumes?.[0]?.codigoRastreamento ?? '';
          const codRaiz = pedidoCompleto.transporte?.codigoRastreamento ?? '';
          const codFinal = codRaiz || codVol;

          if (codFinal && pedidoCompleto.transporte) {
            pedidoCompleto.transporte.codigoRastreamento = codFinal;
          }

          console.log('[Bling] Pedido encontrado — id:', pedidoCompleto.id,
            '| situacao id:', pedidoCompleto.situacao?.id,
            '| situacao valor:', pedidoCompleto.situacao?.valor,
            '| rastreio (raiz):', codRaiz || '(vazio)',
            '| rastreio (volume):', codVol || '(vazio)',
            '| rastreio (final):', codFinal || '(sem rastreio)');

          return pedidoCompleto;
        }
      }
      return encontrado;
    }

    if (pedidos.length < LIMITE_POR_PAGINA) break;
  }

  return null;
}

// ─── Verificar entrega no Melhor Envio ───────────────────────
// Política estrita: qualquer dúvida = bloqueia.
// Só libera se o ME confirmar explicitamente delivered_at preenchido ou status "delivered".
async function verificarEntregaMelhorEnvio(
  codigoRastreamento: string,
  numeroPedido: string
): Promise<{ entregue: boolean; statusME?: string }> {
  try {
    const token = process.env.MELHOR_ENVIO_TOKEN;
    const email = process.env.LOJA_EMAIL || 'contato@lojaflaviaorganiza.com.br';

    if (!token) {
      console.warn('[ME] Token não configurado — bloqueando pedido', numeroPedido);
      return { entregue: false };
    }

    if (!codigoRastreamento) {
      console.warn('[ME] Sem código de rastreio para pedido', numeroPedido, '— bloqueando');
      return { entregue: false };
    }

    const meUrl = 'https://melhorenvio.com.br/api/v2';
    const meHeaders = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'User-Agent': `Loja Flávia Organiza (${email})`,
    };

    // ── Tentativa 1: busca rápida pelo tracking via ?q= ────────
    // Funciona para Correios (SEDEX/PAC) e outros transportadores com código externo.
    const pedidoME = await (async () => {
      const res = await fetch(
        `${meUrl}/me/orders?q=${encodeURIComponent(codigoRastreamento)}&per_page=10`,
        { headers: meHeaders }
      );
      console.log('[ME] Busca rápida por "' + codigoRastreamento + '" — HTTP', res.status);
      if (!res.ok) return null;

      const rawText = await res.text();
      let json: unknown;
      try { json = JSON.parse(rawText); } catch { return null; }

      const orders: Record<string, unknown>[] =
        Array.isArray((json as Record<string, unknown>)?.data)
          ? (json as Record<string, unknown>).data as Record<string, unknown>[]
          : Array.isArray(json)
            ? json as Record<string, unknown>[]
            : [];

      if (orders.length === 0) return null;

      // Correspondência exata pelo tracking; fallback: única order retornada
      return orders.find(
        (o) => String(o.tracking ?? '').toUpperCase() === codigoRastreamento.toUpperCase()
      ) ?? (orders.length === 1 ? orders[0] : null);
    })();

    // ── Tentativa 2: busca nos últimos 100 pedidos ME ──────────
    // Para serviços ME (.Com, etc.) cujo código fica em self_tracking, não em tracking.
    // O ?q= não indexa self_tracking, então precisamos buscar a lista completa e filtrar.
    const pedidoMEFinal = pedidoME ?? await (async () => {
      console.log('[ME] Busca rápida não encontrou — buscando nos últimos 100 pedidos por self_tracking...');
      const res = await fetch(
        `${meUrl}/me/orders?per_page=100`,
        { headers: meHeaders }
      );
      if (!res.ok) {
        console.warn('[ME] Falha ao listar pedidos recentes:', res.status);
        return null;
      }

      const rawText = await res.text();
      let json: unknown;
      try { json = JSON.parse(rawText); } catch { return null; }

      const orders: Record<string, unknown>[] =
        Array.isArray((json as Record<string, unknown>)?.data)
          ? (json as Record<string, unknown>).data as Record<string, unknown>[]
          : Array.isArray(json)
            ? json as Record<string, unknown>[]
            : [];

      console.log('[ME] Total de pedidos recentes:', orders.length);

      const cod = codigoRastreamento.toUpperCase();
      return orders.find((o) =>
        String(o.tracking      ?? '').toUpperCase() === cod ||   // código externo (Correios, bus, etc.)
        String(o.self_tracking ?? '').toUpperCase() === cod      // código ME (.Com, eFácil, etc.)
      ) ?? null;
    })();

    if (!pedidoMEFinal) {
      console.warn('[ME] Pedido não encontrado para rastreio', codigoRastreamento, '— bloqueando');
      return { entregue: false };
    }

    // ── Avaliar entrega ────────────────────────────────────────
    // delivered_at = data real de entrega (mais confiável que status text)
    const deliveredAt = pedidoMEFinal.delivered_at ?? pedidoMEFinal.deliveredAt ?? null;
    const status = String(pedidoMEFinal.status ?? '').toLowerCase().trim();

    console.log('[ME] Order encontrada:',
      '| tracking:', pedidoMEFinal.tracking,
      '| self_tracking:', pedidoMEFinal.self_tracking,
      '| status:', status,
      '| delivered_at:', deliveredAt ?? 'null');

    // Entregue = delivered_at preenchido OU status "delivered"
    // posted, in_transit, canceled, etc. → bloqueia
    const entregue =
      (deliveredAt !== null && deliveredAt !== undefined && String(deliveredAt).trim() !== '') ||
      status === 'delivered';

    console.log('[ME] Resultado:', entregue
      ? `✅ ENTREGUE (delivered_at="${deliveredAt}")`
      : `❌ NÃO ENTREGUE (status="${status}", delivered_at=null)`);

    return { entregue, statusME: String(pedidoMEFinal.status ?? '') };

  } catch (e) {
    console.error('[ME] Erro inesperado ao verificar entrega:', e);
    return { entregue: false };
  }
}

// ─── Buscar contato pelo ID ───────────────────────────────────
async function buscarContato(idContato: number): Promise<BlingContato | null> {
  const res = await fetch(`${BASE_URL}/contatos/${idContato}`, {
    headers: await headers(),
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json?.data ?? null;
}

// ─── Validar prazo ────────────────────────────────────────────
function validarPrazo(dataPedido: string): boolean {
  const data = new Date(dataPedido);
  const hoje = new Date();
  const diff = Math.floor((hoje.getTime() - data.getTime()) / (1000 * 60 * 60 * 24));
  return diff <= PRAZO_DIAS;
}

function normalizarCPF(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

// ─── FUNÇÃO PRINCIPAL: Valida pedido no Bling ────────────────
export async function validarPedidoBling(
  numeroPedidoTray: string,
  cpfCliente: string
): Promise<RespostaAPI<BlingPedido & { idContato: number }>> {
  try {
    // 1. Busca pedido
    const pedido = await buscarPedidoPorNumero(numeroPedidoTray);
    if (!pedido) {
      return {
        sucesso: false,
        erro: 'Ops! Não conseguimos encontrar esse pedido. Que tal conferir o número e tentar novamente?',
      };
    }

    const situacaoId    = pedido.situacao?.id;
    const situacaoValor = String(pedido.situacao?.valor ?? '').toLowerCase();

    // 2. Bloqueia pedidos claramente não enviados (Em aberto, aguardando, etc.)
    const textoNaoEnviado = ['em aberto', 'aberto', 'aguardando', 'pendente', 'em andamento', 'digitação'];
    const bloqueadoPorId    = situacaoId !== undefined && IDS_NAO_ENVIADO.includes(situacaoId);
    const bloqueadoPorTexto = textoNaoEnviado.some((s) => situacaoValor.includes(s));

    if (bloqueadoPorId || bloqueadoPorTexto) {
      return {
        sucesso: false,
        erro: 'Seu pedido ainda não foi enviado. A solicitação de troca ou devolução só pode ser feita após a entrega do produto.',
      };
    }

    // 3. Verifica entrega — estratégia depende do tipo de venda
    const codigoRastreamento = pedido.transporte?.codigoRastreamento ?? '';
    const temVolumesEnvio    = (pedido.transporte?.volumes?.length ?? 0) > 0;

    // IDs que indicam pedido concluído/entregue no Bling (usado para vendas diretas)
    const IDS_CONCLUIDO = [9, 10]; // 9 = Atendido, 10 = Verificado
    const textoConcluido = ['atendido', 'verificado', 'concluido', 'concluído', 'entregue'];
    const blingMarcouConcluido =
      (situacaoId !== undefined && IDS_CONCLUIDO.includes(situacaoId)) ||
      textoConcluido.some((s) => situacaoValor.includes(s));

    if (!codigoRastreamento && !temVolumesEnvio) {
      // ── Venda direta / retirada em loja ─────────────────────
      // Sem rastreio e sem volumes = pedido não foi despachado por transportadora.
      // O produto foi retirado presencialmente ou entregue via WhatsApp/moto.
      // Confiamos no status "Atendido" do Bling como confirmação de entrega.
      console.log('[Bling] Venda direta detectada (sem rastreio, sem volumes) — situação:', situacaoId, '/', situacaoValor);

      if (!blingMarcouConcluido) {
        return {
          sucesso: false,
          erro: 'Seu pedido ainda não foi marcado como entregue. A solicitação de devolução pode ser feita após a confirmação.',
        };
      }
      console.log('[Bling] Venda direta — Bling confirma como Atendido/Verificado ✅');

    } else {
      // ── Venda com envio (e-commerce, WhatsApp com Correios, etc.) ──
      // Verifica entrega real no Melhor Envio.
      // Só libera se ME confirmar "delivered" (delivered_at preenchido).
      console.log('[Bling] Verificando entrega no ME — situação:', situacaoId, '/', situacaoValor,
        '| rastreio:', codigoRastreamento || '(sem código)',
        '| volumes:', temVolumesEnvio ? 'sim' : 'não');

      const { entregue } = await verificarEntregaMelhorEnvio(
        codigoRastreamento,
        numeroPedidoTray
      );

      if (!entregue) {
        return {
          sucesso: false,
          erro: 'Seu pedido ainda não foi entregue. A solicitação de devolução só pode ser feita após a confirmação da entrega.',
        };
      }
    }

    // 4. Valida prazo
    if (!validarPrazo(pedido.data)) {
      return {
        sucesso: false,
        erro: 'Que pena! O prazo para solicitar devolução deste pedido já encerrou. As devoluções precisam ser solicitadas em até 7 dias após o recebimento.',
      };
    }

    // 5. Busca CPF do contato
    const contato = await buscarContato(pedido.contato.id);
    const cpfBling = contato?.numeroDocumento || contato?.cpfCnpj;

    if (!cpfBling) {
      return {
        sucesso: false,
        erro: 'Não conseguimos verificar os dados do cadastro. Por favor, entre em contato com nosso suporte.',
      };
    }

    // 6. Valida CPF
    if (normalizarCPF(cpfBling) !== normalizarCPF(cpfCliente)) {
      return {
        sucesso: false,
        erro: 'Hmm, o CPF informado não corresponde ao cadastro desse pedido. Pode conferir os dados e tentar novamente?',
      };
    }

    return {
      sucesso: true,
      dados: { ...pedido, idContato: contato.id },
      mensagem: 'Pedido encontrado e validado com sucesso!',
    };

  } catch (error) {
    console.error('[Bling] Erro ao validar pedido:', error);
    return {
      sucesso: false,
      erro: 'Tivemos um problema ao consultar seu pedido. Tente novamente em alguns instantes.',
    };
  }
}

// ─── Abrir devolução no Bling ────────────────────────────────
// Estratégia: GET do pedido completo → adiciona observação → PUT de volta.
// O Bling v3 não aceita PUT parcial; precisa do payload completo.
export async function abrirDevolucaoBling(
  idPedido: number,
  motivo: string,
  descricao: string
): Promise<RespostaAPI<{ id: string; numero: string }>> {
  try {
    const hdrs = await headers();
    const nota = `\n\n--- SOLICITAÇÃO DE DEVOLUÇÃO/TROCA ---\nMotivo: ${motivo}\nDescrição: ${descricao}\nData: ${new Date().toLocaleString('pt-BR')}`;

    // 1. Busca o pedido completo para ter o payload obrigatório
    const getRes = await fetch(`${BASE_URL}/pedidos/vendas/${idPedido}`, {
      headers: hdrs,
      cache: 'no-store',
    });

    if (!getRes.ok) {
      console.warn('[Bling] GET pedido falhou ao buscar para atualizar observações:', getRes.status);
      return { sucesso: false, erro: 'Não foi possível buscar o pedido para registrar a observação.' };
    }

    const getJson = await getRes.json();
    const pedidoAtual = getJson?.data ?? {};

    // 2. Monta payload de atualização
    // Bling v3 PUT /pedidos/vendas/{id} exige contato + situacao + itens (ao menos 1)
    const observacoesAtual = String(pedidoAtual.observacoes ?? '');

    // Mapeia os itens do pedido para o formato esperado pelo PUT
    type BlingItemPayload = {
      id?: number;
      codigo?: string;
      descricao: string;
      quantidade: number;
      valor: number;
      unidade?: string;
    };
    const itensPayload: BlingItemPayload[] = Array.isArray(pedidoAtual.itens)
      ? (pedidoAtual.itens as Record<string, unknown>[]).map((item) => ({
          id: typeof item.id === 'number' ? item.id : undefined,
          codigo: typeof item.codigo === 'string' ? item.codigo : undefined,
          descricao: String(item.descricao ?? 'Produto'),
          quantidade: Number(item.quantidade ?? 1),
          valor: Number(item.valor ?? 0),
          unidade: typeof item.unidade === 'string' ? item.unidade : 'UN',
        }))
      : [];

    if (itensPayload.length === 0) {
      // Se não há itens no GET, não podemos fazer o PUT (Bling exige ao menos 1 item).
      // Registramos a tentativa no log e retornamos sem erro para não bloquear o fluxo.
      console.warn('[Bling] Pedido sem itens no GET — não é possível registrar observação via PUT. Fluxo continua.');
      return { sucesso: false, erro: 'Pedido sem itens — observação não registrada no Bling.' };
    }

    const payload: Record<string, unknown> = {
      contato: pedidoAtual.contato ? { id: pedidoAtual.contato.id } : undefined,
      situacao: pedidoAtual.situacao ? { id: pedidoAtual.situacao.id } : undefined,
      itens: itensPayload,
      observacoes: observacoesAtual + nota,
    };

    // Remove campos undefined
    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

    const res = await fetch(`${BASE_URL}/pedidos/vendas/${idPedido}`, {
      method: 'PUT',
      headers: hdrs,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[Bling] Erro ao atualizar pedido com observação:', JSON.stringify(err));
      return {
        sucesso: false,
        erro: 'Não conseguimos registrar a observação no Bling. Nossa equipe será avisada.',
      };
    }

    console.log('[Bling] ✅ Observação de devolução registrada no pedido', idPedido);
    return {
      sucesso: true,
      dados: { id: String(idPedido), numero: String(idPedido) },
      mensagem: 'Observação de devolução registrada no Bling com sucesso!',
    };
  } catch (error) {
    console.error('[Bling] Erro ao abrir devolução:', error);
    return {
      sucesso: false,
      erro: 'Falha ao registrar no sistema interno. Tente novamente.',
    };
  }
}
