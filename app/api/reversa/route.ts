/**
 * ROTA PRINCIPAL — /api/reversa
 * Fluxo simplificado usando Bling como fonte única:
 * 1. Valida pedido no Bling (número Tray → busca por numeroLoja)
 * 2. Faz upload das fotos no Supabase
 * 3. Registra log no Supabase
 * 4. Abre devolução no Bling
 * 5. Gera etiqueta no Melhor Envio
 * 6. Atualiza log final
 * 7. Envia e-mail de confirmação ao cliente (via Resend)
 */

import { NextRequest, NextResponse } from 'next/server';
import { validarPedidoBling, abrirDevolucaoBling } from '@/lib/bling';
import { gerarEtiquetaReversa, downloadPdfBytes } from '@/lib/melhor-envio';
import { criarLogReversa, atualizarLogReversa, uploadFotos } from '@/lib/supabase';
import { enviarEmailDevolucao, enviarEmailFallback } from '@/lib/email';
import { rateLimit } from '@/lib/rate-limit';
import type { RespostaAPI, EtiquetaMelhorEnvio } from '@/types';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  // ── Rate limiting: máx. 5 solicitações por IP a cada 10 minutos ─────────
  const limited = rateLimit(req, { max: 5, windowMs: 10 * 60 * 1000 });
  if (limited) return limited;

  let logId: string | undefined;

  try {
    // ── 1. Extrai dados do FormData ──────────────────────────
    const formData = await req.formData();

    const nome          = formData.get('nome') as string;
    const cpf           = formData.get('cpf') as string;
    const email         = formData.get('email') as string;
    const numeroPedido  = formData.get('numeroPedido') as string;
    const motivo        = formData.get('motivo') as string;
    const descricao     = formData.get('descricao') as string;
    const fotosRaw      = formData.getAll('fotos') as File[];
    // Itens selecionados pelo cliente: [{ id, quantidade }]
    const itensSelecionadosRaw = formData.get('itensSelecionados') as string;
    let itensSelecionados: { id: number; quantidade: number }[] = [];
    if (itensSelecionadosRaw) {
      try {
        const parsed = JSON.parse(itensSelecionadosRaw);
        if (!Array.isArray(parsed)) throw new Error('itensSelecionados deve ser um array');
        itensSelecionados = parsed;
      } catch {
        return NextResponse.json<RespostaAPI>(
          { sucesso: false, erro: 'Dados dos itens inválidos. Tente novamente.' },
          { status: 400 }
        );
      }
    }
    // Endereço do cliente (aparece na etiqueta dos Correios)
    const cep           = formData.get('cep') as string;
    const endereco      = formData.get('endereco') as string;
    const numero        = formData.get('numero') as string;
    const complemento   = formData.get('complemento') as string;
    const bairro        = formData.get('bairro') as string;
    const cidade        = formData.get('cidade') as string;
    const uf            = formData.get('uf') as string;

    if (!nome || !cpf || !email || !numeroPedido || !motivo || !descricao) {
      return NextResponse.json<RespostaAPI>(
        { sucesso: false, erro: 'Preencha todos os campos obrigatórios.' },
        { status: 400 }
      );
    }

    // Valida endereço completo (necessário para gerar etiqueta no Melhor Envio)
    const cepLimpo = (cep || '').replace(/\D/g, '');
    if (!cepLimpo || cepLimpo.length < 8 || !endereco || !numero || !bairro || !cidade || !uf) {
      return NextResponse.json<RespostaAPI>(
        { sucesso: false, erro: 'Preencha seu endereço completo (CEP, rua, número, bairro, cidade e estado). Ele é necessário para gerar a etiqueta de devolução.' },
        { status: 400 }
      );
    }

    if (itensSelecionados.length === 0) {
      return NextResponse.json<RespostaAPI>(
        { sucesso: false, erro: 'Selecione pelo menos um item para devolver.' },
        { status: 400 }
      );
    }

    // Valida que cada item tem id e quantidade >= 1
    const itensValidos = itensSelecionados.every(
      (i) => typeof i.id === 'number' && typeof i.quantidade === 'number' && i.quantidade >= 1
    );
    if (!itensValidos) {
      return NextResponse.json<RespostaAPI>(
        { sucesso: false, erro: 'Dados dos itens inválidos.' },
        { status: 400 }
      );
    }

    if (fotosRaw.length === 0) {
      return NextResponse.json<RespostaAPI>(
        { sucesso: false, erro: 'Pelo menos uma foto é necessária.' },
        { status: 400 }
      );
    }

    // ── 2. Valida pedido no Bling ────────────────────────────
    const resultadoBling = await validarPedidoBling(numeroPedido, cpf);

    if (!resultadoBling.sucesso || !resultadoBling.dados) {
      return NextResponse.json<RespostaAPI>(
        { sucesso: false, erro: resultadoBling.erro },
        { status: 422 }
      );
    }

    const pedido = resultadoBling.dados;

    // ── 3. Cria log inicial no Supabase ──────────────────────
    const log = await criarLogReversa({
      nome_cliente:       nome,
      cpf_cliente:        cpf,
      numero_pedido_tray: numeroPedido,
      numero_pedido_bling: String(pedido.numero),
      motivo,
      descricao,
      status: 'pedido_validado',
    });
    logId = log.id;

    // ── 4. Upload das fotos ──────────────────────────────────
    const fotosUrls = await uploadFotos(logId!, fotosRaw);
    await atualizarLogReversa(logId!, { fotos_urls: fotosUrls });

    // ── 5. Abre devolução no Bling ───────────────────────────
    await atualizarLogReversa(logId!, { status: 'criando_bling' });

    const resultadoDevolucao = await abrirDevolucaoBling(
      pedido.id,
      motivo,
      descricao
    );

    if (!resultadoDevolucao.sucesso) {
      // Não bloqueia o fluxo — registra o erro e continua
      console.warn('[reversa] Falha ao atualizar Bling, continuando...', resultadoDevolucao.erro);
    }

    // ── 6. Gera etiqueta no Melhor Envio ────────────────────
    await atualizarLogReversa(logId!, { status: 'gerando_etiqueta' });

    // Adapta o pedido Bling para o formato esperado pelo Melhor Envio
    const pedidoAdaptado = {
      id: String(pedido.id),
      numero: String(pedido.numero),
      status: String(pedido.situacao?.valor ?? ''),
      data_criacao: pedido.data,
      valor_total: pedido.valorTotal || 10,
      cliente: {
        nome,
        email,
        cpf,
        // Endereço do cliente (aparece na etiqueta dos Correios)
        cep:         cep.replace(/\D/g, ''),
        endereco,
        numero,
        complemento: complemento || '',
        bairro,
        cidade,
        uf,
      },
      // Apenas os itens selecionados, com a quantidade escolhida pelo cliente
      itens: (pedido.itens ?? [])
        .filter((item) => itensSelecionados.some((s) => s.id === item.id))
        .map((item) => {
          const sel = itensSelecionados.find((s) => s.id === item.id)!;
          return {
            id: String(item.id),
            nome: item.descricao,
            quantidade: sel.quantidade,           // quantidade escolhida (não a total do pedido)
            valor_unitario: item.valor || 1,
          };
        }),
    };

    const resultadoEtiqueta = await gerarEtiquetaReversa(
      pedidoAdaptado,
      String(pedido.numero)
    );

    let etiqueta: EtiquetaMelhorEnvio | undefined;

    if (resultadoEtiqueta.sucesso && resultadoEtiqueta.dados) {
      etiqueta = resultadoEtiqueta.dados;
      await atualizarLogReversa(logId!, {
        id_etiqueta:        etiqueta.id,
        url_etiqueta:       etiqueta.url_etiqueta,
        protocolo_etiqueta: etiqueta.protocolo,
        status: 'concluido',
      });
    } else {
      await atualizarLogReversa(logId!, {
        status: 'concluido',
        erro_mensagem: resultadoEtiqueta.erro,
      });
    }

    // ── 7. Envia e-mail de confirmação ao cliente ─────────────
    // IMPORTANTE: usar await aqui — Vercel encerra a função serverless ao retornar a resposta,
    // então qualquer promise fire-and-forget é cancelada antes de executar.
    const emailDestino = process.env.MELHOR_ENVIO_EMAIL_TESTE || email;
    if (process.env.MELHOR_ENVIO_EMAIL_TESTE) {
      console.log(`[Email] ⚠️  MODO TESTE — e-mail será enviado para: ${emailDestino} (NÃO para o cliente: ${email})`);
    }

    try {
      if (etiqueta) {
        // Baixa os bytes do PDF para anexar no e-mail (não bloqueia o fluxo se falhar)
        const pdfBuffer = await downloadPdfBytes(etiqueta.id).catch(() => null);

        // Etiqueta gerada com sucesso → e-mail completo com código + PDF em anexo
        await enviarEmailDevolucao({
          clienteNome:   nome,
          clienteEmail:  emailDestino,
          numeroPedido,
          codigoPostagem: etiqueta.codigo_postagem,
          urlDownload:    etiqueta.url_download,
          instrucoes:     etiqueta.instrucoes,
          prazoPestagemm: etiqueta.prazo_postagem,
          pdfBuffer:      pdfBuffer ?? undefined,
        });
      } else {
        // Etiqueta falhou → e-mail de fallback avisando que a equipe entrará em contato
        await enviarEmailFallback({
          clienteNome:  nome,
          clienteEmail: emailDestino,
          numeroPedido,
          lojaEmail:    process.env.LOJA_EMAIL,
        });
      }
    } catch (emailErr) {
      // Falha no e-mail não bloqueia a resposta de sucesso
      console.error('[Email] Erro ao enviar e-mail (não afeta o fluxo principal):', emailErr);
    }

    // ── 8. Retorna sucesso ───────────────────────────────────
    return NextResponse.json<RespostaAPI<{ etiqueta?: EtiquetaMelhorEnvio }>>({
      sucesso: true,
      mensagem: 'Tudo pronto! Sua solicitação de devolução foi recebida com carinho e já estamos processando tudo por aqui.',
      dados: { etiqueta },
    });

  } catch (error) {
    console.error('[/api/reversa] Erro não tratado:', error);

    if (logId) {
      await atualizarLogReversa(logId, {
        status: 'erro',
        erro_mensagem: error instanceof Error ? error.message : 'Erro desconhecido',
      }).catch(() => null);
    }

    return NextResponse.json<RespostaAPI>(
      {
        sucesso: false,
        erro: 'Tivemos um problema inesperado. Nossa equipe já foi notificada. Por favor, tente novamente em breve.',
      },
      { status: 500 }
    );
  }
}
