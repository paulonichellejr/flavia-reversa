/**
 * INTEGRAÇÃO MELHOR ENVIO — LOGÍSTICA REVERSA
 * Documentação: https://docs.melhorenvio.com.br/
 *
 * COMO OBTER SEU TOKEN:
 * 1. Acesse: https://melhorenvio.com.br
 * 2. Crie uma conta ou faça login
 * 3. Vá em Integrações > Tokens de Acesso
 * 4. Gere um token com permissão: "Gerar etiquetas de devolução"
 * 5. Cole em MELHOR_ENVIO_TOKEN no seu .env.local
 *
 * ATENÇÃO: Para testes use o ambiente sandbox:
 * https://sandbox.melhorenvio.com.br
 * Basta mudar MELHOR_ENVIO_ENV=sandbox no .env.local
 */

import type { EtiquetaMelhorEnvio, PedidoTray, RespostaAPI } from '@/types';

const MELHOR_ENVIO_ENV = process.env.MELHOR_ENVIO_ENV || 'production';
const BASE_URL =
  MELHOR_ENVIO_ENV === 'sandbox'
    ? 'https://sandbox.melhorenvio.com.br/api/v2'
    : 'https://melhorenvio.com.br/api/v2';

const TOKEN = process.env.MELHOR_ENVIO_TOKEN!;
const APP_CLIENT_ID = process.env.MELHOR_ENVIO_CLIENT_ID!;
const LOJA_EMAIL = process.env.LOJA_EMAIL || 'contato@lojaflaviaorganiza.com.br';

/**
 * Gera uma etiqueta de logística reversa (coleta na casa do cliente).
 * Retorna o link para a etiqueta e as instruções de postagem.
 */
