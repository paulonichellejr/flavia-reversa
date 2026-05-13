/**
 * GET /api/reversa/pedido?numero=XXXXX&cpf=XXX.XXX.XXX-XX
 *
 * Valida o pedido no Bling e retorna os itens disponíveis para devolução.
 * Usado pelo formulário para mostrar os itens antes do envio final.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validarPedidoBling } from '@/lib/bling';
import { rateLimit } from '@/lib/rate-limit';
import type { RespostaAPI } from '@/types';

// Aumenta o timeout para 60s (mesmo padrão da rota principal)
// Necessário pois a busca percorre até 500 pedidos no Bling
export const maxDuration = 60;

export interface ItemPedido {
  id: number;
  descricao: string;
  quantidade: number;
  valor: number;
}

export interface PedidoConsulta {
  numero: number;
  numeroLoja: string;
  data: string;
  itens: ItemPedido[];
}

export async function GET(req: NextRequest) {
  // Rate limiting: máx. 15 consultas por IP a cada 5 minutos
  // Previne brute force de CPF vs número de pedido
  const limited = rateLimit(req, { max: 15, windowMs: 5 * 60 * 1000 });
  if (limited) return limited;

  try {
    const numero = req.nextUrl.searchParams.get('numero');
    const cpf    = req.nextUrl.searchParams.get('cpf');

    if (!numero || !cpf) {
      return NextResponse.json<RespostaAPI>(
        { sucesso: false, erro: 'Informe o número do pedido e o CPF.' },
        { status: 400 }
      );
    }

    const resultado = await validarPedidoBling(numero, cpf);

    if (!resultado.sucesso || !resultado.dados) {
      return NextResponse.json<RespostaAPI>(
        { sucesso: false, erro: resultado.erro },
        { status: 422 }
      );
    }

    const pedido = resultado.dados;

    return NextResponse.json<RespostaAPI<PedidoConsulta>>({
      sucesso: true,
      dados: {
        numero:     pedido.numero,
        numeroLoja: pedido.numeroLoja,
        data:       pedido.data,
        itens: (pedido.itens ?? []).map((item) => ({
          id:         item.id,
          descricao:  item.descricao,
          quantidade: item.quantidade,
          valor:      item.valor,
        })),
      },
    });

  } catch (error) {
    console.error('[/api/reversa/pedido] Erro:', error);
    return NextResponse.json<RespostaAPI>(
      { sucesso: false, erro: 'Erro interno ao consultar o pedido. Tente novamente.' },
      { status: 500 }
    );
  }
}
