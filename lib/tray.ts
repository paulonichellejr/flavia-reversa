/**
 * INTEGRAÇÃO TRAY COMMERCE
 * Documentação: https://developers.tray.com.br/reference
 *
 * COMO OBTER SEU TOKEN:
 * 1. Acesse o painel da Tray: https://app.tray.com.br
 * 2. Vá em Configurações > API > Tokens
 * 3. Gere um token com permissão de leitura de pedidos
 * 4. Cole em TRAY_API_KEY no seu .env.local
 */

import type { PedidoTray, RespostaAPI } from '@/types';

const TRAY_BASE_URL = process.env.TRAY_API_URL || 'https://api.dooki.com.br/v2';
const TRAY_API_KEY = process.env.TRAY_API_KEY!;
const TRAY_STORE_ID = process.env.TRAY_STORE_ID!;

// Prazo máximo em dias para solicitar devolução
const PRAZO_DEVOLUCAO_DIAS = 7;

/**
 * Busca um pedido na Tray pelo número e valida o CPF do comprador.
 * Retorna erro se o pedido não existir, o CPF não bater ou
 * o prazo de 7 dias já tiver expirado.
 */
export async function validarPedidoTray(
  numeroPedido: string,
  cpfCliente: string
): Promise<RespostaAPI<PedidoTray>> {
  try {
    const response = await fetch(
      `${TRAY_BASE_URL}/${TRAY_STORE_ID}/orders?number=${numeroPedido}`,
      {
        headers: {
          'Authorization': `Bearer ${TRAY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      return {
        sucesso: false,
        erro: 'Ops! Não conseguimos encontrar esse pedido. Que tal conferir o número e o CPF para tentarmos de novo?',
      };
    }

    const json = await response.json();
    const pedido: PedidoTray = json?.Orders?.[0] || json?.order;

    if (!pedido) {
      return {
        sucesso: false,
        erro: 'Ops! Não conseguimos encontrar esse pedido. Que tal conferir o número e o CPF para tentarmos de novo?',
      };
    }

    // Valida CPF
    const cpfNormalizado = cpfCliente.replace(/\D/g, '');
    const cpfPedido = (pedido.cliente?.cpf || '').replace(/\D/g, '');

    if (cpfNormalizado !== cpfPedido) {
      return {
        sucesso: false,
        erro: 'Hmm, o CPF informado não corresponde ao cadastro desse pedido. Pode conferir os dados e tentar novamente?',
      };
    }

    // Valida prazo de 7 dias
    const dataPedido = new Date(pedido.data_criacao);
    const hoje = new Date();
    const diffDias = Math.floor(
      (hoje.getTime() - dataPedido.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDias > PRAZO_DEVOLUCAO_DIAS) {
      return {
        sucesso: false,
        erro: `Que pena! O prazo para solicitar devolução deste pedido já encerrou. As trocas e devoluções precisam ser solicitadas em até ${PRAZO_DEVOLUCAO_DIAS} dias após a compra.`,
      };
    }

    return {
      sucesso: true,
      dados: pedido,
      mensagem: 'Pedido encontrado com sucesso!',
    };
  } catch (error) {
    console.error('[Tray] Erro ao buscar pedido:', error);
    return {
      sucesso: false,
      erro: 'Tivemos um problema ao consultar seu pedido. Tente novamente em alguns instantes, tá bem?',
    };
  }
}