export async function gerarEtiquetaReversa(
  pedido: PedidoTray,
  protocolo_bling: string
): Promise<RespostaAPI<EtiquetaMelhorEnvio>> {
  try {
    // Modo teste LOCAL: retorna etiqueta simulada sem chamar a API do ME (sem debitar saldo)
    // Configure MELHOR_ENVIO_MODO_TESTE=true no .env.local para testar o fluxo completo
    // sem gerar etiqueta real. Neste modo, o e-mail do ME NÃO será enviado.
    const modoTeste = process.env.MELHOR_ENVIO_MODO_TESTE === 'true';

    if (modoTeste) {
      console.log('[MelhorEnvio] 🔵 MODO TESTE LOCAL — Etiqueta simulada. Nenhuma chamada à API do ME. Nenhum saldo debitado. (E-mail do ME não será enviado neste modo)');
      return {
        sucesso: true,
        dados: {
          id: `TESTE-LOCAL`,
          protocolo: `TESTE-ME-LOCAL-${Date.now()}`,
          codigo_postagem: 'TESTE000000000BR',
          instrucoes: '⚠️ MODO TESTE LOCAL — Código simulado. Em produção, o código real dos Correios será exibido aqui.',
          prazo_postagem: '5 dias úteis após receber esta confirmação',
        },
        mensagem: 'Integração validada com sucesso (modo teste local — sem chamada ao ME).',
      };
    }

    // ── Verifica se as variáveis de endereço da loja estão configuradas ───────────
    const lojaCep = (process.env.LOJA_CEP || '').replace(/\D/g, '');
    const lojaUf  = process.env.LOJA_UF || '';
    if (!lojaCep || !lojaUf) {
      console.error('[MelhorEnvio] ❌ ERRO DE CONFIGURAÇÃO: Variáveis de ambiente da loja não configuradas!');
      console.error('  → LOJA_CEP:', lojaCep || '(VAZIO — configure no Vercel)');
      console.error('  → LOJA_UF:', lojaUf || '(VAZIO — configure no Vercel)');
      console.error('  → LOJA_CIDADE:', process.env.LOJA_CIDADE || '(VAZIO)');
      console.error('  → LOJA_ENDERECO:', process.env.LOJA_ENDERECO || '(VAZIO)');
      return {
        sucesso: false,
        erro: 'Erro de configuração interna. Nossa equipe já foi avisada e irá te enviar a etiqueta por e-mail em breve! 💛',
      };
    }

    // ── Verifica se o endereço do cliente está preenchido ─────────────────────────
    const clienteCep = (pedido.cliente.cep || '').replace(/\D/g, '');
    if (!clienteCep || clienteCep.length < 8) {
      console.error('[MelhorEnvio] ❌ CEP do cliente inválido ou vazio:', pedido.cliente.cep);
      return {
        sucesso: false,
        erro: 'O CEP informado parece inválido. Por favor, verifique e tente novamente.',
      };
    }

    console.log('[MelhorEnvio] Iniciando etiqueta reversa:',
      `CEP cliente: ${clienteCep}`,
      `| CEP loja: ${lojaCep}`,
      `| UF: ${lojaUf}`
    );

    // 1. Adiciona ao carrinho
    const cpfLimpo = (pedido.cliente.cpf || '').replace(/\D/g, '');
    const docLoja = MELHOR_ENVIO_ENV === 'sandbox'
      ? (process.env.MELHOR_ENVIO_DOCUMENTO_TESTE || '12345678909')
      : (process.env.LOJA_CPF_RESPONSAVEL || '').replace(/\D/g, '');

    // ── Serviços para tentar em ordem de preferência ──────────────────────────
    // Se o serviço principal não atender o trecho, tenta os próximos automaticamente.
    // IDs Melhor Envio: 1=PAC, 2=SEDEX, 3=SEDEX contrato, 6=PAC contrato
    const servicoInicial = Number(process.env.MELHOR_ENVIO_SERVICO_ID || '1');
    const servicosFallback = [servicoInicial, 1, 2, 6, 3].filter(
      (v, i, arr) => arr.indexOf(v) === i // remove duplicatas mantendo a ordem
    );

    const carrinhoPayloadBase = {
      agency: null,
      from: {
        name: pedido.cliente.nome,
        // Se MELHOR_ENVIO_EMAIL_TESTE estiver definido, redireciona o e-mail para o endereço de teste
        // (evita que o cliente real receba notificações durante testes)
        email: (() => {
          const emailFinal = process.env.MELHOR_ENVIO_EMAIL_TESTE || pedido.cliente.email || LOJA_EMAIL;
          if (process.env.MELHOR_ENVIO_EMAIL_TESTE) {
            console.log(`[MelhorEnvio] ⚠️  MODO TESTE DE E-MAIL ATIVO — notificação será enviada para: ${emailFinal} (e NÃO para o cliente: ${pedido.cliente.email})`);
          } else {
            console.log(`[MelhorEnvio] ✅ E-mail de notificação será enviado para o cliente: ${emailFinal}`);
          }
          return emailFinal;
        })(),
        document: cpfLimpo,
        phone: '',
        address: pedido.cliente.endereco || '',
        complement: pedido.cliente.complemento || '',
        number: pedido.cliente.numero || 'S/N',
        district: pedido.cliente.bairro || '',
        city: pedido.cliente.cidade || '',
        state_abbr: pedido.cliente.uf || '',
        country_id: 'BR',
        postal_code: clienteCep,  // já validado e limpo acima
        note: `Devolução referente ao pedido ${pedido.numero} — Protocolo Bling: ${protocolo_bling}`,
      },
      to: {
        name: 'Loja Flávia Organiza',
        email: LOJA_EMAIL,
        document: docLoja,
        phone: '',
        address: process.env.LOJA_ENDERECO || '',
        complement: process.env.LOJA_COMPLEMENTO || '',
        number: process.env.LOJA_NUMERO || '',
        district: process.env.LOJA_BAIRRO || '',
        city: process.env.LOJA_CIDADE || '',
        state_abbr: lojaUf,
        country_id: 'BR',
        postal_code: lojaCep,  // já validado e limpo acima
      },
      // ── Itens reais para a Declaração de Conteúdo ──────────────
      // Esses itens aparecem na "Declaração de Conteúdo" gerada pelo ME,
      // exatamente como no fluxo manual. Cada item selecionado pelo cliente
      // aparece com nome, quantidade e valor unitário.
      products: (() => {
        const itensPedido = pedido.itens ?? [];
        if (itensPedido.length > 0) {
          return itensPedido.map((item) => ({
            name: item.nome.substring(0, 100), // ME limita o campo a 100 chars
            quantity: item.quantidade,
            unitary_value: item.valor_unitario > 0 ? item.valor_unitario : 1,
            weight: 0.3, // peso estimado por item em kg (Correios exige mínimo)
          }));
        }
        // Fallback: nenhum item mapeado — usa o total do pedido
        return [{
          name: 'Produto para devolução',
          quantity: 1,
          unitary_value: pedido.valor_total > 0 ? pedido.valor_total : 10,
          weight: 0.5,
        }];
      })(),
      service: servicoInicial, // será sobrescrito no loop de tentativas
      // ── Dimensões do volume ──────────────────────────────────
      // Peso calculado dinamicamente com base na lista de itens
      volumes: (() => {
        const itensPedido = pedido.itens ?? [];
        const pesoCalculado = itensPedido.reduce(
          (total, item) => total + 0.3 * item.quantidade, 0
        );
        const peso = Math.max(pesoCalculado || 0.5, 0.1); // mínimo 100g
        const qtdTotal = itensPedido.reduce((s, i) => s + i.quantidade, 0) || 1;
        // Dimensões crescem levemente com a quantidade de itens
        return [{
          height: Math.min(10 + qtdTotal, 30),
          width: 15,
          length: Math.min(20 + qtdTotal * 2, 50),
          weight: peso,
        }];
      })(),
      tag: `reversa-${pedido.numero}`,
      platform: 'Loja Flávia Organiza',
      options: {
        reverse: true,       // etiqueta de COLETA (reversa)
        non_commercial: true,
        invoice: {
          key: '',
        },
      },
    };

    // ── Tenta criar o carrinho com fallback automático de serviço ─────────────
    let carrinho: Record<string, unknown> | null = null;
    let servicoUsado = servicoInicial;

    for (const servicoId of servicosFallback) {
      const payload = { ...carrinhoPayloadBase, service: servicoId };
      console.log(`[MelhorEnvio] Tentando serviço ID ${servicoId}...`);

      const carrinhoRes = await fetch(`${BASE_URL}/me/cart`, {
        method: 'POST',
        headers: headersAuth(),
        body: JSON.stringify(payload),
      });

      if (carrinhoRes.ok) {
        carrinho = await carrinhoRes.json();
        servicoUsado = servicoId;
        console.log(`[MelhorEnvio] ✅ Carrinho criado com serviço ID ${servicoId}. ID:`, carrinho?.id);
        break;
      }

      const err = await carrinhoRes.json().catch(() => ({}));
      const errMsg = JSON.stringify(err).toLowerCase();
      const naoAtende = errMsg.includes('não atende') || errMsg.includes('nao atende') ||
                        errMsg.includes('trecho') || errMsg.includes('transportadora');

      if (naoAtende) {
        console.warn(`[MelhorEnvio] Serviço ID ${servicoId} não atende este trecho — tentando próximo...`);
        continue; // tenta o próximo serviço
      }

      // Erro diferente de "não atende" — para aqui
      console.error(`[MelhorEnvio] Erro no carrinho (serviço ${servicoId}):`, err);
      return { sucesso: false, erro: 'Não conseguimos preparar a etiqueta de envio.' };
    }

    if (!carrinho) {
      console.error('[MelhorEnvio] Nenhum serviço disponível atende o trecho do cliente.');
      return {
        sucesso: false,
        erro: 'Não foi possível gerar a etiqueta automaticamente para o seu CEP. Nossa equipe irá te enviar a etiqueta por e-mail em breve! 💛',
      };
    }

    if (servicoUsado !== servicoInicial) {
      console.log(`[MelhorEnvio] ℹ️  Serviço alternativo utilizado: ID ${servicoUsado} (principal ID ${servicoInicial} não atendia o trecho)`);
    }

    const itemId: string = carrinho?.id as string;
    console.log('[MelhorEnvio] Carrinho criado com sucesso. ID:', itemId);

    // 2. Checkout (compra a etiqueta) — somente em produção real
    const checkoutRes = await fetch(`${BASE_URL}/me/shipment/checkout`, {
      method: 'POST',
      headers: headersAuth(),
      body: JSON.stringify({ orders: [itemId] }),
    });

    if (!checkoutRes.ok) {
      console.error('[MelhorEnvio] Erro no checkout');
      return { sucesso: false, erro: 'Não conseguimos emitir a etiqueta de devolução.' };
    }

    // 3. Gera a etiqueta e captura o código de rastreio (tracking)
    const gerarRes = await fetch(`${BASE_URL}/me/shipment/generate`, {
      method: 'POST',
      headers: headersAuth(),
      body: JSON.stringify({ orders: [itemId] }),
    });

    if (!gerarRes.ok) {
      console.error('[MelhorEnvio] Erro ao gerar etiqueta');
      return { sucesso: false, erro: 'Etiqueta criada mas não conseguimos gerá-la. Nosso time irá te enviar por e-mail.' };
    }

    const gerarJson = await gerarRes.json();
    console.log('[MelhorEnvio] Generate response (raw):', JSON.stringify(gerarJson));

    // O Melhor Envio retorna um objeto indexado pelo ID do item do carrinho.
    // Para Correios, a geração é ASSÍNCRONA: o tracking só aparece após 2-8s.
    // Resposta imediata: { "abc-123": { "message": "Envio encaminhado para geração", "status": true } }
    const pedidoGerado = gerarJson?.[itemId] ?? Object.values(gerarJson ?? {})[0] ?? gerarJson;

    // Tenta extrair o código diretamente (resposta síncrona — ex: alguns serviços ME)
    let codigoPostagem: string =
      (pedidoGerado as Record<string, unknown>)?.tracking as string ??
      (pedidoGerado as Record<string, unknown>)?.tracking_number as string ??
      (pedidoGerado as Record<string, unknown>)?.code as string ??
      (pedidoGerado as Record<string, unknown>)?.object_number as string ??
      '';

    // ── Polling: aguarda o ME processar e busca o código de rastreio ──────────
    // Para Correios PAC/Sedex reverso, o código é gerado de forma assíncrona.
    // Fazemos até 4 tentativas com 3s de intervalo (máx ~12s extra).
    if (!codigoPostagem) {
      console.log('[MelhorEnvio] Código não disponível imediatamente — iniciando polling (até 4 tentativas × 3s)...');

      for (let tentativa = 1; tentativa <= 4 && !codigoPostagem; tentativa++) {
        // Aguarda antes de consultar (1ª tentativa: 3s, demais: 3s cada)
        await new Promise<void>((r) => setTimeout(r, 3000));

        try {
          // Busca os pedidos mais recentes e procura o que acabou de ser criado
          // pelo tag que definimos: "reversa-{numero_pedido}"
          const tagPedido = `reversa-${pedido.numero}`;
          const agora = Date.now();

          const pollRes = await fetch(`${BASE_URL}/me/orders?per_page=20`, {
            headers: headersAuth(),
          });

          if (pollRes.ok) {
            const pollJson = await pollRes.json();
            const orders: Record<string, unknown>[] = Array.isArray((pollJson as Record<string, unknown>)?.data)
              ? (pollJson as Record<string, unknown>).data as Record<string, unknown>[]
              : Array.isArray(pollJson)
                ? pollJson as Record<string, unknown>[]
                : [];

            // Procura pelo pedido: combina tag OU criado nos últimos 2 min COM código de rastreio
            const encontrado = orders.find((o) => {
              const oTag = String(o?.tag ?? o?.reminder ?? '');
              const criadoEm = o?.created_at ? new Date(String(o.created_at)).getTime() : 0;
              const foiRecente = agora - criadoEm < 120_000; // últimos 2 minutos
              const temCodigo  = Boolean(String(o?.tracking ?? o?.self_tracking ?? ''));
              return oTag === tagPedido || (foiRecente && temCodigo);
            });

            if (encontrado) {
              const cod = String(encontrado?.tracking ?? encontrado?.self_tracking ?? '');
              if (cod) {
                codigoPostagem = cod;
                console.log(`[MelhorEnvio] ✅ Código de rastreio obtido (tentativa ${tentativa}):`, codigoPostagem);
              }
            }
          }
        } catch (pollErr) {
          console.warn(`[MelhorEnvio] Tentativa ${tentativa} de polling falhou:`, pollErr);
        }

        if (!codigoPostagem) {
          console.log(`[MelhorEnvio] Tentativa ${tentativa}: código ainda não disponível. Aguardando...`);
        }
      }

      if (!codigoPostagem) {
        console.warn('[MelhorEnvio] ⚠️  Código de rastreio não obtido após polling. O ME enviará por e-mail ao cliente.');
      }
    } else {
      console.log('[MelhorEnvio] Código de postagem extraído diretamente:', codigoPostagem);
    }

    // 4. Busca o PDF da etiqueta + Declaração de Conteúdo
    // O ME gera automaticamente a Declaração de Conteúdo para pedidos non_commercial,
    // incluindo todos os produtos da lista. O PDF é compartilhado com o cliente.
    let urlEtiquetaInterna = '';
    try {
      const imprimirRes = await fetch(`${BASE_URL}/me/shipment/print`, {
        method: 'POST',
        headers: headersAuth(),
        body: JSON.stringify({ mode: 'public', orders: [itemId] }),
      });
      const imprimir = await imprimirRes.json();
      urlEtiquetaInterna = imprimir?.url || imprimir?.[itemId]?.url || '';
      if (urlEtiquetaInterna) {
        console.log('[MelhorEnvio] ✅ PDF da etiqueta+declaração gerado:', urlEtiquetaInterna);
      } else {
        console.warn('[MelhorEnvio] ⚠️  PDF não disponível ainda. Resposta:', JSON.stringify(imprimir));
      }
    } catch {
      // PDF é gerado assincronamente pelo ME — pode não estar pronto imediatamente
      console.warn('[MelhorEnvio] PDF ainda não pronto. O cliente pode acessar via código de postagem nos Correios.');
    }

    // Mensagem de instrução adaptada conforme disponibilidade do código e do PDF
    const instrucoes = codigoPostagem
      ? 'Leve o produto embalado até qualquer agência dos Correios e informe o código abaixo no balcão. ' +
        'O envio é gratuito para você! Você também pode baixar e imprimir a etiqueta para colar na embalagem. 💛'
      : 'Sua etiqueta foi gerada com sucesso! O código de rastreio e o PDF serão enviados para o seu e-mail pelo Melhor Envio em instantes. ' +
        'Aguarde o e-mail e leve o produto embalado até qualquer agência dos Correios. O envio é gratuito! 💛';

    const etiqueta: EtiquetaMelhorEnvio = {
      id: itemId,
      protocolo: `ME-${itemId}`,
      codigo_postagem: codigoPostagem,
      url_etiqueta: urlEtiquetaInterna, // salvo no Supabase (uso interno da loja)
      url_download: urlEtiquetaInterna, // exibido ao cliente para baixar etiqueta+declaração
      instrucoes,
      prazo_postagem: '5 dias úteis após receber esta confirmação',
    };

    return {
      sucesso: true,
      dados: etiqueta,
      mensagem: 'Etiqueta de devolução gerada com sucesso!',
    };
  } catch (error) {
    console.error('[MelhorEnvio] Erro geral:', error);
    return {
      sucesso: false,
      erro: 'Ocorreu um problema ao gerar sua etiqueta. Não se preocupe, nossa equipe já foi notificada!',
    };
  }
}

/**
 * Baixa os bytes do PDF da etiqueta + Declaração de Conteúdo.
 * Tenta dois caminhos: (1) POST /shipment/print com mode=private retornando
 * o PDF diretamente; (2) GET na URL pública com o Bearer token.
 * Retorna null se nenhum dos caminhos funcionar (não bloqueia o fluxo).
 */
export async function downloadPdfBytes(itemId: string): Promise<Buffer | null> {
  try {
    // Tentativa 1: mode=private — alguns ambientes do ME retornam o PDF binário direto
    const resPrivate = await fetch(`${BASE_URL}/me/shipment/print`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/pdf, application/json',
        'User-Agent': `Loja Flávia Organiza (${LOJA_EMAIL})`,
      },
      body: JSON.stringify({ mode: 'private', orders: [itemId] }),
    });

    const contentTypePrivate = resPrivate.headers.get('content-type') || '';
    if (contentTypePrivate.includes('application/pdf')) {
      const ab = await resPrivate.arrayBuffer();
      console.log('[MelhorEnvio] ✅ PDF baixado diretamente (mode=private)');
      return Buffer.from(ab);
    }

    // Tentativa 2: extrai URL do JSON e faz GET com auth
    let urlPdf = '';
    try {
      const json = await resPrivate.json();
      urlPdf = json?.url || json?.[itemId]?.url || '';
    } catch { /* resposta não era JSON */ }

    if (!urlPdf) {
      // Tenta obter a URL via mode=public como fallback
      const resPub = await fetch(`${BASE_URL}/me/shipment/print`, {
        method: 'POST',
        headers: headersAuth(),
        body: JSON.stringify({ mode: 'public', orders: [itemId] }),
      });
      if (resPub.ok) {
        const pubJson = await resPub.json();
        urlPdf = pubJson?.url || pubJson?.[itemId]?.url || '';
      }
    }

    if (urlPdf) {
      const resPdf = await fetch(urlPdf, {
        headers: { 'Authorization': `Bearer ${TOKEN}` },
      });
      const ct = resPdf.headers.get('content-type') || '';
      if (resPdf.ok && ct.includes('application/pdf')) {
        const ab = await resPdf.arrayBuffer();
        console.log('[MelhorEnvio] ✅ PDF baixado via URL pública com auth');
        return Buffer.from(ab);
      }
      console.warn('[MelhorEnvio] ⚠️  URL do PDF retornou content-type inesperado:', ct);
    }

    console.warn('[MelhorEnvio] ⚠️  Não foi possível baixar o PDF para anexar no e-mail (o link de download ainda será enviado).');
    return null;
  } catch (err) {
    console.warn('[MelhorEnvio] Erro ao baixar PDF para e-mail:', err);
    return null;
  }
}

function headersAuth() {
  return {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': `Loja Flávia Organiza (${LOJA_EMAIL})`,
  };
}
